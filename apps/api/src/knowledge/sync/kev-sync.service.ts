// apps/api/src/knowledge/sync/kev-sync.service.ts
// CISA KEV sync

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

const KEV_JSON_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

interface KevEntry {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
}

@Injectable()
export class KevSyncService {
  private readonly logger = new Logger(KevSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async syncKev(): Promise<{ synced: number; errors: number }> {
    this.logger.log('KEV sync starting...');
    let synced = 0;
    let errors = 0;

    try {
      const response = await fetch(KEV_JSON_URL);
      const data = await response.json();
      const entries: KevEntry[] = data.vulnerabilities || [];

      for (const entry of entries) {
        try {
          await this.prisma.cve.updateMany({
            where: { id: entry.cveID },
            data: {
              isKev: true,
              kevDateAdded: new Date(entry.dateAdded),
              kevDueDate: entry.dueDate ? new Date(entry.dueDate) : null,
            },
          });
          synced++;
        } catch (e) {
          errors++;
        }
      }

      this.logger.log(`KEV sync complete: ${synced} updated, ${errors} errors`);
    } catch (e) {
      this.logger.error('KEV sync failed', e);
    }

    return { synced, errors };
  }
}
