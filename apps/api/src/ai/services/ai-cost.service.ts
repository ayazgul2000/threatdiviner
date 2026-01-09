// apps/api/src/ai/services/ai-cost.service.ts
// AI cost attribution and tracking service

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface CostRecord {
  tenantId: string;
  userId?: string;
  feature: AIFeature;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  metadata?: Record<string, any>;
}

export type AIFeature =
  | 'triage'
  | 'fix-generation'
  | 'threat-modeling'
  | 'chat'
  | 'nlq'
  | 'logic-analysis'
  | 'report-generation'
  | 'code-review'
  | 'other';

// Cost per 1M tokens (as of late 2024/early 2025)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Claude models
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },

  // OpenAI models
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-4': { input: 30.0, output: 60.0 },

  // Gemini models
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },

  // Bedrock (Claude via AWS)
  'anthropic.claude-3-5-sonnet-20241022-v2:0': { input: 3.0, output: 15.0 },
  'anthropic.claude-3-sonnet-20240229-v1:0': { input: 3.0, output: 15.0 },
  'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.25, output: 1.25 },

  // Default for unknown models
  default: { input: 1.0, output: 3.0 },
};

export interface CostSummary {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  byFeature: Record<AIFeature, { cost: number; requests: number; tokens: number }>;
  byProvider: Record<string, { cost: number; requests: number; tokens: number }>;
  byModel: Record<string, { cost: number; requests: number; tokens: number }>;
}

export interface TenantCostReport {
  tenantId: string;
  period: { start: Date; end: Date };
  summary: CostSummary;
  dailyBreakdown: Array<{ date: Date; cost: number; tokens: number; requests: number }>;
  topUsers?: Array<{ userId: string; cost: number; requests: number }>;
}

@Injectable()
export class AICostService {
  private readonly logger = new Logger(AICostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Calculate cost for a request
   */
  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = this.getModelPricing(model);
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // Round to 6 decimal places
  }

  /**
   * Record a cost event
   */
  async recordCost(record: CostRecord): Promise<void> {
    const cost = this.calculateCost(record.model, record.inputTokens, record.outputTokens);

    await this.prisma.aiCostRecord.create({
      data: {
        tenantId: record.tenantId,
        userId: record.userId,
        feature: record.feature,
        provider: record.provider,
        model: record.model,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        cost,
        metadata: record.metadata as any,
        createdAt: new Date(),
      },
    });

    // Update aggregated daily stats
    await this.updateDailyStats(record.tenantId, cost, record.inputTokens + record.outputTokens);

    // Emit event for real-time monitoring
    this.eventEmitter.emit('ai.cost.recorded', {
      ...record,
      cost,
    });

    this.logger.debug(
      `Cost recorded: ${record.tenantId} - ${record.feature} - $${cost.toFixed(6)} (${record.inputTokens + record.outputTokens} tokens)`
    );
  }

