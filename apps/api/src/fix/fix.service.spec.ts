import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FixService } from './fix.service';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubProvider } from '../scm/providers/github.provider';
import { AiService } from '../ai/ai.service';

describe('FixService', () => {
  let service: FixService;
  let prismaService: any;
  let githubProvider: any;
  let aiService: any;

  const mockFinding = {
    id: 'finding-1',
    ruleId: 'sql-injection',
    title: 'SQL Injection',
    description: 'Potential SQL injection',
    severity: 'critical',
    filePath: 'src/db.ts',
    startLine: 10,
    endLine: 12,
    snippet: 'db.query(`SELECT * FROM users WHERE id = ${id}`)',
    cweId: 'CWE-89',
    autoFix: null,
    status: 'open',
    prCommentId: 'comment-1',
    scan: {
      id: 'scan-1',
      branch: 'feature-branch',
      pullRequestId: '123',
      pullRequestUrl: 'https://github.com/org/repo/pull/123',
      repository: {
        id: 'repo-1',
        fullName: 'org/repo',
        connection: {
          id: 'conn-1',
          provider: 'github',
          accessToken: 'token',
        },
      },
    },
  };

  beforeEach(async () => {
    const mockPrismaService = {
      finding: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      scan: {
        findUnique: jest.fn(),
      },
    };

    const mockGitHubProvider = {
      createPRComment: jest.fn().mockResolvedValue(true),
    };

    const mockAiService = {
      triageFinding: jest.fn(),
      generateAutoFix: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FixService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: GitHubProvider, useValue: mockGitHubProvider },
        { provide: AiService, useValue: mockAiService },
      ],
    }).compile();

    service = module.get<FixService>(FixService);
    prismaService = module.get(PrismaService);
    githubProvider = module.get(GitHubProvider);
    aiService = module.get(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('dismiss', () => {
    it('should dismiss a finding', async () => {
      prismaService.finding.findUnique.mockResolvedValue(mockFinding as any);
      prismaService.finding.update.mockResolvedValue({ ...mockFinding, status: 'dismissed' } as any);

      const result = await service.dismiss('finding-1', 'False positive');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Finding dismissed');
      expect(prismaService.finding.update).toHaveBeenCalledWith({
        where: { id: 'finding-1' },
        data: expect.objectContaining({
          status: 'dismissed',
          dismissReason: 'False positive',
        }),
      });
    });

    it('should throw NotFoundException for non-existent finding', async () => {
      prismaService.finding.findUnique.mockResolvedValue(null);

      await expect(service.dismiss('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('triage', () => {
    it('should triage a finding using AI', async () => {
      prismaService.finding.findUnique.mockResolvedValue(mockFinding as any);
      prismaService.finding.update.mockResolvedValue(mockFinding as any);
      aiService.triageFinding.mockResolvedValue({
        analysis: 'This is a true positive SQL injection',
        suggestedSeverity: 'critical',
        isLikelyFalsePositive: false,
        confidence: 0.95,
        exploitability: 'easy',
        remediation: 'Use parameterized queries',
        references: [],
      });

      const result = await service.triage('finding-1', false);

      expect(result.success).toBe(true);
      expect(result.analysis).toBe('This is a true positive SQL injection');
      expect(result.confidence).toBe(0.95);
      expect(result.falsePositive).toBe(false);
    });

    it('should post to PR when replyToPr is true', async () => {
      prismaService.finding.findUnique.mockResolvedValue(mockFinding as any);
      prismaService.finding.update.mockResolvedValue(mockFinding as any);
      aiService.triageFinding.mockResolvedValue({
        analysis: 'This is a true positive',
        suggestedSeverity: 'critical',
        isLikelyFalsePositive: false,
        confidence: 0.9,
        exploitability: 'easy',
        remediation: 'Fix it',
        references: [],
      });

      await service.triage('finding-1', true);

      expect(githubProvider.createPRComment).toHaveBeenCalled();
    });

    it('should return failure when AI service fails', async () => {
      prismaService.finding.findUnique.mockResolvedValue(mockFinding as any);
      aiService.triageFinding.mockResolvedValue(null);

      const result = await service.triage('finding-1', false);

      expect(result.success).toBe(false);
    });
  });

  describe('getFixStatus', () => {
    it('should return fix status for a finding', async () => {
      prismaService.finding.findUnique.mockResolvedValue({
        id: 'finding-1',
        autoFix: 'const query = db.prepare("SELECT * FROM users WHERE id = ?").get(id);',
        aiTriagedAt: new Date(),
        aiAnalysis: 'True positive',
        aiConfidence: 0.9,
        aiFalsePositive: false,
        status: 'triaged',
      } as any);

      const result = await service.getFixStatus('finding-1');

      expect(result.findingId).toBe('finding-1');
      expect(result.autoFixAvailable).toBe(true);
      expect(result.aiTriaged).toBe(true);
      expect(result.aiConfidence).toBe(0.9);
    });

    it('should throw NotFoundException for non-existent finding', async () => {
      prismaService.finding.findUnique.mockResolvedValue(null);

      await expect(service.getFixStatus('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateFix', () => {
    it('should return cached fix if available', async () => {
      prismaService.finding.findUnique.mockResolvedValue({
        ...mockFinding,
        autoFix: 'const safeQuery = "SELECT * FROM users WHERE id = ?";',
        aiRemediation: 'Use parameterized queries',
      } as any);

      const result = await service.generateFix('finding-1');

      expect(result.success).toBe(true);
      expect(result.cached).toBe(true);
      expect(result.autoFix).toBe('const safeQuery = "SELECT * FROM users WHERE id = ?";');
    });

    it('should throw NotFoundException for non-existent finding', async () => {
      prismaService.finding.findUnique.mockResolvedValue(null);

      await expect(service.generateFix('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('applyAllFixes', () => {
    it('should return failure when no auto-fixable findings exist', async () => {
      prismaService.finding.findMany.mockResolvedValue([]);

      const result = await service.applyAllFixes('scan-1');

      expect(result.success).toBe(false);
      expect(result.message).toBe('No auto-fixable findings found');
    });
  });

  describe('triageAll', () => {
    it('should triage all findings for a scan', async () => {
      prismaService.finding.findMany.mockResolvedValue([
        { id: 'finding-1' },
        { id: 'finding-2' },
      ] as any);
      prismaService.finding.findUnique.mockResolvedValue(mockFinding as any);
      prismaService.finding.update.mockResolvedValue(mockFinding as any);
      prismaService.scan.findUnique.mockResolvedValue({
        pullRequestId: '123',
        pullRequestUrl: 'https://github.com/org/repo/pull/123',
        repository: mockFinding.scan.repository,
      } as any);
      aiService.triageFinding.mockResolvedValue({
        analysis: 'True positive',
        suggestedSeverity: 'high',
        isLikelyFalsePositive: false,
        confidence: 0.85,
        exploitability: 'moderate',
        remediation: 'Fix it',
        references: [],
      });

      const result = await service.triageAll('scan-1');

      expect(result.success).toBe(true);
    });

    it('should return failure when no findings to triage', async () => {
      prismaService.finding.findMany.mockResolvedValue([]);

      const result = await service.triageAll('scan-1');

      expect(result.success).toBe(false);
    });
  });
});
