import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

export interface SlaPolicy {
  severity: string;
  remediationDays: number;
  escalationDays: number;
  description: string;
}

export interface SlaSummary {
  onTrack: number;
  atRisk: number;
  breached: number;
  total: number;
}

export interface FindingSlaStatus {
  findingId: string;
  severity: string;
  createdAt: Date;
  dueDate: Date;
  escalationDate: Date;
  status: 'on_track' | 'at_risk' | 'breached';
  daysRemaining: number;
  daysOverdue: number;
}

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);
  private readonly enableSlaTracking: boolean;

  // Default SLA policies (can be overridden per tenant)
  private readonly DEFAULT_POLICIES: SlaPolicy[] = [
    {
      severity: 'critical',
      remediationDays: 7,
      escalationDays: 3,
      description: 'Critical vulnerabilities must be fixed within 7 days',
    },
    {
      severity: 'high',
      remediationDays: 30,
      escalationDays: 14,
      description: 'High vulnerabilities must be fixed within 30 days',
    },
    {
      severity: 'medium',
      remediationDays: 90,
      escalationDays: 45,
      description: 'Medium vulnerabilities must be fixed within 90 days',
    },
    {
      severity: 'low',
      remediationDays: 180,
      escalationDays: 90,
      description: 'Low vulnerabilities should be fixed within 180 days',
    },
    {
      severity: 'info',
      remediationDays: 365,
      escalationDays: 180,
      description: 'Informational findings tracked for 365 days',
    },
  ];

  // KEV-specific SLA (per CISA guidance)
  private readonly KEV_POLICY: SlaPolicy = {
    severity: 'kev',
    remediationDays: 14,
    escalationDays: 7,
    description: 'Known Exploited Vulnerabilities must be fixed within 14 days (CISA BOD)',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.enableSlaTracking = this.configService.get<boolean>('SLA_TRACKING_ENABLED', true);
  }

  /**
   * Get SLA policy for a severity level
   */
  getSlaPolicy(severity: string, isKev: boolean = false): SlaPolicy {
    if (isKev) {
      return this.KEV_POLICY;
    }
    return this.DEFAULT_POLICIES.find(p => p.severity === severity.toLowerCase()) || this.DEFAULT_POLICIES[4];
  }

  /**
   * Get all default SLA policies
   */
  getAllPolicies(): SlaPolicy[] {
    return [...this.DEFAULT_POLICIES, this.KEV_POLICY];
  }

  /**
   * Calculate SLA status for a finding
   */
  calculateSlaDates(
    createdAt: Date,
    severity: string,
    isKev: boolean = false,
  ): { dueDate: Date; escalationDate: Date } {
    const policy = this.getSlaPolicy(severity, isKev);

    const dueDate = new Date(createdAt);
    dueDate.setDate(dueDate.getDate() + policy.remediationDays);

    const escalationDate = new Date(createdAt);
    escalationDate.setDate(escalationDate.getDate() + policy.escalationDays);

    return { dueDate, escalationDate };
  }

  /**
   * Get SLA status for a finding
   */
  getFindingSlaStatus(
    findingId: string,
    createdAt: Date,
    severity: string,
    isKev: boolean = false,
    status: string = 'open',
  ): FindingSlaStatus {
    const { dueDate, escalationDate } = this.calculateSlaDates(createdAt, severity, isKev);
    const now = new Date();

    // Fixed/closed findings are always on track
    if (['fixed', 'false_positive', 'accepted'].includes(status)) {
      return {
        findingId,
        severity,
        createdAt,
        dueDate,
        escalationDate,
        status: 'on_track',
        daysRemaining: 0,
        daysOverdue: 0,
      };
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / msPerDay);

    let slaStatus: 'on_track' | 'at_risk' | 'breached';
    if (now > dueDate) {
      slaStatus = 'breached';
    } else if (now > escalationDate) {
      slaStatus = 'at_risk';
    } else {
      slaStatus = 'on_track';
    }

    return {
      findingId,
      severity,
      createdAt,
      dueDate,
      escalationDate,
      status: slaStatus,
      daysRemaining: Math.max(0, daysUntilDue),
      daysOverdue: Math.abs(Math.min(0, daysUntilDue)),
    };
  }

  /**
   * Get SLA summary for a tenant
   */
  async getSlaSummary(tenantId: string): Promise<SlaSummary> {
    const findings = await this.prisma.finding.findMany({
      where: {
        tenantId,
        status: { in: ['open', 'triaged'] },
      },
      select: {
        id: true,
        createdAt: true,
        severity: true,
        isKev: true,
        status: true,
      },
    });

    let onTrack = 0;
    let atRisk = 0;
    let breached = 0;

    for (const finding of findings) {
      const slaStatus = this.getFindingSlaStatus(
        finding.id,
        finding.createdAt,
        finding.severity,
        finding.isKev || false,
        finding.status,
      );

      switch (slaStatus.status) {
        case 'on_track':
          onTrack++;
          break;
        case 'at_risk':
          atRisk++;
          break;
        case 'breached':
          breached++;
          break;
      }
    }

    return {
      onTrack,
      atRisk,
      breached,
      total: findings.length,
    };
  }

  /**
   * Get findings approaching SLA breach
   */
  async getAtRiskFindings(tenantId: string, limit: number = 20): Promise<FindingSlaStatus[]> {
    const findings = await this.prisma.finding.findMany({
      where: {
        tenantId,
        status: { in: ['open', 'triaged'] },
      },
      select: {
        id: true,
        createdAt: true,
        severity: true,
        isKev: true,
        status: true,
      },
    });

    const atRiskFindings: FindingSlaStatus[] = [];

    for (const finding of findings) {
      const slaStatus = this.getFindingSlaStatus(
        finding.id,
        finding.createdAt,
        finding.severity,
        finding.isKev || false,
        finding.status,
      );

      if (slaStatus.status === 'at_risk') {
        atRiskFindings.push(slaStatus);
      }
    }

    // Sort by days remaining (least first)
    atRiskFindings.sort((a, b) => a.daysRemaining - b.daysRemaining);

    return atRiskFindings.slice(0, limit);
  }

  /**
   * Get SLA breached findings
   */
  async getBreachedFindings(tenantId: string, limit: number = 50): Promise<FindingSlaStatus[]> {
    const findings = await this.prisma.finding.findMany({
      where: {
        tenantId,
        status: { in: ['open', 'triaged'] },
      },
      select: {
        id: true,
        createdAt: true,
        severity: true,
        isKev: true,
        status: true,
      },
    });

    const breachedFindings: FindingSlaStatus[] = [];

    for (const finding of findings) {
      const slaStatus = this.getFindingSlaStatus(
        finding.id,
        finding.createdAt,
        finding.severity,
        finding.isKev || false,
        finding.status,
      );

      if (slaStatus.status === 'breached') {
        breachedFindings.push(slaStatus);
      }
    }

    // Sort by days overdue (most first)
    breachedFindings.sort((a, b) => b.daysOverdue - a.daysOverdue);

    return breachedFindings.slice(0, limit);
  }

  /**
   * Get SLA summary by severity
   */
  async getSlaSummaryBySeverity(tenantId: string): Promise<Record<string, SlaSummary>> {
    const findings = await this.prisma.finding.findMany({
      where: {
        tenantId,
        status: { in: ['open', 'triaged'] },
      },
      select: {
        id: true,
        createdAt: true,
        severity: true,
        isKev: true,
        status: true,
      },
    });

    const summaryBySeverity: Record<string, SlaSummary> = {
      critical: { onTrack: 0, atRisk: 0, breached: 0, total: 0 },
      high: { onTrack: 0, atRisk: 0, breached: 0, total: 0 },
      medium: { onTrack: 0, atRisk: 0, breached: 0, total: 0 },
      low: { onTrack: 0, atRisk: 0, breached: 0, total: 0 },
      info: { onTrack: 0, atRisk: 0, breached: 0, total: 0 },
    };

    for (const finding of findings) {
      const severity = finding.severity.toLowerCase();
      if (!summaryBySeverity[severity]) {
        summaryBySeverity[severity] = { onTrack: 0, atRisk: 0, breached: 0, total: 0 };
      }

      const slaStatus = this.getFindingSlaStatus(
        finding.id,
        finding.createdAt,
        finding.severity,
        finding.isKev || false,
        finding.status,
      );

      summaryBySeverity[severity].total++;

      switch (slaStatus.status) {
        case 'on_track':
          summaryBySeverity[severity].onTrack++;
          break;
        case 'at_risk':
          summaryBySeverity[severity].atRisk++;
          break;
        case 'breached':
          summaryBySeverity[severity].breached++;
          break;
      }
    }

    return summaryBySeverity;
  }

  /**
   * Calculate mean time to remediation (MTTR) for closed findings
   */
  async getMTTR(tenantId: string, days: number = 90): Promise<Record<string, number>> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const findings = await this.prisma.finding.findMany({
      where: {
        tenantId,
        status: 'fixed',
        updatedAt: { gte: sinceDate },
      },
      select: {
        severity: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const mttrBySeverity: Record<string, { total: number; count: number }> = {
      critical: { total: 0, count: 0 },
      high: { total: 0, count: 0 },
      medium: { total: 0, count: 0 },
      low: { total: 0, count: 0 },
      info: { total: 0, count: 0 },
    };

    for (const finding of findings) {
      const severity = finding.severity.toLowerCase();
      if (!mttrBySeverity[severity]) {
        mttrBySeverity[severity] = { total: 0, count: 0 };
      }

      const msPerDay = 24 * 60 * 60 * 1000;
      const daysToFix = Math.floor((finding.updatedAt.getTime() - finding.createdAt.getTime()) / msPerDay);

      mttrBySeverity[severity].total += daysToFix;
      mttrBySeverity[severity].count++;
    }

    const result: Record<string, number> = {};
    for (const [severity, data] of Object.entries(mttrBySeverity)) {
      result[severity] = data.count > 0 ? Math.round(data.total / data.count) : 0;
    }

    return result;
  }

  /**
   * Daily SLA check - log warnings for at-risk and breached findings
   */
  @Cron('0 8 * * *') // 8 AM UTC daily
  async dailySlaCheck(): Promise<void> {
    if (!this.enableSlaTracking) return;

    this.logger.log('Running daily SLA check...');

    // Get all tenants
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    for (const tenant of tenants) {
      const summary = await this.getSlaSummary(tenant.id);

      if (summary.breached > 0) {
        this.logger.warn(
          `[${tenant.name}] SLA BREACH: ${summary.breached} findings have exceeded SLA`,
        );
      }

      if (summary.atRisk > 0) {
        this.logger.warn(
          `[${tenant.name}] SLA AT RISK: ${summary.atRisk} findings approaching SLA deadline`,
        );
      }
    }

    this.logger.log('Daily SLA check complete');
  }
}
