import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
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
  private readonly customRulesPath: string;
  private readonly registryRulesPath: string;

  constructor(
    private readonly executor: LocalExecutorService,
    private readonly sarifParser: SarifParser,
    private readonly configService: ConfigService,
  ) {
    this.semgrepPath = this.configService.get('SEMGREP_PATH', 'semgrep');
    // Use local rules on Windows to avoid charmap encoding issues with registry rules
    this.useLocalRules = process.platform === 'win32' ||
      this.configService.get('SEMGREP_USE_LOCAL_RULES', 'true') === 'true';

    // Rules are stored in src/ folder, not dist/
    // Calculate path relative to project root (apps/api)
    const projectRoot = this.findProjectRoot(__dirname);
    const rulesBaseDir = path.join(projectRoot, 'src', 'scanners', 'sast', 'semgrep', 'rules');

    // Path for custom rules
    this.customRulesPath = this.configService.get(
      'SEMGREP_CUSTOM_RULES_PATH',
      path.join(rulesBaseDir, 'custom'),
    );
    // Path for synced registry rules
    this.registryRulesPath = this.configService.get(
      'SEMGREP_REGISTRY_RULES_PATH',
      path.join(rulesBaseDir, 'registry'),
    );

    this.logger.log(`Custom rules path: ${this.customRulesPath}`);
    this.logger.log(`Registry rules path: ${this.registryRulesPath}`);
  }

  /**
   * Find the project root by looking for package.json
   */
  private findProjectRoot(startDir: string): string {
    let dir = startDir;
    while (dir !== path.dirname(dir)) {
      if (fsSync.existsSync(path.join(dir, 'package.json'))) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    // Fallback: assume we're in dist/scanners/sast/semgrep or src/scanners/sast/semgrep
    return path.resolve(startDir, '..', '..', '..', '..');
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

    // Determine which rule sources to use
    if (this.useLocalRules) {
      const ruleSources = this.getLocalRuleSources();

      if (ruleSources.length > 0) {
        this.logger.log(`Using ${ruleSources.length} local rule sources`);
        for (const ruleSource of ruleSources) {
          args.push('--config', ruleSource);
        }
      } else {
        // Fallback to registry if no local rules found
        this.logger.warn('No local rules found, falling back to registry');
        args.push('--config', 'auto');
        args.push('--config', 'p/security-audit');
      }
    } else {
      // Fetch directly from Semgrep registry (online)
      args.push('--config', 'auto');
      args.push('--config', 'p/security-audit');
      args.push('--config', 'p/owasp-top-ten');
      args.push('--config', 'p/cwe-top-25');
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

  /**
   * Get all local rule sources (custom + synced registry)
   */
  private getLocalRuleSources(): string[] {
    const sources: string[] = [];

    // Add custom rules directory if it exists
    if (fsSync.existsSync(this.customRulesPath)) {
      sources.push(this.customRulesPath);
      this.logger.debug(`Added custom rules from: ${this.customRulesPath}`);
    }

    // Add synced registry rules directory if it exists
    if (fsSync.existsSync(this.registryRulesPath)) {
      // Add each pack directory separately for better organization
      const packs = fsSync.readdirSync(this.registryRulesPath, { withFileTypes: true });
      for (const pack of packs) {
        if (pack.isDirectory()) {
          const packPath = path.join(this.registryRulesPath, pack.name);
          sources.push(packPath);
          this.logger.debug(`Added registry pack: ${pack.name}`);
        }
      }
    }

    // Fallback: check for old-style single security.yaml
    const legacyPath = path.resolve(__dirname, 'rules', 'security.yaml');
    if (sources.length === 0 && fsSync.existsSync(legacyPath)) {
      sources.push(legacyPath);
      this.logger.debug(`Added legacy rules: ${legacyPath}`);
    }

    return sources;
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
