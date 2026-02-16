import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProjectsService', () => {
  let service: ProjectsService;

  const mockPrisma = {
    project: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    repository: {
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all projects for tenant', async () => {
      const mockProjects = [
        { id: '1', name: 'Project 1', tenantId: 'tenant-1', status: 'ACTIVE' },
        { id: '2', name: 'Project 2', tenantId: 'tenant-1', status: 'ACTIVE' },
      ];
      mockPrisma.project.findMany.mockResolvedValue(mockProjects);

      const result = await service.findAll('tenant-1');

      expect(result).toEqual(mockProjects);
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', status: { not: 'DELETED' } },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no projects exist', async () => {
      mockPrisma.project.findMany.mockResolvedValue([]);

      const result = await service.findAll('tenant-1');

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a project by id', async () => {
      const mockProject = { id: '1', name: 'Project 1', tenantId: 'tenant-1' };
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);

      const result = await service.findOne('tenant-1', '1');

      expect(result).toEqual(mockProject);
      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: '1', tenantId: 'tenant-1', status: { not: 'DELETED' } },
        include: expect.any(Object),
      });
    });

    it('should return null when project not found', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      const result = await service.findOne('tenant-1', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new project', async () => {
      const createDto = { name: 'New Project', description: 'Test' };
      const mockProject = { id: '1', ...createDto, tenantId: 'tenant-1', status: 'ACTIVE' };
      mockPrisma.project.create.mockResolvedValue(mockProject);

      const result = await service.create('tenant-1', createDto);

      expect(result).toEqual(mockProject);
      expect(mockPrisma.project.create).toHaveBeenCalledWith({
        data: { ...createDto, tenantId: 'tenant-1', status: 'ACTIVE' },
      });
    });

    it('should create project without description', async () => {
      const createDto = { name: 'Minimal Project' };
      const mockProject = { id: '1', ...createDto, tenantId: 'tenant-1', status: 'ACTIVE' };
      mockPrisma.project.create.mockResolvedValue(mockProject);

      const result = await service.create('tenant-1', createDto);

      expect(result.name).toBe('Minimal Project');
    });
  });

  describe('update', () => {
    it('should update an existing project', async () => {
      const updateDto = { name: 'Updated Name' };
      mockPrisma.project.findFirst.mockResolvedValue({ id: '1', tenantId: 'tenant-1' });
      mockPrisma.project.update.mockResolvedValue({ id: '1', ...updateDto });

      const result = await service.update('tenant-1', '1', updateDto);

      expect(result.name).toBe('Updated Name');
    });

    it('should throw when project not found', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(service.update('tenant-1', '1', { name: 'Test' }))
        .rejects.toThrow();
    });
  });

  describe('archive', () => {
    it('should archive a project', async () => {
      const mockProject = { id: '1', name: 'Project', status: 'ARCHIVED' };
      mockPrisma.project.findFirst.mockResolvedValue({ id: '1', tenantId: 'tenant-1' });
      mockPrisma.project.update.mockResolvedValue(mockProject);

      const result = await service.archive('tenant-1', '1');

      expect(result.status).toBe('ARCHIVED');
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { status: 'ARCHIVED' },
      });
    });
  });

  describe('delete', () => {
    it('should soft delete a project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id: '1', tenantId: 'tenant-1' });
      mockPrisma.project.update.mockResolvedValue({ id: '1', status: 'DELETED' });

      const result = await service.delete('tenant-1', '1');

      expect(result.status).toBe('DELETED');
    });
  });

  describe('linkRepository', () => {
    it('should link repository to project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      mockPrisma.repository.update.mockResolvedValue({ id: 'repo-1', projectId: 'proj-1' });

      await service.linkRepository('tenant-1', 'proj-1', 'repo-1');

      expect(mockPrisma.repository.update).toHaveBeenCalledWith({
        where: { id: 'repo-1' },
        data: { projectId: 'proj-1' },
      });
    });

    it('should throw when project not found', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(service.linkRepository('tenant-1', 'proj-1', 'repo-1'))
        .rejects.toThrow();
    });
  });

  describe('unlinkRepository', () => {
    it('should unlink repository from project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      mockPrisma.repository.update.mockResolvedValue({ id: 'repo-1', projectId: null });

      await service.unlinkRepository('tenant-1', 'proj-1', 'repo-1');

      expect(mockPrisma.repository.update).toHaveBeenCalledWith({
        where: { id: 'repo-1' },
        data: { projectId: null },
      });
    });
  });

  describe('getStats', () => {
    it('should return project statistics', async () => {
      const mockProject = {
        id: '1',
        _count: {
          repositories: 5,
          scans: 10,
          findings: 25,
          threatModels: 2,
        },
      };
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);

      const result = await service.getStats('tenant-1', '1');

      expect(result).toHaveProperty('repositories', 5);
      expect(result).toHaveProperty('scans', 10);
      expect(result).toHaveProperty('findings', 25);
    });
  });
});
