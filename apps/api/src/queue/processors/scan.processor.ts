import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../scm/services/crypto.service';
import { PRCommentsService } from '../../scm/services/pr-comments.service';
import { SarifUploadService } from '../../scm/services/sarif-upload.service';
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
import { FindingEnrichmentService } from '../../vulndb/finding-enrichment.service';

type ScanStatus = 'pending' | 'queued' | 'cloning' | 'scanning' | 'analyzing' | 'storing' | 'triaging' | 'notifying' | 'completed' | 'failed';
type TriageMode = 'snippet' | 'full-file' | 'none';

@Injectable()
export class ScanProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanProcessor.name);
  private worker: Worker | null = null;

  private readonly aiTriageEnabled: boolean;
  private readonly aiTriageBatchSize: number;
  private readonly aiSuggestionsEnabled: boolean;
  private readonly aiSuggestionsMinConfidence: number;
  private readonly defaultTriageMode: TriageMode = 'snippet';

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
    private readonly findingEnrichmentService: FindingEnrichmentService,
    private readonly sarifUploadService: SarifUploadService,
    @Inject(BULL_CONNECTION) private readonly connection: { host: string; port: number },
  ) {
    this.aiTriageEnabled = this.configService.get('AI_TRIAGE_ENABLED', 'false') === 'true';
    this.aiTriageBatchSize = parseInt(this.configService.get('AI_TRIAGE_BATCH_SIZE', '50'), 10);
    // AI suggestions enabled by default for PR scans
    this.aiSuggestionsEnabled = this.configService.get('AI_SUGGESTIONS_ENABLED', 'true') === 'true';
    this.aiSuggestionsMinConfidence = parseFloat(this.configService.get('AI_SUGGESTIONS_MIN_CONFIDENCE', '0.8'));
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
    const { scanId, tenantId, repositoryId, fullName, scanType } = job.data;
    let workDir: string | undefined;
    const startTime = Date.now();

    this.logger.log(`Processing scan ${scanId} for ${fullName} (type: ${scanType || 'standard'})`);

    // Handle deep analysis scan type differently
    if (scanType === 'deep-analysis') {
      await this.processDeepAnalysis(job);
      return;
    }

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

      // 4. Process and store findings
      await this.updateScanStatus(scanId, 'analyzing');
      let dedupedFindings = this.findingProcessor.deduplicateFindings(allFindings);
      await job.updateProgress(75);

      // 4b. Apply diff filter (diff-only mode)
      // Works for both PR scans and branch scans
      if (job.data.config.prDiffOnly) {
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
      // Get effective triage mode for this scan
      const triageMode = await this.getEffectiveTriageMode(repositoryId, job.data.branch);

      // Update scan with triage mode
      await this.prisma.scan.update({
        where: { id: scanId },
        data: { triageMode },
      });

      if (this.aiTriageEnabled && storedCount > 0 && triageMode !== 'none') {
        await this.updateScanStatus(scanId, 'triaging');

        if (triageMode === 'full-file' && workDir) {
          // Full-file mode: run triage with file access BEFORE cleanup
          await this.runFullFileTriage(scanId, repositoryId, job.data, workDir);
        } else {
          // Snippet mode: run triage with just snippets (can run after cleanup)
          await this.runAutoTriage(scanId, repositoryId, job.data);
        }
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
        await this.postPRComments(scanId);

        // 7b.2. Post AI-generated fix suggestions (if enabled)
        if (this.aiSuggestionsEnabled) {
          await this.postAISuggestionsForPR(scanId);
        }
      }

      // 7c. Update check run with annotations (for all scans with checkRunId)
      if (job.data.checkRunId) {
        await this.updateCheckRunAnnotations(scanId, job.data.checkRunId);
      }

      // 7d. Upload SARIF to GitHub Security tab (if enabled in write-back config)
      await this.uploadSarifIfEnabled(scanId);

      // 8. Complete
      await this.completeScan(scanId, storedCount, Date.now() - startTime);
      await job.updateProgress(100);

      // 9. Send Slack notifications
      await this.sendSlackNotification(job.data, findingsCount, Math.round((Date.now() - startTime) / 1000));

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
    if (config.enableDast && config.targetUrls && config.targetUrls.length > 0) {
      scanners.push(this.nucleiScanner);
      this.logger.log('Added Nuclei scanner (DAST)');
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

    // Enrich findings with VulnDB data (CWE, ATT&CK, OWASP, compliance mappings)
    try {
      await this.findingEnrichmentService.enrichScanFindings(scanId);
      this.logger.log(`Enriched findings for scan ${scanId}`);
    } catch (error) {
      this.logger.warn(`Failed to enrich findings for scan ${scanId}: ${error}`);
    }

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

      // Update findings with AI triage results and generate code fixes
      let triaged = 0;
      let fixesGenerated = 0;

      for (const finding of findings) {
        const result = results.get(finding.id);
        if (result) {
          // Update triage data first
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

          // Generate actual code fix if NOT a false positive and has snippet
          if (!result.isLikelyFalsePositive && finding.snippet) {
            try {
              const fixResult = await this.aiService.generateAutoFix({
                finding: {
                  ruleId: finding.ruleId,
                  title: finding.title,
                  description: finding.description || '',
                  severity: finding.severity,
                  filePath: finding.filePath,
                  startLine: finding.startLine || 1,
                  endLine: finding.endLine || undefined,
                  snippet: finding.snippet,
                  cweId: finding.cweId || undefined,
                },
                fileContent: finding.snippet, // Use snippet as context if full file not available
              });

              if (fixResult && fixResult.fixedCode) {
                await this.prisma.finding.update({
                  where: { id: finding.id },
                  data: {
                    autoFix: fixResult.fixedCode,
                    aiRemediation: fixResult.explanation, // Update with fix explanation
                    aiConfidence: fixResult.confidence,
                  },
                });
                fixesGenerated++;
              }
            } catch (fixError) {
              this.logger.warn(`Failed to generate fix for finding ${finding.id}: ${fixError}`);
            }
          }
        }
      }

      this.logger.log(`Auto-triaged ${triaged} findings, generated ${fixesGenerated} code fixes`);
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

  private async postPRComments(scanId: string): Promise<void> {
    try {
      // Post inline comments on PR
      const { posted, skipped } = await this.prCommentsService.postPRComments(scanId);
      this.logger.log(`Posted ${posted} PR comments (${skipped} skipped due to limit)`);
    } catch (error) {
      // Log but don't fail the scan if PR comments fail
      this.logger.error(`PR comments failed: ${error}`);
    }
  }

  /**
   * Post AI-generated fix suggestions to the PR
   * Only posts for findings that meet the confidence threshold
   */
  private async postAISuggestionsForPR(scanId: string): Promise<void> {
    try {
      // Check if AI is available first
      const isAvailable = await this.aiService.isAvailable();
      if (!isAvailable) {
        this.logger.warn('AI service not available - skipping AI suggestions');
        return;
      }

      // Check if repo has AI suggestions disabled
      const scan = await this.prisma.scan.findUnique({
        where: { id: scanId },
        include: {
          repository: {
            include: {
              scanConfig: true,
            },
          },
        },
      });

      if (!scan) {
        this.logger.warn(`Scan ${scanId} not found for AI suggestions`);
        return;
      }

      // Check if AI suggestions are disabled for this repo
      if (scan.repository.scanConfig?.aiSuggestionsEnabled === false) {
        this.logger.log(`AI suggestions disabled for repository ${scan.repository.name}`);
        return;
      }

      // Post AI suggestions
      const { posted, skipped, results } = await this.prCommentsService.postAISuggestions(scanId);

      const errors = results.filter(r => !r.success);
      if (errors.length > 0) {
        this.logger.warn(`AI suggestion errors: ${errors.map(e => e.error).join(', ')}`);
      }

      this.logger.log(
        `Posted ${posted} AI suggestions to PR (${skipped} skipped, min confidence: ${this.aiSuggestionsMinConfidence})`,
      );
    } catch (error) {
      // Log but don't fail the scan if AI suggestions fail
      this.logger.error(`AI suggestions failed: ${error}`);
    }
  }

  private async updateCheckRunAnnotations(scanId: string, checkRunId: string): Promise<void> {
    try {
      await this.prCommentsService.updateCheckRunWithAnnotations(scanId, checkRunId);
      this.logger.log(`Updated check run ${checkRunId} with annotations`);
    } catch (error) {
      // Log but don't fail the scan if annotations fail
      this.logger.error(`Check run annotations failed: ${error}`);
    }
  }

  /**
   * Upload SARIF to GitHub Security tab if enabled in scan's write-back config
   */
  private async uploadSarifIfEnabled(scanId: string): Promise<void> {
    try {
      // Check if SARIF upload is enabled for this scan
      const scan = await this.prisma.scan.findUnique({
        where: { id: scanId },
        select: { cliWriteBackConfig: true, repositoryId: true },
      });

      if (!scan) return;

      // Check CLI write-back config first
      const cliEnabled = scan.cliWriteBackConfig?.includes('sarif_upload');

      // If not CLI-triggered, check repository scan config
      let repoEnabled = false;
      if (!cliEnabled) {
        const scanConfig = await this.prisma.scanConfig.findUnique({
          where: { repositoryId: scan.repositoryId },
          select: { sarifUploadEnabled: true },
        });
        repoEnabled = scanConfig?.sarifUploadEnabled ?? false;
      }

      if (!cliEnabled && !repoEnabled) {
        this.logger.debug(`SARIF upload not enabled for scan ${scanId}`);
        return;
      }

      // Generate SARIF and upload
      this.logger.log(`Uploading SARIF to GitHub Security tab for scan ${scanId}`);
      const sarifContent = await this.sarifUploadService.generateSarifFromScan(scanId);
      const result = await this.sarifUploadService.uploadSarif(scanId, sarifContent);

      if (result.success) {
        this.logger.log(`SARIF uploaded successfully: ${result.url}`);
      } else {
        this.logger.warn(`SARIF upload failed: ${result.error}`);
      }
    } catch (error) {
      // Log but don't fail the scan if SARIF upload fails
      this.logger.error(`SARIF upload failed: ${error}`);
    }
  }

  /**
   * Apply diff filter to only include findings in changed lines
   * Supports both PR scans (diff against base) and branch scans (diff against default branch)
   */
  private async applyDiffFilter(
    data: ScanJobData,
    findings: NormalizedFinding[],
  ): Promise<NormalizedFinding[]> {
    try {
      // Get SCM connection
      const connection = await this.prisma.scmConnection.findUnique({
        where: { id: data.connectionId },
      });

      if (!connection) {
        this.logger.warn('Connection not found for diff filter, skipping');
        return findings;
      }

      const accessToken = this.cryptoService.decrypt(connection.accessToken);
      const [owner, repo] = data.fullName.split('/');

      let diffText: string;

      if (data.pullRequestId) {
        // PR scan: Get PR diff
        this.logger.log(`Applying diff filter for PR #${data.pullRequestId}`);
        diffText = await this.githubProvider.getPullRequestDiff(
          accessToken,
          owner,
          repo,
          data.pullRequestId,
        );
      } else {
        // Branch scan: Get diff against default branch
        const repository = await this.prisma.repository.findUnique({
          where: { id: data.repositoryId },
          select: { defaultBranch: true },
        });

        const defaultBranch = repository?.defaultBranch || 'main';

        // Skip if scanning the default branch itself
        if (data.branch === defaultBranch) {
          this.logger.log(`Scanning default branch ${defaultBranch}, diff filter not applicable`);
          return findings;
        }

        this.logger.log(`Applying diff filter: ${defaultBranch}...${data.branch}`);
        diffText = await this.githubProvider.getBranchDiff(
          accessToken,
          owner,
          repo,
          defaultBranch,
          data.branch,
        );
      }

      if (!diffText) {
        this.logger.warn('No diff found, skipping filter');
        return findings;
      }

      // Parse the diff
      const diffData = this.diffFilterService.parseDiff(diffText);

      // Cache the diff for later use (e.g., for PR comments)
      if (data.pullRequestId) {
        await this.diffFilterService.cacheDiff(
          data.scanId,
          data.pullRequestId,
          diffData,
        );
      }

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

  /**
   * Get the effective triage mode for a scan based on repo and branch settings
   * Priority: Branch override > Repo setting > Global default
   */
  private async getEffectiveTriageMode(
    repositoryId: string,
    branch: string,
  ): Promise<TriageMode> {
    try {
      const scanConfig = await this.prisma.scanConfig.findUnique({
        where: { repositoryId },
        select: {
          triageMode: true,
          branchOverrides: true,
        },
      });

      if (!scanConfig) {
        return this.defaultTriageMode;
      }

      // Check for branch-specific override
      const branchOverrides = scanConfig.branchOverrides as Record<string, { triageMode?: string }> | null;
      if (branchOverrides && branchOverrides[branch]?.triageMode) {
        const mode = branchOverrides[branch].triageMode as TriageMode;
        this.logger.log(`Using branch override triage mode: ${mode} for branch ${branch}`);
        return mode;
      }

      // Use repo-level setting
      const repoMode = (scanConfig.triageMode || this.defaultTriageMode) as TriageMode;
      return repoMode;
    } catch (error) {
      this.logger.warn(`Failed to get triage mode, using default: ${error}`);
      return this.defaultTriageMode;
    }
  }

  /**
   * Run full-file triage with access to the cloned repository
   * Batches findings by file for efficient AI calls
   */
  private async runFullFileTriage(
    scanId: string,
    repositoryId: string,
    data: ScanJobData,
    workDir: string,
  ): Promise<void> {
    const triageStartTime = Date.now();

    try {
      // Check if AI is available
      const isAvailable = await this.aiService.isAvailable();
      if (!isAvailable) {
        this.logger.warn('AI triage not available - skipping full-file triage');
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
          aiTriagedAt: null,
        },
        take: this.aiTriageBatchSize,
        orderBy: [
          { severity: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      if (findings.length === 0) {
        this.logger.log('No high/critical findings to auto-triage');
        return;
      }

      this.logger.log(`Full-file triaging ${findings.length} high/critical findings...`);

      // Group findings by file for batched processing
      const findingsByFile = new Map<string, typeof findings>();
      for (const finding of findings) {
        const filePath = finding.filePath;
        if (!findingsByFile.has(filePath)) {
          findingsByFile.set(filePath, []);
        }
        findingsByFile.get(filePath)!.push(finding);
      }

      this.logger.log(`Grouped findings into ${findingsByFile.size} files for batched triage`);

      let triaged = 0;
      let fixesGenerated = 0;

      // Process each file's findings together
      for (const [filePath, fileFindings] of findingsByFile) {
        try {
          // Read the full file content
          const fullFilePath = `${workDir}/${filePath}`;
          let fileContent: string;

          try {
            const fs = await import('fs/promises');
            fileContent = await fs.readFile(fullFilePath, 'utf-8');
          } catch (readError) {
            this.logger.warn(`Could not read file ${filePath}: ${readError}`);
            // Fall back to snippet-only for this file
            fileContent = '';
          }

          // Build triage requests for all findings in this file
          const requests: TriageRequest[] = fileFindings.map((f) => ({
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
            fileContent: fileContent || undefined, // Include full file content
          }));

          // Run batch triage for this file
          const results = await this.aiService.batchTriageFindings(requests);

          // Update findings with AI triage results and generate code fixes
          for (const finding of fileFindings) {
            const result = results.get(finding.id);
            if (result) {
              // Update triage data
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

              // Generate actual code fix with full file context
              if (!result.isLikelyFalsePositive && fileContent) {
                try {
                  const fixResult = await this.aiService.generateAutoFix({
                    finding: {
                      ruleId: finding.ruleId,
                      title: finding.title,
                      description: finding.description || '',
                      severity: finding.severity,
                      filePath: finding.filePath,
                      startLine: finding.startLine || 1,
                      endLine: finding.endLine || undefined,
                      snippet: finding.snippet || '',
                      cweId: finding.cweId || undefined,
                    },
                    fileContent, // Full file content for better fixes
                  });

                  if (fixResult && fixResult.fixedCode) {
                    await this.prisma.finding.update({
                      where: { id: finding.id },
                      data: {
                        autoFix: fixResult.fixedCode,
                        aiRemediation: fixResult.explanation,
                        aiConfidence: fixResult.confidence,
                      },
                    });
                    fixesGenerated++;
                  }
                } catch (fixError) {
                  this.logger.warn(`Failed to generate fix for finding ${finding.id}: ${fixError}`);
                }
              }
            }
          }
        } catch (fileError) {
          this.logger.warn(`Failed to process file ${filePath}: ${fileError}`);
        }
      }

      // Update scan with triage stats
      const triageDuration = Date.now() - triageStartTime;
      await this.prisma.scan.update({
        where: { id: scanId },
        data: {
          triageStartedAt: new Date(triageStartTime),
          triageCompletedAt: new Date(),
          findingsTriaged: triaged,
          fixesGenerated,
        },
      });

      this.logger.log(
        `Full-file triage completed: ${triaged} findings triaged, ${fixesGenerated} fixes generated in ${Math.round(triageDuration / 1000)}s`,
      );
    } catch (error) {
      this.logger.error(`Full-file triage failed: ${error}`);
    }
  }

  /**
   * Process a deep analysis scan
   * Runs advanced AI analysis on existing findings without re-scanning
   */
  private async processDeepAnalysis(job: Job<ScanJobData>): Promise<void> {
    const { scanId, repositoryId, fullName, deepAnalysisOptions } = job.data;
    const startTime = Date.now();

    this.logger.log(`Processing deep analysis scan ${scanId} for ${fullName}`);
    this.logger.log(`Deep analysis options: ${JSON.stringify(deepAnalysisOptions)}`);

    let workDir: string | undefined;

    try {
      await this.updateScanStatus(scanId, 'analyzing');
      await job.updateProgress(10);

      // Check if AI is available
      const isAvailable = await this.aiService.isAvailable();
      if (!isAvailable) {
        throw new Error('AI service not available for deep analysis');
      }

      // Get repository info
      const repository = await this.prisma.repository.findUnique({
        where: { id: repositoryId },
        include: { connection: true },
      });

      if (!repository) {
        throw new Error('Repository not found');
      }

      // Clone repository for full file access
      await this.updateScanStatus(scanId, 'cloning');
      await job.updateProgress(20);

      workDir = await this.cloneRepository(job.data);
      await job.updateProgress(40);

      // Get existing findings to analyze (from most recent standard scan)
      const latestStandardScan = await this.prisma.scan.findFirst({
        where: {
          repositoryId,
          scanType: 'standard',
          status: 'completed',
          branch: job.data.branch,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (!latestStandardScan) {
        throw new Error('No completed standard scan found for this branch. Run a standard scan first.');
      }

      // Get all findings from the latest scan
      const findings = await this.prisma.finding.findMany({
        where: {
          scanId: latestStandardScan.id,
          severity: { in: ['critical', 'high', 'medium'] },
        },
        orderBy: [
          { severity: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      if (findings.length === 0) {
        this.logger.log('No findings to analyze');
        await this.completeScan(scanId, 0, Date.now() - startTime);
        return;
      }

      this.logger.log(`Deep analyzing ${findings.length} findings with options: ${JSON.stringify(deepAnalysisOptions)}`);
      await this.updateScanStatus(scanId, 'triaging');
      await job.updateProgress(50);

      const options = deepAnalysisOptions || {};
      const analysisResults: DeepAnalysisResult[] = [];

      // Run selected deep analysis features
      if (options.similarVulns) {
        await this.runSimilarVulnDetection(findings, workDir, analysisResults);
      }
      await job.updateProgress(60);

      if (options.callChain) {
        await this.runCallChainAnalysis(findings, workDir, analysisResults);
      }
      await job.updateProgress(70);

      if (options.fixPropagation) {
        await this.runFixPropagation(findings, workDir, analysisResults);
      }
      await job.updateProgress(75);

      if (options.secureAlternatives) {
        await this.runSecureAlternatives(findings, workDir, analysisResults);
      }
      await job.updateProgress(80);

      if (options.securityTests) {
        await this.runSecurityTestGeneration(findings, workDir, analysisResults);
      }
      await job.updateProgress(85);

      if (options.architecture) {
        await this.runArchitectureRecommendations(findings, workDir, analysisResults);
      }
      await job.updateProgress(90);

      if (options.attackChain) {
        await this.runAttackChainMapping(findings, workDir, analysisResults);
      }
      await job.updateProgress(95);

      // Store deep analysis results
      await this.storeDeepAnalysisResults(scanId, analysisResults);

      // Complete scan
      await this.completeScan(scanId, analysisResults.length, Date.now() - startTime);
      await job.updateProgress(100);

      this.logger.log(`Deep analysis scan ${scanId} completed: ${analysisResults.length} analysis results`);

    } catch (error) {
      this.logger.error(`Deep analysis scan ${scanId} failed: ${error}`);
      await this.failScan(scanId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    } finally {
      if (workDir) {
        await this.gitService.cleanup(workDir);
      }
    }
  }

  /**
   * Similar vulnerability detection - finds similar patterns across codebase
   */
  private async runSimilarVulnDetection(
    findings: any[],
    _workDir: string,
    results: DeepAnalysisResult[],
  ): Promise<void> {
    this.logger.log('Running similar vulnerability detection...');

    for (const finding of findings.slice(0, 10)) { // Limit to top 10 for performance
      try {
        const prompt = `Analyze this security vulnerability and identify similar patterns in the codebase that might have the same issue:

Vulnerability: ${finding.title}
Rule: ${finding.ruleId}
File: ${finding.filePath}
Code snippet:
\`\`\`
${finding.snippet || 'N/A'}
\`\`\`
CWE: ${finding.cweId || 'N/A'}

Look for:
1. Same function/method being used unsafely elsewhere
2. Similar coding patterns that could have the same vulnerability
3. Copy-pasted code that shares the vulnerability

Respond in JSON format:
{
  "similarPatterns": [
    {
      "pattern": "description of the pattern",
      "searchQuery": "regex or grep query to find similar code",
      "risk": "why this pattern is risky"
    }
  ],
  "recommendedSearch": "command to search for similar issues"
}`;

        const response = await this.aiService.analyzeWithPrompt(prompt);

        results.push({
          findingId: finding.id,
          analysisType: 'similar_vulns',
          result: response,
        });
      } catch (error) {
        this.logger.warn(`Similar vuln detection failed for ${finding.id}: ${error}`);
      }
    }
  }

  /**
   * Call chain analysis - determines if vulnerability is publicly accessible
   */
  private async runCallChainAnalysis(
    findings: any[],
    workDir: string,
    results: DeepAnalysisResult[],
  ): Promise<void> {
    this.logger.log('Running call chain analysis...');

    for (const finding of findings.slice(0, 10)) {
      try {
        // Read the file containing the vulnerability
        const fs = await import('fs/promises');
        let fileContent = '';
        try {
          fileContent = await fs.readFile(`${workDir}/${finding.filePath}`, 'utf-8');
        } catch {
          continue;
        }

        const prompt = `Analyze the call chain for this security vulnerability to determine its exposure:

Vulnerability: ${finding.title}
Rule: ${finding.ruleId}
File: ${finding.filePath}:${finding.startLine}

File content:
\`\`\`
${fileContent.substring(0, 8000)}
\`\`\`

Analyze:
1. Is this function/method called from public endpoints (API routes, controllers)?
2. What is the call chain from entry points to this vulnerability?
3. Can an unauthenticated user trigger this vulnerability?
4. What data flows into the vulnerable code?

Respond in JSON format:
{
  "exposure": "public|authenticated|internal|unknown",
  "callChain": ["entry point", "...", "vulnerable function"],
  "entryPoints": ["list of public entry points that reach this code"],
  "dataFlow": "description of how user data reaches the vulnerability",
  "exploitability": "high|medium|low",
  "justification": "explanation of the exposure assessment"
}`;

        const response = await this.aiService.analyzeWithPrompt(prompt);

        results.push({
          findingId: finding.id,
          analysisType: 'call_chain',
          result: response,
        });
      } catch (error) {
        this.logger.warn(`Call chain analysis failed for ${finding.id}: ${error}`);
      }
    }
  }

  /**
   * Fix propagation - applies fix to all similar occurrences
   */
  private async runFixPropagation(
    findings: any[],
    _workDir: string,
    results: DeepAnalysisResult[],
  ): Promise<void> {
    this.logger.log('Running fix propagation analysis...');

    // Group findings by rule to find patterns
    const byRule = new Map<string, any[]>();
    for (const finding of findings) {
      const rule = finding.ruleId;
      if (!byRule.has(rule)) {
        byRule.set(rule, []);
      }
      byRule.get(rule)!.push(finding);
    }

    for (const [ruleId, ruleFindings] of byRule) {
      if (ruleFindings.length < 2) continue;

      try {
        const snippets = ruleFindings.slice(0, 5).map(f => ({
          file: f.filePath,
          line: f.startLine,
          code: f.snippet || 'N/A',
        }));

        const prompt = `These findings share the same vulnerability rule. Analyze them to create a unified fix strategy:

Rule: ${ruleId}
Vulnerability: ${ruleFindings[0].title}

Occurrences:
${snippets.map((s, i) => `${i + 1}. ${s.file}:${s.line}\n\`\`\`\n${s.code}\n\`\`\``).join('\n\n')}

Provide:
1. A generalized fix pattern that works for all occurrences
2. Any helper functions or utilities that could centralize the fix
3. Step-by-step instructions to apply the fix everywhere

Respond in JSON format:
{
  "commonPattern": "what these all have in common",
  "generalizedFix": "code template for fixing all instances",
  "helperFunction": "optional helper code to create",
  "instructions": ["step 1", "step 2", ...],
  "estimatedChanges": number
}`;

        const response = await this.aiService.analyzeWithPrompt(prompt);

        results.push({
          findingId: ruleFindings[0].id,
          analysisType: 'fix_propagation',
          result: response,
          metadata: { affectedFindings: ruleFindings.map(f => f.id) },
        });
      } catch (error) {
        this.logger.warn(`Fix propagation failed for ${ruleId}: ${error}`);
      }
    }
  }

  /**
   * Secure alternatives - suggests secure libraries/patterns
   */
  private async runSecureAlternatives(
    findings: any[],
    workDir: string,
    results: DeepAnalysisResult[],
  ): Promise<void> {
    this.logger.log('Running secure alternatives analysis...');

    // Read package.json for dependency context
    const fs = await import('fs/promises');
    let packageJson = '';
    try {
      packageJson = await fs.readFile(`${workDir}/package.json`, 'utf-8');
    } catch {
      // Not a Node.js project
    }

    for (const finding of findings.slice(0, 10)) {
      try {
        const prompt = `Suggest secure alternatives for this vulnerability:

Vulnerability: ${finding.title}
Rule: ${finding.ruleId}
CWE: ${finding.cweId || 'N/A'}
Code:
\`\`\`
${finding.snippet || 'N/A'}
\`\`\`

${packageJson ? `Current dependencies:\n${packageJson.substring(0, 2000)}` : ''}

Provide:
1. Secure library alternatives (with import/installation commands)
2. Secure coding patterns to replace the vulnerable code
3. Configuration changes if applicable

Respond in JSON format:
{
  "secureLibraries": [
    {
      "name": "library name",
      "installation": "npm install / pip install command",
      "usage": "code example",
      "whySecure": "explanation"
    }
  ],
  "securePatterns": [
    {
      "pattern": "description",
      "code": "secure code example",
      "explanation": "why this is secure"
    }
  ],
  "configChanges": ["config change 1", "config change 2"]
}`;

        const response = await this.aiService.analyzeWithPrompt(prompt);

        results.push({
          findingId: finding.id,
          analysisType: 'secure_alternatives',
          result: response,
        });
      } catch (error) {
        this.logger.warn(`Secure alternatives failed for ${finding.id}: ${error}`);
      }
    }
  }

  /**
   * Security test generation - creates test cases for vulnerabilities
   */
  private async runSecurityTestGeneration(
    findings: any[],
    _workDir: string,
    results: DeepAnalysisResult[],
  ): Promise<void> {
    this.logger.log('Running security test generation...');

    for (const finding of findings.slice(0, 10)) {
      try {
        const prompt = `Generate security test cases for this vulnerability:

Vulnerability: ${finding.title}
Rule: ${finding.ruleId}
CWE: ${finding.cweId || 'N/A'}
File: ${finding.filePath}
Code:
\`\`\`
${finding.snippet || 'N/A'}
\`\`\`

Generate:
1. Unit tests that would catch this vulnerability
2. Integration test cases
3. Negative test cases (attack payloads)

Respond in JSON format:
{
  "unitTests": [
    {
      "name": "test name",
      "code": "test code",
      "description": "what it tests"
    }
  ],
  "integrationTests": [
    {
      "name": "test name",
      "steps": ["step 1", "step 2"],
      "expectedResult": "expected outcome"
    }
  ],
  "attackPayloads": [
    {
      "payload": "attack string/data",
      "vulnerability": "what it exploits",
      "expectedBehavior": "what secure code should do"
    }
  ]
}`;

        const response = await this.aiService.analyzeWithPrompt(prompt);

        results.push({
          findingId: finding.id,
          analysisType: 'security_tests',
          result: response,
        });
      } catch (error) {
        this.logger.warn(`Security test generation failed for ${finding.id}: ${error}`);
      }
    }
  }

  /**
   * Architecture recommendations - suggests design improvements
   */
  private async runArchitectureRecommendations(
    findings: any[],
    _workDir: string,
    results: DeepAnalysisResult[],
  ): Promise<void> {
    this.logger.log('Running architecture recommendations...');

    // Group findings by severity and type for holistic analysis
    const criticalAndHigh = findings.filter(f =>
      f.severity === 'critical' || f.severity === 'high'
    );

    if (criticalAndHigh.length === 0) return;

    try {
      const findingSummary = criticalAndHigh.slice(0, 20).map(f => ({
        title: f.title,
        rule: f.ruleId,
        cwe: f.cweId,
        file: f.filePath,
      }));

      const prompt = `Based on these security findings, provide architecture recommendations:

Findings Summary:
${JSON.stringify(findingSummary, null, 2)}

Analyze:
1. Common security patterns that are missing
2. Architectural changes that would prevent these vulnerability classes
3. Security controls that should be added
4. Defense-in-depth recommendations

Respond in JSON format:
{
  "patterns": [
    {
      "pattern": "pattern name",
      "description": "what it does",
      "implementation": "how to implement",
      "addressedVulnerabilities": ["CWE-XX", ...]
    }
  ],
  "architectureChanges": [
    {
      "change": "change description",
      "rationale": "why this helps",
      "effort": "low|medium|high",
      "impact": "description of security improvement"
    }
  ],
  "securityControls": [
    {
      "control": "control name",
      "type": "preventive|detective|corrective",
      "implementation": "how to add"
    }
  ],
  "priorityOrder": ["first change", "second change", ...]
}`;

      const response = await this.aiService.analyzeWithPrompt(prompt);

      results.push({
        findingId: 'architecture', // Not tied to specific finding
        analysisType: 'architecture',
        result: response,
        metadata: { analyzedFindings: criticalAndHigh.map(f => f.id) },
      });
    } catch (error) {
      this.logger.warn(`Architecture recommendations failed: ${error}`);
    }
  }

  /**
   * Attack chain mapping - correlates findings into attack paths
   */
  private async runAttackChainMapping(
    findings: any[],
    _workDir: string,
    results: DeepAnalysisResult[],
  ): Promise<void> {
    this.logger.log('Running attack chain mapping...');

    try {
      const findingSummary = findings.slice(0, 30).map(f => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        cwe: f.cweId,
        file: f.filePath,
        line: f.startLine,
      }));

      const prompt = `Analyze these security findings to identify potential attack chains:

Findings:
${JSON.stringify(findingSummary, null, 2)}

Identify:
1. How findings could be chained together for attacks
2. Attack scenarios that combine multiple vulnerabilities
3. Critical paths an attacker might take
4. Kill chain stages these vulnerabilities enable

Respond in JSON format:
{
  "attackChains": [
    {
      "name": "attack chain name",
      "description": "what the attack achieves",
      "steps": [
        {
          "step": 1,
          "findingId": "finding id used",
          "action": "what attacker does",
          "outcome": "what they gain"
        }
      ],
      "impact": "final impact",
      "likelihood": "high|medium|low"
    }
  ],
  "killChainMapping": {
    "reconnaissance": ["finding ids"],
    "weaponization": ["finding ids"],
    "delivery": ["finding ids"],
    "exploitation": ["finding ids"],
    "installation": ["finding ids"],
    "command_control": ["finding ids"],
    "actions_on_objectives": ["finding ids"]
  },
  "criticalPaths": [
    {
      "path": "entry -> step -> step -> impact",
      "risk": "high|medium|low",
      "mitigationPriority": 1
    }
  ]
}`;

      const response = await this.aiService.analyzeWithPrompt(prompt);

      results.push({
        findingId: 'attack_chain',
        analysisType: 'attack_chain',
        result: response,
        metadata: { analyzedFindings: findings.map(f => f.id) },
      });
    } catch (error) {
      this.logger.warn(`Attack chain mapping failed: ${error}`);
    }
  }

  /**
   * Store deep analysis results
   */
  private async storeDeepAnalysisResults(
    scanId: string,
    results: DeepAnalysisResult[],
  ): Promise<void> {
    // Store results in scan's deepAnalysisResults field
    await this.prisma.scan.update({
      where: { id: scanId },
      data: {
        deepAnalysisOptions: JSON.parse(JSON.stringify({
          results,
          completedAt: new Date().toISOString(),
          resultCount: results.length,
        })),
      },
    });

    // Also update individual findings with their analysis
    for (const result of results) {
      if (result.findingId && !['architecture', 'attack_chain'].includes(result.findingId)) {
        try {
          await this.prisma.finding.update({
            where: { id: result.findingId },
            data: {
              aiAnalysis: JSON.stringify({
                ...JSON.parse((await this.prisma.finding.findUnique({
                  where: { id: result.findingId },
                  select: { aiAnalysis: true }
                }))?.aiAnalysis || '{}'),
                [result.analysisType]: result.result,
              }),
            },
          });
        } catch (error) {
          this.logger.warn(`Failed to update finding ${result.findingId} with analysis: ${error}`);
        }
      }
    }
  }
}

interface DeepAnalysisResult {
  findingId: string;
  analysisType: string;
  result: any;
  metadata?: Record<string, any>;
}
