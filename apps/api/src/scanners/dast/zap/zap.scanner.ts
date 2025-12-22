import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IScanner, ScanContext, ScanOutput, NormalizedFinding, Severity, Confidence } from '../../interfaces';
import { LocalExecutorService } from '../../execution';

/**
 * ZAP JSON Report Structure
 */
interface ZapSite {
  '@name': string;
  '@host': string;
  '@port': string;
  '@ssl': string;
  alerts: ZapAlert[];
}

interface ZapAlert {
  pluginid: string;
  alertRef: string;
  alert: string;
  name: string;
  riskcode: string;
  confidence: string;
  riskdesc: string;
  confidencedesc: string;
  desc: string;
  instances: ZapInstance[];
  count: string;
  solution: string;
  otherinfo?: string;
  reference?: string;
  cweid?: string;
  wascid?: string;
  sourceid?: string;
  tags?: Record<string, string>;
}

interface ZapInstance {
  uri: string;
  method: string;
  param?: string;
  attack?: string;
  evidence?: string;
  otherinfo?: string;
}

interface ZapJsonReport {
  '@version': string;
  '@generated': string;
  site: ZapSite[];
}

export type ZapScanType = 'baseline' | 'full' | 'api';

export interface ZapScanConfig {
  scanType: ZapScanType;
  targetUrl: string;
  apiDefinition?: string; // OpenAPI spec URL for API scanning
  authEnabled?: boolean;
  authConfig?: {
    loginUrl: string;
    username: string;
    password: string;
    usernameField: string;
    passwordField: string;
  };
}

@Injectable()
export class ZapScanner implements IScanner {
  readonly name = 'zap';
  readonly version = '2.x';
  readonly supportedLanguages = ['web', 'api'];
  readonly outputFormat = 'json' as const;

  private readonly logger = new Logger(ZapScanner.name);
  private readonly zapDockerImage: string;
  private readonly useDocker: boolean;
  private readonly zapPath: string;

  constructor(
    private readonly executor: LocalExecutorService,
    private readonly configService: ConfigService,
  ) {
    this.zapDockerImage = this.configService.get('ZAP_DOCKER_IMAGE', 'ghcr.io/zaproxy/zaproxy:stable');
    this.useDocker = this.configService.get('ZAP_USE_DOCKER', 'true') === 'true';
    this.zapPath = this.configService.get('ZAP_PATH', 'zap');
  }

  async isAvailable(): Promise<boolean> {
    if (this.useDocker) {
      return this.executor.isCommandAvailable('docker');
    }
    return this.executor.isCommandAvailable(this.zapPath);
  }

  async getVersion(): Promise<string> {
    if (this.useDocker) {
      return this.zapDockerImage;
    }
    return this.executor.getCommandVersion(this.zapPath, '-version');
  }

  async scan(context: ScanContext): Promise<ScanOutput> {
    const outputFile = path.join(context.workDir, 'zap-results.json');
    const outputDir = context.workDir;

    // Get ZAP configuration from scan context
    const zapConfig = this.getZapConfig(context);

    if (!zapConfig.targetUrl) {
      this.logger.warn('No target URL configured for ZAP scan');
      return {
        scanner: this.name,
        exitCode: 1,
        stdout: '',
        stderr: 'No target URL configured for ZAP scan',
        duration: 0,
        timedOut: false,
      };
    }

    let result: ScanOutput;

    if (this.useDocker) {
      result = await this.runDockerScan(zapConfig, outputDir, outputFile, context.timeout);
    } else {
      result = await this.runLocalScan(zapConfig, outputDir, outputFile, context.timeout);
    }

    // Check if output file was created
    try {
      await fs.access(outputFile);
      result.outputFile = outputFile;
    } catch {
      // Try alternate location (Docker mounts)
      const altPath = path.join(outputDir, 'report.json');
      try {
        await fs.access(altPath);
        result.outputFile = altPath;
      } catch {
        this.logger.warn('ZAP output file not created');
      }
    }

    return result;
  }

  private getZapConfig(context: ScanContext): ZapScanConfig {
    const targetUrls = context.config?.targetUrls as string[] || [];
    const zapConfig = context.config?.zapConfig as Partial<ZapScanConfig> || {};

    return {
      scanType: zapConfig.scanType || 'baseline',
      targetUrl: zapConfig.targetUrl || targetUrls[0] || '',
      apiDefinition: zapConfig.apiDefinition,
      authEnabled: zapConfig.authEnabled || false,
      authConfig: zapConfig.authConfig,
    };
  }

