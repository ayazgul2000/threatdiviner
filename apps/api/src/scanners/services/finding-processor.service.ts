import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NormalizedFinding } from '../interfaces';
import { FindingsCount } from '../../queue/jobs';

@Injectable()
export class FindingProcessorService {
  private readonly logger = new Logger(FindingProcessorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async storeFindings(
    scanId: string,
    tenantId: string,
    repositoryId: string,
    findings: NormalizedFinding[],
  ): Promise<number> {
    if (findings.length === 0) {
      return 0;
    }

    this.logger.log(`Storing ${findings.length} findings for scan ${scanId}`);

    // Transform to Prisma format
    const findingsData = findings.map((f) => ({
      tenantId,
      scanId,
      repositoryId,
      scanner: f.scanner,
      ruleId: f.ruleId,
      severity: f.severity,
      title: f.title,
      description: f.description,
      filePath: f.filePath,
      startLine: f.startLine,
      endLine: f.endLine,
      snippet: f.snippet,
      cweId: f.cweIds[0] || null,
      cveId: f.cveIds[0] || null,
      owasp: f.owaspIds[0] || null,
      confidence: f.confidence,
      status: 'open',
      updatedAt: new Date(),
    }));

    // Batch insert
    const result = await this.prisma.finding.createMany({
      data: findingsData,
      skipDuplicates: true,
    });

    this.logger.log(`Stored ${result.count} findings`);
    return result.count;
  }

  async countFindingsBySeverity(scanId: string): Promise<FindingsCount> {
    const counts = await this.prisma.finding.groupBy({
      by: ['severity'],
      where: { scanId },
      _count: { id: true },
    });

    const result: FindingsCount = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const count of counts) {
      const severity = count.severity as keyof FindingsCount;
      if (severity in result) {
        result[severity] = count._count.id;
      }
    }

    return result;
  }

  deduplicateFindings(findings: NormalizedFinding[]): NormalizedFinding[] {
    const seen = new Set<string>();
    const deduplicated: NormalizedFinding[] = [];

    for (const finding of findings) {
      if (!seen.has(finding.fingerprint)) {
        seen.add(finding.fingerprint);
        deduplicated.push(finding);
      }
    }

    this.logger.log(
      `Deduplicated ${findings.length} → ${deduplicated.length} findings`,
    );

    return deduplicated;
  }

  async getExistingFingerprints(
    repositoryId: string,
  ): Promise<Set<string>> {
    // Get fingerprints of existing open findings for this repo
    // to avoid re-reporting the same issues
    const existing = await this.prisma.finding.findMany({
      where: {
        repositoryId,
        status: { in: ['open', 'triaged'] },
      },
      select: {
        ruleId: true,
        filePath: true,
        startLine: true,
      },
    });

    const fingerprints = new Set<string>();
    for (const f of existing) {
      // Simple fingerprint for existing findings
      fingerprints.add(`${f.ruleId}|${f.filePath}|${f.startLine}`);
    }

    return fingerprints;
  }
}
