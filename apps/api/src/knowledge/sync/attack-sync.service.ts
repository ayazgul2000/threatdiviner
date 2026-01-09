// apps/api/src/knowledge/sync/attack-sync.service.ts
// MITRE ATT&CK sync - stubbed until schema cleanup

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

const ATTACK_JSON_URL = 'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json';

@Injectable()
export class AttackSyncService {
  private readonly logger = new Logger(AttackSyncService.name);

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async syncAttack(): Promise<{ techniques: number; tactics: number; errors: number }> {
    this.logger.log('ATT&CK sync starting...');
    this.logger.log('ATT&CK sync stubbed - requires schema migration');
    return { techniques: 0, tactics: 0, errors: 0 };
  }

  getSourceUrl(): string {
    return ATTACK_JSON_URL;
  }
}
