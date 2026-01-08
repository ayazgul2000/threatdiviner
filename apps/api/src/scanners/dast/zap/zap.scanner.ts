import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IScanner, ScanContext, ScanOutput, ScanOutputWithDiscovery, NormalizedFinding, Severity, Confidence } from '../../interfaces';
import { LocalExecutorService, ScanProgress } from '../../execution';
import { getRateLimitConfig, RateLimitPreset } from '../../rate-limit.config';

/**
 * ZAP API Response Types
 */
interface ZapApiAlert {
  sourceid: string;
  other: string;
  method: string;
  evidence: string;
  pluginId: string;
  cweid: string;
  confidence: string;
  wascid: string;
  description: string;
  messageId: string;
  inputVector: string;
  url: string;
  tags: Record<string, string>;
  reference: string;
  solution: string;
  alert: string;
  param: string;
  attack: string;
  name: string;
  risk: string;
  id: string;
  alertRef: string;
}

interface ZapSpiderScanResponse {
  scan: string; // scan ID
}

interface ZapSpiderStatusResponse {
  status: string; // percentage 0-100
}

interface ZapActiveScanResponse {
  scan: string; // scan ID
}

interface ZapActiveScanStatusResponse {
  status: string; // percentage 0-100
}

interface ZapPassiveScanRecordsResponse {
  recordsToScan: string;
}

interface ZapAlertsResponse {
  alerts: ZapApiAlert[];
}

export type ZapScanType = 'baseline' | 'full' | 'api';

export interface ZapScanConfig {
  scanType: ZapScanType;
  targetUrl: string;
  apiDefinition?: string;
  authEnabled?: boolean;
  authConfig?: {
    loginUrl: string;
    username: string;
    password: string;
    usernameField: string;
    passwordField: string;
  };
  passiveOnly?: boolean;  // Skip active scan (for Standard mode)
}

@Injectable()
export class ZapScanner implements IScanner {
  readonly name = 'zap';
  readonly version = '2.x';
  readonly supportedLanguages = ['web', 'api'];
  readonly outputFormat = 'json' as const;

  private readonly logger = new Logger(ZapScanner.name);
  private readonly zapDockerImage: string;
  private readonly zapApiKey: string;
  private readonly containerName = 'zap-threatdiviner'; // Singleton container
  private currentApiPort: number = 0;

  constructor(
    private readonly executor: LocalExecutorService,
    private readonly configService: ConfigService,
  ) {
    this.zapDockerImage = this.configService.get('ZAP_DOCKER_IMAGE', 'ghcr.io/zaproxy/zaproxy:stable');
    this.zapApiKey = this.configService.get('ZAP_API_KEY', 'threatdiviner-zap-key');
  }

  /**
   * Get a random available port between 10000-60000
   */
  private getRandomPort(): number {
    return Math.floor(Math.random() * 50000) + 10000;
  }

  async isAvailable(): Promise<boolean> {
    const hasDocker = await this.executor.isCommandAvailable('docker');
    if (!hasDocker) {
      this.logger.warn('Docker command not found');
      return false;
    }

    try {
      const result = await this.executor.execute({
        command: 'docker',
        args: ['ps', '-q'],
        cwd: process.cwd(),
        timeout: 10000,
      });
      if (result.exitCode !== 0) {
        this.logger.warn(`Docker daemon not running: ${result.stderr}`);
        return false;
      }
      return true;
    } catch {
      this.logger.warn('Docker daemon check failed');
      return false;
    }
  }

  async getVersion(): Promise<string> {
    return this.zapDockerImage;
  }

