import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getApiConfig, getRepoInfo } from '../utils/auth';

type WriteBackOption = 'pr_comments' | 'pr_summary' | 'check_status' | 'annotations' | 'sarif_upload';

interface TriggerScanResult {
  scanId: string;
  status: 'queued' | 'running';
  dashboardUrl: string;
  capabilities: {
    available: WriteBackOption[];
    reason: string;
  };
  effectiveSettings: {
    source: 'cli' | 'repo_settings' | 'defaults';
    scanners: string[];
    writeBack: WriteBackOption[];
    failOnSeverity: string;
    failOnCount: number;
  };
}

interface ScanStatus {
  id: string;
  status: 'queued' | 'pending' | 'running' | 'completed' | 'failed';
  findingsCount?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  errorMessage?: string;
}

export const remoteScanCommand = new Command('remote-scan')
  .description('Trigger a security scan on ThreatDiviner server')
  .option('-r, --repository <name>', 'Repository name (owner/repo)')
  .option('-b, --branch <name>', 'Branch name')
  .option('-c, --commit <sha>', 'Commit SHA')
  .option('--pr <number>', 'Pull request number (if PR scan)')
  .option('--scanners <list>', 'Comma-separated list of scanners (semgrep,trivy,gitleaks,checkov)')
  .option('--write-back <options>', 'Comma-separated write-back options (pr_comments,pr_summary,check_status,annotations,sarif_upload)')
  .option('--fail-on <severity>', 'Fail pipeline on this severity (none,critical,high,medium,low)')
  .option('--fail-count <number>', 'Fail if findings exceed this count', parseInt)
  .option('--no-wait', 'Do not wait for scan completion')
  .option('--timeout <seconds>', 'Timeout for scan completion in seconds', parseInt, 600)
  .option('--api-url <url>', 'ThreatDiviner API URL')
  .option('--api-key <key>', 'ThreatDiviner API key')
  .option('-q, --quiet', 'Suppress non-essential output')
  .option('--json', 'Output results as JSON')
  .action(async (options) => {
    const spinner = options.quiet ? null : ora('Triggering remote scan...').start();
    const startTime = Date.now();

    try {
      // Get API config
      const apiConfig = getApiConfig(options);
      if (!apiConfig.apiKey) {
        throw new Error('API key required. Use --api-key or set THREATDIVINER_API_KEY');
      }

      // Get repository info
      const repoInfo = await getRepoInfo(options);
      if (repoInfo.repository === 'unknown') {
        throw new Error('Could not determine repository. Use --repository or run in a git directory');
      }

      // Build request body
      const body: any = {
        repository: repoInfo.repository,
        branch: repoInfo.branch,
        commitSha: repoInfo.commitSha,
      };

      if (options.pr) {
        body.pullRequestId = options.pr;
      }

      if (options.scanners) {
        body.scanners = options.scanners.split(',').map((s: string) => s.trim());
      }

      if (options.writeBack) {
        body.writeBack = options.writeBack.split(',').map((s: string) => s.trim());
      }

      if (options.failOn) {
        body.failOnSeverity = options.failOn;
      }

      if (options.failCount !== undefined) {
        body.failOnCount = options.failCount;
      }

      // Trigger the scan
      const response = await fetch(`${apiConfig.apiUrl}/cli/trigger-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to trigger scan: ${error}`);
      }

      const result = await response.json() as TriggerScanResult;

      if (spinner) {
        spinner.succeed('Scan triggered successfully');
      }

      // Show initial info
      if (!options.quiet && !options.json) {
        console.log('');
        console.log(chalk.cyan('Scan Details:'));
        console.log(chalk.gray(`  Repository: ${repoInfo.repository}`));
        console.log(chalk.gray(`  Branch: ${repoInfo.branch}`));
        console.log(chalk.gray(`  Commit: ${repoInfo.commitSha.substring(0, 8)}`));
        console.log(chalk.gray(`  Scan ID: ${result.scanId}`));
        console.log(chalk.gray(`  Settings Source: ${result.effectiveSettings.source}`));
        console.log(chalk.gray(`  Scanners: ${result.effectiveSettings.scanners.join(', ')}`));
        console.log(chalk.gray(`  Write-back: ${result.effectiveSettings.writeBack.join(', ') || 'none'}`));
        console.log(chalk.gray(`  Dashboard: ${result.dashboardUrl}`));
        console.log('');
      }

      // Wait for completion if requested
      if (options.wait !== false) {
        const finalStatus = await waitForScanCompletion(
          apiConfig.apiUrl,
          apiConfig.apiKey,
          result.scanId,
          options.timeout * 1000,
          spinner,
          options.quiet,
        );

        const duration = Math.round((Date.now() - startTime) / 1000);

        if (options.json) {
          console.log(JSON.stringify({
            scanId: result.scanId,
            status: finalStatus.status,
            repository: repoInfo.repository,
            branch: repoInfo.branch,
            commitSha: repoInfo.commitSha,
            duration,
            findings: finalStatus.findingsCount,
            dashboardUrl: result.dashboardUrl,
            effectiveSettings: result.effectiveSettings,
          }, null, 2));
        } else if (!options.quiet) {
          console.log('');
          console.log(chalk.cyan('Scan Results:'));
          if (finalStatus.findingsCount) {
            const fc = finalStatus.findingsCount;
            console.log(chalk.red(`  Critical: ${fc.critical}`));
            console.log(chalk.yellow(`  High: ${fc.high}`));
            console.log(chalk.blue(`  Medium: ${fc.medium}`));
            console.log(chalk.gray(`  Low: ${fc.low}`));
            console.log(chalk.white(`  Total: ${fc.total}`));
          }
          console.log(chalk.gray(`  Duration: ${duration}s`));
          console.log('');
        }

        // Determine exit code based on pipeline gate settings
        const exitCode = determineExitCode(
          finalStatus,
          result.effectiveSettings.failOnSeverity,
          result.effectiveSettings.failOnCount,
        );

        if (exitCode !== 0) {
          if (!options.quiet && !options.json) {
            console.log(chalk.red(`Pipeline gate failed: findings exceed threshold`));
          }
          process.exit(exitCode);
        }

        if (!options.quiet && !options.json) {
          console.log(chalk.green('Scan completed successfully!'));
        }

      } else {
        // Just print scan ID and exit
        if (options.json) {
          console.log(JSON.stringify({
            scanId: result.scanId,
            status: 'queued',
            dashboardUrl: result.dashboardUrl,
          }, null, 2));
        } else if (!options.quiet) {
          console.log(chalk.yellow('Scan queued. Use --wait to wait for completion.'));
        }
      }

    } catch (error) {
      if (spinner) {
        spinner.fail(error instanceof Error ? error.message : 'Scan failed');
      }
      if (options.json) {
        console.log(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
      }
      process.exit(1);
    }
  });

