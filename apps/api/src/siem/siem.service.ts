import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenSearchProvider, SecurityEvent, SearchQuery, SearchResult } from './opensearch.provider';
import { AlertRulesService } from './alert-rules.service';
import { v4 as uuidv4 } from 'uuid';

export type EventSource = 'scan' | 'cspm' | 'auth' | 'api' | 'webhook' | 'system';
export type EventType =
  | 'finding.created'
  | 'finding.status_changed'
  | 'scan.started'
  | 'scan.completed'
  | 'scan.failed'
  | 'cspm.account_added'
  | 'cspm.scan_completed'
  | 'cspm.finding_detected'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed_login'
  | 'auth.password_changed'
  | 'api.key_created'
  | 'api.key_revoked'
  | 'webhook.received'
  | 'system.error'
  | 'system.alert';

@Injectable()
export class SiemService {
  private readonly logger = new Logger(SiemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opensearch: OpenSearchProvider,
    private readonly alertRules: AlertRulesService,
  ) {}

  /**
   * Record a security event
   */
  async recordEvent(
    tenantId: string,
    eventType: EventType,
    source: EventSource,
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
    title: string,
    options?: {
      description?: string;
      metadata?: Record<string, unknown>;
      tags?: string[];
    },
  ): Promise<SecurityEvent> {
    const event: SecurityEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      tenantId,
      eventType,
      source,
      severity,
      title,
      description: options?.description,
      metadata: options?.metadata || {},
      tags: options?.tags || [],
    };

    // Index in OpenSearch
    await this.opensearch.indexEvent(event);

    // Check alert rules
    await this.alertRules.processEvent(event);

