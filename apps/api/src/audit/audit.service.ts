import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLog } from '@prisma/client';

export type AuditAction =
  | 'scan.trigger'
  | 'scan.cancel'
  | 'scan.complete'
  | 'finding.status_change'
  | 'finding.triage'
  | 'user.login'
  | 'user.logout'
  | 'user.invite'
  | 'user.role_change'
  | 'user.remove'
  | 'user.password_change'
  | 'repository.add'
  | 'repository.remove'
  | 'repository.config_change'
  | 'notification.config_change'
  | 'connection.add'
  | 'connection.remove'
  | 'tenant.create'
  | 'tenant.update'
  | 'admin.login'
  | 'admin.config_change';

export type AuditResource =
  | 'scan'
  | 'finding'
  | 'user'
  | 'repository'
  | 'notification'
  | 'connection'
  | 'tenant'
  | 'platform';

export interface AuditLogEntry {
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogQuery {
  tenantId?: string;
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<AuditLog> {
    try {
      const auditLog = await this.prisma.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          userId: entry.userId,
          userEmail: entry.userEmail,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          details: entry.details as object,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });

      this.logger.debug(`Audit: ${entry.action} on ${entry.resource}${entry.resourceId ? `/${entry.resourceId}` : ''} by ${entry.userEmail || entry.userId || 'system'}`);

      return auditLog;
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error}`);
      throw error;
    }
  }

  async query(params: AuditLogQuery): Promise<{ logs: AuditLog[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (params.tenantId) where.tenantId = params.tenantId;
    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = params.action;
    if (params.resource) where.resource = params.resource;

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) (where.createdAt as Record<string, Date>).gte = params.startDate;
      if (params.endDate) (where.createdAt as Record<string, Date>).lte = params.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  async getRecentActivity(tenantId: string, limit = 20): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUserActivity(userId: string, limit = 50): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getResourceHistory(resource: AuditResource, resourceId: string, limit = 50): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { resource, resourceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getStats(tenantId?: string): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    activeUsers: number;
    recentActivity: AuditLog[];
  }> {
    const where = tenantId ? { tenantId } : {};
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const [totalActions, actionsByType, activeUsers, recentActivity] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where: { ...where, createdAt: { gte: lastWeek } },
        _count: { action: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { ...where, createdAt: { gte: lastWeek }, userId: { not: null } },
      }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      totalActions,
      actionsByType: actionsByType.reduce(
        (acc, curr) => ({ ...acc, [curr.action]: curr._count.action }),
        {} as Record<string, number>,
      ),
      activeUsers: activeUsers.length,
      recentActivity,
    };
  }

  async cleanup(daysToKeep = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoffDate } },
    });

    this.logger.log(`Cleaned up ${result.count} audit log entries older than ${daysToKeep} days`);
    return result.count;
  }
}
