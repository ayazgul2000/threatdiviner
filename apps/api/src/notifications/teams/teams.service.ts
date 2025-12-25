import { Injectable, Logger } from '@nestjs/common';

export interface TeamsCardData {
  title: string;
  summary: string;
  themeColor: string;
  sections: TeamsCardSection[];
  potentialAction?: TeamsCardAction[];
}

interface TeamsCardSection {
  activityTitle?: string;
  activitySubtitle?: string;
  activityImage?: string;
  facts?: { name: string; value: string }[];
  text?: string;
}

interface TeamsCardAction {
  '@type': 'OpenUri';
  name: string;
  targets: { os: string; uri: string }[];
}

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  async sendMessage(webhookUrl: string, card: TeamsCardData): Promise<boolean> {
    try {
      const payload = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: card.themeColor,
        summary: card.summary,
        title: card.title,
        sections: card.sections,
        potentialAction: card.potentialAction,
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.error(`Teams webhook failed: ${response.status}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to send Teams message: ${error}`);
      return false;
    }
  }

  async sendTestMessage(webhookUrl: string, tenantName: string): Promise<boolean> {
    return this.sendMessage(webhookUrl, {
      title: 'ThreatDiviner Connected!',
      summary: 'Test notification from ThreatDiviner',
      themeColor: '0076D7',
      sections: [
        {
          activityTitle: `**${tenantName}** connected to ThreatDiviner`,
          activitySubtitle: new Date().toISOString(),
          facts: [
            { name: 'Status', value: 'Connection Verified' },
            { name: 'Platform', value: 'Microsoft Teams' },
          ],
        },
      ],
    });
  }

  async sendScanCompleted(
    webhookUrl: string,
    data: {
      repositoryName: string;
      branch: string;
      commitSha: string;
      status: 'success' | 'failure' | 'neutral';
      duration: number;
      findings: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        total: number;
      };
      scanId: string;
    },
  ): Promise<boolean> {
    const statusEmoji = data.status === 'success' ? '✅' : data.status === 'failure' ? '❌' : '⚠️';
    const themeColor = data.status === 'success' ? '00FF00' : data.status === 'failure' ? 'FF0000' : 'FFA500';

    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';

    return this.sendMessage(webhookUrl, {
      title: `${statusEmoji} Security Scan Complete`,
      summary: `Scan completed for ${data.repositoryName}`,
      themeColor,
      sections: [
        {
          activityTitle: `**${data.repositoryName}**`,
          activitySubtitle: `Branch: ${data.branch} | Commit: ${data.commitSha.substring(0, 7)}`,
          facts: [
            { name: 'Duration', value: `${Math.round(data.duration / 1000)}s` },
            { name: 'Critical', value: String(data.findings.critical) },
            { name: 'High', value: String(data.findings.high) },
            { name: 'Medium', value: String(data.findings.medium) },
            { name: 'Low', value: String(data.findings.low) },
            { name: 'Total', value: String(data.findings.total) },
          ],
        },
      ],
      potentialAction: [
        {
          '@type': 'OpenUri',
          name: 'View in Dashboard',
          targets: [{ os: 'default', uri: `${dashboardUrl}/dashboard/scans/${data.scanId}` }],
        },
      ],
    });
  }

  async sendCriticalFinding(
    webhookUrl: string,
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

    return this.sendMessage(webhookUrl, {
      title: '🚨 Critical Security Finding',
      summary: `Critical finding in ${data.repositoryName}`,
      themeColor: 'FF0000',
      sections: [
        {
          activityTitle: `**${data.title}**`,
          activitySubtitle: data.repositoryName,
          facts: [
            { name: 'Severity', value: data.severity.toUpperCase() },
            { name: 'File', value: `${data.filePath}:${data.line}` },
            { name: 'Rule', value: data.ruleId },
          ],
        },
      ],
      potentialAction: [
        {
          '@type': 'OpenUri',
          name: 'View Finding',
          targets: [{ os: 'default', uri: `${dashboardUrl}/dashboard/findings/${data.findingId}` }],
        },
      ],
    });
  }
}
