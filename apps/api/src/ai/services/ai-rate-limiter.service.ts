// apps/api/src/ai/services/ai-rate-limiter.service.ts
// Per-tenant AI rate limiting with token bucket algorithm

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface RateLimitConfig {
  // Requests per minute
  requestsPerMinute: number;
  // Tokens per minute
  tokensPerMinute: number;
  // Requests per day
  requestsPerDay: number;
  // Tokens per day
  tokensPerDay: number;
  // Max concurrent requests
  maxConcurrent: number;
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: {
    requestsMinute: number;
    tokensMinute: number;
    requestsDay: number;
    tokensDay: number;
  };
  resetTimes: {
    minute: Date;
    day: Date;
  };
  retryAfter?: number; // seconds
}

interface BucketState {
  requestsMinute: number;
  tokensMinute: number;
  requestsDay: number;
  tokensDay: number;
  concurrent: number;
  minuteStart: number;
  dayStart: number;
}

// Default rate limits by plan tier
const PLAN_LIMITS: Record<string, RateLimitConfig> = {
  free: {
    requestsPerMinute: 10,
    tokensPerMinute: 10000,
    requestsPerDay: 100,
    tokensPerDay: 100000,
    maxConcurrent: 2,
  },
  starter: {
    requestsPerMinute: 30,
    tokensPerMinute: 50000,
    requestsPerDay: 500,
    tokensPerDay: 500000,
    maxConcurrent: 5,
  },
  professional: {
    requestsPerMinute: 60,
    tokensPerMinute: 150000,
    requestsPerDay: 2000,
    tokensPerDay: 2000000,
    maxConcurrent: 10,
  },
  enterprise: {
    requestsPerMinute: 200,
    tokensPerMinute: 500000,
    requestsPerDay: 10000,
    tokensPerDay: 10000000,
    maxConcurrent: 50,
  },
};

@Injectable()
export class AIRateLimiterService {
  private readonly logger = new Logger(AIRateLimiterService.name);

  // In-memory bucket state (would use Redis in production)
  private buckets = new Map<string, BucketState>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a request is allowed under rate limits
   */
  async checkLimit(tenantId: string, estimatedTokens = 0): Promise<RateLimitStatus> {
    const config = await this.getLimitConfig(tenantId);
    const bucket = this.getBucket(tenantId);
    const now = Date.now();

    // Reset minute bucket if needed
    if (now - bucket.minuteStart >= 60000) {
      bucket.requestsMinute = 0;
      bucket.tokensMinute = 0;
      bucket.minuteStart = now;
    }

    // Reset day bucket if needed
    const dayMs = 24 * 60 * 60 * 1000;
    if (now - bucket.dayStart >= dayMs) {
      bucket.requestsDay = 0;
      bucket.tokensDay = 0;
      bucket.dayStart = now;
    }

    // Check all limits
    const checks = [
      {
        current: bucket.requestsMinute,
        limit: config.requestsPerMinute,
        name: 'requests per minute',
      },
      {
        current: bucket.tokensMinute + estimatedTokens,
        limit: config.tokensPerMinute,
        name: 'tokens per minute',
      },
      {
        current: bucket.requestsDay,
        limit: config.requestsPerDay,
        name: 'requests per day',
      },
      {
        current: bucket.tokensDay + estimatedTokens,
        limit: config.tokensPerDay,
        name: 'tokens per day',
      },
      {
        current: bucket.concurrent,
        limit: config.maxConcurrent,
        name: 'concurrent requests',
      },
    ];

    const exceeded = checks.find(c => c.current >= c.limit);

    const status: RateLimitStatus = {
      allowed: !exceeded,
      remaining: {
        requestsMinute: Math.max(0, config.requestsPerMinute - bucket.requestsMinute),
        tokensMinute: Math.max(0, config.tokensPerMinute - bucket.tokensMinute),
        requestsDay: Math.max(0, config.requestsPerDay - bucket.requestsDay),
        tokensDay: Math.max(0, config.tokensPerDay - bucket.tokensDay),
      },
      resetTimes: {
        minute: new Date(bucket.minuteStart + 60000),
        day: new Date(bucket.dayStart + dayMs),
      },
    };

    if (exceeded) {
      // Calculate retry-after
      if (exceeded.name.includes('minute')) {
        status.retryAfter = Math.ceil((bucket.minuteStart + 60000 - now) / 1000);
      } else if (exceeded.name.includes('day')) {
        status.retryAfter = Math.ceil((bucket.dayStart + dayMs - now) / 1000);
      } else {
        status.retryAfter = 5; // Concurrent limit - short retry
      }

      this.logger.warn(
        `Rate limit exceeded for tenant ${tenantId}: ${exceeded.name} (${exceeded.current}/${exceeded.limit})`
      );
    }

    return status;
  }

