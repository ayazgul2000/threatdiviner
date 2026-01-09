// apps/api/src/alerts/alert-engine.service.ts
// Custom alert rule engine

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  cooldownMinutes: number;
}

export interface AlertCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: any;
}

export interface AlertAction {
  type: 'slack' | 'email' | 'webhook' | 'jira';
  config: Record<string, any>;
}

export interface AlertEvent {
  ruleId: string;
  ruleName: string;
  severity: string;
  title: string;
  description: string;
  data: Record<string, any>;
  triggeredAt: Date;
}

@Injectable()
export class AlertEngineService {
  private readonly logger = new Logger(AlertEngineService.name);
  private alertCooldowns = new Map<string, Date>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluate all enabled rules against current data
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async evaluateRules(): Promise<AlertEvent[]> {
    const rules = await this.getEnabledRules();
    const events: AlertEvent[] = [];

    for (const rule of rules) {
      if (this.isInCooldown(rule.id)) continue;

      try {
        const triggered = await this.evaluateRule(rule);
        if (triggered) {
          const event = await this.createAlert(rule, triggered);
          events.push(event);
          this.setCooldown(rule.id, rule.cooldownMinutes);
        }
      } catch (e) {
        this.logger.error(`Rule ${rule.name} evaluation failed`, e);
      }
    }

    return events;
  }

  /**
   * Evaluate a single rule
   */
  private async evaluateRule(rule: AlertRule): Promise<any | null> {
    // Build Prisma where clause from conditions
    const where = this.buildWhereClause(rule.conditions);

    // Check for matching findings
    const match = await this.prisma.finding.findFirst({ where });
    return match;
  }

  private buildWhereClause(conditions: AlertCondition[]): any {
    const where: any = {};

    for (const c of conditions) {
      switch (c.operator) {
        case 'eq': where[c.field] = c.value; break;
        case 'ne': where[c.field] = { not: c.value }; break;
        case 'gt': where[c.field] = { gt: c.value }; break;
        case 'gte': where[c.field] = { gte: c.value }; break;
        case 'lt': where[c.field] = { lt: c.value }; break;
        case 'lte': where[c.field] = { lte: c.value }; break;
        case 'contains': where[c.field] = { contains: c.value, mode: 'insensitive' }; break;
        case 'in': where[c.field] = { in: c.value }; break;
      }
    }

    return where;
  }

  private async createAlert(rule: AlertRule, data: any): Promise<AlertEvent> {
    const event: AlertEvent = {
      ruleId: rule.id,
      ruleName: rule.name,
      severity: this.determineSeverity(rule, data),
      title: `Alert: ${rule.name}`,
      description: rule.description,
      data,
      triggeredAt: new Date(),
    };

    // Store alert - requires Alert model in Prisma
    // For now, log the alert
    this.logger.log(`Alert: ${JSON.stringify(event)}`);

    this.logger.log(`Alert triggered: ${rule.name}`);
    return event;
  }

  private determineSeverity(rule: AlertRule, data: any): string {
    // Inherit from finding severity if available
    if (data.severity) return data.severity;
    return 'medium';
  }

  private isInCooldown(ruleId: string): boolean {
    const lastTriggered = this.alertCooldowns.get(ruleId);
    if (!lastTriggered) return false;
    return new Date() < lastTriggered;
  }

  private setCooldown(ruleId: string, minutes: number): void {
    const cooldownUntil = new Date();
    cooldownUntil.setMinutes(cooldownUntil.getMinutes() + minutes);
    this.alertCooldowns.set(ruleId, cooldownUntil);
  }

  private async getEnabledRules(): Promise<AlertRule[]> {
    // Default built-in rules
    return [
      {
        id: 'critical-finding',
        name: 'Critical Vulnerability Detected',
        description: 'A critical severity vulnerability was found',
        enabled: true,
        conditions: [{ field: 'severity', operator: 'eq', value: 'critical' }, { field: 'status', operator: 'eq', value: 'open' }],
        actions: [{ type: 'slack', config: {} }],
        cooldownMinutes: 60,
      },
      {
        id: 'zero-day',
        name: 'Zero-Day Vulnerability',
        description: 'A vulnerability published in last 48 hours affecting your components',
        enabled: true,
        conditions: [{ field: 'isZeroDay', operator: 'eq', value: true }],
        actions: [{ type: 'slack', config: {} }, { type: 'email', config: {} }],
        cooldownMinutes: 30,
      },
      {
        id: 'kev-match',
        name: 'CISA KEV Vulnerability',
        description: 'Known Exploited Vulnerability detected',
        enabled: true,
        conditions: [{ field: 'isKev', operator: 'eq', value: true }],
        actions: [{ type: 'slack', config: {} }],
        cooldownMinutes: 60,
      },
    ];
  }
}
