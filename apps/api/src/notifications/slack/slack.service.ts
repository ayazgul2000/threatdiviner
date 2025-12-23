import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SlackMessage,
  ScanStartedData,
  ScanCompletedData,
  CriticalFindingData,
  buildScanStartedMessage,
  buildScanCompletedMessage,
  buildCriticalFindingMessage,
  buildTestMessage,
} from './slack.templates';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly dashboardUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.dashboardUrl = this.configService.get('DASHBOARD_URL', 'http://localhost:3000');
  }

  async sendMessage(webhookUrl: string, message: SlackMessage): Promise<boolean> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`Slack webhook failed: ${response.status} - ${text}`);
        return false;
      }

      this.logger.log('Slack message sent successfully');
      return true;
    } catch (error) {
      this.logger.error(`Failed to send Slack message: ${error}`);
      return false;
    }
  }

  async sendScanStarted(webhookUrl: string, data: Omit<ScanStartedData, 'dashboardUrl'>): Promise<boolean> {
    const message = buildScanStartedMessage({
      ...data,
      dashboardUrl: this.dashboardUrl,
    });
    return this.sendMessage(webhookUrl, message);
  }

  async sendScanCompleted(webhookUrl: string, data: Omit<ScanCompletedData, 'dashboardUrl'>): Promise<boolean> {
    const message = buildScanCompletedMessage({
      ...data,
      dashboardUrl: this.dashboardUrl,
    });
    return this.sendMessage(webhookUrl, message);
  }

  async sendCriticalFinding(webhookUrl: string, data: Omit<CriticalFindingData, 'dashboardUrl'>): Promise<boolean> {
    const message = buildCriticalFindingMessage({
      ...data,
      dashboardUrl: this.dashboardUrl,
    });
    return this.sendMessage(webhookUrl, message);
  }

  async sendTestMessage(webhookUrl: string, tenantName: string): Promise<boolean> {
    const message = buildTestMessage(tenantName);
    return this.sendMessage(webhookUrl, message);
  }

  async sendGenericMessage(
    webhookUrl: string,
    title: string,
    body: string,
    severity?: string,
  ): Promise<boolean> {
    const color = this.getSeverityColor(severity);
    const message: SlackMessage = {
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: title, emoji: true },
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: body },
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: `_Sent at: ${new Date().toISOString()}_` },
            },
          ],
        },
      ],
    };
    return this.sendMessage(webhookUrl, message);
  }

  private getSeverityColor(severity?: string): string {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return '#d32f2f';
      case 'high':
        return '#f57c00';
      case 'medium':
        return '#fbc02d';
      case 'low':
        return '#388e3c';
      default:
        return '#1976d2';
    }
  }
}
