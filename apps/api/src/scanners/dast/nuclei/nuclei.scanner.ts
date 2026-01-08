import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IScanner, ScanContext, ScanOutput, NormalizedFinding, Severity, Confidence, TemplateStats, ScanOutputWithTemplates } from '../../interfaces';
import { LocalExecutorService, ScanProgress } from '../../execution';
import { getRateLimitConfig, RateLimitPreset } from '../../rate-limit.config';

/**
 * Nuclei stats JSON output structure
 */
interface NucleiStatsJson {
  templates?: string;       // "150"
  hosts?: string;           // "1"
  requests?: string;        // "2500"
  total?: string;           // "4500"
  percent?: string;         // "55"
  matched?: string;         // "12"
  errors?: string;          // "3"
  rps?: string;             // "148"
  elapsed?: string;         // "0:01:30"
}

export type DastScanMode = 'quick' | 'standard' | 'full';
export type ScanPhase = 'discovery' | 'focused' | 'single' | 'full';

// Template configuration by scan mode
const SCAN_MODE_TEMPLATES: Record<DastScanMode, string[]> = {
  // Quick (~1 min): Technology detection & exposed panels
  quick: [
    'http/technologies',
    'http/exposed-panels',
  ],
  // Standard (~5 min): + Exposures & misconfigurations
  standard: [
    'http/technologies',
    'http/exposed-panels',
    'http/exposures',
    'http/misconfiguration',
  ],
  // Full (~15-30 min): + CVEs & vulnerabilities
  full: [
    'http/technologies',
    'http/exposed-panels',
    'http/exposures',
    'http/misconfiguration',
    'http/cves',
    'http/vulnerabilities',
  ],
};

// Discovery phase templates (fast, detect technologies)
const DISCOVERY_TEMPLATES = [
  'http/technologies',
  'http/exposed-panels',
  'http/misconfiguration',
];

// Technology-focused templates mapping for deep phase
const TECH_FOCUSED_TEMPLATES: Record<string, string[]> = {
  apache: ['http/apache', 'http/cves/apache'],
  nginx: ['http/nginx'],
  wordpress: ['http/wordpress'],
  tomcat: ['http/tomcat'],
  iis: ['http/iis'],
  php: ['http/php'],
  nodejs: ['http/nodejs', 'http/node'],
  spring: ['http/spring'],
  joomla: ['http/joomla'],
  drupal: ['http/drupal'],
  jenkins: ['http/jenkins'],
  gitlab: ['http/gitlab'],
  grafana: ['http/grafana'],
  kubernetes: ['http/kubernetes'],
  docker: ['http/docker'],
};

interface NucleiJsonResult {
  template: string;
  'template-url'?: string;
  'template-id': string;
  'template-path'?: string;
  info: {
    name: string;
    author?: string[];
    tags?: string[];
    description?: string;
    severity: string;
    reference?: string[];
    classification?: {
      'cve-id'?: string[];
      'cwe-id'?: string[];
    };
  };
  type: string;
  host: string;
  matched: string;
  extracted?: string[];
  timestamp: string;
  'curl-command'?: string;
  'matcher-name'?: string;
  'matcher-status'?: boolean;
}

@Injectable()
export class NucleiScanner implements IScanner {
  readonly name = 'nuclei';
  readonly version = '3.x';
  readonly supportedLanguages = ['web', 'api', 'network'];
  readonly outputFormat = 'json' as const;

  private readonly logger = new Logger(NucleiScanner.name);
  private readonly nucleiPath: string;
  private readonly templatesPath: string;

  constructor(
    private readonly executor: LocalExecutorService,
    private readonly configService: ConfigService,
  ) {
    this.nucleiPath = this.configService.get('NUCLEI_PATH', 'nuclei');
    this.templatesPath = this.configService.get('NUCLEI_TEMPLATES_PATH', '');
  }

  async isAvailable(): Promise<boolean> {
    return this.executor.isCommandAvailable(this.nucleiPath);
  }

  async getVersion(): Promise<string> {
    return this.executor.getCommandVersion(this.nucleiPath, '-version');
  }

