import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from './crypto.service';
import { GitHubProvider } from '../providers';

interface Finding {
  id: string;
  severity: string;
  title: string;
  description: string | null;
  ruleId: string;
  filePath: string;
  startLine: number | null;
  endLine: number | null;
  snippet: string | null;
  scanner: string;
  aiRemediation: string | null;
}

@Injectable()
export class PRCommentsService {
  private readonly logger = new Logger(PRCommentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly githubProvider: GitHubProvider,
  ) {}

  /**
   * Post PR inline comments for scan findings
   */
  async postPRComments(scanId: string): Promise<{ posted: number; skipped: number }> {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        repository: {
          include: {
            connection: true,
            scanConfig: true,
          },
        },
        findings: true,
      },
    });

    if (!scan || !scan.pullRequestId) {
      this.logger.debug(`Scan ${scanId} is not a PR scan, skipping comments`);
      return { posted: 0, skipped: 0 };
    }

    const config = scan.repository.scanConfig;
    if (!config?.prCommentsEnabled) {
      this.logger.debug(`PR comments disabled for repo ${scan.repository.fullName}`);
      return { posted: 0, skipped: 0 };
    }

    const connection = scan.repository.connection;
    if (connection.provider !== 'github') {
      this.logger.debug(`PR comments only supported for GitHub, skipping`);
      return { posted: 0, skipped: 0 };
    }

    const accessToken = this.cryptoService.decrypt(connection.accessToken);
    const [owner, repo] = scan.repository.fullName.split('/');
    const prNumber = parseInt(scan.pullRequestId, 10);

    // Get files changed in PR
    let prFiles: string[];
    try {
      const files = await this.githubProvider.getPRFiles(accessToken, owner, repo, prNumber);
      prFiles = files.map(f => f.filename);
    } catch (error) {
      this.logger.error(`Failed to get PR files: ${error}`);
      return { posted: 0, skipped: scan.findings.length };
    }

    // Filter findings to only those in the PR diff and matching severity filter
    const severityFilter = config.prCommentSeverities || ['critical', 'high', 'medium'];
    const maxFindings = config.prCommentMaxFindings || 20;

    const eligibleFindings = scan.findings.filter(f => {
      // Must be in a file that was changed in the PR
      const isInDiff = prFiles.some(file => f.filePath.endsWith(file) || file.endsWith(f.filePath));
      // Must match severity filter
      const matchesSeverity = severityFilter.includes(f.severity.toLowerCase());
      return isInDiff && matchesSeverity;
    });

    // Limit to max findings
    const findingsToComment = eligibleFindings.slice(0, maxFindings);
    const skipped = eligibleFindings.length - findingsToComment.length;

    let posted = 0;

    // Group findings by file for batch commenting
    const findingsByFile = new Map<string, Finding[]>();
    for (const finding of findingsToComment) {
      const existing = findingsByFile.get(finding.filePath) || [];
      existing.push(finding);
      findingsByFile.set(finding.filePath, existing);
    }

    // Post comments for each file
    for (const [filePath, findings] of findingsByFile) {
      // Find the matching PR file path
      const prFilePath = prFiles.find(f => filePath.endsWith(f) || f.endsWith(filePath));
      if (!prFilePath) continue;

      for (const finding of findings) {
        try {
          const commentBody = this.formatFindingComment(finding);
          const line = finding.startLine || 1;

          await this.githubProvider.createPRReviewComment(
            accessToken,
            owner,
            repo,
            prNumber,
            scan.commitSha,
            prFilePath,
            line,
            commentBody,
          );
          posted++;
        } catch (error) {
          this.logger.warn(`Failed to post comment for finding ${finding.id}: ${error}`);
        }
      }
    }

    // Post summary comment if there are findings
    if (eligibleFindings.length > 0) {
      try {
        const summaryBody = this.formatSummaryComment(eligibleFindings, skipped);
        await this.githubProvider.createPRComment(accessToken, owner, repo, prNumber, summaryBody);
      } catch (error) {
        this.logger.warn(`Failed to post summary comment: ${error}`);
      }
    }

    return { posted, skipped };
  }

  /**
   * Update check run with annotations for all findings
   * For PR scans: includes annotations (they link correctly) - batched in chunks of 50
   * For non-PR scans: skip annotations (they don't link correctly), use enhanced summary with direct links
   */
  async updateCheckRunWithAnnotations(
    scanId: string,
    checkRunId: string,
  ): Promise<void> {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        repository: {
          include: {
            connection: true,
          },
        },
        findings: true,
      },
    });

    if (!scan) {
      this.logger.error(`Scan ${scanId} not found`);
      return;
    }

    const connection = scan.repository.connection;
    if (connection.provider !== 'github') {
      return;
    }

    const accessToken = this.cryptoService.decrypt(connection.accessToken);
    const [owner, repo] = scan.repository.fullName.split('/');
    const isPRScan = !!scan.pullRequestId;

    // Sort findings by severity (critical > high > medium > low > info)
    const sortedFindings = this.sortFindingsBySeverity(scan.findings);

    // Determine conclusion based on findings
    const hasCritical = scan.findings.some(f => f.severity === 'critical');
    const hasHigh = scan.findings.some(f => f.severity === 'high');
    let conclusion: 'success' | 'failure' | 'neutral' = 'success';
    if (hasCritical) conclusion = 'failure';
    else if (hasHigh) conclusion = 'failure';
    else if (scan.findings.length > 0) conclusion = 'neutral';

    // Build summary - for non-PR scans, include direct links to files
    const summary = isPRScan
      ? this.buildCheckRunSummary(scan.findings)
      : this.buildCheckRunSummaryWithLinks(sortedFindings, owner, repo, scan.commitSha);

    try {
      if (isPRScan && sortedFindings.length > 0) {
        // Build all annotations, prioritized by severity
        const allAnnotations = sortedFindings.map(f => ({
          path: f.filePath,
          start_line: f.startLine || 1,
          end_line: f.endLine || f.startLine || 1,
          annotation_level: this.mapSeverityToAnnotationLevel(f.severity),
          title: f.ruleId,
          message: f.title || f.description || 'Security finding',
          raw_details: f.snippet || undefined,
        }));

        // GitHub API limits to 50 annotations per request, batch them
        const BATCH_SIZE = 50;
        const batches: typeof allAnnotations[] = [];
        for (let i = 0; i < allAnnotations.length; i += BATCH_SIZE) {
          batches.push(allAnnotations.slice(i, i + BATCH_SIZE));
        }

        this.logger.log(`Posting ${allAnnotations.length} annotations in ${batches.length} batch(es)`);

        // Post each batch - first batch includes summary, subsequent are append-only
        for (let i = 0; i < batches.length; i++) {
          const isLastBatch = i === batches.length - 1;
          const batch = batches[i];

          await this.githubProvider.updateCheckRunWithAnnotations(
            accessToken,
            owner,
            repo,
            checkRunId,
            isLastBatch ? 'completed' : 'in_progress',
            isLastBatch ? conclusion : undefined,
            {
              title: 'ThreatDiviner Security Scan',
              summary, // GitHub overwrites summary each update, but it's required
              annotations: batch,
            },
          );

          // Small delay between batches to avoid rate limiting
          if (!isLastBatch) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } else {
        // Non-PR scan or no findings - single update with summary only
        await this.githubProvider.updateCheckRunWithAnnotations(
          accessToken,
          owner,
          repo,
          checkRunId,
          'completed',
          conclusion,
          {
            title: 'ThreatDiviner Security Scan',
            summary,
            annotations: undefined,
          },
        );
      }
    } catch (error) {
      this.logger.error(`Failed to update check run with annotations: ${error}`);
    }
  }

  /**
   * Sort findings by severity priority: critical > high > medium > low > info
   */
  private sortFindingsBySeverity(findings: Finding[]): Finding[] {
    const severityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4,
    };

    return [...findings].sort((a, b) => {
      const orderA = severityOrder[a.severity.toLowerCase()] ?? 5;
      const orderB = severityOrder[b.severity.toLowerCase()] ?? 5;
      return orderA - orderB;
    });
  }

  private formatFindingComment(finding: Finding): string {
    const severityEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵',
      info: '⚪',
    };

    const emoji = severityEmoji[finding.severity.toLowerCase() as keyof typeof severityEmoji] || '⚪';

    const lines = [
      `${emoji} **${finding.severity.toUpperCase()}** - ${finding.title}`,
      '',
      `**Scanner:** ${finding.scanner}`,
      `**Rule:** \`${finding.ruleId}\``,
    ];

    if (finding.description) {
      lines.push('', finding.description);
    }

    if (finding.aiRemediation) {
      lines.push('', '**Suggested Fix:**', finding.aiRemediation);
    }

    lines.push('', '---', '*🔍 Detected by ThreatDiviner*');

    return lines.join('\n');
  }

  private formatSummaryComment(findings: Finding[], skipped: number): string {
    const counts = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
    };

    const lines = [
      '## 🔍 ThreatDiviner Security Scan Summary',
      '',
      '| Severity | Count |',
      '|----------|-------|',
      `| 🔴 Critical | ${counts.critical} |`,
      `| 🟠 High | ${counts.high} |`,
      `| 🟡 Medium | ${counts.medium} |`,
      `| 🔵 Low | ${counts.low} |`,
      '',
      `**Total findings in this PR:** ${findings.length}`,
    ];

    if (skipped > 0) {
      lines.push(`*${skipped} additional findings not shown (limit reached)*`);
    }

    lines.push('', '---', '*See inline comments for details on each finding.*');

    return lines.join('\n');
  }

  private buildCheckRunSummary(findings: Finding[]): string {
    if (findings.length === 0) {
      return '✅ No security issues found!';
    }

    const counts = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
    };

    return `Found ${findings.length} security issues:\n- Critical: ${counts.critical}\n- High: ${counts.high}\n- Medium: ${counts.medium}\n- Low: ${counts.low}`;
  }

  /**
   * Build check run summary with direct file links (for non-PR scans)
   * Since annotations don't link correctly for non-PR scans, we include direct links in the summary
   */
  private buildCheckRunSummaryWithLinks(
    sortedFindings: Finding[],
    owner: string,
    repo: string,
    commitSha: string,
  ): string {
    if (sortedFindings.length === 0) {
      return '✅ No security issues found!';
    }

    const counts = {
      critical: sortedFindings.filter(f => f.severity === 'critical').length,
      high: sortedFindings.filter(f => f.severity === 'high').length,
      medium: sortedFindings.filter(f => f.severity === 'medium').length,
      low: sortedFindings.filter(f => f.severity === 'low').length,
    };

    const severityEmoji: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵',
      info: '⚪',
    };

    const lines = [
      `Found **${sortedFindings.length}** security issues:`,
      '',
      '| Severity | Count |',
      '|----------|-------|',
      `| 🔴 Critical | ${counts.critical} |`,
      `| 🟠 High | ${counts.high} |`,
      `| 🟡 Medium | ${counts.medium} |`,
      `| 🔵 Low | ${counts.low} |`,
      '',
      '---',
      '',
      '### Top Findings (by severity)',
      '',
    ];

    // Show top 50 findings with direct links, prioritized by severity
    const topFindings = sortedFindings.slice(0, 50);
    for (const finding of topFindings) {
      const emoji = severityEmoji[finding.severity.toLowerCase()] || '⚪';
      const line = finding.startLine || 1;
      const fileUrl = `https://github.com/${owner}/${repo}/blob/${commitSha}/${finding.filePath}#L${line}`;
      lines.push(
        `- ${emoji} **${finding.severity.toUpperCase()}** - [${finding.filePath}:${line}](${fileUrl})`,
        `  - \`${finding.ruleId}\`: ${finding.title || 'Security finding'}`,
      );
    }

    if (sortedFindings.length > 50) {
      lines.push('', `*... and ${sortedFindings.length - 50} more findings*`);
    }

    return lines.join('\n');
  }

  private mapSeverityToAnnotationLevel(
    severity: string,
  ): 'notice' | 'warning' | 'failure' {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'failure';
      case 'medium':
        return 'warning';
      default:
        return 'notice';
    }
  }
}
