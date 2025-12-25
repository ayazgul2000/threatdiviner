import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';

interface BaselineEntry {
  ruleId: string;
  filePath: string;
  startLine: number;
  fingerprint: string;
  addedAt: string;
  reason?: string;
}

interface BaselineFile {
  version: '1.0';
  repository?: string;
  entries: BaselineEntry[];
}

const BASELINE_FILE = '.threatdiviner-baseline.json';

export const baselineCommand = new Command('baseline')
  .description('Manage finding baselines for suppressing known issues');

// Create/update baseline
baselineCommand
  .command('create')
  .description('Create a baseline from current scan results')
  .argument('<sarif-file>', 'Path to SARIF file with findings to baseline')
  .option('-o, --output <file>', 'Output baseline file', BASELINE_FILE)
  .option('--reason <text>', 'Reason for baselining all findings')
  .action(async (sarifFile: string, options) => {
    const spinner = ora('Creating baseline...').start();

    try {
      // Read SARIF file
      const sarifPath = path.resolve(sarifFile);
      if (!fs.existsSync(sarifPath)) {
        throw new Error(`SARIF file not found: ${sarifPath}`);
      }

      const sarifContent = fs.readFileSync(sarifPath, 'utf-8');
      const sarif = JSON.parse(sarifContent);

      // Extract findings
      const entries: BaselineEntry[] = [];
      const now = new Date().toISOString();

      for (const run of sarif.runs || []) {
        for (const result of run.results || []) {
          const location = result.locations?.[0]?.physicalLocation;
          if (!location) continue;

          const entry: BaselineEntry = {
            ruleId: result.ruleId || 'unknown',
            filePath: location.artifactLocation?.uri || 'unknown',
            startLine: location.region?.startLine || 0,
            fingerprint: result.fingerprints?.['finding-id'] ||
              `${result.ruleId}:${location.artifactLocation?.uri}:${location.region?.startLine}`,
            addedAt: now,
            reason: options.reason,
          };

          entries.push(entry);
        }
      }

      // Write baseline file
      const baseline: BaselineFile = {
        version: '1.0',
        entries,
      };

      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, JSON.stringify(baseline, null, 2));

      spinner.succeed(`Created baseline with ${entries.length} entries`);
      console.log(chalk.gray(`Baseline written to: ${outputPath}`));

    } catch (error) {
      spinner.fail(error instanceof Error ? error.message : 'Failed to create baseline');
      process.exit(1);
    }
  });

// Add specific findings to baseline
baselineCommand
  .command('add')
  .description('Add a specific finding to the baseline')
  .argument('<rule-id>', 'Rule ID to baseline')
  .argument('<file-path>', 'File path of the finding')
  .argument('[line]', 'Line number of the finding', parseInt)
  .option('-b, --baseline <file>', 'Baseline file to update', BASELINE_FILE)
  .option('--reason <text>', 'Reason for baselining this finding')
  .action((ruleId: string, filePath: string, line: number | undefined, options) => {
    try {
      // Load existing baseline
      const baselinePath = path.resolve(options.baseline);
      let baseline: BaselineFile = { version: '1.0', entries: [] };

      if (fs.existsSync(baselinePath)) {
        baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
      }

      // Add new entry
      const entry: BaselineEntry = {
        ruleId,
        filePath,
        startLine: line || 0,
        fingerprint: `${ruleId}:${filePath}:${line || 0}`,
        addedAt: new Date().toISOString(),
        reason: options.reason,
      };

      baseline.entries.push(entry);

      // Write updated baseline
      fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));

      console.log(chalk.green(`Added ${ruleId} at ${filePath}:${line || 'all'} to baseline`));

    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : 'Failed to add to baseline'));
      process.exit(1);
    }
  });

