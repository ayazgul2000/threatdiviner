import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { CloudAccount, CloudProvider, CspmFinding } from '../cspm.service';

interface ProwlerFinding {
  CheckID: string;
  CheckTitle: string;
  ServiceName: string;
  SubServiceName?: string;
  Status: 'PASS' | 'FAIL' | 'MANUAL' | 'INFO';
  StatusExtended: string;
  Severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  ResourceId: string;
  ResourceArn?: string;
  ResourceType: string;
  Region: string;
  Description: string;
  Risk: string;
  RelatedUrl?: string;
  Remediation: {
    Code?: {
      CLI?: string;
      NativeIaC?: string;
    };
    Recommendation: {
      Text: string;
      Url?: string;
    };
  };
  Compliance?: Record<string, string[]>;
}

@Injectable()
export class ProwlerScanner {
  private readonly logger = new Logger(ProwlerScanner.name);
  private readonly prowlerPath: string;
  private readonly useDocker: boolean;

  constructor(private readonly configService: ConfigService) {
    this.prowlerPath = this.configService.get('PROWLER_PATH', 'prowler');
    this.useDocker = this.configService.get('PROWLER_USE_DOCKER', 'true') === 'true';
  }

  /**
   * Check if Prowler is available
   */
  async isAvailable(): Promise<boolean> {
    if (this.useDocker) {
      return this.isDockerAvailable();
    }
    return this.isProwlerInstalled();
  }

  private async isDockerAvailable(): Promise<boolean> {
    try {
      await this.runCommand('docker', ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  private async isProwlerInstalled(): Promise<boolean> {
    try {
      await this.runCommand(this.prowlerPath, ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run CSPM scan using Prowler
   */
  async scan(account: CloudAccount): Promise<CspmFinding[]> {
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prowler-'));
    const outputFile = path.join(workDir, 'output.json');

    try {
      const findings = await this.runProwlerScan(account, outputFile);
      return findings;
    } finally {
      // Cleanup temp directory
      try {
        await fs.rm(workDir, { recursive: true, force: true });
      } catch (error) {
        this.logger.warn(`Failed to cleanup temp directory: ${error}`);
      }
    }
  }

  private async runProwlerScan(
    account: CloudAccount,
    outputFile: string,
  ): Promise<CspmFinding[]> {
    const provider = account.provider;

    if (this.useDocker) {
      return this.runDockerProwler(account, outputFile);
    }

    return this.runLocalProwler(account, outputFile);
  }

  private async runDockerProwler(
    account: CloudAccount,
    outputFile: string,
  ): Promise<CspmFinding[]> {
    const outputDir = path.dirname(outputFile);
    const args = this.buildProwlerArgs(account);

    const dockerArgs = [
      'run',
      '--rm',
      '-v', `${outputDir}:/output`,
    ];

    // Add credential environment variables
    if (account.provider === 'aws') {
      dockerArgs.push(
        '-e', `AWS_ACCESS_KEY_ID=${account.credentials.accessKeyId}`,
        '-e', `AWS_SECRET_ACCESS_KEY=${account.credentials.secretAccessKey}`,
      );
      if (account.credentials.sessionToken) {
        dockerArgs.push('-e', `AWS_SESSION_TOKEN=${account.credentials.sessionToken}`);
      }
    }

    dockerArgs.push(
      'toniblyx/prowler:latest',
      ...args,
      '-M', 'json',
      '-F', '/output/output.json',
    );

    try {
      await this.runCommand('docker', dockerArgs, 600000); // 10 min timeout
      return this.parseProwlerOutput(outputFile, account);
    } catch (error) {
      this.logger.error(`Prowler scan failed: ${error}`);
      return [];
    }
  }

  private async runLocalProwler(
    account: CloudAccount,
    outputFile: string,
  ): Promise<CspmFinding[]> {
    const args = this.buildProwlerArgs(account);
    args.push('-M', 'json', '-F', outputFile);

    // Set up environment for credentials
    const env: Record<string, string> = { ...process.env as any };

    if (account.provider === 'aws') {
      env.AWS_ACCESS_KEY_ID = account.credentials.accessKeyId;
      env.AWS_SECRET_ACCESS_KEY = account.credentials.secretAccessKey;
      if (account.credentials.sessionToken) {
        env.AWS_SESSION_TOKEN = account.credentials.sessionToken;
      }
    }

    try {
      await this.runCommand(this.prowlerPath, args, 600000, env);
      return this.parseProwlerOutput(outputFile, account);
    } catch (error) {
      this.logger.error(`Prowler scan failed: ${error}`);
      return [];
    }
  }

  private buildProwlerArgs(account: CloudAccount): string[] {
    const args: string[] = [];

    switch (account.provider) {
      case 'aws':
        args.push('aws');
        if (account.regions && account.regions.length > 0) {
          args.push('-r', account.regions.join(','));
        }
        break;

      case 'azure':
        args.push('azure');
        args.push('--subscription-ids', account.credentials.subscriptionId);
        break;

      case 'gcp':
        args.push('gcp');
        args.push('--project-ids', account.credentials.projectId);
        break;
    }

    // Add severity filter (skip informational)
    args.push('--severity', 'critical,high,medium,low');

    return args;
  }

  private async parseProwlerOutput(
    outputFile: string,
    account: CloudAccount,
  ): Promise<CspmFinding[]> {
    try {
      const content = await fs.readFile(outputFile, 'utf-8');
      const prowlerFindings: ProwlerFinding[] = JSON.parse(content);

      return prowlerFindings
        .filter((f) => f.Status === 'FAIL')
        .map((f) => this.convertFinding(f, account));
    } catch (error) {
      this.logger.error(`Failed to parse Prowler output: ${error}`);
      return [];
    }
  }

  private convertFinding(
    prowlerFinding: ProwlerFinding,
    account: CloudAccount,
  ): CspmFinding {
    const compliance: string[] = [];
    if (prowlerFinding.Compliance) {
      for (const [framework, controls] of Object.entries(prowlerFinding.Compliance)) {
        compliance.push(...controls.map((c) => `${framework}: ${c}`));
      }
    }

    return {
      id: `${account.id}-${prowlerFinding.CheckID}-${prowlerFinding.ResourceId}`.replace(
        /[^a-zA-Z0-9-]/g,
        '-',
      ),
      accountId: account.id,
      provider: account.provider,
      service: prowlerFinding.ServiceName,
      region: prowlerFinding.Region,
      resourceId: prowlerFinding.ResourceId,
      resourceType: prowlerFinding.ResourceType,
      severity: this.mapSeverity(prowlerFinding.Severity),
      title: prowlerFinding.CheckTitle,
      description: prowlerFinding.Description || prowlerFinding.StatusExtended,
      remediation: prowlerFinding.Remediation?.Recommendation?.Text,
      compliance,
      status: 'open',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    };
  }

  private mapSeverity(
    severity: string,
  ): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'info';
    }
  }

  private runCommand(
    command: string,
    args: string[],
    timeout = 60000,
    env?: Record<string, string>,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const child = spawn(command, args, {
        env: env || process.env,
        shell: process.platform === 'win32',
      });

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Command timed out'));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }
}
