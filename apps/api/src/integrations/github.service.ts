import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';

interface Finding {
  id: string;
  severity: string;
  title: string;
  description?: string;
  filePath: string;
  startLine?: number;
  endLine?: number;
  cweIds?: string[];
  cveIds?: string[];
  remediation?: string;
}

interface PRCommentOptions {
  prNumber: number;
  repoFullName: string;
  comment: string;
  accessToken: string;
}

interface InlineCommentOptions {
  prNumber: number;
  repoFullName: string;
  commitSha: string;
  findings: Finding[];
  accessToken: string;
}

interface CommitStatusOptions {
  sha: string;
  repoFullName: string;
  state: 'pending' | 'success' | 'failure' | 'error';
  description: string;
  targetUrl?: string;
  context?: string;
  accessToken: string;
}

interface ScanSummary {
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  scanUrl?: string;
  duration?: number;
}

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);

  constructor() {}

  /**
   * Create an Octokit instance with the provided access token
   */
  private getOctokit(accessToken: string): Octokit {
    return new Octokit({ auth: accessToken });
  }

  /**
   * Post a summary comment on a PR
   */
  async postPRComment(options: PRCommentOptions): Promise<void> {
    const { prNumber, repoFullName, comment, accessToken } = options;
    const [owner, repo] = repoFullName.split('/');

    try {
      const octokit = this.getOctokit(accessToken);

      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: comment,
      });

      this.logger.log(`Posted comment to ${repoFullName} PR#${prNumber}`);
    } catch (error) {
      this.logger.error(`Failed to post PR comment: ${error}`);
      throw error;
    }
  }

  /**
   * Post inline comments on specific lines in a PR
   */
  async postInlineComments(options: InlineCommentOptions): Promise<void> {
    const { prNumber, repoFullName, commitSha, findings, accessToken } = options;
    const [owner, repo] = repoFullName.split('/');

    try {
      const octokit = this.getOctokit(accessToken);

      // Get the PR to validate it exists (diff mapping reserved for future use)
      await octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      // Post review with inline comments
      const comments = findings
        .filter(f => f.filePath && f.startLine)
        .map(finding => ({
          path: finding.filePath.replace(/^\//, ''), // Remove leading slash
          line: finding.startLine || 1,
          body: this.formatInlineComment(finding),
        }));

      if (comments.length === 0) {
        this.logger.log('No inline comments to post (no line numbers available)');
        return;
      }

      // Split into batches of 50 (GitHub limit)
      const batchSize = 50;
      for (let i = 0; i < comments.length; i += batchSize) {
        const batch = comments.slice(i, i + batchSize);

        await octokit.pulls.createReview({
          owner,
          repo,
          pull_number: prNumber,
          commit_id: commitSha,
          event: 'COMMENT',
          comments: batch,
        });
      }

      this.logger.log(`Posted ${comments.length} inline comments to ${repoFullName} PR#${prNumber}`);
    } catch (error) {
      this.logger.error(`Failed to post inline comments: ${error}`);
      throw error;
    }
  }

  /**
   * Update commit status (check run)
   */
  async updateCommitStatus(options: CommitStatusOptions): Promise<void> {
    const { sha, repoFullName, state, description, targetUrl, context, accessToken } = options;
    const [owner, repo] = repoFullName.split('/');

    try {
      const octokit = this.getOctokit(accessToken);

      await octokit.repos.createCommitStatus({
        owner,
        repo,
        sha,
        state,
        description: description.substring(0, 140), // GitHub limit
        target_url: targetUrl,
        context: context || 'ThreatDiviner Security Scan',
      });

      this.logger.log(`Updated commit status for ${sha.substring(0, 7)}: ${state}`);
    } catch (error) {
      this.logger.error(`Failed to update commit status: ${error}`);
      throw error;
    }
  }

  /**
   * Post scan results to a PR (summary + inline comments if enabled)
   */
  async postScanResults(
    repoFullName: string,
    prNumber: number,
    commitSha: string,
    summary: ScanSummary,
    findings: Finding[],
    accessToken: string,
    options: {
      inlineComments?: boolean;
      blockSeverity?: string | null;
    } = {},
  ): Promise<void> {
    const { inlineComments = true, blockSeverity = null } = options;

    // Post summary comment
    const summaryComment = this.formatSummaryComment(summary, findings);
    await this.postPRComment({
      prNumber,
      repoFullName,
      comment: summaryComment,
      accessToken,
    });

    // Post inline comments if enabled
    if (inlineComments && findings.length > 0) {
      await this.postInlineComments({
        prNumber,
        repoFullName,
        commitSha,
        findings: findings.filter(f => f.startLine), // Only those with line numbers
        accessToken,
      });
    }

    // Update commit status
    const shouldBlock = this.shouldBlockMerge(summary, blockSeverity);
    await this.updateCommitStatus({
      sha: commitSha,
      repoFullName,
      state: shouldBlock ? 'failure' : 'success',
      description: shouldBlock
        ? `Security scan failed: ${summary.criticalCount} critical, ${summary.highCount} high findings`
        : `Security scan passed: ${summary.totalFindings} findings`,
      targetUrl: summary.scanUrl,
      accessToken,
    });
  }

  // ============ Formatting Helpers ============

  private formatSummaryComment(summary: ScanSummary, findings: Finding[]): string {
    const severityEmoji = (sev: string) => {
      switch (sev.toLowerCase()) {
        case 'critical': return ':red_circle:';
        case 'high': return ':orange_circle:';
        case 'medium': return ':yellow_circle:';
        case 'low': return ':blue_circle:';
        default: return ':white_circle:';
      }
    };

    let comment = '## :shield: ThreatDiviner Security Scan Results\n\n';

    // Summary table
    comment += '### Summary\n\n';
    comment += '| Severity | Count |\n';
    comment += '|----------|-------|\n';
    comment += `| ${severityEmoji('critical')} Critical | ${summary.criticalCount} |\n`;
    comment += `| ${severityEmoji('high')} High | ${summary.highCount} |\n`;
    comment += `| ${severityEmoji('medium')} Medium | ${summary.mediumCount} |\n`;
    comment += `| ${severityEmoji('low')} Low | ${summary.lowCount} |\n`;
    comment += `| ${severityEmoji('info')} Info | ${summary.infoCount} |\n`;
    comment += `| **Total** | **${summary.totalFindings}** |\n\n`;

    // Duration if available
    if (summary.duration) {
      comment += `*Scan completed in ${Math.round(summary.duration / 1000)}s*\n\n`;
    }

    // Top findings (limit to 10)
    if (findings.length > 0) {
      comment += '### Top Findings\n\n';

      const topFindings = findings
        .sort((a, b) => {
          const order = ['critical', 'high', 'medium', 'low', 'info'];
          return order.indexOf(a.severity.toLowerCase()) - order.indexOf(b.severity.toLowerCase());
        })
        .slice(0, 10);

      for (const finding of topFindings) {
        const cve = finding.cveIds?.[0] ? ` (${finding.cveIds[0]})` : '';
        const cwe = finding.cweIds?.[0] ? ` [${finding.cweIds[0]}]` : '';
        const location = finding.startLine
          ? `${finding.filePath}:${finding.startLine}`
          : finding.filePath;

        comment += `- ${severityEmoji(finding.severity)} **${finding.title}**${cve}${cwe}\n`;
        comment += `  - \`${location}\`\n`;
      }

      if (findings.length > 10) {
        comment += `\n*...and ${findings.length - 10} more findings*\n`;
      }
    }

    // Link to full report
    if (summary.scanUrl) {
      comment += `\n:arrow_right: [View Full Report](${summary.scanUrl})\n`;
    }

    comment += '\n---\n*Powered by [ThreatDiviner](https://threatdiviner.io)*';

    return comment;
  }

  private formatInlineComment(finding: Finding): string {
    const severityBadge = (sev: string) => {
      switch (sev.toLowerCase()) {
        case 'critical': return ':red_circle: **CRITICAL**';
        case 'high': return ':orange_circle: **HIGH**';
        case 'medium': return ':yellow_circle: **MEDIUM**';
        case 'low': return ':blue_circle: **LOW**';
        default: return ':white_circle: **INFO**';
      }
    };

    let comment = `${severityBadge(finding.severity)}: ${finding.title}\n\n`;

    if (finding.description) {
      comment += `${finding.description}\n\n`;
    }

    if (finding.cveIds?.length) {
      comment += `**CVE:** ${finding.cveIds.join(', ')}\n`;
    }

    if (finding.cweIds?.length) {
      comment += `**CWE:** ${finding.cweIds.join(', ')}\n`;
    }

    if (finding.remediation) {
      comment += `\n**Remediation:** ${finding.remediation}\n`;
    }

    return comment;
  }

  private shouldBlockMerge(summary: ScanSummary, blockSeverity: string | null): boolean {
    if (!blockSeverity || blockSeverity === 'none') {
      return false;
    }

    switch (blockSeverity.toLowerCase()) {
      case 'critical':
        return summary.criticalCount > 0;
      case 'high':
        return summary.criticalCount > 0 || summary.highCount > 0;
      case 'medium':
        return summary.criticalCount > 0 || summary.highCount > 0 || summary.mediumCount > 0;
      default:
        return false;
    }
  }
}
