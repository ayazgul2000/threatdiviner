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
    workDir?: string,
  ): Promise<number> {
    if (findings.length === 0) {
      return 0;
    }

    // Get the scan to retrieve projectId
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      select: { projectId: true },
    });
    const projectId = scan?.projectId || null;

    // Filter out findings in scanner output files (these are artifacts, not real vulnerabilities)
    const filteredFindings = findings.filter((f) => {
      const path = f.filePath.toLowerCase();
      if (
        path.endsWith('-results.json') ||
        path.endsWith('-results.sarif') ||
        path.endsWith('.gitleaksignore')
      ) {
        this.logger.debug(`Excluding scanner artifact: ${f.filePath}`);
        return false;
      }
      return true;
    });

    if (filteredFindings.length < findings.length) {
      this.logger.log(
        `Filtered ${findings.length - filteredFindings.length} scanner artifacts, storing ${filteredFindings.length} findings for scan ${scanId}`,
      );
    } else {
      this.logger.log(`Storing ${filteredFindings.length} findings for scan ${scanId}`);
    }

    // Transform to Prisma format
    const findingsData = filteredFindings.map((f) => ({
      tenantId,
      scanId,
      repositoryId,
      projectId, // Associate findings with the scan's project
      scanner: f.scanner,
      ruleId: this.extractShortRuleId(f.ruleId),
      severity: f.severity,
      title: f.title,
      description: f.description,
      filePath: this.getRelativePath(f.filePath, workDir),
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

  /**
   * Extract short rule ID from full path
   * e.g., "C.Dev.threatdiviner.apps.api.src...sql-injection-string-concat" -> "sql-injection-string-concat"
   */
  private extractShortRuleId(ruleId: string): string {
    // Split by dots and take the last segment
    const parts = ruleId.split('.');
    return parts[parts.length - 1] || ruleId;
  }

  /**
   * Convert absolute file path to relative path
   * Strips the workDir prefix from the path
   */
  private getRelativePath(filePath: string, workDir?: string): string {
    if (!workDir) {
      return filePath;
    }

    // Normalize both paths to lowercase forward slashes for comparison
    const normalizedWorkDir = workDir.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
    const normalizedPath = filePath.replace(/\\/g, '/');
    const normalizedPathLower = normalizedPath.toLowerCase();

    // If path starts with workDir, strip it (case-insensitive for Windows)
    if (normalizedPathLower.startsWith(normalizedWorkDir + '/')) {
      return normalizedPath.slice(normalizedWorkDir.length + 1);
    }

    // Try stripping just the scan directory name pattern for paths that may have different casing
    // Pattern: /tmp/threatdiviner-scans/{scanId}/
    const scanDirPattern = /^.*?threatdiviner-scans[\/\\][^\/\\]+[\/\\]/i;
    const match = normalizedPath.match(scanDirPattern);
    if (match) {
      return normalizedPath.slice(match[0].length);
    }

    // Path is already relative or doesn't match patterns - return as-is
    return filePath;
  }
}