async function waitForScanCompletion(
  apiUrl: string,
  apiKey: string,
  scanId: string,
  timeoutMs: number,
  spinner: ora.Ora | null,
  quiet: boolean,
): Promise<ScanStatus> {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${apiUrl}/scm/scans/${scanId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get scan status: ${response.statusText}`);
      }

      const scanResponse = await response.json() as { scan: { id: string; status: string; severityStats?: ScanStatus['findingsCount']; errorMessage?: string } };
      const scan = scanResponse.scan;
      const status: ScanStatus = {
        id: scan.id,
        status: scan.status as ScanStatus['status'],
        findingsCount: scan.severityStats,
        errorMessage: scan.errorMessage,
      };

      if (spinner) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        spinner.text = `Waiting for scan to complete... (${status.status}, ${elapsed}s)`;
      }

      if (status.status === 'completed') {
        if (spinner) spinner.succeed('Scan completed');
        return status;
      }

      if (status.status === 'failed') {
        if (spinner) spinner.fail(`Scan failed: ${status.errorMessage || 'Unknown error'}`);
        throw new Error(status.errorMessage || 'Scan failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));

    } catch (error) {
      if (error instanceof Error && error.message.includes('Scan failed')) {
        throw error;
      }
      // Network errors - continue polling
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error(`Scan timed out after ${timeoutMs / 1000} seconds`);
}

function determineExitCode(
  status: ScanStatus,
  failOnSeverity: string,
  failOnCount: number,
): number {
  if (status.status !== 'completed') {
    return 1; // Non-zero for incomplete scans
  }

  const fc = status.findingsCount;
  if (!fc) return 0;

  // Check severity-based gate
  const severityOrder = ['none', 'low', 'medium', 'high', 'critical'];
  const failIndex = severityOrder.indexOf(failOnSeverity);

  if (failIndex > 0) { // Not 'none'
    if (failOnSeverity === 'critical' && fc.critical > 0) return 1;
    if (failOnSeverity === 'high' && (fc.critical > 0 || fc.high > 0)) return 1;
    if (failOnSeverity === 'medium' && (fc.critical > 0 || fc.high > 0 || fc.medium > 0)) return 1;
    if (failOnSeverity === 'low' && (fc.critical > 0 || fc.high > 0 || fc.medium > 0 || fc.low > 0)) return 1;
  }

  // Check count-based gate
  if (failOnCount > 0 && fc.total > failOnCount) {
    return 1;
  }

  return 0;
}
