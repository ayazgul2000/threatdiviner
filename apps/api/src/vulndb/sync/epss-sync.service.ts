import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface EpssEntry {
  cve: string;
  epss: string;
  percentile: string;
}

interface EpssResponse {
  status: string;
  status_code: number;
  total: number;
  offset: number;
  limit: number;
  data: EpssEntry[];
}

@Injectable()
export class EpssSyncService {
  private readonly logger = new Logger(EpssSyncService.name);
  // FIRST EPSS API
  private readonly EPSS_API = 'https://api.first.org/data/v1/epss';
  private readonly BATCH_SIZE = 1000;

  constructor(private readonly prisma: PrismaService) {}

  async sync(): Promise<{ processed: number; errors: number }> {
    await this.updateSyncStatus('epss', 'syncing');
    let processed = 0;
    let errors = 0;

    try {
      this.logger.log('Fetching EPSS scores...');

      let offset = 0;
      let total = 1;

      while (offset < total) {
        try {
          const response = await this.fetchBatch(offset);
          total = response.total;

          const batchResult = await this.processBatch(response.data);
          processed += batchResult.processed;
          errors += batchResult.errors;

          offset += this.BATCH_SIZE;
          this.logger.log(`EPSS sync progress: ${offset}/${total}`);

          // Small delay to be nice to the API
          await this.sleep(500);
        } catch (batchError) {
          this.logger.error(`Error processing EPSS batch at offset ${offset}:`, batchError);
          errors++;
          offset += this.BATCH_SIZE;
        }
      }

      await this.updateSyncStatus('epss', 'success', processed);
      this.logger.log(`EPSS sync complete: ${processed} scores updated, ${errors} errors`);
      return { processed, errors };
    } catch (error) {
      await this.updateSyncStatus('epss', 'failed', processed, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async syncForCves(cveIds: string[]): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    // EPSS API supports querying specific CVEs
    const chunks = this.chunkArray(cveIds, 100);

    for (const chunk of chunks) {
      try {
        const cveParam = chunk.join(',');
        const response = await fetch(`${this.EPSS_API}?cve=${cveParam}`);

        if (!response.ok) {
          throw new Error(`EPSS API error: ${response.status}`);
        }

        const data: EpssResponse = await response.json();
        const batchResult = await this.processBatch(data.data);
        processed += batchResult.processed;
        errors += batchResult.errors;

        await this.sleep(200);
      } catch (error) {
        this.logger.error(`Error fetching EPSS for CVE batch:`, error);
        errors += chunk.length;
      }
    }

    return { processed, errors };
  }

  private async fetchBatch(offset: number): Promise<EpssResponse> {
    const params = new URLSearchParams({
      offset: offset.toString(),
      limit: this.BATCH_SIZE.toString(),
      envelope: 'true',
    });

    const response = await fetch(`${this.EPSS_API}?${params}`);

    if (!response.ok) {
      throw new Error(`EPSS API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async processBatch(
    entries: EpssEntry[],
  ): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    // Batch update using Prisma transactions for better performance
    const updates = entries.map(entry => ({
      cveId: entry.cve,
      epssScore: parseFloat(entry.epss),
      epssPercentile: parseFloat(entry.percentile),
    }));

    for (const update of updates) {
      try {
        await this.prisma.cve.updateMany({
          where: { id: update.cveId },
          data: {
            epssScore: update.epssScore,
            epssPercentile: update.epssPercentile,
          },
        });
        processed++;
      } catch (error) {
        // CVE might not exist in our database yet - that's okay
        errors++;
      }
    }

    return { processed, errors };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
