import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface KevVulnerability {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  notes?: string;
}

interface KevCatalog {
  title: string;
  catalogVersion: string;
  dateReleased: string;
  count: number;
  vulnerabilities: KevVulnerability[];
}

@Injectable()
export class KevSyncService {
  private readonly logger = new Logger(KevSyncService.name);
  // CISA Known Exploited Vulnerabilities Catalog
  private readonly KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

  constructor(private readonly prisma: PrismaService) {}

  async sync(): Promise<{ processed: number; added: number; removed: number }> {
    await this.updateSyncStatus('kev', 'syncing');
    let processed = 0;
    let added = 0;
    let removed = 0;

    try {
      this.logger.log('Fetching CISA KEV catalog...');
      const catalog = await this.fetchCatalog();

      this.logger.log(`Processing ${catalog.count} KEV entries...`);

      // Get all current KEV CVE IDs
      const currentKevIds = new Set(catalog.vulnerabilities.map(v => v.cveID));

      // Reset all KEV flags first for CVEs no longer in KEV
      const resetResult = await this.prisma.cve.updateMany({
        where: {
          isKev: true,
          id: { notIn: Array.from(currentKevIds) },
        },
        data: {
          isKev: false,
          kevDateAdded: null,
          kevDueDate: null,
        },
      });
      removed = resetResult.count;

      // Update CVEs that are in KEV
      for (const vuln of catalog.vulnerabilities) {
        try {
          const result = await this.prisma.cve.updateMany({
            where: { id: vuln.cveID },
            data: {
              isKev: true,
              kevDateAdded: new Date(vuln.dateAdded),
              kevDueDate: new Date(vuln.dueDate),
            },
          });

          if (result.count > 0) {
            processed++;
          } else {
            // CVE doesn't exist in our database yet, but track it was in KEV
            added++;
          }
        } catch (error) {
          this.logger.error(`Error updating KEV for ${vuln.cveID}:`, error);
        }
      }

      await this.updateSyncStatus('kev', 'success', processed + added);
      this.logger.log(`KEV sync complete: ${processed} updated, ${added} not found in DB, ${removed} removed from KEV`);
      return { processed, added, removed };
    } catch (error) {
      await this.updateSyncStatus('kev', 'failed', processed, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getKevCves(): Promise<string[]> {
    const kevCves = await this.prisma.cve.findMany({
      where: { isKev: true },
      select: { id: true },
    });
    return kevCves.map(c => c.id);
  }

  async isKev(cveId: string): Promise<boolean> {
    const cve = await this.prisma.cve.findUnique({
      where: { id: cveId },
      select: { isKev: true },
    });
    return cve?.isKev || false;
  }

  private async fetchCatalog(): Promise<KevCatalog> {
    const response = await fetch(this.KEV_URL);

    if (!response.ok) {
      throw new Error(`CISA KEV API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async updateSyncStatus(
    source: string,
    status: string,
    recordCount?: number,
    errorMessage?: string,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.dataSyncStatus.upsert({
      where: { id: source },
      create: {
        id: source,
        status,
        recordCount: recordCount || 0,
        errorMessage,
        lastSyncAt: now,
        lastSuccessAt: status === 'success' ? now : undefined,
        nextSyncAt: status === 'success' ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : undefined,
      },
      update: {
        status,
        recordCount: recordCount || undefined,
        errorMessage,
        lastSyncAt: now,
        lastSuccessAt: status === 'success' ? now : undefined,
        nextSyncAt: status === 'success' ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : undefined,
      },
    });
  }
}
