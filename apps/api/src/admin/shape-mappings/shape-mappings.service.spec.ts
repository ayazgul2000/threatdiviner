import { Test, TestingModule } from '@nestjs/testing';
import { ShapeMappingsService } from './shape-mappings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ShapeMappingsService', () => {
  let service: ShapeMappingsService;
  let prisma: {
    shapeMapping: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      groupBy: jest.Mock;
    };
  };

  const mockMapping = {
    id: 'sm-1',
    drawioStyle: 'mxgraph.aws4.ec2',
    stylePattern: null,
    threagileType: 'web-server',
    machineType: 'virtual',
    defaultInternetFacing: false,
    defaultEncryption: 'none',
    defaultAuthentication: 'none',
    defaultMultiTenant: false,
    displayName: 'AWS EC2',
    category: 'aws',
    iconUrl: null,
    status: 'pending',
    aiSuggested: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
  };

  beforeEach(async () => {
    prisma = {
      shapeMapping: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShapeMappingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ShapeMappingsService>(ShapeMappingsService);
  });

  describe('list', () => {
    it('should return mappings with total count', async () => {
      prisma.shapeMapping.findMany.mockResolvedValue([mockMapping]);
      prisma.shapeMapping.count.mockResolvedValue(1);

      const result = await service.list({});

      expect(result.mappings).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by search term', async () => {
      prisma.shapeMapping.findMany.mockResolvedValue([mockMapping]);
      prisma.shapeMapping.count.mockResolvedValue(1);

      await service.list({ search: 'ec2' });

      expect(prisma.shapeMapping.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { drawioStyle: { contains: 'ec2', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should filter by category', async () => {
      prisma.shapeMapping.findMany.mockResolvedValue([mockMapping]);
      prisma.shapeMapping.count.mockResolvedValue(1);

      await service.list({ category: 'aws' });

      expect(prisma.shapeMapping.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'aws' }),
        })
      );
    });

    it('should filter by status', async () => {
      prisma.shapeMapping.findMany.mockResolvedValue([mockMapping]);
      prisma.shapeMapping.count.mockResolvedValue(1);

      await service.list({ status: 'pending' });

      expect(prisma.shapeMapping.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        })
      );
    });
  });

  describe('getById', () => {
    it('should return mapping by id', async () => {
      prisma.shapeMapping.findUnique.mockResolvedValue(mockMapping);

      const result = await service.getById('sm-1');

      expect(result).toEqual(mockMapping);
    });

    it('should throw NotFoundException when mapping not found', async () => {
      prisma.shapeMapping.findUnique.mockResolvedValue(null);

      await expect(service.getById('not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto = {
      drawioStyle: 'mxgraph.aws4.rds',
      threagileType: 'database',
      displayName: 'AWS RDS',
      category: 'aws',
    };

    it('should create a new mapping', async () => {
      prisma.shapeMapping.findUnique.mockResolvedValue(null);
      prisma.shapeMapping.create.mockResolvedValue({ ...mockMapping, ...createDto });

      const result = await service.create(createDto, 'user-1');

      expect(result.drawioStyle).toBe(createDto.drawioStyle);
      expect(prisma.shapeMapping.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending',
            aiSuggested: false,
          }),
        })
      );
    });

    it('should throw ConflictException for duplicate drawioStyle', async () => {
      prisma.shapeMapping.findUnique.mockResolvedValue(mockMapping);

      await expect(service.create({ ...createDto, drawioStyle: mockMapping.drawioStyle }, 'user-1'))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    const updateDto = { displayName: 'Updated Name' };

    it('should update existing mapping', async () => {
      prisma.shapeMapping.findUnique.mockResolvedValue(mockMapping);
      prisma.shapeMapping.update.mockResolvedValue({ ...mockMapping, ...updateDto, status: 'pending' });

      const result = await service.update('sm-1', updateDto);

      expect(result.displayName).toBe('Updated Name');
    });

    it('should reset status to pending on update', async () => {
      const liveMapping = { ...mockMapping, status: 'live' };
      prisma.shapeMapping.findUnique.mockResolvedValue(liveMapping);
      prisma.shapeMapping.update.mockResolvedValue({ ...liveMapping, ...updateDto, status: 'pending' });

      await service.update('sm-1', updateDto);

      expect(prisma.shapeMapping.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'pending' }),
        })
      );
    });

    it('should throw NotFoundException when mapping not found', async () => {
      prisma.shapeMapping.findUnique.mockResolvedValue(null);

      await expect(service.update('not-found', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when changing to duplicate drawioStyle', async () => {
      prisma.shapeMapping.findUnique
        .mockResolvedValueOnce(mockMapping) // First call for existence check
        .mockResolvedValueOnce({ ...mockMapping, id: 'other-id' }); // Second call for duplicate check

      await expect(service.update('sm-1', { drawioStyle: 'duplicate-style' }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('should delete existing mapping', async () => {
      prisma.shapeMapping.findUnique.mockResolvedValue(mockMapping);
      prisma.shapeMapping.delete.mockResolvedValue(mockMapping);

      const result = await service.delete('sm-1');

      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException when mapping not found', async () => {
      prisma.shapeMapping.findUnique.mockResolvedValue(null);

      await expect(service.delete('not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitForReview', () => {
    it('should change status from pending to review', async () => {
      prisma.shapeMapping.findUnique.mockResolvedValue(mockMapping);
      prisma.shapeMapping.update.mockResolvedValue({ ...mockMapping, status: 'review' });

      const result = await service.submitForReview('sm-1');

      expect(result.status).toBe('review');
    });

    it('should throw NotFoundException when mapping not found', async () => {
      prisma.shapeMapping.findUnique.mockResolvedValue(null);

      await expect(service.submitForReview('not-found')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when not in pending status', async () => {
      prisma.shapeMapping.findUnique.mockResolvedValue({ ...mockMapping, status: 'live' });

      await expect(service.submitForReview('sm-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('approve', () => {
    const reviewMapping = { ...mockMapping, status: 'review' };

    it('should change status from review to live for SuperAdmin', async () => {
      prisma.shapeMapping.findUnique.mockResolvedValue(reviewMapping);
      prisma.shapeMapping.update.mockResolvedValue({ ...reviewMapping, status: 'live' });

      const result = await service.approve('sm-1', true);

      expect(result.status).toBe('live');
    });

    it('should throw ForbiddenException for non-SuperAdmin', async () => {
      await expect(service.approve('sm-1', false)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when mapping not found', async () => {
      prisma.shapeMapping.findUnique.mockResolvedValue(null);

      await expect(service.approve('not-found', true)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when not in review status', async () => {
      prisma.shapeMapping.findUnique.mockResolvedValue(mockMapping); // status: pending

      await expect(service.approve('sm-1', true)).rejects.toThrow(ConflictException);
    });
  });

  describe('bulkImport', () => {
    const importMappings = [
      { drawioStyle: 'mxgraph.aws4.s3', threagileType: 'file-server', displayName: 'AWS S3', category: 'aws' },
      { drawioStyle: 'mxgraph.aws4.lambda', threagileType: 'function', displayName: 'AWS Lambda', category: 'aws' },
    ];

    it('should import new mappings', async () => {
      prisma.shapeMapping.findUnique.mockResolvedValue(null);
      prisma.shapeMapping.create.mockImplementation((args) => Promise.resolve({ id: 'new-id', ...args.data }));

      const result = await service.bulkImport(importMappings, 'user-1');

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip duplicates and report them', async () => {
      prisma.shapeMapping.findUnique
        .mockResolvedValueOnce(mockMapping) // First mapping is duplicate
        .mockResolvedValueOnce(null); // Second is new
      prisma.shapeMapping.create.mockResolvedValue({ id: 'new-id' });

      const result = await service.bulkImport([
        { drawioStyle: mockMapping.drawioStyle, threagileType: 'web-server', displayName: 'Dup', category: 'aws' },
        { drawioStyle: 'new-style', threagileType: 'database', displayName: 'New', category: 'aws' },
      ], 'user-1');

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Duplicate style');
    });

    it('should handle create errors gracefully', async () => {
      prisma.shapeMapping.findUnique.mockResolvedValue(null);
      prisma.shapeMapping.create.mockRejectedValue(new Error('DB error'));

      const result = await service.bulkImport(importMappings, 'user-1');

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(2);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('getCategories', () => {
    it('should return unique categories', async () => {
      prisma.shapeMapping.groupBy.mockResolvedValue([
        { category: 'aws' },
        { category: 'azure' },
        { category: 'gcp' },
      ]);

      const result = await service.getCategories();

      expect(result).toEqual(['aws', 'azure', 'gcp']);
    });
  });
});
