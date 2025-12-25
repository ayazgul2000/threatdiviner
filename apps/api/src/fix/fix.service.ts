import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubProvider } from '../scm/providers/github.provider';
import { AiService } from '../ai/ai.service';

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
    private readonly aiService: AiService,
  ) {}

  /**
   * Apply an auto-fix to a finding
   */
  async applyFix(findingId: string): Promise<ApplyFixResult> {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: {
        scan: {
          include: {
            repository: {
              include: {
                connection: true,
              },
            },
          },
        },
      },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    // If no auto-fix is stored, try to generate one using AI
    let autoFix = finding.autoFix;
    if (!autoFix) {
      autoFix = await this.generateAutoFix(finding);
      if (!autoFix) {
        return {
          success: false,
          message: 'No auto-fix available for this finding',
          redirectUrl: finding.scan.pullRequestUrl || undefined,
        };
      }
    }

    const { repository } = finding.scan;
    const { connection } = repository;

    if (!connection) {
      return {
        success: false,
        message: 'Repository connection not found',
      };
    }

    try {
      const [owner, repo] = repository.fullName.split('/');
      const accessToken = connection.accessToken;

      // Get the current file content
      let fileContent: string;

      if (connection.provider === 'github') {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${finding.filePath}?ref=${finding.scan.branch}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          },
        );
        const data = await response.json();
        fileContent = Buffer.from(data.content, 'base64').toString('utf-8');
      } else {
        // For other providers, we'd need similar implementations
        return {
          success: false,
          message: 'Auto-fix only supported for GitHub currently',
        };
      }

      // Apply the fix (simple line replacement)
      const lines = fileContent.split('\n');
      const startLine = finding.startLine || 1;
      const endLine = finding.endLine || startLine;

      // Replace the vulnerable lines with the fix
      const fixLines = autoFix.split('\n');
      lines.splice(startLine - 1, endLine - startLine + 1, ...fixLines);
      const fixedContent = lines.join('\n');

      // Commit the fix to GitHub
      const commitMessage = `fix: ${finding.ruleId} - ${finding.title}

Auto-fix applied by ThreatDiviner

Finding ID: ${finding.id}`;

      // Get the current file SHA for update
      const currentFile = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${finding.filePath}?ref=${finding.scan.branch}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );
      const currentFileData = await currentFile.json();

      // Update the file
      await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${finding.filePath}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: commitMessage,
            content: Buffer.from(fixedContent).toString('base64'),
            sha: currentFileData.sha,
            branch: finding.scan.branch,
          }),
        },
      );

      // Update finding status
      await this.prisma.finding.update({
        where: { id: findingId },
        data: {
          status: 'fixed',
          fixedInCommit: 'auto-fix-applied',
        },
      });

      this.logger.log(`Applied auto-fix for finding ${findingId}`);

      return {
        success: true,
        message: 'Fix applied successfully',
        redirectUrl: finding.scan.pullRequestUrl || undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to apply fix for finding ${findingId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to apply fix',
      };
    }
  }

  /**
   * Apply all auto-fixes for a scan
   */
  async applyAllFixes(scanId: string): Promise<ApplyFixResult> {
    const findings = await this.prisma.finding.findMany({
      where: {
        scanId,
        autoFix: { not: null },
        status: 'open',
      },
    });

    if (findings.length === 0) {
      return {
        success: false,
        message: 'No auto-fixable findings found',
      };
    }

    let successCount = 0;
    let failCount = 0;

    for (const finding of findings) {
      try {
        const result = await this.applyFix(finding.id);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
    });

    return {
      success: failCount === 0,
      message: `Applied ${successCount} fixes, ${failCount} failed`,
      redirectUrl: scan?.pullRequestUrl || undefined,
    };
  }

  /**
   * Dismiss a finding
   */
  async dismiss(findingId: string, reason?: string): Promise<ApplyFixResult> {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: {
        scan: {
          include: {
            repository: {
              include: {
                connection: true,
              },
            },
          },
        },
      },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    await this.prisma.finding.update({
      where: { id: findingId },
      data: {
        status: 'dismissed',
        dismissReason: reason || 'dismissed_via_pr',
        dismissedAt: new Date(),
      },
    });

    this.logger.log(`Dismissed finding ${findingId}: ${reason}`);

    return {
      success: true,
      message: 'Finding dismissed',
      redirectUrl: finding.scan.pullRequestUrl || undefined,
    };
  }

  /**
   * AI triage a finding
   */
  async triage(findingId: string, replyToPr = false): Promise<TriageResult> {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: {
        scan: {
          include: {
            repository: {
              include: {
                connection: true,
              },
            },
          },
        },
      },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    try {
      // Call AI service for triage
      const triage = await this.aiService.triageFinding({
        finding: {
          id: finding.id,
          ruleId: finding.ruleId,
          title: finding.title,
          description: finding.description || '',
          severity: finding.severity,
          filePath: finding.filePath,
          startLine: finding.startLine || 1,
          snippet: finding.snippet || undefined,
          cweId: finding.cweId || undefined,
        },
      });

      if (!triage) {
        return {
          success: false,
          redirectUrl: finding.scan.pullRequestUrl || undefined,
        };
      }

      // Update finding with AI analysis
      await this.prisma.finding.update({
        where: { id: findingId },
        data: {
          aiAnalysis: triage.analysis,
          aiConfidence: triage.confidence,
          aiSeverity: triage.suggestedSeverity,
          aiFalsePositive: triage.isLikelyFalsePositive,
          aiExploitability: triage.exploitability,
          aiRemediation: triage.remediation,
          aiTriagedAt: new Date(),
        },
      });

      // Post reply to PR if requested
      if (replyToPr && finding.prCommentId && finding.scan.pullRequestId) {
        const { repository } = finding.scan;
        const { connection } = repository;

        if (connection) {
          const [owner, repo] = repository.fullName.split('/');
          const accessToken = connection.accessToken;

          const message = `**AI Triage Result**

**Verdict:** ${triage.isLikelyFalsePositive ? 'Likely False Positive' : 'Likely True Positive'}
**Confidence:** ${Math.round(triage.confidence * 100)}%
**Exploitability:** ${triage.exploitability}

${triage.analysis}

**Suggested Fix:**
${triage.remediation}`;

          if (connection.provider === 'github') {
            await this.githubProvider.createPRComment(
              accessToken,
              owner,
              repo,
              parseInt(finding.scan.pullRequestId),
              message,
            );
          }
        }
      }

      this.logger.log(`AI triaged finding ${findingId}`);

      return {
        success: true,
        analysis: triage.analysis,
        confidence: triage.confidence,
        falsePositive: triage.isLikelyFalsePositive,
        exploitability: triage.exploitability,
        remediation: triage.remediation,
        redirectUrl: finding.scan.pullRequestUrl || undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to triage finding ${findingId}:`, error);
      return {
        success: false,
        redirectUrl: finding.scan.pullRequestUrl || undefined,
      };
    }
  }

  /**
   * Get fix status for a finding
   */
  async getFixStatus(findingId: string) {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      select: {
        id: true,
        autoFix: true,
        aiTriagedAt: true,
        aiAnalysis: true,
        aiConfidence: true,
        aiFalsePositive: true,
        status: true,
      },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    return {
      findingId: finding.id,
      autoFixAvailable: !!finding.autoFix,
      aiTriaged: !!finding.aiTriagedAt,
      aiAnalysis: finding.aiAnalysis || null,
      aiConfidence: finding.aiConfidence || null,
      aiFalsePositive: finding.aiFalsePositive || null,
      status: finding.status,
    };
  }

  /**
   * Generate auto-fix without applying (preview mode)
   */
  async generateFix(findingId: string) {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      include: {
        scan: {
          include: {
            repository: {
              include: {
                connection: true,
              },
            },
          },
        },
      },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    // If already has auto-fix, return it
    if (finding.autoFix) {
      return {
        success: true,
        autoFix: finding.autoFix,
        explanation: finding.aiRemediation || 'Previously generated fix',
        cached: true,
      };
    }

    // Generate new fix
    const autoFix = await this.generateAutoFix(finding);

    if (!autoFix) {
      return {
        success: false,
        message: 'Unable to generate auto-fix for this finding',
      };
    }

    return {
      success: true,
      autoFix,
      explanation: finding.aiRemediation || 'AI-generated fix',
      cached: false,
    };
  }

  /**
   * Generate an auto-fix using AI
   */
  private async generateAutoFix(finding: any): Promise<string | null> {
    try {
      const { repository } = finding.scan;
      const { connection } = repository;

      if (!connection) {
        return null;
      }

      // Fetch the file content to provide context
      let fileContent: string;
      const [owner, repo] = repository.fullName.split('/');
      const accessToken = connection.accessToken;

      if (connection.provider === 'github') {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${finding.filePath}?ref=${finding.scan.branch}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          },
        );

        if (!response.ok) {
          this.logger.warn(`Failed to fetch file for auto-fix: ${response.statusText}`);
          return null;
        }

        const data = await response.json();
        fileContent = Buffer.from(data.content, 'base64').toString('utf-8');
      } else {
        // Other providers not yet supported for auto-fix generation
        return null;
      }

      // Call AI to generate fix
      const result = await this.aiService.generateAutoFix({
        finding: {
          ruleId: finding.ruleId,
          title: finding.title,
          description: finding.description || '',
          severity: finding.severity,
          filePath: finding.filePath,
          startLine: finding.startLine || 1,
          endLine: finding.endLine || undefined,
          snippet: finding.snippet || undefined,
          cweId: finding.cweId || undefined,
        },
        fileContent,
      });

      if (!result || !result.fixedCode) {
        return null;
      }

      // Store the generated fix for future use
      await this.prisma.finding.update({
        where: { id: finding.id },
        data: {
          autoFix: result.fixedCode,
          aiRemediation: result.explanation,
        },
      });

      this.logger.log(`Generated auto-fix for finding ${finding.id} with confidence ${result.confidence}`);
      return result.fixedCode;
    } catch (error) {
      this.logger.error(`Failed to generate auto-fix for finding ${finding.id}:`, error);
      return null;
    }
  }

  /**
   * AI triage all findings for a scan
   */
  async triageAll(scanId: string): Promise<TriageResult> {
    const findings = await this.prisma.finding.findMany({
      where: {
        scanId,
        aiTriagedAt: null,
      },
    });

    if (findings.length === 0) {
      return {
        success: false,
      };
    }

    let truePositives = 0;
    let falsePositives = 0;

    for (const finding of findings) {
      try {
        const result = await this.triage(finding.id, false);
        if (result.success) {
          if (result.falsePositive) {
            falsePositives++;
          } else {
            truePositives++;
          }
        }
      } catch {
        // Continue with next finding
      }
    }

    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        repository: {
          include: {
            connection: true,
          },
        },
      },
    });

    // Post summary to PR
    if (scan?.pullRequestId && scan.repository?.connection) {
      const { repository } = scan;
      const { connection } = repository;
      const [owner, repo] = repository.fullName.split('/');

      const summary = `**AI Triage Complete**

| Verdict | Count |
|---------|-------|
| True Positives | ${truePositives} |
| Likely False Positives | ${falsePositives} |

[View Full Triage Results](${process.env.DASHBOARD_URL || 'http://localhost:3000'}/dashboard/scans/${scanId})`;

      if (connection.provider === 'github') {
        await this.githubProvider.createPRComment(
          connection.accessToken,
          owner,
          repo,
          parseInt(scan.pullRequestId),
          summary,
        );
      }
    }

    return {
      success: true,
      redirectUrl: scan?.pullRequestUrl || undefined,
    };
  }
}
