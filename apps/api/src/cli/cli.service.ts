import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

interface SarifResult {
  ruleId: string;
  level: string;
  message: { text: string };
  locations?: Array<{
    physicalLocation?: {
      artifactLocation?: { uri: string };
      region?: {
        startLine?: number;
        endLine?: number;
        snippet?: { text: string };
      };
    };
  }>;
  fingerprints?: Record<string, string>;
}

interface SarifRun {
  tool: {
    driver: {
      name: string;
      version?: string;
      rules?: Array<{
        id: string;
        name?: string;
        shortDescription?: { text: string };
        fullDescription?: { text: string };
      }>;
    };
  };
  results: SarifResult[];
}

export interface UploadResult {
  scanId: string;
  findingsCount: number;
  dashboardUrl: string;
}

@Injectable()
export class CliService {
  private readonly logger = new Logger(CliService.name);
  private readonly dashboardUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.dashboardUrl = this.configService.get('DASHBOARD_URL') || 'http://localhost:3000';
  }

  async processSarifUpload(
    tenantId: string,
    sarif: any,
    repositoryName: string,
    branch: string,
    commitSha: string,
    pullRequestId?: string,
  ): Promise<UploadResult> {
    // Find or create repository
    let repository = await this.prisma.repository.findFirst({
      where: {
        tenantId,
        fullName: repositoryName,
      },
    });

    if (!repository) {
      // For CLI uploads, we might not have the repository in the system
      // Log a warning and create a placeholder
      this.logger.warn(`Repository ${repositoryName} not found for tenant ${tenantId}`);
      throw new NotFoundException(`Repository ${repositoryName} not found. Please add it via the dashboard first.`);
    }

    // Create scan record
    const scan = await this.prisma.scan.create({
      data: {
        tenantId,
        repositoryId: repository.id,
        commitSha,
        branch,
        triggeredBy: 'cli',
        triggerEvent: pullRequestId ? 'pull_request' : 'manual',
        pullRequestId,
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Process SARIF findings
    const findingsCount = await this.processSarifFindings(tenantId, scan.id, repository.id, sarif);

    // Update scan with findings count
    await this.prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: 'completed',
      },
    });

    return {
      scanId: scan.id,
      findingsCount,
      dashboardUrl: `${this.dashboardUrl}/dashboard/scans/${scan.id}`,
    };
  }

  async registerCliScan(
    tenantId: string,
    repositoryName: string,
    branch: string,
    commitSha: string,
    pullRequestId?: string,
  ) {
    const repository = await this.prisma.repository.findFirst({
      where: {
        tenantId,
        fullName: repositoryName,
      },
    });

    if (!repository) {
      throw new NotFoundException(`Repository ${repositoryName} not found`);
    }

    const scan = await this.prisma.scan.create({
      data: {
        tenantId,
        repositoryId: repository.id,
        commitSha,
        branch,
        triggeredBy: 'cli',
        triggerEvent: pullRequestId ? 'pull_request' : 'manual',
        pullRequestId,
        status: 'pending',
      },
    });

    return {
      scanId: scan.id,
      repository: repositoryName,
    };
  }

  private async processSarifFindings(
    tenantId: string,
    scanId: string,
    repositoryId: string,
    sarif: any,
  ): Promise<number> {
    const runs: SarifRun[] = sarif.runs || [];
    const findings: any[] = [];

    for (const run of runs) {
      const scanner = run.tool.driver.name;
      const rules = new Map<string, { name?: string; description?: string }>();

      // Build rules lookup
      for (const rule of run.tool.driver.rules || []) {
        rules.set(rule.id, {
          name: rule.name || rule.shortDescription?.text,
          description: rule.fullDescription?.text || rule.shortDescription?.text,
        });
      }

      // Process results
      for (const result of run.results || []) {
        const location = result.locations?.[0]?.physicalLocation;
        const rule = rules.get(result.ruleId);

        findings.push({
          tenantId,
          scanId,
          repositoryId,
          scanner: scanner.replace('ThreatDiviner/', '').toLowerCase(),
          ruleId: result.ruleId,
          severity: this.levelToSeverity(result.level),
          title: rule?.name || result.ruleId,
          description: result.message?.text || rule?.description,
          filePath: location?.artifactLocation?.uri || 'unknown',
          startLine: location?.region?.startLine || null,
          endLine: location?.region?.endLine || null,
          snippet: location?.region?.snippet?.text || null,
          status: 'open',
        });
      }
    }

    if (findings.length > 0) {
      await this.prisma.finding.createMany({
        data: findings,
        skipDuplicates: true,
      });
    }

    return findings.length;
  }

  private levelToSeverity(level: string): string {
    switch (level) {
      case 'error':
        return 'high';
      case 'warning':
        return 'medium';
      case 'note':
        return 'low';
      default:
        return 'info';
    }
  }
}
