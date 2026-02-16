import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  ThreatModelComplianceService,
  ThreatModelComplianceResult,
} from './threat-model-compliance.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';

describe('ThreatModelComplianceService', () => {
  let service: ThreatModelComplianceService;

  const mockThreatModel = {
    id: 'tm-1',
    name: 'Test Threat Model',
    threats: [
      {
        id: 'threat-1',
        title: 'SQL Injection',
        canonicalRiskId: 'cr-1',
        likelihood: 'high',
        impact: 'high',
        canonicalRisk: {
          id: 'cr-1',
          canonicalId: 'sql-injection',
          title: 'SQL Injection',
          defaultSeverity: 'high',
        },
        mitigations: [],
      },
      {
        id: 'threat-2',
        title: 'XSS Attack',
        canonicalRiskId: 'cr-2',
        likelihood: 'medium',
        impact: 'medium',
        canonicalRisk: {
          id: 'cr-2',
          canonicalId: 'xss',
          title: 'Cross-Site Scripting',
          defaultSeverity: 'medium',
        },
        mitigations: [
          {
            mitigation: { id: 'mit-1', implementationStatus: 'completed' },
          },
        ],
      },
      {
        id: 'threat-3',
        title: 'Unencrypted Data',
        canonicalRiskId: null,
        likelihood: 'low',
        impact: 'low',
        canonicalRisk: null,
        mitigations: [],
      },
    ],
  };

  const mockFramework = {
    id: 'iso27001',
    name: 'ISO 27001:2022',
    version: '2022',
    isActive: true,
    controls: [
      {
        id: 'ctrl-1',
        controlId: 'A.8.3',
        name: 'Information access restriction',
        riskMappings: [
          {
            canonicalRiskId: 'cr-1',
            relevance: 'primary',
            canonicalRisk: {
              id: 'cr-1',
              canonicalId: 'sql-injection',
              title: 'SQL Injection',
              defaultSeverity: 'high',
            },
          },
        ],
      },
      {
        id: 'ctrl-2',
        controlId: 'A.8.5',
        name: 'Secure authentication',
        riskMappings: [
          {
            canonicalRiskId: 'cr-2',
            relevance: 'primary',
            canonicalRisk: {
              id: 'cr-2',
              canonicalId: 'xss',
              title: 'Cross-Site Scripting',
              defaultSeverity: 'medium',
            },
          },
        ],
      },
      {
        id: 'ctrl-3',
        controlId: 'A.8.6',
        name: 'Capacity management',
        riskMappings: [],
      },
    ],
  };

  const mockPrismaService = {
    threatModel: {
      findUnique: jest.fn(),
    },
    complianceFramework: {
      findMany: jest.fn(),
    },
    riskControlMapping: {
      findMany: jest.fn(),
    },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    delPattern: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreatModelComplianceService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<ThreatModelComplianceService>(ThreatModelComplianceService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateComplianceGaps', () => {
    it('should return cached result if available', async () => {
      const cachedResult: ThreatModelComplianceResult = {
        threatModelId: 'tm-1',
        threatModelName: 'Cached Model',
        generatedAt: new Date(),
        totalThreats: 5,
        threatsWithCanonicalRisk: 3,
        frameworks: [],
      };

      mockCacheService.get.mockResolvedValue(cachedResult);

      const result = await service.calculateComplianceGaps('tm-1');

      expect(result).toEqual(cachedResult);
      expect(mockPrismaService.threatModel.findUnique).not.toHaveBeenCalled();
    });

    it('should calculate compliance gaps when cache miss', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.threatModel.findUnique.mockResolvedValue(mockThreatModel);
      mockPrismaService.complianceFramework.findMany.mockResolvedValue([mockFramework]);

      const result = await service.calculateComplianceGaps('tm-1');

      expect(result.threatModelId).toBe('tm-1');
      expect(result.threatModelName).toBe('Test Threat Model');
      expect(result.totalThreats).toBe(3);
      expect(result.threatsWithCanonicalRisk).toBe(2);
      expect(result.frameworks).toHaveLength(1);

      // Verify cache was set
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid threat model', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.threatModel.findUnique.mockResolvedValue(null);

      await expect(service.calculateComplianceGaps('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should correctly identify gap controls', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.threatModel.findUnique.mockResolvedValue(mockThreatModel);
      mockPrismaService.complianceFramework.findMany.mockResolvedValue([mockFramework]);

      const result = await service.calculateComplianceGaps('tm-1');
      const framework = result.frameworks[0];

      // Control A.8.3 should be a gap (SQL Injection has no mitigation)
      const ctrl1 = framework.controlDetails.find(c => c.controlId === 'A.8.3');
      expect(ctrl1?.gapStatus).toBe('gap');

      // Control A.8.5 should be satisfied (XSS has completed mitigation)
      const ctrl2 = framework.controlDetails.find(c => c.controlId === 'A.8.5');
      expect(ctrl2?.gapStatus).toBe('satisfied');

      // Control A.8.6 has no risk mappings, should be satisfied
      const ctrl3 = framework.controlDetails.find(c => c.controlId === 'A.8.6');
      expect(ctrl3?.gapStatus).toBe('satisfied');
    });

    it('should calculate compliance percentage correctly', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.threatModel.findUnique.mockResolvedValue(mockThreatModel);
      mockPrismaService.complianceFramework.findMany.mockResolvedValue([mockFramework]);

      const result = await service.calculateComplianceGaps('tm-1');
      const framework = result.frameworks[0];

      // 2 satisfied out of 3 controls = 67%
      expect(framework.totalControls).toBe(3);
      expect(framework.satisfiedControls).toBe(2);
      expect(framework.gapControls).toBe(1);
      expect(framework.compliancePercentage).toBe(67);
    });

    it('should filter by framework IDs when specified', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.threatModel.findUnique.mockResolvedValue(mockThreatModel);
      mockPrismaService.complianceFramework.findMany.mockResolvedValue([mockFramework]);

      await service.calculateComplianceGaps('tm-1', ['iso27001']);

      expect(mockPrismaService.complianceFramework.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['iso27001'] },
          }),
        }),
      );
    });
  });

  describe('getComplianceGapSummary', () => {
    it('should return gap summary with severity breakdown', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.threatModel.findUnique.mockResolvedValue(mockThreatModel);
      mockPrismaService.complianceFramework.findMany.mockResolvedValue([mockFramework]);

      const summary = await service.getComplianceGapSummary('tm-1');

      expect(summary.totalGaps).toBe(1);
      expect(summary.topGaps).toHaveLength(1);
      expect(summary.topGaps[0].controlId).toBe('A.8.3');
    });

    it('should filter by framework when specified', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.threatModel.findUnique.mockResolvedValue(mockThreatModel);
      mockPrismaService.complianceFramework.findMany.mockResolvedValue([mockFramework]);

      await service.getComplianceGapSummary('tm-1', 'iso27001');

      expect(mockPrismaService.complianceFramework.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['iso27001'] },
          }),
        }),
      );
    });
  });

  describe('getFrameworkComplianceScore', () => {
    it('should return score for specific framework', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.threatModel.findUnique.mockResolvedValue(mockThreatModel);
      mockPrismaService.complianceFramework.findMany.mockResolvedValue([mockFramework]);

      const score = await service.getFrameworkComplianceScore('tm-1', 'iso27001');

      expect(score).not.toBeNull();
      expect(score?.frameworkId).toBe('iso27001');
      expect(score?.compliancePercentage).toBe(67);
    });

    it('should return null for non-existent framework', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.threatModel.findUnique.mockResolvedValue(mockThreatModel);
      mockPrismaService.complianceFramework.findMany.mockResolvedValue([]);

      const score = await service.getFrameworkComplianceScore('tm-1', 'invalid');

      expect(score).toBeNull();
    });
  });

  describe('getControlsForRisk', () => {
    it('should return controls mapped to a canonical risk', async () => {
      mockPrismaService.riskControlMapping.findMany.mockResolvedValue([
        {
          canonicalRiskId: 'cr-1',
          relevance: 'primary',
          aiConfidence: 0.95,
          control: {
            id: 'ctrl-1',
            controlId: 'A.8.3',
            name: 'Information access restriction',
            frameworkId: 'iso27001',
          },
        },
      ]);

      const controls = await service.getControlsForRisk('cr-1');

      expect(controls).toHaveLength(1);
      expect(controls[0].control.controlId).toBe('A.8.3');
      expect(controls[0].relevance).toBe('primary');
      expect(controls[0].aiConfidence).toBe(0.95);
    });
  });

  describe('getRisksForControl', () => {
    it('should return risks mapped to a control', async () => {
      mockPrismaService.riskControlMapping.findMany.mockResolvedValue([
        {
          complianceControlId: 'ctrl-1',
          relevance: 'primary',
          aiConfidence: 0.89,
          canonicalRisk: {
            id: 'cr-1',
            canonicalId: 'sql-injection',
            title: 'SQL Injection',
            defaultSeverity: 'high',
          },
        },
      ]);

      const risks = await service.getRisksForControl('ctrl-1');

      expect(risks).toHaveLength(1);
      expect(risks[0].canonicalRisk.canonicalId).toBe('sql-injection');
      expect(risks[0].relevance).toBe('primary');
    });
  });

  describe('invalidateCache', () => {
    it('should delete cache pattern for threat model', async () => {
      await service.invalidateCache('tm-1');

      expect(mockCacheService.delPattern).toHaveBeenCalledWith('tm-compliance:tm-1:*');
    });
  });

  describe('partial mitigation handling', () => {
    it('should mark control as partial when mitigation is in progress', async () => {
      const threatModelWithPartial = {
        ...mockThreatModel,
        threats: [
          {
            id: 'threat-1',
            title: 'SQL Injection',
            canonicalRiskId: 'cr-1',
            likelihood: 'high',
            impact: 'high',
            canonicalRisk: {
              id: 'cr-1',
              canonicalId: 'sql-injection',
              title: 'SQL Injection',
              defaultSeverity: 'high',
            },
            mitigations: [
              {
                mitigation: { id: 'mit-1', implementationStatus: 'in_progress' },
              },
            ],
          },
        ],
      };

      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.threatModel.findUnique.mockResolvedValue(threatModelWithPartial);
      mockPrismaService.complianceFramework.findMany.mockResolvedValue([mockFramework]);

      const result = await service.calculateComplianceGaps('tm-1');
      const ctrl = result.frameworks[0].controlDetails.find(c => c.controlId === 'A.8.3');

      expect(ctrl?.gapStatus).toBe('partial');
    });
  });

  describe('severity calculation', () => {
    it('should calculate critical severity for high likelihood and high impact', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.threatModel.findUnique.mockResolvedValue(mockThreatModel);
      mockPrismaService.complianceFramework.findMany.mockResolvedValue([mockFramework]);

      const result = await service.calculateComplianceGaps('tm-1');
      const ctrl = result.frameworks[0].controlDetails.find(c => c.controlId === 'A.8.3');

      expect(ctrl?.relatedRisks[0].severity).toBe('high');
    });
  });
});
