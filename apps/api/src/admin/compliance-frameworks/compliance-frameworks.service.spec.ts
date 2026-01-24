import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceFrameworksService } from './compliance-frameworks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('ComplianceFrameworksService', () => {
  let service: ComplianceFrameworksService;
  let prisma: {
    complianceFramework: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    complianceControl: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      groupBy: jest.Mock;
    };
    riskControlMapping: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    canonicalRisk: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const mockFramework = {
    id: 'iso-27001-2022',
    name: 'ISO/IEC 27001:2022',
    version: '2022',
    description: 'Information security management',
    sourceUrl: 'https://iso.org',
    lastUpdated: new Date(),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { controls: 93 },
  };

  const mockControl = {
    id: 'ctrl-1',
    frameworkId: 'iso-27001-2022',
    controlId: 'A.5.1',
    parentId: null,
    category: 'Organizational controls',
    name: 'Policies for information security',
    description: 'Information security policies shall be defined',
    guidance: null,
    level: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { children: 2, riskMappings: 3 },
  };

  const mockMapping = {
    id: 'map-1',
    canonicalRiskId: 'risk-1',
    complianceControlId: 'ctrl-1',
    relevance: 'primary',
    aiConfidence: 0.95,
    createdAt: new Date(),
    canonicalRisk: {
      id: 'risk-1',
      canonicalId: 'missing-auth',
      title: 'Missing Authentication',
      status: 'live',
    },
  };

  beforeEach(async () => {
    prisma = {
      complianceFramework: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      complianceControl: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        groupBy: jest.fn(),
      },
      riskControlMapping: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      canonicalRisk: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceFrameworksService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ComplianceFrameworksService>(ComplianceFrameworksService);
  });

  describe('listFrameworks', () => {
    it('should return frameworks with total count', async () => {
      prisma.complianceFramework.findMany.mockResolvedValue([mockFramework]);
      prisma.complianceFramework.count.mockResolvedValue(1);

      const result = await service.listFrameworks({});

      expect(result.frameworks).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by search term', async () => {
      prisma.complianceFramework.findMany.mockResolvedValue([mockFramework]);
      prisma.complianceFramework.count.mockResolvedValue(1);

      await service.listFrameworks({ search: 'ISO' });

      expect(prisma.complianceFramework.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: 'ISO', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('should filter by isActive', async () => {
      prisma.complianceFramework.findMany.mockResolvedValue([mockFramework]);
      prisma.complianceFramework.count.mockResolvedValue(1);

      await service.listFrameworks({ isActive: 'true' });

      expect(prisma.complianceFramework.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
    });
  });

  describe('getFrameworkById', () => {
    it('should return framework with controls', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue({
        ...mockFramework,
        controls: [mockControl],
      });

      const result = await service.getFrameworkById('iso-27001-2022');

      expect(result.id).toBe('iso-27001-2022');
      expect(result.controls).toBeDefined();
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(null);

      await expect(service.getFrameworkById('not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createFramework', () => {
    const createDto = {
      id: 'nist-800-53',
      name: 'NIST SP 800-53',
      version: 'Rev 5',
      description: 'Security controls',
    };

    it('should create a new framework', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(null);
      prisma.complianceFramework.create.mockResolvedValue({ ...mockFramework, ...createDto });

      const result = await service.createFramework(createDto);

      expect(result.id).toBe(createDto.id);
    });

    it('should throw ConflictException for duplicate id', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(mockFramework);

      await expect(service.createFramework({ ...createDto, id: mockFramework.id }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('updateFramework', () => {
    const updateDto = { name: 'Updated Name' };

    it('should update existing framework', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(mockFramework);
      prisma.complianceFramework.update.mockResolvedValue({ ...mockFramework, ...updateDto });

      const result = await service.updateFramework('iso-27001-2022', updateDto);

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(null);

      await expect(service.updateFramework('not-found', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteFramework', () => {
    it('should delete existing framework', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(mockFramework);
      prisma.complianceFramework.delete.mockResolvedValue(mockFramework);

      const result = await service.deleteFramework('iso-27001-2022');

      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(null);

      await expect(service.deleteFramework('not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listControls', () => {
    it('should return controls for framework', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(mockFramework);
      prisma.complianceControl.findMany.mockResolvedValue([mockControl]);
      prisma.complianceControl.count.mockResolvedValue(1);

      const result = await service.listControls('iso-27001-2022', {});

      expect(result.controls).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should throw NotFoundException when framework not found', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(null);

      await expect(service.listControls('not-found', {})).rejects.toThrow(NotFoundException);
    });

    it('should filter by category', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(mockFramework);
      prisma.complianceControl.findMany.mockResolvedValue([mockControl]);
      prisma.complianceControl.count.mockResolvedValue(1);

      await service.listControls('iso-27001-2022', { category: 'Organizational controls' });

      expect(prisma.complianceControl.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'Organizational controls' }),
        })
      );
    });
  });

  describe('createControl', () => {
    const createDto = {
      controlId: 'A.5.2',
      category: 'Organizational controls',
      name: 'New Control',
    };

    it('should create a new control', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(mockFramework);
      prisma.complianceControl.findFirst.mockResolvedValue(null);
      prisma.complianceControl.create.mockResolvedValue({ ...mockControl, ...createDto });

      const result = await service.createControl('iso-27001-2022', createDto);

      expect(result.controlId).toBe(createDto.controlId);
    });

    it('should throw NotFoundException when framework not found', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(null);

      await expect(service.createControl('not-found', createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate controlId', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(mockFramework);
      prisma.complianceControl.findFirst.mockResolvedValue(mockControl);

      await expect(service.createControl('iso-27001-2022', { ...createDto, controlId: mockControl.controlId }))
        .rejects.toThrow(ConflictException);
    });

    it('should validate parent exists', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(mockFramework);
      prisma.complianceControl.findFirst
        .mockResolvedValueOnce(null) // duplicate check
        .mockResolvedValueOnce(null); // parent check

      await expect(service.createControl('iso-27001-2022', { ...createDto, parentId: 'nonexistent' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('updateControl', () => {
    const updateDto = { name: 'Updated Control Name' };

    it('should update existing control', async () => {
      prisma.complianceControl.findFirst.mockResolvedValue(mockControl);
      prisma.complianceControl.update.mockResolvedValue({ ...mockControl, ...updateDto });

      const result = await service.updateControl('iso-27001-2022', 'ctrl-1', updateDto);

      expect(result.name).toBe('Updated Control Name');
    });

    it('should throw NotFoundException when control not found', async () => {
      prisma.complianceControl.findFirst.mockResolvedValue(null);

      await expect(service.updateControl('iso-27001-2022', 'not-found', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should prevent self-referencing parent', async () => {
      prisma.complianceControl.findFirst.mockResolvedValue(mockControl);

      await expect(service.updateControl('iso-27001-2022', 'ctrl-1', { parentId: 'ctrl-1' }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('deleteControl', () => {
    it('should delete existing control', async () => {
      prisma.complianceControl.findFirst.mockResolvedValue(mockControl);
      prisma.complianceControl.delete.mockResolvedValue(mockControl);

      const result = await service.deleteControl('iso-27001-2022', 'ctrl-1');

      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException when control not found', async () => {
      prisma.complianceControl.findFirst.mockResolvedValue(null);

      await expect(service.deleteControl('iso-27001-2022', 'not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addRiskMapping', () => {
    const mappingDto = {
      canonicalRiskId: 'risk-1',
      relevance: 'primary',
    };

    it('should add risk mapping', async () => {
      prisma.complianceControl.findUnique.mockResolvedValue(mockControl);
      prisma.canonicalRisk.findUnique.mockResolvedValue({ id: 'risk-1', canonicalId: 'missing-auth', title: 'Missing Auth', status: 'live' });
      prisma.riskControlMapping.findFirst.mockResolvedValue(null);
      prisma.riskControlMapping.create.mockResolvedValue(mockMapping);

      const result = await service.addRiskMapping('ctrl-1', mappingDto);

      expect(result.canonicalRiskId).toBe('risk-1');
    });

    it('should throw NotFoundException when control not found', async () => {
      prisma.complianceControl.findUnique.mockResolvedValue(null);

      await expect(service.addRiskMapping('not-found', mappingDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when risk not found', async () => {
      prisma.complianceControl.findUnique.mockResolvedValue(mockControl);
      prisma.canonicalRisk.findUnique.mockResolvedValue(null);

      await expect(service.addRiskMapping('ctrl-1', mappingDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate mapping', async () => {
      prisma.complianceControl.findUnique.mockResolvedValue(mockControl);
      prisma.canonicalRisk.findUnique.mockResolvedValue({ id: 'risk-1' });
      prisma.riskControlMapping.findFirst.mockResolvedValue(mockMapping);

      await expect(service.addRiskMapping('ctrl-1', mappingDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('removeRiskMapping', () => {
    it('should remove risk mapping', async () => {
      prisma.riskControlMapping.findFirst.mockResolvedValue(mockMapping);
      prisma.riskControlMapping.delete.mockResolvedValue(mockMapping);

      const result = await service.removeRiskMapping('ctrl-1', 'map-1');

      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException when mapping not found', async () => {
      prisma.riskControlMapping.findFirst.mockResolvedValue(null);

      await expect(service.removeRiskMapping('ctrl-1', 'not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCategories', () => {
    it('should return unique categories', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(mockFramework);
      prisma.complianceControl.groupBy.mockResolvedValue([
        { category: 'Organizational controls' },
        { category: 'People controls' },
        { category: 'Physical controls' },
      ]);

      const result = await service.getCategories('iso-27001-2022');

      expect(result).toEqual(['Organizational controls', 'People controls', 'Physical controls']);
    });

    it('should throw NotFoundException when framework not found', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(null);

      await expect(service.getCategories('not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getControlTree', () => {
    it('should return hierarchical control tree', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(mockFramework);
      prisma.complianceControl.findMany.mockResolvedValue([
        { ...mockControl, children: [] },
      ]);

      const result = await service.getControlTree('iso-27001-2022');

      expect(result).toHaveLength(1);
      expect(result[0].controlId).toBe('A.5.1');
    });

    it('should throw NotFoundException when framework not found', async () => {
      prisma.complianceFramework.findUnique.mockResolvedValue(null);

      await expect(service.getControlTree('not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMappingsCount', () => {
    it('should return mappings count for framework', async () => {
      prisma.riskControlMapping.count.mockResolvedValue(42);

      const result = await service.getMappingsCount('iso-27001-2022');

      expect(result).toBe(42);
    });
  });
});