  /**
   * Get templates for discovery phase (fast, tech detection)
   */
  getDiscoveryTemplates(): string[] {
    return DISCOVERY_TEMPLATES;
  }

  /**
   * Get focused templates based on detected technologies
   */
  getFocusedTemplates(techs: string[]): string[] {
    const templates: Set<string> = new Set();

    for (const tech of techs) {
      const techLower = tech.toLowerCase();
      const focused = TECH_FOCUSED_TEMPLATES[techLower];
      if (focused) {
        focused.forEach(t => templates.add(t));
      }
    }

    // Always include CVEs and vulnerabilities for deep scan
    templates.add('http/cves');
    templates.add('http/vulnerabilities');

    return Array.from(templates);
  }

  /**
   * Parse technologies from discovery phase findings
   */
  parseTechnologies(findings: NormalizedFinding[]): string[] {
    const techs: Set<string> = new Set();

    for (const finding of findings) {
      // Extract tech from template-id patterns
      const templateId = finding.ruleId || '';

      // Common tech patterns in nuclei template IDs
      const techPatterns = [
        /apache/i, /nginx/i, /wordpress/i, /tomcat/i, /iis/i,
        /php/i, /nodejs?/i, /spring/i, /joomla/i, /drupal/i,
        /jenkins/i, /gitlab/i, /grafana/i, /kubernetes/i, /docker/i,
      ];

      for (const pattern of techPatterns) {
        const match = templateId.match(pattern);
        if (match) {
          techs.add(match[0].toLowerCase());
        }
      }

      // Also check metadata.extracted for tech names
      const extracted = finding.metadata?.extracted as string[] | undefined;
      if (extracted) {
        extracted.forEach(e => {
          if (typeof e === 'string' && e.length < 50) {
            // Check if it matches known tech names
            for (const tech of Object.keys(TECH_FOCUSED_TEMPLATES)) {
              if (e.toLowerCase().includes(tech)) {
                techs.add(tech);
              }
            }
          }
        });
      }
    }

    return Array.from(techs);
  }

