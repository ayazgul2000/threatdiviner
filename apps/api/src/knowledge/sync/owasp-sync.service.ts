// apps/api/src/knowledge/sync/owasp-sync.service.ts
// OWASP Cheatsheet sync - stubbed

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

const OWASP_REPO = 'https://github.com/OWASP/CheatSheetSeries';

@Injectable()
export class OwaspSyncService {
  private readonly logger = new Logger(OwaspSyncService.name);

  @Cron(CronExpression.EVERY_WEEK)
  async syncCheatsheets(): Promise<{ synced: number; errors: number }> {
    this.logger.log('OWASP Cheatsheet sync starting...');
    this.logger.log('OWASP sync stubbed - requires git clone implementation');
    return { synced: 0, errors: 0 };
  }

  getSourceUrl(): string {
    return OWASP_REPO;
  }
}