  /**
   * Get cost summary for a tenant
   */
  async getCostSummary(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostSummary> {
    const records = await this.prisma.aiCostRecord.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const summary: CostSummary = {
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: records.length,
      byFeature: {} as any,
      byProvider: {},
      byModel: {},
    };

    for (const record of records) {
      summary.totalCost += record.cost;
      summary.totalInputTokens += record.inputTokens;
      summary.totalOutputTokens += record.outputTokens;

      // By feature
      const feature = record.feature as AIFeature;
      if (!summary.byFeature[feature]) {
        summary.byFeature[feature] = { cost: 0, requests: 0, tokens: 0 };
      }
      summary.byFeature[feature].cost += record.cost;
      summary.byFeature[feature].requests++;
      summary.byFeature[feature].tokens += record.inputTokens + record.outputTokens;

      // By provider
      if (!summary.byProvider[record.provider]) {
        summary.byProvider[record.provider] = { cost: 0, requests: 0, tokens: 0 };
      }
      summary.byProvider[record.provider].cost += record.cost;
      summary.byProvider[record.provider].requests++;
      summary.byProvider[record.provider].tokens += record.inputTokens + record.outputTokens;

      // By model
      if (!summary.byModel[record.model]) {
        summary.byModel[record.model] = { cost: 0, requests: 0, tokens: 0 };
      }
      summary.byModel[record.model].cost += record.cost;
      summary.byModel[record.model].requests++;
      summary.byModel[record.model].tokens += record.inputTokens + record.outputTokens;
    }

    return summary;
  }

  /**
   * Generate a detailed cost report for a tenant
   */
  async generateCostReport(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    includeUserBreakdown = false,
  ): Promise<TenantCostReport> {
    const summary = await this.getCostSummary(tenantId, startDate, endDate);

    // Get daily breakdown
    const dailyStats = await this.prisma.aiCostRecord.groupBy({
      by: ['createdAt'],
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { cost: true, inputTokens: true, outputTokens: true },
      _count: true,
    });

    // Aggregate by date
    const dailyMap = new Map<string, { cost: number; tokens: number; requests: number }>();
    for (const stat of dailyStats) {
      const dateKey = stat.createdAt.toISOString().split('T')[0];
      const existing = dailyMap.get(dateKey) || { cost: 0, tokens: 0, requests: 0 };
      existing.cost += stat._sum.cost || 0;
      existing.tokens += (stat._sum.inputTokens || 0) + (stat._sum.outputTokens || 0);
      existing.requests += stat._count;
      dailyMap.set(dateKey, existing);
    }

    const dailyBreakdown = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date: new Date(date),
        ...data,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const report: TenantCostReport = {
      tenantId,
      period: { start: startDate, end: endDate },
      summary,
      dailyBreakdown,
    };

    // Add user breakdown if requested
    if (includeUserBreakdown) {
      const userStats = await this.prisma.aiCostRecord.groupBy({
        by: ['userId'],
        where: {
          tenantId,
          createdAt: { gte: startDate, lte: endDate },
          userId: { not: null },
        },
        _sum: { cost: true },
        _count: true,
      });

      report.topUsers = userStats
        .filter(s => s.userId)
        .map(s => ({
          userId: s.userId!,
          cost: s._sum.cost || 0,
          requests: s._count,
        }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10);
    }

    return report;
  }

  /**
   * Get estimated cost for current billing period
   */
  async getEstimatedMonthlySpend(tenantId: string): Promise<{
    currentSpend: number;
    projectedSpend: number;
    daysRemaining: number;
    dailyAverage: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const summary = await this.getCostSummary(tenantId, startOfMonth, now);

    const daysPassed = Math.max(1, Math.floor((now.getTime() - startOfMonth.getTime()) / (24 * 60 * 60 * 1000)));
    const daysInMonth = endOfMonth.getDate();
    const daysRemaining = daysInMonth - daysPassed;

    const dailyAverage = summary.totalCost / daysPassed;
    const projectedSpend = dailyAverage * daysInMonth;

    return {
      currentSpend: summary.totalCost,
      projectedSpend,
      daysRemaining,
      dailyAverage,
    };
  }

  /**
   * Check if tenant is approaching cost limit
   */
  async checkCostAlerts(tenantId: string): Promise<{
    isOverBudget: boolean;
    percentUsed: number;
    warningLevel: 'none' | 'warning' | 'critical';
    budget?: number;
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { monthlyAIBudget: true },
    });

    if (!tenant?.monthlyAIBudget) {
      return {
        isOverBudget: false,
        percentUsed: 0,
        warningLevel: 'none',
      };
    }

    const estimated = await this.getEstimatedMonthlySpend(tenantId);
    const percentUsed = (estimated.currentSpend / tenant.monthlyAIBudget) * 100;

    let warningLevel: 'none' | 'warning' | 'critical' = 'none';
    if (percentUsed >= 100) {
      warningLevel = 'critical';
    } else if (percentUsed >= 80) {
      warningLevel = 'warning';
    }

    return {
      isOverBudget: percentUsed >= 100,
      percentUsed,
      warningLevel,
      budget: tenant.monthlyAIBudget,
    };
  }

  /**
   * Set monthly budget for a tenant
   */
  async setMonthlyBudget(tenantId: string, budget: number): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { monthlyAIBudget: budget },
    });

    this.logger.log(`Monthly AI budget set for tenant ${tenantId}: $${budget}`);
  }

  /**
   * Cleanup old cost records (retention: 90 days by default)
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldRecords(): Promise<number> {
    const retentionDays = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.aiCostRecord.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} old AI cost records`);
    }

    return result.count;
  }

  // ========== Private Methods ==========

  private getModelPricing(model: string): { input: number; output: number } {
    // Try exact match first
    if (MODEL_PRICING[model]) {
      return MODEL_PRICING[model];
    }

    // Try partial match for versioned models
    for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
      if (model.includes(key) || key.includes(model)) {
        return pricing;
      }
    }

    return MODEL_PRICING.default;
  }

  private async updateDailyStats(tenantId: string, cost: number, tokens: number): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.aiUsage.upsert({
      where: {
        tenantId_date: {
          tenantId,
          date: today,
        },
      },
      update: {
        cost: { increment: cost },
        tokenCount: { increment: tokens },
        requestCount: { increment: 1 },
      },
      create: {
        tenantId,
        date: today,
        cost,
        tokenCount: tokens,
        requestCount: 1,
      },
    });
  }
}
