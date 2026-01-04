import { Test, TestingModule } from '@nestjs/testing';
import { SbomService } from './sbom.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('SbomService', () => {
  let service: SbomService;

  const mockPrisma = {
    sbom: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    sbomComponent: {
      create: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    sbomVulnerability: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    sbomComponentVuln: {
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SbomService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SbomService>(SbomService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listSboms', () => {
    it('should return SBOMs for tenant', async () => {
      const mockSboms = [
        { id: '1', name: 'SBOM 1', format: 'CYCLONEDX', _count: { components: 10, vulnerabilities: 2 } },
        { id: '2', name: 'SBOM 2', format: 'SPDX', _count: { components: 5, vulnerabilities: 0 } },
      ];
      mockPrisma.sbom.findMany.mockResolvedValue(mockSboms);
      mockPrisma.sbom.count.mockResolvedValue(2);

      const result = await service.listSboms('tenant-1');

      expect(result.sboms).toEqual(mockSboms);
      expect(result.total).toBe(2);
    });

    it('should filter by repositoryId', async () => {
      mockPrisma.sbom.findMany.mockResolvedValue([]);
      mockPrisma.sbom.count.mockResolvedValue(0);

      await service.listSboms('tenant-1', { repositoryId: 'repo-1' });

      expect(mockPrisma.sbom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ repositoryId: 'repo-1' }),
        }),
      );
    });

    it('should support pagination', async () => {
      mockPrisma.sbom.findMany.mockResolvedValue([]);
      mockPrisma.sbom.count.mockResolvedValue(0);

      await service.listSboms('tenant-1', { limit: 10, offset: 20 });

      expect(mockPrisma.sbom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        }),
      );
    });
  });

  describe('getSbom', () => {
    it('should return SBOM with components and vulnerabilities', async () => {
      const mockSbom = {
        id: '1',
        name: 'Test SBOM',
        components: [{ id: 'c1', name: 'lodash', vulnerabilities: [] }],
        vulnerabilities: [{ id: 'v1', cveId: 'CVE-2021-12345', components: [] }],
      };
      mockPrisma.sbom.findFirst.mockResolvedValue(mockSbom);

      const result = await service.getSbom('tenant-1', '1');

      expect(result.components).toHaveLength(1);
      expect(result.vulnerabilities).toHaveLength(1);
    });

    it('should throw NotFoundException when SBOM not found', async () => {
      mockPrisma.sbom.findFirst.mockResolvedValue(null);

      await expect(service.getSbom('tenant-1', '999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteSbom', () => {
    it('should delete SBOM and related data', async () => {
      mockPrisma.sbom.findFirst.mockResolvedValue({ id: '1' });
      mockPrisma.sbomComponentVuln.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.sbomComponent.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.sbomVulnerability.findMany.mockResolvedValue([]);
      mockPrisma.sbom.delete.mockResolvedValue({ id: '1' });

      const result = await service.deleteSbom('tenant-1', '1');

      expect(result.success).toBe(true);
      expect(mockPrisma.sbom.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException when SBOM not found', async () => {
      mockPrisma.sbom.findFirst.mockResolvedValue(null);

      await expect(service.deleteSbom('tenant-1', '999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSbomStats', () => {
    it('should return SBOM statistics', async () => {
      const mockSbom = {
        id: '1',
        componentCount: 100,
        vulnCount: 5,
      };
      mockPrisma.sbom.findFirst.mockResolvedValue(mockSbom);
      mockPrisma.sbomVulnerability.findMany.mockResolvedValue([
        { severity: 'CRITICAL' },
        { severity: 'HIGH' },
        { severity: 'HIGH' },
        { severity: 'MEDIUM' },
        { severity: 'LOW' },
      ]);
      mockPrisma.sbomComponent.findMany.mockResolvedValue([
        { license: 'MIT' },
        { license: 'MIT' },
        { license: 'Apache-2.0' },
      ]);

      const stats = await service.getSbomStats('tenant-1', '1');

      expect(stats.componentCount).toBe(100);
      expect(stats.vulnCount).toBe(5);
    });

    it('should throw NotFoundException when SBOM not found', async () => {
      mockPrisma.sbom.findFirst.mockResolvedValue(null);

      await expect(service.getSbomStats('tenant-1', '999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDependencyTree', () => {
    it('should return dependency tree', async () => {
      mockPrisma.sbom.findFirst.mockResolvedValue({ id: '1' });
      mockPrisma.sbomComponent.findMany.mockResolvedValue([
        { id: 'c1', name: 'app', version: '1.0.0', isDirect: true, parentId: null },
        { id: 'c2', name: 'lodash', version: '4.17.21', isDirect: false, parentId: 'c1' },
      ]);

      const tree = await service.getDependencyTree('tenant-1', '1');

      expect(tree).toBeDefined();
      expect(Array.isArray(tree)).toBe(true);
    });

    it('should throw NotFoundException when SBOM not found', async () => {
      mockPrisma.sbom.findFirst.mockResolvedValue(null);

      await expect(service.getDependencyTree('tenant-1', '999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateVulnerabilityStatus', () => {
    it('should update vulnerability status', async () => {
      mockPrisma.sbomVulnerability.findFirst.mockResolvedValue({
        id: 'v1',
        sbomId: '1',
        sbom: { tenantId: 'tenant-1' },
      });
      mockPrisma.sbomVulnerability.update.mockResolvedValue({
        id: 'v1',
        status: 'patched',
      });

      const result = await service.updateVulnerabilityStatus(
        'tenant-1',
        'v1',
        'patched',
        'user-1',
      );

      expect(result.status).toBe('patched');
    });

    it('should throw NotFoundException when vulnerability not found', async () => {
      mockPrisma.sbomVulnerability.findFirst.mockResolvedValue(null);

      await expect(
        service.updateVulnerabilityStatus('tenant-1', '999', 'patched', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addComponent', () => {
    it('should add a component to SBOM', async () => {
      const componentDto = {
        name: 'new-package',
        version: '1.0.0',
        type: 'npm',
        isDirect: true,
      };
      mockPrisma.sbom.findFirst.mockResolvedValue({ id: '1', componentCount: 10 });
      mockPrisma.sbomComponent.create.mockResolvedValue({
        id: 'c1',
        ...componentDto,
      });
      mockPrisma.sbom.update.mockResolvedValue({ componentCount: 11 });

      const result = await service.addComponent('tenant-1', '1', componentDto);

      expect(result.name).toBe('new-package');
    });

    it('should throw NotFoundException when SBOM not found', async () => {
      mockPrisma.sbom.findFirst.mockResolvedValue(null);

      await expect(
        service.addComponent('tenant-1', '999', { name: 'pkg', type: 'npm' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
