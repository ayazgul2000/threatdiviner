import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceService } from './compliance.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ComplianceService', () => {
  let service: ComplianceService;

  const mockFindings = [
    { id: '1', severity: 'critical', title: 'SQL Injection', filePath: 'src/app.ts', cweId: 'CWE-89', ruleId: 'sql-injection', scanner: 'semgrep' },
    { id: '2', severity: 'high', title: 'XSS', filePath: 'src/web.ts', cweId: 'CWE-79', ruleId: 'xss', scanner: 'semgrep' },
    { id: '3', severity: 'medium', title: 'Weak Crypto', filePath: 'src/crypto.ts', cweId: 'CWE-327', ruleId: 'weak-crypto', scanner: 'semgrep' },
    { id: '4', severity: 'low', title: 'Info Leak', filePath: 'src/log.ts', cweId: 'CWE-200', ruleId: 'info-leak', scanner: 'semgrep' },
  ];

  beforeEach(async () => {
    const mockPrismaService = {
      finding: {
        findMany: jest.fn().mockResolvedValue(mockFindings),
      },
      scan: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ComplianceService>(ComplianceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getFrameworks', () => {
    it('should return all compliance frameworks', () => {
      const frameworks = service.getFrameworks();
      expect(frameworks).toHaveLength(5);
      expect(frameworks.map(f => f.id)).toEqual(['soc2', 'pci', 'hipaa', 'gdpr', 'iso27001']);
    });

    it('should include controls for each framework', () => {
      const frameworks = service.getFrameworks();
      frameworks.forEach(framework => {
        expect(framework.controls).toBeDefined();
        expect(framework.controls.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getTenantComplianceScore', () => {
    it('should calculate compliance scores for all frameworks', async () => {
      const result = await service.getTenantComplianceScore('tenant-1');

      expect(result.tenantId).toBe('tenant-1');
      expect(result.frameworks).toHaveLength(5);
      expect(result.generatedAt).toBeDefined();
    });

    it('should calculate scores with findings affecting controls', async () => {
      const result = await service.getTenantComplianceScore('tenant-1');

      const soc2Score = result.frameworks.find(f => f.framework === 'soc2');
      expect(soc2Score).toBeDefined();
      expect(soc2Score!.overallScore).toBeLessThan(100);
      expect(soc2Score!.failedControls).toBeGreaterThan(0);
    });

    it('should filter by framework when specified', async () => {
      const result = await service.getTenantComplianceScore('tenant-1', 'soc2');

      expect(result.frameworks).toHaveLength(1);
      expect(result.frameworks[0].framework).toBe('soc2');
    });
  });

  describe('getRepositoryComplianceScore', () => {
    it('should calculate scores for a specific repository', async () => {
      const result = await service.getRepositoryComplianceScore('tenant-1', 'repo-1');

      expect(result.tenantId).toBe('tenant-1');
      expect(result.repositoryId).toBe('repo-1');
      expect(result.frameworks).toHaveLength(5);
    });
  });

  describe('getControlViolations', () => {
    it('should return violations for a framework', async () => {
      const violations = await service.getControlViolations('tenant-1', 'soc2');

      expect(Array.isArray(violations)).toBe(true);
      violations.forEach(v => {
        expect(v.controlId).toBeDefined();
        expect(v.framework).toBe('soc2');
        expect(v.findingId).toBeDefined();
      });
    });

    it('should filter by control when specified', async () => {
      const violations = await service.getControlViolations('tenant-1', 'soc2', 'CC6.1');

      violations.forEach(v => {
        expect(v.controlId).toBe('CC6.1');
      });
    });
  });

  describe('score calculation', () => {
    it('should mark controls as failed when critical findings exist', async () => {
      const result = await service.getTenantComplianceScore('tenant-1', 'soc2');
      const score = result.frameworks[0];

      const failedControls = score.controlStatus.filter(c => c.status === 'failed');
      expect(failedControls.length).toBeGreaterThan(0);
    });

    it('should have overall score between 0 and 100', async () => {
      const result = await service.getTenantComplianceScore('tenant-1');

      result.frameworks.forEach(framework => {
        expect(framework.overallScore).toBeGreaterThanOrEqual(0);
        expect(framework.overallScore).toBeLessThanOrEqual(100);
      });
    });
  });
});
