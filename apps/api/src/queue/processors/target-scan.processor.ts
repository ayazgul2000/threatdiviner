import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { createClient, RedisClientType } from 'redis';
import { PrismaService } from '../../prisma/prisma.service';
import { ScanGateway } from '../../scans/scan.gateway';
// Note: Nuclei is currently disabled - keeping import for potential future use
// import { NucleiScanner } from '../../scanners/dast/nuclei';
import { NiktoScanner } from '../../scanners/pentest/nikto';
import { SqlmapScanner } from '../../scanners/pentest/sqlmap';
import { SSLyzeScanner } from '../../scanners/pentest/sslyze';
import { ZapScanner } from '../../scanners/dast/zap';
import { KatanaScanner } from '../../scanners/discovery/katana';
import { LocalExecutorService } from '../../scanners/execution';
import { DiscoveredParam } from '../../scanners/interfaces';
import { QUEUE_NAMES, REDIS_PUBSUB } from '../queue.constants';
import { TargetScanJobData, FindingsCount } from '../jobs';
import { BULL_CONNECTION } from '../custom-bull.module';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

type ScanStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

interface ScannerInstance {
  name: string;
  scanner: any;
  category: 'discovery' | 'dast' | 'pentest';
  label: string;  // Whitelabel display name
}

type ScanMode = 'quick' | 'standard' | 'comprehensive';

interface ScannerForMode {
  name: string;
  label: string;
  config?: Record<string, unknown>;
}

@Injectable()
export class TargetScanProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TargetScanProcessor.name);
  private worker: Worker | null = null;
  private readonly scanners: Map<string, ScannerInstance>;

  // Redis subscriber for cancellation signals
  private redisSubscriber: RedisClientType | null = null;
  // Track active scans for cancellation handling
  private readonly activeScans = new Map<string, { cancelled: boolean; workDir?: string }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly executor: LocalExecutorService,
    private readonly scanGateway: ScanGateway,
    @Inject(BULL_CONNECTION) private readonly connection: { host: string; port: number },
  ) {
    // Initialize all scanners with whitelabel display names
    // Note: Nuclei is currently disabled
    this.scanners = new Map();

    const katana = new KatanaScanner(this.executor, this.configService);
    const nikto = new NiktoScanner(this.executor, this.configService);
    const sqlmap = new SqlmapScanner(this.executor, this.configService);
    const sslyze = new SSLyzeScanner(this.executor, this.configService);
    const zap = new ZapScanner(this.executor, this.configService);

    // Discovery scanners
    this.scanners.set('katana', { name: 'katana', scanner: katana, category: 'discovery', label: 'URL Discovery' });

    // DAST scanners (Nuclei disabled - using ZAP for vulnerability scanning)
    this.scanners.set('zap', { name: 'zap', scanner: zap, category: 'dast', label: 'Web Application Testing' });

    // Pentest scanners
    this.scanners.set('nikto', { name: 'nikto', scanner: nikto, category: 'pentest', label: 'Web Server Analysis' });
    this.scanners.set('sqlmap', { name: 'sqlmap', scanner: sqlmap, category: 'pentest', label: 'SQL Injection Testing' });
    this.scanners.set('sslyze', { name: 'sslyze', scanner: sslyze, category: 'pentest', label: 'SSL/TLS Analysis' });
  }

  async onModuleInit() {
    try {
      this.logger.log(`Connecting to Redis at ${this.connection.host}:${this.connection.port}...`);

      // Set up Redis subscriber for cancellation signals
      await this.setupCancellationSubscriber();

      this.worker = new Worker(
        QUEUE_NAMES.TARGET_SCAN,
        async (job: Job<TargetScanJobData>) => this.process(job),
        {
          connection: this.connection,
          concurrency: 2,
        },
      );

      this.worker.on('completed', (job) => {
        this.logger.log(`Target scan job ${job.id} completed successfully`);
      });

      this.worker.on('failed', (job, err) => {
        this.logger.error(`Target scan job ${job?.id} failed: ${err.message}`, err.stack);
      });

      this.worker.on('error', (err) => {
        this.logger.error(`Target scan worker error: ${err.message}`, err.stack);
      });

      this.worker.on('ready', () => {
        this.logger.log('Target scan worker connected to Redis and ready');
      });

      await this.worker.waitUntilReady();
      this.logger.log(`Target scan worker started on queue '${QUEUE_NAMES.TARGET_SCAN}'`);
    } catch (error) {
      this.logger.error(`Failed to start target scan worker: ${error}`);
      this.logger.warn('Target scanning will not work until Redis is available');
    }
  }

  /**
   * Set up Redis Pub/Sub subscriber for instant scan cancellation
   * When API publishes to 'scan-cancellation' channel, we immediately kill the process
   */
  private async setupCancellationSubscriber() {
    try {
      const redisUrl = `redis://${this.connection.host}:${this.connection.port}`;
      this.redisSubscriber = createClient({ url: redisUrl }) as RedisClientType;

      this.redisSubscriber.on('error', (err) => {
        this.logger.error(`Redis subscriber error: ${err}`);
      });

      await this.redisSubscriber.connect();
      this.logger.log(`[REDIS] Cancellation subscriber connected to ${this.connection.host}:${this.connection.port}`);

      // Subscribe to cancellation channel
      await this.redisSubscriber.subscribe(REDIS_PUBSUB.SCAN_CANCELLATION, (scanId) => {
        this.logger.log(`[REDIS] Received message on channel '${REDIS_PUBSUB.SCAN_CANCELLATION}': ${scanId}`);
        this.handleCancellation(scanId);
      });

      this.logger.log(`[REDIS] Subscribed to channel '${REDIS_PUBSUB.SCAN_CANCELLATION}' for instant cancellation`);
    } catch (error) {
      this.logger.warn(`Failed to set up cancellation subscriber: ${error}`);
      // Continue without Pub/Sub - fallback to polling (less responsive)
    }
  }

  /**
   * Handle cancellation signal from Redis Pub/Sub
   * This is called IMMEDIATELY when the API publishes a cancel request
   */
  private handleCancellation(scanId: string) {
    this.logger.log(`[CANCEL] Received cancellation signal for scan ${scanId}`);
    this.logger.log(`[CANCEL] Active scans: ${Array.from(this.activeScans.keys()).join(', ')}`);

    const scanState = this.activeScans.get(scanId);
    if (scanState) {
      this.logger.log(`[CANCEL] Found scan ${scanId} in activeScans - killing process immediately`);

      // Mark as cancelled
      scanState.cancelled = true;

      // Kill the running process (this kills the entire process group)
      const killed = this.executor.killProcess(scanId);
      this.logger.log(`[CANCEL] Process kill for ${scanId}: ${killed}`);

      // Cleanup work directory
      if (scanState.workDir) {
        fs.rm(scanState.workDir, { recursive: true, force: true }).catch(() => {});
      }

      // Emit cancelled status to UI
      this.scanGateway.emitScanComplete(scanId, {
        totalFindings: 0,
        severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        duration: 0,
        status: 'cancelled',
      });
    } else {
      this.logger.debug(`Cancellation signal for ${scanId} but scan not active on this worker`);
    }
  }

  async onModuleDestroy() {
    // Close Redis subscriber
    if (this.redisSubscriber) {
      try {
        await this.redisSubscriber.unsubscribe(REDIS_PUBSUB.SCAN_CANCELLATION);
        await this.redisSubscriber.quit();
        this.logger.log('Redis cancellation subscriber closed');
      } catch (error) {
        this.logger.warn(`Error closing Redis subscriber: ${error}`);
      }
    }

    if (this.worker) {
      await this.worker.close();
      this.logger.log('Target scan worker stopped');
    }
  }

  /**
   * Check if scan was cancelled (via Redis Pub/Sub signal)
   */
  private isCancelled(scanId: string): boolean {
    return this.activeScans.get(scanId)?.cancelled ?? false;
  }

  async process(job: Job<TargetScanJobData>): Promise<void> {
    const { scanId, tenantId, targetId, targetUrl, targetName, scanMode = 'standard', config } = job.data;
    const startTime = Date.now();

    this.logger.log(`Processing ${scanMode} target scan ${scanId} for ${targetName} (${targetUrl})`);

    // Create work directory
    const workDir = path.join(os.tmpdir(), `target-scan-${scanId}`);

    // Register this scan as active for cancellation handling
    this.activeScans.set(scanId, { cancelled: false, workDir });

    try {
      // PHASE: Initializing
      await this.updateScanStatus(scanId, 'running');
      await this.prisma.penTestScan.update({
        where: { id: scanId },
        data: { scanPhase: 'initializing' },
      });
      this.scanGateway.emitScanPhase(scanId, { phase: 'initializing', percent: 0 });
      await job.updateProgress(5);

      await fs.mkdir(workDir, { recursive: true });
      
      this.scanGateway.emitScanPhase(scanId, { phase: 'initializing', percent: 100 });

      // PHASE: Crawling
      await this.prisma.penTestScan.update({
        where: { id: scanId },
        data: { scanPhase: 'crawling' },
      });
      this.scanGateway.emitScanPhase(scanId, { phase: 'crawling', percent: 0 });

      // Results tracking
      const allFindings: any[] = [];
      const severityCounts: FindingsCount = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      const storedFingerprints: Set<string> = new Set(); // Track already-stored findings to avoid duplicates
      const detectedTechnologies: Set<string> = new Set(); // Track technologies for real-time emission

      // Technology detection patterns
      const techPatterns = [
        /apache/i, /nginx/i, /wordpress/i, /tomcat/i, /iis/i,
        /php/i, /nodejs?/i, /express/i, /spring/i, /joomla/i, /drupal/i,
        /jenkins/i, /gitlab/i, /grafana/i, /kubernetes/i, /docker/i,
        /mysql/i, /postgres/i, /redis/i, /mongodb/i, /swagger/i,
        /angular/i, /react/i, /vue/i, /jquery/i, /bootstrap/i,
      ];

      // Progress callback factory
      const createProgressCallback = (scannerName: string) => (progress: { scanner: string; phase?: string; current?: number; total?: number; percent: number; templateStats?: { loaded: number; completed: number; matched: number; errors: number } }) => {
        this.scanGateway.emitScannerProgress(scanId, { ...progress, scanner: scannerName });
      };

      // PHASE 1: Discovery - Run Katana (and ZAP spider for comprehensive)
      this.logger.log(`Starting discovery phase for ${scanMode} mode`);

      let discoveredUrls: string[] = [];
      let discoveredParams: DiscoveredParam[] = [];

      try {
        const discoveryResult = await this.runDiscoveryPhase(
          scanMode as ScanMode,
          targetUrl,
          workDir,
          scanId,
          config,
          createProgressCallback('katana'),
        );
        discoveredUrls = discoveryResult.discoveredUrls;
        discoveredParams = discoveryResult.discoveredParams;

        // Update scan with crawled URL count
        await this.prisma.penTestScan.update({
          where: { id: scanId },
          data: { crawledUrls: discoveredUrls.length },
        });

        // Emit crawling complete with discovered URLs
        this.scanGateway.emitScanPhase(scanId, { phase: 'crawling', percent: 100 });
        this.scanGateway.emitScanUrls(scanId, {
          urls: discoveredUrls,
          total: discoveredUrls.length,
          jsFiles: discoveryResult.jsFiles || [],
          paramsCount: discoveredParams.length,
        });

        this.logger.log(`Discovery phase complete: ${discoveredUrls.length} URLs discovered`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Discovery phase failed: ${errorMessage}, continuing with base URL only`);
        // Emit empty URLs on failure
        this.scanGateway.emitScanPhase(scanId, { phase: 'crawling', percent: 100 });
        this.scanGateway.emitScanUrls(scanId, { urls: [targetUrl], total: 1 });
      }

      await job.updateProgress(20);

      // Crawling complete - move to scanning
      this.scanGateway.emitScanPhase(scanId, { phase: 'crawling', percent: 100 });

      // Check if scan was cancelled (event-driven via Redis Pub/Sub)
      if (this.isCancelled(scanId)) {
        this.logger.log(`Scan ${scanId} was cancelled after discovery phase`);
        return; // Cancellation handler already emitted scan:complete
      }

      // PHASE: Scanning - Run mode-specific scanners
      await this.prisma.penTestScan.update({
        where: { id: scanId },
        data: { scanPhase: 'scanning' },
      });
      this.scanGateway.emitScanPhase(scanId, { phase: 'scanning', percent: 0 });

      const scannersForMode = this.getScannersForMode(scanMode as ScanMode);
      const progressPerScanner = 70 / scannersForMode.length;

      this.logger.log(`Starting scanning phase with ${scannersForMode.length} scanners: ${scannersForMode.map(s => s.label).join(', ')}`);

      for (let i = 0; i < scannersForMode.length; i++) {
        const scannerConfig = scannersForMode[i];
        const scannerInfo = this.scanners.get(scannerConfig.name);

        if (!scannerInfo) {
          this.logger.warn(`Scanner ${scannerConfig.name} not found, skipping`);
          continue;
        }

        const scannerStartTime = Date.now();

        // Emit scanner start event with whitelabel name
        this.scanGateway.emitScannerStart(scanId, {
          scanner: scannerConfig.name,
          label: scannerConfig.label,
          phase: 'scanning',
        });

        try {
          const isAvailable = await scannerInfo.scanner.isAvailable();
          if (!isAvailable) {
            this.logger.warn(`Scanner ${scannerConfig.name} (${scannerConfig.label}) not available, skipping`);
            this.scanGateway.emitScannerComplete(scanId, {
              scanner: scannerConfig.name,
              label: scannerConfig.label,
              findingsCount: 0,
              duration: 0,
              status: 'skipped',
            });
            continue;
          }

          // Check if scan was cancelled (event-driven via Redis Pub/Sub)
          if (this.isCancelled(scanId)) {
            this.logger.log(`Scan ${scanId} was cancelled, aborting remaining scanners`);
            return; // Cancellation handler already emitted scan:complete
          }

          this.logger.log(`Running ${scannerConfig.label} (${scannerConfig.name}) against ${targetUrl}`);

          // Log callback to emit real-time log lines
          const onLog = (line: string, stream: 'stdout' | 'stderr') => {
            this.scanGateway.emitScannerLog(scanId, {
              scanner: scannerConfig.name,
              line,
              stream,
              timestamp: new Date().toISOString(),
            });
          };

          // Template event callback for tracking individual template status (nuclei)
          const onTemplateEvent = (event: { type: string; templateId?: string; status?: string; error?: string }) => {
            if (event.templateId) {
              this.scanGateway.emitTemplateEvent(scanId, {
                scanner: scannerConfig.name,
                templateId: event.templateId,
                status: event.type === 'template:error' ? 'failed' : event.type === 'template:loaded' ? 'loaded' : 'running',
                errors: event.error ? [event.error] : undefined,
              });
            }
          };

          // Real-time finding callback - store and emit immediately
          const onFinding = async (finding: any) => {
            // Skip if already stored (by fingerprint)
            if (finding.fingerprint && storedFingerprints.has(finding.fingerprint)) {
              return;
            }
            if (finding.fingerprint) {
              storedFingerprints.add(finding.fingerprint);
            }

            try {
              const created = await this.prisma.penTestFinding.create({
                data: {
                  scanId,
                  tenantId,
                  scanner: scannerConfig.name,
                  ruleId: finding.ruleId,
                  severity: finding.severity,
                  confidence: finding.confidence || 'medium',
                  title: finding.title,
                  description: finding.description,
                  url: finding.filePath || targetUrl,
                  parameter: finding.metadata?.parameter,
                  payload: finding.metadata?.payload,
                  evidence: finding.metadata?.evidence,
                  cweIds: finding.cweIds || [],
                  cveIds: finding.cveIds || [],
                  owaspIds: finding.owaspIds || [],
                  references: finding.references || [],
                  remediation: finding.fix?.description,
                  fingerprint: finding.fingerprint,
                  metadata: { ...finding.metadata, scanMode },
                },
              });

              allFindings.push(created);

              // Update severity counts
              const sev = finding.severity.toLowerCase();
              if (sev in severityCounts) {
                severityCounts[sev as keyof FindingsCount]++;
              }

              // Emit finding event for real-time UI updates
              this.scanGateway.emitScannerFinding(scanId, {
                scanner: scannerConfig.name,
                label: scannerConfig.label,
                finding: {
                  id: created.id,
                  severity: created.severity,
                  title: created.title,
                  url: created.url || undefined,
                  cweIds: created.cweIds,
                  cveIds: created.cveIds,
                },
              });

              // Extract and emit technologies in real-time
              const text = `${finding.title || ''} ${finding.description || ''} ${finding.ruleId || ''}`;
              for (const pattern of techPatterns) {
                const match = text.match(pattern);
                if (match) {
                  const tech = match[0].toLowerCase();
                  if (!detectedTechnologies.has(tech)) {
                    detectedTechnologies.add(tech);
                    // Emit technology detection event
                    this.scanGateway.emitTechnology(scanId, tech);
                  }
                }
              }

              // Also check metadata.extracted (nuclei http/technologies output)
              const extracted = finding.metadata?.extracted as string[] | undefined;
              if (extracted && Array.isArray(extracted)) {
                for (const item of extracted) {
                  if (typeof item === 'string' && item.length < 50) {
                    const tech = item.trim().toLowerCase();
                    if (tech && !detectedTechnologies.has(tech)) {
                      detectedTechnologies.add(tech);
                      this.scanGateway.emitTechnology(scanId, tech);
                    }
                  }
                }
              }
            } catch (err) {
              this.logger.warn(`Failed to store real-time finding: ${err}`);
            }
          };

          // Build target URLs for this scanner
          // Use discovered URLs if available, otherwise just base URL
          const targetUrlsForScanner = discoveredUrls.length > 0
            ? [...new Set([targetUrl, ...discoveredUrls])]
            : [targetUrl];

          // Build scan context with mode-specific scanner config
          const scannerTimeout = config.timeout || 300000;
          const context = {
            scanId,
            workDir,
            timeout: scannerTimeout,
            config: {
              targetUrls: targetUrlsForScanner,
              discoveredUrls,
              discoveredParams,
              scanMode,
              detectedTechnologies: job.data.detectedTechnologies || [],
              authType: config.authType,
              authCredentials: config.authCredentials,
              headers: config.headers,
              rateLimitPreset: config.rateLimitPreset || 'medium',
              excludePaths: config.excludePaths,
              onProgress: createProgressCallback(scannerConfig.name),
              onLog,
              onTemplateEvent,
              onFinding,
              // Mode-specific scanner config (e.g., passiveOnly for ZAP)
              ...scannerConfig.config,
            },
          };

          // Run the scan
          const output = await scannerInfo.scanner.scan(context);
          const findings = await scannerInfo.scanner.parseOutput(output);

          // Store findings and emit events (skip already-stored via onFinding)
          for (const finding of findings) {
            // Skip if already stored via real-time callback
            if (finding.fingerprint && storedFingerprints.has(finding.fingerprint)) {
              continue;
            }
            if (finding.fingerprint) {
              storedFingerprints.add(finding.fingerprint);
            }
            
            const created = await this.prisma.penTestFinding.create({
              data: {
                scanId,
                tenantId,
                scanner: scannerConfig.name,
                ruleId: finding.ruleId,
                severity: finding.severity,
                confidence: finding.confidence || 'medium',
                title: finding.title,
                description: finding.description,
                url: finding.filePath || targetUrl,
                parameter: finding.metadata?.parameter,
                payload: finding.metadata?.payload,
                evidence: finding.metadata?.evidence,
                cweIds: finding.cweIds || [],
                cveIds: finding.cveIds || [],
                owaspIds: finding.owaspIds || [],
                references: finding.references || [],
                remediation: finding.fix?.description,
                fingerprint: finding.fingerprint,
                metadata: { ...finding.metadata, scanMode },
              },
            });

            allFindings.push(created);

            // Update severity counts
            const sev = finding.severity.toLowerCase();
            if (sev in severityCounts) {
              severityCounts[sev as keyof FindingsCount]++;
            }

            // Emit finding event for real-time UI updates
            this.scanGateway.emitScannerFinding(scanId, {
              scanner: scannerConfig.name,
              label: scannerConfig.label,
              finding: {
                id: created.id,
                severity: created.severity,
                title: created.title,
                url: created.url || undefined,
                cweIds: created.cweIds,
                cveIds: created.cveIds,
              },
            });
          }

          const scannerDuration = Date.now() - scannerStartTime;

          // Get template stats from output if available (nuclei scanner)
          const templateStats = (output as any).templateStats;
          const failedTemplateIds = templateStats?.templates
            ?.filter((t: any) => t.status === 'failed')
            ?.map((t: any) => t.templateId) || [];

          // Prepare verbose output (truncate to 10KB for WebSocket)
          const MAX_VERBOSE_SIZE = 10 * 1024;
          let verboseOutput = '';
          if (output.stdout) verboseOutput += output.stdout;
          if (output.stderr) verboseOutput += (verboseOutput ? '\n---STDERR---\n' : '') + output.stderr;
          if (verboseOutput.length > MAX_VERBOSE_SIZE) {
            verboseOutput = verboseOutput.substring(0, MAX_VERBOSE_SIZE) + '\n...(truncated)';
          }

          // Emit scanner complete event with execution details
          this.scanGateway.emitScannerComplete(scanId, {
            scanner: scannerConfig.name,
            label: scannerConfig.label,
            findingsCount: findings.length,
            duration: scannerDuration,
            status: 'completed',
            exitCode: output.exitCode,
            verboseOutput: verboseOutput || undefined,
            templateStats: templateStats ? {
              totalTemplates: templateStats.totalTemplates,
              completedTemplates: templateStats.completedTemplates,
              failedTemplates: templateStats.failedTemplates,
              totalErrors: templateStats.totalErrors,
              failedTemplateIds: failedTemplateIds.length > 0 ? failedTemplateIds : undefined,
            } : undefined,
          });

          this.logger.log(`${scannerConfig.label} found ${findings.length} findings in ${scannerDuration}ms`);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.logger.error(`Scanner ${scannerConfig.label} (${scannerConfig.name}) failed: ${errorMessage}`);
          this.scanGateway.emitScannerComplete(scanId, {
            scanner: scannerConfig.name,
            label: scannerConfig.label,
            findingsCount: 0,
            duration: Date.now() - scannerStartTime,
            status: 'failed',
            error: errorMessage,
          });
        }

        // Update job progress
        await job.updateProgress(20 + (i + 1) * progressPerScanner);
      }

      // PHASE: Scanning complete
      this.scanGateway.emitScanPhase(scanId, { phase: 'scanning', percent: 100 });

      // Cleanup work directory
      try {
        await fs.rm(workDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }

      const duration = Math.floor((Date.now() - startTime) / 1000);

      // Calculate risk score
      const riskScore = this.calculateRiskScore(severityCounts);

      // Update scan with results
      await this.prisma.penTestScan.update({
        where: { id: scanId },
        data: {
          status: 'completed',
          scanPhase: 'complete',
          completedAt: new Date(),
          duration,
          findingsCount: allFindings.length,
          criticalCount: severityCounts.critical,
          highCount: severityCounts.high,
          mediumCount: severityCounts.medium,
          lowCount: severityCounts.low,
          infoCount: severityCounts.info,
        },
      });

      // Update target with risk score and last scan info
      await this.prisma.penTestTarget.update({
        where: { id: targetId },
        data: {
          riskScore,
          lastScanId: scanId,
          lastScanAt: new Date(),
        },
      });

      // PHASE: Complete
      this.scanGateway.emitScanPhase(scanId, { phase: 'complete', percent: 100 });

      // Emit scan complete event
      this.scanGateway.emitScanComplete(scanId, {
        totalFindings: allFindings.length,
        severityBreakdown: severityCounts,
        duration: duration * 1000,
        status: 'completed',
        crawledUrls: discoveredUrls.length,
      });

      await job.updateProgress(100);
      this.logger.log(`${scanMode} scan ${scanId} completed: ${allFindings.length} findings, ${discoveredUrls.length} URLs crawled, risk score: ${riskScore}`);

    } catch (error) {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.prisma.penTestScan.update({
        where: { id: scanId },
        data: {
          status: 'failed',
          scanPhase: 'complete',
          completedAt: new Date(),
          duration,
          errorMessage,
        },
      });

      this.scanGateway.emitScanComplete(scanId, {
        totalFindings: 0,
        severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        duration: duration * 1000,
        status: 'failed',
      });

      this.logger.error(`Target scan ${scanId} failed: ${error}`);
      throw error;
    } finally {
      // Clean up active scan tracking
      this.activeScans.delete(scanId);
    }
  }

  private async updateScanStatus(scanId: string, status: ScanStatus): Promise<void> {
    // Check if scan was cancelled - don't overwrite cancelled status
    const currentScan = await this.prisma.penTestScan.findUnique({
      where: { id: scanId },
      select: { status: true },
    });

    if (currentScan?.status === 'cancelled') {
      this.logger.log(`Scan ${scanId} was cancelled, not updating to ${status}`);
      return;
    }

    const updateData: Record<string, unknown> = { status };

    if (status === 'running') {
      updateData.startedAt = new Date();
    }

    await this.prisma.penTestScan.update({
      where: { id: scanId },
      data: updateData,
    });
  }

  /**
   * Calculate a risk score from 0-100 based on finding severities
   */
  private calculateRiskScore(counts: FindingsCount): number {
    // Weight each severity level
    const weights = {
      critical: 40,
      high: 25,
      medium: 10,
      low: 3,
      info: 1,
    };

    let score = 0;
    score += Math.min(counts.critical * weights.critical, 50);
    score += Math.min(counts.high * weights.high, 30);
    score += Math.min(counts.medium * weights.medium, 15);
    score += Math.min(counts.low * weights.low, 4);
    score += Math.min(counts.info * weights.info, 1);

    return Math.min(Math.round(score), 100);
  }

  /**
   * Get list of scanners for a given scan mode
   *
   * Note: Nuclei is currently disabled. URL discovery uses Katana + ZAP spider,
   * then ZAP performs the vulnerability scanning.
   */
  private getScannersForMode(mode: ScanMode): ScannerForMode[] {
    switch (mode) {
      case 'quick':
        return [
          // Quick mode: SSL/TLS check only, discovery already done via Katana
          { name: 'sslyze', label: 'SSL/TLS Analysis' },
        ];
      case 'standard':
        return [
          // Standard mode: ZAP active scan on discovered URLs + SSL check
          { name: 'sslyze', label: 'SSL/TLS Analysis' },
          { name: 'zap', label: 'Web Application Testing', config: { passiveOnly: false } },
        ];
      case 'comprehensive':
        return [
          // Full mode: All scanners except Nuclei
          { name: 'sslyze', label: 'SSL/TLS Analysis' },
          { name: 'zap', label: 'Web Application Testing', config: { passiveOnly: false } },
          { name: 'sqlmap', label: 'SQL Injection Testing' },
          { name: 'nikto', label: 'Web Server Analysis' },
        ];
      default:
        return this.getScannersForMode('standard');
    }
  }

  /**
   * Run discovery phase - Katana crawl + ZAP spider for standard/comprehensive modes
   * URLs are rationalized (deduplicated, normalized) before being passed to scanners
   */
  private async runDiscoveryPhase(
    scanMode: ScanMode,
    targetUrl: string,
    workDir: string,
    scanId: string,
    config: {
      authType?: string;
      authCredentials?: Record<string, unknown>;
      authConfig?: Record<string, unknown>;
      headers?: Record<string, string>;
      rateLimitPreset?: string;
      excludePaths?: string[];
      timeout?: number;
    },
    onProgress?: (progress: { scanner: string; percent: number; phase?: string }) => void,
  ): Promise<{ discoveredUrls: string[]; discoveredParams: DiscoveredParam[]; jsFiles: string[] }> {
    const katana = this.scanners.get('katana')!;
    const zap = this.scanners.get('zap')!;

    // Build base context for Katana
    const katanaContext = {
      scanId,
      workDir,
      timeout: scanMode === 'quick' ? 120000 : scanMode === 'standard' ? 300000 : 600000,
      config: {
        targetUrls: [targetUrl],
        scanMode,
        headers: config.headers,
        authConfig: config.authConfig,
        excludePaths: config.excludePaths,
        onProgress,
      },
    };

    // Emit discovery start
    this.scanGateway.emitScannerStart(scanId, {
      scanner: 'katana',
      label: 'URL Discovery',
      phase: 'discovery',
    });

    if (scanMode === 'quick') {
      // Quick mode: Katana only for fast discovery
      const katanaOutput = await katana.scanner.scan(katanaContext);
      const discoveredUrls = katanaOutput.discoveredUrls || [];
      const discoveredParams = katanaOutput.discoveredParams || [];
      const jsFiles = katanaOutput.jsFiles || [];

      // Rationalize URLs
      const rationalizedUrls = this.rationalizeUrls(discoveredUrls, targetUrl);

      this.logger.log(`Quick discovery complete: ${discoveredUrls.length} raw URLs -> ${rationalizedUrls.length} rationalized`);

      // Emit discovery complete
      this.scanGateway.emitScannerComplete(scanId, {
        scanner: 'katana',
        label: 'URL Discovery',
        findingsCount: 0,
        duration: katanaOutput.duration,
        status: 'completed',
      });

      return { discoveredUrls: rationalizedUrls, discoveredParams, jsFiles };
    }

    // Standard and Comprehensive modes: Run Katana and ZAP spider in parallel
    this.logger.log(`${scanMode} mode: running Katana and ZAP spider in parallel for comprehensive URL discovery`);

    const zapContext = {
      scanId,
      workDir,
      timeout: scanMode === 'standard' ? 180000 : 300000,
      config: {
        targetUrls: [targetUrl],
        headers: config.headers,
        authConfig: config.authConfig,
        onProgress,
      },
    };

    // Emit ZAP spider start too
    this.scanGateway.emitScannerStart(scanId, {
      scanner: 'zap',
      label: 'ZAP Spider',
      phase: 'discovery',
    });

    // Run both crawlers in parallel
    const [katanaOutput, zapOutput] = await Promise.all([
      katana.scanner.scan(katanaContext),
      zap.scanner.spiderOnly(zapContext).catch((err: Error) => {
        this.logger.warn(`ZAP spider failed: ${err.message}, continuing with Katana URLs only`);
        return { discoveredUrls: [], duration: 0 };
      }),
    ]);

    // Collect all URLs
    const katanaUrls = katanaOutput.discoveredUrls || [];
    const zapUrls = zapOutput.discoveredUrls || [];

    this.logger.log(`Raw URL counts - Katana: ${katanaUrls.length}, ZAP Spider: ${zapUrls.length}`);

    // Combine and rationalize URLs
    const allUrls = [...katanaUrls, ...zapUrls];
    const rationalizedUrls = this.rationalizeUrls(allUrls, targetUrl);

    // Merge params (Katana has more detailed param info)
    const discoveredParams = katanaOutput.discoveredParams || [];

    this.logger.log(`Discovery complete: ${allUrls.length} raw URLs -> ${rationalizedUrls.length} rationalized URLs`);

    // Emit discovery complete events
    this.scanGateway.emitScannerComplete(scanId, {
      scanner: 'katana',
      label: 'URL Discovery',
      findingsCount: 0,
      duration: katanaOutput.duration,
      status: 'completed',
    });
    this.scanGateway.emitScannerComplete(scanId, {
      scanner: 'zap',
      label: 'ZAP Spider',
      findingsCount: 0,
      duration: zapOutput.duration || 0,
      status: zapOutput.discoveredUrls ? 'completed' : 'skipped',
    });

    return { discoveredUrls: rationalizedUrls, discoveredParams, jsFiles: katanaOutput.jsFiles || [] };
  }

  /**
   * Rationalize URLs - deduplicate, normalize, and remove duplicates that differ only in trivial ways
   * This reduces scan time by avoiding scanning the same endpoint multiple times
   */
  private rationalizeUrls(urls: string[], baseUrl: string): string[] {
    const seen = new Set<string>();
    const rationalized: string[] = [];

    // Always include the base URL first
    const baseNormalized = this.normalizeUrl(baseUrl);
    if (baseNormalized) {
      seen.add(this.getUrlSignature(baseNormalized));
      rationalized.push(baseNormalized);
    }

    for (const url of urls) {
      try {
        const normalized = this.normalizeUrl(url);
        if (!normalized) continue;

        // Get a signature that ignores trivial differences
        const signature = this.getUrlSignature(normalized);

        // Skip if we've seen this signature
        if (seen.has(signature)) continue;
        seen.add(signature);

        // Skip static assets that are unlikely to have vulnerabilities
        if (this.isStaticAsset(normalized)) continue;

        rationalized.push(normalized);
      } catch {
        // Skip invalid URLs
      }
    }

    // Sort URLs for consistent ordering (base paths first, then by depth)
    rationalized.sort((a, b) => {
      const depthA = (a.match(/\//g) || []).length;
      const depthB = (b.match(/\//g) || []).length;
      if (depthA !== depthB) return depthA - depthB;
      return a.localeCompare(b);
    });

    return rationalized;
  }

  /**
   * Normalize a URL - remove fragments, sort query params, lowercase host
   */
  private normalizeUrl(urlString: string): string | null {
    try {
      const url = new URL(urlString);

      // Remove fragment
      url.hash = '';

      // Sort query parameters for consistent comparison
      const params = new URLSearchParams(url.search);
      const sortedParams = new URLSearchParams([...params.entries()].sort());
      url.search = sortedParams.toString();

      // Lowercase the hostname
      url.hostname = url.hostname.toLowerCase();

      // Remove default ports
      if ((url.protocol === 'http:' && url.port === '80') ||
          (url.protocol === 'https:' && url.port === '443')) {
        url.port = '';
      }

      // Remove trailing slash from path (except for root)
      if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
        url.pathname = url.pathname.slice(0, -1);
      }

      return url.toString();
    } catch {
      return null;
    }
  }

  /**
   * Get a signature for a URL that ignores trivial differences
   * URLs with the same signature are considered duplicates
   */
  private getUrlSignature(url: string): string {
    try {
      const parsed = new URL(url);

      // Create signature from: host + path + sorted param names (not values)
      // This way /api/users?id=1 and /api/users?id=2 are treated as the same endpoint
      const paramNames = [...new URLSearchParams(parsed.search).keys()].sort().join(',');

      // Normalize path segments - replace numeric IDs with placeholder
      // e.g., /api/users/123/profile -> /api/users/{id}/profile
      const normalizedPath = parsed.pathname
        .split('/')
        .map(segment => {
          // Replace pure numeric segments (likely IDs)
          if (/^\d+$/.test(segment)) return '{id}';
          // Replace UUID-like segments
          if (/^[a-f0-9-]{36}$/i.test(segment)) return '{uuid}';
          // Replace hash-like segments (32+ hex chars)
          if (/^[a-f0-9]{32,}$/i.test(segment)) return '{hash}';
          return segment;
        })
        .join('/');

      return `${parsed.host}${normalizedPath}?${paramNames}`;
    } catch {
      return url;
    }
  }

  /**
   * Check if URL points to a static asset that's unlikely to have vulnerabilities
   */
  private isStaticAsset(url: string): boolean {
    const staticExtensions = [
      '.css', '.js', '.map', '.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg',
      '.woff', '.woff2', '.ttf', '.eot', '.otf',
      '.mp3', '.mp4', '.webm', '.ogg', '.wav',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    ];

    const lowerUrl = url.toLowerCase();
    return staticExtensions.some(ext => lowerUrl.endsWith(ext));
  }
}
