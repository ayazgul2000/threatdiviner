import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as https from 'https';
import { parseStringPromise } from 'xml2js';

interface CapecEntry {
  $: { ID: string; Name: string; Status?: string };
  Description?: string[];
  Likelihood_Of_Attack?: string[];
  Typical_Severity?: string[];
  Prerequisites?: Array<{ Prerequisite?: string[] }>;
  Skills_Required?: Array<{ Skill?: Array<{ $?: { Level?: string }; _?: string }> }>;
  Resources_Required?: Array<{ Resource?: string[] }>;
  Consequences?: Array<{ Consequence?: Array<{ Scope?: string[]; Impact?: string[] }> }>;
  Mitigations?: Array<{ Mitigation?: Array<{ Description?: string[] }> }>;
  Related_Weaknesses?: Array<{ Related_Weakness?: Array<{ $: { CWE_ID: string } }> }>;
  Related_Attack_Patterns?: Array<{ Related_Attack_Pattern?: Array<{ $: { CAPEC_ID: string } }> }>;
}

@Injectable()
export class CapecSyncService {
  private readonly logger = new Logger(CapecSyncService.name);
  private readonly CAPEC_URL = 'https://capec.mitre.org/data/xml/capec_latest.xml';

  constructor(private readonly prisma: PrismaService) {}

  async sync(): Promise<{ processed: number; errors: number }> {
    await this.updateSyncStatus('capec', 'syncing');
    let processed = 0;
    let errors = 0;

    try {
      this.logger.log('Downloading CAPEC data...');
      const xmlContent = await this.downloadXml();

      this.logger.log('Parsing CAPEC XML...');
      const patterns = await this.parseXml(xmlContent);

      this.logger.log(`Processing ${patterns.length} CAPEC entries...`);
      for (const pattern of patterns) {
        try {
          await this.processCapec(pattern);
          processed++;
        } catch (error) {
          this.logger.error(`Error processing CAPEC-${pattern.$.ID}:`, error);
          errors++;
        }
      }

      await this.updateSyncStatus('capec', 'success', processed);
      this.logger.log(`CAPEC sync complete: ${processed} entries processed, ${errors} errors`);
      return { processed, errors };
    } catch (error) {
      await this.updateSyncStatus('capec', 'failed', processed, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private downloadXml(): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(this.CAPEC_URL, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download CAPEC data: ${response.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  private async parseXml(xmlContent: string): Promise<CapecEntry[]> {
    const result = await parseStringPromise(xmlContent, { explicitArray: true, ignoreAttrs: false });
    const patterns = result?.Attack_Pattern_Catalog?.Attack_Patterns?.[0]?.Attack_Pattern || [];
    return patterns.filter((p: CapecEntry) => p.$.Status !== 'Deprecated' && p.$.Status !== 'Obsolete');
  }

  private async processCapec(capec: CapecEntry): Promise<void> {
    const id = `CAPEC-${capec.$.ID}`;
    const name = capec.$.Name;
    const description = this.extractText(capec.Description);
    const likelihood = capec.Likelihood_Of_Attack?.[0] || null;
    const severity = capec.Typical_Severity?.[0] || null;

    const prerequisites = capec.Prerequisites?.[0]?.Prerequisite?.map(p =>
      typeof p === 'string' ? p.trim() : this.extractText([p])
    ).filter(Boolean) || [];

    const skillsRequired = capec.Skills_Required?.[0]?.Skill?.map((s: Record<string, unknown>) => ({
      level: (s.$ as Record<string, string>)?.Level || 'Unknown',
      description: typeof s === 'string' ? (s as string).trim() : ((s._ as string) ? (s._ as string).trim() : ''),
    })).filter((s: { description: string }) => s.description) || [];

    const resourcesRequired = capec.Resources_Required?.[0]?.Resource?.map(r =>
      typeof r === 'string' ? r.trim() : this.extractText([r])
    ).filter(Boolean) || [];

    const consequences = capec.Consequences?.[0]?.Consequence?.map(c => ({
      scope: c.Scope?.map(s => typeof s === 'string' ? s : '') || [],
      impact: c.Impact?.map(i => typeof i === 'string' ? i : '') || [],
    })) || [];

    const mitigations = capec.Mitigations?.[0]?.Mitigation?.map(m =>
      this.extractText(m.Description)
    ).filter(Boolean) || [];

    const relatedCwes = capec.Related_Weaknesses?.[0]?.Related_Weakness?.map(rw => `CWE-${rw.$.CWE_ID}`) || [];
    const relatedAttackPatterns = capec.Related_Attack_Patterns?.[0]?.Related_Attack_Pattern?.map(rap => `CAPEC-${rap.$.CAPEC_ID}`) || [];
    const url = `https://capec.mitre.org/data/definitions/${capec.$.ID}.html`;

    await this.prisma.capecPattern.upsert({
      where: { id },
      create: { id, name, description, likelihood, severity, prerequisites, skillsRequired, resourcesRequired, consequences, mitigations, relatedCwes, relatedAttackPatterns, url },
      update: { name, description, likelihood, severity, prerequisites, skillsRequired, resourcesRequired, consequences, mitigations, relatedCwes, relatedAttackPatterns, url },
    });
  }

  private extractText(arr?: string[]): string {
    if (!arr || arr.length === 0) return '';
    const text = arr[0];
    if (typeof text === 'string') return text.trim();
    if (typeof text === 'object' && '_' in text) return (text as { _: string })._.trim();
    return '';
  }

  private async updateSyncStatus(source: string, status: string, recordCount?: number, errorMessage?: string): Promise<void> {
    const now = new Date();
    await this.prisma.dataSyncStatus.upsert({
      where: { id: source },
      create: { id: source, status, recordCount: recordCount || 0, errorMessage, lastSyncAt: now, lastSuccessAt: status === 'success' ? now : undefined, nextSyncAt: status === 'success' ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined },
      update: { status, recordCount: recordCount || undefined, errorMessage, lastSyncAt: now, lastSuccessAt: status === 'success' ? now : undefined, nextSyncAt: status === 'success' ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined },
    });
  }
}