  /**
   * Main scan entry point - uses ZAP API for proper crawling
   * Uses singleton container that stays warm between scans
   */
  async scan(context: ScanContext): Promise<ScanOutputWithDiscovery> {
    const startTime = Date.now();

    const zapConfig = this.getZapConfig(context);
    const onProgress = context.config?.onProgress as ((progress: ScanProgress) => void) | undefined;
    const onLog = context.config?.onLog as ((line: string, stream: 'stdout' | 'stderr') => void) | undefined;
    const onFinding = context.config?.onFinding as ((finding: NormalizedFinding) => void) | undefined;

    if (!zapConfig.targetUrl) {
      return this.errorResult('No target URL configured for ZAP scan', startTime);
    }

    // Get rate limit config
    const rateLimitPreset = (context.config?.rateLimitPreset as RateLimitPreset) || 'medium';
    const rateLimitConfig = getRateLimitConfig('zap', rateLimitPreset);
    this.logger.log(`ZAP scan starting - target: ${zapConfig.targetUrl}, rate limit: ${rateLimitPreset}`);

    try {
      // 1. Get or start ZAP container (singleton - stays warm)
      this.emitProgress(onProgress, 'initializing', 0);
      this.emitLog(onLog, `Initializing ZAP for target: ${zapConfig.targetUrl}`, 'stdout');

      const { port, isNew } = await this.getOrStartZapContainer();
      this.currentApiPort = port;
      this.emitLog(onLog, isNew ? `ZAP container started on port ${port}` : `Using existing ZAP container on port ${port}`, 'stdout');

      // Wait for ZAP API to be ready (quick check if reusing)
      await this.waitForZapReady(isNew ? 90000 : 10000);
      this.emitLog(onLog, 'ZAP API is ready', 'stdout');

      // Start new session to clear previous scan data
      await this.startNewSession();
      this.emitLog(onLog, 'Started new ZAP session', 'stdout');

      // Convert URL for Docker networking
      const targetUrl = this.toDockerAccessibleUrl(zapConfig.targetUrl);

      // 2. Spider scan
      this.emitProgress(onProgress, 'spider', 5);
      this.emitLog(onLog, `Starting spider scan on ${targetUrl}`, 'stdout');

      const spiderScanId = await this.startSpiderScan(targetUrl);
      this.emitLog(onLog, `Spider scan started (ID: ${spiderScanId})`, 'stdout');

      await this.pollSpiderProgress(spiderScanId, onProgress, onLog);
      this.emitLog(onLog, 'Spider scan complete', 'stdout');

      // 3. Wait for passive scan queue to drain
      this.emitProgress(onProgress, 'passive', 40);
      this.emitLog(onLog, 'Waiting for passive scan to complete...', 'stdout');

      await this.waitForPassiveScan(onProgress, onLog);
      this.emitLog(onLog, 'Passive scan complete', 'stdout');

      // 4. Active scan (skip if passiveOnly mode)
      const passiveOnly = context.config?.passiveOnly === true;
      if (!passiveOnly) {
        this.emitProgress(onProgress, 'active', 50);
        this.emitLog(onLog, `Starting active scan on ${targetUrl}`, 'stdout');

        const activeScanId = await this.startActiveScan(targetUrl, rateLimitConfig.threadCount);
        this.emitLog(onLog, `Active scan started (ID: ${activeScanId})`, 'stdout');

        await this.pollActiveScanProgress(activeScanId, onProgress, onLog);
        this.emitLog(onLog, 'Active scan complete', 'stdout');
      } else {
        this.emitLog(onLog, 'Passive-only mode: skipping active scan', 'stdout');
        this.emitProgress(onProgress, 'passive-complete', 90);
      }

      // 5. Fetch alerts and discovered URLs
      this.emitProgress(onProgress, 'fetching-alerts', 95);
      this.emitLog(onLog, 'Fetching scan results...', 'stdout');

      const [alerts, discoveredUrls] = await Promise.all([
        this.fetchAlerts(targetUrl),
        this.fetchDiscoveredUrls(targetUrl),
      ]);
      this.emitLog(onLog, `Found ${alerts.length} alerts, ${discoveredUrls.length} discovered URLs`, 'stdout');

      // 6. Parse alerts to findings
      const findings = this.parseAlerts(alerts, zapConfig.targetUrl);

      // Emit findings via WebSocket
      if (onFinding) {
        for (const finding of findings) {
          onFinding(finding);
        }
      }

      // 7. Complete (container stays running for next scan)
      this.emitProgress(onProgress, 'complete', 100);
      this.emitLog(onLog, 'ZAP scan complete (container kept warm)', 'stdout');

      const duration = Date.now() - startTime;
      this.logger.log(`ZAP scan completed in ${duration}ms with ${findings.length} findings, ${discoveredUrls.length} URLs discovered`);

      return {
        scanner: this.name,
        exitCode: 0,
        stdout: `Scan completed with ${findings.length} findings`,
        stderr: '',
        duration,
        timedOut: false,
        findings,
        discoveredUrls,
      };

    } catch (error) {
      this.logger.error(`ZAP scan failed: ${error}`);
      this.emitLog(onLog, `Error: ${error}`, 'stderr');

      // Don't stop container on error - might be temporary issue
      return this.errorResult(String(error), startTime);
    }
  }

