import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IScanner, ScanContext, ScanOutput, NormalizedFinding } from '../../interfaces';
import { LocalExecutorService } from '../../execution';
import { SarifParser } from '../../parsers/sarif.parser';

@Injectable()
export class CheckovScanner implements IScanner {
  readonly name = 'checkov';
  readonly version = '3.x';
  readonly supportedLanguages = [
    'terraform',
    'cloudformation',
    'kubernetes',
    'dockerfile',
    'arm',
    'helm',
    'bicep',
    'ansible',
  ];
  readonly outputFormat = 'sarif' as const;

  private readonly logger = new Logger(CheckovScanner.name);
  private readonly checkovPath: string;

  constructor(
    private readonly executor: LocalExecutorService,
    private readonly sarifParser: SarifParser,
    private readonly configService: ConfigService,
  ) {
    this.checkovPath = this.configService.get('CHECKOV_PATH', 'checkov');
  }

  async isAvailable(): Promise<boolean> {
    return this.executor.isCommandAvailable(this.checkovPath);
  }

  async getVersion(): Promise<string> {
    return this.executor.getCommandVersion(this.checkovPath, '--version');
  }

  async scan(context: ScanContext): Promise<ScanOutput> {
    const outputFile = path.join(context.workDir, 'checkov-results.sarif');

    const args = [
      '-d', context.workDir,
      '--output', 'sarif',
      '--output-file-path', context.workDir,
      '--soft-fail', // Don't exit with error code on findings
      '--compact', // Reduce output verbosity
      '--quiet', // Less verbose logging
    ];

    // Add specific framework checks based on detected IaC types
    // Checkov auto-detects, but we can be explicit for performance
    const frameworks: string[] = [];
    if (context.config?.hasTerraform) frameworks.push('terraform');
    if (context.config?.hasDockerfile) frameworks.push('dockerfile');
    if (context.config?.hasKubernetes) frameworks.push('kubernetes');
    if (context.config?.hasCloudFormation) frameworks.push('cloudformation');

    if (frameworks.length > 0) {
      args.push('--framework', frameworks.join(','));
    }

    // Add exclude paths
    for (const excludePath of context.excludePaths) {
      args.push('--skip-path', excludePath);
    }

    const result = await this.executor.execute({
      command: this.checkovPath,
      args,
      cwd: context.workDir,
      timeout: context.timeout,
      env: {
        LOG_LEVEL: 'WARNING',
      },
    });

    // Checkov outputs to results_sarif.sarif in the output directory
    const actualOutputFile = path.join(context.workDir, 'results_sarif.sarif');

    // Check if output file was created
    try {
      await fs.access(actualOutputFile);
      result.outputFile = actualOutputFile;
    } catch {
      // Try the specified output file path
      try {
        await fs.access(outputFile);
        result.outputFile = outputFile;
      } catch {
        this.logger.warn('Checkov output file not created');
      }
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
      this.logger.error(`Failed to parse Checkov output: ${error}`);
      return [];
    }
  }
}
