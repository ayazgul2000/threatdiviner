import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from './crypto.service';
import { GitHubProvider } from '../providers/github.provider';
import { GitLabProvider } from '../providers/gitlab.provider';
import { BitbucketProvider } from '../providers/bitbucket.provider';
import { AzureDevOpsProvider } from '../providers/azure-devops.provider';

export interface SarifUploadResult {
  success: boolean;
  id?: string;
  url?: string;
  error?: string;
}

@Injectable()
export class SarifUploadService {
  private readonly logger = new Logger(SarifUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly githubProvider: GitHubProvider,
    private readonly gitlabProvider: GitLabProvider,
    private readonly bitbucketProvider: BitbucketProvider,
    private readonly azureDevOpsProvider: AzureDevOpsProvider,
  ) {}

  /**
   * Upload SARIF to the native security tab of the SCM provider
   */
  async uploadSarif(
    scanId: string,
    sarifContent: string,
  ): Promise<SarifUploadResult> {
    try {
      // Get scan with repository and connection info
      const scan = await this.prisma.scan.findUnique({
        where: { id: scanId },
        include: {
          repository: {
            include: {
              connection: true,
            },
          },
        },
      });

      if (!scan) {
        return { success: false, error: 'Scan not found' };
      }

      if (!scan.repository?.connection) {
        return { success: false, error: 'Repository connection not found' };
      }

      const { repository } = scan;
      const { connection } = repository;
      const [owner, repo] = repository.fullName.split('/');

      if (!owner || !repo) {
        return { success: false, error: 'Invalid repository name' };
      }

      const accessToken = this.cryptoService.decrypt(connection.accessToken);
      const commitSha = scan.commitSha;
      const branch = scan.branch;

      let result: { id: string; url: string };

      switch (connection.provider) {
        case 'github':
          result = await this.githubProvider.uploadSarif(
            accessToken,
            owner,
            repo,
            commitSha,
            branch,
            sarifContent,
          );
          this.logger.log(`SARIF uploaded to GitHub for scan ${scanId}: ${result.id}`);
          break;

        case 'gitlab':
          result = await this.gitlabProvider.uploadSarif(
            accessToken,
            owner,
            repo,
            commitSha,
            branch,
            sarifContent,
          );
          this.logger.log(`SARIF uploaded to GitLab for scan ${scanId}: ${result.id}`);
          break;

        case 'bitbucket':
          result = await this.bitbucketProvider.uploadSarif(
            accessToken,
            owner,
            repo,
            commitSha,
            branch,
            sarifContent,
          );
          this.logger.log(`SARIF uploaded to Bitbucket for scan ${scanId}: ${result.id}`);
          break;

        case 'azure-devops':
          result = await this.azureDevOpsProvider.uploadSarif(
            accessToken,
            owner,
            repo,
            commitSha,
            branch,
            sarifContent,
          );
          this.logger.log(`SARIF uploaded to Azure DevOps for scan ${scanId}: ${result.id}`);
          break;

        default:
          return {
            success: false,
            error: `SARIF upload not supported for provider: ${connection.provider}`,
          };
      }

      // Store the SARIF upload ID in the scan
      await this.prisma.scan.update({
        where: { id: scanId },
        data: {
          sarifUploadId: result.id,
          sarifUploadUrl: result.url,
        },
      });

      return {
        success: true,
        id: result.id,
        url: result.url,
      };
    } catch (error) {
      this.logger.error(`Failed to upload SARIF for scan ${scanId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Convert findings to SARIF format
   */
  async generateSarifFromScan(scanId: string): Promise<string> {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        findings: true,
        repository: true,
      },
    });

    if (!scan) {
      throw new Error('Scan not found');
    }

    const sarif = {
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      version: '2.1.0',
      runs: this.groupFindingsByScanner(scan.findings),
    };

    return JSON.stringify(sarif, null, 2);
  }

  private groupFindingsByScanner(findings: any[]): any[] {
    const byScanner = new Map<string, any[]>();

    for (const finding of findings) {
      const scanner = finding.scanner || 'unknown';
      const existing = byScanner.get(scanner) || [];
      existing.push(finding);
      byScanner.set(scanner, existing);
    }

    const runs: any[] = [];

    for (const [scanner, scannerFindings] of byScanner) {
      const rules = new Map<string, { id: string; name: string; description: string }>();
      const results: any[] = [];

      for (const finding of scannerFindings) {
        // Add rule if not already added
        if (!rules.has(finding.ruleId)) {
          rules.set(finding.ruleId, {
            id: finding.ruleId,
            name: finding.title,
            description: finding.message || finding.title,
          });
        }

        results.push({
          ruleId: finding.ruleId,
          level: this.severityToLevel(finding.severity),
          message: { text: finding.message || finding.title },
          locations: finding.filePath ? [{
            physicalLocation: {
              artifactLocation: { uri: finding.filePath },
              region: finding.startLine ? {
                startLine: finding.startLine,
                endLine: finding.endLine || finding.startLine,
                snippet: finding.snippet ? { text: finding.snippet } : undefined,
              } : undefined,
            },
          }] : undefined,
          fingerprints: {
            'finding-id': finding.id,
          },
        });
      }

      runs.push({
        tool: {
          driver: {
            name: `ThreatDiviner/${scanner}`,
            version: '1.0.0',
            informationUri: 'https://threatdiviner.io',
            rules: Array.from(rules.values()).map(r => ({
              id: r.id,
              name: r.name,
              shortDescription: { text: r.name },
              fullDescription: { text: r.description },
            })),
          },
        },
        results,
      });
    }

    return runs;
  }

  private severityToLevel(severity: string): 'error' | 'warning' | 'note' | 'none' {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
      case 'info':
        return 'note';
      default:
        return 'none';
    }
  }
}
