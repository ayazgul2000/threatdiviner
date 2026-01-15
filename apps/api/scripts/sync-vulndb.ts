#!/usr/bin/env ts-node
/**
 * Manual VulnDB Sync Script
 *
 * Usage:
 *   npx ts-node scripts/sync-vulndb.ts [command]
 *
 * Commands:
 *   all       - Sync all data sources (OWASP, CWE-mapping, KEV, ATT&CK, CWE, CVE-recent)
 *   owasp     - Sync OWASP Top 10
 *   cwe       - Sync CWE database (large, takes time)
 *   cwe-map   - Sync CWE compliance mappings
 *   attack    - Sync MITRE ATT&CK
 *   kev       - Sync CISA KEV catalog
 *   epss      - Sync EPSS scores
 *   nvd       - Sync recent CVEs (last 7 days)
 *   nvd-full  - Sync all CVEs (very large, takes hours)
 *   status    - Show sync status
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { VulnDbService } from '../src/vulndb/vulndb.service';
import {
  NvdSyncService,
  CweSyncService,
  EpssSyncService,
  KevSyncService,
  OwaspSyncService,
  CweMappingSyncService,
  AttackSyncService,
} from '../src/vulndb/sync';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const command = process.argv[2] || 'status';

  const vulnDbService = app.get(VulnDbService);
  const nvdSync = app.get(NvdSyncService);
  const cweSync = app.get(CweSyncService);
  const epssSync = app.get(EpssSyncService);
  const kevSync = app.get(KevSyncService);
  const owaspSync = app.get(OwaspSyncService);
  const cweMappingSync = app.get(CweMappingSyncService);
  const attackSync = app.get(AttackSyncService);

  console.log(`\n🔄 VulnDB Sync - Command: ${command}\n`);

  try {
    switch (command) {
      case 'all':
        console.log('Starting full sync (OWASP → CWE-mapping → KEV → ATT&CK → CWE → CVE-recent)...\n');

        console.log('1/6 Syncing OWASP Top 10...');
        await owaspSync.sync();

        console.log('2/6 Syncing CWE mappings...');
        await cweMappingSync.sync();

        console.log('3/6 Syncing CISA KEV...');
        await kevSync.sync();

        console.log('4/6 Syncing MITRE ATT&CK...');
        await attackSync.sync();

        console.log('5/6 Syncing CWE database...');
        await cweSync.sync();

        console.log('6/6 Syncing recent CVEs (last 7 days)...');
        await nvdSync.syncRecent(7);

        console.log('\n✅ Full sync complete!');
        break;

      case 'owasp':
        console.log('Syncing OWASP Top 10...');
        const owaspResult = await owaspSync.sync();
        console.log(`✅ OWASP sync complete: ${owaspResult.processed} categories`);
        break;

      case 'cwe':
        console.log('Syncing CWE database (this may take a while)...');
        const cweResult = await cweSync.sync();
        console.log(`✅ CWE sync complete: ${cweResult.processed} entries`);
        break;

      case 'cwe-map':
        console.log('Syncing CWE compliance mappings...');
        const cweMapResult = await cweMappingSync.sync();
        console.log(`✅ CWE mapping sync complete: ${cweMapResult.processed} mappings`);
        break;

      case 'attack':
        console.log('Syncing MITRE ATT&CK...');
        const attackResult = await attackSync.sync();
        console.log(`✅ ATT&CK sync complete: ${attackResult.tactics} tactics, ${attackResult.techniques} techniques`);
        break;

      case 'kev':
        console.log('Syncing CISA KEV catalog...');
        const kevResult = await kevSync.sync();
        console.log(`✅ KEV sync complete: ${kevResult.processed} updated, ${kevResult.added} new, ${kevResult.removed} removed`);
        break;

      case 'epss':
        console.log('Syncing EPSS scores...');
        const epssResult = await epssSync.sync();
        console.log(`✅ EPSS sync complete: ${epssResult.processed} scores updated`);
        break;

      case 'nvd':
        console.log('Syncing recent CVEs (last 7 days)...');
        const nvdResult = await nvdSync.syncRecent(7);
        console.log(`✅ NVD sync complete: ${nvdResult.processed} CVEs`);
        break;

      case 'nvd-full':
        console.log('Syncing ALL CVEs (this will take hours)...');
        const nvdFullResult = await nvdSync.syncAll();
        console.log(`✅ Full NVD sync complete: ${nvdFullResult.processed} CVEs`);
        break;

      case 'status':
        const status = await vulnDbService.getSyncStatus();
        console.log('Sync Status:');
        console.log(JSON.stringify(status, null, 2));
        break;

      default:
        console.log(`Unknown command: ${command}`);
        console.log('Available commands: all, owasp, cwe, cwe-map, attack, kev, epss, nvd, nvd-full, status');
    }
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }

  await app.close();
  process.exit(0);
}

bootstrap();
