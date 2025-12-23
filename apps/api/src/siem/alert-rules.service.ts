import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SecurityEvent } from './opensearch.provider';

export interface AlertRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  enabled: boolean;
  // Conditions
  eventTypes?: string[];
  sources?: string[];
  severities?: string[];
  titlePattern?: string;
  // Thresholds
  threshold: number;
  timeWindowMinutes: number;
  // Actions
  notifySlack: boolean;
  notifyEmail: boolean;
  createJiraIssue: boolean;
  // Tracking
  lastTriggeredAt?: Date;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertTriggered {
  ruleId: string;
  ruleName: string;
  matchedEvents: number;
  threshold: number;
  timeWindow: number;
  events: SecurityEvent[];
  triggeredAt: Date;
}

@Injectable()
export class AlertRulesService {
  private readonly logger = new Logger(AlertRulesService.name);
  private readonly alertBuffer: Map<string, SecurityEvent[]> = new Map();
  private readonly evaluationInterval = 60000; // 1 minute

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {
    // Start periodic evaluation
    this.startPeriodicEvaluation();
  }

  private startPeriodicEvaluation(): void {
    setInterval(() => {
      this.evaluateAllRules().catch((error) => {
        this.logger.error(`Alert rule evaluation failed: ${error}`);
      });
    }, this.evaluationInterval);
  }

  /**
   * Get all alert rules for a tenant
   */
  async getRules(tenantId: string): Promise<AlertRule[]> {
    const rules = await this.prisma.alertRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rules as unknown as AlertRule[];
  }

  /**
   * Get a single alert rule
   */
  async getRule(tenantId: string, ruleId: string): Promise<AlertRule | null> {
    const rule = await this.prisma.alertRule.findFirst({
      where: { id: ruleId, tenantId },
    });
    return rule as unknown as AlertRule;
  }