  /**
   * Spider-only scan for URL discovery (used in Comprehensive mode discovery phase)
   * Runs spider scan only - no passive or active scanning
   * Returns discovered URLs for merging with Katana results
   */
  async spiderOnly(context: ScanContext): Promise<ScanOutputWithDiscovery> {
    const startTime = Date.now();

    const targetUrls = context.config?.targetUrls as string[] || [];
    const onProgress = context.config?.onProgress as ((progress: { scanner: string; percent: number; phase?: string }) => void) | undefined;
    const onLog = context.config?.onLog as ((line: string, stream: 'stdout' | 'stderr') => void) | undefined;

    if (targetUrls.length === 0) {
      return this.errorResult('No target URL configured', startTime) as ScanOutputWithDiscovery;
    }

    const targetUrl = targetUrls[0];
    this.logger.log(`ZAP spider-only scan starting - target: ${targetUrl}`);

    try {
      // 1. Get or start ZAP container
      this.emitProgress(onProgress, 'initializing', 5);
      this.emitLog(onLog, `Initializing ZAP spider for: ${targetUrl}`, 'stdout');

      const { port, isNew } = await this.getOrStartZapContainer();
      this.currentApiPort = port;

      await this.waitForZapReady(isNew ? 90000 : 10000);
      await this.startNewSession();

      const dockerTargetUrl = this.toDockerAccessibleUrl(targetUrl);

      // 2. Run AJAX spider (better for JS-heavy sites)
      this.emitProgress(onProgress, 'ajax-spider', 10);
      this.emitLog(onLog, `Starting ZAP AJAX Spider on ${dockerTargetUrl}`, 'stdout');

      await this.startAjaxSpiderScan(dockerTargetUrl);
      await this.pollAjaxSpiderProgress(onProgress, onLog);

      this.emitLog(onLog, 'ZAP AJAX Spider complete', 'stdout');

      // 3. Fetch discovered URLs (no waiting for passive scan)
      this.emitProgress(onProgress, 'fetching-urls', 90);
      const discoveredUrls = await this.fetchDiscoveredUrls(targetUrl, true);

      this.emitProgress(onProgress, 'complete', 100);
      this.logger.log(`ZAP spider discovered ${discoveredUrls.length} URLs`);

      return {
        scanner: this.name,
        exitCode: 0,
        stdout: `Spider discovered ${discoveredUrls.length} URLs`,
        stderr: '',
        duration: Date.now() - startTime,
        timedOut: false,
        discoveredUrls,
      };

    } catch (error) {
      this.logger.error(`ZAP spider-only scan failed: ${error}`);
      return this.errorResult(String(error), startTime) as ScanOutputWithDiscovery;
    }
  }

  /**
   * Get or start ZAP singleton container
   * - If running: reuse existing container
   * - If Created/Exited: remove and start new
   * - If not found: start new
   */
  private async getOrStartZapContainer(): Promise<{ port: number; isNew: boolean }> {
    // 1. Check if container exists and get its status
    const statusResult = await this.executor.execute({
      command: 'docker',
      args: ['ps', '-a', '--filter', `name=^${this.containerName}$`, '--format', '{{.Status}}'],
      cwd: process.cwd(),
      timeout: 10000,
    });

    const status = statusResult.stdout.trim();
    this.logger.log(`Container ${this.containerName} status: "${status}"`);

    if (status.startsWith('Up')) {
      // Container is running - get the port mapping
      const port = await this.getContainerPort();
      this.logger.log(`Reusing existing ZAP container on port ${port}`);
      return { port, isNew: false };
    }

    if (status.includes('Created') || status.includes('Exited')) {
      // Container exists but not running - remove it first
      this.logger.log(`Removing stale container (status: ${status})`);
      await this.executor.execute({
        command: 'docker',
        args: ['rm', '-f', this.containerName],
        cwd: process.cwd(),
        timeout: 10000,
      });
    }

    // 2. Start new container with random port
    const port = this.getRandomPort();
    await this.startNewContainer(port);

    // 3. Wait for container to be "Up"
    await this.waitForContainerUp(90000);

    return { port, isNew: true };
  }

