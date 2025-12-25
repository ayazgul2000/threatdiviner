import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { getApiConfig, getRepoInfo } from '../utils/auth';

export const uploadCommand = new Command('upload')
  .description('Upload SARIF results to ThreatDiviner server')
  .argument('<file>', 'Path to SARIF file or scan results')
  .option('-r, --repository <name>', 'Repository name (owner/repo)')
  .option('-b, --branch <name>', 'Branch name')
  .option('-c, --commit <sha>', 'Commit SHA')
  .option('--pr <number>', 'Pull request number (if PR scan)')
  .option('--api-url <url>', 'ThreatDiviner API URL')
  .option('--api-key <key>', 'ThreatDiviner API key')
  .option('-q, --quiet', 'Suppress non-essential output')
  .action(async (file: string, options) => {
    const spinner = options.quiet ? null : ora('Uploading results...').start();

    try {
      // Validate file exists
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Read SARIF content
      const content = fs.readFileSync(filePath, 'utf-8');
      let sarifData: any;

      try {
        sarifData = JSON.parse(content);
      } catch {
        throw new Error('Invalid SARIF file: not valid JSON');
      }

      // Validate SARIF structure
      if (!sarifData.$schema || !sarifData.version || !sarifData.runs) {
        throw new Error('Invalid SARIF file: missing required fields');
      }

      // Get API config
      const apiConfig = getApiConfig(options);
      if (!apiConfig.apiKey) {
        throw new Error('API key required. Use --api-key or set THREATDIVINER_API_KEY');
      }

      // Get repository info
      const repoInfo = await getRepoInfo(options);

      // Upload to server
      const response = await fetch(`${apiConfig.apiUrl}/api/cli/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify({
          sarif: sarifData,
          repository: repoInfo.repository,
          branch: repoInfo.branch,
          commitSha: repoInfo.commitSha,
          pullRequestId: options.pr,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
      }

      const result = await response.json();

      if (spinner) {
        spinner.succeed('Results uploaded successfully');
      }

      if (!options.quiet) {
        console.log('');
        console.log(chalk.green('Upload successful!'));
        console.log(chalk.gray(`Scan ID: ${result.scanId}`));
        console.log(chalk.gray(`Findings: ${result.findingsCount}`));
        if (result.dashboardUrl) {
          console.log(chalk.gray(`Dashboard: ${result.dashboardUrl}`));
        }
      }

    } catch (error) {
      if (spinner) {
        spinner.fail(error instanceof Error ? error.message : 'Upload failed');
      }
      process.exit(1);
    }
  });
