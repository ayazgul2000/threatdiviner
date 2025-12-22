import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

export interface CreateBaselineDto {
  findingId?: string;
  fingerprint?: string;
  repositoryId: string;
  reason: string;
  expiresAt?: Date;
}

export interface BaselineCompareResult {
  newFindings: number;
  baselinedFindings: number;
  findings: {
    id: string;
    title: string;
    severity: string;
    isBaselined: boolean;
  }[];
}

@Injectable()
export class BaselineService {
  private readonly logger = new Logger(BaselineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate fingerprint for a finding
   */
  generateFingerprint(ruleId: string, filePath: string, snippet?: string): string {
    const content = `${ruleId}|${filePath}|${snippet || ''}`;
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
  }

  /**
   * Add a finding to baseline
   */
  async addToBaseline(
    tenantId: string,
    userId: string,
    data: CreateBaselineDto,
  ): Promise<any> {
    let fingerprint = data.fingerprint;
    let repositoryId = data.repositoryId;

    // If findingId provided, get fingerprint from finding
    if (data.findingId) {
      const finding = await this.prisma.finding.findFirst({
        where: { id: data.findingId, tenantId },
        include: { scan: true },
      });

      if (!finding) {
        throw new NotFoundException('Finding not found');
      }

      fingerprint = finding.fingerprint || this.generateFingerprint(
        finding.ruleId,
        finding.filePath,
        finding.snippet || undefined,
      );
      repositoryId = finding.scan.repositoryId;

      // Update finding with fingerprint if not set
      if (!finding.fingerprint) {
        await this.prisma.finding.update({
          where: { id: finding.id },
          data: { fingerprint },
        });
      }
    }

    if (!fingerprint) {
      throw new NotFoundException('Fingerprint is required');
    }

    // Check if already baselined
    const existing = await this.prisma.findingBaseline.findFirst({
      where: {
        tenantId,
        repositoryId,
        fingerprint,
      },
    });

    if (existing) {
      throw new ConflictException('Finding is already baselined');
    }

    // Create baseline entry
    const baseline = await this.prisma.findingBaseline.create({
      data: {
        tenantId,
        repositoryId,
        fingerprint,
        reason: data.reason,
        baselinedBy: userId,
        expiresAt: data.expiresAt,
      },
      include: {
        repository: {
          select: { fullName: true },
        },
      },
    });

    // Update any matching findings to 'baselined' status
    await this.prisma.finding.updateMany({
      where: {
        tenantId,
        fingerprint,
        status: { not: 'baselined' },
      },
      data: {
        status: 'baselined',
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Added baseline for fingerprint ${fingerprint} in repo ${repositoryId}`);

    return baseline;
  }

  /**
   * Remove a finding from baseline
   */
  async removeFromBaseline(tenantId: string, baselineId: string): Promise<void> {
    const baseline = await this.prisma.findingBaseline.findFirst({
      where: { id: baselineId, tenantId },
    });

    if (!baseline) {
      throw new NotFoundException('Baseline entry not found');
    }

    // Delete baseline
    await this.prisma.findingBaseline.delete({
      where: { id: baselineId },
    });

    // Reopen matching findings
    await this.prisma.finding.updateMany({
      where: {
        tenantId,
        fingerprint: baseline.fingerprint,
        status: 'baselined',
      },
      data: {
        status: 'open',
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Removed baseline ${baselineId}`);
  }

  /**
   * List baselines for a repository
   */
  async listBaselines(
    tenantId: string,
    repositoryId?: string,
    page = 1,
    limit = 50,
  ): Promise<{ baselines: any[]; total: number }> {
    const where: any = { tenantId };
    if (repositoryId) {
      where.repositoryId = repositoryId;
    }

    const [baselines, total] = await Promise.all([
      this.prisma.findingBaseline.findMany({
        where,
        include: {
          repository: {
            select: { fullName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.findingBaseline.count({ where }),
    ]);

    // Enrich with finding count
    const enriched = await Promise.all(
      baselines.map(async (b) => {
        const matchingFindings = await this.prisma.finding.count({
          where: {
            tenantId,
            fingerprint: b.fingerprint,
          },
        });

        return {
          ...b,
          matchingFindingsCount: matchingFindings,
        };
      }),
    );

    return { baselines: enriched, total };
  }

  /**
   * Compare scan findings against baseline
   */
  async compareScanToBaseline(tenantId: string, scanId: string): Promise<BaselineCompareResult> {
    const scan = await this.prisma.scan.findFirst({
      where: { id: scanId, tenantId },
      include: {
        findings: true,
      },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    // Get all baselines for this repository
    const baselines = await this.prisma.findingBaseline.findMany({
      where: {
        tenantId,
        repositoryId: scan.repositoryId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    const baselineFingerprints = new Set(baselines.map(b => b.fingerprint));

    let newFindings = 0;
    let baselinedFindings = 0;
    const findings: BaselineCompareResult['findings'] = [];

    for (const finding of scan.findings) {
      const fp = finding.fingerprint || this.generateFingerprint(
        finding.ruleId,
        finding.filePath,
        finding.snippet || undefined,
      );

      const isBaselined = baselineFingerprints.has(fp);

      if (isBaselined) {
        baselinedFindings++;
      } else {
        newFindings++;
      }

      findings.push({
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        isBaselined,
      });
    }

    return {
      newFindings,
      baselinedFindings,
      findings,
    };
  }

  /**
   * Import baseline from a scan (baseline all current findings)
   */
  async importBaselineFromScan(
    tenantId: string,
    userId: string,
    scanId: string,
    reason = 'Imported from scan baseline',
  ): Promise<{ imported: number; skipped: number }> {
    const scan = await this.prisma.scan.findFirst({
      where: { id: scanId, tenantId },
      include: { findings: true },
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    let imported = 0;
    let skipped = 0;

    for (const finding of scan.findings) {
      const fingerprint = finding.fingerprint || this.generateFingerprint(
        finding.ruleId,
        finding.filePath,
        finding.snippet || undefined,
      );

      // Update fingerprint if not set
      if (!finding.fingerprint) {
        await this.prisma.finding.update({
          where: { id: finding.id },
          data: { fingerprint },
        });
      }

      try {
        await this.prisma.findingBaseline.create({
          data: {
            tenantId,
            repositoryId: scan.repositoryId,
            fingerprint,
            reason,
            baselinedBy: userId,
          },
        });
        imported++;
      } catch {
        // Already exists
        skipped++;
      }
    }

    // Update all findings to baselined status
    await this.prisma.finding.updateMany({
      where: {
        scanId,
        status: { not: 'baselined' },
      },
      data: {
        status: 'baselined',
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Imported baseline from scan ${scanId}: ${imported} added, ${skipped} skipped`);

    return { imported, skipped };
  }

  /**
   * Cleanup expired baselines
   */
  async cleanupExpiredBaselines(): Promise<number> {
    const expired = await this.prisma.findingBaseline.findMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    if (expired.length === 0) {
      return 0;
    }

    // Delete expired baselines
    await this.prisma.findingBaseline.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    // Reopen affected findings
    for (const baseline of expired) {
      await this.prisma.finding.updateMany({
        where: {
          tenantId: baseline.tenantId,
          fingerprint: baseline.fingerprint,
          status: 'baselined',
        },
        data: {
          status: 'open',
          updatedAt: new Date(),
        },
      });
    }

    this.logger.log(`Cleaned up ${expired.length} expired baselines`);

    return expired.length;
  }
}
