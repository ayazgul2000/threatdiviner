import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

interface NvdCve {
  id: string;
  published: string;
  lastModified: string;
  descriptions: Array<{ lang: string; value: string }>;
  metrics?: {
    cvssMetricV31?: Array<{
      cvssData: {
        baseScore: number;
        vectorString: string;
        baseSeverity: string;
      };
    }>;
    cvssMetricV2?: Array<{
      cvssData: {
        baseScore: number;
      };
    }>;
  };
  weaknesses?: Array<{
    description: Array<{ lang: string; value: string }>;
  }>;
  references?: Array<{ url: string; source?: string; tags?: string[] }>;
  configurations?: any[];
}

interface NvdResponse {
  totalResults: number;
  resultsPerPage: number;
  startIndex: number;
  vulnerabilities: Array<{ cve: NvdCve }>;
}

@Injectable()
export class NvdSyncService {
  private readonly logger = new Logger(NvdSyncService.name);
  private readonly NVD_API = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
  private readonly BATCH_SIZE = 2000;
  private readonly apiKey?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('NVD_API_KEY');
  }

  async syncAll(): Promise<{ processed: number; errors: number }> {
    await this.updateSyncStatus('nvd', 'syncing');
    let processed = 0;
    let errors = 0;

    try {
      let startIndex = 0;
      let totalResults = 1;

      while (startIndex < totalResults) {
        try {
          const response = await this.fetchBatch(startIndex);
          totalResults = response.totalResults;

          const batchResult = await this.processBatch(response.vulnerabilities);
          processed += batchResult.processed;
          errors += batchResult.errors;

          startIndex += this.BATCH_SIZE;
          this.logger.log(`NVD sync progress: ${startIndex}/${totalResults}`);

          // Rate limit: NVD allows 5 requests per 30 seconds without API key
          // With API key: 50 requests per 30 seconds
          const delay = this.apiKey ? 600 : 6000;
          await this.sleep(delay);
        } catch (batchError) {
          this.logger.error(`Error processing batch at index ${startIndex}:`, batchError);
          errors++;
          startIndex += this.BATCH_SIZE;
        }
      }

      await this.updateSyncStatus('nvd', 'success', processed);
      this.logger.log(`NVD sync complete: ${processed} CVEs processed, ${errors} errors`);
      return { processed, errors };
    } catch (error) {
      await this.updateSyncStatus('nvd', 'failed', processed, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async syncRecent(days: number = 7): Promise<{ processed: number; errors: number }> {
    await this.updateSyncStatus('nvd', 'syncing');
    let processed = 0;
    let errors = 0;

    try {
      const lastModStartDate = new Date();
      lastModStartDate.setDate(lastModStartDate.getDate() - days);

      let startIndex = 0;
      let totalResults = 1;

      while (startIndex < totalResults) {
        try {
          const response = await this.fetchBatch(startIndex, lastModStartDate, new Date());
          totalResults = response.totalResults;

          const batchResult = await this.processBatch(response.vulnerabilities);
          processed += batchResult.processed;
          errors += batchResult.errors;

          startIndex += this.BATCH_SIZE;
          this.logger.log(`NVD recent sync progress: ${startIndex}/${totalResults}`);

          const delay = this.apiKey ? 600 : 6000;
          await this.sleep(delay);
        } catch (batchError) {
          this.logger.error(`Error processing recent batch at index ${startIndex}:`, batchError);
          errors++;
          startIndex += this.BATCH_SIZE;
        }
      }

      await this.updateSyncStatus('nvd', 'success', processed);
      this.logger.log(`NVD recent sync complete: ${processed} CVEs processed, ${errors} errors`);
      return { processed, errors };
    } catch (error) {
      await this.updateSyncStatus('nvd', 'failed', processed, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async fetchBatch(
    startIndex: number,
    lastModStartDate?: Date,
    lastModEndDate?: Date,
  ): Promise<NvdResponse> {
    const params = new URLSearchParams({
      startIndex: startIndex.toString(),
      resultsPerPage: this.BATCH_SIZE.toString(),
    });

    if (lastModStartDate && lastModEndDate) {
      params.append('lastModStartDate', lastModStartDate.toISOString());
      params.append('lastModEndDate', lastModEndDate.toISOString());
    }

    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['apiKey'] = this.apiKey;
    }

    const response = await fetch(`${this.NVD_API}?${params}`, { headers });

    if (!response.ok) {
      throw new Error(`NVD API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async processBatch(
    vulnerabilities: Array<{ cve: NvdCve }>,
  ): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    for (const vuln of vulnerabilities) {
      try {
        const cve = vuln.cve;
        const description = cve.descriptions.find(d => d.lang === 'en')?.value || '';
        const cvssV31 = cve.metrics?.cvssMetricV31?.[0]?.cvssData;
        const cvssV2 = cve.metrics?.cvssMetricV2?.[0]?.cvssData;

        const cweIds = cve.weaknesses?.flatMap(w =>
          w.description
            .filter(d => d.value.startsWith('CWE-'))
            .map(d => d.value)
        ) || [];

        await this.prisma.cve.upsert({
          where: { id: cve.id },
          create: {
            id: cve.id,
            description,
            publishedDate: new Date(cve.published),
            lastModifiedDate: new Date(cve.lastModified),
            cvssV3Score: cvssV31?.baseScore,
            cvssV3Vector: cvssV31?.vectorString,
            cvssV3Severity: cvssV31?.baseSeverity,
            cvssV2Score: cvssV2?.baseScore,
            cweIds,
            references: cve.references || [],
            affectedProducts: cve.configurations || [],
          },
          update: {
            description,
            lastModifiedDate: new Date(cve.lastModified),
            cvssV3Score: cvssV31?.baseScore,
            cvssV3Vector: cvssV31?.vectorString,
            cvssV3Severity: cvssV31?.baseSeverity,
            cvssV2Score: cvssV2?.baseScore,
            cweIds,
            references: cve.references || [],
            affectedProducts: cve.configurations || [],
          },
        });
        processed++;
      } catch (error) {
        this.logger.error(`Error processing CVE ${vuln.cve.id}:`, error);
        errors++;
      }
    }

    return { processed, errors };
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
