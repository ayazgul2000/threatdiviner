import { Injectable, Logger } from '@nestjs/common';

interface OpsGenieAlert {
  message: string;
  alias?: string;
  description?: string;
  responders?: { type: 'team' | 'user' | 'escalation' | 'schedule'; id?: string; name?: string }[];
  visibleTo?: { type: 'team' | 'user'; id?: string; name?: string }[];
  actions?: string[];
  tags?: string[];
  details?: Record<string, string>;
  entity?: string;
  source?: string;
  priority?: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  note?: string;
}

@Injectable()
export class OpsGenieService {
  private readonly logger = new Logger(OpsGenieService.name);
  private readonly alertsUrl = 'https://api.opsgenie.com/v2/alerts';

  async createAlert(apiKey: string, alert: OpsGenieAlert): Promise<boolean> {
    try {
      const response = await fetch(this.alertsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `GenieKey ${apiKey}`,
        },
        body: JSON.stringify(alert),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`OpsGenie API failed: ${response.status} - ${body}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to create OpsGenie alert: ${error}`);
      return false;
    }
  }

  async closeAlert(apiKey: string, alias: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.alertsUrl}/${alias}/close?identifierType=alias`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `GenieKey ${apiKey}`,
        },
        body: JSON.stringify({
          source: 'ThreatDiviner',
          note: 'Alert closed by ThreatDiviner',
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`OpsGenie close alert failed: ${response.status} - ${body}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to close OpsGenie alert: ${error}`);
      return false;
    }
  }

  async sendTestAlert(apiKey: string, tenantName: string): Promise<boolean> {
    return this.createAlert(apiKey, {
      message: `ThreatDiviner Test Alert - ${tenantName}`,
      alias: `threatdiviner-test-${Date.now()}`,
      description: 'This is a test alert to verify OpsGenie integration with ThreatDiviner.',
      tags: ['threatdiviner', 'test'],
      priority: 'P5',
      source: 'ThreatDiviner',
      details: {
        tenant: tenantName,
        type: 'integration-test',
      },
    });
  }

  async alertCriticalFinding(
    apiKey: string,
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

    return this.createAlert(apiKey, {
      message: `[${data.severity.toUpperCase()}] ${data.title}`,
      alias: `threatdiviner-finding-${data.findingId}`,
      description: `Security vulnerability found in ${data.repositoryName}\n\nFile: ${data.filePath}:${data.line}\nRule: ${data.ruleId}\n\nView in ThreatDiviner: ${dashboardUrl}/dashboard/findings/${data.findingId}`,
      tags: ['threatdiviner', 'security', data.severity.toLowerCase(), data.repositoryName],
      priority: this.mapSeverity(data.severity),
      source: 'ThreatDiviner',
      entity: data.repositoryName,
      actions: ['View Finding', 'Dismiss', 'Apply Fix'],
      details: {
        finding_id: data.findingId,
        repository: data.repositoryName,
        file_path: data.filePath,
        line: String(data.line),
        rule_id: data.ruleId,
        severity: data.severity,
        dashboard_url: `${dashboardUrl}/dashboard/findings/${data.findingId}`,
      },
    });
  }

  async alertScanFailed(
    apiKey: string,
    data: {
      repositoryName: string;
      branch: string;
      scanId: string;
      error?: string;
    },
  ): Promise<boolean> {
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';

    return this.createAlert(apiKey, {
      message: `Security scan failed: ${data.repositoryName}/${data.branch}`,
      alias: `threatdiviner-scan-${data.scanId}`,
      description: `Security scan failed for ${data.repositoryName} on branch ${data.branch}.\n\n${data.error ? `Error: ${data.error}` : ''}\n\nView scan: ${dashboardUrl}/dashboard/scans/${data.scanId}`,
      tags: ['threatdiviner', 'scan-failure', data.repositoryName],
      priority: 'P3',
      source: 'ThreatDiviner',
      entity: data.repositoryName,
      details: {
        scan_id: data.scanId,
        repository: data.repositoryName,
        branch: data.branch,
        error: data.error || 'Unknown error',
        dashboard_url: `${dashboardUrl}/dashboard/scans/${data.scanId}`,
      },
    });
  }

  async resolveFinding(apiKey: string, findingId: string): Promise<boolean> {
    return this.closeAlert(apiKey, `threatdiviner-finding-${findingId}`);
  }

  private mapSeverity(severity: string): 'P1' | 'P2' | 'P3' | 'P4' | 'P5' {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'P1';
      case 'high':
        return 'P2';
      case 'medium':
        return 'P3';
      case 'low':
        return 'P4';
      default:
        return 'P5';
    }
  }
}
