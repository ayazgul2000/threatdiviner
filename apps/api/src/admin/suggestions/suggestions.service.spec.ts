import { Test, TestingModule } from '@nestjs/testing';
import { SuggestionsService } from './suggestions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

describe('SuggestionsService', () => {
  let service: SuggestionsService;

  const mockSuggestion = {
    id: 'sugg-1',
    type: 'shape_mapping',
    source: 'feed_sync',
    sourceId: 'cwe-123',
    suggestedData: {
      drawioStyle: 'mxgraph.aws4.bedrock',
      threagileType: 'ai-service',
      machineType: 'serverless',
    },
    confidence: 0.95,
    reason: 'AWS Bedrock is a managed AI/ML service',
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPromotionItem = {
    id: 'promo-1',
    configType: 'shape_mapping',
    configId: 'mapping-1',
    status: 'review',
    submittedBy: 'user-1',
    submittedAt: new Date(),
    reviewedBy: null,
    reviewedAt: null,
    reviewFeedback: null,
    promotedBy: null,
    promotedAt: null,
    promotionNotes: null,
    rollbackBy: null,
    rollbackAt: null,
    rollbackReason: null,
    previousData: { status: 'pending' },
    description: 'New shape mapping',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    aiSuggestion: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    promotionItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    configAuditLog: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    shapeMapping: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    canonicalRisk: {
      create: jest.fn(),
      update: jest.fn(),
    },
    canonicalRiskSource: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    remediationPlaybook: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    wizardQuestion: {
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestionsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SuggestionsService>(SuggestionsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listSuggestions', () => {
    it('should return pending suggestions by default', async () => {
      mockPrismaService.aiSuggestion.findMany.mockResolvedValue([mockSuggestion]);
      mockPrismaService.aiSuggestion.count.mockResolvedValue(1);

      const result = await service.listSuggestions({});

      expect(result.suggestions).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrismaService.aiSuggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });

    it('should filter by type', async () => {
      mockPrismaService.aiSuggestion.findMany.mockResolvedValue([]);
      mockPrismaService.aiSuggestion.count.mockResolvedValue(0);

      await service.listSuggestions({ type: 'shape_mapping' });

      expect(mockPrismaService.aiSuggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'shape_mapping' }),
        }),
      );
    });

    it('should filter by confidence range', async () => {
      mockPrismaService.aiSuggestion.findMany.mockResolvedValue([]);
      mockPrismaService.aiSuggestion.count.mockResolvedValue(0);

      await service.listSuggestions({ minConfidence: 80, maxConfidence: 100 });

      expect(mockPrismaService.aiSuggestion.findMany).toHaveBeenCalled();
    });
  });

  describe('getSuggestionById', () => {
    it('should return suggestion by id', async () => {
      mockPrismaService.aiSuggestion.findUnique.mockResolvedValue(mockSuggestion);

      const result = await service.getSuggestionById('sugg-1');

      expect(result.id).toBe('sugg-1');
    });

    it('should throw NotFoundException for invalid id', async () => {
      mockPrismaService.aiSuggestion.findUnique.mockResolvedValue(null);

      await expect(service.getSuggestionById('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approveSuggestion', () => {
    it('should approve pending suggestion', async () => {
      mockPrismaService.aiSuggestion.findUnique.mockResolvedValue(mockSuggestion);
      mockPrismaService.shapeMapping.create.mockResolvedValue({});
      mockPrismaService.aiSuggestion.update.mockResolvedValue({
        ...mockSuggestion,
        status: 'approved',
      });
      mockPrismaService.configAuditLog.create.mockResolvedValue({});

      const result = await service.approveSuggestion('sugg-1', { notes: 'Approved' }, 'user-1');

      expect(result.status).toBe('approved');
    });

    it('should throw for already approved suggestion', async () => {
      mockPrismaService.aiSuggestion.findUnique.mockResolvedValue({
        ...mockSuggestion,
        status: 'approved',
      });

      await expect(
        service.approveSuggestion('sugg-1', {}, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectSuggestion', () => {
    it('should reject pending suggestion', async () => {
      mockPrismaService.aiSuggestion.findUnique.mockResolvedValue(mockSuggestion);
      mockPrismaService.aiSuggestion.update.mockResolvedValue({
        ...mockSuggestion,
        status: 'rejected',
      });
      mockPrismaService.configAuditLog.create.mockResolvedValue({});

      const result = await service.rejectSuggestion('sugg-1', { reason: 'Invalid' }, 'user-1');

      expect(result.status).toBe('rejected');
    });
  });

  describe('editSuggestion', () => {
    it('should edit suggestion data', async () => {
      mockPrismaService.aiSuggestion.findUnique.mockResolvedValue(mockSuggestion);
      mockPrismaService.aiSuggestion.update.mockResolvedValue({
        ...mockSuggestion,
        status: 'edited',
        suggestedData: { ...mockSuggestion.suggestedData, machineType: 'container' },
      });
      mockPrismaService.configAuditLog.create.mockResolvedValue({});

      const result = await service.editSuggestion(
        'sugg-1',
        { suggestedData: { machineType: 'container' }, editNotes: 'Changed machine type' },
        'user-1',
      );

      expect(result.status).toBe('edited');
    });
  });

  describe('bulkAction', () => {
    it('should process multiple approvals', async () => {
      mockPrismaService.aiSuggestion.findUnique.mockResolvedValue(mockSuggestion);
      mockPrismaService.shapeMapping.create.mockResolvedValue({});
      mockPrismaService.aiSuggestion.update.mockResolvedValue({
        ...mockSuggestion,
        status: 'approved',
      });
      mockPrismaService.configAuditLog.create.mockResolvedValue({});

      const result = await service.bulkAction(
        { ids: ['sugg-1', 'sugg-2'], action: 'approve' },
        'user-1',
      );

      expect(result.processed).toBe(2);
    });
  });

  describe('getSuggestionStats', () => {
    it('should return suggestion statistics', async () => {
      mockPrismaService.aiSuggestion.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3);
      mockPrismaService.aiSuggestion.groupBy.mockResolvedValue([
        { type: 'shape_mapping', _count: 5 },
        { type: 'canonical_risk', _count: 3 },
      ]);
      mockPrismaService.aiSuggestion.aggregate.mockResolvedValue({
        _avg: { confidence: 0.85 },
      });

      const result = await service.getSuggestionStats();

      expect(result.pending).toBe(10);
      expect(result.approved).toBe(5);
      expect(result.rejected).toBe(3);
      expect(result.byType).toEqual({ shape_mapping: 5, canonical_risk: 3 });
    });
  });

  describe('submitForReview', () => {
    it('should create promotion item', async () => {
      mockPrismaService.promotionItem.findFirst.mockResolvedValue(null);
      mockPrismaService.shapeMapping.findUnique.mockResolvedValue({ id: 'mapping-1', status: 'pending' });
      mockPrismaService.promotionItem.create.mockResolvedValue(mockPromotionItem);
      mockPrismaService.configAuditLog.create.mockResolvedValue({});

      const result = await service.submitForReview(
        { configId: 'mapping-1', configType: 'shape_mapping', description: 'New mapping' },
        'user-1',
      );

      expect(result.status).toBe('review');
    });

    it('should throw if already pending review', async () => {
      mockPrismaService.promotionItem.findFirst.mockResolvedValue(mockPromotionItem);

      await expect(
        service.submitForReview(
          { configId: 'mapping-1', configType: 'shape_mapping' },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('reviewDecision', () => {
    it('should approve item', async () => {
      mockPrismaService.promotionItem.findUnique.mockResolvedValue(mockPromotionItem);
      mockPrismaService.promotionItem.update.mockResolvedValue({
        ...mockPromotionItem,
        status: 'approved',
      });
      mockPrismaService.configAuditLog.create.mockResolvedValue({});

      const result = await service.reviewDecision(
        'promo-1',
        { decision: 'approve', feedback: 'Looks good' },
        'user-1',
      );

      expect(result.status).toBe('approved');
    });

    it('should request changes', async () => {
      mockPrismaService.promotionItem.findUnique.mockResolvedValue(mockPromotionItem);
      mockPrismaService.promotionItem.update.mockResolvedValue({
        ...mockPromotionItem,
        status: 'pending',
      });
      mockPrismaService.configAuditLog.create.mockResolvedValue({});

      const result = await service.reviewDecision(
        'promo-1',
        { decision: 'request_changes', feedback: 'Please update X' },
        'user-1',
      );

      expect(result.status).toBe('pending');
    });
  });

  describe('promote', () => {
    it('should promote approved items', async () => {
      mockPrismaService.promotionItem.findUnique.mockResolvedValue({
        ...mockPromotionItem,
        status: 'approved',
      });
      mockPrismaService.shapeMapping.update.mockResolvedValue({});
      mockPrismaService.promotionItem.update.mockResolvedValue({
        ...mockPromotionItem,
        status: 'live',
      });
      mockPrismaService.configAuditLog.create.mockResolvedValue({});

      const result = await service.promote(
        {
          itemIds: ['promo-1'],
          testedInSandbox: true,
          understandsImpact: true,
          notes: 'Promoting',
        },
        'user-1',
      );

      expect(result.promoted).toBe(1);
    });

    it('should throw if confirmations not provided', async () => {
      await expect(
        service.promote(
          { itemIds: ['promo-1'], testedInSandbox: false, understandsImpact: true },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('rollback', () => {
    it('should rollback live item', async () => {
      mockPrismaService.promotionItem.findUnique.mockResolvedValue({
        ...mockPromotionItem,
        status: 'live',
        previousData: { drawioStyle: 'old', status: 'live' },
      });
      mockPrismaService.shapeMapping.update.mockResolvedValue({});
      mockPrismaService.promotionItem.update.mockResolvedValue({
        ...mockPromotionItem,
        status: 'archived',
      });
      mockPrismaService.configAuditLog.create.mockResolvedValue({});

      const result = await service.rollback(
        { promotionId: 'promo-1', reason: 'Reverting' },
        'user-1',
      );

      expect(result.status).toBe('archived');
    });

    it('should throw if not live', async () => {
      mockPrismaService.promotionItem.findUnique.mockResolvedValue(mockPromotionItem);

      await expect(
        service.rollback({ promotionId: 'promo-1', reason: 'Reverting' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('testShapeMappings', () => {
    it('should test diagram shapes', async () => {
      mockPrismaService.shapeMapping.findFirst
        .mockResolvedValueOnce({ id: 'm1', drawioStyle: 'mxgraph.aws4.ec2', threagileType: 'web-server', status: 'live' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.testShapeMappings({
        diagramXml: '<mxCell style="shape=mxgraph.aws4.ec2;" />',
      });

      expect(result.summary.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('testDeduplication', () => {
    it('should find canonical risk for input IDs', async () => {
      mockPrismaService.canonicalRiskSource.findMany.mockResolvedValue([
        {
          source: 'cwe',
          sourceRuleId: 'CWE-79',
          canonicalRisk: { canonicalId: 'xss', title: 'Cross-Site Scripting' },
        },
      ]);

      const result = await service.testDeduplication({ riskIds: ['CWE-79'] });

      expect(result.canonicalRisk?.id).toBe('xss');
    });

    it('should return null if no mapping found', async () => {
      mockPrismaService.canonicalRiskSource.findMany.mockResolvedValue([]);

      const result = await service.testDeduplication({ riskIds: ['unknown-id'] });

      expect(result.canonicalRisk).toBeNull();
    });
  });

  describe('testPlaybook', () => {
    it('should render playbook with context', async () => {
      mockPrismaService.remediationPlaybook.findUnique.mockResolvedValue({
        id: 'pb-1',
        title: 'Enable TLS',
        steps: [
          { stepNumber: 1, title: 'Configure {asset}', description: 'Update {technology} settings' },
        ],
      });

      const result = await service.testPlaybook({
        playbookId: 'pb-1',
        assetName: 'API Server',
        technology: 'nginx',
      });

      expect(result.renderedSteps[0].title).toBe('Configure API Server');
      expect(result.renderedSteps[0].description).toBe('Update nginx settings');
    });
  });

  describe('listAuditLogs', () => {
    it('should return audit logs', async () => {
      mockPrismaService.configAuditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          entityType: 'suggestion',
          entityId: 'sugg-1',
          action: 'approve',
          userId: 'user-1',
          userName: 'John',
          changes: {},
          metadata: null,
          createdAt: new Date(),
        },
      ]);
      mockPrismaService.configAuditLog.count.mockResolvedValue(1);

      const result = await service.listAuditLogs({ entityType: 'suggestion' });

      expect(result.logs).toHaveLength(1);
    });
  });
});
