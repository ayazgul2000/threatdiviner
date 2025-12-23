import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../scm/services/crypto.service';
import { SlackService } from './slack/slack.service';
import { EmailService } from './email/email.service';
import { NotificationConfig } from '@prisma/client';

export interface UpdateNotificationConfigDto {
  slackWebhookUrl?: string;
  slackChannel?: string;
  slackEnabled?: boolean;
  emailEnabled?: boolean;
  emailRecipients?: string[];
  notifyOnScanStart?: boolean;
  notifyOnScanComplete?: boolean;
  notifyOnCritical?: boolean;
  notifyOnHigh?: boolean;
  weeklyDigestEnabled?: boolean;
}

export interface ScanNotificationData {
  scanId: string;
  tenantId: string;
  repositoryName: string;
  branch: string;
  commitSha: string;
  triggeredBy: string;
  status?: 'success' | 'failure' | 'neutral';
  duration?: number;
  findings?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

export interface FindingNotificationData {
  tenantId: string;
  findingId: string;
  repositoryName: string;
  title: string;
  severity: string;
  filePath: string;
  line: number;
  ruleId: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly slackService: SlackService,
    private readonly emailService: EmailService,
  ) {}

  async getConfig(tenantId: string): Promise<NotificationConfig | null> {
    const config = await this.prisma.notificationConfig.findUnique({
      where: { tenantId },
    });

    if (config && config.slackWebhookUrl) {
      // Mask the webhook URL for response
      return {
        ...config,
        slackWebhookUrl: this.maskWebhookUrl(config.slackWebhookUrl),
      };
    }

    return config;
  }

