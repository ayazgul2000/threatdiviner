import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentsService } from './environments.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('EnvironmentsService', () => {
  let service: EnvironmentsService;

  const mockPrisma = {
    environment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    deployment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvironmentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EnvironmentsService>(EnvironmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listEnvironments', () => {
    it('should return all environments for tenant', async () => {
      const mockEnvironments = [
        {
          id: '1',
          name: 'Production',
          type: 'KUBERNETES',
          _count: { deployments: 2 },
          deployments: [
            { id: 'd1', name: 'api', status: 'healthy', vulnCount: 0, criticalCount: 0 },
            { id: 'd2', name: 'web', status: 'healthy', vulnCount: 1, criticalCount: 0 },
          ],
        },
      ];
      mockPrisma.environment.findMany.mockResolvedValue(mockEnvironments);

      const result = await service.listEnvironments('tenant-1');

      expect(result).toHaveLength(1);
      expect(result[0].deploymentCount).toBe(2);
      expect(result[0].healthySummary.healthy).toBe(2);
    });
  });

  describe('getEnvironment', () => {
    it('should return environment with deployments', async () => {
      const mockEnvironment = {
        id: '1',
        name: 'Production',
        deployments: [{ id: 'd1', name: 'api', status: 'healthy' }],
      };
      mockPrisma.environment.findFirst.mockResolvedValue(mockEnvironment);

      const result = await service.getEnvironment('tenant-1', '1');

      expect(result.deployments).toHaveLength(1);
    });

    it('should throw NotFoundException when environment not found', async () => {
      mockPrisma.environment.findFirst.mockResolvedValue(null);

      await expect(service.getEnvironment('tenant-1', '999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createEnvironment', () => {
    it('should create a new environment', async () => {
      const createDto = {
        name: 'New Env',
        type: 'KUBERNETES',
        namespace: 'default',
        projectId: 'project-1',
      };
      mockPrisma.environment.findFirst.mockResolvedValue(null);
      mockPrisma.environment.create.mockResolvedValue({ id: '1', ...createDto });

      const result = await service.createEnvironment('tenant-1', createDto);

      expect(result.name).toBe('New Env');
      expect(result.type).toBe('KUBERNETES');
    });

    it('should throw ConflictException for duplicate name', async () => {
      mockPrisma.environment.findFirst.mockResolvedValue({ id: '1', name: 'Existing' });

      await expect(
        service.createEnvironment('tenant-1', { name: 'Existing', type: 'KUBERNETES', projectId: 'project-1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateEnvironment', () => {
    it('should update an environment', async () => {
      mockPrisma.environment.findFirst.mockResolvedValue({ id: '1', name: 'Old Name' });
      mockPrisma.environment.update.mockResolvedValue({
        id: '1',
        name: 'Updated Name',
      });

      const result = await service.updateEnvironment('tenant-1', '1', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException when environment not found', async () => {
      mockPrisma.environment.findFirst.mockResolvedValue(null);

      await expect(
        service.updateEnvironment('tenant-1', '999', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteEnvironment', () => {
    it('should delete environment', async () => {
      mockPrisma.environment.findFirst.mockResolvedValue({ id: '1' });
      mockPrisma.environment.delete.mockResolvedValue({ id: '1' });

      const result = await service.deleteEnvironment('tenant-1', '1');

      expect(result.success).toBe(true);
      expect(mockPrisma.environment.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException when environment not found', async () => {
      mockPrisma.environment.findFirst.mockResolvedValue(null);

      await expect(service.deleteEnvironment('tenant-1', '999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getEnvironmentsSummary', () => {
    it('should return environment summary statistics', async () => {
      mockPrisma.environment.findMany.mockResolvedValue([
        {
          id: '1',
          name: 'Production',
          type: 'KUBERNETES',
          deployments: [
            { status: 'healthy', vulnCount: 0, criticalCount: 0 },
            { status: 'healthy', vulnCount: 2, criticalCount: 1 },
          ],
        },
        {
          id: '2',
          name: 'Staging',
          type: 'ECS',
          deployments: [{ status: 'degraded', vulnCount: 5, criticalCount: 0 }],
        },
      ]);

      const summary = await service.getEnvironmentsSummary('tenant-1');

      expect(summary.totalEnvironments).toBe(2);
      expect(summary.totalDeployments).toBe(3);
      expect(summary.healthyDeployments).toBe(2);
      expect(summary.degradedDeployments).toBe(1);
      expect(summary.totalVulnerabilities).toBe(7);
      expect(summary.criticalVulnerabilities).toBe(1);
    });
  });

  describe('createDeployment', () => {
    it('should create a deployment in environment', async () => {
      const deploymentDto = {
        name: 'api-service',
        version: '1.0.0',
        image: 'api:1.0.0',
      };
      mockPrisma.environment.findFirst.mockResolvedValue({ id: '1' });
      mockPrisma.deployment.findFirst.mockResolvedValue(null);
      mockPrisma.deployment.create.mockResolvedValue({
        id: 'd1',
        ...deploymentDto,
        status: 'unknown',
      });

      const result = await service.createDeployment('tenant-1', '1', deploymentDto);

      expect(result.name).toBe('api-service');
      expect(result.status).toBe('unknown');
    });

    it('should throw NotFoundException when environment not found', async () => {
      mockPrisma.environment.findFirst.mockResolvedValue(null);

      await expect(
        service.createDeployment('tenant-1', '999', { name: 'api' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate name in environment', async () => {
      mockPrisma.environment.findFirst.mockResolvedValue({ id: '1' });
      mockPrisma.deployment.findFirst.mockResolvedValue({ id: 'd1', name: 'api' });

      await expect(
        service.createDeployment('tenant-1', '1', { name: 'api' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateDeployment', () => {
    it('should update deployment', async () => {
      mockPrisma.deployment.findFirst.mockResolvedValue({ id: 'd1', version: '1.0.0' });
      mockPrisma.deployment.update.mockResolvedValue({
        id: 'd1',
        status: 'healthy',
      });

      const result = await service.updateDeployment('tenant-1', 'd1', {
        status: 'healthy',
      });

      expect(result.status).toBe('healthy');
    });

    it('should throw NotFoundException when deployment not found', async () => {
      mockPrisma.deployment.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDeployment('tenant-1', '999', { status: 'healthy' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteDeployment', () => {
    it('should delete a deployment', async () => {
      mockPrisma.deployment.findFirst.mockResolvedValue({ id: 'd1' });
      mockPrisma.deployment.delete.mockResolvedValue({ id: 'd1' });

      const result = await service.deleteDeployment('tenant-1', 'd1');

      expect(result.success).toBe(true);
      expect(mockPrisma.deployment.delete).toHaveBeenCalledWith({
        where: { id: 'd1' },
      });
    });

    it('should throw NotFoundException when deployment not found', async () => {
      mockPrisma.deployment.findFirst.mockResolvedValue(null);

      await expect(service.deleteDeployment('tenant-1', '999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listDeployments', () => {
    it('should return all deployments for tenant', async () => {
      const mockDeployments = [
        { id: 'd1', name: 'api', environment: { id: '1', name: 'Prod', type: 'K8s' } },
        { id: 'd2', name: 'web', environment: { id: '1', name: 'Prod', type: 'K8s' } },
      ];
      mockPrisma.deployment.findMany.mockResolvedValue(mockDeployments);

      const result = await service.listDeployments('tenant-1');

      expect(result).toHaveLength(2);
    });

    it('should filter by environmentId', async () => {
      mockPrisma.deployment.findMany.mockResolvedValue([]);

      await service.listDeployments('tenant-1', { environmentId: 'env-1' });

      expect(mockPrisma.deployment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ environmentId: 'env-1' }),
        }),
      );
    });
  });

  describe('getDeployment', () => {
    it('should return a deployment', async () => {
      const mockDeployment = {
        id: 'd1',
        name: 'api',
        environment: { id: '1', name: 'Production' },
      };
      mockPrisma.deployment.findFirst.mockResolvedValue(mockDeployment);

      const result = await service.getDeployment('tenant-1', 'd1');

      expect(result.name).toBe('api');
      expect(result.environment.name).toBe('Production');
    });

    it('should throw NotFoundException when deployment not found', async () => {
      mockPrisma.deployment.findFirst.mockResolvedValue(null);

      await expect(service.getDeployment('tenant-1', '999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
