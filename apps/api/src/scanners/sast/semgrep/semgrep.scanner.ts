import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IScanner, ScanContext, ScanOutput, NormalizedFinding } from '../../interfaces';
import { LocalExecutorService } from '../../execution';
import { SarifParser } from '../../parsers/sarif.parser';

@Injectable()
export class SemgrepScanner implements IScanner {
  readonly name = 'semgrep';
  readonly version = '1.x';
  readonly supportedLanguages = [
    'javascript',
    'typescript',
    'python',
    'go',
    'java',
    'ruby',
    'php',
    'csharp',
    'rust',
    'kotlin',
    'swift',
    'c',
    'cpp',
  ];
  readonly outputFormat = 'sarif' as const;

  private readonly logger = new Logger(SemgrepScanner.name);
  private readonly semgrepPath: string;
  private readonly useLocalRules: boolean;
  private readonly localRulesPath: string;

  constructor(
    private readonly executor: LocalExecutorService,
    private readonly sarifParser: SarifParser,
    private readonly configService: ConfigService,
  ) {
    this.semgrepPath = this.configService.get('SEMGREP_PATH', 'semgrep');
    // Use local rules on Windows to avoid charmap encoding issues with registry rules
    this.useLocalRules = process.platform === 'win32' ||
      this.configService.get('SEMGREP_USE_LOCAL_RULES', 'false') === 'true';
    // Default path for local rules - can be overridden via env var
    this.localRulesPath = this.configService.get(
      'SEMGREP_LOCAL_RULES_PATH',
      path.resolve(process.cwd(), 'src', 'scanners', 'sast', 'semgrep', 'rules', 'security.yaml'),
    );
  }

  async isAvailable(): Promise<boolean> {
    return this.executor.isCommandAvailable(this.semgrepPath);
  }

  async getVersion(): Promise<string> {
    return this.executor.getCommandVersion(this.semgrepPath, '--version');
  }

  async scan(context: ScanContext): Promise<ScanOutput> {
    const outputFile = path.join(context.workDir, 'semgrep-results.sarif');

    const args = ['scan'];

    // Use local rules on Windows to avoid charmap encoding issues
    if (this.useLocalRules) {
      this.logger.log('Using local security rules');
      args.push('--config', this.localRulesPath);
    } else {
      args.push('--config', 'auto');
      args.push('--config', 'p/security-audit');
      args.push('--config', 'p/owasp-top-ten');
    }

    args.push(
      '--sarif',
      '--output', outputFile,
      '--timeout', String(Math.floor(context.timeout / 1000)),
      '--max-memory', '4096',
      '--jobs', '4',
      '--quiet',
      '--no-git-ignore', // Workaround for Windows git ls-files issue
    );

    // Add exclude paths
    for (const excludePath of context.excludePaths) {
      args.push('--exclude', excludePath);
    }

    // Add target paths or scan whole directory
    if (context.targetPaths && context.targetPaths.length > 0) {
      args.push(...context.targetPaths);
    } else {
      args.push(context.workDir);
    }

    const result = await this.executor.execute({
      command: this.semgrepPath,
      args,
      cwd: context.workDir,
      timeout: context.timeout,
      env: {
        SEMGREP_SEND_METRICS: 'off',
      },
    });

    // Check if output file was created
    try {
      await fs.access(outputFile);
      result.outputFile = outputFile;
    } catch {
      this.logger.warn('Semgrep output file not created');
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
      this.logger.error(`Failed to parse Semgrep output: ${error}`);
      return [];
    }
  }
}
