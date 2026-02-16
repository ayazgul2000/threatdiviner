import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateFeedConfigDto,
  UpdateFeedConfigDto,
  FeedConfigListQuery,
  FeedSyncRunListQuery,
  SetScheduleDto,
  SCHEDULE_PRESETS,
  SchedulePreset,
} from './dto/feed.dto';

@Injectable()
export class FeedsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // Feed Config Operations
  // ============================================

  async listFeedConfigs(query: FeedConfigListQuery) {
    const where: Record<string, unknown> = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { feedId: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.isEnabled !== undefined) {
      where.isEnabled = query.isEnabled === 'true';
    }

    const [feeds, total] = await Promise.all([
      this.prisma.feedConfig.findMany({
        where,
        include: {
          syncRuns: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: { syncRuns: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.feedConfig.count({ where }),
    ]);

    return {
      feeds: feeds.map((feed) => ({
        ...feed,
        lastRun: feed.syncRuns[0] || null,
        totalRuns: feed._count.syncRuns,
      })),
      total,
    };
  }

  async getFeedConfigById(id: string) {
    const feed = await this.prisma.feedConfig.findUnique({
      where: { id },
      include: {
        syncRuns: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { syncRuns: true },
        },
      },
    });

    if (!feed) {
      throw new NotFoundException(`Feed config with ID "${id}" not found`);
    }

    return feed;
  }

  async getFeedConfigByFeedId(feedId: string) {
    const feed = await this.prisma.feedConfig.findUnique({
      where: { feedId },
      include: {
        syncRuns: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!feed) {
      throw new NotFoundException(`Feed config with feedId "${feedId}" not found`);
    }

    return feed;
  }

  async createFeedConfig(dto: CreateFeedConfigDto) {
    // Check for duplicate feedId
    const existing = await this.prisma.feedConfig.findUnique({
      where: { feedId: dto.feedId },
    });

    if (existing) {
      throw new ConflictException(`Feed with ID "${dto.feedId}" already exists`);
    }

    // Calculate next sync time if schedule is provided
    const nextSyncAt = dto.schedule ? this.calculateNextSync(dto.schedule) : null;

    return this.prisma.feedConfig.create({
      data: {
        feedId: dto.feedId,
        name: dto.name,
        description: dto.description,
        sourceUrl: dto.sourceUrl,
        schedule: dto.schedule || '0 0 * * 0', // Default weekly
        isEnabled: dto.isEnabled ?? true,
        nextSyncAt,
      },
    });
  }

  async updateFeedConfig(id: string, dto: UpdateFeedConfigDto) {
    const existing = await this.prisma.feedConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Feed config with ID "${id}" not found`);
    }

    // Calculate next sync time if schedule is updated
    let nextSyncAt = existing.nextSyncAt;
    if (dto.schedule) {
      nextSyncAt = this.calculateNextSync(dto.schedule);
    }

    return this.prisma.feedConfig.update({
      where: { id },
      data: {
        ...dto,
        nextSyncAt,
      },
    });
  }

  async deleteFeedConfig(id: string) {
    const existing = await this.prisma.feedConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Feed config with ID "${id}" not found`);
    }

    await this.prisma.feedConfig.delete({
      where: { id },
    });

    return { deleted: true };
  }

  async setSchedule(id: string, dto: SetScheduleDto) {
    const existing = await this.prisma.feedConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Feed config with ID "${id}" not found`);
    }

    let schedule: string | null;

    if (dto.preset === 'custom') {
      if (!dto.customCron) {
        throw new BadRequestException('customCron is required when preset is "custom"');
      }
      schedule = dto.customCron;
    } else if (dto.preset === 'manual') {
      schedule = null;
    } else {
      schedule = SCHEDULE_PRESETS[dto.preset as SchedulePreset] || null;
    }

    const nextSyncAt = schedule ? this.calculateNextSync(schedule) : null;

    return this.prisma.feedConfig.update({
      where: { id },
      data: {
        schedule: schedule || '0 0 * * 0',
        isEnabled: schedule !== null,
        nextSyncAt,
      },
    });
  }

  async testConnection(url: string): Promise<{ success: boolean; message: string; statusCode?: number; responseTime?: number }> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          success: true,
          message: 'Connection successful',
          statusCode: response.status,
          responseTime,
        };
      } else {
        return {
          success: false,
          message: `Server returned status ${response.status}`,
          statusCode: response.status,
          responseTime,
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        message: `Connection failed: ${message}`,
        responseTime,
      };
    }
  }

  // ============================================
  // Sync Run Operations
  // ============================================

  async listSyncRuns(feedConfigId: string, query: FeedSyncRunListQuery) {
    const feed = await this.prisma.feedConfig.findUnique({
      where: { id: feedConfigId },
    });

    if (!feed) {
      throw new NotFoundException(`Feed config with ID "${feedConfigId}" not found`);
    }

    const where: Record<string, unknown> = { feedConfigId };

    if (query.status) {
      where.status = query.status;
    }

    const syncRuns = await this.prisma.feedSyncRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit || 20,
    });

    return { syncRuns };
  }

  async getSyncRunById(syncRunId: string) {
    const syncRun = await this.prisma.feedSyncRun.findUnique({
      where: { id: syncRunId },
      include: {
        feedConfig: true,
      },
    });

    if (!syncRun) {
      throw new NotFoundException(`Sync run with ID "${syncRunId}" not found`);
    }

    return syncRun;
  }

  async triggerSync(feedConfigId: string) {
    const feed = await this.prisma.feedConfig.findUnique({
      where: { id: feedConfigId },
    });

    if (!feed) {
      throw new NotFoundException(`Feed config with ID "${feedConfigId}" not found`);
    }

    // Check if there's already a running sync
    const runningSync = await this.prisma.feedSyncRun.findFirst({
      where: {
        feedConfigId,
        status: 'running',
      },
    });

    if (runningSync) {
      throw new ConflictException('A sync is already in progress for this feed');
    }

    // Create a new sync run with pending status
    const syncRun = await this.prisma.feedSyncRun.create({
      data: {
        feedConfigId,
        status: 'pending',
      },
    });

    // In a real implementation, this would trigger a background job
    // For now, we'll simulate the sync process
    this.executeSyncInBackground(syncRun.id, feed.sourceUrl);

    return { syncRun, message: 'Sync triggered successfully' };
  }

  async triggerSyncAll() {
    const enabledFeeds = await this.prisma.feedConfig.findMany({
      where: { isEnabled: true },
    });

    const results = [];

    for (const feed of enabledFeeds) {
      try {
        const result = await this.triggerSync(feed.id);
        results.push({ feedId: feed.feedId, status: 'triggered', syncRunId: result.syncRun.id });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.push({ feedId: feed.feedId, status: 'skipped', reason: message });
      }
    }

    return { results, total: results.length };
  }

  // ============================================
  // Statistics
  // ============================================

  async getStats() {
    const [
      totalFeeds,
      enabledFeeds,
      disabledFeeds,
      recentRuns,
      failedRuns,
    ] = await Promise.all([
      this.prisma.feedConfig.count(),
      this.prisma.feedConfig.count({ where: { isEnabled: true } }),
      this.prisma.feedConfig.count({ where: { isEnabled: false } }),
      this.prisma.feedSyncRun.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.feedSyncRun.count({
        where: {
          status: 'failed',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      totalFeeds,
      enabledFeeds,
      disabledFeeds,
      recentRuns,
      failedRuns,
    };
  }

  async getSchedulePresets() {
    return [
      { value: 'daily', label: 'Daily (3:00 AM UTC)', cron: '0 3 * * *' },
      { value: 'weekly', label: 'Weekly (Sunday 3:00 AM UTC)', cron: '0 3 * * 0' },
      { value: 'monthly', label: 'Monthly (1st at 3:00 AM UTC)', cron: '0 3 1 * *' },
      { value: 'manual', label: 'Manual only', cron: null },
      { value: 'custom', label: 'Custom cron expression', cron: null },
    ];
  }

  // ============================================
  // Private Helpers
  // ============================================

  private calculateNextSync(cron: string): Date {
    // Simple calculation - in production, use a proper cron parser library
    // For now, return next occurrence based on pattern
    const now = new Date();
    const parts = cron.split(' ');

    if (parts.length !== 5) {
      return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to 24 hours
    }

    const [minute, hour] = parts;
    const nextRun = new Date(now);
    nextRun.setMinutes(parseInt(minute) || 0);
    nextRun.setSeconds(0);
    nextRun.setMilliseconds(0);

    if (hour !== '*') {
      nextRun.setHours(parseInt(hour));
    }

    // If the calculated time is in the past, add a day
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return nextRun;
  }

  private async executeSyncInBackground(syncRunId: string, _sourceUrl: string) {
    // Simulate async sync execution
    // In production, this would be a Bull/BullMQ job or similar
    setTimeout(async () => {
      try {
        await this.prisma.feedSyncRun.update({
          where: { id: syncRunId },
          data: {
            status: 'running',
            startedAt: new Date(),
          },
        });

        // Simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Simulate completion with random stats
        const recordsAdded = Math.floor(Math.random() * 10);
        const recordsUpdated = Math.floor(Math.random() * 20);

        const syncRun = await this.prisma.feedSyncRun.update({
          where: { id: syncRunId },
          data: {
            status: 'completed',
            completedAt: new Date(),
            recordsAdded,
            recordsUpdated,
            recordsDeleted: 0,
          },
          include: { feedConfig: true },
        });

        // Update feed config last sync time
        await this.prisma.feedConfig.update({
          where: { id: syncRun.feedConfigId },
          data: {
            lastSyncAt: new Date(),
            nextSyncAt: syncRun.feedConfig.schedule
              ? this.calculateNextSync(syncRun.feedConfig.schedule)
              : null,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await this.prisma.feedSyncRun.update({
          where: { id: syncRunId },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorMessage: message,
          },
        });
      }
    }, 100);
  }
}
