// apps/api/src/knowledge/sync/capec-sync.service.ts
// CAPEC sync - stubbed until schema cleanup

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

const CAPEC_XML_URL = 'https://capec.mitre.org/data/xml/capec_latest.xml';

@Injectable()
export class CapecSyncService {
  private readonly logger = new Logger(CapecSyncService.name);

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async syncCapecs(): Promise<{ synced: number; errors: number }> {
    this.logger.log('CAPEC sync starting...');
    this.logger.log('CAPEC sync stubbed - requires schema migration');
    return { synced: 0, errors: 0 };
  }

  getSourceUrl(): string {
    return CAPEC_XML_URL;
  }
}
