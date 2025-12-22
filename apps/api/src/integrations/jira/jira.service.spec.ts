import { Test, TestingModule } from '@nestjs/testing';
import { JiraService } from './jira.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../scm/services/crypto.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('JiraService', () => {
  let service: JiraService;

  const mockPrismaService = {
    jiraConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    finding: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockCryptoService = {
    encrypt: jest.fn((value: string) => `encrypted:${value}`),
    decrypt: jest.fn((value: string) => value.replace('encrypted:', '')),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JiraService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CryptoService, useValue: mockCryptoService },
      ],
    }).compile();

    service = module.get<JiraService>(JiraService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConfig', () => {
    it('should return Jira config for tenant', async () => {
      const mockConfig = {
        id: 'config-1',
        tenantId: 'tenant-1',
        jiraUrl: 'https://company.atlassian.net',
        email: 'user@company.com',
        apiToken: 'encrypted:token',
        projectKey: 'SEC',
        issueType: 'Bug',
        enabled: true,
        autoCreate: false,
        autoCreateSeverities: ['critical', 'high'],
      };

      mockPrismaService.jiraConfig.findUnique.mockResolvedValue(mockConfig);

      const result = await service.getConfig('tenant-1');

      expect(result).toBeDefined();
      expect(result?.jiraUrl).toBe('https://company.atlassian.net');
      expect(result?.hasApiToken).toBe(true);
      expect(result).not.toHaveProperty('apiToken'); // Should not expose token
    });

    it('should return null when config not found', async () => {
      mockPrismaService.jiraConfig.findUnique.mockResolvedValue(null);

      const result = await service.getConfig('tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('updateConfig', () => {
    it('should update Jira configuration', async () => {
      const updatedConfig = {
        id: 'config-1',
        jiraUrl: 'https://new.atlassian.net',
        email: 'new@company.com',
        apiToken: 'encrypted:new-token',
        projectKey: 'NEW',
        issueType: 'Task',
        enabled: true,
        autoCreate: true,
        autoCreateSeverities: ['critical'],
      };

      mockPrismaService.jiraConfig.upsert.mockResolvedValue(updatedConfig);

      const result = await service.updateConfig('tenant-1', {
        jiraUrl: 'https://new.atlassian.net',
        email: 'new@company.com',
        apiToken: 'new-token',
        projectKey: 'NEW',
        issueType: 'Task',
        enabled: true,
        autoCreate: true,
      });

      expect(result.jiraUrl).toBe('https://new.atlassian.net');
      expect(mockCryptoService.encrypt).toHaveBeenCalledWith('new-token');
    });
  });

  describe('testConnection', () => {
    it('should return error when config incomplete', async () => {
      mockPrismaService.jiraConfig.findUnique.mockResolvedValue({
        jiraUrl: null,
        email: null,
        apiToken: null,
      });

      const result = await service.testConnection('tenant-1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('incomplete');
    });

    it('should test connection successfully', async () => {
      mockPrismaService.jiraConfig.findUnique.mockResolvedValue({
        jiraUrl: 'https://company.atlassian.net',
        email: 'user@company.com',
        apiToken: 'encrypted:token',
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ displayName: 'Test User' }),
      });

      const result = await service.testConnection('tenant-1');

      expect(result.success).toBe(true);
    });

    it('should handle connection failure', async () => {
      mockPrismaService.jiraConfig.findUnique.mockResolvedValue({
        jiraUrl: 'https://company.atlassian.net',
        email: 'user@company.com',
        apiToken: 'encrypted:token',
      });

      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.testConnection('tenant-1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error');
    });
  });

  describe('getProjects', () => {
    it('should fetch projects from Jira', async () => {
      mockPrismaService.jiraConfig.findUnique.mockResolvedValue({
        jiraUrl: 'https://company.atlassian.net',
        email: 'user@company.com',
        apiToken: 'encrypted:token',
        projectKey: 'SEC',
        issueType: 'Bug',
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          values: [
            { id: '1', key: 'SEC', name: 'Security' },
            { id: '2', key: 'DEV', name: 'Development' },
          ],
        }),
      });

      const result = await service.getProjects('tenant-1');

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('SEC');
    });
  });

  describe('createIssue', () => {
    it('should create Jira issue from finding', async () => {
      mockPrismaService.jiraConfig.findUnique.mockResolvedValue({
        jiraUrl: 'https://company.atlassian.net',
        email: 'user@company.com',
        apiToken: 'encrypted:token',
        projectKey: 'SEC',
        issueType: 'Bug',
      });

      mockPrismaService.finding.findFirst.mockResolvedValue({
        id: 'finding-1',
        title: 'SQL Injection',
        description: 'SQL injection vulnerability',
        severity: 'high',
        scanner: 'semgrep',
        ruleId: 'sql-injection-001',
        filePath: 'src/db.ts',
        startLine: 42,
        scan: {
          id: 'scan-1',
          repository: { fullName: 'owner/repo' },
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({
          id: 'jira-123',
          key: 'SEC-456',
          self: 'https://company.atlassian.net/rest/api/3/issue/jira-123',
        }),
      });

      mockPrismaService.finding.update.mockResolvedValue({});

      const result = await service.createIssue('tenant-1', 'finding-1');

      expect(result.key).toBe('SEC-456');
      expect(result.url).toBe('https://company.atlassian.net/browse/SEC-456');
      expect(mockPrismaService.finding.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when finding not found', async () => {
      mockPrismaService.jiraConfig.findUnique.mockResolvedValue({
        jiraUrl: 'https://company.atlassian.net',
        email: 'user@company.com',
        apiToken: 'encrypted:token',
        projectKey: 'SEC',
        issueType: 'Bug',
      });

      mockPrismaService.finding.findFirst.mockResolvedValue(null);

      await expect(
        service.createIssue('tenant-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when project key missing', async () => {
      mockPrismaService.jiraConfig.findUnique.mockResolvedValue({
        jiraUrl: 'https://company.atlassian.net',
        email: 'user@company.com',
        apiToken: 'encrypted:token',
        projectKey: '', // Empty
        issueType: 'Bug',
      });

      mockPrismaService.finding.findFirst.mockResolvedValue({
        id: 'finding-1',
        scan: { repository: { fullName: 'owner/repo' } },
      });

      await expect(
        service.createIssue('tenant-1', 'finding-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('autoCreateIssuesForScan', () => {
    it('should auto-create issues for matching findings', async () => {
      mockPrismaService.jiraConfig.findUnique.mockResolvedValue({
        enabled: true,
        autoCreate: true,
        autoCreateSeverities: ['critical', 'high'],
        jiraUrl: 'https://company.atlassian.net',
        email: 'user@company.com',
        apiToken: 'encrypted:token',
        projectKey: 'SEC',
        issueType: 'Bug',
      });

      mockPrismaService.finding.findMany.mockResolvedValue([
        { id: 'f1', severity: 'high', title: 'Finding 1' },
        { id: 'f2', severity: 'critical', title: 'Finding 2' },
      ]);

      mockPrismaService.finding.findFirst.mockResolvedValue({
        id: 'f1',
        title: 'Finding',
        severity: 'high',
        scanner: 'semgrep',
        ruleId: 'rule-1',
        filePath: 'src/app.ts',
        scan: { repository: { fullName: 'owner/repo' } },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 'jira-123', key: 'SEC-456', self: 'url' }),
      });

      mockPrismaService.finding.update.mockResolvedValue({});

      const result = await service.autoCreateIssuesForScan('tenant-1', 'scan-1');

      expect(result).toBe(2);
    });

    it('should return 0 when auto-create disabled', async () => {
      mockPrismaService.jiraConfig.findUnique.mockResolvedValue({
        enabled: true,
        autoCreate: false,
      });

      const result = await service.autoCreateIssuesForScan('tenant-1', 'scan-1');

      expect(result).toBe(0);
    });
  });

  describe('getLinkedIssue', () => {
    it('should return linked issue info', async () => {
      mockPrismaService.finding.findFirst.mockResolvedValue({
        jiraIssueKey: 'SEC-123',
        jiraIssueUrl: 'https://company.atlassian.net/browse/SEC-123',
      });

      const result = await service.getLinkedIssue('tenant-1', 'finding-1');

      expect(result.issueKey).toBe('SEC-123');
      expect(result.issueUrl).toBe('https://company.atlassian.net/browse/SEC-123');
    });

    it('should throw NotFoundException when finding not found', async () => {
      mockPrismaService.finding.findFirst.mockResolvedValue(null);

      await expect(
        service.getLinkedIssue('tenant-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
