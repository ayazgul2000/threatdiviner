import { Injectable, Logger } from '@nestjs/common';

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
  url?: string;
}

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  async sendMessage(webhookUrl: string, content?: string, embeds?: DiscordEmbed[]): Promise<boolean> {
    try {
      const payload: { content?: string; embeds?: DiscordEmbed[] } = {};

      if (content) payload.content = content;
      if (embeds) payload.embeds = embeds;

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.error(`Discord webhook failed: ${response.status}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to send Discord message: ${error}`);
      return false;
    }
  }

  async sendTestMessage(webhookUrl: string, tenantName: string): Promise<boolean> {
    return this.sendMessage(webhookUrl, undefined, [
      {
        title: '✅ ThreatDiviner Connected!',
        description: `**${tenantName}** has been connected to ThreatDiviner notifications.`,
        color: 0x00ff00,
        fields: [
          { name: 'Status', value: 'Connection Verified', inline: true },
          { name: 'Platform', value: 'Discord', inline: true },
        ],
        footer: { text: 'ThreatDiviner Security' },
        timestamp: new Date().toISOString(),
      },
    ]);
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
    const color = data.status === 'success' ? 0x00ff00 : data.status === 'failure' ? 0xff0000 : 0xffa500;
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';

    return this.sendMessage(webhookUrl, undefined, [
      {
        title: `${statusEmoji} Security Scan Complete`,
        description: `Scan completed for **${data.repositoryName}**`,
        color,
        url: `${dashboardUrl}/dashboard/scans/${data.scanId}`,
        fields: [
          { name: 'Branch', value: data.branch, inline: true },
          { name: 'Commit', value: data.commitSha.substring(0, 7), inline: true },
          { name: 'Duration', value: `${Math.round(data.duration / 1000)}s`, inline: true },
          { name: '🔴 Critical', value: String(data.findings.critical), inline: true },
          { name: '🟠 High', value: String(data.findings.high), inline: true },
          { name: '🟡 Medium', value: String(data.findings.medium), inline: true },
          { name: '🟢 Low', value: String(data.findings.low), inline: true },
          { name: '📊 Total', value: String(data.findings.total), inline: true },
        ],
        footer: { text: 'ThreatDiviner Security' },
        timestamp: new Date().toISOString(),
      },
    ]);
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

    return this.sendMessage(webhookUrl, undefined, [
      {
        title: '🚨 Critical Security Finding',
        description: `**${data.title}**`,
        color: 0xff0000,
        url: `${dashboardUrl}/dashboard/findings/${data.findingId}`,
        fields: [
          { name: 'Repository', value: data.repositoryName, inline: true },
          { name: 'Severity', value: data.severity.toUpperCase(), inline: true },
          { name: 'Rule', value: data.ruleId, inline: true },
          { name: 'Location', value: `${data.filePath}:${data.line}`, inline: false },
        ],
        footer: { text: 'ThreatDiviner Security' },
        timestamp: new Date().toISOString(),
      },
    ]);
  }
}
