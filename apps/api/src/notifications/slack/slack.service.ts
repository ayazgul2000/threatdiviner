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
}
