// apps/api/src/knowledge/sync/epss-sync.service.ts
// FIRST EPSS (Exploit Prediction Scoring System) sync

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

const EPSS_API = 'https://api.first.org/data/v1/epss';

@Injectable()
export class EpssSyncService {
  private readonly logger = new Logger(EpssSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async syncAll(): Promise<{ updated: number }> {
    this.logger.log('Starting EPSS sync...');
    let updated = 0, offset = 0;
    const limit = 1000;

    try {
      while (true) {
        const url = `${EPSS_API}?offset=${offset}&limit=${limit}`;
        const res = await fetch(url);
        if (!res.ok) break;

        const data = await res.json();
        const scores = data.data || [];
        if (scores.length === 0) break;

        for (const s of scores) {
          const cveId = s.cve;
          if (!cveId) continue;

          try {
            await this.prisma.cve.updateMany({
              where: { id: cveId },
              data: {
                epssScore: parseFloat(s.epss),
                epssPercentile: parseFloat(s.percentile),
              },
            });
            updated++;
          } catch {
            // CVE may not exist in our DB
          }
        }

        if (scores.length < limit) break;
        offset += limit;
        await new Promise(r => setTimeout(r, 500));
      }

      this.logger.log(`EPSS sync complete: ${updated} updated`);
    } catch (e) {
      this.logger.error('EPSS sync failed', e);
    }

    return { updated };
  }

  // Sync specific CVEs (for real-time updates)
  async syncCves(cveIds: string[]): Promise<{ updated: number }> {
    let updated = 0;

    for (const batch of this.chunk(cveIds, 30)) {
      const url = `${EPSS_API}?cve=${batch.join(',')}`;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;

        const data = await res.json();
        for (const s of data.data || []) {
          await this.prisma.cve.updateMany({
            where: { id: s.cve },
            data: { epssScore: parseFloat(s.epss), epssPercentile: parseFloat(s.percentile) },
          });
          updated++;
        }
      } catch {
        // Continue with next batch
      }
    }

    return { updated };
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
  }
}
