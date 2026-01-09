// apps/api/src/knowledge/sync/cwe-sync.service.ts
// CWE sync - stubbed until schema cleanup

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

const CWE_XML_URL = 'https://cwe.mitre.org/data/xml/cwec_latest.xml.zip';

@Injectable()
export class CweSyncService {
  private readonly logger = new Logger(CweSyncService.name);

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async syncCwes(): Promise<{ synced: number; errors: number }> {
    this.logger.log('CWE sync starting...');
    // TODO: Implement after schema cleanup
    this.logger.log('CWE sync stubbed - requires schema migration');
    return { synced: 0, errors: 0 };
  }

  getSourceUrl(): string {
    return CWE_XML_URL;
  }
}