  /**
   * Get the host port mapped to container's 8080
   */
  private async getContainerPort(): Promise<number> {
    // Use docker port instead of docker inspect - simpler and more reliable
    const result = await this.executor.execute({
      command: 'docker',
      args: ['port', this.containerName, '8080'],
      cwd: process.cwd(),
      timeout: 10000,
    });

    // Output format: "0.0.0.0:22835" or ":::22835"
    const output = result.stdout.trim();
    const match = output.match(/:(\d+)$/m);
    if (!match) {
      throw new Error(`Failed to get container port from: ${output}`);
    }
    return parseInt(match[1], 10);
  }

  /**
   * Start a new ZAP container
   */
  private async startNewContainer(port: number): Promise<void> {
    const dockerArgs = [
      'run',
      '-d',
      '--name', this.containerName,
      '-p', `${port}:8080`,
      this.zapDockerImage,
      'zap.sh',
      '-daemon',
      '-host', '0.0.0.0',
      '-port', '8080',
      '-config', `api.key=${this.zapApiKey}`,
      '-config', 'api.addrs.addr.name=.*',
      '-config', 'api.addrs.addr.regex=true',
    ];

    this.logger.log(`Starting ZAP container ${this.containerName} on port ${port}`);

    const result = await this.executor.execute({
      command: 'docker',
      args: dockerArgs,
      cwd: process.cwd(),
      timeout: 60000,
    });

    if (result.exitCode !== 0) {
      throw new Error(`Failed to start ZAP container: ${result.stderr || result.stdout}`);
    }

    this.logger.log(`ZAP container started: ${result.stdout.trim()}`);
  }

  /**
   * Wait for container status to contain "Up"
   */
  private async waitForContainerUp(maxWaitMs: number): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 2000;

    this.logger.log(`Waiting for container ${this.containerName} to be Up...`);

    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.executor.execute({
        command: 'docker',
        args: ['ps', '--filter', `name=^${this.containerName}$`, '--format', '{{.Status}}'],
        cwd: process.cwd(),
        timeout: 10000,
      });

      const status = result.stdout.trim();

      if (status.startsWith('Up')) {
        this.logger.log(`Container is Up (${status})`);
        return;
      }

      if (status.includes('Exited')) {
        // Container failed to start - get logs
        const logsResult = await this.executor.execute({
          command: 'docker',
          args: ['logs', '--tail', '50', this.containerName],
          cwd: process.cwd(),
          timeout: 5000,
        });
        throw new Error(`Container exited unexpectedly. Logs: ${logsResult.stdout || logsResult.stderr}`);
      }

