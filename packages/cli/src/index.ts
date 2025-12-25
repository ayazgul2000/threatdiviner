#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { scanCommand } from './commands/scan';
import { configCommand } from './commands/config';
import { uploadCommand } from './commands/upload';
import { baselineCommand } from './commands/baseline';

const program = new Command();

// ASCII art banner
const banner = `
${chalk.blue('████████╗██╗  ██╗██████╗ ███████╗ █████╗ ████████╗')}
${chalk.blue('╚══██╔══╝██║  ██║██╔══██╗██╔════╝██╔══██╗╚══██╔══╝')}
${chalk.blue('   ██║   ███████║██████╔╝█████╗  ███████║   ██║   ')}
${chalk.blue('   ██║   ██╔══██║██╔══██╗██╔══╝  ██╔══██║   ██║   ')}
${chalk.blue('   ██║   ██║  ██║██║  ██║███████╗██║  ██║   ██║   ')}
${chalk.blue('   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ')}
${chalk.cyan('          ██████╗ ██╗██╗   ██╗██╗███╗   ██╗███████╗██████╗ ')}
${chalk.cyan('          ██╔══██╗██║██║   ██║██║████╗  ██║██╔════╝██╔══██╗')}
${chalk.cyan('          ██║  ██║██║██║   ██║██║██╔██╗ ██║█████╗  ██████╔╝')}
${chalk.cyan('          ██║  ██║██║╚██╗ ██╔╝██║██║╚██╗██║██╔══╝  ██╔══██╗')}
${chalk.cyan('          ██████╔╝██║ ╚████╔╝ ██║██║ ╚████║███████╗██║  ██║')}
${chalk.cyan('          ╚═════╝ ╚═╝  ╚═══╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝')}
${chalk.gray('                    Security Scanner for CI/CD')}
`;

program
  .name('tdiv')
  .description('ThreatDiviner CLI - Security scanner for CI/CD pipelines')
  .version('1.0.0')
  .hook('preAction', () => {
    if (process.argv.length <= 2) {
      console.log(banner);
    }
  });

// Register commands
program.addCommand(scanCommand);
program.addCommand(configCommand);
program.addCommand(uploadCommand);
program.addCommand(baselineCommand);

// Parse arguments
program.parse();

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
