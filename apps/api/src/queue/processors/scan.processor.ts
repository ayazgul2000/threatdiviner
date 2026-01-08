import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../scm/services/crypto.service';
import { PRCommentsService } from '../../scm/services/pr-comments.service';
import { GitHubProvider } from '../../scm/providers';
import { GitService, LanguageStats } from '../../scanners/utils';
import { SemgrepScanner } from '../../scanners/sast/semgrep';
import { BanditScanner } from '../../scanners/sast/bandit';
import { GosecScanner } from '../../scanners/sast/gosec';
import { TrivyScanner } from '../../scanners/sca/trivy';
import { GitleaksScanner } from '../../scanners/secrets/gitleaks';
import { CheckovScanner } from '../../scanners/iac/checkov';
import { NucleiScanner } from '../../scanners/dast/nuclei';
import { FindingProcessorService } from '../../scanners/services/finding-processor.service';
import { DiffFilterService } from '../../scanners/services/diff-filter.service';
import { QueueService } from '../services/queue.service';
import { QUEUE_NAMES } from '../queue.constants';
import { ScanJobData, NotifyJobData, FindingsCount } from '../jobs';
import { IScanner, NormalizedFinding, ScanContext } from '../../scanners/interfaces';
import { BULL_CONNECTION } from '../custom-bull.module';
import { AiService, TriageRequest } from '../../ai/ai.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ScanGateway } from '../../scans/scan.gateway';

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
    private readonly checkovScanner: CheckovScanner,
    private readonly nucleiScanner: NucleiScanner,
    private readonly findingProcessor: FindingProcessorService,
    private readonly diffFilterService: DiffFilterService,
    private readonly queueService: QueueService,
    private readonly githubProvider: GitHubProvider,
    private readonly aiService: AiService,
    private readonly notificationsService: NotificationsService,
    private readonly prCommentsService: PRCommentsService,
    private readonly scanGateway: ScanGateway,
    @Inject(BULL_CONNECTION) private readonly connection: { host: string; port: number },
  ) {
    this.aiTriageEnabled = this.configService.get('AI_TRIAGE_ENABLED', 'false') === 'true';
    this.aiTriageBatchSize = parseInt(this.configService.get('AI_TRIAGE_BATCH_SIZE', '10'), 10);
  }

  async onModuleInit() {
    try {
      this.logger.log(`Connecting to Redis at ${this.connection.host}:${this.connection.port}...`);

      this.worker = new Worker(
        QUEUE_NAMES.SCAN,
        async (job: Job<ScanJobData>) => this.process(job),
        {
          connection: this.connection,
          concurrency: 2, // Process up to 2 jobs concurrently
        },
      );

      this.worker.on('completed', (job) => {
        this.logger.log(`Job ${job.id} completed successfully`);
      });

      this.worker.on('failed', (job, err) => {
        this.logger.error(`Job ${job?.id} failed: ${err.message}`, err.stack);
      });

      this.worker.on('error', (err) => {
        this.logger.error(`Worker error: ${err.message}`, err.stack);
      });

      this.worker.on('ready', () => {
        this.logger.log('Scan worker connected to Redis and ready to process jobs');
      });

      this.worker.on('active', (job) => {
        this.logger.log(`Job ${job.id} started processing for ${job.data?.fullName || 'unknown'}`);
      });

      this.worker.on('progress', (job, progress) => {
        this.logger.debug(`Job ${job.id} progress: ${progress}%`);
      });

      this.worker.on('stalled', (jobId) => {
        this.logger.warn(`Job ${jobId} has stalled`);
      });

      // Wait for the worker to be ready
      await this.worker.waitUntilReady();
      this.logger.log(`Scan worker started on queue '${QUEUE_NAMES.SCAN}'`);
    } catch (error) {
      this.logger.error(`Failed to start scan worker: ${error}`);
      // Don't throw - allow app to start even if Redis is not available
      this.logger.warn('Scan processing will not work until Redis is available');
    }
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

      // Emit phase: initializing -> cloning
      this.scanGateway.emitScanPhase(scanId, { phase: 'initializing', percent: 10 });

      workDir = await this.cloneRepository(job.data);
      await job.updateProgress(30);

      // 2. Detect languages
      await this.updateScanStatus(scanId, 'scanning');
      const languages = await this.gitService.detectLanguages(workDir);
      this.logger.log(`Detected languages: ${JSON.stringify(languages)}`);

      // Emit phase: scanning (with detected languages)
      this.scanGateway.emitScanPhase(scanId, {
        phase: 'scanning',
        percent: 30,
        detectedTechnologies: Object.keys(languages.languages),
      });

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
        config: {
          hasTerraform: languages.hasTerraform,
          hasDockerfile: languages.hasDockerfile,
          hasKubernetes: languages.hasKubernetes,
          hasCloudFormation: languages.hasCloudFormation,
          targetUrls: job.data.config.targetUrls,
          containerImages: job.data.config.containerImages,
        },
      });
      await job.updateProgress(70);

      // Emit phase: scanning complete
      this.scanGateway.emitScanPhase(scanId, { phase: 'scanning', percent: 70 });

      // 4. Process and store findings
      await this.updateScanStatus(scanId, 'analyzing');
      let dedupedFindings = this.findingProcessor.deduplicateFindings(allFindings);
      await job.updateProgress(75);

      // 4b. Apply diff filter for PR scans (diff-only mode)
      if (job.data.pullRequestId && job.data.config.prDiffOnly) {
        dedupedFindings = await this.applyDiffFilter(job.data, dedupedFindings);
      }
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

      // 7b. Post PR inline comments (if PR scan)
      if (job.data.pullRequestId) {
        await this.postPRComments(scanId, job.data.checkRunId);
      }

      // 8. Complete
      await this.completeScan(scanId, storedCount, Date.now() - startTime);
      await job.updateProgress(100);

      // Emit phase: complete
      this.scanGateway.emitScanPhase(scanId, { phase: 'complete', percent: 100 });

      // Emit scan:complete via WebSocket
      this.scanGateway.emitScanComplete(scanId, {
        totalFindings: storedCount,
        severityBreakdown: {
          critical: findingsCount.critical,
          high: findingsCount.high,
          medium: findingsCount.medium,
          low: findingsCount.low,
          info: findingsCount.info,
        },
        duration: Date.now() - startTime,
        status: 'completed',
      });

      // 9. Send Slack notifications
      await this.sendSlackNotification(job.data, findingsCount, Math.round((Date.now() - startTime) / 1000));

      this.logger.log(`Scan ${scanId} completed: ${storedCount} findings stored`);

    } catch (error) {
      this.logger.error(`Scan ${scanId} failed: ${error}`);
      await this.failScan(scanId, error instanceof Error ? error.message : 'Unknown error');
      await this.updateCheckRun(job.data, 'completed', 'Scan failed', 'failure');

      // Emit scan:complete with failed status via WebSocket
      this.scanGateway.emitScanComplete(scanId, {
        totalFindings: 0,
        severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        duration: Date.now() - startTime,
        status: 'failed',
      });

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

    // IaC Scanner (Checkov) - run when IaC files detected
    if (config.enableIac !== false) {
      const hasIacFiles = languages.hasTerraform || languages.hasDockerfile ||
        languages.hasKubernetes || languages.hasCloudFormation;
      if (hasIacFiles) {
        scanners.push(this.checkovScanner);
        this.logger.log('Added Checkov scanner (IaC)');
      }
    }

    // DAST Scanner (Nuclei) - run when target URLs configured
    this.logger.log(`DAST check: enableDast=${config.enableDast}, targetUrls=${JSON.stringify(config.targetUrls)}`);
    if (config.enableDast && config.targetUrls && config.targetUrls.length > 0) {
      scanners.push(this.nucleiScanner);
      this.logger.log('Added Nuclei scanner (DAST)');
    } else if (config.enableDast) {
      this.logger.warn('DAST enabled but no target URLs configured - skipping Nuclei scanner');
    }

    this.logger.log(`Selected ${scanners.length} scanners: ${scanners.map(s => s.name).join(', ')}`);
    return scanners;
  }

  private getScannerCategory(scannerName: string): string {
    const name = scannerName.toLowerCase();
    if (['semgrep', 'bandit', 'gosec'].includes(name)) return 'sast';
    if (['trivy'].includes(name)) return 'sca';
    if (['gitleaks'].includes(name)) return 'secrets';
    if (['checkov'].includes(name)) return 'iac';
    if (['nuclei', 'zap'].includes(name)) return 'dast';
    return 'other';
  }

  private async runScanners(
    scanners: IScanner[],
    context: ScanContext,
  ): Promise<NormalizedFinding[]> {
    const allFindings: NormalizedFinding[] = [];
    const scanId = context.scanId;

    // Run scanners in parallel with settled to handle partial failures
    const results = await Promise.allSettled(
      scanners.map(async (scanner) => {
        const startTime = Date.now();
        const category = this.getScannerCategory(scanner.name);

        // Emit scanner:start event via WebSocket
        this.scanGateway.emitScannerStart(scanId, {
          scanner: scanner.name,
          label: this.getScannerLabel(scanner.name),
          phase: 'single',
        });

        // Create scanner result record as "running"
        const scannerResult = await this.prisma.scannerResult.create({
          data: {
            scanId,
            scanner: scanner.name,
            category,
            status: 'running',
            startedAt: new Date(),
            targetInfo: category === 'dast'
              ? JSON.stringify(context.config?.targetUrls || [])
              : JSON.stringify(context.languages || []),
          },
        });

        this.logger.log(`Running ${scanner.name}...`);

        try {
          const isAvailable = await scanner.isAvailable();
          if (!isAvailable) {
            this.logger.warn(`Scanner ${scanner.name} is not available`);
            await this.prisma.scannerResult.update({
              where: { id: scannerResult.id },
              data: {
                status: 'skipped',
                errorMessage: 'Scanner not available',
                completedAt: new Date(),
                duration: Date.now() - startTime,
              },
            });

            // Emit scanner:complete for skipped scanner
            this.scanGateway.emitScannerComplete(scanId, {
              scanner: scanner.name,
              label: this.getScannerLabel(scanner.name),
              findingsCount: 0,
              duration: Date.now() - startTime,
              status: 'skipped',
              error: 'Scanner not available',
            });

            return { findings: [], scannerResultId: scannerResult.id };
          }

          // Emit progress as scanner is starting execution
          this.scanGateway.emitScannerProgress(scanId, {
            scanner: scanner.name,
            phase: 'scanning',
            percent: 10,
          });

          const output = await scanner.scan(context);
          const duration = Date.now() - startTime;

          // Emit progress as output is being parsed
          this.scanGateway.emitScannerProgress(scanId, {
            scanner: scanner.name,
            phase: 'parsing',
            percent: 80,
          });

          if (output.timedOut) {
            this.logger.warn(`Scanner ${scanner.name} timed out`);
            await this.prisma.scannerResult.update({
              where: { id: scannerResult.id },
              data: {
                status: 'failed',
                errorMessage: 'Scanner timed out',
                exitCode: -1,
                completedAt: new Date(),
                duration,
              },
            });

            // Emit scanner:complete for timed out scanner
            this.scanGateway.emitScannerComplete(scanId, {
              scanner: scanner.name,
              label: this.getScannerLabel(scanner.name),
              findingsCount: 0,
              duration,
              status: 'failed',
              exitCode: -1,
              error: 'Scanner timed out',
            });

            return { findings: [], scannerResultId: scannerResult.id };
          }

          const findings = await scanner.parseOutput(output);

          // Emit each finding as it's discovered for real-time updates
          for (const finding of findings) {
            this.scanGateway.emitScannerFinding(scanId, {
              scanner: scanner.name,
              label: this.getScannerLabel(scanner.name),
              finding: {
                id: finding.fingerprint || `${scanner.name}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                severity: finding.severity,
                title: finding.title,
                filePath: finding.filePath,
                url: finding.metadata?.url as string | undefined,
                cweIds: finding.cweIds.length > 0 ? finding.cweIds : undefined,
              },
            });
          }

          const status = output.exitCode === 0 || output.exitCode === 1 ? 'completed' : 'failed';

          // Update scanner result with success
          await this.prisma.scannerResult.update({
            where: { id: scannerResult.id },
            data: {
              status,
              exitCode: output.exitCode,
              findingsCount: findings.length,
              completedAt: new Date(),
              duration,
              command: `${scanner.name} scan`,
              errorMessage: output.exitCode > 1 ? output.stderr?.substring(0, 500) : null,
            },
          });

          // Emit scanner:complete event
          this.scanGateway.emitScannerComplete(scanId, {
            scanner: scanner.name,
            label: this.getScannerLabel(scanner.name),
            findingsCount: findings.length,
            duration,
            status: status as 'completed' | 'failed',
            exitCode: output.exitCode,
            command: `${scanner.name} scan`,
            verboseOutput: output.stdout?.substring(0, 10000),
          });

          if (output.exitCode !== 0 && output.exitCode !== 1) {
            this.logger.warn(`Scanner ${scanner.name} exited with code ${output.exitCode}`);
          }

          return { findings, scannerResultId: scannerResult.id };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await this.prisma.scannerResult.update({
            where: { id: scannerResult.id },
            data: {
              status: 'failed',
              errorMessage: errorMessage.substring(0, 500),
              completedAt: new Date(),
              duration: Date.now() - startTime,
            },
          });

          // Emit scanner:complete for failed scanner
          this.scanGateway.emitScannerComplete(scanId, {
            scanner: scanner.name,
            label: this.getScannerLabel(scanner.name),
            findingsCount: 0,
            duration: Date.now() - startTime,
            status: 'failed',
            error: errorMessage.substring(0, 500),
          });

          throw error;
        }
      }),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        allFindings.push(...result.value.findings);
      } else {
        this.logger.error(`Scanner ${scanners[i].name} failed: ${result.reason}`);
      }
    }

    return allFindings;
  }

  private getScannerLabel(scannerName: string): string {
    const labels: Record<string, string> = {
      semgrep: 'SAST Analysis',
      bandit: 'Python Security',
      gosec: 'Go Security',
      trivy: 'Dependency Scan',
      gitleaks: 'Secret Detection',
      checkov: 'IaC Security',
      nuclei: 'DAST Scan',
      zap: 'Web App Scan',
    };
    return labels[scannerName.toLowerCase()] || scannerName;
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

  private async sendSlackNotification(
    data: ScanJobData,
    findingsCount: FindingsCount,
    durationSeconds: number,
  ): Promise<void> {
    try {
      const status = this.determineStatus(findingsCount);

      await this.notificationsService.notifyScanCompleted({
        scanId: data.scanId,
        tenantId: data.tenantId,
        repositoryName: data.fullName,
        branch: data.branch,
        commitSha: data.commitSha,
        triggeredBy: data.triggeredBy || 'manual',
        status,
        duration: durationSeconds,
        findings: {
          critical: findingsCount.critical,
          high: findingsCount.high,
          medium: findingsCount.medium,
          low: findingsCount.low,
          total: findingsCount.critical + findingsCount.high + findingsCount.medium + findingsCount.low + findingsCount.info,
        },
      });
    } catch (error) {
      // Log but don't fail the scan if notifications fail
      this.logger.error(`Slack notification failed: ${error}`);
    }
  }

  private async postPRComments(scanId: string, checkRunId?: string): Promise<void> {
    try {
      // Post inline comments on PR
      const { posted, skipped } = await this.prCommentsService.postPRComments(scanId);
      this.logger.log(`Posted ${posted} PR comments (${skipped} skipped due to limit)`);

      // Update check run with annotations
      if (checkRunId) {
        await this.prCommentsService.updateCheckRunWithAnnotations(scanId, checkRunId);
      }
    } catch (error) {
      // Log but don't fail the scan if PR comments fail
      this.logger.error(`PR comments failed: ${error}`);
    }
  }

  /**
   * Apply diff filter to only include findings in changed lines
   */
  private async applyDiffFilter(
    data: ScanJobData,
    findings: NormalizedFinding[],
  ): Promise<NormalizedFinding[]> {
    try {
      this.logger.log(`Applying diff filter for PR #${data.pullRequestId}`);

      // Get the PR diff from GitHub
      const connection = await this.prisma.scmConnection.findUnique({
        where: { id: data.connectionId },
      });

      if (!connection) {
        this.logger.warn('Connection not found for diff filter, skipping');
        return findings;
      }

      const accessToken = this.cryptoService.decrypt(connection.accessToken);
      const [owner, repo] = data.fullName.split('/');

      // Get PR diff
      const diffText = await this.githubProvider.getPullRequestDiff(
        accessToken,
        owner,
        repo,
        data.pullRequestId!,
      );

      if (!diffText) {
        this.logger.warn('No diff found, skipping filter');
        return findings;
      }

      // Parse the diff
      const diffData = this.diffFilterService.parseDiff(diffText);

      // Cache the diff for later use (e.g., for PR comments)
      await this.diffFilterService.cacheDiff(
        data.scanId,
        data.pullRequestId!,
        diffData,
      );

      // Filter findings
      const filtered = this.diffFilterService.filterFindingsByDiff(findings, diffData);

      this.logger.log(
        `Diff filter: ${findings.length} → ${filtered.length} findings (${findings.length - filtered.length} filtered out)`,
      );

      return filtered;
    } catch (error) {
      this.logger.error(`Diff filter failed: ${error}`);
      // On error, return all findings rather than failing
      return findings;
    }
  }
}