// List baseline entries
baselineCommand
  .command('list')
  .description('List all entries in the baseline')
  .option('-b, --baseline <file>', 'Baseline file to read', BASELINE_FILE)
  .action((options) => {
    try {
      const baselinePath = path.resolve(options.baseline);

      if (!fs.existsSync(baselinePath)) {
        console.log(chalk.yellow('No baseline file found.'));
        return;
      }

      const baseline: BaselineFile = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

      if (baseline.entries.length === 0) {
        console.log(chalk.yellow('Baseline is empty.'));
        return;
      }

      console.log(chalk.bold(`\nBaseline entries (${baseline.entries.length}):\n`));

      for (const entry of baseline.entries) {
        console.log(`  ${chalk.cyan(entry.ruleId)}`);
        console.log(`    ${chalk.gray('File:')} ${entry.filePath}:${entry.startLine}`);
        console.log(`    ${chalk.gray('Added:')} ${entry.addedAt}`);
        if (entry.reason) {
          console.log(`    ${chalk.gray('Reason:')} ${entry.reason}`);
        }
        console.log('');
      }

    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : 'Failed to list baseline'));
      process.exit(1);
    }
  });

// Remove from baseline
baselineCommand
  .command('remove')
  .description('Remove a finding from the baseline')
  .argument('<fingerprint>', 'Fingerprint or rule:path:line to remove')
  .option('-b, --baseline <file>', 'Baseline file to update', BASELINE_FILE)
  .action((fingerprint: string, options) => {
    try {
      const baselinePath = path.resolve(options.baseline);

      if (!fs.existsSync(baselinePath)) {
        console.log(chalk.yellow('No baseline file found.'));
        return;
      }

      const baseline: BaselineFile = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
      const originalCount = baseline.entries.length;

      baseline.entries = baseline.entries.filter(e =>
        e.fingerprint !== fingerprint &&
        `${e.ruleId}:${e.filePath}:${e.startLine}` !== fingerprint,
      );

      const removed = originalCount - baseline.entries.length;

      if (removed === 0) {
        console.log(chalk.yellow('No matching entries found.'));
        return;
      }

      fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
      console.log(chalk.green(`Removed ${removed} entry from baseline`));

    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : 'Failed to remove from baseline'));
      process.exit(1);
    }
  });

// Filter SARIF using baseline
baselineCommand
  .command('filter')
  .description('Filter a SARIF file to exclude baselined findings')
  .argument('<sarif-file>', 'SARIF file to filter')
  .option('-b, --baseline <file>', 'Baseline file to use', BASELINE_FILE)
  .option('-o, --output <file>', 'Output file (default: overwrites input)')
  .action((sarifFile: string, options) => {
    const spinner = ora('Filtering baselined findings...').start();

    try {
      const sarifPath = path.resolve(sarifFile);
      const baselinePath = path.resolve(options.baseline);

      if (!fs.existsSync(sarifPath)) {
        throw new Error(`SARIF file not found: ${sarifPath}`);
      }

      if (!fs.existsSync(baselinePath)) {
        spinner.info('No baseline file found, nothing to filter');
        return;
      }

      const sarif = JSON.parse(fs.readFileSync(sarifPath, 'utf-8'));
      const baseline: BaselineFile = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

      // Create lookup set for faster matching
      const baselined = new Set(baseline.entries.map(e => e.fingerprint));
      const baselinedPatterns = baseline.entries.map(e =>
        `${e.ruleId}:${e.filePath}:${e.startLine}`,
      );

      let filtered = 0;

      for (const run of sarif.runs || []) {
        const originalCount = run.results?.length || 0;

        run.results = (run.results || []).filter((result: any) => {
          const location = result.locations?.[0]?.physicalLocation;
          const fingerprint = result.fingerprints?.['finding-id'];

          // Check fingerprint match
          if (fingerprint && baselined.has(fingerprint)) {
            return false;
          }

          // Check pattern match
          if (location) {
            const pattern = `${result.ruleId}:${location.artifactLocation?.uri}:${location.region?.startLine}`;
            if (baselinedPatterns.includes(pattern)) {
              return false;
            }
          }

          return true;
        });

        filtered += originalCount - (run.results?.length || 0);
      }

      // Write filtered SARIF
      const outputPath = options.output ? path.resolve(options.output) : sarifPath;
      fs.writeFileSync(outputPath, JSON.stringify(sarif, null, 2));

      spinner.succeed(`Filtered ${filtered} baselined findings`);
      console.log(chalk.gray(`Output written to: ${outputPath}`));

    } catch (error) {
      spinner.fail(error instanceof Error ? error.message : 'Failed to filter');
      process.exit(1);
    }
  });
