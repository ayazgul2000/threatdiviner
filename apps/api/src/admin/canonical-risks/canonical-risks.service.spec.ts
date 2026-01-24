import { Test, TestingModule } from '@nestjs/testing';
import { CanonicalRisksService } from './canonical-risks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('CanonicalRisksService', () => {
  let service: CanonicalRisksService;
  let prisma: {
    canonicalRisk: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    canonicalRiskSource: {
      findFirst: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
      groupBy: jest.Mock;
    };
  };

  const mockRisk = {
    id: 'cr-1',
    tenantId: 'tenant-1',
    canonicalId: 'public-storage-exposure',
    title: 'Public Cloud Storage Exposure',
    description: 'Cloud storage is publicly accessible',
    defaultSeverity: 'high',
    cweId: '732',
    cweName: 'Incorrect Permission Assignment',
    capecIds: ['1', '122'],
    attackIds: ['T1530'],
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    sources: [],
    _count: { sources: 0 },
  };

  const mockSource = {
    id: 'src-1',
    canonicalRiskId: 'cr-1',
    source: 'prowler',
    sourceRuleId: 's3_bucket_public_access',
    sourceTitle: 'S3 Bucket Public Access',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      canonicalRisk: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      canonicalRiskSource: {
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanonicalRisksService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CanonicalRisksService>(CanonicalRisksService);
  });

  describe('list', () => {
    it('should return risks with total count', async () => {
      prisma.canonicalRisk.findMany.mockResolvedValue([mockRisk]);
      prisma.canonicalRisk.count.mockResolvedValue(1);

      const result = await service.list({});

      expect(result.risks).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by search term', async () => {
      prisma.canonicalRisk.findMany.mockResolvedValue([mockRisk]);
      prisma.canonicalRisk.count.mockResolvedValue(1);

      await service.list({ search: 'storage' });

      expect(prisma.canonicalRisk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { canonicalId: { contains: 'storage', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should filter by source', async () => {
      prisma.canonicalRisk.findMany.mockResolvedValue([mockRisk]);
      prisma.canonicalRisk.count.mockResolvedValue(1);

      await service.list({ source: 'prowler' });

      expect(prisma.canonicalRisk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sources: { some: { source: 'prowler' } },
          }),
        })
      );
    });

    it('should filter by severity', async () => {
      prisma.canonicalRisk.findMany.mockResolvedValue([mockRisk]);
      prisma.canonicalRisk.count.mockResolvedValue(1);

      await service.list({ severity: 'high' });

      expect(prisma.canonicalRisk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ defaultSeverity: 'high' }),
        })
      );
    });

    it('should filter by status', async () => {
      prisma.canonicalRisk.findMany.mockResolvedValue([mockRisk]);
      prisma.canonicalRisk.count.mockResolvedValue(1);

      await service.list({ status: 'pending' });

      expect(prisma.canonicalRisk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        })
      );
    });
  });

  describe('getById', () => {
    it('should return risk by id', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(mockRisk);

      const result = await service.getById('cr-1');

      expect(result).toEqual(mockRisk);
    });

    it('should throw NotFoundException when risk not found', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(null);

      await expect(service.getById('not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto = {
      canonicalId: 'sql-injection',
      title: 'SQL Injection',
      description: 'SQL injection vulnerability',
      defaultSeverity: 'critical',
      cweId: '89',
    };

    it('should create a new risk', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(null);
      prisma.canonicalRisk.create.mockResolvedValue({ ...mockRisk, ...createDto });

      const result = await service.create(createDto, 'tenant-1');

      expect(result.canonicalId).toBe(createDto.canonicalId);
      expect(prisma.canonicalRisk.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending',
            tenantId: 'tenant-1',
          }),
        })
      );
    });

    it('should throw ConflictException for duplicate canonicalId', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(mockRisk);

      await expect(service.create({ ...createDto, canonicalId: mockRisk.canonicalId }, 'tenant-1'))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    const updateDto = { title: 'Updated Title' };

    it('should update existing risk', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(mockRisk);
      prisma.canonicalRisk.update.mockResolvedValue({ ...mockRisk, ...updateDto, status: 'pending' });

      const result = await service.update('cr-1', updateDto);

      expect(result.title).toBe('Updated Title');
    });

    it('should reset status to pending on update', async () => {
      const liveRisk = { ...mockRisk, status: 'live' };
      prisma.canonicalRisk.findUnique.mockResolvedValue(liveRisk);
      prisma.canonicalRisk.update.mockResolvedValue({ ...liveRisk, ...updateDto, status: 'pending' });

      await service.update('cr-1', updateDto);

      expect(prisma.canonicalRisk.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'pending' }),
        })
      );
    });

    it('should throw NotFoundException when risk not found', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(null);

      await expect(service.update('not-found', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when changing to duplicate canonicalId', async () => {
      prisma.canonicalRisk.findUnique
        .mockResolvedValueOnce(mockRisk)
        .mockResolvedValueOnce({ ...mockRisk, id: 'other-id' });

      await expect(service.update('cr-1', { canonicalId: 'duplicate-id' }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('should delete existing risk', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(mockRisk);
      prisma.canonicalRisk.delete.mockResolvedValue(mockRisk);

      const result = await service.delete('cr-1');

      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException when risk not found', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(null);

      await expect(service.delete('not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addSource', () => {
    const sourceDto = {
      source: 'prowler',
      sourceRuleId: 's3_bucket_public',
      sourceTitle: 'S3 Bucket Public',
    };

    it('should add source mapping to risk', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(mockRisk);
      prisma.canonicalRiskSource.findFirst.mockResolvedValue(null);
      prisma.canonicalRiskSource.create.mockResolvedValue({ ...mockSource, ...sourceDto });
      prisma.canonicalRisk.update.mockResolvedValue(mockRisk);

      const result = await service.addSource('cr-1', sourceDto);

      expect(result.source).toBe('prowler');
    });

    it('should throw NotFoundException when risk not found', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(null);

      await expect(service.addSource('not-found', sourceDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate source mapping', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(mockRisk);
      prisma.canonicalRiskSource.findFirst.mockResolvedValue(mockSource);

      await expect(service.addSource('cr-1', sourceDto)).rejects.toThrow(ConflictException);
    });

    it('should reset risk status to pending when adding source', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(mockRisk);
      prisma.canonicalRiskSource.findFirst.mockResolvedValue(null);
      prisma.canonicalRiskSource.create.mockResolvedValue(mockSource);
      prisma.canonicalRisk.update.mockResolvedValue(mockRisk);

      await service.addSource('cr-1', sourceDto);

      expect(prisma.canonicalRisk.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'pending' },
        })
      );
    });
  });

  describe('removeSource', () => {
    it('should remove source mapping', async () => {
      prisma.canonicalRiskSource.findFirst.mockResolvedValue(mockSource);
      prisma.canonicalRiskSource.delete.mockResolvedValue(mockSource);
      prisma.canonicalRisk.update.mockResolvedValue(mockRisk);

      const result = await service.removeSource('cr-1', 'src-1');

      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException when source not found', async () => {
      prisma.canonicalRiskSource.findFirst.mockResolvedValue(null);

      await expect(service.removeSource('cr-1', 'not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitForReview', () => {
    it('should change status from pending to review', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(mockRisk);
      prisma.canonicalRisk.update.mockResolvedValue({ ...mockRisk, status: 'review' });

      const result = await service.submitForReview('cr-1');

      expect(result.status).toBe('review');
    });

    it('should throw NotFoundException when risk not found', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(null);

      await expect(service.submitForReview('not-found')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when not in pending status', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue({ ...mockRisk, status: 'live' });

      await expect(service.submitForReview('cr-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('approve', () => {
    const reviewRisk = { ...mockRisk, status: 'review' };

    it('should change status from review to live for SuperAdmin', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(reviewRisk);
      prisma.canonicalRisk.update.mockResolvedValue({ ...reviewRisk, status: 'live' });

      const result = await service.approve('cr-1', true);

      expect(result.status).toBe('live');
    });

    it('should throw ForbiddenException for non-SuperAdmin', async () => {
      await expect(service.approve('cr-1', false)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when risk not found', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(null);

      await expect(service.approve('not-found', true)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when not in review status', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(mockRisk); // status: pending

      await expect(service.approve('cr-1', true)).rejects.toThrow(ConflictException);
    });
  });

  describe('bulkImport', () => {
    const importRisks = [
      { canonicalId: 'risk-1', title: 'Risk 1' },
      { canonicalId: 'risk-2', title: 'Risk 2', sources: [{ source: 'cis', sourceRuleId: 'CIS-1.1' }] },
    ];

    it('should import new risks', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(null);
      prisma.canonicalRisk.create.mockImplementation((args) => Promise.resolve({ id: 'new-id', ...args.data }));

      const result = await service.bulkImport(importRisks, 'tenant-1');

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip duplicates and report them', async () => {
      prisma.canonicalRisk.findUnique
        .mockResolvedValueOnce(mockRisk)
        .mockResolvedValueOnce(null);
      prisma.canonicalRisk.create.mockResolvedValue({ id: 'new-id' });

      const result = await service.bulkImport([
        { canonicalId: mockRisk.canonicalId, title: 'Dup' },
        { canonicalId: 'new-risk', title: 'New' },
      ], 'tenant-1');

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Duplicate canonical ID');
    });

    it('should handle create errors gracefully', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(null);
      prisma.canonicalRisk.create.mockRejectedValue(new Error('DB error'));

      const result = await service.bulkImport(importRisks, 'tenant-1');

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(2);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('getSources', () => {
    it('should return unique sources', async () => {
      prisma.canonicalRiskSource.groupBy.mockResolvedValue([
        { source: 'cis' },
        { source: 'prowler' },
        { source: 'trivy' },
      ]);

      const result = await service.getSources();

      expect(result).toEqual(['cis', 'prowler', 'trivy']);
    });
  });

  describe('getSeverities', () => {
    it('should return severity levels', async () => {
      const result = await service.getSeverities();

      expect(result).toEqual(['low', 'medium', 'high', 'critical']);
    });
  });
});
