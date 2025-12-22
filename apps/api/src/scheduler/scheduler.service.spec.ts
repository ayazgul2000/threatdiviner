import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerService } from './scheduler.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/services/queue.service';
import { CryptoService } from '../scm/services/crypto.service';
import { GitHubProvider } from '../scm/providers';
import { EmailService } from '../notifications/email/email.service';

describe('SchedulerService', () => {
  let service: SchedulerService;

  const mockPrismaService = {
    scanConfig: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    scan: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    finding: {
      groupBy: jest.fn(),
    },
    notificationConfig: {
      findMany: jest.fn(),
    },
  };

  const mockQueueService = {
    enqueueScan: jest.fn(),
  };

  const mockCryptoService = {
    decrypt: jest.fn((token: string) => `decrypted:${token}`),
  };

  const mockGitHubProvider = {
    getLatestCommit: jest.fn(),
  };

  const mockEmailService = {
    sendWeeklySummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: CryptoService, useValue: mockCryptoService },
        { provide: GitHubProvider, useValue: mockGitHubProvider },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getScheduleConfig', () => {
    it('should return schedule config for repository', async () => {
      const mockConfig = {
        scheduleEnabled: true,
        scheduleCron: '0 2 * * *',
        scheduleTimezone: 'UTC',
        lastScheduledScan: null,
        nextScheduledScan: new Date(),
      };

      mockPrismaService.scanConfig.findFirst.mockResolvedValue(mockConfig);

      const result = await service.getScheduleConfig('tenant-1', 'repo-1');

      expect(result.scheduleEnabled).toBe(true);
      expect(result.scheduleCron).toBe('0 2 * * *');
    });

    it('should return default config when not found', async () => {
      mockPrismaService.scanConfig.findFirst.mockResolvedValue(null);

      const result = await service.getScheduleConfig('tenant-1', 'repo-1');

      expect(result.scheduleEnabled).toBe(false);
      expect(result.scheduleCron).toBeNull();
      expect(result.scheduleTimezone).toBe('UTC');
    });
  });

  describe('updateScheduleConfig', () => {
    it('should update schedule configuration', async () => {
      const updatedConfig = {
        scheduleEnabled: true,
        scheduleCron: '0 3 * * *',
        scheduleTimezone: 'America/New_York',
        lastScheduledScan: null,
        nextScheduledScan: new Date(),
      };

      mockPrismaService.scanConfig.update.mockResolvedValue(updatedConfig);

      const result = await service.updateScheduleConfig('tenant-1', 'repo-1', {
        scheduleEnabled: true,
        scheduleCron: '0 3 * * *',
        scheduleTimezone: 'America/New_York',
      });

      expect(result.scheduleEnabled).toBe(true);
      expect(mockPrismaService.scanConfig.update).toHaveBeenCalled();
    });

    it('should handle preset conversion', async () => {
      const updatedConfig = {
        scheduleEnabled: true,
        scheduleCron: '0 2 * * *',
        scheduleTimezone: 'UTC',
        lastScheduledScan: null,
        nextScheduledScan: new Date(),
      };

      mockPrismaService.scanConfig.update.mockResolvedValue(updatedConfig);

      await service.updateScheduleConfig('tenant-1', 'repo-1', {
        preset: 'daily',
      });

      expect(mockPrismaService.scanConfig.update).toHaveBeenCalled();
    });
  });

  describe('checkScheduledScans', () => {
    it('should process due scans', async () => {
      const mockConfigs = [
        {
          id: 'config-1',
          scheduleEnabled: true,
          scheduleCron: '0 2 * * *',
          enableSast: true,
          enableSca: true,
          enableSecrets: true,
          enableIac: true,
          enableDast: false,
          enableContainerScan: false,
          targetUrls: [],
          containerImages: [],
          skipPaths: [],
          branches: ['main'],
          repository: {
            id: 'repo-1',
            fullName: 'owner/repo',
            defaultBranch: 'main',
            cloneUrl: 'https://github.com/owner/repo.git',
            connection: {
              id: 'conn-1',
              accessToken: 'encrypted-token',
            },
            tenant: {
              id: 'tenant-1',
              isActive: true,
              slug: 'test-tenant',
            },
          },
        },
      ];

      mockPrismaService.scanConfig.findMany.mockResolvedValue(mockConfigs);
      mockGitHubProvider.getLatestCommit.mockResolvedValue({ sha: 'abc123' });
      mockPrismaService.scan.create.mockResolvedValue({ id: 'scan-1' });
      mockPrismaService.scanConfig.update.mockResolvedValue({});

      await service.checkScheduledScans();

      expect(mockPrismaService.scanConfig.findMany).toHaveBeenCalled();
    });

    it('should skip inactive tenants', async () => {
      const mockConfigs = [
        {
          id: 'config-1',
          repository: {
            tenant: { id: 'tenant-1', isActive: false, slug: 'inactive' },
          },
        },
      ];

      mockPrismaService.scanConfig.findMany.mockResolvedValue(mockConfigs);

      await service.checkScheduledScans();

      expect(mockQueueService.enqueueScan).not.toHaveBeenCalled();
    });
  });

  describe('triggerImmediateScan', () => {
    it('should trigger scan immediately', async () => {
      const mockConfig = {
        id: 'config-1',
        enableSast: true,
        enableSca: true,
        enableSecrets: true,
        enableIac: true,
        enableDast: false,
        enableContainerScan: false,
        targetUrls: [],
        containerImages: [],
        skipPaths: [],
        branches: ['main'],
        repository: {
          id: 'repo-1',
          fullName: 'owner/repo',
          defaultBranch: 'main',
          cloneUrl: 'https://github.com/owner/repo.git',
          connection: {
            id: 'conn-1',
            accessToken: 'token',
          },
          tenant: {
            id: 'tenant-1',
            isActive: true,
          },
        },
      };

      mockPrismaService.scanConfig.findFirst.mockResolvedValue(mockConfig);
      mockGitHubProvider.getLatestCommit.mockResolvedValue({ sha: 'abc123' });
      mockPrismaService.scan.create.mockResolvedValue({ id: 'scan-1' });
      mockPrismaService.scanConfig.update.mockResolvedValue({});
      mockPrismaService.scan.findFirst.mockResolvedValue({ id: 'scan-1' });

      const result = await service.triggerImmediateScan('tenant-1', 'repo-1');

      expect(result).toBe('scan-1');
    });

    it('should throw error when repository not found', async () => {
      mockPrismaService.scanConfig.findFirst.mockResolvedValue(null);

      await expect(
        service.triggerImmediateScan('tenant-1', 'repo-1'),
      ).rejects.toThrow('Repository not found or no scan config');
    });
  });
});