  /**
   * Consume rate limit quota before making a request
   */
  async consume(tenantId: string, estimatedTokens = 0): Promise<void> {
    const status = await this.checkLimit(tenantId, estimatedTokens);

    if (!status.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'AI rate limit exceeded',
          retryAfter: status.retryAfter,
          remaining: status.remaining,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const bucket = this.getBucket(tenantId);
    bucket.requestsMinute++;
    bucket.requestsDay++;
    bucket.tokensMinute += estimatedTokens;
    bucket.tokensDay += estimatedTokens;
    bucket.concurrent++;

    this.buckets.set(tenantId, bucket);
  }

  /**
   * Record actual token usage after request completes
   */
  async recordUsage(tenantId: string, actualTokens: number, estimatedTokens: number): Promise<void> {
    const bucket = this.getBucket(tenantId);

    // Adjust for estimation difference
    const tokenDiff = actualTokens - estimatedTokens;
    bucket.tokensMinute += tokenDiff;
    bucket.tokensDay += tokenDiff;
    bucket.concurrent = Math.max(0, bucket.concurrent - 1);

    this.buckets.set(tenantId, bucket);

    // Persist daily usage to database
    await this.persistDailyUsage(tenantId, actualTokens);
  }

  /**
   * Release concurrent slot (call on error/completion)
   */
  releaseConcurrent(tenantId: string): void {
    const bucket = this.getBucket(tenantId);
    bucket.concurrent = Math.max(0, bucket.concurrent - 1);
    this.buckets.set(tenantId, bucket);
  }

  /**
   * Get current usage stats for a tenant
   */
  async getUsageStats(tenantId: string): Promise<{
    config: RateLimitConfig;
    current: {
      requestsMinute: number;
      tokensMinute: number;
      requestsDay: number;
      tokensDay: number;
      concurrent: number;
    };
    percentage: {
      requestsMinute: number;
      tokensMinute: number;
      requestsDay: number;
      tokensDay: number;
    };
  }> {
    const config = await this.getLimitConfig(tenantId);
    const bucket = this.getBucket(tenantId);

    return {
      config,
      current: {
        requestsMinute: bucket.requestsMinute,
        tokensMinute: bucket.tokensMinute,
        requestsDay: bucket.requestsDay,
        tokensDay: bucket.tokensDay,
        concurrent: bucket.concurrent,
      },
      percentage: {
        requestsMinute: (bucket.requestsMinute / config.requestsPerMinute) * 100,
        tokensMinute: (bucket.tokensMinute / config.tokensPerMinute) * 100,
        requestsDay: (bucket.requestsDay / config.requestsPerDay) * 100,
        tokensDay: (bucket.tokensDay / config.tokensPerDay) * 100,
      },
    };
  }

  /**
   * Set custom limits for a tenant
   */
  async setCustomLimits(tenantId: string, limits: Partial<RateLimitConfig>): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        aiRateLimits: limits as any,
      },
    });

    this.logger.log(`Custom AI rate limits set for tenant ${tenantId}`);
  }

  /**
   * Reset rate limits for a tenant
   */
  resetLimits(tenantId: string): void {
    const now = Date.now();
    this.buckets.set(tenantId, {
      requestsMinute: 0,
      tokensMinute: 0,
      requestsDay: 0,
      tokensDay: 0,
      concurrent: 0,
      minuteStart: now,
      dayStart: now,
    });

    this.logger.log(`Rate limits reset for tenant ${tenantId}`);
  }

  // ========== Private Methods ==========

  private async getLimitConfig(tenantId: string): Promise<RateLimitConfig> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, aiRateLimits: true },
    });

    // Use custom limits if set
    if (tenant?.aiRateLimits) {
      const customLimits = tenant.aiRateLimits as Partial<RateLimitConfig>;
      const planLimits = PLAN_LIMITS[tenant.plan || 'free'] || PLAN_LIMITS.free;
      return { ...planLimits, ...customLimits };
    }

    // Use plan-based limits
    const plan = tenant?.plan || 'free';
    return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  }

  private getBucket(tenantId: string): BucketState {
    const existing = this.buckets.get(tenantId);
    if (existing) {
      return existing;
    }

    const now = Date.now();
    const newBucket: BucketState = {
      requestsMinute: 0,
      tokensMinute: 0,
      requestsDay: 0,
      tokensDay: 0,
      concurrent: 0,
      minuteStart: now,
      dayStart: now,
    };

    this.buckets.set(tenantId, newBucket);
    return newBucket;
  }

  private async persistDailyUsage(tenantId: string, tokens: number): Promise<void> {
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
        requestCount: { increment: 1 },
        tokenCount: { increment: tokens },
      },
      create: {
        tenantId,
        date: today,
        requestCount: 1,
        tokenCount: tokens,
      },
    });
  }
}
