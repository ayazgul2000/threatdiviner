import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface CreateAlertRuleDto {
  name: string;
  description?: string;
  eventTypes?: string[];
  sources?: string[];
  severities?: string[];
  titlePattern?: string;
  threshold?: number;
  timeWindowMinutes?: number;
  notifySlack?: boolean;
  notifyEmail?: boolean;
  createJiraIssue?: boolean;
  enabled?: boolean;
}

export interface UpdateAlertRuleDto {
  name?: string;
  description?: string;
  eventTypes?: string[];
  sources?: string[];
  severities?: string[];
  titlePattern?: string;
  threshold?: number;
  timeWindowMinutes?: number;
  notifySlack?: boolean;
  notifyEmail?: boolean;
  createJiraIssue?: boolean;
  enabled?: boolean;
}

export interface AlertEvent {
  type: string;
  tenantId: string;
  source?: string;
  severity?: string;
  title?: string;
  data: Record<string, unknown>;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listRules(tenantId: string) {
    return this.prisma.alertRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRule(tenantId: string, id: string) {
    const rule = await this.prisma.alertRule.findFirst({
      where: { id, tenantId },
    });

    if (!rule) {
      throw new NotFoundException('Alert rule not found');
    }

    return rule;
  }

  async createRule(tenantId: string, _userId: string, dto: CreateAlertRuleDto) {
    return this.prisma.alertRule.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        eventTypes: dto.eventTypes || [],
        sources: dto.sources || [],
        severities: dto.severities || [],
        titlePattern: dto.titlePattern,
        threshold: dto.threshold || 1,
        timeWindowMinutes: dto.timeWindowMinutes || 5,
        notifySlack: dto.notifySlack ?? false,
        notifyEmail: dto.notifyEmail ?? true,
        createJiraIssue: dto.createJiraIssue ?? false,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async updateRule(tenantId: string, id: string, dto: UpdateAlertRuleDto) {
    await this.getRule(tenantId, id);

    return this.prisma.alertRule.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        eventTypes: dto.eventTypes,
        sources: dto.sources,
        severities: dto.severities,
        titlePattern: dto.titlePattern,
        threshold: dto.threshold,
        timeWindowMinutes: dto.timeWindowMinutes,
        notifySlack: dto.notifySlack,
        notifyEmail: dto.notifyEmail,
        createJiraIssue: dto.createJiraIssue,
        enabled: dto.enabled,
        updatedAt: new Date(),
      },
    });
  }

  async deleteRule(tenantId: string, id: string) {
    await this.getRule(tenantId, id);
    await this.prisma.alertRule.delete({ where: { id } });
    return { success: true };
  }

  async toggleRule(tenantId: string, id: string, enabled: boolean) {
    await this.getRule(tenantId, id);
    return this.prisma.alertRule.update({
      where: { id },
      data: { enabled, updatedAt: new Date() },
    });
  }

  async processEvent(event: AlertEvent) {
    // Get all enabled rules for this tenant
    const rules = await this.prisma.alertRule.findMany({
      where: {
        tenantId: event.tenantId,
        enabled: true,
      },
    });

    for (const rule of rules) {
      const matches = this.evaluateRule(rule, event);

      if (matches) {
        await this.triggerAlert(rule, event);
      }
    }
  }

  private evaluateRule(
    rule: {
      eventTypes: string[];
      sources: string[];
      severities: string[];
      titlePattern: string | null;
    },
    event: AlertEvent,
  ): boolean {
    // Check event type
    if (rule.eventTypes.length > 0 && !rule.eventTypes.includes(event.type)) {
      return false;
    }

    // Check source
    if (rule.sources.length > 0 && event.source && !rule.sources.includes(event.source)) {
      return false;
    }

    // Check severity
    if (rule.severities.length > 0 && event.severity && !rule.severities.includes(event.severity)) {
      return false;
    }

    // Check title pattern
    if (rule.titlePattern && event.title) {
      const pattern = new RegExp(rule.titlePattern, 'i');
      if (!pattern.test(event.title)) {
        return false;
      }
    }

    return true;
  }

  private async triggerAlert(
    rule: {
      id: string;
      name: string;
      tenantId: string;
      timeWindowMinutes: number;
      lastTriggeredAt: Date | null;
      notifySlack: boolean;
      notifyEmail: boolean;
    },
    event: AlertEvent,
  ) {
    // Check cooldown
    if (rule.lastTriggeredAt) {
      const cooldownEnd = new Date(
        rule.lastTriggeredAt.getTime() + rule.timeWindowMinutes * 60 * 1000,
      );
      if (new Date() < cooldownEnd) {
        this.logger.debug(
          `Alert rule ${rule.name} is in cooldown until ${cooldownEnd}`,
        );
        return;
      }
    }

    // Update last triggered time and increment count
    await this.prisma.alertRule.update({
      where: { id: rule.id },
      data: {
        lastTriggeredAt: new Date(),
        triggerCount: { increment: 1 },
      },
    });

    // Create alert history entry with correct schema fields
    await this.prisma.alertHistory.create({
      data: {
        ruleId: rule.id,
        tenantId: rule.tenantId,
        matchedEvents: 1,
        sampleEvents: [event.data as object],
        triggeredAt: new Date(),
      },
    });

    // Send notifications
    if (rule.notifySlack) {
      try {
        await this.notifications.sendSlackNotification(rule.tenantId, {
          type: event.type,
          title: `Alert: ${rule.name}`,
          message: `Event: ${event.type}\nDetails: ${JSON.stringify(event.data)}`,
          severity: event.severity,
        });
      } catch (error) {
        this.logger.error('Failed to send Slack alert:', error);
      }
    }

    if (rule.notifyEmail) {
      try {
        await this.notifications.sendEmailNotification(rule.tenantId, {
          subject: `Alert: ${rule.name}`,
          body: `Event Type: ${event.type}\nDetails: ${JSON.stringify(event.data, null, 2)}`,
          type: 'alert',
        });
      } catch (error) {
        this.logger.error('Failed to send email alert:', error);
      }
    }

    this.logger.log(`Triggered alert rule: ${rule.name}`);
  }

  async getAlertHistory(
    tenantId: string,
    options?: { ruleId?: string; limit?: number; offset?: number },
  ) {
    const where: { tenantId: string; ruleId?: string } = { tenantId };

    if (options?.ruleId) {
      where.ruleId = options.ruleId;
    }

    const [history, total] = await Promise.all([
      this.prisma.alertHistory.findMany({
        where,
        include: { rule: { select: { name: true } } },
        orderBy: { triggeredAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.alertHistory.count({ where }),
    ]);

    return { history, total };
  }

  async testRule(tenantId: string, id: string) {
    const rule = await this.getRule(tenantId, id);

    // Create a test event
    const testEvent: AlertEvent = {
      type: 'TEST_ALERT',
      tenantId,
      data: {
        message: 'This is a test alert',
        ruleName: rule.name,
        timestamp: new Date().toISOString(),
      },
    };

    // Send test notification
    if (rule.notifySlack) {
      try {
        await this.notifications.sendSlackNotification(tenantId, {
          type: 'TEST_ALERT',
          title: `Test Alert: ${rule.name}`,
          message: JSON.stringify(testEvent.data),
        });
      } catch (error) {
        this.logger.error('Failed to send test Slack alert:', error);
        throw error;
      }
    }

    if (rule.notifyEmail) {
      try {
        await this.notifications.sendEmailNotification(tenantId, {
          subject: `Test Alert: ${rule.name}`,
          body: `This is a test alert for rule: ${rule.name}\n\nTimestamp: ${testEvent.data.timestamp}`,
          type: 'test_alert',
        });
      } catch (error) {
        this.logger.error('Failed to send test email alert:', error);
        throw error;
      }
    }

    return { success: true, message: 'Test alert sent successfully' };
  }
}
