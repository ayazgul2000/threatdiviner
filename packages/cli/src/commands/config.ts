import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

export const configCommand = new Command('config')
  .description('Manage ThreatDiviner configuration');

configCommand
  .command('init')
  .description('Create a new configuration file')
  .option('-f, --force', 'Overwrite existing config file')
  .action((options) => {
    const configPath = path.resolve('.threatdiviner.json');

    if (fs.existsSync(configPath) && !options.force) {
      console.log(chalk.red('Configuration file already exists. Use --force to overwrite.'));
      process.exit(1);
    }

    const defaultConfig = {
      enableSast: true,
      enableSca: true,
      enableSecrets: true,
      enableIac: true,
      skipPaths: [
        'node_modules',
        'vendor',
        '.git',
        'dist',
        'build',
        'coverage',
        '__pycache__',
        '.next',
        '.nuxt'
      ],
      outputFormat: 'text',
      failOnSeverity: 'high',
    };

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(chalk.green(`Configuration file created: ${configPath}`));
    console.log(chalk.gray('\nEdit this file to customize your scan settings.'));
  });

configCommand
  .command('show')
  .description('Show current configuration')
  .action(() => {
    const configFiles = ['.threatdiviner.json', 'threatdiviner.json', '.tdiv.json'];
    let configPath: string | null = null;
    let config: any = null;

    for (const file of configFiles) {
      const fullPath = path.resolve(file);
      if (fs.existsSync(fullPath)) {
        configPath = fullPath;
        config = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        break;
      }
    }

    if (!config) {
      console.log(chalk.yellow('No configuration file found.'));
      console.log(chalk.gray('Run "tdiv config init" to create one.'));
      return;
    }

    console.log(chalk.bold('Current Configuration'));
    console.log(chalk.gray(`File: ${configPath}\n`));

    console.log(chalk.cyan('Scanners:'));
    console.log(`  SAST:    ${config.enableSast !== false ? chalk.green('enabled') : chalk.red('disabled')}`);
    console.log(`  SCA:     ${config.enableSca !== false ? chalk.green('enabled') : chalk.red('disabled')}`);
    console.log(`  Secrets: ${config.enableSecrets !== false ? chalk.green('enabled') : chalk.red('disabled')}`);
    console.log(`  IaC:     ${config.enableIac !== false ? chalk.green('enabled') : chalk.red('disabled')}`);

    if (config.skipPaths && config.skipPaths.length > 0) {
      console.log(chalk.cyan('\nSkip Paths:'));
      config.skipPaths.forEach((p: string) => {
        console.log(`  - ${p}`);
      });
    }

    if (config.failOnSeverity) {
      console.log(chalk.cyan('\nFail On:'));
      console.log(`  Severity: ${config.failOnSeverity}`);
    }

    if (config.maxFindings) {
      console.log(`  Max Findings: ${config.maxFindings}`);
    }

    console.log(chalk.cyan('\nOutput:'));
    console.log(`  Format: ${config.outputFormat || 'text'}`);
    if (config.outputFile) {
      console.log(`  File: ${config.outputFile}`);
    }
  });

configCommand
  .command('validate')
  .description('Validate configuration file')
  .option('-c, --config <file>', 'Path to configuration file')
  .action((options) => {
    let configPath = options.config;

    if (!configPath) {
      const configFiles = ['.threatdiviner.json', 'threatdiviner.json', '.tdiv.json'];
      for (const file of configFiles) {
        const fullPath = path.resolve(file);
        if (fs.existsSync(fullPath)) {
          configPath = fullPath;
          break;
        }
      }
    }

    if (!configPath || !fs.existsSync(configPath)) {
      console.log(chalk.red('No configuration file found.'));
      process.exit(1);
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);

      // Validate required fields and types
      const errors: string[] = [];
      const warnings: string[] = [];

      const booleanFields = ['enableSast', 'enableSca', 'enableSecrets', 'enableIac', 'verbose', 'quiet'];
      for (const field of booleanFields) {
        if (field in config && typeof config[field] !== 'boolean') {
          errors.push(`${field} must be a boolean`);
        }
      }

      if (config.skipPaths && !Array.isArray(config.skipPaths)) {
        errors.push('skipPaths must be an array of strings');
      }

      if (config.outputFormat && !['json', 'sarif', 'text'].includes(config.outputFormat)) {
        errors.push('outputFormat must be one of: json, sarif, text');
      }

      if (config.failOnSeverity && !['critical', 'high', 'medium', 'low', 'info'].includes(config.failOnSeverity)) {
        errors.push('failOnSeverity must be one of: critical, high, medium, low, info');
      }

      if (config.maxFindings !== undefined && (typeof config.maxFindings !== 'number' || config.maxFindings < 0)) {
        errors.push('maxFindings must be a non-negative number');
      }

      // Check for unknown fields
      const knownFields = [
        'enableSast', 'enableSca', 'enableSecrets', 'enableIac',
        'targetPath', 'skipPaths', 'outputFormat', 'outputFile',
        'failOnSeverity', 'maxFindings', 'verbose', 'quiet'
      ];
      for (const field of Object.keys(config)) {
        if (!knownFields.includes(field)) {
          warnings.push(`Unknown field: ${field}`);
        }
      }

      if (errors.length > 0) {
        console.log(chalk.red('Configuration validation failed:\n'));
        errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
        if (warnings.length > 0) {
          console.log(chalk.yellow('\nWarnings:'));
          warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
        }
        process.exit(1);
      }

      if (warnings.length > 0) {
        console.log(chalk.yellow('Configuration valid with warnings:\n'));
        warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
      } else {
        console.log(chalk.green('Configuration is valid.'));
      }

    } catch (error) {
      console.log(chalk.red(`Failed to parse configuration file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });
