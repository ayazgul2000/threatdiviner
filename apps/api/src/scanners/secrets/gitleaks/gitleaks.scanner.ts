import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IScanner, ScanContext, ScanOutput, NormalizedFinding, Severity, Confidence } from '../../interfaces';
import { LocalExecutorService } from '../../execution';

interface GitleaksResult {
  Description: string;
  StartLine: number;
  EndLine: number;
  StartColumn: number;
  EndColumn: number;
  Match: string;
  Secret: string;
  File: string;
  SymlinkFile?: string;
  Commit: string;
  Entropy: number;
  Author: string;
  Email: string;
  Date: string;
  Message: string;
  Tags: string[];
  RuleID: string;
  Fingerprint: string;
}

@Injectable()
export class GitleaksScanner implements IScanner {
  readonly name = 'gitleaks';
  readonly version = '8.x';
  readonly supportedLanguages = ['*']; // Secrets can be in any file
  readonly outputFormat = 'json' as const;

  private readonly logger = new Logger(GitleaksScanner.name);
  private readonly gitleaksPath: string;

  constructor(
    private readonly executor: LocalExecutorService,
    private readonly configService: ConfigService,
  ) {
    this.gitleaksPath = this.configService.get('GITLEAKS_PATH', 'gitleaks');
  }

  async isAvailable(): Promise<boolean> {
    return this.executor.isCommandAvailable(this.gitleaksPath);
  }

  async getVersion(): Promise<string> {
    return this.executor.getCommandVersion(this.gitleaksPath, 'version');
  }

  async scan(context: ScanContext): Promise<ScanOutput> {
    const outputFile = path.join(context.workDir, 'gitleaks-results.json');

    // Create .gitleaksignore to exclude scanner output files
    const ignoreFile = path.join(context.workDir, '.gitleaksignore');
    await fs.writeFile(ignoreFile, [
      '# Ignore scanner output files',
      '*-results.json',
      '*-results.sarif',
      '.gitleaksignore',
    ].join('\n'));

    const args = [
      'detect',
      '--source', context.workDir,
      '--report-format', 'json',
      '--report-path', outputFile,
      '--no-git',
      '--gitleaks-ignore-path', ignoreFile,
    ];

    // Add verbose for more details
    if (this.configService.get('GITLEAKS_VERBOSE', 'false') === 'true') {
      args.push('--verbose');
    }

    const result = await this.executor.execute({
      command: this.gitleaksPath,
      args,
      cwd: context.workDir,
      timeout: context.timeout,
    });

    // Gitleaks returns exit code 1 when secrets are found
    // This is not an error condition for us
    result.outputFile = outputFile;

    return result;
  }

  async parseOutput(output: ScanOutput): Promise<NormalizedFinding[]> {
    if (!output.outputFile) {
      return [];
    }

    let content: string;
    try {
      content = await fs.readFile(output.outputFile, 'utf-8');
    } catch (e) {
      this.logger.warn(`Failed to read gitleaks output file: ${e}`);
      return [];
    }

    if (!content.trim()) {
      return [];
    }

    const findings: NormalizedFinding[] = [];

    try {
      const results: GitleaksResult[] = JSON.parse(content);

      for (const result of results) {
        const finding = this.convertResult(result);
        if (finding) {
          findings.push(finding);
        }
      }
    } catch (e) {
      this.logger.warn(`Failed to parse gitleaks output: ${e}`);
    }

    this.logger.log(`Parsed ${findings.length} gitleaks findings`);
    return findings;
  }

  private convertResult(result: GitleaksResult): NormalizedFinding | null {
    const severity: Severity = this.determineSeverity(result);
    const confidence: Confidence = this.determineConfidence(result);

    return {
      scanner: this.name,
      ruleId: `gitleaks-${result.RuleID}`,
      severity,
      confidence,
      title: `${result.Description}`,
      description: this.buildDescription(result),
      filePath: result.File,
      startLine: result.StartLine,
      endLine: result.EndLine,
      startColumn: result.StartColumn,
      endColumn: result.EndColumn,
      cweIds: ['CWE-798'], // Hard-coded credentials
      cveIds: [],
      owaspIds: ['A07:2021'], // Security Misconfiguration
      capecIds: ['CAPEC-191'], // Read Sensitive Strings Within an Executable
      attackIds: ['T1552'], // Unsecured Credentials
      references: [
        'https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/',
        'https://cwe.mitre.org/data/definitions/798.html',
      ],
      fingerprint: result.Fingerprint || this.generateFingerprint(result),
      metadata: {
        ruleId: result.RuleID,
        entropy: result.Entropy,
        author: result.Author,
        email: result.Email,
        date: result.Date,
        commit: result.Commit,
        tags: result.Tags,
      },
    };
  }

  private determineSeverity(result: GitleaksResult): Severity {
    // High entropy secrets are more likely to be real
    if (result.Entropy > 4.5) {
      return 'critical';
    }

    // Check for high-risk patterns
    const highRiskPatterns = ['aws', 'private', 'api_key', 'secret', 'password', 'token'];
    const ruleIdLower = result.RuleID.toLowerCase();

    for (const pattern of highRiskPatterns) {
      if (ruleIdLower.includes(pattern)) {
        return 'high';
      }
    }

    return 'medium';
  }

  private determineConfidence(result: GitleaksResult): Confidence {
    // High entropy typically means higher confidence
    if (result.Entropy > 5.0) {
      return 'high';
    }
    if (result.Entropy > 3.5) {
      return 'medium';
    }
    return 'low';
  }

  private buildDescription(result: GitleaksResult): string {
    let desc = `Detected a potential secret: ${result.Description}`;

    if (result.Entropy) {
      desc += `\n\nEntropy: ${result.Entropy.toFixed(2)} (higher values indicate more randomness)`;
    }

    if (result.Author && result.Date) {
      desc += `\n\nIntroduced by: ${result.Author} on ${result.Date}`;
    }

    if (result.Message) {
      desc += `\n\nCommit message: ${result.Message}`;
    }

    if (result.Tags && result.Tags.length > 0) {
      desc += `\n\nTags: ${result.Tags.join(', ')}`;
    }

    return desc;
  }

  private generateFingerprint(result: GitleaksResult): string {
    const data = `${result.RuleID}:${result.File}:${result.StartLine}:${result.Secret?.slice(0, 10)}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `gitleaks-${Math.abs(hash).toString(16)}`;
  }
}
