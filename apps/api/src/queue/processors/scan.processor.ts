import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { AiService, TriageRequest } from '../../ai/ai.service';

type ScanStatus = 'pending' | 'queued' | 'cloning' | 'scanning' | 'analyzing' | 'storing' | 'notifying' | 'completed' | 'failed';

@Injectable()
export class ScanProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanProcessor.name);
  private worker: Worker | null = null;

  private readonly aiTriageEnabled: boolean;
  private readonly aiTriageBatchSize: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly configService: ConfigService,
    private readonly gitService: GitService,
    private readonly semgrepScanner: SemgrepScanner,
    private readonly banditScanner: BanditScanner,
    private readonly gosecScanner: GosecScanner,
    private readonly trivyScanner: TrivyScanner,
    private readonly gitleaksScanner: GitleaksScanner,
    private readonly findingProcessor: FindingProcessorService,
    private readonly queueService: QueueService,
    private readonly githubProvider: GitHubProvider,
    private readonly aiService: AiService,
    @Inject(BULL_CONNECTION) private readonly connection: { host: string; port: number },
  ) {
    this.aiTriageEnabled = this.configService.get('AI_TRIAGE_ENABLED', 'false') === 'true';
    this.aiTriageBatchSize = parseInt(this.configService.get('AI_TRIAGE_BATCH_SIZE', '10'), 10);
  }

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
      await job.updateProgress(85);

      // 5. AI Auto-triage (if enabled)
      if (this.aiTriageEnabled && storedCount > 0) {
        await this.runAutoTriage(scanId, repositoryId, job.data);
      }
      await job.updateProgress(90);

      // 6. Count findings by severity
      const findingsCount = await this.findingProcessor.countFindingsBySeverity(scanId);

      // 7. Notify (GitHub check run, PR comment)
      if (job.data.pullRequestId || job.data.checkRunId) {
        await this.updateScanStatus(scanId, 'notifying');
        await this.enqueueNotification(job.data, findingsCount, startTime);
      }

      // 8. Complete
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

  private async runAutoTriage(
    scanId: string,
    repositoryId: string,
    data: ScanJobData,
  ): Promise<void> {
    try {
      // Check if AI is available
      const isAvailable = await this.aiService.isAvailable();
      if (!isAvailable) {
        this.logger.warn('AI triage not available - skipping auto-triage');
        return;
      }

      // Get the repository info for context
      const repository = await this.prisma.repository.findUnique({
        where: { id: repositoryId },
        select: { name: true, language: true },
      });

      // Get high and critical severity findings that haven't been triaged
      const findings = await this.prisma.finding.findMany({
        where: {
          scanId,
          severity: { in: ['critical', 'high'] },
          aiTriagedAt: null, // Not already triaged
        },
        take: this.aiTriageBatchSize,
        orderBy: [
          { severity: 'asc' }, // critical first (alphabetical)
          { createdAt: 'asc' },
        ],
      });

      if (findings.length === 0) {
        this.logger.log('No high/critical findings to auto-triage');
        return;
      }

      this.logger.log(`Auto-triaging ${findings.length} high/critical findings...`);

      // Build triage requests
      const requests: TriageRequest[] = findings.map((f) => ({
        finding: {
          id: f.id,
          title: f.title,
          description: f.description || '',
          severity: f.severity,
          ruleId: f.ruleId,
          filePath: f.filePath,
          startLine: f.startLine || 0,
          snippet: f.snippet || undefined,
          cweId: f.cweId || undefined,
        },
        repositoryContext: {
          name: repository?.name || data.fullName,
          language: repository?.language || 'unknown',
        },
      }));

      // Run batch triage
      const results = await this.aiService.batchTriageFindings(requests);

      // Update findings with AI triage results
      let triaged = 0;
      for (const finding of findings) {
        const result = results.get(finding.id);
        if (result) {
          await this.prisma.finding.update({
            where: { id: finding.id },
            data: {
              aiAnalysis: result.analysis,
              aiConfidence: result.confidence,
              aiSeverity: result.suggestedSeverity,
              aiFalsePositive: result.isLikelyFalsePositive,
              aiExploitability: result.exploitability,
              aiRemediation: result.remediation,
              aiTriagedAt: new Date(),
            },
          });
          triaged++;
        }
      }

      this.logger.log(`Auto-triaged ${triaged} findings`);
    } catch (error) {
      // Log but don't fail the scan if AI triage fails
      this.logger.error(`Auto-triage failed: ${error}`);
    }
  }
}
