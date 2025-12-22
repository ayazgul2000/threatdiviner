import { Test, TestingModule } from '@nestjs/testing';
import { BaselineService } from './baseline.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('BaselineService', () => {
  let service: BaselineService;

  const mockPrismaService = {
    finding: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    findingBaseline: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    scan: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BaselineService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<BaselineService>(BaselineService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateFingerprint', () => {
    it('should generate consistent fingerprints', () => {
      const fp1 = service.generateFingerprint('rule-1', 'src/app.ts', 'const x = 1');
      const fp2 = service.generateFingerprint('rule-1', 'src/app.ts', 'const x = 1');

      expect(fp1).toBe(fp2);
      expect(fp1).toHaveLength(32);
    });

    it('should generate different fingerprints for different inputs', () => {
      const fp1 = service.generateFingerprint('rule-1', 'src/app.ts', 'const x = 1');
      const fp2 = service.generateFingerprint('rule-2', 'src/app.ts', 'const x = 1');

      expect(fp1).not.toBe(fp2);
    });
  });

  describe('addToBaseline', () => {
    it('should add finding to baseline by findingId', async () => {
      const mockFinding = {
        id: 'finding-1',
        ruleId: 'sql-injection',
        filePath: 'src/db.ts',
        snippet: 'SELECT * FROM users',
        fingerprint: null,
        scan: { repositoryId: 'repo-1' },
      };

      const mockBaseline = {
        id: 'baseline-1',
        tenantId: 'tenant-1',
        repositoryId: 'repo-1',
        fingerprint: 'abc123',
        reason: 'Accepted risk',
        repository: { fullName: 'owner/repo' },
      };

      mockPrismaService.finding.findFirst.mockResolvedValue(mockFinding);
      mockPrismaService.findingBaseline.findFirst.mockResolvedValue(null);
      mockPrismaService.finding.update.mockResolvedValue({ ...mockFinding, fingerprint: 'abc123' });
      mockPrismaService.findingBaseline.create.mockResolvedValue(mockBaseline);
      mockPrismaService.finding.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.addToBaseline('tenant-1', 'user-1', {
        findingId: 'finding-1',
        repositoryId: 'repo-1',
        reason: 'Accepted risk',
      });

      expect(result.id).toBe('baseline-1');
      expect(mockPrismaService.findingBaseline.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when finding not found', async () => {
      mockPrismaService.finding.findFirst.mockResolvedValue(null);

      await expect(
        service.addToBaseline('tenant-1', 'user-1', {
          findingId: 'nonexistent',
          repositoryId: 'repo-1',
          reason: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when already baselined', async () => {
      const mockFinding = {
        id: 'finding-1',
        ruleId: 'sql-injection',
        filePath: 'src/db.ts',
        fingerprint: 'abc123',
        scan: { repositoryId: 'repo-1' },
      };

      mockPrismaService.finding.findFirst.mockResolvedValue(mockFinding);
      mockPrismaService.findingBaseline.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.addToBaseline('tenant-1', 'user-1', {
          findingId: 'finding-1',
          repositoryId: 'repo-1',
          reason: 'Test',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeFromBaseline', () => {
    it('should remove baseline and reopen findings', async () => {
      const mockBaseline = {
        id: 'baseline-1',
        fingerprint: 'abc123',
        tenantId: 'tenant-1',
      };

      mockPrismaService.findingBaseline.findFirst.mockResolvedValue(mockBaseline);
      mockPrismaService.findingBaseline.delete.mockResolvedValue(mockBaseline);
      mockPrismaService.finding.updateMany.mockResolvedValue({ count: 2 });

      await service.removeFromBaseline('tenant-1', 'baseline-1');

      expect(mockPrismaService.findingBaseline.delete).toHaveBeenCalledWith({
        where: { id: 'baseline-1' },
      });
      expect(mockPrismaService.finding.updateMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException when baseline not found', async () => {
      mockPrismaService.findingBaseline.findFirst.mockResolvedValue(null);

      await expect(
        service.removeFromBaseline('tenant-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listBaselines', () => {
    it('should return paginated baselines', async () => {
      const mockBaselines = [
        { id: 'baseline-1', fingerprint: 'abc123', repository: { fullName: 'owner/repo' } },
      ];

      mockPrismaService.findingBaseline.findMany.mockResolvedValue(mockBaselines);
      mockPrismaService.findingBaseline.count.mockResolvedValue(1);
      mockPrismaService.finding.count.mockResolvedValue(5);

      const result = await service.listBaselines('tenant-1', 'repo-1', 1, 50);

      expect(result.baselines).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.baselines[0].matchingFindingsCount).toBe(5);
    });
  });

  describe('compareScanToBaseline', () => {
    it('should compare scan findings to baseline', async () => {
      const mockScan = {
        id: 'scan-1',
        repositoryId: 'repo-1',
        findings: [
          { id: 'f1', ruleId: 'rule-1', filePath: 'a.ts', snippet: '', fingerprint: 'fp1', title: 'Finding 1', severity: 'high' },
          { id: 'f2', ruleId: 'rule-2', filePath: 'b.ts', snippet: '', fingerprint: 'fp2', title: 'Finding 2', severity: 'medium' },
        ],
      };

      const mockBaselines = [{ fingerprint: 'fp1' }];

      mockPrismaService.scan.findFirst.mockResolvedValue(mockScan);
      mockPrismaService.findingBaseline.findMany.mockResolvedValue(mockBaselines);

      const result = await service.compareScanToBaseline('tenant-1', 'scan-1');

      expect(result.baselinedFindings).toBe(1);
      expect(result.newFindings).toBe(1);
      expect(result.findings).toHaveLength(2);
    });

    it('should throw NotFoundException when scan not found', async () => {
      mockPrismaService.scan.findFirst.mockResolvedValue(null);

      await expect(
        service.compareScanToBaseline('tenant-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cleanupExpiredBaselines', () => {
    it('should delete expired baselines and reopen findings', async () => {
      const expiredBaselines = [
        { id: 'b1', tenantId: 'tenant-1', fingerprint: 'fp1' },
        { id: 'b2', tenantId: 'tenant-1', fingerprint: 'fp2' },
      ];

      mockPrismaService.findingBaseline.findMany.mockResolvedValue(expiredBaselines);
      mockPrismaService.findingBaseline.deleteMany.mockResolvedValue({ count: 2 });
      mockPrismaService.finding.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.cleanupExpiredBaselines();

      expect(result).toBe(2);
      expect(mockPrismaService.findingBaseline.deleteMany).toHaveBeenCalled();
    });

    it('should return 0 when no expired baselines', async () => {
      mockPrismaService.findingBaseline.findMany.mockResolvedValue([]);

      const result = await service.cleanupExpiredBaselines();

      expect(result).toBe(0);
    });
  });
});
