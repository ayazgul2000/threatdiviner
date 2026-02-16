import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SemgrepRuleSyncService } from './sast/semgrep/semgrep-rule-sync.service';

@Injectable()
export class ScannerSchedulerService {
  private readonly logger = new Logger(ScannerSchedulerService.name);
  private readonly enableScheduledSync: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly semgrepRuleSyncService: SemgrepRuleSyncService,
  ) {
    this.enableScheduledSync = this.configService.get<boolean>('SEMGREP_RULE_SYNC', true);
  }

  /**
   * Daily Semgrep rule sync at 2 PM (dev schedule)
   * Fetches latest rules from Semgrep public registry
   */
  @Cron('0 14 * * *')
  async syncSemgrepRulesDaily(): Promise<void> {
    if (!this.enableScheduledSync) return;

    this.logger.log('Starting daily Semgrep rule sync...');
    try {
      const result = await this.semgrepRuleSyncService.sync();
      this.logger.log(`Semgrep rule sync complete: ${result.totalRules} rules from ${result.packs} packs`);
      if (result.errors.length > 0) {
        this.logger.warn(`Sync had ${result.errors.length} errors: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      this.logger.error('Semgrep rule sync failed:', error);
    }
  }

  /**
   * Manual sync trigger
   */
  async triggerSync(): Promise<{ totalRules: number; packs: number; errors: string[] }> {
    this.logger.log('Manual Semgrep rule sync triggered...');
    return this.semgrepRuleSyncService.sync();
  }
}
