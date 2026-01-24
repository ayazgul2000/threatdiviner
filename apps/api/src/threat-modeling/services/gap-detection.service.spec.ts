import { Test, TestingModule } from '@nestjs/testing';
import { GapDetectionService } from './gap-detection.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GapElementType } from '../dto/gap-detection.dto';

describe('GapDetectionService', () => {
  let service: GapDetectionService;

  const mockPrisma = {
    threatModel: {
      findFirst: jest.fn(),
    },
    threatModelComponent: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    threatModelDataFlow: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GapDetectionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GapDetectionService>(GapDetectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectGaps', () => {
    it('should return valid=true when all required fields are present', async () => {
      const mockThreatModel = {
        id: 'tm-1',
        tenantId: 'tenant-1',
        components: [
          {
            id: 'c1',
            name: 'Web Server',
            technology: 'nodejs',
            type: 'server',
            criticality: 'high',
          },
        ],
        dataFlows: [
          {
            id: 'df1',
            label: 'API Request',
            protocol: 'https',
            dataType: 'api-requests',
          },
        ],
      };
      mockPrisma.threatModel.findFirst.mockResolvedValue(mockThreatModel);

      const result = await service.detectGaps('tenant-1', 'tm-1');

      expect(result.valid).toBe(true);
      expect(result.gaps).toHaveLength(0);
      expect(result.summary.totalGaps).toBe(0);
    });

    it('should detect missing technology on assets', async () => {
      const mockThreatModel = {
        id: 'tm-1',
        tenantId: 'tenant-1',
        components: [
          {
            id: 'c1',
            name: 'Web Server',
            technology: '',
            type: 'server',
            criticality: 'high',
          },
        ],
        dataFlows: [],
      };
      mockPrisma.threatModel.findFirst.mockResolvedValue(mockThreatModel);

      const result = await service.detectGaps('tenant-1', 'tm-1');

      expect(result.valid).toBe(false);
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]).toMatchObject({
        elementType: GapElementType.ASSET,
        elementId: 'c1',
        field: 'technology',
        message: 'Technology type is required',
      });
      expect(result.gaps[0].suggestions).toContain('web-application');
    });

    it('should detect missing type on assets', async () => {
      const mockThreatModel = {
        id: 'tm-1',
        tenantId: 'tenant-1',
        components: [
          {
            id: 'c1',
            name: 'Database',
            technology: 'postgresql',
            type: '',
            criticality: 'critical',
          },
        ],
        dataFlows: [],
      };
      mockPrisma.threatModel.findFirst.mockResolvedValue(mockThreatModel);

      const result = await service.detectGaps('tenant-1', 'tm-1');

      expect(result.valid).toBe(false);
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0].field).toBe('type');
      expect(result.gaps[0].suggestions).toContain('database');
    });

    it('should detect missing criticality on assets', async () => {
      const mockThreatModel = {
        id: 'tm-1',
        tenantId: 'tenant-1',
        components: [
          {
            id: 'c1',
            name: 'Cache',
            technology: 'redis',
            type: 'database',
            criticality: null,
          },
        ],
        dataFlows: [],
      };
      mockPrisma.threatModel.findFirst.mockResolvedValue(mockThreatModel);

      const result = await service.detectGaps('tenant-1', 'tm-1');

      expect(result.valid).toBe(false);
      expect(result.gaps.find(g => g.field === 'criticality')).toBeDefined();
    });

    it('should detect missing protocol on data flows', async () => {
      const mockThreatModel = {
        id: 'tm-1',
        tenantId: 'tenant-1',
        components: [],
        dataFlows: [
          {
            id: 'df1',
            label: 'Connection',
            protocol: '',
            dataType: 'api-requests',
          },
        ],
      };
      mockPrisma.threatModel.findFirst.mockResolvedValue(mockThreatModel);

      const result = await service.detectGaps('tenant-1', 'tm-1');

      expect(result.valid).toBe(false);
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]).toMatchObject({
        elementType: GapElementType.LINK,
        elementId: 'df1',
        field: 'protocol',
        message: 'Protocol is required for connections',
      });
      expect(result.gaps[0].suggestions).toContain('https');
    });

    it('should detect missing dataType on data flows', async () => {
      const mockThreatModel = {
        id: 'tm-1',
        tenantId: 'tenant-1',
        components: [],
        dataFlows: [
          {
            id: 'df1',
            label: 'Request',
            protocol: 'https',
            dataType: null,
          },
        ],
      };
      mockPrisma.threatModel.findFirst.mockResolvedValue(mockThreatModel);

      const result = await service.detectGaps('tenant-1', 'tm-1');

      expect(result.valid).toBe(false);
      expect(result.gaps.find(g => g.field === 'dataType')).toBeDefined();
    });

    it('should detect multiple gaps across assets and links', async () => {
      const mockThreatModel = {
        id: 'tm-1',
        tenantId: 'tenant-1',
        components: [
          { id: 'c1', name: 'Server 1', technology: '', type: '', criticality: '' },
          { id: 'c2', name: 'Server 2', technology: 'java', type: '', criticality: '' },
        ],
        dataFlows: [
          { id: 'df1', label: 'Flow 1', protocol: '', dataType: '' },
        ],
      };
      mockPrisma.threatModel.findFirst.mockResolvedValue(mockThreatModel);

      const result = await service.detectGaps('tenant-1', 'tm-1');

      expect(result.valid).toBe(false);
      expect(result.summary.assetGaps).toBeGreaterThan(0);
      expect(result.summary.linkGaps).toBeGreaterThan(0);
      expect(result.summary.totalGaps).toBe(
        result.summary.assetGaps + result.summary.linkGaps + result.summary.boundaryGaps
      );
    });

    it('should throw error when threat model not found', async () => {
      mockPrisma.threatModel.findFirst.mockResolvedValue(null);

      await expect(service.detectGaps('tenant-1', 'tm-999')).rejects.toThrow(
        'Threat model not found'
      );
    });

    it('should use data flow id substring for label when label is missing', async () => {
      const mockThreatModel = {
        id: 'tm-1',
        tenantId: 'tenant-1',
        components: [],
        dataFlows: [
          { id: 'df1234567890', label: null, protocol: '', dataType: '' },
        ],
      };
      mockPrisma.threatModel.findFirst.mockResolvedValue(mockThreatModel);

      const result = await service.detectGaps('tenant-1', 'tm-1');

      expect(result.gaps[0].elementName).toContain('df123456');
    });
  });

  describe('batchUpdateAssets', () => {
    it('should update assets successfully', async () => {
      mockPrisma.threatModelComponent.findFirst.mockResolvedValue({
        id: 'c1',
        threatModelId: 'tm-1',
      });
      mockPrisma.threatModelComponent.update.mockResolvedValue({ id: 'c1' });

      const result = await service.batchUpdateAssets('tenant-1', 'tm-1', [
        { id: 'c1', fields: { technology: 'nodejs', type: 'server' } },
      ]);

      expect(result.updated).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockPrisma.threatModelComponent.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { technology: 'nodejs', type: 'server' },
      });
    });

    it('should fail when component not found', async () => {
      mockPrisma.threatModelComponent.findFirst.mockResolvedValue(null);

      const result = await service.batchUpdateAssets('tenant-1', 'tm-1', [
        { id: 'c999', fields: { technology: 'nodejs' } },
      ]);

      expect(result.updated).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toMatchObject({
        id: 'c999',
        error: 'Component not found or access denied',
      });
    });

    it('should handle multiple updates with mixed success/failure', async () => {
      mockPrisma.threatModelComponent.findFirst
        .mockResolvedValueOnce({ id: 'c1', threatModelId: 'tm-1' })
        .mockResolvedValueOnce(null);
      mockPrisma.threatModelComponent.update.mockResolvedValue({ id: 'c1' });

      const result = await service.batchUpdateAssets('tenant-1', 'tm-1', [
        { id: 'c1', fields: { technology: 'nodejs' } },
        { id: 'c999', fields: { technology: 'java' } },
      ]);

      expect(result.updated).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('batchUpdateDataFlows', () => {
    it('should update data flows successfully', async () => {
      mockPrisma.threatModelDataFlow.findFirst.mockResolvedValue({
        id: 'df1',
        threatModelId: 'tm-1',
      });
      mockPrisma.threatModelDataFlow.update.mockResolvedValue({ id: 'df1' });

      const result = await service.batchUpdateDataFlows('tenant-1', 'tm-1', [
        { id: 'df1', fields: { protocol: 'https', dataType: 'api-requests' } },
      ]);

      expect(result.updated).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockPrisma.threatModelDataFlow.update).toHaveBeenCalledWith({
        where: { id: 'df1' },
        data: { protocol: 'https', dataType: 'api-requests' },
      });
    });

    it('should fail when data flow not found', async () => {
      mockPrisma.threatModelDataFlow.findFirst.mockResolvedValue(null);

      const result = await service.batchUpdateDataFlows('tenant-1', 'tm-1', [
        { id: 'df999', fields: { protocol: 'grpc' } },
      ]);

      expect(result.updated).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toContain('not found');
    });
  });

  describe('batchUpdateBoundaries', () => {
    it('should return empty result (not implemented)', async () => {
      const result = await service.batchUpdateBoundaries('tenant-1', 'tm-1', [
        { id: 'b1', fields: { name: 'Trust Zone' } },
      ]);

      expect(result.updated).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('batchFillGaps', () => {
    it('should update all element types and re-validate', async () => {
      // Setup for updates
      mockPrisma.threatModelComponent.findFirst.mockResolvedValue({
        id: 'c1',
        threatModelId: 'tm-1',
      });
      mockPrisma.threatModelComponent.update.mockResolvedValue({ id: 'c1' });
      mockPrisma.threatModelDataFlow.findFirst.mockResolvedValue({
        id: 'df1',
        threatModelId: 'tm-1',
      });
      mockPrisma.threatModelDataFlow.update.mockResolvedValue({ id: 'df1' });

      // Setup for re-validation (after updates, no gaps)
      mockPrisma.threatModel.findFirst.mockResolvedValue({
        id: 'tm-1',
        tenantId: 'tenant-1',
        components: [
          { id: 'c1', name: 'Server', technology: 'nodejs', type: 'server', criticality: 'high' },
        ],
        dataFlows: [
          { id: 'df1', label: 'Flow', protocol: 'https', dataType: 'api-requests' },
        ],
      });

      const result = await service.batchFillGaps(
        'tenant-1',
        'tm-1',
        [{ id: 'c1', fields: { technology: 'nodejs' } }],
        [{ id: 'df1', fields: { protocol: 'https' } }],
        [],
      );

      expect(result.assetsUpdated).toBe(1);
      expect(result.linksUpdated).toBe(1);
      expect(result.boundariesUpdated).toBe(0);
      expect(result.gapResult.valid).toBe(true);
    });

    it('should return remaining gaps after partial fill', async () => {
      mockPrisma.threatModelComponent.findFirst.mockResolvedValue({
        id: 'c1',
        threatModelId: 'tm-1',
      });
      mockPrisma.threatModelComponent.update.mockResolvedValue({ id: 'c1' });

      // Re-validation shows remaining gaps
      mockPrisma.threatModel.findFirst.mockResolvedValue({
        id: 'tm-1',
        tenantId: 'tenant-1',
        components: [
          { id: 'c1', name: 'Server', technology: 'nodejs', type: '', criticality: '' },
        ],
        dataFlows: [],
      });

      const result = await service.batchFillGaps(
        'tenant-1',
        'tm-1',
        [{ id: 'c1', fields: { technology: 'nodejs' } }],
        [],
        [],
      );

      expect(result.assetsUpdated).toBe(1);
      expect(result.gapResult.valid).toBe(false);
      expect(result.gapResult.gaps.length).toBeGreaterThan(0);
    });
  });
});