  async scan(context: ScanContext): Promise<ScanOutputWithTemplates> {
    // Use forward slashes for Windows compatibility with shell: true
    const normalizePath = (p: string) => p.replace(/\\/g, '/');
    const outputFile = normalizePath(path.join(context.workDir, 'nuclei-results.json'));
    const errorLogFile = normalizePath(path.join(context.workDir, 'nuclei-errors.log'));

    // Get target URLs from config
    let targetUrls = context.config?.targetUrls as string[] || [];
    if (targetUrls.length === 0) {
      this.logger.warn('No target URLs configured for DAST scan');
      return {
        scanner: this.name,
        exitCode: 0,
        stdout: 'No target URLs configured',
        stderr: '',
        duration: 0,
        timedOut: false,
      };
    }

    // Replace 'localhost' with '127.0.0.1' in target URLs to avoid DNS resolution issues
    targetUrls = targetUrls.map(url => url.replace(/localhost/gi, '127.0.0.1'));
    this.logger.log(`Target URLs (normalized): ${targetUrls.join(', ')}`);

    // Create targets file (normalize path for Windows shell compatibility)
    const targetsFile = normalizePath(path.join(context.workDir, 'nuclei-targets.txt'));
    await fs.writeFile(targetsFile, targetUrls.join('\n'));

    // Get scan phase and mode from config
    // Support both 'dastScanMode' (legacy) and 'scanMode' (from target-scan processor)
    const scanPhase = (context.config?.scanPhase as ScanPhase) || 'single';
    const rawScanMode = context.config?.dastScanMode || context.config?.scanMode || 'standard';
    // Map target scan modes to DAST modes: quick->quick, standard->standard, comprehensive->full
    const scanMode: DastScanMode = rawScanMode === 'comprehensive' ? 'full' : (rawScanMode as DastScanMode);
    const detectedTechs = (context.config?.detectedTechnologies as string[]) || [];
    this.logger.log(`DAST scan phase: ${scanPhase}, mode: ${scanMode} (raw: ${rawScanMode})`);

    // Get rate limit preset from config
    const rateLimitPreset = (context.config?.rateLimitPreset as RateLimitPreset) || 'medium';
    const rateLimitConfig = getRateLimitConfig('nuclei', rateLimitPreset);
    this.logger.log(`Using rate limit preset: ${rateLimitPreset} (${rateLimitConfig.rateLimit} RPS)`);

    // Track template stats
    const templateStats: TemplateStats = {
      totalTemplates: 0,
      completedTemplates: 0,
      failedTemplates: 0,
      skippedTemplates: 0,
      totalRequests: 0,
      totalMatches: 0,
      totalErrors: 0,
      templates: [],
    };

    const args = [
      '-l', targetsFile,
      '-jsonl',                // Output findings as JSONL to stdout for real-time streaming
      '-no-color',
      '-rate-limit', String(rateLimitConfig.rateLimit),
      '-bulk-size', String(rateLimitConfig.bulkSize),
      '-concurrency', String(rateLimitConfig.concurrency),
      '-stats',                // Enable stats output for progress tracking
      '-stats-json',           // Get stats in JSON format for parsing
      '-stats-interval', '3',  // Update stats every 3 seconds
      '-error-log', errorLogFile,  // Capture template errors
      '-vv',                   // Verbose mode to see loaded templates
    ];

    // Determine templates based on phase
    let templates: string[] = [];

    if (this.templatesPath) {
      // Use custom templates path if configured
      args.push('-t', this.templatesPath);
    } else if (scanPhase === 'discovery') {
      // Discovery phase: fast tech detection (for optimized mode)
      templates = this.getDiscoveryTemplates();
      this.logger.log(`Discovery phase using templates: ${templates.join(', ')}`);
    } else if (scanPhase === 'focused' && detectedTechs.length > 0) {
      // Focused phase: tech-specific templates (for optimized mode)
      templates = this.getFocusedTemplates(detectedTechs);
      this.logger.log(`Focused phase for techs [${detectedTechs.join(', ')}] using templates: ${templates.join(', ')}`);
    } else if (scanPhase === 'full') {
      // Full phase: all templates (for full mode)
      templates = SCAN_MODE_TEMPLATES['full'];
      this.logger.log(`Full phase using all templates: ${templates.join(', ')}`);
    } else {
      // Single/default: use mode-based templates
      templates = SCAN_MODE_TEMPLATES[scanMode];
      this.logger.log(`Single phase using templates for ${scanMode} mode: ${templates.join(', ')}`);
    }

    // Add templates to args
    for (const template of templates) {
      args.push('-t', template);
    }

    // Only add severity filter for focused/full phases
    if (scanPhase === 'focused' || scanPhase === 'full') {
      args.push('-s', 'critical,high,medium');
    }

    // Add per-request timeout (30 seconds is reasonable for most web requests)
    const perRequestTimeout = Math.min(30, Math.floor(context.timeout / 1000));
    args.push('-timeout', String(perRequestTimeout));

    // Callback to emit template events
    const onTemplateEvent = context.config?.onTemplateEvent as ((event: { type: string; templateId?: string; status?: string; error?: string }) => void) | undefined;

    // Track loaded templates from -vv output
    const loadedTemplates: Set<string> = new Set();

    // Progress callback to parse nuclei stats output
    const onProgress = context.config?.onProgress as ((progress: ScanProgress) => void) | undefined;
    this.logger.log(`onProgress callback ${onProgress ? 'IS SET' : 'NOT SET'}`);

    // Log callback for real-time streaming
    const onLog = context.config?.onLog as ((line: string, stream: 'stdout' | 'stderr') => void) | undefined;
    this.logger.log(`onLog callback ${onLog ? 'IS SET' : 'NOT SET'}`);

    // Finding callback for real-time finding emission
    const onFinding = context.config?.onFinding as ((finding: NormalizedFinding) => void) | undefined;
    this.logger.log(`onFinding callback ${onFinding ? 'IS SET' : 'NOT SET'}`);

    // Collect findings during streaming for return in ScanOutput
    const streamedFindings: NormalizedFinding[] = [];

    // Track output line counts
    let stdoutLineCount = 0;

    // JSON stats go to stdout in nuclei -stats-json mode
    // JSONL findings also go to stdout with -jsonl flag
    const onStdout = (line: string) => {
      stdoutLineCount++;
      // Stream log line to frontend
      if (onLog) {
        onLog(line, 'stdout');
      }
      
      // Check if this is a JSON line
      if (!line.startsWith('{')) return;
      
      try {
        const json = JSON.parse(line);
        
        // Parse stats JSON line (from -stats-json)
        // Format: {"templates":"150","hosts":"1","requests":"2500","total":"4500","percent":"55","matched":"12","errors":"3"}
        if (json.templates !== undefined) {
          const stats: NucleiStatsJson = json;
          templateStats.totalTemplates = parseInt(stats.templates || '0', 10);
          templateStats.totalRequests = parseInt(stats.requests || '0', 10);
          templateStats.totalMatches = parseInt(stats.matched || '0', 10);
          templateStats.totalErrors = parseInt(stats.errors || '0', 10);

          const percent = parseInt(stats.percent || '0', 10);
          this.logger.log(`Nuclei progress: ${percent}% (${stats.requests}/${stats.total} requests, ${stats.matched} matched)`);

          // Always send progress updates, even at 0%
          if (onProgress) {
            onProgress({
              scanner: this.name,
              phase: scanPhase,
              current: parseInt(stats.requests || '0', 10),
              total: parseInt(stats.total || '0', 10),
              percent,
              templateStats: {
                loaded: templateStats.totalTemplates,
                completed: templateStats.completedTemplates,
                matched: templateStats.totalMatches,
                errors: templateStats.totalErrors,
              },
            });
          }
        }
        // Parse finding JSON line (from -jsonl)
        // Format: {"template-id":"...", "info": {...}, "matched": "...", ...}
        else if (json['template-id'] && json.info) {
          const result: NucleiJsonResult = json;
          const finding = this.convertResult(result);
          if (finding) {
            this.logger.log(`Real-time finding: ${finding.severity.toUpperCase()} - ${finding.title}`);
            streamedFindings.push(finding);
            if (onFinding) {
              onFinding(finding);
            }
          }
        }
      } catch {
        // Not valid JSON, ignore
      }
    };

    // Track stderr output for debugging
    let stderrLineCount = 0;

    // [INF], [ERR], [WRN] messages AND stats JSON go to stderr
    const onStderr = (line: string) => {
      stderrLineCount++;
      // Stream log line to frontend
      if (onLog) {
        onLog(line, 'stderr');
      }

      // DEBUG: Log every 10th line to see what's coming through
      if (stderrLineCount % 10 === 1) {
        this.logger.debug(`Stderr line ${stderrLineCount}: ${line.substring(0, 100)}`);
      }

      // Parse stats JSON line (from -stats-json) - nuclei outputs this to stderr
      // Format: {"templates":"150","hosts":"1","requests":"2500","total":"4500","percent":"55","matched":"12","errors":"3"}
      const isJsonStats = line.startsWith('{') && line.includes('"templates"');
      if (isJsonStats) {
        this.logger.log(`FOUND JSON stats line: ${line.substring(0, 80)}...`);
      }
      if (isJsonStats) {
        try {
          const stats: NucleiStatsJson = JSON.parse(line);
          templateStats.totalTemplates = parseInt(stats.templates || '0', 10);
          templateStats.totalRequests = parseInt(stats.requests || '0', 10);
          templateStats.totalMatches = parseInt(stats.matched || '0', 10);
          templateStats.totalErrors = parseInt(stats.errors || '0', 10);

          const percent = parseInt(stats.percent || '0', 10);
          this.logger.log(`Nuclei progress: ${percent}% (${stats.requests}/${stats.total} requests, ${stats.matched} matched)`);

          // Send progress updates
          if (onProgress) {
            onProgress({
              scanner: this.name,
              phase: scanPhase,
              current: parseInt(stats.requests || '0', 10),
              total: parseInt(stats.total || '0', 10),
              percent,
              templateStats: {
                loaded: templateStats.totalTemplates,
                completed: templateStats.completedTemplates,
                matched: templateStats.totalMatches,
                errors: templateStats.totalErrors,
              },
            });
          }
        } catch {
          // Not JSON stats - continue to other parsing
        }
      }

      // Fallback: Parse text stats line: [INF] [0:00:30] | Templates: 150 | Hosts: 1 | RPS: 148 | Matched: 3 | Errors: 0 | Requests: 2500/4500 (55%)
      const statsMatch = line.match(/Requests:\s*(\d+)\/(\d+)\s*\((\d+)%\)/);
      if (statsMatch && onProgress) {
        const [, current, total, percent] = statsMatch;
        onProgress({
          scanner: this.name,
          phase: scanPhase,
          current: parseInt(current, 10),
          total: parseInt(total, 10),
          percent: parseInt(percent, 10),
        });
      }

      // Parse template loading from -vv output
      // Format: [INF] [template-id] Loaded template: path/to/template.yaml
      const templateMatch = line.match(/\[([^\]]+)\]\s+Loaded\s+template/i);
      if (templateMatch) {
        const templateId = templateMatch[1];
        if (!loadedTemplates.has(templateId)) {
          loadedTemplates.add(templateId);
          templateStats.templates.push({
            templateId,
            status: 'running',
            matchCount: 0,
            errorCount: 0,
            requestCount: 0,
          });

          if (onTemplateEvent) {
            onTemplateEvent({ type: 'template:loaded', templateId });
          }
        }
      }

      // Parse template errors
      // Format: [ERR] [template-id] Could not run template: error message
      const errorMatch = line.match(/\[ERR\]\s+\[([^\]]+)\]\s+(.+)/i);
      if (errorMatch) {
        const [, templateId, errorMsg] = errorMatch;
        const template = templateStats.templates.find(t => t.templateId === templateId);
        if (template) {
          template.status = 'failed';
          template.errorCount++;
          template.errors = template.errors || [];
          template.errors.push(errorMsg);
          templateStats.failedTemplates++;
        }

        if (onTemplateEvent) {
          onTemplateEvent({ type: 'template:error', templateId, error: errorMsg });
        }
      }
    };

    // Emit initial progress event at scan start
    if (onProgress) {
      onProgress({
        scanner: this.name,
        phase: scanPhase,
        current: 0,
        total: 100,
        percent: 0,
      });
    }

    const result = await this.executor.execute({
      command: this.nucleiPath,
      args,
      cwd: context.workDir,
      timeout: context.timeout,
      onStdout,
      onStderr,
      scanId: context.scanId, // For process tracking/cancellation
    });

    // Log completion stats
    this.logger.log(`Nuclei scan completed (${stdoutLineCount} stdout, ${stderrLineCount} stderr lines)`);

    // Parse error log file for detailed template errors
    try {
      const errorLog = await fs.readFile(errorLogFile, 'utf-8');
      const errorLines = errorLog.split('\n').filter(Boolean);
      for (const line of errorLines) {
        // Parse error format: [ERR] [timestamp] [template-id] error message
        const match = line.match(/\[([^\]]+)\]\s+(.+)/);
        if (match) {
          const [, templateId, errorMsg] = match;
          const template = templateStats.templates.find(t => t.templateId === templateId);
          if (template && template.status !== 'failed') {
            template.status = 'failed';
            template.errors = template.errors || [];
            template.errors.push(errorMsg);
            templateStats.failedTemplates++;
          }
        }
      }
      this.logger.log(`Parsed ${errorLines.length} error log entries`);
    } catch {
      // Error log file might not exist if no errors
    }

    // Mark remaining templates as completed
    for (const template of templateStats.templates) {
      if (template.status === 'running') {
        template.status = 'completed';
        templateStats.completedTemplates++;
      }
    }

    // Check if output file was created
    try {
      await fs.access(outputFile);
      result.outputFile = outputFile;
    } catch {
      this.logger.warn('Nuclei output file not created');
    }

    // Return result with template stats and streamed findings
    this.logger.log(`Nuclei collected ${streamedFindings.length} findings during streaming`);
    return {
      ...result,
      templateStats,
      streamedFindings, // Pass findings collected during streaming
    };
  }

  /**
   * Retry scan with specific templates that failed in a previous scan
   */
  async retryFailedTemplates(
    context: ScanContext,
    failedTemplateIds: string[],
  ): Promise<ScanOutputWithTemplates> {
    if (failedTemplateIds.length === 0) {
      this.logger.warn('No failed templates to retry');
      return {
        scanner: this.name,
        exitCode: 0,
        stdout: 'No templates to retry',
        stderr: '',
        duration: 0,
        timedOut: false,
        templateStats: {
          totalTemplates: 0,
          completedTemplates: 0,
          failedTemplates: 0,
          skippedTemplates: 0,
          totalRequests: 0,
          totalMatches: 0,
          totalErrors: 0,
          templates: [],
        },
      };
    }

    this.logger.log(`Retrying ${failedTemplateIds.length} failed templates`);

    const outputFile = path.join(context.workDir, 'nuclei-retry-results.json');
    const errorLogFile = path.join(context.workDir, 'nuclei-retry-errors.log');

    // Get target URLs from config
    let targetUrls = context.config?.targetUrls as string[] || [];
    if (targetUrls.length === 0) {
      this.logger.warn('No target URLs configured for retry scan');
      return {
        scanner: this.name,
        exitCode: 0,
        stdout: 'No target URLs configured',
        stderr: '',
        duration: 0,
        timedOut: false,
      };
    }

    // Replace 'localhost' with '127.0.0.1'
    targetUrls = targetUrls.map(url => url.replace(/localhost/gi, '127.0.0.1'));
    const targetsFile = path.join(context.workDir, 'nuclei-retry-targets.txt');
    await fs.writeFile(targetsFile, targetUrls.join('\n'));

    // Get rate limit preset
    const rateLimitPreset = (context.config?.rateLimitPreset as RateLimitPreset) || 'medium';
    const rateLimitConfig = getRateLimitConfig('nuclei', rateLimitPreset);

    // Track retry template stats
    const templateStats: TemplateStats = {
      totalTemplates: failedTemplateIds.length,
      completedTemplates: 0,
      failedTemplates: 0,
      skippedTemplates: 0,
      totalRequests: 0,
      totalMatches: 0,
      totalErrors: 0,
      templates: failedTemplateIds.map(id => ({
        templateId: id,
        status: 'pending' as const,
        matchCount: 0,
        errorCount: 0,
        requestCount: 0,
      })),
    };

    const args = [
      '-l', targetsFile,
      '-json-export', outputFile,
      '-no-color',
      '-rate-limit', String(rateLimitConfig.rateLimit),
      '-bulk-size', String(rateLimitConfig.bulkSize),
      '-concurrency', String(rateLimitConfig.concurrency),
      '-stats',
      '-stats-json',
      '-stats-interval', '3',
      '-error-log', errorLogFile,
      '-retries', '3', // Increase retries for failed templates
      '-timeout', '60', // Increase timeout for retry
    ];

    // Add specific template IDs to retry
    for (const templateId of failedTemplateIds) {
      args.push('-id', templateId);
    }

    const onProgress = context.config?.onProgress as ((progress: ScanProgress) => void) | undefined;
    const onStderr = onProgress ? (line: string) => {
      // Parse stats
      if (line.startsWith('{') && line.includes('"templates"')) {
        try {
          const stats: NucleiStatsJson = JSON.parse(line);
          if (stats.percent) {
            onProgress({
              scanner: this.name,
              phase: 'retry',
              current: parseInt(stats.requests || '0', 10),
              total: parseInt(stats.total || '0', 10),
              percent: parseInt(stats.percent, 10),
            });
          }
        } catch {
          // Ignore parse errors
        }
      }
    } : undefined;

    const result = await this.executor.execute({
      command: this.nucleiPath,
      args,
      cwd: context.workDir,
      timeout: context.timeout,
      onStderr,
    });

    // Update template stats from retry
    for (const template of templateStats.templates) {
      if (result.exitCode === 0) {
        template.status = 'completed';
        templateStats.completedTemplates++;
      } else {
        template.status = 'failed';
        templateStats.failedTemplates++;
      }
    }

    // Check if output file was created
    try {
      await fs.access(outputFile);
      result.outputFile = outputFile;
    } catch {
      this.logger.warn('Nuclei retry output file not created');
    }

    return {
      ...result,
      templateStats,
    };
  }

  async parseOutput(output: ScanOutput): Promise<NormalizedFinding[]> {
    // Check for streamed findings first (from real-time JSONL parsing)
    const streamedFindings = (output as any).streamedFindings as NormalizedFinding[] | undefined;
    if (streamedFindings && streamedFindings.length > 0) {
      this.logger.log(`Returning ${streamedFindings.length} streamed Nuclei findings`);
      return streamedFindings;
    }

    // Fallback to file parsing if output file exists
    if (!output.outputFile) {
      this.logger.warn('No output file to parse and no streamed findings');
      return [];
    }

    try {
      const content = await fs.readFile(output.outputFile, 'utf-8');
      const findings: NormalizedFinding[] = [];

      // -json-export produces a JSON array, but may also produce JSONL in some cases
      let results: NucleiJsonResult[] = [];

      const trimmed = content.trim();
      if (trimmed.startsWith('[')) {
        // JSON array format from -json-export
        results = JSON.parse(trimmed);
      } else {
        // JSONL format (one JSON per line)
        const lines = trimmed.split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            results.push(JSON.parse(line));
          } catch (e) {
            this.logger.warn(`Failed to parse Nuclei result line: ${e}`);
          }
        }
      }

      for (const result of results) {
        try {
          const finding = this.convertResult(result);
          if (finding) {
            findings.push(finding);
          }
        } catch (e) {
          this.logger.warn(`Failed to convert Nuclei result: ${e}`);
        }
      }

      this.logger.log(`Parsed ${findings.length} Nuclei findings`);
      return findings;
    } catch (error) {
      this.logger.error(`Failed to parse Nuclei output: ${error}`);
      return [];
    }
  }

  private convertResult(result: NucleiJsonResult): NormalizedFinding | null {
    const severity = this.mapSeverity(result.info.severity);
    const confidence = this.mapConfidence(result.info.tags);

    // Generate a fingerprint based on template and target
    const fingerprint = this.generateFingerprint(
      result['template-id'],
      result.host,
      result.matched,
    );

    // Extract CWE/CVE IDs
    const cweIds = result.info.classification?.['cwe-id'] || [];
    const cveIds = result.info.classification?.['cve-id'] || [];

    return {
      scanner: this.name,
      ruleId: result['template-id'],
      severity,
      confidence,
      title: result.info.name,
      description: result.info.description || `Detected by template: ${result['template-id']}`,
      filePath: result.matched, // For DAST, filePath is the matched URL
      startLine: 0,
      cweIds,
      cveIds,
      owaspIds: this.extractOwaspIds(result.info.tags || []),
      references: result.info.reference || [],
      fingerprint,
      metadata: {
        host: result.host,
        templatePath: result['template-path'],
        type: result.type,
        matcherName: result['matcher-name'],
        curlCommand: result['curl-command'],
        timestamp: result.timestamp,
        extracted: result.extracted,
      },
    };
  }

  private mapSeverity(severity: string): Severity {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'info';
    }
  }

  private mapConfidence(tags?: string[]): Confidence {
    if (!tags) return 'medium';

    // Higher confidence for CVE-based templates
    if (tags.some(t => t.toLowerCase().startsWith('cve-'))) {
      return 'high';
    }

    return 'medium';
  }

  private extractOwaspIds(tags: string[]): string[] {
    const owaspPattern = /^(owasp-|a\d{2}:)/i;
    return tags
      .filter(tag => owaspPattern.test(tag))
      .map(tag => tag.toUpperCase());
  }

  private generateFingerprint(templateId: string, host: string, matched: string): string {
    const data = `${templateId}:${host}:${matched}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `nuclei-${Math.abs(hash).toString(16)}`;
  }
}
