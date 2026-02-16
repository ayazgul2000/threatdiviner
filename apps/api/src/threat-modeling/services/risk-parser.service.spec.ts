import { Test, TestingModule } from '@nestjs/testing';
import { RiskParserService } from './risk-parser.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('RiskParserService', () => {
  let service: RiskParserService;

  const mockPrisma = {
    canonicalRiskSource: {
      findFirst: jest.fn(),
    },
    threatModelComponent: {
      findFirst: jest.fn(),
    },
    threat: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    threatComponentMapping: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskParserService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RiskParserService>(RiskParserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('parseThreagileOutput', () => {
    it('should parse Format 1: risks_identified array', () => {
      const rawOutput = {
        risks_identified: [
          {
            id: 'risk-1',
            category: 'unencrypted-communication',
            title: 'Unencrypted HTTP Traffic',
            severity: 'high',
            exploitation_likelihood: 'likely',
            exploitation_impact: 'high',
            most_relevant_technical_asset: 'web-server',
            cwe_id: 319,
            mitigation: 'Use HTTPS instead of HTTP',
          },
          {
            id: 'risk-2',
            category: 'missing-authentication',
            title: 'Missing Authentication',
            severity: 'critical',
            exploitation_likelihood: 'frequent',
            exploitation_impact: 'critical',
            most_relevant_technical_asset: 'api-gateway',
            cwe_id: 306,
          },
        ],
      };

      const result = service.parseThreagileOutput(rawOutput);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'risk-1',
        category: 'unencrypted-communication',
        title: 'Unencrypted HTTP Traffic',
        severity: 'high',
        cweId: 319,
        mitigation: 'Use HTTPS instead of HTTP',
      });
      expect(result[0].fingerprint).toBeDefined();
      expect(result[0].fingerprint).toHaveLength(32);
    });

    it('should parse Format 2: generated_risks object', () => {
      const rawOutput = {
        generated_risks: {
          'sql-injection-1': {
            category: 'sql-nosql-injection',
            title: 'SQL Injection in User Form',
            severity: 'elevated',
            exploitation_likelihood: 'occasional',
            exploitation_impact: 'medium',
            most_relevant_technical_asset: 'database',
            cwe_id: 89,
          },
        },
      };

      const result = service.parseThreagileOutput(rawOutput);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'sql-injection-1',
        category: 'sql-nosql-injection',
        title: 'SQL Injection in User Form',
        severity: 'high', // normalized from 'elevated'
        cweId: 89,
      });
    });

    it('should parse Format 3: direct array', () => {
      const rawOutput = [
        {
          synthetic_id: 'xss-1',
          risk_category: 'cross-site-scripting',
          risk_title: 'XSS in Comments',
          risk_severity: 'medium',
          exploitation_likelihood: 'likely',
          exploitation_impact: 'medium',
          most_relevant_asset: 'frontend-app',
          cwe: 79,
        },
      ];

      const result = service.parseThreagileOutput(rawOutput);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'xss-1',
        category: 'cross-site-scripting',
        title: 'XSS in Comments',
        severity: 'medium',
        cweId: 79,
      });
    });

    it('should handle empty output', () => {
      expect(service.parseThreagileOutput({})).toEqual([]);
      expect(service.parseThreagileOutput({ risks_identified: [] })).toEqual([]);
      expect(service.parseThreagileOutput([])).toEqual([]);
    });

    it('should generate unique fingerprints for different risks', () => {
      const rawOutput = {
        risks_identified: [
          {
            id: 'r1',
            category: 'cat-a',
            title: 'Title A',
            most_relevant_technical_asset: 'asset-1',
          },
          {
            id: 'r2',
            category: 'cat-b',
            title: 'Title B',
            most_relevant_technical_asset: 'asset-2',
          },
        ],
      };

      const result = service.parseThreagileOutput(rawOutput);

      expect(result[0].fingerprint).not.toBe(result[1].fingerprint);
    });

    it('should generate same fingerprint for identical risks', () => {
      const rawOutput1 = {
        risks_identified: [
          {
            id: 'r1',
            category: 'sql-injection',
            title: 'SQL Injection',
            most_relevant_technical_asset: 'db',
            cwe_id: 89,
          },
        ],
      };
      const rawOutput2 = {
        risks_identified: [
          {
            id: 'r2', // different id
            category: 'sql-injection',
            title: 'SQL Injection',
            most_relevant_technical_asset: 'db',
            cwe_id: 89,
          },
        ],
      };

      const result1 = service.parseThreagileOutput(rawOutput1);
      const result2 = service.parseThreagileOutput(rawOutput2);

      expect(result1[0].fingerprint).toBe(result2[0].fingerprint);
    });

    it('should normalize severity levels correctly', () => {
      const testCases = [
        { input: 'critical', expected: 'critical' },
        { input: 'CRITICAL', expected: 'critical' },
        { input: 'elevated', expected: 'high' },
        { input: 'high', expected: 'high' },
        { input: 'medium', expected: 'medium' },
        { input: 'low', expected: 'low' },
        { input: 'unknown', expected: 'medium' }, // default
        { input: undefined, expected: 'medium' }, // default
      ];

      for (const { input, expected } of testCases) {
        const rawOutput = {
          risks_identified: [
            { id: 'r1', category: 'test', title: 'Test', severity: input },
          ],
        };
        const result = service.parseThreagileOutput(rawOutput);
        expect(result[0].severity).toBe(expected);
      }
    });

    it('should handle missing optional fields gracefully', () => {
      const rawOutput = {
        risks_identified: [
          {
            category: 'test-category',
          },
        ],
      };

      const result = service.parseThreagileOutput(rawOutput);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBeDefined();
      expect(result[0].title).toBe('Untitled Risk');
      expect(result[0].severity).toBe('medium');
      expect(result[0].cweId).toBeUndefined();
    });
  });

  describe('lookupCanonicalRisk', () => {
    it('should find canonical risk by CWE', async () => {
      mockPrisma.canonicalRiskSource.findFirst.mockResolvedValue({
        canonicalRiskId: 'cr-1',
        canonicalRisk: {
          controlMappings: [
            { complianceControlId: 'ctrl-1' },
            { complianceControlId: 'ctrl-2' },
          ],
        },
      });

      const risk = {
        id: 'r1',
        category: 'sql-injection',
        title: 'SQL Injection',
        severity: 'high',
        exploitationLikelihood: 'likely',
        exploitationImpact: 'high',
        mostRelevantTechnicalAsset: 'db',
        cweId: 89,
        fingerprint: 'abc123',
      };

      const result = await service.lookupCanonicalRisk('tenant-1', risk);

      expect(result.canonicalRiskId).toBe('cr-1');
      expect(result.controlMappings).toEqual(['ctrl-1', 'ctrl-2']);
      expect(mockPrisma.canonicalRiskSource.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            source: 'cwe',
            sourceRuleId: '89',
          }),
        })
      );
    });

    it('should fallback to category lookup when CWE not found', async () => {
      mockPrisma.canonicalRiskSource.findFirst
        .mockResolvedValueOnce(null) // CWE lookup fails
        .mockResolvedValueOnce({
          canonicalRiskId: 'cr-2',
          canonicalRisk: {
            controlMappings: [],
          },
        });

      const risk = {
        id: 'r1',
        category: 'unencrypted-communication',
        title: 'Unencrypted Traffic',
        severity: 'high',
        exploitationLikelihood: 'likely',
        exploitationImpact: 'high',
        mostRelevantTechnicalAsset: 'api',
        cweId: 999999, // Unknown CWE
        fingerprint: 'abc123',
      };

      const result = await service.lookupCanonicalRisk('tenant-1', risk);

      expect(result.canonicalRiskId).toBe('cr-2');
      expect(mockPrisma.canonicalRiskSource.findFirst).toHaveBeenCalledTimes(2);
    });

    it('should return null when no mapping found', async () => {
      mockPrisma.canonicalRiskSource.findFirst.mockResolvedValue(null);

      const risk = {
        id: 'r1',
        category: 'unknown-category',
        title: 'Unknown Risk',
        severity: 'medium',
        exploitationLikelihood: 'unlikely',
        exploitationImpact: 'low',
        mostRelevantTechnicalAsset: 'unknown',
        fingerprint: 'abc123',
      };

      const result = await service.lookupCanonicalRisk('tenant-1', risk);

      expect(result.canonicalRiskId).toBeNull();
      expect(result.controlMappings).toEqual([]);
    });
  });

  describe('findComponentByName', () => {
    it('should find component by exact name match', async () => {
      mockPrisma.threatModelComponent.findFirst.mockResolvedValue({ id: 'c1' });

      const result = await service.findComponentByName('tm-1', 'web-server');

      expect(result).toBe('c1');
    });

    it('should find component by case-insensitive match', async () => {
      mockPrisma.threatModelComponent.findFirst
        .mockResolvedValueOnce(null) // exact match fails
        .mockResolvedValueOnce({ id: 'c2' }); // case-insensitive succeeds

      const result = await service.findComponentByName('tm-1', 'WEB-SERVER');

      expect(result).toBe('c2');
    });

    it('should find component by partial match', async () => {
      mockPrisma.threatModelComponent.findFirst
        .mockResolvedValueOnce(null) // exact match fails
        .mockResolvedValueOnce(null) // case-insensitive fails
        .mockResolvedValueOnce({ id: 'c3' }); // partial match succeeds

      const result = await service.findComponentByName('tm-1', 'server');

      expect(result).toBe('c3');
    });

    it('should return null for empty asset name', async () => {
      const result = await service.findComponentByName('tm-1', '');

      expect(result).toBeNull();
      expect(mockPrisma.threatModelComponent.findFirst).not.toHaveBeenCalled();
    });

    it('should return null when no match found', async () => {
      mockPrisma.threatModelComponent.findFirst.mockResolvedValue(null);

      const result = await service.findComponentByName('tm-1', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createOrUpdateThreat', () => {
    const mockRisk = {
      id: 'r1',
      category: 'sql-injection',
      title: 'SQL Injection',
      severity: 'high',
      exploitationLikelihood: 'likely',
      exploitationImpact: 'high',
      mostRelevantTechnicalAsset: 'database',
      cweId: 89,
      mitigation: 'Use parameterized queries',
      fingerprint: 'abc123def456',
    };

    beforeEach(() => {
      mockPrisma.canonicalRiskSource.findFirst.mockResolvedValue(null);
      mockPrisma.threatModelComponent.findFirst.mockResolvedValue(null);
    });

    it('should create new threat when no existing threat with fingerprint', async () => {
      mockPrisma.threat.findFirst.mockResolvedValue(null);
      mockPrisma.threat.create.mockResolvedValue({ id: 't1' });

      const result = await service.createOrUpdateThreat(
        'tenant-1',
        'tm-1',
        'user-1',
        mockRisk,
        'run-1',
      );

      expect(result.isNew).toBe(true);
      expect(result.threatId).toBe('t1');
      expect(mockPrisma.threat.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          threatModelId: 'tm-1',
          title: 'SQL Injection',
          fingerprint: 'abc123def456',
          analysisRunId: 'run-1',
          cweId: '89',
        }),
      });
    });

    it('should update existing threat when fingerprint matches', async () => {
      mockPrisma.threat.findFirst.mockResolvedValue({
        id: 't-existing',
        components: [],
      });
      mockPrisma.threat.update.mockResolvedValue({ id: 't-existing' });

      const result = await service.createOrUpdateThreat(
        'tenant-1',
        'tm-1',
        'user-1',
        mockRisk,
        'run-1',
      );

      expect(result.isNew).toBe(false);
      expect(result.threatId).toBe('t-existing');
      expect(mockPrisma.threat.update).toHaveBeenCalled();
      expect(mockPrisma.threat.create).not.toHaveBeenCalled();
    });

    it('should link threat to component when asset matches', async () => {
      mockPrisma.threat.findFirst.mockResolvedValue(null);
      mockPrisma.threat.create.mockResolvedValue({ id: 't1' });
      mockPrisma.threatModelComponent.findFirst.mockResolvedValue({ id: 'c1' });
      mockPrisma.threatComponentMapping.create.mockResolvedValue({});

      const result = await service.createOrUpdateThreat(
        'tenant-1',
        'tm-1',
        'user-1',
        mockRisk,
        'run-1',
      );

      expect(result.linkedComponents).toContain('c1');
      expect(mockPrisma.threatComponentMapping.create).toHaveBeenCalledWith({
        data: { threatId: 't1', componentId: 'c1' },
      });
    });

    it('should not duplicate component mapping on update', async () => {
      mockPrisma.threat.findFirst.mockResolvedValue({
        id: 't-existing',
        components: [{ componentId: 'c1' }], // already linked
      });
      mockPrisma.threat.update.mockResolvedValue({ id: 't-existing' });
      mockPrisma.threatModelComponent.findFirst.mockResolvedValue({ id: 'c1' });

      const result = await service.createOrUpdateThreat(
        'tenant-1',
        'tm-1',
        'user-1',
        mockRisk,
        'run-1',
      );

      expect(result.linkedComponents).toHaveLength(0);
      expect(mockPrisma.threatComponentMapping.create).not.toHaveBeenCalled();
    });
  });

  describe('processRisks', () => {
    it('should process multiple risks and return stats', async () => {
      const risks = [
        {
          id: 'r1',
          category: 'cat-1',
          title: 'Risk 1',
          severity: 'high',
          exploitationLikelihood: 'likely',
          exploitationImpact: 'high',
          mostRelevantTechnicalAsset: 'asset-1',
          fingerprint: 'fp1',
        },
        {
          id: 'r2',
          category: 'cat-2',
          title: 'Risk 2',
          severity: 'medium',
          exploitationLikelihood: 'occasional',
          exploitationImpact: 'medium',
          mostRelevantTechnicalAsset: 'asset-2',
          fingerprint: 'fp2',
        },
      ];

      mockPrisma.threat.findFirst
        .mockResolvedValueOnce(null) // r1 is new
        .mockResolvedValueOnce({ id: 't2', components: [] }); // r2 exists
      mockPrisma.threat.create.mockResolvedValue({ id: 't1' });
      mockPrisma.threat.update.mockResolvedValue({ id: 't2' });
      mockPrisma.canonicalRiskSource.findFirst.mockResolvedValue(null);
      mockPrisma.threatModelComponent.findFirst.mockResolvedValue({ id: 'c1' });
      mockPrisma.threatComponentMapping.create.mockResolvedValue({});

      const result = await service.processRisks(
        'tenant-1',
        'tm-1',
        'user-1',
        'run-1',
        risks,
      );

      expect(result.created).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.linked).toBeGreaterThan(0);
    });

    it('should continue processing on individual risk failure', async () => {
      const risks = [
        {
          id: 'r1',
          category: 'cat-1',
          title: 'Risk 1',
          severity: 'high',
          exploitationLikelihood: 'likely',
          exploitationImpact: 'high',
          mostRelevantTechnicalAsset: 'asset-1',
          fingerprint: 'fp1',
        },
        {
          id: 'r2',
          category: 'cat-2',
          title: 'Risk 2',
          severity: 'medium',
          exploitationLikelihood: 'occasional',
          exploitationImpact: 'medium',
          mostRelevantTechnicalAsset: 'asset-2',
          fingerprint: 'fp2',
        },
      ];

      mockPrisma.threat.findFirst
        .mockRejectedValueOnce(new Error('Database error')) // r1 fails
        .mockResolvedValueOnce(null); // r2 succeeds
      mockPrisma.threat.create.mockResolvedValue({ id: 't2' });
      mockPrisma.canonicalRiskSource.findFirst.mockResolvedValue(null);
      mockPrisma.threatModelComponent.findFirst.mockResolvedValue(null);

      const result = await service.processRisks(
        'tenant-1',
        'tm-1',
        'user-1',
        'run-1',
        risks,
      );

      expect(result.created).toBe(1); // Only r2 succeeded
    });
  });
});
