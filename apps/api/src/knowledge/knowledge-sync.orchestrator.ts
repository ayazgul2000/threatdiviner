// apps/api/src/knowledge/knowledge-sync.orchestrator.ts
// Orchestrates all knowledge sync jobs

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CveSyncService } from './sync/cve-sync.service';
import { CweSyncService } from './sync/cwe-sync.service';
import { CapecSyncService } from './sync/capec-sync.service';
import { AttackSyncService } from './sync/attack-sync.service';
import { KevSyncService } from './sync/kev-sync.service';
import { EpssSyncService } from './sync/epss-sync.service';
import { OwaspSyncService } from './sync/owasp-sync.service';

@Injectable()
export class KnowledgeSyncOrchestrator implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeSyncOrchestrator.name);

  constructor(
    private readonly cveSyncService: CveSyncService,
    private readonly cweSyncService: CweSyncService,
    private readonly capecSyncService: CapecSyncService,
    private readonly attackSyncService: AttackSyncService,
    private readonly kevSyncService: KevSyncService,
    private readonly epssSyncService: EpssSyncService,
    private readonly owaspSyncService: OwaspSyncService,
  ) {}

  async onModuleInit() {
    this.logger.log('Knowledge sync orchestrator initialized');
    this.logger.log('Sync schedules:');
    this.logger.log('  - CVE: Hourly delta, Daily full');
    this.logger.log('  - KEV: Daily at 2 AM');
    this.logger.log('  - EPSS: Daily at 3 AM');
    this.logger.log('  - CWE/CAPEC/ATT&CK: Monthly');
    this.logger.log('  - OWASP: Weekly');
  }

  async runFullSync(): Promise<void> {
    this.logger.log('Starting full knowledge base sync...');
    
    await this.cveSyncService.syncRecentCves();
    await this.kevSyncService.syncKev();
    await this.epssSyncService.syncAll();
    
    // Quarterly syncs - only run if needed
    // await this.cweSyncService.syncAll();
    // await this.capecSyncService.syncAll();
    // await this.attackSyncService.syncAll();
    // await this.owaspSyncService.syncAll();
    
    this.logger.log('Full sync complete');
  }

  async getStatus(): Promise<Record<string, any>> {
    return {
      cve: { lastSync: null, source: 'NVD' },
      kev: { lastSync: null, source: 'CISA' },
      epss: { lastSync: null, source: 'FIRST' },
      cwe: { lastSync: null, source: 'MITRE' },
      capec: { lastSync: null, source: 'MITRE' },
      attack: { lastSync: null, source: 'MITRE' },
      owasp: { lastSync: null, source: 'GitHub' },
    };
  }
}
