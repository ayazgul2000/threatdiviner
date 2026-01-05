import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IScanner, ScanContext, ScanOutput, NormalizedFinding, Severity, Confidence } from '../../interfaces';
import { LocalExecutorService } from '../../execution';

export type DastScanMode = 'quick' | 'standard' | 'full';
export type ScanPhase = 'discovery' | 'deep' | 'single';

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

  async scan(context: ScanContext): Promise<ScanOutput> {
    const outputFile = path.join(context.workDir, 'nuclei-results.json');

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

    // Create targets file
    const targetsFile = path.join(context.workDir, 'nuclei-targets.txt');
    await fs.writeFile(targetsFile, targetUrls.join('\n'));

    // Get scan phase and mode from config
    const scanPhase = (context.config?.scanPhase as ScanPhase) || 'single';
    const scanMode = (context.config?.dastScanMode as DastScanMode) || 'standard';
    const detectedTechs = (context.config?.detectedTechnologies as string[]) || [];
    this.logger.log(`DAST scan phase: ${scanPhase}, mode: ${scanMode}`);

    const args = [
      '-l', targetsFile,
      '-json-export', outputFile,
      '-silent',
      '-no-color',
      '-rate-limit', '20',
      '-bulk-size', '25',
      '-concurrency', '10',
    ];

    // Determine templates based on phase
    let templates: string[] = [];

    if (this.templatesPath) {
      // Use custom templates path if configured
      args.push('-t', this.templatesPath);
    } else if (scanPhase === 'discovery') {
      // Discovery phase: fast tech detection
      templates = this.getDiscoveryTemplates();
      this.logger.log(`Discovery phase using templates: ${templates.join(', ')}`);
    } else if (scanPhase === 'deep' && detectedTechs.length > 0) {
      // Deep phase: focused on detected technologies
      templates = this.getFocusedTemplates(detectedTechs);
      this.logger.log(`Deep phase for techs [${detectedTechs.join(', ')}] using templates: ${templates.join(', ')}`);
    } else {
      // Single/default: use mode-based templates
      templates = SCAN_MODE_TEMPLATES[scanMode];
      this.logger.log(`Single phase using templates for ${scanMode} mode: ${templates.join(', ')}`);
    }

    // Add templates to args
    for (const template of templates) {
      args.push('-t', template);
    }

    // Only add severity filter for deep/full modes
    if (scanPhase === 'deep' || scanMode === 'full') {
      args.push('-s', 'critical,high,medium');
    }

    // Add timeout
    args.push('-timeout', String(Math.floor(context.timeout / 1000)));

    const result = await this.executor.execute({
      command: this.nucleiPath,
      args,
      cwd: context.workDir,
      timeout: context.timeout,
    });

    // Check if output file was created
    try {
      await fs.access(outputFile);
      result.outputFile = outputFile;
    } catch {
      this.logger.warn('Nuclei output file not created');
    }

    return result;
  }

  async parseOutput(output: ScanOutput): Promise<NormalizedFinding[]> {
    if (!output.outputFile) {
      this.logger.warn('No output file to parse');
      return [];
    }

    try {
      const content = await fs.readFile(output.outputFile, 'utf-8');
      const findings: NormalizedFinding[] = [];

      // Nuclei outputs JSONL format (one JSON per line)
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const result: NucleiJsonResult = JSON.parse(line);
          const finding = this.convertResult(result);
          if (finding) {
            findings.push(finding);
          }
        } catch (e) {
          this.logger.warn(`Failed to parse Nuclei result line: ${e}`);
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