  private async runDockerScan(
    config: ZapScanConfig,
    outputDir: string,
    outputFile: string,
    timeout: number,
  ): Promise<ScanOutput> {
    const reportName = 'report.json';

    // Build Docker command
    let scanScript: string;
    const scriptArgs: string[] = [];

    switch (config.scanType) {
      case 'baseline':
        scanScript = 'zap-baseline.py';
        scriptArgs.push('-t', config.targetUrl);
        scriptArgs.push('-J', reportName);
        scriptArgs.push('-I'); // Don't fail on warnings
        break;

      case 'full':
        scanScript = 'zap-full-scan.py';
        scriptArgs.push('-t', config.targetUrl);
        scriptArgs.push('-J', reportName);
        scriptArgs.push('-I');
        break;

      case 'api':
        if (!config.apiDefinition) {
          this.logger.warn('API scan requires apiDefinition (OpenAPI spec URL)');
          return {
            scanner: this.name,
            exitCode: 1,
            stdout: '',
            stderr: 'API scan requires apiDefinition (OpenAPI spec URL)',
            duration: 0,
            timedOut: false,
          };
        }
        scanScript = 'zap-api-scan.py';
        scriptArgs.push('-t', config.apiDefinition);
        scriptArgs.push('-f', 'openapi');
        scriptArgs.push('-J', reportName);
        scriptArgs.push('-I');
        break;

      default:
        scanScript = 'zap-baseline.py';
        scriptArgs.push('-t', config.targetUrl);
        scriptArgs.push('-J', reportName);
        scriptArgs.push('-I');
    }

    // Docker command
    const dockerArgs = [
      'run',
      '--rm',
      '-v', `${outputDir}:/zap/wrk:rw`,
      '--network', 'host', // Allows scanning localhost services
      '-t', this.zapDockerImage,
      scanScript,
      ...scriptArgs,
    ];

    return this.executor.execute({
      command: 'docker',
      args: dockerArgs,
      cwd: outputDir,
      timeout,
    });
  }

  private async runLocalScan(
    config: ZapScanConfig,
    outputDir: string,
    outputFile: string,
    timeout: number,
  ): Promise<ScanOutput> {
    // For local ZAP installation (not Docker)
    // This would use the ZAP CLI or daemon mode
    const args = [
      '-cmd',
      '-quickurl', config.targetUrl,
      '-quickout', outputFile,
      '-quickprogress',
    ];

    return this.executor.execute({
      command: this.zapPath,
      args,
      cwd: outputDir,
      timeout,
    });
  }

  async parseOutput(output: ScanOutput): Promise<NormalizedFinding[]> {
    if (!output.outputFile) {
      this.logger.warn('No output file to parse');
      return [];
    }

    try {
      const content = await fs.readFile(output.outputFile, 'utf-8');
      const report: ZapJsonReport = JSON.parse(content);
      const findings: NormalizedFinding[] = [];

      for (const site of report.site || []) {
        for (const alert of site.alerts || []) {
          const baseFinding = this.convertAlert(alert, site);

          // Create a finding for each instance
          for (const instance of alert.instances || []) {
            findings.push({
              ...baseFinding,
              filePath: instance.uri,
              metadata: {
                ...baseFinding.metadata,
                method: instance.method,
                param: instance.param,
                attack: instance.attack,
                evidence: instance.evidence,
              },
              fingerprint: this.generateFingerprint(alert.alertRef, instance.uri, instance.param),
            });
          }

          // If no instances, create single finding
          if (!alert.instances?.length) {
            findings.push(baseFinding);
          }
        }
      }

      this.logger.log(`Parsed ${findings.length} ZAP findings`);
      return findings;
    } catch (error) {
      this.logger.error(`Failed to parse ZAP output: ${error}`);
      return [];
    }
  }

  private convertAlert(alert: ZapAlert, site: ZapSite): NormalizedFinding {
    const severity = this.mapRiskCode(alert.riskcode);
    const confidence = this.mapConfidence(alert.confidence);

    // Parse CWE ID
    const cweIds: string[] = [];
    if (alert.cweid && alert.cweid !== '-1') {
      cweIds.push(`CWE-${alert.cweid}`);
    }

    // Parse references
    const references: string[] = [];
    if (alert.reference) {
      // ZAP references are HTML paragraphs, extract URLs
      const urlMatches = alert.reference.match(/https?:\/\/[^\s<>"]+/g);
      if (urlMatches) {
        references.push(...urlMatches);
      }
    }

    // Extract OWASP IDs from tags
    const owaspIds: string[] = [];
    if (alert.tags) {
      for (const [key, value] of Object.entries(alert.tags)) {
        if (key.toLowerCase().includes('owasp')) {
          owaspIds.push(value);
        }
      }
    }

    return {
      scanner: this.name,
      ruleId: alert.pluginid || alert.alertRef,
      severity,
      confidence,
      title: alert.name || alert.alert,
      description: this.stripHtml(alert.desc),
      filePath: `${site['@host']}:${site['@port']}`,
      startLine: 0,
      cweIds,
      cveIds: [],
      owaspIds,
      references,
      fix: {
        description: this.stripHtml(alert.solution),
      },
      fingerprint: this.generateFingerprint(alert.alertRef, site['@host'], ''),
      metadata: {
        site: site['@name'],
        host: site['@host'],
        port: site['@port'],
        ssl: site['@ssl'] === 'true',
        riskDesc: alert.riskdesc,
        confidenceDesc: alert.confidencedesc,
        wascId: alert.wascid,
        instanceCount: parseInt(alert.count || '0', 10),
        otherInfo: alert.otherinfo,
      },
    };
  }

  private mapRiskCode(riskcode: string): Severity {
    switch (riskcode) {
      case '3':
        return 'critical';
      case '2':
        return 'high';
      case '1':
        return 'medium';
      case '0':
        return 'low';
      default:
        return 'info';
    }
  }

  private mapConfidence(confidence: string): Confidence {
    switch (confidence) {
      case '3':
        return 'high';
      case '2':
        return 'medium';
      case '1':
      case '0':
      default:
        return 'low';
    }
  }

  private stripHtml(html: string | undefined): string {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private generateFingerprint(alertRef: string, target: string, param: string | undefined): string {
    const data = `${alertRef}:${target}:${param || ''}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `zap-${Math.abs(hash).toString(16)}`;
  }
}
