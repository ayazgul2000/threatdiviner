import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../../scm/services/crypto.service';
import { GitHubProvider } from '../../scm/providers';
import { QUEUE_NAMES } from '../queue.constants';
import { NotifyJobData } from '../jobs';
import { BULL_CONNECTION } from '../custom-bull.module';

@Injectable()
export class NotifyProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotifyProcessor.name);
  private worker: Worker | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly githubProvider: GitHubProvider,
    @Inject(BULL_CONNECTION) private readonly connection: { host: string; port: number },
  ) {}

  async onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.NOTIFY,
      async (job: Job<NotifyJobData>) => this.process(job),
      { connection: this.connection },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Notify job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Notify job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('Notify worker started');
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('Notify worker stopped');
    }
  }

  async process(job: Job<NotifyJobData>): Promise<void> {
    const { scanId, connectionId, fullName, checkRunId, findingsCount, status } = job.data;

    this.logger.log(`Processing notification for scan ${scanId}`);

    try {
      const connection = await this.prisma.scmConnection.findUnique({
        where: { id: connectionId },
      });

      if (!connection) {
        throw new Error('Connection not found');
      }

      const accessToken = this.cryptoService.decrypt(connection.accessToken);
      const [owner, repo] = fullName.split('/');

      // Get top findings for the summary
      const topFindings = await this.prisma.finding.findMany({
        where: { scanId },
        orderBy: [
          { severity: 'asc' }, // critical first (alphabetically)
          { createdAt: 'desc' },
        ],
        take: 10,
      });

      // Build summary markdown
      const summary = this.buildSummary(job.data, topFindings);

      // Update check run with final results
      if (checkRunId) {
        const conclusion = this.mapStatusToConclusion(status);

        await this.githubProvider.updateCheckRun(
          accessToken,
          owner,
          repo,
          checkRunId,
          'completed',
          conclusion,
          {
            title: this.getTitle(status, findingsCount),
            summary,
          },
        );

        this.logger.log(`Updated check run ${checkRunId} with conclusion: ${conclusion}`);
      }

    } catch (error) {
      this.logger.error(`Failed to send notification for scan ${scanId}: ${error}`);
      throw error;
    }
  }

  private buildSummary(data: NotifyJobData, findings: any[]): string {
    const { findingsCount, scanDuration, commitSha } = data;
    const total = Object.values(findingsCount).reduce((a, b) => a + b, 0);
    const durationSec = Math.round(scanDuration / 1000);

    let md = `## ThreatDiviner Security Scan\n\n`;
    md += `**Commit:** \`${commitSha.slice(0, 7)}\`\n`;
    md += `**Duration:** ${durationSec} seconds\n\n`;

    if (total === 0) {
      md += `### No security issues found\n\n`;
      md += `Great job! The scan completed without finding any security vulnerabilities.\n`;
    } else {
      md += `### Findings Summary\n\n`;
      md += `| Severity | Count |\n`;
      md += `|----------|-------|\n`;

      if (findingsCount.critical > 0) {
        md += `| Critical | ${findingsCount.critical} |\n`;
      }
      if (findingsCount.high > 0) {
        md += `| High | ${findingsCount.high} |\n`;
      }
      if (findingsCount.medium > 0) {
        md += `| Medium | ${findingsCount.medium} |\n`;
      }
      if (findingsCount.low > 0) {
        md += `| Low | ${findingsCount.low} |\n`;
      }
      if (findingsCount.info > 0) {
        md += `| Info | ${findingsCount.info} |\n`;
      }

      // Show critical/high findings
      const criticalHighFindings = findings.filter(
        (f) => f.severity === 'critical' || f.severity === 'high',
      );

      if (criticalHighFindings.length > 0) {
        md += `\n### Critical & High Severity Findings\n\n`;

        for (const finding of criticalHighFindings.slice(0, 5)) {
          const severity = finding.severity === 'critical' ? 'CRITICAL' : 'HIGH';
          md += `- **[${severity}]** ${finding.title} in \`${finding.filePath}:${finding.startLine}\`\n`;
        }

        if (criticalHighFindings.length > 5) {
          md += `\n*...and ${criticalHighFindings.length - 5} more critical/high findings*\n`;
        }
      }
    }

    md += `\n---\n`;
    md += `*Scanned by [ThreatDiviner](https://threatdiviner.com)*\n`;

    return md;
  }

  private getTitle(status: string, counts: NotifyJobData['findingsCount']): string {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    if (total === 0) {
      return 'No security issues found';
    }

    if (status === 'failure') {
      return `Found ${counts.critical} critical, ${counts.high} high severity issues`;
    }

    return `Found ${total} security issue(s)`;
  }

  private mapStatusToConclusion(
    status: 'success' | 'failure' | 'neutral',
  ): 'success' | 'failure' | 'neutral' {
    return status;
  }
}
