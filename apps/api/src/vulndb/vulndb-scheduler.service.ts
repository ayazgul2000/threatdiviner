import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import {
  NvdSyncService,
  CweSyncService,
  EpssSyncService,
  KevSyncService,
  OwaspSyncService,
  CweMappingSyncService,
  AttackSyncService,
} from './sync';

@Injectable()
export class VulnDbSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(VulnDbSchedulerService.name);
  private readonly enableScheduledSync: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly nvdSyncService: NvdSyncService,
    private readonly cweSyncService: CweSyncService,
    private readonly epssSyncService: EpssSyncService,
    private readonly kevSyncService: KevSyncService,
    private readonly owaspSyncService: OwaspSyncService,
    private readonly cweMappingSyncService: CweMappingSyncService,
    private readonly attackSyncService: AttackSyncService,
  ) {
    this.enableScheduledSync = this.configService.get<boolean>('VULNDB_SCHEDULED_SYNC', false);
  }

  async onModuleInit() {
    // Check if initial data load is needed
    const shouldInitialize = this.configService.get<boolean>('VULNDB_INITIAL_LOAD', false);
    if (shouldInitialize) {
      this.logger.log('Starting initial VulnDB data load...');
      await this.initialLoad();
    }
  }

  /**
   * Initial data load - run on first deployment or when requested
   * Order matters: CWEs first, then mappings, then CVEs
   */
  async initialLoad(): Promise<void> {
    this.logger.log('Starting initial vulnerability database load...');
    const results: Record<string, any> = {};

    try {
      this.logger.log('Loading OWASP Top 10...');
      results.owasp = await this.owaspSyncService.sync();
    } catch (error) {
      this.logger.error('Failed to load OWASP:', error);
      results.owasp = { error: error instanceof Error ? error.message : 'Unknown' };
    }

    try {
      this.logger.log('Loading CWE mappings...');
      results.cweMapping = await this.cweMappingSyncService.sync();
    } catch (error) {
      this.logger.error('Failed to load CWE mappings:', error);
      results.cweMapping = { error: error instanceof Error ? error.message : 'Unknown' };
    }

    try {
      this.logger.log('Loading CISA KEV catalog...');
      results.kev = await this.kevSyncService.sync();
    } catch (error) {
      this.logger.error('Failed to load KEV:', error);
      results.kev = { error: error instanceof Error ? error.message : 'Unknown' };
    }

    try {
      this.logger.log('Loading MITRE ATT&CK data...');
      results.attack = await this.attackSyncService.sync();
    } catch (error) {
      this.logger.error('Failed to load ATT&CK:', error);
      results.attack = { error: error instanceof Error ? error.message : 'Unknown' };
    }

    // Note: Full CWE and NVD syncs are resource-intensive
    // They should be run separately or in batches
    this.logger.log('Initial load complete. Results:', results);
    this.logger.log('Note: Full CWE and NVD syncs should be triggered manually due to size.');
  }

  /**
   * Daily CVE sync at 2 AM UTC
   * Syncs CVEs modified in the last 7 days
   */
  @Cron('0 2 * * *')
  async syncCvesDaily(): Promise<void> {
    if (!this.enableScheduledSync) return;

    this.logger.log('Starting daily CVE sync (last 7 days)...');
    try {
      const result = await this.nvdSyncService.syncRecent(7);
      this.logger.log(`Daily CVE sync complete: ${result.processed} processed, ${result.errors} errors`);
    } catch (error) {
      this.logger.error('Daily CVE sync failed:', error);
    }
  }

  /**
   * Daily EPSS sync at 3 AM UTC
   */
  @Cron('0 3 * * *')
  async syncEpssDaily(): Promise<void> {
    if (!this.enableScheduledSync) return;

    this.logger.log('Starting daily EPSS sync...');
    try {
      const result = await this.epssSyncService.sync();
      this.logger.log(`Daily EPSS sync complete: ${result.processed} processed`);
    } catch (error) {
      this.logger.error('Daily EPSS sync failed:', error);
    }
  }

  /**
   * Daily KEV sync at 4 AM UTC
   */
  @Cron('0 4 * * *')
  async syncKevDaily(): Promise<void> {
    if (!this.enableScheduledSync) return;

    this.logger.log('Starting daily KEV sync...');
    try {
      const result = await this.kevSyncService.sync();
      this.logger.log(`Daily KEV sync complete: ${result.processed} processed`);
    } catch (error) {
      this.logger.error('Daily KEV sync failed:', error);
    }
  }

  /**
   * Weekly CWE sync on Sunday at 1 AM UTC
   */
  @Cron('0 1 * * 0')
  async syncCweWeekly(): Promise<void> {
    if (!this.enableScheduledSync) return;

    this.logger.log('Starting weekly CWE sync...');
    try {
      const result = await this.cweSyncService.sync();
      this.logger.log(`Weekly CWE sync complete: ${result.processed} processed`);
    } catch (error) {
      this.logger.error('Weekly CWE sync failed:', error);
    }
  }

  /**
   * Weekly ATT&CK sync on Sunday at 5 AM UTC
   */
  @Cron('0 5 * * 0')
  async syncAttackWeekly(): Promise<void> {
    if (!this.enableScheduledSync) return;

    this.logger.log('Starting weekly ATT&CK sync...');
    try {
      const result = await this.attackSyncService.sync();
      this.logger.log(`Weekly ATT&CK sync complete: ${result.tactics} tactics, ${result.techniques} techniques`);
    } catch (error) {
      this.logger.error('Weekly ATT&CK sync failed:', error);
    }
  }

  /**
   * Monthly full CVE sync on the 1st at midnight UTC
   * This is resource-intensive and takes a long time
   */
  @Cron('0 0 1 * *')
  async syncCvesMonthly(): Promise<void> {
    if (!this.enableScheduledSync) return;

    this.logger.log('Starting monthly full CVE sync...');
    try {
      const result = await this.nvdSyncService.syncAll();
      this.logger.log(`Monthly CVE sync complete: ${result.processed} processed, ${result.errors} errors`);
    } catch (error) {
      this.logger.error('Monthly CVE sync failed:', error);
    }
  }
}
