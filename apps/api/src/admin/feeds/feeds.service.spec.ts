import { Test, TestingModule } from '@nestjs/testing';
import { FeedsService } from './feeds.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('FeedsService', () => {
  let service: FeedsService;

  const mockFeedConfig = {
    id: 'feed-1',
    feedId: 'cwe',
    name: 'CWE Feed',
    description: 'Common Weakness Enumeration',
    sourceUrl: 'https://cwe.mitre.org/data/xml/cwec_latest.xml.zip',
    schedule: '0 3 * * *',
    isEnabled: true,
    lastSyncAt: new Date('2025-01-22T03:00:00Z'),
    nextSyncAt: new Date('2025-01-23T03:00:00Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSyncRun = {
    id: 'sync-1',
    feedConfigId: 'feed-1',
    status: 'completed',
    startedAt: new Date('2025-01-22T03:00:00Z'),
    completedAt: new Date('2025-01-22T03:02:34Z'),
    recordsAdded: 2,
    recordsUpdated: 5,
    recordsDeleted: 0,
    errorMessage: null,
    createdAt: new Date(),
  };

  const mockPrismaService = {
    feedConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    feedSyncRun: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FeedsService>(FeedsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listFeedConfigs', () => {
    it('should return all feed configs with last run info', async () => {
      const mockFeeds = [
        {
          ...mockFeedConfig,
          syncRuns: [mockSyncRun],
          _count: { syncRuns: 5 },
        },
      ];

      mockPrismaService.feedConfig.findMany.mockResolvedValue(mockFeeds);
      mockPrismaService.feedConfig.count.mockResolvedValue(1);

      const result = await service.listFeedConfigs({});

      expect(result.feeds).toHaveLength(1);
      expect(result.feeds[0].lastRun).toEqual(mockSyncRun);
      expect(result.feeds[0].totalRuns).toBe(5);
      expect(result.total).toBe(1);
    });

    it('should filter by search term', async () => {
      mockPrismaService.feedConfig.findMany.mockResolvedValue([]);
      mockPrismaService.feedConfig.count.mockResolvedValue(0);

      await service.listFeedConfigs({ search: 'cwe' });

      expect(mockPrismaService.feedConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.any(Object) }),
              expect.objectContaining({ feedId: expect.any(Object) }),
            ]),
          }),
        }),
      );
    });

    it('should filter by isEnabled', async () => {
      mockPrismaService.feedConfig.findMany.mockResolvedValue([]);
      mockPrismaService.feedConfig.count.mockResolvedValue(0);

      await service.listFeedConfigs({ isEnabled: 'true' });

      expect(mockPrismaService.feedConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isEnabled: true,
          }),
        }),
      );
    });
  });

  describe('getFeedConfigById', () => {
    it('should return feed config with sync runs', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue({
        ...mockFeedConfig,
        syncRuns: [mockSyncRun],
        _count: { syncRuns: 1 },
      });

      const result = await service.getFeedConfigById('feed-1');

      expect(result.feedId).toBe('cwe');
      expect(result.syncRuns).toHaveLength(1);
    });

    it('should throw NotFoundException for invalid id', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue(null);

      await expect(service.getFeedConfigById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createFeedConfig', () => {
    it('should create a new feed config', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue(null);
      mockPrismaService.feedConfig.create.mockResolvedValue(mockFeedConfig);

      const dto = {
        feedId: 'cwe',
        name: 'CWE Feed',
        sourceUrl: 'https://cwe.mitre.org/data/xml/cwec_latest.xml.zip',
        schedule: '0 3 * * *',
      };

      const result = await service.createFeedConfig(dto);

      expect(result.feedId).toBe('cwe');
      expect(mockPrismaService.feedConfig.create).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate feedId', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue(mockFeedConfig);

      const dto = {
        feedId: 'cwe',
        name: 'CWE Feed',
        sourceUrl: 'https://cwe.mitre.org/data/xml/cwec_latest.xml.zip',
      };

      await expect(service.createFeedConfig(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateFeedConfig', () => {
    it('should update feed config', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue(mockFeedConfig);
      mockPrismaService.feedConfig.update.mockResolvedValue({
        ...mockFeedConfig,
        name: 'Updated CWE Feed',
      });

      const result = await service.updateFeedConfig('feed-1', {
        name: 'Updated CWE Feed',
      });

      expect(result.name).toBe('Updated CWE Feed');
    });

    it('should throw NotFoundException for invalid id', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.updateFeedConfig('invalid-id', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteFeedConfig', () => {
    it('should delete feed config', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue(mockFeedConfig);
      mockPrismaService.feedConfig.delete.mockResolvedValue(mockFeedConfig);

      const result = await service.deleteFeedConfig('feed-1');

      expect(result.deleted).toBe(true);
    });

    it('should throw NotFoundException for invalid id', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue(null);

      await expect(service.deleteFeedConfig('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setSchedule', () => {
    it('should set daily schedule preset', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue(mockFeedConfig);
      mockPrismaService.feedConfig.update.mockResolvedValue({
        ...mockFeedConfig,
        schedule: '0 3 * * *',
      });

      const result = await service.setSchedule('feed-1', { preset: 'daily' });
      expect(result).toBeDefined();

      expect(mockPrismaService.feedConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: '0 3 * * *',
            isEnabled: true,
          }),
        }),
      );
    });

    it('should set manual schedule (disable)', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue(mockFeedConfig);
      mockPrismaService.feedConfig.update.mockResolvedValue({
        ...mockFeedConfig,
        isEnabled: false,
      });

      const result = await service.setSchedule('feed-1', { preset: 'manual' });
      expect(result).toBeDefined();

      expect(mockPrismaService.feedConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isEnabled: false,
          }),
        }),
      );
    });

    it('should set custom cron expression', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue(mockFeedConfig);
      mockPrismaService.feedConfig.update.mockResolvedValue({
        ...mockFeedConfig,
        schedule: '0 6 * * 1',
      });

      await service.setSchedule('feed-1', {
        preset: 'custom',
        customCron: '0 6 * * 1',
      });

      expect(mockPrismaService.feedConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: '0 6 * * 1',
          }),
        }),
      );
    });

    it('should throw BadRequestException for custom preset without cron', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue(mockFeedConfig);

      await expect(
        service.setSchedule('feed-1', { preset: 'custom' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return success for valid URL', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await service.testConnection('https://example.com');

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it('should return failure for non-OK response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await service.testConnection('https://example.com/notfound');

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
    });

    it('should return failure for network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.testConnection('https://invalid.example.com');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error');
    });
  });

  describe('triggerSync', () => {
    it('should create a new sync run', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue(mockFeedConfig);
      mockPrismaService.feedSyncRun.findFirst.mockResolvedValue(null);
      mockPrismaService.feedSyncRun.create.mockResolvedValue({
        ...mockSyncRun,
        status: 'pending',
      });

      const result = await service.triggerSync('feed-1');

      expect(result.syncRun.status).toBe('pending');
      expect(result.message).toBe('Sync triggered successfully');
    });

    it('should throw NotFoundException for invalid feed', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue(null);

      await expect(service.triggerSync('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if sync already running', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue(mockFeedConfig);
      mockPrismaService.feedSyncRun.findFirst.mockResolvedValue({
        ...mockSyncRun,
        status: 'running',
      });

      await expect(service.triggerSync('feed-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('listSyncRuns', () => {
    it('should return sync runs for feed', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue(mockFeedConfig);
      mockPrismaService.feedSyncRun.findMany.mockResolvedValue([mockSyncRun]);

      const result = await service.listSyncRuns('feed-1', {});

      expect(result.syncRuns).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockPrismaService.feedConfig.findUnique.mockResolvedValue(mockFeedConfig);
      mockPrismaService.feedSyncRun.findMany.mockResolvedValue([]);

      await service.listSyncRuns('feed-1', { status: 'completed' });

      expect(mockPrismaService.feedSyncRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'completed',
          }),
        }),
      );
    });
  });

  describe('getStats', () => {
    it('should return feed statistics', async () => {
      mockPrismaService.feedConfig.count
        .mockResolvedValueOnce(5)  // totalFeeds
        .mockResolvedValueOnce(4)  // enabledFeeds
        .mockResolvedValueOnce(1); // disabledFeeds
      mockPrismaService.feedSyncRun.count
        .mockResolvedValueOnce(10) // recentRuns
        .mockResolvedValueOnce(1); // failedRuns

      const result = await service.getStats();

      expect(result.totalFeeds).toBe(5);
      expect(result.enabledFeeds).toBe(4);
      expect(result.disabledFeeds).toBe(1);
      expect(result.recentRuns).toBe(10);
      expect(result.failedRuns).toBe(1);
    });
  });

  describe('getSchedulePresets', () => {
    it('should return available schedule presets', async () => {
      const result = await service.getSchedulePresets();

      expect(result).toHaveLength(5);
      expect(result.map(p => p.value)).toEqual([
        'daily',
        'weekly',
        'monthly',
        'manual',
        'custom',
      ]);
    });
  });
});