  /**
   * Create a new alert rule
   */
  async createRule(
    tenantId: string,
    data: Omit<AlertRule, 'id' | 'tenantId' | 'triggerCount' | 'createdAt' | 'updatedAt'>,
  ): Promise<AlertRule> {
    const rule = await this.prisma.alertRule.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        enabled: data.enabled,
        eventTypes: data.eventTypes || [],
        sources: data.sources || [],
        severities: data.severities || [],
        titlePattern: data.titlePattern,
        threshold: data.threshold,
        timeWindowMinutes: data.timeWindowMinutes,
        notifySlack: data.notifySlack,
        notifyEmail: data.notifyEmail,
        createJiraIssue: data.createJiraIssue,
        triggerCount: 0,
      },
    });

    this.logger.log(`Created alert rule ${rule.id} for tenant ${tenantId}`);
    return rule as unknown as AlertRule;
  }

  /**
   * Update an alert rule
   */
  async updateRule(
    _tenantId: string,
    ruleId: string,
    data: Partial<AlertRule>,
  ): Promise<AlertRule> {
    const rule = await this.prisma.alertRule.update({
      where: { id: ruleId },
      data: {
        name: data.name,
        description: data.description,
        enabled: data.enabled,
        eventTypes: data.eventTypes,
        sources: data.sources,
        severities: data.severities,
        titlePattern: data.titlePattern,
        threshold: data.threshold,
        timeWindowMinutes: data.timeWindowMinutes,
        notifySlack: data.notifySlack,
        notifyEmail: data.notifyEmail,
        createJiraIssue: data.createJiraIssue,
      },
    });

    return rule as unknown as AlertRule;
  }

  /**
   * Delete an alert rule
   */
  async deleteRule(_tenantId: string, ruleId: string): Promise<void> {
    await this.prisma.alertRule.delete({
      where: { id: ruleId },
    });
    this.logger.log(`Deleted alert rule ${ruleId}`);
  }

  /**
   * Process a new security event and check against rules
   */
  async processEvent(event: SecurityEvent): Promise<void> {
    // Add event to buffer for the tenant
    const bufferKey = event.tenantId;
    if (!this.alertBuffer.has(bufferKey)) {
      this.alertBuffer.set(bufferKey, []);
    }

    const buffer = this.alertBuffer.get(bufferKey)!;
    buffer.push(event);

    // Keep buffer size reasonable
    while (buffer.length > 10000) {
      buffer.shift();
    }

    // Check rules for immediate triggers (critical events)
    if (event.severity === 'critical') {
      await this.checkImmediateTriggers(event);
    }
  }

  /**
   * Check for immediate alert triggers on critical events
   */
  private async checkImmediateTriggers(event: SecurityEvent): Promise<void> {
    const rules = await this.prisma.alertRule.findMany({
      where: {
        tenantId: event.tenantId,
        enabled: true,
        severities: { has: 'critical' },
        threshold: 1, // Immediate trigger rules
      },
    });

    for (const rule of rules) {
      if (this.eventMatchesRule(event, rule as unknown as AlertRule)) {
        await this.triggerAlert(rule as unknown as AlertRule, [event]);
      }
    }
  }

  /**
   * Evaluate all rules periodically
   */
  private async evaluateAllRules(): Promise<void> {
    const tenantIds = Array.from(this.alertBuffer.keys());

    for (const tenantId of tenantIds) {
      const rules = await this.prisma.alertRule.findMany({
        where: { tenantId, enabled: true },
      });

      for (const rule of rules) {
        await this.evaluateRule(rule as unknown as AlertRule);
      }
    }
  }

  /**
   * Evaluate a single rule against buffered events
   */
  private async evaluateRule(rule: AlertRule): Promise<void> {
    const buffer = this.alertBuffer.get(rule.tenantId) || [];
    const now = new Date();
    const windowStart = new Date(
      now.getTime() - rule.timeWindowMinutes * 60 * 1000,
    );

    // Filter events matching the rule within the time window
    const matchingEvents = buffer.filter((event) => {
      if (event.timestamp < windowStart) return false;
      return this.eventMatchesRule(event, rule);
    });

    // Check if threshold is exceeded
    if (matchingEvents.length >= rule.threshold) {
      await this.triggerAlert(rule, matchingEvents);
    }
  }

  /**
   * Check if an event matches a rule's conditions
   */
  private eventMatchesRule(event: SecurityEvent, rule: AlertRule): boolean {
    // Check event types
    if (rule.eventTypes?.length && !rule.eventTypes.includes(event.eventType)) {
      return false;
    }

    // Check sources
    if (rule.sources?.length && !rule.sources.includes(event.source)) {
      return false;
    }

    // Check severities
    if (rule.severities?.length && !rule.severities.includes(event.severity)) {
      return false;
    }

    // Check title pattern (simple contains match)
    if (rule.titlePattern && !event.title.toLowerCase().includes(rule.titlePattern.toLowerCase())) {
      return false;
    }

    return true;
  }

  /**
   * Trigger an alert and send notifications
   */
  private async triggerAlert(
    rule: AlertRule,
    events: SecurityEvent[],
  ): Promise<void> {
    // Update trigger count and timestamp
    await this.prisma.alertRule.update({
      where: { id: rule.id },
      data: {
        lastTriggeredAt: new Date(),
        triggerCount: { increment: 1 },
      },
    });

    const trigger: AlertTriggered = {
      ruleId: rule.id,
      ruleName: rule.name,
      matchedEvents: events.length,
      threshold: rule.threshold,
      timeWindow: rule.timeWindowMinutes,
      events: events.slice(0, 10), // Include first 10 events
      triggeredAt: new Date(),
    };

    this.logger.warn(
      `Alert triggered: ${rule.name} - ${events.length} events in ${rule.timeWindowMinutes}m`,
    );

    // Store alert history
    await this.prisma.alertHistory.create({
      data: {
        ruleId: rule.id,
        tenantId: rule.tenantId,
        matchedEvents: events.length,
        sampleEvents: events.slice(0, 5) as any,
        triggeredAt: new Date(),
      },
    });

    // Send notifications
    await this.sendAlertNotifications(rule, trigger);

    // Clear matching events from buffer to prevent re-triggering
    const buffer = this.alertBuffer.get(rule.tenantId) || [];
    const eventIds = new Set(events.map((e) => e.id));
    this.alertBuffer.set(
      rule.tenantId,
      buffer.filter((e) => !eventIds.has(e.id)),
    );
  }

  /**
   * Send alert notifications via configured channels
   */
  private async sendAlertNotifications(
    rule: AlertRule,
    trigger: AlertTriggered,
  ): Promise<void> {
    const message = this.formatAlertMessage(trigger);

    if (rule.notifySlack) {
      try {
        await this.notificationsService.sendSlackNotification(rule.tenantId, {
          type: 'alert',
          title: `🚨 Alert: ${rule.name}`,
          message,
          severity: this.getHighestSeverity(trigger.events),
        });
      } catch (error) {
        this.logger.error(`Failed to send Slack notification: ${error}`);
      }
    }

    if (rule.notifyEmail) {
      try {
        await this.notificationsService.sendEmailNotification(rule.tenantId, {
          subject: `[ThreatDiviner Alert] ${rule.name}`,
          body: message,
          type: 'alert',
        });
      } catch (error) {
        this.logger.error(`Failed to send email notification: ${error}`);
      }
    }
  }

  /**
   * Format alert message for notifications
   */
  private formatAlertMessage(trigger: AlertTriggered): string {
    const lines = [
      `**Alert Rule:** ${trigger.ruleName}`,
      `**Matched Events:** ${trigger.matchedEvents} (threshold: ${trigger.threshold})`,
      `**Time Window:** ${trigger.timeWindow} minutes`,
      `**Triggered At:** ${trigger.triggeredAt.toISOString()}`,
      '',
      '**Sample Events:**',
    ];

    for (const event of trigger.events.slice(0, 5)) {
      lines.push(`- [${event.severity.toUpperCase()}] ${event.title}`);
    }

    if (trigger.events.length > 5) {
      lines.push(`... and ${trigger.events.length - 5} more`);
    }

    return lines.join('\n');
  }

  /**
   * Get highest severity from a list of events
   */
  private getHighestSeverity(
    events: SecurityEvent[],
  ): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    for (const severity of severityOrder) {
      if (events.some((e) => e.severity === severity)) {
        return severity as any;
      }
    }
    return 'info';
  }

  /**
   * Get alert history for a tenant
   */
  async getAlertHistory(
    tenantId: string,
    limit = 100,
  ): Promise<Array<{
    id: string;
    ruleId: string;
    ruleName: string;
    matchedEvents: number;
    triggeredAt: Date;
  }>> {
    const history = await this.prisma.alertHistory.findMany({
      where: { tenantId },
      include: { rule: { select: { name: true } } },
      orderBy: { triggeredAt: 'desc' },
      take: limit,
    });

    return history.map((h) => ({
      id: h.id,
      ruleId: h.ruleId,
      ruleName: (h.rule as any)?.name || 'Unknown',
      matchedEvents: h.matchedEvents,
      triggeredAt: h.triggeredAt,
    }));
  }
}
