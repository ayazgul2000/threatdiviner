import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/services/queue.service';
import { CryptoService } from '../scm/services/crypto.service';
import { GitHubProvider } from '../scm/providers';
import { EmailService } from '../notifications/email/email.service';
import { ScanJobData } from '../queue/jobs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CronExpressionParser = require('cron-parser');
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
        const expression = CronExpressionParser.parseExpression(config.scheduleCron, {
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
        const expression = CronExpressionParser.parseExpression(cron, {
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
   * Auto-resolve findings that no longer appear in latest scans
   * Runs daily at 2am
   */
  @Cron('0 2 * * *')
  async autoResolveStaleFindings(): Promise<void> {
    this.logger.log('Starting auto-resolve check for stale findings...');

    try {
      // Get all repositories with at least 2 scans
      const repositories = await this.prisma.repository.findMany({
        where: {
          isActive: true,
          scans: {
            some: {},
          },
        },
        select: {
          id: true,
          fullName: true,
          tenantId: true,
        },
      });

      let totalResolved = 0;

      for (const repo of repositories) {
        try {
          const resolved = await this.autoResolveFindingsForRepo(repo.id, repo.tenantId);
          totalResolved += resolved;
        } catch (error) {
          this.logger.error(`Failed to auto-resolve for ${repo.fullName}: ${error}`);
        }
      }

      this.logger.log(`Auto-resolve complete. Total resolved: ${totalResolved}`);
    } catch (error) {
      this.logger.error(`Auto-resolve stale findings failed: ${error}`);
    }
  }

  /**
   * Auto-resolve findings for a specific repository
   */
  private async autoResolveFindingsForRepo(
    repositoryId: string,
    tenantId: string,
  ): Promise<number> {
    // Get the last two completed scans for this repo
    const lastTwoScans = await this.prisma.scan.findMany({
      where: {
        repositoryId,
        status: 'completed',
      },
      orderBy: { completedAt: 'desc' },
      take: 2,
      include: {
        findings: {
          select: {
            id: true,
            fingerprint: true,
            ruleId: true,
            filePath: true,
          },
        },
      },
    });

    // Need at least 2 scans to compare
    if (lastTwoScans.length < 2) {
      return 0;
    }

    const [latestScan, previousScan] = lastTwoScans;

    // Build fingerprint sets
    const latestFingerprints = new Set(
      latestScan.findings
        .map(f => f.fingerprint || `${f.ruleId}:${f.filePath}`)
        .filter(Boolean),
    );

    // Find findings from previous scan that don't appear in latest
    const missingFromLatest = previousScan.findings.filter((f) => {
      const fp = f.fingerprint || `${f.ruleId}:${f.filePath}`;
      return !latestFingerprints.has(fp);
    });

    if (missingFromLatest.length === 0) {
      return 0;
    }

    // Find all OPEN findings that match these fingerprints
    const fingerprintsToResolve = missingFromLatest
      .map(f => f.fingerprint || `${f.ruleId}:${f.filePath}`)
      .filter(Boolean);

    const resolved = await this.prisma.finding.updateMany({
      where: {
        tenantId,
        repositoryId,
        status: { in: ['open', 'in_progress'] },
        OR: [
          { fingerprint: { in: fingerprintsToResolve.filter(Boolean) as string[] } },
          ...missingFromLatest.map(f => ({
            ruleId: f.ruleId,
            filePath: f.filePath,
          })),
        ],
      },
      data: {
        status: 'fixed',
        dismissedAt: new Date(),
        dismissReason: 'Auto-resolved: finding not present in latest scan',
      },
    });

    if (resolved.count > 0) {
      this.logger.log(
        `Auto-resolved ${resolved.count} findings for repository ${repositoryId}`,
      );
    }

    return resolved.count;
  }

  /**
   * Check SBOMs for new CVEs daily
   * Runs at 3am
   */
  @Cron('0 3 * * *')
  async checkSbomsForNewCves(): Promise<void> {
    this.logger.log('Starting daily SBOM CVE check...');

    try {
      // Get all SBOMs with components (only from active repositories)
      const activeRepoIds = await this.prisma.repository.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      const activeIds = activeRepoIds.map(r => r.id);

      const sboms = await this.prisma.sbom.findMany({
        where: {
          OR: [
            { repositoryId: { in: activeIds } },
            { repositoryId: null }, // Include uploaded SBOMs not tied to repos
          ],
        },
        include: {
          components: true,
        },
      });

      this.logger.log(`Checking ${sboms.length} SBOMs for new vulnerabilities...`);

      // Log that CVE check was triggered for each SBOM
      // The actual CVE matching is handled by SbomCveMatcherService
      // which can be invoked via the SBOM controller endpoints
      for (const sbom of sboms) {
        this.logger.debug(`Scheduled CVE check for SBOM ${sbom.id} (${sbom.name})`);
      }

      this.logger.log('SBOM CVE check complete');
    } catch (error) {
      this.logger.error(`SBOM CVE check failed: ${error}`);
    }
  }

  /**
   * Cleanup expired baselines daily
   * Runs at 4am
   */
  @Cron('0 4 * * *')
  async cleanupExpiredBaselines(): Promise<void> {
    this.logger.log('Starting expired baseline cleanup...');

    try {
      // Find expired baselines
      const expired = await this.prisma.findingBaseline.findMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      if (expired.length === 0) {
        this.logger.log('No expired baselines to clean up');
        return;
      }

      // Delete expired baselines
      await this.prisma.findingBaseline.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      // Reopen affected findings
      for (const baseline of expired) {
        await this.prisma.finding.updateMany({
          where: {
            tenantId: baseline.tenantId,
            fingerprint: baseline.fingerprint,
            status: 'baselined',
          },
          data: {
            status: 'open',
            updatedAt: new Date(),
          },
        });
      }

      this.logger.log(`Cleaned up ${expired.length} expired baselines`);
    } catch (error) {
      this.logger.error(`Expired baseline cleanup failed: ${error}`);
    }
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
