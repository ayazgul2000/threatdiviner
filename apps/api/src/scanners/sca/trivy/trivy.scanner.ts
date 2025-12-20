import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IScanner, ScanContext, ScanOutput, NormalizedFinding } from '../../interfaces';
import { LocalExecutorService } from '../../execution';
import { SarifParser } from '../../parsers/sarif.parser';

@Injectable()
export class TrivyScanner implements IScanner {
  readonly name = 'trivy';
  readonly version = '0.x';
  readonly supportedLanguages = ['*']; // Trivy scans dependency files in any language
  readonly outputFormat = 'sarif' as const;

  private readonly logger = new Logger(TrivyScanner.name);
  private readonly trivyPath: string;

  constructor(
    private readonly executor: LocalExecutorService,
    private readonly sarifParser: SarifParser,
    private readonly configService: ConfigService,
  ) {
    this.trivyPath = this.configService.get('TRIVY_PATH', 'trivy');
  }

  async isAvailable(): Promise<boolean> {
    return this.executor.isCommandAvailable(this.trivyPath);
  }

  async getVersion(): Promise<string> {
    return this.executor.getCommandVersion(this.trivyPath, '--version');
  }

  async scan(context: ScanContext): Promise<ScanOutput> {
    const outputFile = path.join(context.workDir, 'trivy-results.sarif');

    const args = [
      'fs',
      '--format', 'sarif',
      '--output', outputFile,
      '--scanners', 'vuln',  // Only scan for vulnerabilities in dependencies
      '--skip-dirs', '.git',
      context.workDir,
    ];

    // Add exclude paths
    for (const excludePath of context.excludePaths) {
      args.push('--skip-dirs', excludePath);
    }

    const result = await this.executor.execute({
      command: this.trivyPath,
      args,
      cwd: context.workDir,
      timeout: context.timeout,
      env: {
        TRIVY_NO_PROGRESS: 'true',
      },
    });

    // Check if output file was created
    try {
      await fs.access(outputFile);
      result.outputFile = outputFile;
    } catch {
      this.logger.warn('Trivy output file not created');
    }

    return result;
  }

  async parseOutput(output: ScanOutput): Promise<NormalizedFinding[]> {
    if (!output.outputFile) {
      this.logger.warn('No output file to parse');
      return [];
    }

    try {
      const sarifContent = await fs.readFile(output.outputFile, 'utf-8');
      return this.sarifParser.parse(sarifContent, this.name);
    } catch (error) {
      this.logger.error(`Failed to parse Trivy output: ${error}`);
      return [];
    }
  }
}
