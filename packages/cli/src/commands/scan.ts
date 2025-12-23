import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs';
import { ScanConfig, ScanSummary, ScanResult, Finding, Severity } from '../types';
import { runSastScan } from '../scanners/sast';
import { runScaScan } from '../scanners/sca';
import { runSecretsScan } from '../scanners/secrets';
import { runIacScan } from '../scanners/iac';
import { formatOutput, writeSarifOutput, writeJsonOutput } from '../utils/output';

export const scanCommand = new Command('scan')
  .description('Run security scan on a repository or directory')
  .option('-p, --path <path>', 'Path to scan (default: current directory)', '.')
  .option('-c, --config <file>', 'Path to configuration file')
  .option('--sast', 'Enable SAST scanning (Semgrep)', true)
  .option('--no-sast', 'Disable SAST scanning')
  .option('--sca', 'Enable SCA scanning (Trivy)', true)
  .option('--no-sca', 'Disable SCA scanning')
  .option('--secrets', 'Enable secrets scanning (Gitleaks)', true)
  .option('--no-secrets', 'Disable secrets scanning')
  .option('--iac', 'Enable IaC scanning (Checkov)', true)
  .option('--no-iac', 'Disable IaC scanning')
  .option('-o, --output <format>', 'Output format: json, sarif, text', 'text')
  .option('-f, --output-file <file>', 'Write output to file')
  .option('--fail-on <severity>', 'Fail if findings at or above severity: critical, high, medium, low')
  .option('--max-findings <n>', 'Fail if total findings exceed this number', parseInt)
  .option('--skip <paths>', 'Comma-separated paths to skip', '')
  .option('-v, --verbose', 'Verbose output')
  .option('-q, --quiet', 'Suppress non-essential output')
  .action(async (options) => {
    const startTime = new Date();

    // Load config
    const config = loadConfig(options);

    if (!config.quiet) {
      console.log(chalk.bold('\nThreatDiviner Security Scanner\n'));
      console.log(chalk.gray(`Scanning: ${path.resolve(config.targetPath)}`));
      console.log(chalk.gray(`Scanners: ${getEnabledScanners(config).join(', ')}\n`));
    }

    // Run scanners
    const results: ScanResult[] = [];
    const scanners = getEnabledScanners(config);

    for (const scanner of scanners) {
      const spinner = config.quiet ? null : ora(`Running ${scanner}...`).start();

      try {
        let result: ScanResult;

        switch (scanner) {
          case 'SAST':
            result = await runSastScan(config.targetPath, config.skipPaths);
            break;
          case 'SCA':
            result = await runScaScan(config.targetPath, config.skipPaths);
            break;
          case 'Secrets':
            result = await runSecretsScan(config.targetPath, config.skipPaths);
            break;
          case 'IaC':
            result = await runIacScan(config.targetPath, config.skipPaths);
            break;
          default:
            throw new Error(`Unknown scanner: ${scanner}`);
        }

        results.push(result);

        if (spinner) {
          if (result.success) {
            spinner.succeed(`${scanner}: ${result.findings.length} findings (${result.duration}ms)`);
          } else {
            spinner.fail(`${scanner}: ${result.error || 'Failed'}`);
          }
        }
      } catch (error) {
        if (spinner) {
          spinner.fail(`${scanner}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        results.push({
          scanner,
          success: false,
          duration: 0,
          findings: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Calculate summary
    const endTime = new Date();
    const allFindings = results.flatMap(r => r.findings);
    const summary: ScanSummary = {
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      repository: path.resolve(config.targetPath),
      scanners: scanners,
      results,
      totalFindings: allFindings.length,
      findingsBySeverity: {
        critical: allFindings.filter(f => f.severity === 'critical').length,
        high: allFindings.filter(f => f.severity === 'high').length,
        medium: allFindings.filter(f => f.severity === 'medium').length,
        low: allFindings.filter(f => f.severity === 'low').length,
        info: allFindings.filter(f => f.severity === 'info').length,
      },
    };

    // Output results
    if (config.outputFile) {
      if (config.outputFormat === 'sarif') {
        writeSarifOutput(summary, config.outputFile);
      } else if (config.outputFormat === 'json') {
        writeJsonOutput(summary, config.outputFile);
      } else {
        fs.writeFileSync(config.outputFile, formatOutput(summary, 'text'));
      }
      if (!config.quiet) {
        console.log(chalk.gray(`\nResults written to: ${config.outputFile}`));
      }
    } else if (!config.quiet || config.outputFormat !== 'text') {
      console.log(formatOutput(summary, config.outputFormat));
    }

    // Print summary
    if (!config.quiet) {
      console.log(chalk.bold('\nScan Summary'));
      console.log(chalk.gray(`Duration: ${summary.duration}ms`));
      console.log(chalk.gray(`Total findings: ${summary.totalFindings}`));
      console.log('');
      console.log(`  ${chalk.red('Critical:')} ${summary.findingsBySeverity.critical}`);
      console.log(`  ${chalk.magenta('High:')} ${summary.findingsBySeverity.high}`);
      console.log(`  ${chalk.yellow('Medium:')} ${summary.findingsBySeverity.medium}`);
      console.log(`  ${chalk.blue('Low:')} ${summary.findingsBySeverity.low}`);
      console.log(`  ${chalk.gray('Info:')} ${summary.findingsBySeverity.info}`);
      console.log('');
    }

    // Determine exit code
    const exitCode = determineExitCode(summary, config);

    if (exitCode === 0) {
      if (!config.quiet) {
        console.log(chalk.green('Scan completed successfully.'));
      }
    } else if (exitCode === 1) {
      if (!config.quiet) {
        console.log(chalk.red('Scan failed due to findings.'));
      }
    } else {
      if (!config.quiet) {
        console.log(chalk.red('Scan failed due to errors.'));
      }
    }

    process.exit(exitCode);
  });

function loadConfig(options: any): ScanConfig {
  let fileConfig: Partial<ScanConfig> = {};

  // Load from config file if specified
  if (options.config) {
    const configPath = path.resolve(options.config);
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(content);
    }
  } else {
    // Try to load default config files
    const defaultConfigs = ['.threatdiviner.json', 'threatdiviner.json', '.tdiv.json'];
    for (const configName of defaultConfigs) {
      const configPath = path.resolve(configName);
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        fileConfig = JSON.parse(content);
        break;
      }
    }
  }

  // Merge CLI options with file config (CLI takes precedence)
  return {
    enableSast: options.sast !== false && (fileConfig.enableSast ?? true),
    enableSca: options.sca !== false && (fileConfig.enableSca ?? true),
    enableSecrets: options.secrets !== false && (fileConfig.enableSecrets ?? true),
    enableIac: options.iac !== false && (fileConfig.enableIac ?? true),
    targetPath: options.path || fileConfig.targetPath || '.',
    skipPaths: options.skip ? options.skip.split(',') : (fileConfig.skipPaths || ['node_modules', 'vendor', '.git', 'dist', 'build']),
    outputFormat: options.output || fileConfig.outputFormat || 'text',
    outputFile: options.outputFile || fileConfig.outputFile,
    failOnSeverity: options.failOn || fileConfig.failOnSeverity,
    maxFindings: options.maxFindings ?? fileConfig.maxFindings,
    verbose: options.verbose || false,
    quiet: options.quiet || false,
  };
}

function getEnabledScanners(config: ScanConfig): string[] {
  const scanners: string[] = [];
  if (config.enableSast) scanners.push('SAST');
  if (config.enableSca) scanners.push('SCA');
  if (config.enableSecrets) scanners.push('Secrets');
  if (config.enableIac) scanners.push('IaC');
  return scanners;
}

function determineExitCode(summary: ScanSummary, config: ScanConfig): number {
  // Check for errors
  const hasErrors = summary.results.some(r => !r.success);
  if (hasErrors) return 2;

  // Check max findings
  if (config.maxFindings !== undefined && summary.totalFindings > config.maxFindings) {
    return 1;
  }

  // Check severity threshold
  if (config.failOnSeverity) {
    const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
    const thresholdIndex = severityOrder.indexOf(config.failOnSeverity);

    for (let i = 0; i <= thresholdIndex; i++) {
      if (summary.findingsBySeverity[severityOrder[i]] > 0) {
        return 1;
      }
    }
  }

  return 0;
}
