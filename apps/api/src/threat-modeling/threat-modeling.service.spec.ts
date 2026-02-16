import { Test, TestingModule } from '@nestjs/testing';
import { ThreatModelingService } from './threat-modeling.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ThreatModelingService', () => {
  let service: ThreatModelingService;

  const mockPrisma = {
    threatModel: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    threatModelComponent: {
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    threatModelDataFlow: {
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    threat: {
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    threatMitigation: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    threatModelThreat: {
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreatModelingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ThreatModelingService>(ThreatModelingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listThreatModels', () => {
    it('should return threat models for tenant', async () => {
      const mockModels = [
        { id: '1', name: 'Model 1', methodology: 'STRIDE', _count: { components: 2, threats: 3 } },
        { id: '2', name: 'Model 2', methodology: 'PASTA', _count: { components: 1, threats: 1 } },
      ];
      mockPrisma.threatModel.findMany.mockResolvedValue(mockModels);
      mockPrisma.threatModel.count.mockResolvedValue(2);

      const result = await service.listThreatModels('tenant-1');

      expect(result.models).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status when provided', async () => {
      mockPrisma.threatModel.findMany.mockResolvedValue([]);
      mockPrisma.threatModel.count.mockResolvedValue(0);

      await service.listThreatModels('tenant-1', { status: 'COMPLETED' });

      expect(mockPrisma.threatModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });
  });

  describe('getThreatModel', () => {
    it('should return a threat model with all relations', async () => {
      const mockModel = {
        id: '1',
        name: 'Test Model',
        components: [{ id: 'c1', name: 'Component 1' }],
        dataFlows: [],
        threats: [],
      };
      mockPrisma.threatModel.findFirst.mockResolvedValue(mockModel);

      const result = await service.getThreatModel('tenant-1', '1');

      expect(result.name).toBe('Test Model');
      expect(result.components).toHaveLength(1);
    });

    it('should throw NotFoundException when model not found', async () => {
      mockPrisma.threatModel.findFirst.mockResolvedValue(null);

      await expect(service.getThreatModel('tenant-1', '999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createThreatModel', () => {
    it('should create a new threat model', async () => {
      const createDto = {
        name: 'New Model',
        description: 'Test description',
        methodology: 'STRIDE',
        projectId: 'project-1',
      };
      const mockModel = { id: '1', ...createDto, tenantId: 'tenant-1' };
      mockPrisma.threatModel.create.mockResolvedValue(mockModel);

      const result = await service.createThreatModel('tenant-1', 'user-1', createDto);

      expect(result.name).toBe('New Model');
      expect(mockPrisma.threatModel.create).toHaveBeenCalled();
    });
  });

  describe('updateThreatModel', () => {
    it('should update a threat model', async () => {
      const updateDto = { name: 'Updated Name', status: 'IN_PROGRESS' };
      mockPrisma.threatModel.findFirst.mockResolvedValue({ id: '1' });
      mockPrisma.threatModel.update.mockResolvedValue({ id: '1', ...updateDto });

      const result = await service.updateThreatModel('tenant-1', '1', 'user-1', updateDto);

      expect(result.name).toBe('Updated Name');
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should throw NotFoundException when model not found', async () => {
      mockPrisma.threatModel.findFirst.mockResolvedValue(null);

      await expect(
        service.updateThreatModel('tenant-1', '999', 'user-1', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteThreatModel', () => {
    it('should delete a threat model', async () => {
      mockPrisma.threatModel.findFirst.mockResolvedValue({ id: '1' });
      mockPrisma.threatModelThreat.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.threatMitigation.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.threat.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.threatModelDataFlow.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.threatModelComponent.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.threatModel.delete.mockResolvedValue({ id: '1' });

      const result = await service.deleteThreatModel('tenant-1', '1');

      expect(result.deleted).toBe(true);
      expect(mockPrisma.threatModel.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException when model not found', async () => {
      mockPrisma.threatModel.findFirst.mockResolvedValue(null);

      await expect(service.deleteThreatModel('tenant-1', '999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('duplicateThreatModel', () => {
    it('should duplicate a threat model', async () => {
      const originalModel = {
        id: '1',
        name: 'Original',
        description: 'Test',
        methodology: 'STRIDE',
        components: [{ id: 'c1', name: 'Component 1', type: 'PROCESS' }],
        dataFlows: [],
        threats: [],
      };
      mockPrisma.threatModel.findFirst.mockResolvedValue(originalModel);
      mockPrisma.threatModel.create.mockResolvedValue({
        id: '2',
        name: 'Original (Copy)',
        description: 'Test',
        methodology: 'STRIDE',
      });
      mockPrisma.threatModelComponent.createMany.mockResolvedValue({ count: 1 });

      const result = await service.duplicateThreatModel('tenant-1', '1', 'user-1');

      expect(result.name).toContain('Copy');
      expect(mockPrisma.threatModel.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when model not found', async () => {
      mockPrisma.threatModel.findFirst.mockResolvedValue(null);

      await expect(
        service.duplicateThreatModel('tenant-1', '999', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addComponent', () => {
    it('should add a component to threat model', async () => {
      const componentDto = {
        name: 'Web Server',
        type: 'PROCESS',
        technology: 'Node.js',
      };
      mockPrisma.threatModel.findFirst.mockResolvedValue({ id: '1' });
      mockPrisma.threatModelComponent.create.mockResolvedValue({
        id: 'c1',
        ...componentDto,
      });

      const result = await service.addComponent('tenant-1', '1', componentDto);

      expect(result.name).toBe('Web Server');
      expect(result.type).toBe('PROCESS');
    });

    it('should throw NotFoundException when model not found', async () => {
      mockPrisma.threatModel.findFirst.mockResolvedValue(null);

      await expect(
        service.addComponent('tenant-1', '999', { name: 'Test', type: 'PROCESS' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addThreat', () => {
    it('should add a threat with calculated risk score', async () => {
      const threatDto = {
        title: 'SQL Injection',
        description: 'SQL injection vulnerability',
        category: 'INJECTION',
        strideCategory: 'TAMPERING',
        likelihood: 'HIGH',
        impact: 'CRITICAL',
      };
      mockPrisma.threatModel.findFirst.mockResolvedValue({ id: '1' });
      mockPrisma.threat.create.mockResolvedValue({
        id: 't1',
        ...threatDto,
        riskScore: 9,
      });

      const result = await service.addThreat('tenant-1', '1', 'user-1', threatDto);

      expect(result!.title).toBe('SQL Injection');
      expect(result!.riskScore).toBe(9);
    });

    it('should throw NotFoundException when model not found', async () => {
      mockPrisma.threatModel.findFirst.mockResolvedValue(null);

      await expect(
        service.addThreat('tenant-1', '999', 'user-1', {
          title: 'Test',
          description: 'Test threat',
          category: 'INJECTION',
          strideCategory: 'SPOOFING',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateMermaidDiagram', () => {
    it('should generate mermaid diagram', async () => {
      const mockModel = {
        id: '1',
        name: 'Test Model',
        components: [
          { id: 'c1', name: 'Web App', type: 'PROCESS' },
          { id: 'c2', name: 'Database', type: 'DATASTORE' },
        ],
        dataFlows: [
          { id: 'f1', sourceId: 'c1', targetId: 'c2', name: 'Query', protocol: 'SQL' },
        ],
      };
      mockPrisma.threatModel.findFirst.mockResolvedValue(mockModel);

      const diagram = await service.generateMermaidDiagram('tenant-1', '1');

      expect(diagram).toContain('flowchart');
    });

    it('should throw NotFoundException when model not found', async () => {
      mockPrisma.threatModel.findFirst.mockResolvedValue(null);

      await expect(
        service.generateMermaidDiagram('tenant-1', '999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getThreatModelStats', () => {
    it('should return threat model statistics', async () => {
      const mockModel = {
        id: '1',
        _count: {
          components: 2,
          dataFlows: 1,
          threats: 2,
        },
        threats: [
          { id: 't1', status: 'IDENTIFIED', riskScore: 8, mitigations: [] },
          { id: 't2', status: 'MITIGATED', riskScore: 5, mitigations: [{ id: 'm1' }] },
        ],
      };
      mockPrisma.threatModel.findFirst.mockResolvedValue(mockModel);

      const stats = await service.getThreatModelStats('tenant-1', '1');

      expect(stats.componentCount).toBe(2);
      expect(stats.dataFlowCount).toBe(1);
      expect(stats.threatCount).toBe(2);
    });

    it('should throw NotFoundException when model not found', async () => {
      mockPrisma.threatModel.findFirst.mockResolvedValue(null);

      await expect(
        service.getThreatModelStats('tenant-1', '999'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
