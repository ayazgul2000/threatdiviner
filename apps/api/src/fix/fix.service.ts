import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubProvider } from '../scm/providers/github.provider';
import { SmartTriageService } from '../ai/services/smart-triage.service';
import { FixGeneratorService } from '../ai/services/fix-generator.service';

export interface ApplyFixResult {
  success: boolean;
  message: string;
  redirectUrl?: string;
}

export interface TriageResult {
  success: boolean;
  analysis?: string;
  confidence?: number;
  falsePositive?: boolean;
  exploitability?: string;
  remediation?: string;
  redirectUrl?: string;
}

@Injectable()
export class FixService {
  private readonly logger = new Logger(FixService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubProvider: GitHubProvider,
    private readonly triageService: SmartTriageService,
    private readonly fixGeneratorService: FixGeneratorService,
  ) {}

  async applyFix(findingId: string): Promise<ApplyFixResult> {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: { scan: { include: { repository: { include: { connection: true } } } } },
    });

    if (!finding) throw new NotFoundException('Finding not found');

    let autoFix = finding.autoFix;
    if (!autoFix) {
      autoFix = await this.generateAutoFix(finding);
      if (!autoFix) {
        return { success: false, message: 'No auto-fix available', redirectUrl: finding.scan.pullRequestUrl || undefined };
      }
    }

    const { repository } = finding.scan;
    const { connection } = repository;
    if (!connection) return { success: false, message: 'Repository connection not found' };

    try {
      const [owner, repo] = repository.fullName.split('/');
      if (connection.provider !== 'github') {
        return { success: false, message: 'Auto-fix only supported for GitHub currently' };
      }

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${finding.filePath}?ref=${finding.scan.branch}`,
        { headers: { Authorization: `Bearer ${connection.accessToken}`, Accept: 'application/vnd.github.v3+json' } },
      );
      const data = await response.json();
      const fileContent = Buffer.from(data.content, 'base64').toString('utf-8');

      const lines = fileContent.split('\n');
      const startLine = finding.startLine || 1;
      const endLine = finding.endLine || startLine;
      lines.splice(startLine - 1, endLine - startLine + 1, ...autoFix.split('\n'));

      await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${finding.filePath}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${connection.accessToken}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `fix: ${finding.ruleId} - ${finding.title}\n\nAuto-fix by ThreatDiviner\nFinding ID: ${finding.id}`,
          content: Buffer.from(lines.join('\n')).toString('base64'),
          sha: data.sha,
          branch: finding.scan.branch,
        }),
      });

      await this.prisma.finding.update({ where: { id: findingId }, data: { status: 'fixed', fixedInCommit: 'auto-fix-applied' } });
      return { success: true, message: 'Fix applied successfully', redirectUrl: finding.scan.pullRequestUrl || undefined };
    } catch (error) {
      this.logger.error(`Failed to apply fix for ${findingId}:`, error);
      return { success: false, message: error instanceof Error ? error.message : 'Failed to apply fix' };
    }
  }

  async applyAllFixes(scanId: string): Promise<ApplyFixResult> {
    const findings = await this.prisma.finding.findMany({ where: { scanId, autoFix: { not: null }, status: 'open' } });
    if (findings.length === 0) return { success: false, message: 'No auto-fixable findings found' };

    let successCount = 0, failCount = 0;
    for (const finding of findings) {
      try {
        const result = await this.applyFix(finding.id);
        result.success ? successCount++ : failCount++;
      } catch { failCount++; }
    }

    const scan = await this.prisma.scan.findUnique({ where: { id: scanId } });
    return { success: failCount === 0, message: `Applied ${successCount} fixes, ${failCount} failed`, redirectUrl: scan?.pullRequestUrl || undefined };
  }

  async dismiss(findingId: string, reason?: string): Promise<ApplyFixResult> {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: { scan: true },
    });
    if (!finding) throw new NotFoundException('Finding not found');

    await this.prisma.finding.update({
      where: { id: findingId },
      data: { status: 'dismissed', dismissReason: reason || 'dismissed_via_pr', dismissedAt: new Date() },
    });
    return { success: true, message: 'Finding dismissed', redirectUrl: finding.scan.pullRequestUrl || undefined };
  }

  async triage(findingId: string, replyToPr = false): Promise<TriageResult> {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: { scan: { include: { repository: { include: { connection: true } } } } },
    });
    if (!finding) throw new NotFoundException('Finding not found');

    try {
      const result = await this.triageService.triageFinding({
        id: finding.id,
        title: finding.title,
        description: finding.description || '',
        severity: finding.severity,
        scanner: finding.scanner,
        ruleId: finding.ruleId || '',
        filePath: finding.filePath || '',
        lineNumber: finding.startLine || undefined,
        codeSnippet: finding.snippet || undefined,
        cweId: finding.cweId || undefined,
      });

      await this.prisma.finding.update({
        where: { id: findingId },
        data: {
          aiAnalysis: result.reasoning,
          aiConfidence: result.confidence === 'high' ? 0.9 : result.confidence === 'medium' ? 0.7 : 0.5,
          aiSeverity: result.adjustedSeverity,
          aiFalsePositive: result.status === 'false_positive',
          aiTriagedAt: new Date(),
        },
      });

      if (replyToPr && finding.prCommentId && finding.scan.pullRequestId) {
        const { repository } = finding.scan;
        const { connection } = repository;
        if (connection && connection.provider === 'github') {
          const [owner, repo] = repository.fullName.split('/');
          const message = `**AI Triage**\n\n**Verdict:** ${result.status === 'false_positive' ? 'Likely False Positive' : 'Confirmed'}\n**Confidence:** ${result.confidence}\n\n${result.reasoning}`;
          await this.githubProvider.createPRComment(connection.accessToken, owner, repo, parseInt(finding.scan.pullRequestId), message);
        }
      }

      return {
        success: true,
        analysis: result.reasoning,
        confidence: result.confidence === 'high' ? 0.9 : result.confidence === 'medium' ? 0.7 : 0.5,
        falsePositive: result.status === 'false_positive',
        redirectUrl: finding.scan.pullRequestUrl || undefined,
      };
    } catch (error) {
      this.logger.error(`Triage failed for ${findingId}:`, error);
      return { success: false, redirectUrl: finding.scan.pullRequestUrl || undefined };
    }
  }

  async getFixStatus(findingId: string) {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      select: { id: true, autoFix: true, aiTriagedAt: true, aiAnalysis: true, aiConfidence: true, aiFalsePositive: true, status: true },
    });
    if (!finding) throw new NotFoundException('Finding not found');

    return {
      findingId: finding.id,
      autoFixAvailable: !!finding.autoFix,
      aiTriaged: !!finding.aiTriagedAt,
      aiAnalysis: finding.aiAnalysis,
      aiConfidence: finding.aiConfidence,
      aiFalsePositive: finding.aiFalsePositive,
      status: finding.status,
    };
  }

  async generateFix(findingId: string) {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: { scan: { include: { repository: { include: { connection: true } } } } },
    });
    if (!finding) throw new NotFoundException('Finding not found');

    if (finding.autoFix) {
      return { success: true, autoFix: finding.autoFix, explanation: finding.aiRemediation || 'Previously generated', cached: true };
    }

    const autoFix = await this.generateAutoFix(finding);
    if (!autoFix) return { success: false, message: 'Unable to generate auto-fix' };

    return { success: true, autoFix, explanation: 'AI-generated fix', cached: false };
  }

  private async generateAutoFix(finding: any): Promise<string | null> {
    try {
      const { repository } = finding.scan;
      const { connection } = repository;
      if (!connection || connection.provider !== 'github') return null;

      const [owner, repo] = repository.fullName.split('/');
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${finding.filePath}?ref=${finding.scan.branch}`,
        { headers: { Authorization: `Bearer ${connection.accessToken}`, Accept: 'application/vnd.github.v3+json' } },
      );
      if (!response.ok) return null;

      const data = await response.json();
      const fileContent = Buffer.from(data.content, 'base64').toString('utf-8');
      const lines = fileContent.split('\n');
      const startLine = finding.startLine || 1;
      const endLine = finding.endLine || startLine;
      const vulnerableCode = lines.slice(startLine - 1, endLine).join('\n');

      const result = await this.fixGeneratorService.generateFix({
        findingId: finding.id,
        title: finding.title,
        description: finding.description || '',
        cweId: finding.cweId,
        vulnerableCode,
        filePath: finding.filePath,
        language: this.detectLanguage(finding.filePath),
      });

      if (!result.fixedCode || result.fixedCode.includes('manual review')) return null;

      await this.prisma.finding.update({
        where: { id: finding.id },
        data: { autoFix: result.fixedCode, aiRemediation: result.explanation },
      });

      return result.fixedCode;
    } catch (error) {
      this.logger.error(`Auto-fix generation failed for ${finding.id}:`, error);
      return null;
    }
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript', js: 'javascript', py: 'python', java: 'java', go: 'go',
      rb: 'ruby', php: 'php', cs: 'csharp', rs: 'rust', kt: 'kotlin', swift: 'swift',
    };
    return langMap[ext || ''] || 'unknown';
  }

  async triageAll(scanId: string): Promise<TriageResult> {
    const findings = await this.prisma.finding.findMany({ where: { scanId, aiTriagedAt: null } });
    if (findings.length === 0) return { success: false };

    let truePositives = 0, falsePositives = 0;
    for (const finding of findings) {
      try {
        const result = await this.triage(finding.id, false);
        if (result.success) result.falsePositive ? falsePositives++ : truePositives++;
      } catch { /* continue */ }
    }

    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: { repository: { include: { connection: true } } },
    });

    if (scan?.pullRequestId && scan.repository?.connection?.provider === 'github') {
      const [owner, repo] = scan.repository.fullName.split('/');
      const summary = `**AI Triage Complete**\n\n| Verdict | Count |\n|---------|-------|\n| True Positives | ${truePositives} |\n| False Positives | ${falsePositives} |`;
      await this.githubProvider.createPRComment(scan.repository.connection.accessToken, owner, repo, parseInt(scan.pullRequestId), summary);
    }

    return { success: true, redirectUrl: scan?.pullRequestUrl || undefined };
  }
}
