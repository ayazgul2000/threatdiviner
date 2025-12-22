import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/services/queue.service';
import { CryptoService } from '../scm/services/crypto.service';
import { GitHubProvider } from '../scm/providers';
import { EmailService } from '../notifications/email/email.service';
import { ScanJobData } from '../queue/jobs';
import CronExpressionParser from 'cron-parser';
import { SCHEDULE_PRESETS, getPresetFromCron } from './dto/schedule-config.dto';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    @Inject(forwardRef(() => CryptoService))
    private readonly cryptoService: CryptoService,
    @Inject(forwardRef(() => GitHubProvider))
    private readonly githubProvider: GitHubProvider,
    @Inject(forwardRef(() => EmailService))
    private readonly emailService: EmailService,
  ) {}

  /**
   * Check for scheduled scans every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkScheduledScans(): Promise<void> {
    const now = new Date();
    this.logger.debug(`Checking for scheduled scans at ${now.toISOString()}`);

    try {
      // Find all repositories with scheduling enabled and due scans
      const dueConfigs = await this.prisma.scanConfig.findMany({
        where: {
          scheduleEnabled: true,
          scheduleCron: { not: null },
          nextScheduledScan: { lte: now },
        },
        include: {
          repository: {
            include: {
              connection: true,
              tenant: true,
            },
          },
        },
      });

      this.logger.log(`Found ${dueConfigs.length} repositories due for scheduled scan`);

      for (const config of dueConfigs) {
        try {
          await this.triggerScheduledScan(config);
        } catch (error) {
          this.logger.error(
            `Failed to trigger scheduled scan for ${config.repository.fullName}: ${error}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error checking scheduled scans: ${error}`);
    }
  }

  /**
   * Trigger a scheduled scan for a repository
   */
  private async triggerScheduledScan(config: any): Promise<void> {
    const { repository } = config;
    const { connection, tenant } = repository;

    if (!tenant.isActive) {
      this.logger.warn(`Skipping scheduled scan for inactive tenant: ${tenant.slug}`);
      return;
    }

    this.logger.log(`Triggering scheduled scan for ${repository.fullName}`);

    // Get latest commit
    const token = this.cryptoService.decrypt(connection.accessToken);
    const [owner, repoName] = repository.fullName.split('/');

    let commit;
    try {
      commit = await this.githubProvider.getLatestCommit(
        token,
        owner,
        repoName,
        repository.defaultBranch,
      );
    } catch (error) {
      this.logger.error(`Failed to get latest commit for ${repository.fullName}: ${error}`);
      // Still update next scheduled scan to prevent retry loop
      await this.updateNextScheduledScan(config);
      return;
    }

    // Create scan record
    const scan = await this.prisma.scan.create({
      data: {
        tenantId: tenant.id,
        repositoryId: repository.id,
        commitSha: commit.sha,
        branch: repository.defaultBranch,
        triggeredBy: 'scheduled',
        status: 'queued',
      },
    });

    // Build job data
    const jobData: ScanJobData = {
      scanId: scan.id,
      tenantId: tenant.id,
      repositoryId: repository.id,
      connectionId: connection.id,
      commitSha: commit.sha,
      branch: repository.defaultBranch,
      cloneUrl: repository.cloneUrl,
      fullName: repository.fullName,
      config: {
        enableSast: config.enableSast,
        enableSca: config.enableSca,
        enableSecrets: config.enableSecrets,
        enableIac: config.enableIac,
        enableDast: config.enableDast,
        enableContainerScan: config.enableContainerScan,
        targetUrls: config.targetUrls || [],
        containerImages: config.containerImages || [],
        skipPaths: config.skipPaths || [],
        branches: config.branches || [repository.defaultBranch],
      },
    };

    // Queue the scan
    await this.queueService.enqueueScan(jobData);

    // Update last and next scheduled scan times
    await this.updateNextScheduledScan(config);

    this.logger.log(`Scheduled scan ${scan.id} queued for ${repository.fullName}`);
  }

  /**
   * Update the next scheduled scan time
   */
  private async updateNextScheduledScan(config: any): Promise<void> {
    const now = new Date();
    let nextRun: Date | null = null;

    if (config.scheduleCron) {
      try {
        const expression = CronExpressionParser.parse(config.scheduleCron, {
          currentDate: now,
          tz: config.scheduleTimezone || 'UTC',
        });
        nextRun = expression.next().toDate();
      } catch (error) {
        this.logger.error(`Invalid cron expression: ${config.scheduleCron}`);
      }
    }

    await this.prisma.scanConfig.update({
      where: { id: config.id },
      data: {
        lastScheduledScan: now,
        nextScheduledScan: nextRun,
      },
    });
  }

  /**
   * Get schedule configuration for a repository
   */
  async getScheduleConfig(tenantId: string, repositoryId: string) {
    const config = await this.prisma.scanConfig.findFirst({
      where: { tenantId, repositoryId },
      select: {
        scheduleEnabled: true,
        scheduleCron: true,
        scheduleTimezone: true,
        lastScheduledScan: true,
        nextScheduledScan: true,
      },
    });

    if (!config) {
      return {
        scheduleEnabled: false,
        scheduleCron: null,
        scheduleTimezone: 'UTC',
        lastScheduledScan: null,
        nextScheduledScan: null,
        preset: null,
      };
    }

    return {
      ...config,
      preset: getPresetFromCron(config.scheduleCron),
    };
  }

  /**
   * Update schedule configuration for a repository
   */
  async updateScheduleConfig(
    _tenantId: string,
    repositoryId: string,
    data: {
      scheduleEnabled?: boolean;
      scheduleCron?: string;
      scheduleTimezone?: string;
      preset?: 'daily' | 'weekly' | 'monthly' | 'custom';
    },
  ) {
    // Handle preset to cron conversion
    let cron = data.scheduleCron;
    if (data.preset && data.preset !== 'custom') {
      cron = SCHEDULE_PRESETS[data.preset];
    }

    // Calculate next scheduled scan
    let nextScheduledScan: Date | null = null;
    if (data.scheduleEnabled !== false && cron) {
      try {
        const expression = CronExpressionParser.parse(cron, {
          currentDate: new Date(),
          tz: data.scheduleTimezone || 'UTC',
        });
        nextScheduledScan = expression.next().toDate();
      } catch (error) {
        this.logger.error(`Invalid cron expression: ${cron}`);
      }
    }

    const updateData: any = {};
    if (data.scheduleEnabled !== undefined) updateData.scheduleEnabled = data.scheduleEnabled;
    if (cron !== undefined) updateData.scheduleCron = cron;
    if (data.scheduleTimezone !== undefined) updateData.scheduleTimezone = data.scheduleTimezone;
    if (nextScheduledScan !== null || data.scheduleEnabled === false) {
      updateData.nextScheduledScan = data.scheduleEnabled === false ? null : nextScheduledScan;
    }

    const config = await this.prisma.scanConfig.update({
      where: { repositoryId },
      data: updateData,
    });

    return {
      scheduleEnabled: config.scheduleEnabled,
      scheduleCron: config.scheduleCron,
      scheduleTimezone: config.scheduleTimezone,
      lastScheduledScan: config.lastScheduledScan,
      nextScheduledScan: config.nextScheduledScan,
      preset: getPresetFromCron(config.scheduleCron),
    };
  }

  /**
   * Trigger immediate scheduled scan (run now)
   */
  async triggerImmediateScan(tenantId: string, repositoryId: string): Promise<string> {
    const config = await this.prisma.scanConfig.findFirst({
      where: { tenantId, repositoryId },
      include: {
        repository: {
          include: {
            connection: true,
            tenant: true,
          },
        },
      },
    });

    if (!config) {
      throw new Error('Repository not found or no scan config');
    }

    await this.triggerScheduledScan(config);

    // Get the created scan
    const scan = await this.prisma.scan.findFirst({
      where: { repositoryId },
      orderBy: { createdAt: 'desc' },
    });

    return scan?.id || 'unknown';
  }

  /**
   * Send weekly digest emails every Monday at 9am
   */
  @Cron('0 9 * * 1') // Monday 9am
  async sendWeeklyDigests(): Promise<void> {
    this.logger.log('Starting weekly digest processing...');

    try {
      // Get all tenants with weekly digest enabled
      const configs = await this.prisma.notificationConfig.findMany({
        where: {
          weeklyDigestEnabled: true,
          emailEnabled: true,
          emailRecipients: { isEmpty: false },
        },
        include: {
          tenant: true,
        },
      });

      this.logger.log(`Found ${configs.length} tenants with weekly digest enabled`);

      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      for (const config of configs) {
        try {
          await this.sendTenantWeeklyDigest(config.tenantId, config.tenant.name, config.emailRecipients, oneWeekAgo, now);
        } catch (error) {
          this.logger.error(`Failed to send weekly digest for tenant ${config.tenantId}: ${error}`);
        }
      }
    } catch (error) {
      this.logger.error(`Weekly digest processing failed: ${error}`);
    }
  }

  private async sendTenantWeeklyDigest(
    tenantId: string,
    tenantName: string,
    recipients: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    // Get scans from this week
    const scans = await this.prisma.scan.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    // Get new findings from this week
    const newFindings = await this.prisma.finding.groupBy({
      by: ['severity'],
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: true,
    });

    const findingsByCategory = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const f of newFindings) {
      if (f.severity in findingsByCategory) {
        findingsByCategory[f.severity as keyof typeof findingsByCategory] = f._count;
      }
    }

    const totalFindings = findingsByCategory.critical + findingsByCategory.high +
                          findingsByCategory.medium + findingsByCategory.low;

    // Get top 5 repositories by findings count
    const topRepoFindings = await this.prisma.finding.groupBy({
      by: ['scanId'],
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: true,
      orderBy: {
        _count: {
          scanId: 'desc',
        },
      },
      take: 10,
    });

    // Get repository names for top findings
    const topRepositories: Array<{ name: string; findings: number }> = [];
    const repoFindingsMap = new Map<string, number>();

    for (const item of topRepoFindings) {
      const scan = await this.prisma.scan.findUnique({
        where: { id: item.scanId },
        include: { repository: true },
      });
      if (scan?.repository) {
        const existing = repoFindingsMap.get(scan.repository.fullName) || 0;
        repoFindingsMap.set(scan.repository.fullName, existing + item._count);
      }
    }

    // Convert to sorted array
    Array.from(repoFindingsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([name, findings]) => {
        topRepositories.push({ name, findings });
      });

    // Format dates for display
    const formatDate = (d: Date) => d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    // Send the digest email
    await this.emailService.sendWeeklySummary(recipients, {
      tenantName,
      periodStart: formatDate(startDate),
      periodEnd: formatDate(endDate),
      totalScans: scans.length,
      totalFindings,
      findingsByCategory,
      topRepositories,
    });

    this.logger.log(`Sent weekly digest to ${recipients.length} recipients for tenant ${tenantId}`);
  }
}
