import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../scm/services/crypto.service';
import { GitHubProvider } from '../../scm/providers';
import { GitService, LanguageStats } from '../../scanners/utils';
import { SemgrepScanner } from '../../scanners/sast/semgrep';
import { BanditScanner } from '../../scanners/sast/bandit';
import { GosecScanner } from '../../scanners/sast/gosec';
import { TrivyScanner } from '../../scanners/sca/trivy';
import { GitleaksScanner } from '../../scanners/secrets/gitleaks';
import { FindingProcessorService } from '../../scanners/services/finding-processor.service';
import { QueueService } from '../services/queue.service';
import { QUEUE_NAMES } from '../queue.constants';
import { ScanJobData, NotifyJobData, FindingsCount } from '../jobs';
import { IScanner, NormalizedFinding, ScanContext } from '../../scanners/interfaces';
import { BULL_CONNECTION } from '../custom-bull.module';

type ScanStatus = 'pending' | 'queued' | 'cloning' | 'scanning' | 'analyzing' | 'storing' | 'notifying' | 'completed' | 'failed';

@Injectable()
export class ScanProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanProcessor.name);
  private worker: Worker | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly gitService: GitService,
    private readonly semgrepScanner: SemgrepScanner,
    private readonly banditScanner: BanditScanner,
    private readonly gosecScanner: GosecScanner,
    private readonly trivyScanner: TrivyScanner,
    private readonly gitleaksScanner: GitleaksScanner,
    private readonly findingProcessor: FindingProcessorService,
    private readonly queueService: QueueService,
    private readonly githubProvider: GitHubProvider,
    @Inject(BULL_CONNECTION) private readonly connection: { host: string; port: number },
  ) {}

  async onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.SCAN,
      async (job: Job<ScanJobData>) => this.process(job),
      { connection: this.connection },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('Scan worker started');
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('Scan worker stopped');
    }
  }

  async process(job: Job<ScanJobData>): Promise<void> {
    const { scanId, tenantId, repositoryId, fullName } = job.data;
    let workDir: string | undefined;
    const startTime = Date.now();

    this.logger.log(`Processing scan ${scanId} for ${fullName}`);

    try {
      // 1. Clone repository
      await this.updateScanStatus(scanId, 'cloning');
      await this.updateCheckRun(job.data, 'in_progress', 'Cloning repository...');
      await job.updateProgress(10);

      workDir = await this.cloneRepository(job.data);
      await job.updateProgress(30);

      // 2. Detect languages
      await this.updateScanStatus(scanId, 'scanning');
      const languages = await this.gitService.detectLanguages(workDir);
      this.logger.log(`Detected languages: ${JSON.stringify(languages)}`);

      // 3. Select and run scanners
      await this.updateCheckRun(job.data, 'in_progress', 'Running security scanners...');
      this.logger.log(`DEBUG: Job config: ${JSON.stringify(job.data.config)}`);
      const scanners = this.selectScanners(languages, job.data.config);
      this.logger.log(`DEBUG: Selected ${scanners.length} scanners: ${scanners.map(s => s.name).join(', ') || 'NONE'}`);
      const allFindings = await this.runScanners(scanners, {
        scanId,
        workDir,
        languages: Object.keys(languages.languages),
        excludePaths: job.data.config.skipPaths,
        timeout: 300000, // 5 min per scanner
      });
      await job.updateProgress(70);

      // 4. Process and store findings
      await this.updateScanStatus(scanId, 'analyzing');
      const dedupedFindings = this.findingProcessor.deduplicateFindings(allFindings);
      await job.updateProgress(80);

      await this.updateScanStatus(scanId, 'storing');
      const storedCount = await this.findingProcessor.storeFindings(
        scanId,
        tenantId,
        repositoryId,
        dedupedFindings,
        workDir, // Pass workDir to strip from file paths
      );
      await job.updateProgress(90);

      // 5. Count findings by severity
      const findingsCount = await this.findingProcessor.countFindingsBySeverity(scanId);

      // 6. Notify (GitHub check run, PR comment)
      if (job.data.pullRequestId || job.data.checkRunId) {
        await this.updateScanStatus(scanId, 'notifying');
        await this.enqueueNotification(job.data, findingsCount, startTime);
      }

      // 7. Complete
      await this.completeScan(scanId, storedCount, Date.now() - startTime);
      await job.updateProgress(100);

      this.logger.log(`Scan ${scanId} completed: ${storedCount} findings stored`);

    } catch (error) {
      this.logger.error(`Scan ${scanId} failed: ${error}`);
      await this.failScan(scanId, error instanceof Error ? error.message : 'Unknown error');
      await this.updateCheckRun(job.data, 'completed', 'Scan failed', 'failure');
      throw error;
    } finally {
      // Always cleanup
      if (workDir) {
        await this.gitService.cleanup(workDir);
      }
    }
  }

  private async cloneRepository(data: ScanJobData): Promise<string> {
    // Get access token
    const connection = await this.prisma.scmConnection.findUnique({
      where: { id: data.connectionId },
    });

    if (!connection) {
      throw new Error('Connection not found');
    }

    const accessToken = this.cryptoService.decrypt(connection.accessToken);

    // Create work directory
    const workDir = await this.gitService.createWorkDir(data.scanId);

    // Clone
    await this.gitService.clone({
      url: data.cloneUrl,
      workDir,
      accessToken,
      branch: data.branch,
      depth: 1,
      timeout: 300000, // 5 minutes
    });

    // Checkout specific commit
    await this.gitService.checkout(workDir, data.commitSha);

    return workDir;
  }

  private selectScanners(languages: LanguageStats, config: ScanJobData['config']): IScanner[] {
    const scanners: IScanner[] = [];
    const detectedLangs = Object.keys(languages.languages);

    this.logger.log(`Selecting scanners for languages: ${detectedLangs.join(', ')}`);

    // SAST Scanners
    if (config.enableSast) {
      // Semgrep - supports most languages
      const semgrepLanguages = this.semgrepScanner.supportedLanguages;
      const hasSemgrepSupported = detectedLangs.some((lang) =>
        semgrepLanguages.includes(lang),
      );
      if (hasSemgrepSupported) {
        scanners.push(this.semgrepScanner);
        this.logger.log('Added Semgrep scanner');
      }

      // Bandit - Python only
      if (detectedLangs.includes('python')) {
        scanners.push(this.banditScanner);
        this.logger.log('Added Bandit scanner (Python)');
      }

      // Gosec - Go only
      if (detectedLangs.includes('go')) {
        scanners.push(this.gosecScanner);
        this.logger.log('Added Gosec scanner (Go)');
      }
    }

    // SCA Scanner (Trivy) - always run for dependency scanning
    if (config.enableSca !== false) {
      scanners.push(this.trivyScanner);
      this.logger.log('Added Trivy scanner (SCA)');
    }

    // Secrets Scanner (Gitleaks) - always run for secrets detection
    if (config.enableSecrets !== false) {
      scanners.push(this.gitleaksScanner);
      this.logger.log('Added Gitleaks scanner (secrets)');
    }

    this.logger.log(`Selected ${scanners.length} scanners: ${scanners.map(s => s.name).join(', ')}`);
    return scanners;
  }

  private async runScanners(
    scanners: IScanner[],
    context: ScanContext,
  ): Promise<NormalizedFinding[]> {
    const allFindings: NormalizedFinding[] = [];

    // Run scanners in parallel with settled to handle partial failures
    const results = await Promise.allSettled(
      scanners.map(async (scanner) => {
        this.logger.log(`Running ${scanner.name}...`);

        const isAvailable = await scanner.isAvailable();
        if (!isAvailable) {
          this.logger.warn(`Scanner ${scanner.name} is not available`);
          return [];
        }

        const output = await scanner.scan(context);

        if (output.timedOut) {
          this.logger.warn(`Scanner ${scanner.name} timed out`);
          return [];
        }

        if (output.exitCode !== 0 && output.exitCode !== 1) {
          // Exit code 1 usually means findings were found
          this.logger.warn(`Scanner ${scanner.name} exited with code ${output.exitCode}`);
        }

        return scanner.parseOutput(output);
      }),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        allFindings.push(...result.value);
      } else {
        this.logger.error(`Scanner ${scanners[i].name} failed: ${result.reason}`);
      }
    }

    return allFindings;
  }

  private async updateScanStatus(scanId: string, status: ScanStatus): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (status === 'cloning') {
      updateData.startedAt = new Date();
    }

    await this.prisma.scan.update({
      where: { id: scanId },
      data: updateData,
    });
  }

  private async completeScan(scanId: string, _findingsCount: number, duration: number): Promise<void> {
    await this.prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        duration: Math.round(duration / 1000), // Convert to seconds
      },
    });

    // Update repository last scan time
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      select: { repositoryId: true },
    });

    if (scan) {
      await this.prisma.repository.update({
        where: { id: scan.repositoryId },
        data: { lastScanAt: new Date() },
      });
    }
  }

  private async failScan(scanId: string, errorMessage: string): Promise<void> {
    await this.prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage,
      },
    });
  }

  private async updateCheckRun(
    data: ScanJobData,
    status: 'queued' | 'in_progress' | 'completed',
    summary: string,
    conclusion?: 'success' | 'failure' | 'neutral',
  ): Promise<void> {
    if (!data.checkRunId) return;

    try {
      const connection = await this.prisma.scmConnection.findUnique({
        where: { id: data.connectionId },
      });

      if (!connection) return;

      const accessToken = this.cryptoService.decrypt(connection.accessToken);
      const [owner, repo] = data.fullName.split('/');

      await this.githubProvider.updateCheckRun(
        accessToken,
        owner,
        repo,
        data.checkRunId,
        status,
        conclusion,
        {
          title: 'ThreatDiviner Security Scan',
          summary,
        },
      );
    } catch (error) {
      this.logger.warn(`Failed to update check run: ${error}`);
    }
  }

  private async enqueueNotification(
    data: ScanJobData,
    findingsCount: FindingsCount,
    startTime: number,
  ): Promise<void> {
    const notifyData: NotifyJobData = {
      scanId: data.scanId,
      tenantId: data.tenantId,
      repositoryId: data.repositoryId,
      connectionId: data.connectionId,
      fullName: data.fullName,
      pullRequestId: data.pullRequestId,
      checkRunId: data.checkRunId,
      commitSha: data.commitSha,
      findingsCount,
      status: this.determineStatus(findingsCount),
      scanDuration: Date.now() - startTime,
    };

    await this.queueService.enqueueNotification(notifyData);
  }

  private determineStatus(counts: FindingsCount): 'success' | 'failure' | 'neutral' {
    if (counts.critical > 0 || counts.high > 0) {
      return 'failure';
    }
    if (counts.medium > 0) {
      return 'neutral';
    }
    return 'success';
  }
}
