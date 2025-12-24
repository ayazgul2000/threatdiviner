import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(tenantId: string) {
    // Get counts
    const [
      totalRepositories,
      activeConnections,
      totalScans,
      findingsData,
      recentScans,
      recentFindings,
    ] = await Promise.all([
      this.prisma.repository.count({
        where: { tenantId },
      }),
      this.prisma.scmConnection.count({
        where: { tenantId, isActive: true },
      }),
      this.prisma.scan.count({
        where: { repository: { tenantId } },
      }),
      this.prisma.finding.groupBy({
        by: ['severity'],
        where: {
          scan: { repository: { tenantId } },
          status: 'open',
        },
        _count: { severity: true },
      }),
      this.prisma.scan.findMany({
        where: { repository: { tenantId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          repository: {
            select: { fullName: true },
          },
        },
      }),
      this.prisma.finding.findMany({
        where: {
          scan: { repository: { tenantId } },
          status: 'open',
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          scan: {
            include: {
              repository: {
                select: { fullName: true },
              },
            },
          },
        },
      }),
    ]);

    // Calculate findings by severity
    const findingsBySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: 0,
    };

    for (const item of findingsData) {
      const severity = item.severity.toLowerCase() as keyof typeof findingsBySeverity;
      if (severity in findingsBySeverity) {
        findingsBySeverity[severity] = item._count.severity;
        findingsBySeverity.total += item._count.severity;
      }
    }

    return {
      totalRepositories,
      activeConnections,
      totalScans,
      openFindings: findingsBySeverity.total,
      findingsBySeverity,
      recentScans,
      recentFindings,
    };
  }
}