  async updateConfig(
    tenantId: string,
    dto: UpdateNotificationConfigDto,
  ): Promise<NotificationConfig> {
    const data: Record<string, unknown> = {};

    // Encrypt webhook URL if provided
    if (dto.slackWebhookUrl !== undefined) {
      data.slackWebhookUrl = dto.slackWebhookUrl
        ? this.cryptoService.encrypt(dto.slackWebhookUrl)
        : null;
    }

    if (dto.slackChannel !== undefined) data.slackChannel = dto.slackChannel;
    if (dto.slackEnabled !== undefined) data.slackEnabled = dto.slackEnabled;
    if (dto.emailEnabled !== undefined) data.emailEnabled = dto.emailEnabled;
    if (dto.emailRecipients !== undefined) data.emailRecipients = dto.emailRecipients;
    if (dto.notifyOnScanStart !== undefined) data.notifyOnScanStart = dto.notifyOnScanStart;
    if (dto.notifyOnScanComplete !== undefined) data.notifyOnScanComplete = dto.notifyOnScanComplete;
    if (dto.notifyOnCritical !== undefined) data.notifyOnCritical = dto.notifyOnCritical;
    if (dto.notifyOnHigh !== undefined) data.notifyOnHigh = dto.notifyOnHigh;
    if (dto.weeklyDigestEnabled !== undefined) data.weeklyDigestEnabled = dto.weeklyDigestEnabled;

    const config = await this.prisma.notificationConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...data,
      },
      update: data,
    });

    return {
      ...config,
      slackWebhookUrl: config.slackWebhookUrl
        ? this.maskWebhookUrl(config.slackWebhookUrl)
        : null,
    };
  }

  async testSlack(tenantId: string): Promise<{ success: boolean; message: string }> {
    const config = await this.prisma.notificationConfig.findUnique({
      where: { tenantId },
      include: { tenant: true },
    });

    if (!config?.slackWebhookUrl) {
      return { success: false, message: 'Slack webhook URL not configured' };
    }

    const webhookUrl = this.cryptoService.decrypt(config.slackWebhookUrl);
    const success = await this.slackService.sendTestMessage(webhookUrl, config.tenant.name);

    return {
      success,
      message: success ? 'Test message sent successfully' : 'Failed to send test message',
    };
  }

  async notifyScanStarted(data: ScanNotificationData): Promise<void> {
    try {
      const config = await this.getConfigInternal(data.tenantId);
      if (!config?.slackEnabled || !config.notifyOnScanStart || !config.slackWebhookUrl) {
        return;
      }

      const webhookUrl = this.cryptoService.decrypt(config.slackWebhookUrl);
      await this.slackService.sendScanStarted(webhookUrl, {
        repositoryName: data.repositoryName,
        branch: data.branch,
        commitSha: data.commitSha,
        triggeredBy: data.triggeredBy,
      });
    } catch (error) {
      this.logger.error(`Failed to send scan started notification: ${error}`);
    }
  }

  async notifyScanCompleted(data: ScanNotificationData): Promise<void> {
    try {
      const config = await this.getConfigInternal(data.tenantId);
      if (!config?.notifyOnScanComplete) {
        return;
      }

      if (!data.findings || !data.status || data.duration === undefined) {
        this.logger.warn('Incomplete scan data for notification');
        return;
      }

      // Send Slack notification
      if (config.slackEnabled && config.slackWebhookUrl) {
        const webhookUrl = this.cryptoService.decrypt(config.slackWebhookUrl);
        await this.slackService.sendScanCompleted(webhookUrl, {
          repositoryName: data.repositoryName,
          branch: data.branch,
          commitSha: data.commitSha,
          status: data.status,
          duration: data.duration,
          findings: data.findings,
          scanId: data.scanId,
        });

        // Also send critical finding alerts if enabled
        if (config.notifyOnCritical && data.findings.critical > 0) {
          await this.notifyCriticalFindings(data.tenantId, data.scanId, webhookUrl, data.repositoryName);
        }

        // Send high severity alerts if enabled
        if (config.notifyOnHigh && data.findings.high > 0) {
          await this.notifyHighFindings(data.tenantId, data.scanId, webhookUrl, data.repositoryName);
        }
      }

      // Send Email notification
      if (config.emailEnabled && config.emailRecipients && config.emailRecipients.length > 0) {
        await this.emailService.sendScanComplete(config.emailRecipients, {
          repositoryName: data.repositoryName,
          branch: data.branch,
          commitSha: data.commitSha,
          status: data.status,
          duration: data.duration,
          findings: data.findings,
          scanId: data.scanId,
        });

        // Also send critical finding email alerts if enabled
        if (config.notifyOnCritical && data.findings.critical > 0) {
          await this.notifyCriticalFindingsEmail(data.tenantId, data.scanId, config.emailRecipients, data.repositoryName);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to send scan completed notification: ${error}`);
    }
  }

  async testEmail(_tenantId: string, email: string): Promise<{ success: boolean; message: string }> {
    const success = await this.emailService.sendTestEmail(email);
    return {
      success,
      message: success ? 'Test email sent successfully' : 'Failed to send test email',
    };
  }

  async notifyCriticalFinding(data: FindingNotificationData): Promise<void> {
    try {
      const config = await this.getConfigInternal(data.tenantId);
      if (!config?.slackEnabled || !config.notifyOnCritical || !config.slackWebhookUrl) {
        return;
      }

      const webhookUrl = this.cryptoService.decrypt(config.slackWebhookUrl);
      await this.slackService.sendCriticalFinding(webhookUrl, {
        repositoryName: data.repositoryName,
        title: data.title,
        severity: data.severity,
        filePath: data.filePath,
        line: data.line,
        ruleId: data.ruleId,
        findingId: data.findingId,
      });
    } catch (error) {
      this.logger.error(`Failed to send critical finding notification: ${error}`);
    }
  }

  private async getConfigInternal(tenantId: string): Promise<NotificationConfig | null> {
    return this.prisma.notificationConfig.findUnique({
      where: { tenantId },
    });
  }

  private async notifyCriticalFindings(
    _tenantId: string,
    scanId: string,
    webhookUrl: string,
    repositoryName: string,
  ): Promise<void> {
    const findings = await this.prisma.finding.findMany({
      where: { scanId, severity: 'critical' },
      take: 5, // Limit to top 5 to avoid spam
    });

    for (const finding of findings) {
      await this.slackService.sendCriticalFinding(webhookUrl, {
        repositoryName,
        title: finding.title,
        severity: finding.severity,
        filePath: finding.filePath,
        line: finding.startLine || 0,
        ruleId: finding.ruleId,
        findingId: finding.id,
      });
    }
  }

  private async notifyHighFindings(
    _tenantId: string,
    scanId: string,
    webhookUrl: string,
    repositoryName: string,
  ): Promise<void> {
    const findings = await this.prisma.finding.findMany({
      where: { scanId, severity: 'high' },
      take: 3, // Limit high severity alerts
    });

    for (const finding of findings) {
      await this.slackService.sendCriticalFinding(webhookUrl, {
        repositoryName,
        title: finding.title,
        severity: finding.severity,
        filePath: finding.filePath,
        line: finding.startLine || 0,
        ruleId: finding.ruleId,
        findingId: finding.id,
      });
    }
  }

  private async notifyCriticalFindingsEmail(
    _tenantId: string,
    scanId: string,
    recipients: string[],
    repositoryName: string,
  ): Promise<void> {
    const findings = await this.prisma.finding.findMany({
      where: { scanId, severity: 'critical' },
      take: 5, // Limit to top 5 to avoid spam
    });

    for (const finding of findings) {
      await this.emailService.sendCriticalFinding(recipients, {
        repositoryName,
        title: finding.title,
        severity: finding.severity,
        filePath: finding.filePath,
        line: finding.startLine || 0,
        ruleId: finding.ruleId,
        description: finding.description || undefined,
        findingId: finding.id,
      });
    }
  }

  private maskWebhookUrl(encryptedUrl: string): string {
    try {
      const url = this.cryptoService.decrypt(encryptedUrl);
      // Show first 20 and last 10 characters
      if (url.length > 35) {
        return `${url.substring(0, 20)}...${url.substring(url.length - 10)}`;
      }
      return '***configured***';
    } catch {
      return '***configured***';
    }
  }

  /**
   * Send a generic Slack notification (used by SIEM alerts)
   */
  async sendSlackNotification(
    tenantId: string,
    data: { type: string; title: string; message: string; severity?: string },
  ): Promise<void> {
    try {
      const config = await this.getConfigInternal(tenantId);
      if (!config?.slackEnabled || !config.slackWebhookUrl) {
        return;
      }

      const webhookUrl = this.cryptoService.decrypt(config.slackWebhookUrl);
      await this.slackService.sendGenericMessage(webhookUrl, data.title, data.message, data.severity);
    } catch (error) {
      this.logger.error(`Failed to send Slack notification: ${error}`);
    }
  }

  /**
   * Send a generic Email notification (used by SIEM alerts)
   */
  async sendEmailNotification(
    tenantId: string,
    data: { subject: string; body: string; type: string },
  ): Promise<void> {
    try {
      const config = await this.getConfigInternal(tenantId);
      if (!config?.emailEnabled || !config.emailRecipients?.length) {
        return;
      }

      await this.emailService.sendGenericEmail(config.emailRecipients, data.subject, data.body);
    } catch (error) {
      this.logger.error(`Failed to send email notification: ${error}`);
    }
  }
}
