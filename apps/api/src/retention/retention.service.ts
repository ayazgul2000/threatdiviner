import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

export interface RetentionStats {
  scansDeleted: number;
  findingsDeleted: number;
  auditLogsDeleted: number;
  webhookEventsDeleted: number;
  duration: number;
}

export interface TenantRetentionConfig {
  scanRetentionDays: number;
  findingRetentionDays: number;
  auditRetentionDays: number;
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run daily at 3am to clean up old data
   */
  @Cron('0 3 * * *') // 3am daily
  async runRetentionCleanup(): Promise<void> {
    this.logger.log('Starting scheduled retention cleanup...');

    try {
      const stats = await this.cleanupAllTenants();
      this.logger.log(
        `Retention cleanup completed: ${stats.scansDeleted} scans, ${stats.findingsDeleted} findings, ${stats.auditLogsDeleted} audit logs deleted`,
      );
    } catch (error) {
      this.logger.error(`Retention cleanup failed: ${error}`);
    }
  }

  /**
   * Clean up old data for all tenants
   */
  async cleanupAllTenants(): Promise<RetentionStats> {
    const startTime = Date.now();

    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        scanRetentionDays: true,
        findingRetentionDays: true,
        auditRetentionDays: true,
      },
    });

    let totalScansDeleted = 0;
    let totalFindingsDeleted = 0;
    let totalAuditLogsDeleted = 0;

    for (const tenant of tenants) {
      try {
        const stats = await this.cleanupTenant(tenant.id, {
          scanRetentionDays: tenant.scanRetentionDays,
          findingRetentionDays: tenant.findingRetentionDays,
          auditRetentionDays: tenant.auditRetentionDays,
        });

        totalScansDeleted += stats.scansDeleted;
        totalFindingsDeleted += stats.findingsDeleted;
        totalAuditLogsDeleted += stats.auditLogsDeleted;
      } catch (error) {
        this.logger.error(`Retention cleanup failed for tenant ${tenant.id}: ${error}`);
      }
    }

    // Clean up old webhook events (platform-wide, 30 days)
    const webhookEventsDeleted = await this.cleanupWebhookEvents(30);

    const duration = Date.now() - startTime;

    return {
      scansDeleted: totalScansDeleted,
      findingsDeleted: totalFindingsDeleted,
      auditLogsDeleted: totalAuditLogsDeleted,
      webhookEventsDeleted,
      duration,
    };
  }

  /**
   * Clean up old data for a specific tenant
   */
  async cleanupTenant(tenantId: string, config: TenantRetentionConfig): Promise<Omit<RetentionStats, 'webhookEventsDeleted' | 'duration'>> {
    const now = new Date();

    // Calculate cutoff dates
    const scanCutoff = new Date(now.getTime() - config.scanRetentionDays * 24 * 60 * 60 * 1000);
    const findingCutoff = new Date(now.getTime() - config.findingRetentionDays * 24 * 60 * 60 * 1000);
    const auditCutoff = new Date(now.getTime() - config.auditRetentionDays * 24 * 60 * 60 * 1000);

    // Delete old findings first (to avoid foreign key issues)
    const findingsResult = await this.prisma.finding.deleteMany({
      where: {
        tenantId,
        createdAt: { lt: findingCutoff },
      },
    });

    // Delete old scans (after their findings are removed)
    const scansResult = await this.prisma.scan.deleteMany({
      where: {
        tenantId,
        createdAt: { lt: scanCutoff },
        // Only delete scans that have no findings (should be true after above)
        findings: { none: {} },
      },
    });

    // Delete old audit logs
    const auditResult = await this.prisma.auditLog.deleteMany({
      where: {
        tenantId,
        createdAt: { lt: auditCutoff },
      },
    });

    this.logger.debug(
      `Tenant ${tenantId}: deleted ${scansResult.count} scans, ${findingsResult.count} findings, ${auditResult.count} audit logs`,
    );

    return {
      scansDeleted: scansResult.count,
      findingsDeleted: findingsResult.count,
      auditLogsDeleted: auditResult.count,
    };
  }

  /**
   * Clean up old webhook events
   */
  async cleanupWebhookEvents(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const result = await this.prisma.webhookEvent.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });

    return result.count;
  }

  /**
   * Clean up expired baselines
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredBaselines(): Promise<number> {
    const result = await this.prisma.findingBaseline.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired baselines`);
    }

    return result.count;
  }

  /**
   * Clean up expired API keys
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupExpiredApiKeys(): Promise<number> {
    const result = await this.prisma.apiKey.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired API keys`);
    }

    return result.count;
  }

  /**
   * Get retention configuration for a tenant
   */
  async getTenantRetentionConfig(tenantId: string): Promise<TenantRetentionConfig | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        scanRetentionDays: true,
        findingRetentionDays: true,
        auditRetentionDays: true,
      },
    });

    return tenant;
  }

  /**
   * Update retention configuration for a tenant
   */
  async updateTenantRetentionConfig(
    tenantId: string,
    config: Partial<TenantRetentionConfig>,
  ): Promise<TenantRetentionConfig> {
    // Validate minimum retention periods
    if (config.scanRetentionDays !== undefined && config.scanRetentionDays < 7) {
      throw new Error('Minimum scan retention is 7 days');
    }
    if (config.findingRetentionDays !== undefined && config.findingRetentionDays < 30) {
      throw new Error('Minimum finding retention is 30 days');
    }
    if (config.auditRetentionDays !== undefined && config.auditRetentionDays < 30) {
      throw new Error('Minimum audit log retention is 30 days');
    }

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...config,
        updatedAt: new Date(),
      },
      select: {
        scanRetentionDays: true,
        findingRetentionDays: true,
        auditRetentionDays: true,
      },
    });

    this.logger.log(`Updated retention config for tenant ${tenantId}`);

    return tenant;
  }

  /**
   * Get storage usage statistics for a tenant
   */
  async getTenantStorageStats(tenantId: string): Promise<{
    scans: { count: number; oldestDate: Date | null };
    findings: { count: number; oldestDate: Date | null };
    auditLogs: { count: number; oldestDate: Date | null };
  }> {
    const [scansCount, findingsCount, auditLogsCount, oldestScan, oldestFinding, oldestAuditLog] = await Promise.all([
      this.prisma.scan.count({ where: { tenantId } }),
      this.prisma.finding.count({ where: { tenantId } }),
      this.prisma.auditLog.count({ where: { tenantId } }),
      this.prisma.scan.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.finding.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.auditLog.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      scans: { count: scansCount, oldestDate: oldestScan?.createdAt || null },
      findings: { count: findingsCount, oldestDate: oldestFinding?.createdAt || null },
      auditLogs: { count: auditLogsCount, oldestDate: oldestAuditLog?.createdAt || null },
    };
  }
}
