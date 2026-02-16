import { Test, TestingModule } from '@nestjs/testing';
import { PlaybooksService } from './playbooks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('PlaybooksService', () => {
  let service: PlaybooksService;
  let prisma: {
    remediationPlaybook: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    playbookStep: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    playbookIacSnippet: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    canonicalRisk: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const mockCanonicalRisk = {
    id: 'risk-1',
    canonicalId: 'unencrypted-transit',
    title: 'Unencrypted Data Transmission',
    cweId: 'CWE-319',
    cweName: 'Cleartext Transmission of Sensitive Information',
  };

  const mockPlaybook = {
    id: 'playbook-1',
    canonicalRiskId: 'risk-1',
    title: 'Enable TLS/HTTPS',
    description: 'Implement transport layer encryption',
    totalEffort: 'low',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    canonicalRisk: mockCanonicalRisk,
    _count: { steps: 3, iacSnippets: 2 },
  };

  const mockStep = {
    id: 'step-1',
    playbookId: 'playbook-1',
    stepNumber: 1,
    title: 'Obtain TLS certificate',
    description: 'Provision a TLS certificate using ACM or Let\'s Encrypt',
    effort: 'low',
    role: 'devops',
    estimatedMinutes: 15,
    automatable: true,
    createdAt: new Date(),
  };

  const mockSnippet = {
    id: 'snippet-1',
    playbookId: 'playbook-1',
    platform: 'terraform',
    code: 'resource "aws_lb_listener" "https" { ... }',
    description: 'HTTPS listener configuration',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      remediationPlaybook: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      playbookStep: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      playbookIacSnippet: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      canonicalRisk: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaybooksService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PlaybooksService>(PlaybooksService);
  });

  describe('listPlaybooks', () => {
    it('should return playbooks with total count', async () => {
      prisma.remediationPlaybook.findMany.mockResolvedValue([mockPlaybook]);

      const result = await service.listPlaybooks({});

      expect(result.playbooks).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by search term', async () => {
      prisma.remediationPlaybook.findMany.mockResolvedValue([mockPlaybook]);

      await service.listPlaybooks({ search: 'TLS' });

      expect(prisma.remediationPlaybook.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { title: { contains: 'TLS', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should filter by effort', async () => {
      prisma.remediationPlaybook.findMany.mockResolvedValue([mockPlaybook]);

      await service.listPlaybooks({ effort: 'low' });

      expect(prisma.remediationPlaybook.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ totalEffort: 'low' }),
        }),
      );
    });

    it('should filter by hasIac=true', async () => {
      prisma.remediationPlaybook.findMany.mockResolvedValue([
        mockPlaybook,
        { ...mockPlaybook, id: 'playbook-2', _count: { steps: 2, iacSnippets: 0 } },
      ]);

      const result = await service.listPlaybooks({ hasIac: 'true' });

      expect(result.playbooks).toHaveLength(1);
      expect(result.playbooks[0].id).toBe('playbook-1');
    });

    it('should filter by hasIac=false', async () => {
      const playbookNoIac = { ...mockPlaybook, id: 'playbook-2', _count: { steps: 2, iacSnippets: 0 } };
      prisma.remediationPlaybook.findMany.mockResolvedValue([mockPlaybook, playbookNoIac]);

      const result = await service.listPlaybooks({ hasIac: 'false' });

      expect(result.playbooks).toHaveLength(1);
      expect(result.playbooks[0].id).toBe('playbook-2');
    });

    it('should filter by status', async () => {
      prisma.remediationPlaybook.findMany.mockResolvedValue([mockPlaybook]);

      await service.listPlaybooks({ status: 'pending' });

      expect(prisma.remediationPlaybook.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });
  });

  describe('getPlaybookById', () => {
    it('should return playbook with steps and snippets', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue({
        ...mockPlaybook,
        steps: [mockStep],
        iacSnippets: [mockSnippet],
      });

      const result = await service.getPlaybookById('playbook-1');

      expect(result.id).toBe('playbook-1');
      expect(result.steps).toHaveLength(1);
      expect(result.iacSnippets).toHaveLength(1);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(null);

      await expect(service.getPlaybookById('not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPlaybook', () => {
    const createDto = {
      canonicalRiskId: 'risk-1',
      title: 'New Playbook',
      description: 'Description',
      totalEffort: 'medium' as const,
    };

    it('should create a new playbook', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(mockCanonicalRisk);
      prisma.remediationPlaybook.create.mockResolvedValue({ ...mockPlaybook, ...createDto });

      const result = await service.createPlaybook(createDto);

      expect(result.title).toBe(createDto.title);
    });

    it('should throw NotFoundException when canonical risk not found', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(null);

      await expect(service.createPlaybook(createDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePlaybook', () => {
    const updateDto = { title: 'Updated Title' };

    it('should update existing playbook', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(mockPlaybook);
      prisma.remediationPlaybook.update.mockResolvedValue({ ...mockPlaybook, ...updateDto });

      const result = await service.updatePlaybook('playbook-1', updateDto);

      expect(result.title).toBe('Updated Title');
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(null);

      await expect(service.updatePlaybook('not-found', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should reset status to pending on update', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue({ ...mockPlaybook, status: 'live' });
      prisma.remediationPlaybook.update.mockResolvedValue({ ...mockPlaybook, status: 'pending' });

      await service.updatePlaybook('playbook-1', updateDto);

      expect(prisma.remediationPlaybook.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });
  });

  describe('deletePlaybook', () => {
    it('should delete existing playbook', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(mockPlaybook);
      prisma.remediationPlaybook.delete.mockResolvedValue(mockPlaybook);

      const result = await service.deletePlaybook('playbook-1');

      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(null);

      await expect(service.deletePlaybook('not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitForReview', () => {
    it('should change status from pending to review', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(mockPlaybook);
      prisma.remediationPlaybook.update.mockResolvedValue({ ...mockPlaybook, status: 'review' });

      const result = await service.submitForReview('playbook-1');

      expect(result.status).toBe('review');
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(null);

      await expect(service.submitForReview('not-found')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when not in pending status', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue({ ...mockPlaybook, status: 'live' });

      await expect(service.submitForReview('playbook-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('approve', () => {
    it('should change status from review to live for SuperAdmin', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue({ ...mockPlaybook, status: 'review' });
      prisma.remediationPlaybook.update.mockResolvedValue({ ...mockPlaybook, status: 'live' });

      const result = await service.approve('playbook-1', true);

      expect(result.status).toBe('live');
    });

    it('should throw ForbiddenException for non-SuperAdmin', async () => {
      await expect(service.approve('playbook-1', false)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(null);

      await expect(service.approve('not-found', true)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when not in review status', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(mockPlaybook);

      await expect(service.approve('playbook-1', true)).rejects.toThrow(ConflictException);
    });
  });

  describe('createStep', () => {
    const createDto = {
      title: 'New Step',
      description: 'Step description',
      effort: 'low' as const,
      role: 'devops' as const,
    };

    it('should create a new step', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue({ ...mockPlaybook, _count: { steps: 2 } });
      prisma.playbookStep.create.mockResolvedValue({ ...mockStep, ...createDto, stepNumber: 3 });
      prisma.remediationPlaybook.update.mockResolvedValue(mockPlaybook);

      const result = await service.createStep('playbook-1', createDto);

      expect(result.stepNumber).toBe(3);
    });

    it('should throw NotFoundException when playbook not found', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(null);

      await expect(service.createStep('not-found', createDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStep', () => {
    const updateDto = { title: 'Updated Step' };

    it('should update existing step', async () => {
      prisma.playbookStep.findFirst.mockResolvedValue(mockStep);
      prisma.playbookStep.update.mockResolvedValue({ ...mockStep, ...updateDto });
      prisma.remediationPlaybook.update.mockResolvedValue(mockPlaybook);

      const result = await service.updateStep('playbook-1', 'step-1', updateDto);

      expect(result.title).toBe('Updated Step');
    });

    it('should throw NotFoundException when step not found', async () => {
      prisma.playbookStep.findFirst.mockResolvedValue(null);

      await expect(service.updateStep('playbook-1', 'not-found', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteStep', () => {
    it('should delete existing step', async () => {
      prisma.playbookStep.findFirst.mockResolvedValue(mockStep);
      prisma.playbookStep.delete.mockResolvedValue(mockStep);
      prisma.playbookStep.findMany.mockResolvedValue([]);
      prisma.remediationPlaybook.update.mockResolvedValue(mockPlaybook);

      const result = await service.deleteStep('playbook-1', 'step-1');

      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException when step not found', async () => {
      prisma.playbookStep.findFirst.mockResolvedValue(null);

      await expect(service.deleteStep('playbook-1', 'not-found')).rejects.toThrow(NotFoundException);
    });

    it('should renumber remaining steps after deletion', async () => {
      prisma.playbookStep.findFirst.mockResolvedValue(mockStep);
      prisma.playbookStep.delete.mockResolvedValue(mockStep);
      prisma.playbookStep.findMany.mockResolvedValue([
        { id: 'step-2', stepNumber: 3 },
        { id: 'step-3', stepNumber: 4 },
      ]);
      prisma.playbookStep.update.mockResolvedValue({});
      prisma.remediationPlaybook.update.mockResolvedValue(mockPlaybook);

      await service.deleteStep('playbook-1', 'step-1');

      // Should update step numbers to 1 and 2
      expect(prisma.playbookStep.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('reorderSteps', () => {
    it('should reorder steps', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(mockPlaybook);
      prisma.playbookStep.findMany.mockResolvedValue([
        { id: 'step-1', stepNumber: 1 },
        { id: 'step-2', stepNumber: 2 },
        { id: 'step-3', stepNumber: 3 },
      ]);
      prisma.$transaction.mockResolvedValue([]);
      prisma.remediationPlaybook.update.mockResolvedValue(mockPlaybook);

      await service.reorderSteps('playbook-1', {
        stepIds: ['step-3', 'step-1', 'step-2'],
      });

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when playbook not found', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(null);

      await expect(
        service.reorderSteps('not-found', { stepIds: ['step-1'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when step not in playbook', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(mockPlaybook);
      prisma.playbookStep.findMany.mockResolvedValue([{ id: 'step-1' }]);

      await expect(
        service.reorderSteps('playbook-1', { stepIds: ['step-1', 'invalid-step'] }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createIacSnippet', () => {
    const createDto = {
      platform: 'terraform' as const,
      code: 'resource "aws_lb" {}',
      description: 'Load balancer config',
    };

    it('should create a new IaC snippet', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(mockPlaybook);
      prisma.playbookIacSnippet.findFirst.mockResolvedValue(null);
      prisma.playbookIacSnippet.create.mockResolvedValue({ ...mockSnippet, ...createDto });
      prisma.remediationPlaybook.update.mockResolvedValue(mockPlaybook);

      const result = await service.createIacSnippet('playbook-1', createDto);

      expect(result.platform).toBe('terraform');
    });

    it('should throw NotFoundException when playbook not found', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(null);

      await expect(service.createIacSnippet('not-found', createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate platform', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(mockPlaybook);
      prisma.playbookIacSnippet.findFirst.mockResolvedValue(mockSnippet);

      await expect(service.createIacSnippet('playbook-1', createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('updateIacSnippet', () => {
    const updateDto = { code: 'updated code' };

    it('should update existing IaC snippet', async () => {
      prisma.playbookIacSnippet.findFirst.mockResolvedValue(mockSnippet);
      prisma.playbookIacSnippet.update.mockResolvedValue({ ...mockSnippet, ...updateDto });
      prisma.remediationPlaybook.update.mockResolvedValue(mockPlaybook);

      const result = await service.updateIacSnippet('playbook-1', 'snippet-1', updateDto);

      expect(result.code).toBe('updated code');
    });

    it('should throw NotFoundException when snippet not found', async () => {
      prisma.playbookIacSnippet.findFirst.mockResolvedValue(null);

      await expect(
        service.updateIacSnippet('playbook-1', 'not-found', updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteIacSnippet', () => {
    it('should delete existing IaC snippet', async () => {
      prisma.playbookIacSnippet.findFirst.mockResolvedValue(mockSnippet);
      prisma.playbookIacSnippet.delete.mockResolvedValue(mockSnippet);
      prisma.remediationPlaybook.update.mockResolvedValue(mockPlaybook);

      const result = await service.deleteIacSnippet('playbook-1', 'snippet-1');

      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException when snippet not found', async () => {
      prisma.playbookIacSnippet.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteIacSnippet('playbook-1', 'not-found'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('bulkImport', () => {
    it('should import new playbooks', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(mockCanonicalRisk);
      prisma.remediationPlaybook.create.mockResolvedValue(mockPlaybook);

      const result = await service.bulkImport({
        playbooks: [
          {
            canonicalRiskId: 'risk-1',
            title: 'New Playbook',
            steps: [
              { stepNumber: 1, title: 'Step 1', description: 'Desc' },
            ],
            iacSnippets: [
              { platform: 'terraform', code: 'resource {}' },
            ],
          },
        ],
      });

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('should skip when canonical risk not found', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(null);

      const result = await service.bulkImport({
        playbooks: [
          {
            canonicalRiskId: 'invalid-risk',
            title: 'New Playbook',
          },
        ],
      });

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle create errors gracefully', async () => {
      prisma.canonicalRisk.findUnique.mockResolvedValue(mockCanonicalRisk);
      prisma.remediationPlaybook.create.mockRejectedValue(new Error('DB error'));

      const result = await service.bulkImport({
        playbooks: [
          {
            canonicalRiskId: 'risk-1',
            title: 'New Playbook',
          },
        ],
      });

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('getPlaybookStats', () => {
    it('should return playbook statistics', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue({
        ...mockPlaybook,
        steps: [
          { ...mockStep, estimatedMinutes: 15, automatable: true, role: 'devops' },
          { ...mockStep, id: 'step-2', estimatedMinutes: 30, automatable: false, role: 'developer' },
        ],
        iacSnippets: [mockSnippet],
      });

      const result = await service.getPlaybookStats('playbook-1');

      expect(result.totalSteps).toBe(2);
      expect(result.automatableSteps).toBe(1);
      expect(result.totalMinutes).toBe(45);
      expect(result.roles).toContain('devops');
      expect(result.roles).toContain('developer');
      expect(result.platforms).toContain('terraform');
    });

    it('should throw NotFoundException when playbook not found', async () => {
      prisma.remediationPlaybook.findUnique.mockResolvedValue(null);

      await expect(service.getPlaybookStats('not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEffortOptions', () => {
    it('should return effort levels', async () => {
      const result = await service.getEffortOptions();

      expect(result).toEqual(['low', 'medium', 'high']);
    });
  });

  describe('getRoleOptions', () => {
    it('should return role options', async () => {
      const result = await service.getRoleOptions();

      expect(result).toEqual(['developer', 'devops', 'security', 'architect']);
    });
  });

  describe('getPlatformOptions', () => {
    it('should return platform options', async () => {
      const result = await service.getPlatformOptions();

      expect(result).toEqual(['terraform', 'cloudformation', 'kubernetes', 'pulumi']);
    });
  });
});
