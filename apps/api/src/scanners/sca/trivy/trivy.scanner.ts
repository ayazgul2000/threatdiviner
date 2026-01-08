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
    const allFindings: ScanOutput[] = [];

    // Run filesystem scan for SCA
    const fsScanResult = await this.scanFilesystem(context);
    allFindings.push(fsScanResult);

    // Run container image scan if configured
    const containerImages = context.config?.containerImages as string[] | undefined;
    if (containerImages && containerImages.length > 0) {
      for (const image of containerImages) {
        const imageScanResult = await this.scanContainerImage(context, image);
        allFindings.push(imageScanResult);
      }
    }

    // Merge all scan results
    return this.mergeResults(allFindings, context.workDir);
  }

  private async scanFilesystem(context: ScanContext): Promise<ScanOutput> {
    const outputFile = path.join(context.workDir, 'trivy-fs-results.sarif');

    const args = [
      'fs',
      '--format', 'sarif',
      '--output', outputFile,
      '--scanners', 'vuln,secret,config',
      '--include-dev-deps',  // Include devDependencies for comprehensive scanning
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
      this.logger.warn('Trivy filesystem output file not created');
    }

    return result;
  }

  private async scanContainerImage(context: ScanContext, image: string): Promise<ScanOutput> {
    const safeImageName = image.replace(/[^a-zA-Z0-9-]/g, '_');
    const outputFile = path.join(context.workDir, `trivy-image-${safeImageName}.sarif`);

    this.logger.log(`Scanning container image: ${image}`);

    const args = [
      'image',
      '--format', 'sarif',
      '--output', outputFile,
      '--scanners', 'vuln,secret',
      '--timeout', `${Math.floor(context.timeout / 1000)}s`,
      image,
    ];

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
      this.logger.warn(`Trivy image scan output file not created for ${image}`);
    }

    return result;
  }

  private async mergeResults(results: ScanOutput[], workDir: string): Promise<ScanOutput> {
    const mergedOutputFile = path.join(workDir, 'trivy-results.sarif');
    const outputFiles: string[] = [];
    let totalDuration = 0;
    let hasError = false;

    for (const result of results) {
      totalDuration += result.duration;
      if (result.outputFile) {
        outputFiles.push(result.outputFile);
      }
      if (result.exitCode !== 0 && result.exitCode !== 1) {
        hasError = true;
      }
    }

    // If we have multiple output files, merge them into one
    if (outputFiles.length > 1) {
      await this.mergeSarifFiles(outputFiles, mergedOutputFile);
    } else if (outputFiles.length === 1) {
      // Just copy/rename the single file
      await fs.copyFile(outputFiles[0], mergedOutputFile);
    }

    return {
      scanner: this.name,
      exitCode: hasError ? -1 : 0,
      stdout: '',
      stderr: '',
      outputFile: outputFiles.length > 0 ? mergedOutputFile : undefined,
      duration: totalDuration,
      timedOut: results.some(r => r.timedOut),
    };
  }

  private async mergeSarifFiles(inputFiles: string[], outputFile: string): Promise<void> {
    const mergedRuns: unknown[] = [];

    for (const file of inputFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const sarif = JSON.parse(content);
        if (sarif.runs && Array.isArray(sarif.runs)) {
          mergedRuns.push(...sarif.runs);
        }
      } catch (e) {
        this.logger.warn(`Failed to read SARIF file ${file}: ${e}`);
      }
    }

    const mergedSarif = {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: mergedRuns,
    };

    await fs.writeFile(outputFile, JSON.stringify(mergedSarif, null, 2), 'utf-8');
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
