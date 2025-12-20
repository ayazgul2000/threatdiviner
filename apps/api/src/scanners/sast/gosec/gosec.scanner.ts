import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IScanner, ScanContext, ScanOutput, NormalizedFinding } from '../../interfaces';
import { LocalExecutorService } from '../../execution';
import { SarifParser } from '../../parsers/sarif.parser';

@Injectable()
export class GosecScanner implements IScanner {
  readonly name = 'gosec';
  readonly version = '2.x';
  readonly supportedLanguages = ['go'];
  readonly outputFormat = 'sarif' as const;

  private readonly logger = new Logger(GosecScanner.name);
  private readonly gosecPath: string;

  constructor(
    private readonly executor: LocalExecutorService,
    private readonly sarifParser: SarifParser,
    private readonly configService: ConfigService,
  ) {
    this.gosecPath = this.configService.get('GOSEC_PATH', 'gosec');
  }

  async isAvailable(): Promise<boolean> {
    return this.executor.isCommandAvailable(this.gosecPath);
  }

  async getVersion(): Promise<string> {
    return this.executor.getCommandVersion(this.gosecPath, '-version');
  }

  async scan(context: ScanContext): Promise<ScanOutput> {
    const outputFile = path.join(context.workDir, 'gosec-results.sarif');

    const args = [
      '-fmt=sarif',
      `-out=${outputFile}`,
      '-quiet',
      './...',  // Scan all Go packages
    ];

    // Add exclude dirs
    if (context.excludePaths.length > 0) {
      args.push(`-exclude-dir=${context.excludePaths.join(',')}`);
    }

    const result = await this.executor.execute({
      command: this.gosecPath,
      args,
      cwd: context.workDir,
      timeout: context.timeout,
    });

    // Gosec returns exit code 1 when issues are found
    // Check if output file was created
    try {
      await fs.access(outputFile);
      result.outputFile = outputFile;
    } catch {
      this.logger.warn('Gosec output file not created');
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
      this.logger.error(`Failed to parse Gosec output: ${error}`);
      return [];
    }
  }
}
