#!/usr/bin/env ts-node
/**
 * Manual Semgrep Rule Sync Script
 *
 * Usage:
 *   npx ts-node scripts/sync-semgrep-rules.ts
 *
 * Fetches rules from Semgrep public registry and saves them locally.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SemgrepRuleSyncService } from '../src/scanners/sast/semgrep/semgrep-rule-sync.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const syncService = app.get(SemgrepRuleSyncService);

  console.log('\n🔄 Semgrep Rule Sync\n');
  console.log('Fetching rules from Semgrep public registry...\n');

  try {
    const result = await syncService.sync();

    console.log('\n✅ Sync complete!');
    console.log(`   Total rules: ${result.totalRules}`);
    console.log(`   Packs synced: ${result.packs}`);

    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errors.forEach((e) => console.log(`   - ${e}`));
    }

    console.log(`\nRules saved to: src/scanners/sast/semgrep/rules/registry/`);
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }

  await app.close();
  process.exit(0);
}

bootstrap();
