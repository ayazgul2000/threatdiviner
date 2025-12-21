import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalTenants,
      activeTenants,
      totalUsers,
      totalRepositories,
      totalScans,
      totalFindings,
      scansToday,
      findingsToday,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.user.count(),
      this.prisma.repository.count(),
      this.prisma.scan.count(),
      this.prisma.finding.count(),
      this.prisma.scan.count({
        where: { createdAt: { gte: today } },
      }),
      this.prisma.finding.count({
        where: { createdAt: { gte: today } },
      }),
    ]);

    return {
      totalTenants,
      activeTenants,
      totalUsers,
      totalRepositories,
      totalScans,
      totalFindings,
      scansToday,
      findingsToday,
    };
  }

  async getHealth() {
    const startTime = Date.now();
    let dbLatency = 0;
    let dbStatus: 'healthy' | 'degraded' | 'down' = 'healthy';

    // Check database
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - dbStart;
      if (dbLatency > 100) {
        dbStatus = 'degraded';
      }
    } catch {
      dbStatus = 'down';
      dbLatency = 0;
    }

    // API latency is just the total time minus db time
    const apiLatency = Date.now() - startTime;

    return {
      api: {
        status: 'healthy' as const,
        latency: apiLatency,
      },
      database: {
        status: dbStatus,
        latency: dbLatency,
      },
      redis: {
        status: 'healthy' as const, // Would check Redis if configured
        latency: 3,
      },
      storage: {
        status: 'healthy' as const, // Would check MinIO if configured
        usage: 0.1, // Placeholder
      },
    };
  }
}
