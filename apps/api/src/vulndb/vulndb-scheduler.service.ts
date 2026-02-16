import { Injectable, Logger } from '@nestjs/common';
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
export class VulnDbSchedulerService {
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
    this.enableScheduledSync = this.configService.get<boolean>('VULNDB_SCHEDULED_SYNC', true);
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
   * Daily CVE sync at 1 PM (dev schedule)
   * Syncs CVEs modified in the last 7 days
   */
  @Cron('0 13 * * *')
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
   * Daily EPSS sync at 1:05 PM (dev schedule)
   */
  @Cron('5 13 * * *')
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
   * Daily KEV sync at 1:10 PM (dev schedule)
   */
  @Cron('10 13 * * *')
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
   * Daily CWE sync at 1:15 PM (dev schedule)
   */
  @Cron('15 13 * * *')
  async syncCweDaily(): Promise<void> {
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
   * Daily ATT&CK sync at 1:20 PM (dev schedule)
   */
  @Cron('20 13 * * *')
  async syncAttackDaily(): Promise<void> {
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
   * Daily OWASP sync at 1:25 PM (dev schedule)
   */
  @Cron('25 13 * * *')
  async syncOwaspDaily(): Promise<void> {
    if (!this.enableScheduledSync) return;

    this.logger.log('Starting OWASP sync...');
    try {
      const result = await this.owaspSyncService.sync();
      this.logger.log(`OWASP sync complete: ${result.processed} categories`);
    } catch (error) {
      this.logger.error('OWASP sync failed:', error);
    }
  }

  /**
   * Daily CWE-Mapping sync at 1:30 PM (dev schedule)
   */
  @Cron('30 13 * * *')
  async syncCweMappingDaily(): Promise<void> {
    if (!this.enableScheduledSync) return;

    this.logger.log('Starting CWE-Mapping sync...');
    try {
      const result = await this.cweMappingSyncService.sync();
      this.logger.log(`CWE-Mapping sync complete: ${result.processed} mappings`);
    } catch (error) {
      this.logger.error('CWE-Mapping sync failed:', error);
    }
  }

  /**
   * Full CVE sync at 1:35 PM (dev schedule - resource intensive)
   */
  @Cron('35 13 * * *')
  async syncCvesFull(): Promise<void> {
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