      await this.sleep(pollInterval);
    }

    throw new Error(`Container did not become Up within ${maxWaitMs}ms`);
  }

  /**
   * Start a new ZAP session (clears previous scan data)
   */
  private async startNewSession(): Promise<void> {
    await this.zapApiCall('core/action/newSession/?overwrite=true');
    this.logger.log('Started new ZAP session');
  }

  /**
   * Wait for ZAP API to be ready
   */
  private async waitForZapReady(maxWaitMs: number = 90000): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 2000;
    let attempts = 0;

    this.logger.log(`Waiting for ZAP API on port ${this.currentApiPort}...`);

    while (Date.now() - startTime < maxWaitMs) {
      attempts++;

      try {
        const response = await this.zapApiCall('core/view/version');
        if (response) {
          this.logger.log(`ZAP API ready after ${attempts} attempts (${Date.now() - startTime}ms)`);
          return;
        }
      } catch (error) {
        // API not ready yet - this is expected during startup
        if (attempts % 5 === 0) {
          this.logger.log(`Still waiting for ZAP API... (attempt ${attempts})`);
        }
      }
      await this.sleep(pollInterval);
    }

    // Final attempt to get container logs
    const logsResult = await this.executor.execute({
      command: 'docker',
      args: ['logs', '--tail', '100', this.containerName],
      cwd: process.cwd(),
      timeout: 5000,
    });
    this.logger.error(`ZAP startup timeout. Container logs: ${logsResult.stdout || logsResult.stderr}`);

    throw new Error(`ZAP API did not become ready in ${maxWaitMs}ms`);
  }

  /**
   * Start spider scan
   */
  private async startSpiderScan(targetUrl: string): Promise<string> {
    const response = await this.zapApiCall<ZapSpiderScanResponse>(
      `spider/action/scan/?url=${encodeURIComponent(targetUrl)}&maxChildren=0&recurse=true&subtreeOnly=false`
    );
    return response.scan;
  }

  /**
   * Start AJAX spider scan (better for JS-heavy sites)
   */
  private async startAjaxSpiderScan(targetUrl: string): Promise<void> {
    await this.zapApiCall<{ result: string }>(
      `ajaxSpider/action/scan/?url=${encodeURIComponent(targetUrl)}&inScope=false&subtreeOnly=false`
    );
  }

  /**
   * Poll AJAX spider scan progress
   */
  private async pollAjaxSpiderProgress(
    onProgress?: (progress: ScanProgress) => void,
    onLog?: (line: string, stream: 'stdout' | 'stderr') => void,
    maxDuration = 120000, // 2 min max for AJAX spider
  ): Promise<void> {
    const pollInterval = 3000;
    const startTime = Date.now();

    while (true) {
      const response = await this.zapApiCall<{ status: string }>(
        `ajaxSpider/view/status/`
      );

      const status = response.status; // 'running' or 'stopped'
      const elapsed = Date.now() - startTime;
      const progress = Math.min(95, Math.floor((elapsed / maxDuration) * 100));

      this.emitProgress(onProgress, 'ajax-spider', 10 + Math.floor(progress * 0.8));
      this.emitLog(onLog, `AJAX Spider: ${status} (${Math.floor(elapsed / 1000)}s)`, 'stdout');

      if (status === 'stopped' || elapsed >= maxDuration) {
        if (elapsed >= maxDuration && status === 'running') {
          // Force stop if over time
          await this.zapApiCall<{ result: string }>(`ajaxSpider/action/stop/`);
          this.emitLog(onLog, 'AJAX Spider stopped (timeout)', 'stdout');
        }
        break;
      }

      await this.sleep(pollInterval);
    }
  }

  /**
   * Poll spider scan progress
   */
  private async pollSpiderProgress(
    scanId: string,
    onProgress?: (progress: ScanProgress) => void,
    onLog?: (line: string, stream: 'stdout' | 'stderr') => void,
  ): Promise<void> {
    const pollInterval = 2000;
    let lastProgress = 0;

    while (true) {
      const response = await this.zapApiCall<ZapSpiderStatusResponse>(
        `spider/view/status/?scanId=${scanId}`
      );

      const progress = parseInt(response.status, 10);

      if (progress > lastProgress) {
        lastProgress = progress;
        // Map spider progress to 5-35% range
        const mappedProgress = 5 + Math.floor(progress * 0.3);
        this.emitProgress(onProgress, 'spider', mappedProgress);
        this.emitLog(onLog, `Spider progress: ${progress}%`, 'stdout');
      }

      if (progress >= 100) {
        break;
      }

      await this.sleep(pollInterval);
    }
  }

  /**
   * Wait for passive scan queue to drain
   */
  private async waitForPassiveScan(
    onProgress?: (progress: ScanProgress) => void,
    onLog?: (line: string, stream: 'stdout' | 'stderr') => void,
    maxWaitMs: number = 120000,
  ): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 2000;
    let lastRecords = -1;

    while (Date.now() - startTime < maxWaitMs) {
      const response = await this.zapApiCall<ZapPassiveScanRecordsResponse>(
        'pscan/view/recordsToScan/'
      );

      const recordsToScan = parseInt(response.recordsToScan, 10);

      if (recordsToScan !== lastRecords) {
        lastRecords = recordsToScan;
        this.emitLog(onLog, `Passive scan: ${recordsToScan} records remaining`, 'stdout');

        // Map to 40-50% range based on progress
        if (recordsToScan === 0) {
          this.emitProgress(onProgress, 'passive', 50);
        }
      }

      if (recordsToScan === 0) {
        return;
      }

      await this.sleep(pollInterval);
    }

    this.logger.warn('Passive scan timed out, continuing with active scan');
  }

  /**
   * Start active scan
   */
  private async startActiveScan(targetUrl: string, threadCount: number = 5): Promise<string> {
    // Configure scan policy with thread count
    await this.zapApiCall(
      `ascan/action/setOptionThreadPerHost/?Integer=${threadCount}`
    );

    const response = await this.zapApiCall<ZapActiveScanResponse>(
      `ascan/action/scan/?url=${encodeURIComponent(targetUrl)}&recurse=true&inScopeOnly=false`
    );
    return response.scan;
  }

  /**
   * Poll active scan progress
   */
  private async pollActiveScanProgress(
    scanId: string,
    onProgress?: (progress: ScanProgress) => void,
    onLog?: (line: string, stream: 'stdout' | 'stderr') => void,
  ): Promise<void> {
    const pollInterval = 3000;
    let lastProgress = 0;

    while (true) {
      const response = await this.zapApiCall<ZapActiveScanStatusResponse>(
        `ascan/view/status/?scanId=${scanId}`
      );

      const progress = parseInt(response.status, 10);

      if (progress > lastProgress) {
        lastProgress = progress;
        // Map active scan progress to 50-95% range
        const mappedProgress = 50 + Math.floor(progress * 0.45);
        this.emitProgress(onProgress, 'active', mappedProgress);
        this.emitLog(onLog, `Active scan progress: ${progress}%`, 'stdout');
      }

      if (progress >= 100) {
        break;
      }

      await this.sleep(pollInterval);
    }
  }

  /**
   * Fetch alerts from ZAP API
   */
  private async fetchAlerts(targetUrl: string): Promise<ZapApiAlert[]> {
    const response = await this.zapApiCall<ZapAlertsResponse>(
      `core/view/alerts/?baseurl=${encodeURIComponent(targetUrl)}&start=0&count=10000`
    );
    return response.alerts || [];
  }

  /**
   * Fetch injectable endpoints from ZAP - URLs with parameters that SQLMap can test
   * Returns URLs in format ready for SQLMap: "http://target/page?id=1&name=test"
   */
  private async fetchDiscoveredUrls(targetUrl: string, allUrls = false): Promise<string[]> {
    try {
      // Get all URLs discovered by the spider
      const dockerUrl = this.toDockerAccessibleUrl(targetUrl);
      const response = await this.zapApiCall<{ urls: string[] }>(
        `core/view/urls/?baseurl=${encodeURIComponent(dockerUrl)}`
      );

      const urls = response.urls || [];

      // Convert docker URLs back to original host format
      const normalizedUrls = urls.map(url =>
        url.replace(/host\.docker\.internal/gi, new URL(targetUrl).hostname)
      );

      // For spider-only discovery, return all URLs
      if (allUrls) {
        const uniqueUrls = [...new Set(normalizedUrls)];
        this.logger.log(`Discovered ${uniqueUrls.length} total URLs`);
        return uniqueUrls;
      }

      // Filter to include only URLs with query parameters (actual injection points)
      // SQLMap needs URLs like: http://target/page?id=1
      const injectableUrls = normalizedUrls.filter(url => {
        try {
          const parsed = new URL(url);
          return parsed.search && parsed.search.length > 1;
        } catch {
          return false;
        }
      });

      // Deduplicate by URL path (keep first occurrence of each endpoint)
      const seenPaths = new Set<string>();
      const uniqueUrls = injectableUrls.filter(url => {
        try {
          const parsed = new URL(url);
          const paramNames = [...new URLSearchParams(parsed.search).keys()].sort().join(',');
          const key = `${parsed.pathname}?${paramNames}`;
          if (seenPaths.has(key)) return false;
          seenPaths.add(key);
          return true;
        } catch {
          return false;
        }
      });

      this.logger.log(`Discovered ${urls.length} total URLs, ${uniqueUrls.length} unique injectable endpoints`);
      return uniqueUrls;
    } catch (error) {
      this.logger.warn(`Failed to fetch discovered URLs: ${error}`);
      return [];
    }
  }

  /**
   * Parse ZAP API alerts to NormalizedFinding format
   */
  private parseAlerts(alerts: ZapApiAlert[], originalTargetUrl: string): NormalizedFinding[] {
    const findings: NormalizedFinding[] = [];

    for (const alert of alerts) {
      const severity = this.mapRisk(alert.risk);
      const confidence = this.mapConfidence(alert.confidence);

      const cweIds: string[] = [];
      if (alert.cweid && alert.cweid !== '-1' && alert.cweid !== '0') {
        cweIds.push(`CWE-${alert.cweid}`);
      }

      const references: string[] = [];
      if (alert.reference) {
        const urlMatches = alert.reference.match(/https?:\/\/[^\s<>"]+/g);
        if (urlMatches) {
          references.push(...urlMatches);
        }
      }

      const owaspIds: string[] = [];
      if (alert.tags) {
        for (const [key, value] of Object.entries(alert.tags)) {
          if (key.toLowerCase().includes('owasp')) {
            owaspIds.push(value);
          }
        }
      }

      findings.push({
        scanner: this.name,
        ruleId: alert.pluginId || alert.alertRef,
        severity,
        confidence,
        title: alert.name || alert.alert,
        description: this.stripHtml(alert.description),
        filePath: alert.url || originalTargetUrl,
        startLine: 0,
        cweIds,
        cveIds: [],
        owaspIds,
        references,
        fix: {
          description: this.stripHtml(alert.solution),
        },
        fingerprint: this.generateFingerprint(alert.alertRef, alert.url, alert.param),
        metadata: {
          method: alert.method,
          param: alert.param,
          attack: alert.attack,
          evidence: alert.evidence,
          wascId: alert.wascid,
          messageId: alert.messageId,
          inputVector: alert.inputVector,
          otherInfo: alert.other,
        },
      });
    }

    return findings;
  }


  /**
   * Make ZAP API call
   * Uses http.request to set Host header (Node.js fetch doesn't allow it - forbidden header)
   */
  private async zapApiCall<T = any>(endpoint: string): Promise<T> {
    const separator = endpoint.includes('?') ? '&' : '?';
    const path = `/JSON/${endpoint}${separator}apikey=${this.zapApiKey}`;

    return new Promise((resolve, reject) => {
      const http = require('http');
      const req = http.request(
        {
          hostname: 'localhost',
          port: this.currentApiPort,
          path,
          method: 'GET',
          headers: {
            'Host': 'localhost:8080', // Must match container internal port
          },
        },
        (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode !== 200) {
              reject(new Error(`ZAP API error: ${res.statusCode} - ${data}`));
              return;
            }
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error(`Failed to parse ZAP API response: ${data}`));
            }
          });
        },
      );

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Parse output - not used for API-based scanning, but required by interface
   */
  async parseOutput(output: ScanOutput): Promise<NormalizedFinding[]> {
    // Findings are attached directly to output in API-based scanning
    return (output as any).findings || [];
  }

  // Helper methods

  private getZapConfig(context: ScanContext): ZapScanConfig {
    const targetUrls = context.config?.targetUrls as string[] || [];
    const zapConfig = context.config?.zapConfig as Partial<ZapScanConfig> || {};
    const scanMode = context.config?.dastScanMode || 'standard';

    return {
      scanType: scanMode === 'full' ? 'full' : 'baseline',
      targetUrl: zapConfig.targetUrl || targetUrls[0] || '',
      apiDefinition: zapConfig.apiDefinition,
      authEnabled: zapConfig.authEnabled || false,
      authConfig: zapConfig.authConfig,
    };
  }

  private toDockerAccessibleUrl(url: string): string {
    if (process.platform === 'win32' || process.platform === 'darwin') {
      return url
        .replace(/localhost/gi, 'host.docker.internal')
        .replace(/127\.0\.0\.1/g, 'host.docker.internal');
    }
    return url;
  }

  private mapRisk(risk: string): Severity {
    switch (risk.toLowerCase()) {
      case 'high':
        return 'critical';
      case 'medium':
        return 'high';
      case 'low':
        return 'medium';
      case 'informational':
        return 'info';
      default:
        return 'info';
    }
  }

  private mapConfidence(confidence: string): Confidence {
    switch (confidence.toLowerCase()) {
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
      default:
        return 'low';
    }
  }

  private stripHtml(html: string | undefined): string {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private generateFingerprint(alertRef: string, url: string, param: string | undefined): string {
    const data = `${alertRef}:${url}:${param || ''}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `zap-${Math.abs(hash).toString(16)}`;
  }

  private emitProgress(
    onProgress: ((progress: ScanProgress) => void) | undefined,
    phase: string,
    percent: number,
  ): void {
    if (onProgress) {
      onProgress({ scanner: this.name, phase, percent });
    }
  }

  private emitLog(
    onLog: ((line: string, stream: 'stdout' | 'stderr') => void) | undefined,
    line: string,
    stream: 'stdout' | 'stderr',
  ): void {
    if (onLog) {
      onLog(`[ZAP] ${line}`, stream);
    }
  }

  private errorResult(message: string, startTime: number): ScanOutput {
    return {
      scanner: this.name,
      exitCode: 1,
      stdout: '',
      stderr: message,
      duration: Date.now() - startTime,
      timedOut: false,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
