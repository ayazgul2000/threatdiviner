import { Injectable, Logger } from '@nestjs/common';

interface PagerDutyEvent {
  routing_key: string;
  event_action: 'trigger' | 'acknowledge' | 'resolve';
  dedup_key?: string;
  payload: {
    summary: string;
    source: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    timestamp?: string;
    component?: string;
    group?: string;
    class?: string;
    custom_details?: Record<string, unknown>;
  };
  links?: { href: string; text: string }[];
  images?: { src: string; alt?: string; href?: string }[];
}

@Injectable()
export class PagerDutyService {
  private readonly logger = new Logger(PagerDutyService.name);
  private readonly eventsUrl = 'https://events.pagerduty.com/v2/enqueue';

  async sendEvent(routingKey: string, event: Omit<PagerDutyEvent, 'routing_key'>): Promise<boolean> {
    try {
      const payload: PagerDutyEvent = {
        routing_key: routingKey,
        ...event,
      };

      const response = await fetch(this.eventsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`PagerDuty API failed: ${response.status} - ${body}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to send PagerDuty event: ${error}`);
      return false;
    }
  }

  async sendTestEvent(routingKey: string, tenantName: string): Promise<boolean> {
    return this.sendEvent(routingKey, {
      event_action: 'trigger',
      dedup_key: `threatdiviner-test-${Date.now()}`,
      payload: {
        summary: `ThreatDiviner Test Alert - ${tenantName}`,
        source: 'ThreatDiviner',
        severity: 'info',
        timestamp: new Date().toISOString(),
        component: 'integration-test',
        class: 'test',
        custom_details: {
          tenant: tenantName,
          message: 'This is a test alert to verify PagerDuty integration',
        },
      },
    });
  }

  async triggerCriticalFinding(
    routingKey: string,
    data: {
      repositoryName: string;
      title: string;
      severity: string;
      filePath: string;
      line: number;
      ruleId: string;
      findingId: string;
    },
  ): Promise<boolean> {
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';

    return this.sendEvent(routingKey, {
      event_action: 'trigger',
      dedup_key: `threatdiviner-finding-${data.findingId}`,
      payload: {
        summary: `[${data.severity.toUpperCase()}] ${data.title} in ${data.repositoryName}`,
        source: 'ThreatDiviner',
        severity: this.mapSeverity(data.severity),
        timestamp: new Date().toISOString(),
        component: data.repositoryName,
        group: 'security-findings',
        class: 'vulnerability',
        custom_details: {
          finding_id: data.findingId,
          repository: data.repositoryName,
          file_path: data.filePath,
          line: data.line,
          rule_id: data.ruleId,
          severity: data.severity,
        },
      },
      links: [
        {
          href: `${dashboardUrl}/dashboard/findings/${data.findingId}`,
          text: 'View in ThreatDiviner',
        },
      ],
    });
  }

  async triggerScanFailed(
    routingKey: string,
    data: {
      repositoryName: string;
      branch: string;
      scanId: string;
      error?: string;
    },
  ): Promise<boolean> {
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';

    return this.sendEvent(routingKey, {
      event_action: 'trigger',
      dedup_key: `threatdiviner-scan-${data.scanId}`,
      payload: {
        summary: `Security scan failed for ${data.repositoryName}/${data.branch}`,
        source: 'ThreatDiviner',
        severity: 'error',
        timestamp: new Date().toISOString(),
        component: data.repositoryName,
        group: 'security-scans',
        class: 'scan-failure',
        custom_details: {
          scan_id: data.scanId,
          repository: data.repositoryName,
          branch: data.branch,
          error: data.error,
        },
      },
      links: [
        {
          href: `${dashboardUrl}/dashboard/scans/${data.scanId}`,
          text: 'View Scan Details',
        },
      ],
    });
  }

  async resolveFinding(routingKey: string, findingId: string): Promise<boolean> {
    return this.sendEvent(routingKey, {
      event_action: 'resolve',
      dedup_key: `threatdiviner-finding-${findingId}`,
      payload: {
        summary: `Finding ${findingId} resolved`,
        source: 'ThreatDiviner',
        severity: 'info',
      },
    });
  }

  private mapSeverity(severity: string): 'critical' | 'error' | 'warning' | 'info' {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'info';
    }
  }
}
