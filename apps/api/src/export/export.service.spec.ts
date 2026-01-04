import { Test, TestingModule } from '@nestjs/testing';
import { ExportService } from './export.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ExportService', () => {
  let service: ExportService;

  const mockPrismaService = {
    finding: {
      findMany: jest.fn(),
    },
    scan: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    repository: {
      findMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('exportFindings', () => {
    const mockFindings = [
      {
        id: 'f1',
        title: 'SQL Injection',
        severity: 'high',
        status: 'open',
        scanner: 'semgrep',
        ruleId: 'sql-injection-001',
        filePath: 'src/db.ts',
        startLine: 42,
        endLine: 45,
        description: 'SQL injection vulnerability',
        aiRemediation: 'Use parameterized queries',
        cweId: 'CWE-89',
        cveId: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        scan: {
          branch: 'main',
          commitSha: 'abc123',
          repository: { fullName: 'owner/repo' },
        },
      },
    ];

    it('should export findings as JSON', async () => {
      mockPrismaService.finding.findMany.mockResolvedValue(mockFindings);

      const result = await service.exportFindings('tenant-1', {
        format: 'json',
      });

      expect(result.contentType).toBe('application/json');
      expect(result.filename).toContain('.json');
      expect(JSON.parse(result.data as string)).toHaveLength(1);
    });

    it('should export findings as CSV', async () => {
      mockPrismaService.finding.findMany.mockResolvedValue(mockFindings);

      const result = await service.exportFindings('tenant-1', {
        format: 'csv',
      });

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toContain('.csv');
      expect(result.data).toContain('id,title,severity');
    });

    it('should export findings as XLSX', async () => {
      mockPrismaService.finding.findMany.mockResolvedValue(mockFindings);

      const result = await service.exportFindings('tenant-1', {
        format: 'xlsx',
      });

      expect(result.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(result.filename).toContain('.xlsx');
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect((result.data as Buffer).length).toBeGreaterThan(0);
    });

    it('should apply filters', async () => {
      mockPrismaService.finding.findMany.mockResolvedValue([]);

      await service.exportFindings('tenant-1', {
        format: 'json',
        filters: {
          severity: ['critical', 'high'],
          status: ['open'],
          repositoryId: 'repo-1',
        },
      });

      expect(mockPrismaService.finding.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            severity: { in: ['critical', 'high'] },
            status: { in: ['open'] },
            scan: { repositoryId: 'repo-1' },
          }),
        }),
      );
    });

    it('should handle date filters', async () => {
      mockPrismaService.finding.findMany.mockResolvedValue([]);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await service.exportFindings('tenant-1', {
        format: 'json',
        filters: { startDate, endDate },
      });

      expect(mockPrismaService.finding.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: startDate, lte: endDate },
          }),
        }),
      );
    });
  });

  describe('exportScans', () => {
    const mockScans = [
      {
        id: 'scan-1',
        branch: 'main',
        commitSha: 'abc123',
        status: 'completed',
        triggeredBy: 'webhook',
        startedAt: new Date('2024-01-01T10:00:00Z'),
        completedAt: new Date('2024-01-01T10:05:00Z'),
        duration: 300,
        errorMessage: null,
        createdAt: new Date('2024-01-01'),
        repository: { fullName: 'owner/repo' },
        _count: { findings: 10 },
      },
    ];

    it('should export scans as JSON', async () => {
      mockPrismaService.scan.findMany.mockResolvedValue(mockScans);

      const result = await service.exportScans('tenant-1', { format: 'json' });

      expect(result.contentType).toBe('application/json');
      const data = JSON.parse(result.data as string);
      expect(data).toHaveLength(1);
      expect(data[0].findingsCount).toBe(10);
    });

    it('should export scans as CSV', async () => {
      mockPrismaService.scan.findMany.mockResolvedValue(mockScans);

      const result = await service.exportScans('tenant-1', { format: 'csv' });

      expect(result.contentType).toBe('text/csv');
      expect(result.data).toContain('id,repository,branch');
    });

    it('should export scans as XLSX', async () => {
      mockPrismaService.scan.findMany.mockResolvedValue(mockScans);

      const result = await service.exportScans('tenant-1', { format: 'xlsx' });

      expect(result.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(result.filename).toContain('.xlsx');
      expect(Buffer.isBuffer(result.data)).toBe(true);
    });
  });

  describe('exportRepositories', () => {
    const mockRepositories = [
      {
        id: 'repo-1',
        name: 'repo',
        fullName: 'owner/repo',
        htmlUrl: 'https://github.com/owner/repo',
        defaultBranch: 'main',
        language: 'TypeScript',
        isPrivate: true,
        createdAt: new Date('2024-01-01'),
        _count: { scans: 5 },
        scans: [
          { status: 'completed', createdAt: new Date('2024-01-15') },
        ],
      },
    ];

    it('should export repositories as JSON', async () => {
      mockPrismaService.repository.findMany.mockResolvedValue(mockRepositories);

      const result = await service.exportRepositories('tenant-1', { format: 'json' });

      expect(result.contentType).toBe('application/json');
      const data = JSON.parse(result.data as string);
      expect(data).toHaveLength(1);
      expect(data[0].totalScans).toBe(5);
    });

    it('should export repositories as CSV', async () => {
      mockPrismaService.repository.findMany.mockResolvedValue(mockRepositories);

      const result = await service.exportRepositories('tenant-1', { format: 'csv' });

      expect(result.contentType).toBe('text/csv');
      expect(result.data).toContain('id,name,fullName');
    });

    it('should export repositories as XLSX', async () => {
      mockPrismaService.repository.findMany.mockResolvedValue(mockRepositories);

      const result = await service.exportRepositories('tenant-1', { format: 'xlsx' });

      expect(result.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(result.filename).toContain('.xlsx');
      expect(Buffer.isBuffer(result.data)).toBe(true);
    });
  });

  describe('exportAuditLogs', () => {
    const mockLogs = [
      {
        id: 'log-1',
        action: 'scan.trigger',
        resource: 'scan',
        resourceId: 'scan-1',
        userId: 'user-1',
        userEmail: 'user@example.com',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        details: { key: 'value' },
        createdAt: new Date('2024-01-01'),
      },
    ];

    it('should export audit logs as JSON', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.exportAuditLogs('tenant-1', { format: 'json' });

      expect(result.contentType).toBe('application/json');
      const data = JSON.parse(result.data as string);
      expect(data).toHaveLength(1);
      expect(data[0].action).toBe('scan.trigger');
    });

    it('should export audit logs as CSV', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.exportAuditLogs('tenant-1', { format: 'csv' });

      expect(result.contentType).toBe('text/csv');
      expect(result.data).toContain('id,action,resource');
    });

    it('should export audit logs as XLSX', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.exportAuditLogs('tenant-1', { format: 'xlsx' });

      expect(result.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(result.filename).toContain('.xlsx');
      expect(Buffer.isBuffer(result.data)).toBe(true);
    });
  });

  describe('exportScanSarif', () => {
    it('should generate SARIF report', async () => {
      const mockScan = {
        id: 'scan-1',
        commitSha: 'abc123',
        branch: 'main',
        repository: {
          htmlUrl: 'https://github.com/owner/repo',
        },
        findings: [
          {
            id: 'f1',
            ruleId: 'sql-injection-001',
            title: 'SQL Injection',
            description: 'SQL injection vulnerability',
            severity: 'high',
            filePath: 'src/db.ts',
            startLine: 42,
            endLine: 45,
            cweId: 'CWE-89',
          },
        ],
      };

      mockPrismaService.scan.findFirst.mockResolvedValue(mockScan);

      const result = await service.exportScanSarif('tenant-1', 'scan-1');

      expect(result.contentType).toBe('application/json');
      expect(result.filename).toContain('sarif.json');

      const sarif = JSON.parse(result.data as string);
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs).toHaveLength(1);
      expect(sarif.runs[0].tool.driver.name).toBe('ThreatDiviner');
      expect(sarif.runs[0].results).toHaveLength(1);
    });

    it('should throw NotFoundException when scan not found', async () => {
      mockPrismaService.scan.findFirst.mockResolvedValue(null);

      await expect(
        service.exportScanSarif('tenant-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should map severity to SARIF level correctly', async () => {
      const mockScan = {
        id: 'scan-1',
        commitSha: 'abc123',
        branch: 'main',
        repository: { htmlUrl: 'https://github.com/owner/repo' },
        findings: [
          { id: 'f1', ruleId: 'r1', title: 'Critical', severity: 'critical', filePath: 'a.ts', startLine: 1 },
          { id: 'f2', ruleId: 'r2', title: 'High', severity: 'high', filePath: 'b.ts', startLine: 1 },
          { id: 'f3', ruleId: 'r3', title: 'Medium', severity: 'medium', filePath: 'c.ts', startLine: 1 },
          { id: 'f4', ruleId: 'r4', title: 'Low', severity: 'low', filePath: 'd.ts', startLine: 1 },
        ],
      };

      mockPrismaService.scan.findFirst.mockResolvedValue(mockScan);

      const result = await service.exportScanSarif('tenant-1', 'scan-1');
      const sarif = JSON.parse(result.data as string);

      expect(sarif.runs[0].results[0].level).toBe('error'); // critical
      expect(sarif.runs[0].results[1].level).toBe('error'); // high
      expect(sarif.runs[0].results[2].level).toBe('warning'); // medium
      expect(sarif.runs[0].results[3].level).toBe('note'); // low
    });
  });
});
