import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IScanner, ScanContext, ScanOutput, NormalizedFinding, Severity, Confidence } from '../../interfaces';
import { LocalExecutorService } from '../../execution';

interface TruffleHogResult {
  SourceMetadata: {
    Data: {
      Filesystem?: {
        file: string;
        line?: number;
      };
    };
  };
  SourceID: number;
  SourceType: number;
  SourceName: string;
  DetectorType: number;
  DetectorName: string;
  DecoderName?: string;
  Verified: boolean;
  Raw: string;
  RawV2?: string;
  Redacted: string;
  ExtraData?: Record<string, string>;
  StructuredData?: Record<string, unknown>;
}

@Injectable()
export class TruffleHogScanner implements IScanner {
  readonly name = 'trufflehog';
  readonly version = '3.x';
  readonly supportedLanguages = ['*']; // Secrets can be in any file
  readonly outputFormat = 'json' as const;

  private readonly logger = new Logger(TruffleHogScanner.name);
  private readonly trufflehogPath: string;

  constructor(
    private readonly executor: LocalExecutorService,
    private readonly configService: ConfigService,
  ) {
    this.trufflehogPath = this.configService.get('TRUFFLEHOG_PATH', 'trufflehog');
  }

  async isAvailable(): Promise<boolean> {
    return this.executor.isCommandAvailable(this.trufflehogPath);
  }

  async getVersion(): Promise<string> {
    return this.executor.getCommandVersion(this.trufflehogPath, '--version');
  }

  async scan(context: ScanContext): Promise<ScanOutput> {
    const outputFile = path.join(context.workDir, 'trufflehog-results.json');

    const args = [
      'filesystem',
      context.workDir,
      '--json',
      '--no-update',
      '--concurrency', '5',
    ];

    // Add exclude paths
    for (const excludePath of context.excludePaths) {
      args.push('--exclude-paths', excludePath);
    }

    const result = await this.executor.execute({
      command: this.trufflehogPath,
      args,
      cwd: context.workDir,
      timeout: context.timeout,
    });

    // TruffleHog outputs to stdout in JSON lines format
    // Write stdout to file for consistent parsing
    if (result.stdout.trim()) {
      await fs.writeFile(outputFile, result.stdout, 'utf-8');
      result.outputFile = outputFile;
    }

    return result;
  }

  async parseOutput(output: ScanOutput): Promise<NormalizedFinding[]> {
    // TruffleHog outputs JSON lines to stdout
    const content = output.outputFile
      ? await fs.readFile(output.outputFile, 'utf-8')
      : output.stdout;

    if (!content.trim()) {
      return [];
    }

    const findings: NormalizedFinding[] = [];
    const lines = content.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const result: TruffleHogResult = JSON.parse(line);
        const finding = this.convertResult(result);
        if (finding) {
          findings.push(finding);
        }
      } catch (e) {
        this.logger.warn(`Failed to parse TruffleHog result line: ${e}`);
      }
    }

    this.logger.log(`Parsed ${findings.length} TruffleHog findings`);
    return findings;
  }

  private convertResult(result: TruffleHogResult): NormalizedFinding | null {
    const filePath = result.SourceMetadata?.Data?.Filesystem?.file || 'unknown';
    const line = result.SourceMetadata?.Data?.Filesystem?.line || 0;

    // Determine severity based on verification status
    const severity: Severity = result.Verified ? 'critical' : 'high';
    const confidence: Confidence = result.Verified ? 'high' : 'medium';

    const fingerprint = this.generateFingerprint(
      result.DetectorName,
      filePath,
      result.Redacted,
    );

    return {
      scanner: this.name,
      ruleId: `trufflehog-${result.DetectorName.toLowerCase().replace(/\s+/g, '-')}`,
      severity,
      confidence,
      title: `${result.Verified ? 'Verified ' : ''}${result.DetectorName} Secret Detected`,
      description: this.buildDescription(result),
      filePath,
      startLine: line,
      cweIds: ['CWE-798'], // Hard-coded credentials
      cveIds: [],
      owaspIds: ['A07:2021'], // Security Misconfiguration
      references: [
        'https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/',
        'https://cwe.mitre.org/data/definitions/798.html',
      ],
      fingerprint,
      metadata: {
        detectorName: result.DetectorName,
        verified: result.Verified,
        redacted: result.Redacted,
        sourceName: result.SourceName,
        decoderName: result.DecoderName,
        extraData: result.ExtraData,
      },
    };
  }

  private buildDescription(result: TruffleHogResult): string {
    let desc = `Detected a ${result.DetectorName} secret in the codebase.`;

    if (result.Verified) {
      desc += ' This secret has been VERIFIED as active and should be rotated immediately.';
    } else {
      desc += ' This secret appears to be a potential credential but has not been verified.';
    }

    desc += `\n\nRedacted value: ${result.Redacted}`;

    if (result.ExtraData) {
      const extraInfo = Object.entries(result.ExtraData)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      if (extraInfo) {
        desc += `\n\nAdditional info: ${extraInfo}`;
      }
    }

    return desc;
  }

  private generateFingerprint(detectorName: string, filePath: string, redacted: string): string {
    const data = `${detectorName}:${filePath}:${redacted}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `trufflehog-${Math.abs(hash).toString(16)}`;
  }
}
