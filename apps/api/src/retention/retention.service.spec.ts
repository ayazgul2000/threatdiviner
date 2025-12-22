import { Test, TestingModule } from '@nestjs/testing';
import { RetentionService } from './retention.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RetentionService', () => {
  let service: RetentionService;

  const mockPrismaService = {
    tenant: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    finding: {
      deleteMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    scan: {
      deleteMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    auditLog: {
      deleteMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    webhookEvent: {
      deleteMany: jest.fn(),
    },
    findingBaseline: {
      deleteMany: jest.fn(),
    },
    apiKey: {
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RetentionService>(RetentionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('cleanupAllTenants', () => {
    it('should cleanup data for all active tenants', async () => {
      const mockTenants = [
        { id: 'tenant-1', scanRetentionDays: 90, findingRetentionDays: 365, auditRetentionDays: 90 },
        { id: 'tenant-2', scanRetentionDays: 30, findingRetentionDays: 180, auditRetentionDays: 30 },
      ];

      mockPrismaService.tenant.findMany.mockResolvedValue(mockTenants);
      mockPrismaService.finding.deleteMany.mockResolvedValue({ count: 10 });
      mockPrismaService.scan.deleteMany.mockResolvedValue({ count: 5 });
      mockPrismaService.auditLog.deleteMany.mockResolvedValue({ count: 100 });
      mockPrismaService.webhookEvent.deleteMany.mockResolvedValue({ count: 50 });

      const result = await service.cleanupAllTenants();

      expect(result.scansDeleted).toBe(10); // 5 per tenant
      expect(result.findingsDeleted).toBe(20); // 10 per tenant
      expect(result.auditLogsDeleted).toBe(200); // 100 per tenant
      expect(result.webhookEventsDeleted).toBe(50);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should continue even if one tenant fails', async () => {
      const mockTenants = [
        { id: 'tenant-1', scanRetentionDays: 90, findingRetentionDays: 365, auditRetentionDays: 90 },
      ];

      mockPrismaService.tenant.findMany.mockResolvedValue(mockTenants);
      mockPrismaService.finding.deleteMany.mockRejectedValueOnce(new Error('DB Error'));
      mockPrismaService.webhookEvent.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.cleanupAllTenants();

      expect(result.scansDeleted).toBe(0);
      expect(result.webhookEventsDeleted).toBe(0);
    });
  });

  describe('cleanupTenant', () => {
    it('should delete old data based on retention periods', async () => {
      mockPrismaService.finding.deleteMany.mockResolvedValue({ count: 50 });
      mockPrismaService.scan.deleteMany.mockResolvedValue({ count: 10 });
      mockPrismaService.auditLog.deleteMany.mockResolvedValue({ count: 200 });

      const result = await service.cleanupTenant('tenant-1', {
        scanRetentionDays: 90,
        findingRetentionDays: 365,
        auditRetentionDays: 90,
      });

      expect(result.findingsDeleted).toBe(50);
      expect(result.scansDeleted).toBe(10);
      expect(result.auditLogsDeleted).toBe(200);

      expect(mockPrismaService.finding.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            createdAt: expect.any(Object),
          }),
        }),
      );
    });
  });

  describe('cleanupWebhookEvents', () => {
    it('should delete webhook events older than retention period', async () => {
      mockPrismaService.webhookEvent.deleteMany.mockResolvedValue({ count: 100 });

      const result = await service.cleanupWebhookEvents(30);

      expect(result).toBe(100);
      expect(mockPrismaService.webhookEvent.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { lt: expect.any(Date) },
          }),
        }),
      );
    });
  });

  describe('cleanupExpiredBaselines', () => {
    it('should delete expired baselines', async () => {
      mockPrismaService.findingBaseline.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.cleanupExpiredBaselines();

      expect(result).toBe(5);
      expect(mockPrismaService.findingBaseline.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { expiresAt: { lt: expect.any(Date) } },
        }),
      );
    });
  });

  describe('cleanupExpiredApiKeys', () => {
    it('should delete expired API keys', async () => {
      mockPrismaService.apiKey.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.cleanupExpiredApiKeys();

      expect(result).toBe(3);
      expect(mockPrismaService.apiKey.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { expiresAt: { lt: expect.any(Date) } },
        }),
      );
    });
  });

  describe('getTenantRetentionConfig', () => {
    it('should return tenant retention configuration', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        scanRetentionDays: 90,
        findingRetentionDays: 365,
        auditRetentionDays: 90,
      });

      const result = await service.getTenantRetentionConfig('tenant-1');

      expect(result?.scanRetentionDays).toBe(90);
      expect(result?.findingRetentionDays).toBe(365);
      expect(result?.auditRetentionDays).toBe(90);
    });

    it('should return null when tenant not found', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      const result = await service.getTenantRetentionConfig('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateTenantRetentionConfig', () => {
    it('should update retention configuration', async () => {
      mockPrismaService.tenant.update.mockResolvedValue({
        scanRetentionDays: 180,
        findingRetentionDays: 730,
        auditRetentionDays: 180,
      });

      const result = await service.updateTenantRetentionConfig('tenant-1', {
        scanRetentionDays: 180,
        findingRetentionDays: 730,
        auditRetentionDays: 180,
      });

      expect(result.scanRetentionDays).toBe(180);
      expect(mockPrismaService.tenant.update).toHaveBeenCalled();
    });

    it('should reject scan retention less than 7 days', async () => {
      await expect(
        service.updateTenantRetentionConfig('tenant-1', {
          scanRetentionDays: 3,
        }),
      ).rejects.toThrow('Minimum scan retention is 7 days');
    });

    it('should reject finding retention less than 30 days', async () => {
      await expect(
        service.updateTenantRetentionConfig('tenant-1', {
          findingRetentionDays: 15,
        }),
      ).rejects.toThrow('Minimum finding retention is 30 days');
    });

    it('should reject audit retention less than 30 days', async () => {
      await expect(
        service.updateTenantRetentionConfig('tenant-1', {
          auditRetentionDays: 7,
        }),
      ).rejects.toThrow('Minimum audit log retention is 30 days');
    });
  });

  describe('getTenantStorageStats', () => {
    it('should return storage statistics', async () => {
      mockPrismaService.scan.count.mockResolvedValue(100);
      mockPrismaService.finding.count.mockResolvedValue(500);
      mockPrismaService.auditLog.count.mockResolvedValue(1000);
      mockPrismaService.scan.findFirst.mockResolvedValue({ createdAt: new Date('2024-01-01') });
      mockPrismaService.finding.findFirst.mockResolvedValue({ createdAt: new Date('2024-01-15') });
      mockPrismaService.auditLog.findFirst.mockResolvedValue({ createdAt: new Date('2024-02-01') });

      const result = await service.getTenantStorageStats('tenant-1');

      expect(result.scans.count).toBe(100);
      expect(result.findings.count).toBe(500);
      expect(result.auditLogs.count).toBe(1000);
      expect(result.scans.oldestDate).toEqual(new Date('2024-01-01'));
    });

    it('should handle empty data', async () => {
      mockPrismaService.scan.count.mockResolvedValue(0);
      mockPrismaService.finding.count.mockResolvedValue(0);
      mockPrismaService.auditLog.count.mockResolvedValue(0);
      mockPrismaService.scan.findFirst.mockResolvedValue(null);
      mockPrismaService.finding.findFirst.mockResolvedValue(null);
      mockPrismaService.auditLog.findFirst.mockResolvedValue(null);

      const result = await service.getTenantStorageStats('tenant-1');

      expect(result.scans.count).toBe(0);
      expect(result.scans.oldestDate).toBeNull();
    });
  });
});
