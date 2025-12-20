import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { IScanner, ScanContext, ScanOutput, NormalizedFinding, Severity, Confidence } from '../../interfaces';
import { LocalExecutorService } from '../../execution';

// Bandit JSON output types
interface BanditReport {
  results: BanditResult[];
  metrics: {
    _totals: Record<string, number>;
  };
}

interface BanditResult {
  code: string;
  col_offset: number;
  end_col_offset?: number;
  filename: string;
  issue_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  issue_severity: 'HIGH' | 'MEDIUM' | 'LOW';
  issue_cwe?: {
    id: number;
    link: string;
  };
  issue_text: string;
  line_number: number;
  line_range: number[];
  more_info: string;
  test_id: string;
  test_name: string;
}

@Injectable()
export class BanditScanner implements IScanner {
  readonly name = 'bandit';
  readonly version = '1.x';
  readonly supportedLanguages = ['python'];
  readonly outputFormat = 'json' as const;

  private readonly logger = new Logger(BanditScanner.name);
  private readonly banditPath: string;

  constructor(
    private readonly executor: LocalExecutorService,
    private readonly configService: ConfigService,
  ) {
    this.banditPath = this.configService.get('BANDIT_PATH', 'bandit');
  }

  async isAvailable(): Promise<boolean> {
    return this.executor.isCommandAvailable(this.banditPath);
  }

  async getVersion(): Promise<string> {
    return this.executor.getCommandVersion(this.banditPath, '--version');
  }

  async scan(context: ScanContext): Promise<ScanOutput> {
    const outputFile = path.join(context.workDir, 'bandit-results.json');

    const args = [
      '-r', context.workDir,  // Recursive scan
      '-f', 'json',           // JSON output format
      '-o', outputFile,       // Output file
      '-ll',                  // Log level: only show issues
    ];

    // Add exclude paths
    for (const excludePath of context.excludePaths) {
      args.push('--exclude', excludePath);
    }

    const result = await this.executor.execute({
      command: this.banditPath,
      args,
      cwd: context.workDir,
      timeout: context.timeout,
    });

    // Bandit returns exit code 1 when issues are found
    // Check if output file was created
    try {
      await fs.access(outputFile);
      result.outputFile = outputFile;
    } catch {
      this.logger.warn('Bandit output file not created');
    }

    return result;
  }

  async parseOutput(output: ScanOutput): Promise<NormalizedFinding[]> {
    if (!output.outputFile) {
      this.logger.warn('No output file to parse');
      return [];
    }

    try {
      const jsonContent = await fs.readFile(output.outputFile, 'utf-8');
      const report: BanditReport = JSON.parse(jsonContent);

      return report.results.map(result => this.convertResult(result));
    } catch (error) {
      this.logger.error(`Failed to parse Bandit output: ${error}`);
      return [];
    }
  }

  private convertResult(result: BanditResult): NormalizedFinding {
    const fingerprint = this.generateFingerprint(
      result.test_id,
      result.filename,
      result.line_number,
      result.code,
    );

    return {
      scanner: this.name,
      ruleId: result.test_id,
      severity: this.mapSeverity(result.issue_severity),
      confidence: this.mapConfidence(result.issue_confidence),
      title: result.test_name,
      description: result.issue_text,
      filePath: result.filename,
      startLine: result.line_number,
      endLine: result.line_range?.length > 1 ? result.line_range[result.line_range.length - 1] : undefined,
      startColumn: result.col_offset,
      endColumn: result.end_col_offset,
      snippet: result.code,
      cweIds: result.issue_cwe ? [`CWE-${result.issue_cwe.id}`] : [],
      cveIds: [],
      owaspIds: [],
      references: result.more_info ? [result.more_info] : [],
      fingerprint,
      metadata: {
        testId: result.test_id,
        testName: result.test_name,
      },
    };
  }

  private mapSeverity(severity: string): Severity {
    switch (severity) {
      case 'HIGH':
        return 'high';
      case 'MEDIUM':
        return 'medium';
      case 'LOW':
        return 'low';
      default:
        return 'info';
    }
  }

  private mapConfidence(confidence: string): Confidence {
    switch (confidence) {
      case 'HIGH':
        return 'high';
      case 'MEDIUM':
        return 'medium';
      case 'LOW':
        return 'low';
      default:
        return 'low';
    }
  }

  private generateFingerprint(
    ruleId: string,
    filePath: string,
    startLine: number,
    snippet?: string,
  ): string {
    const data = [
      ruleId,
      filePath,
      startLine.toString(),
      snippet ? snippet.replace(/\s+/g, ' ').trim() : '',
    ].join('|');

    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 32);
  }
}