    return event;
  }

  /**
   * Record finding events from scans
   */
  async recordFindingEvent(
    tenantId: string,
    action: 'created' | 'status_changed',
    finding: {
      id: string;
      severity: string;
      title: string;
      scanner: string;
      filePath: string;
      status: string;
      previousStatus?: string;
    },
  ): Promise<void> {
    await this.recordEvent(
      tenantId,
      `finding.${action}` as EventType,
      'scan',
      finding.severity as any,
      action === 'created'
        ? `New ${finding.severity} finding: ${finding.title}`
        : `Finding status changed: ${finding.previousStatus} → ${finding.status}`,
      {
        description: `Scanner: ${finding.scanner}, File: ${finding.filePath}`,
        metadata: finding,
        tags: [finding.scanner, finding.severity, finding.status],
      },
    );
  }

  /**
   * Record scan events
   */
  async recordScanEvent(
    tenantId: string,
    action: 'started' | 'completed' | 'failed',
    scan: {
      id: string;
      repositoryName: string;
      branch: string;
      findingsCount?: number;
      errorMessage?: string;
    },
  ): Promise<void> {
    const severityMap = {
      started: 'info' as const,
      completed: 'info' as const,
      failed: 'high' as const,
    };

    await this.recordEvent(
      tenantId,
      `scan.${action}` as EventType,
      'scan',
      severityMap[action],
      `Scan ${action}: ${scan.repositoryName} (${scan.branch})`,
      {
        description: scan.errorMessage || `Found ${scan.findingsCount || 0} issues`,
        metadata: scan,
        tags: [scan.repositoryName, scan.branch, action],
      },
    );
  }

  /**
   * Record authentication events
   */
  async recordAuthEvent(
    tenantId: string,
    action: 'login' | 'logout' | 'failed_login' | 'password_changed',
    user: {
      id: string;
      email: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<void> {
    const severityMap = {
      login: 'info' as const,
      logout: 'info' as const,
      failed_login: 'medium' as const,
      password_changed: 'medium' as const,
    };

    await this.recordEvent(
      tenantId,
      `auth.${action}` as EventType,
      'auth',
      severityMap[action],
      `User ${action}: ${user.email}`,
      {
        description: `IP: ${user.ipAddress || 'unknown'}`,
        metadata: user,
        tags: [action, user.email],
      },
    );
  }

  /**
   * Record CSPM events
   */
  async recordCspmEvent(
    tenantId: string,
    action: 'account_added' | 'scan_completed' | 'finding_detected',
    data: {
      accountId: string;
      provider: string;
      findingsCount?: number;
      severity?: string;
      title?: string;
    },
  ): Promise<void> {
    const severityMap = {
      account_added: 'info' as const,
      scan_completed: 'info' as const,
      finding_detected: (data.severity as any) || ('medium' as const),
    };

    const titles = {
      account_added: `Cloud account connected: ${data.provider}`,
      scan_completed: `CSPM scan completed: ${data.findingsCount || 0} findings`,
      finding_detected: data.title || 'CSPM finding detected',
    };

    await this.recordEvent(
      tenantId,
      `cspm.${action}` as EventType,
      'cspm',
      severityMap[action],
      titles[action],
      {
        metadata: data,
        tags: [data.provider, action],
      },
    );
  }

  /**
   * Search security events
   */
  async searchEvents(query: SearchQuery): Promise<SearchResult> {
    return this.opensearch.search(query);
  }

  /**
   * Get event aggregations for dashboards
   */
  async getEventDashboard(
    tenantId: string,
    timeRange: { start: Date; end: Date },
  ): Promise<{
    totalEvents: number;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
    byEventType: Record<string, number>;
    timeline: Array<{ date: string; count: number }>;
    recentCritical: SecurityEvent[];
  }> {
    const [aggregations, recentCritical] = await Promise.all([
      this.opensearch.getAggregations(tenantId, timeRange.start, timeRange.end),
      this.opensearch.search({
        tenantId,
        severities: ['critical'],
        startTime: timeRange.start,
        endTime: timeRange.end,
        size: 10,
      }),
    ]);

    const totalEvents = Object.values(aggregations.bySeverity).reduce(
      (sum, count) => sum + count,
      0,
    );

    return {
      totalEvents,
      ...aggregations,
      recentCritical: recentCritical.events,
    };
  }

  /**
   * Export events for compliance/audit
   */
  async exportEvents(
    tenantId: string,
    timeRange: { start: Date; end: Date },
    format: 'json' | 'csv',
  ): Promise<string> {
    const result = await this.opensearch.search({
      tenantId,
      startTime: timeRange.start,
      endTime: timeRange.end,
      size: 10000,
    });

    if (format === 'csv') {
      return this.eventsToCSV(result.events);
    }

    return JSON.stringify(result.events, null, 2);
  }

  private eventsToCSV(events: SecurityEvent[]): string {
    const headers = [
      'Timestamp',
      'Event Type',
      'Source',
      'Severity',
      'Title',
      'Description',
      'Tags',
    ];

    const rows = events.map((e) => [
      e.timestamp.toISOString(),
      e.eventType,
      e.source,
      e.severity,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      (e.tags || []).join(';'),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Get threat intelligence summary
   */
  async getThreatSummary(tenantId: string): Promise<{
    criticalThreats: number;
    highThreats: number;
    topVulnerabilities: Array<{ title: string; count: number }>;
    attackTrends: Array<{ date: string; attacks: number }>;
    riskScore: number;
  }> {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.opensearch.search({
      tenantId,
      startTime: last30Days,
      endTime: now,
      size: 0, // Just aggregations
    });

    const aggregations = await this.opensearch.getAggregations(
      tenantId,
      last30Days,
      now,
    );

    // Calculate risk score (0-100)
    const critical = aggregations.bySeverity['critical'] || 0;
    const high = aggregations.bySeverity['high'] || 0;
    const medium = aggregations.bySeverity['medium'] || 0;
    const total = result.total || 1;

    const riskScore = Math.min(
      100,
      Math.round((critical * 40 + high * 20 + medium * 5) / Math.max(total / 100, 1)),
    );

    return {
      criticalThreats: critical,
      highThreats: high,
      topVulnerabilities: [], // Would need additional aggregation
      attackTrends: aggregations.timeline,
      riskScore,
    };
  }
}
