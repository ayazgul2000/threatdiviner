import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IScanner, ScanContext, ScanOutput, NormalizedFinding, Severity, Confidence } from '../../interfaces';
import { LocalExecutorService } from '../../execution';

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

  async scan(context: ScanContext): Promise<ScanOutput> {
    const outputFile = path.join(context.workDir, 'nuclei-results.json');

    // Get target URLs from config
    const targetUrls = context.config?.targetUrls as string[] || [];
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

    // Create targets file
    const targetsFile = path.join(context.workDir, 'nuclei-targets.txt');
    await fs.writeFile(targetsFile, targetUrls.join('\n'));

    const args = [
      '-l', targetsFile,
      '-json-export', outputFile,
      '-silent',
      '-no-color',
      '-rate-limit', '50', // Rate limit to avoid overwhelming targets
      '-bulk-size', '25',
      '-concurrency', '10',
    ];

    // Add custom templates path if configured
    if (this.templatesPath) {
      args.push('-t', this.templatesPath);
    } else {
      // Use default security templates
      args.push('-t', 'http/cves');
      args.push('-t', 'http/vulnerabilities');
      args.push('-t', 'http/exposures');
      args.push('-t', 'http/misconfiguration');
    }

    // Severity filter
    args.push('-s', 'critical,high,medium');

    // Add timeout
    args.push('-timeout', String(Math.floor(context.timeout / 1000 / 60)) + 'm');

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
