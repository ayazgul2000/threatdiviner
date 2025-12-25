import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as https from 'https';
import * as zlib from 'zlib';
import { parseStringPromise } from 'xml2js';

interface CweEntry {
  $: { ID: string; Name: string };
  Description?: string[];
  Extended_Description?: string[];
  Related_Weaknesses?: Array<{
    Related_Weakness?: Array<{ $: { CWE_ID: string } }>;
  }>;
  Common_Consequences?: Array<{
    Consequence?: Array<{
      Scope?: string[];
      Impact?: string[];
    }>;
  }>;
  Potential_Mitigations?: Array<{
    Mitigation?: Array<{
      Phase?: string[];
      Description?: string[];
    }>;
  }>;
  Detection_Methods?: Array<{
    Detection_Method?: Array<{
      Method?: string[];
      Description?: string[];
    }>;
  }>;
  Applicable_Platforms?: Array<{
    Language?: Array<{ $: { Name: string; Prevalence?: string } }>;
    Technology?: Array<{ $: { Name: string; Prevalence?: string } }>;
  }>;
  Likelihood_Of_Exploit?: string[];
}

@Injectable()
export class CweSyncService {
  private readonly logger = new Logger(CweSyncService.name);
  // CWE Research Concepts view (comprehensive)
  private readonly CWE_URL = 'https://cwe.mitre.org/data/xml/cwec_latest.xml.zip';

  constructor(private readonly prisma: PrismaService) {}

  async sync(): Promise<{ processed: number; errors: number }> {
    await this.updateSyncStatus('cwe', 'syncing');
    let processed = 0;
    let errors = 0;

    try {
      this.logger.log('Downloading CWE data...');
      const xmlContent = await this.downloadAndExtract();

      this.logger.log('Parsing CWE XML...');
      const cwes = await this.parseXml(xmlContent);

      this.logger.log(`Processing ${cwes.length} CWE entries...`);
      for (const cwe of cwes) {
        try {
          await this.processCwe(cwe);
          processed++;
        } catch (error) {
          this.logger.error(`Error processing CWE-${cwe.$.ID}:`, error);
          errors++;
        }
      }

      await this.updateSyncStatus('cwe', 'success', processed);
      this.logger.log(`CWE sync complete: ${processed} entries processed, ${errors} errors`);
      return { processed, errors };
    } catch (error) {
      await this.updateSyncStatus('cwe', 'failed', processed, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private downloadAndExtract(): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(this.CWE_URL, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download CWE data: ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          try {
            const zipBuffer = Buffer.concat(chunks);
            // The CWE zip contains a single XML file
            const unzipped = zlib.gunzipSync(zipBuffer);
            resolve(unzipped.toString('utf-8'));
          } catch (unzipError) {
            // If gunzip fails, try using the AdmZip for regular zip
            this.extractFromZip(Buffer.concat(chunks))
              .then(resolve)
              .catch(reject);
          }
        });
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  private async extractFromZip(zipBuffer: Buffer): Promise<string> {
    // For regular zip files, we'd need AdmZip, but let's try a simpler approach
    // The CWE latest might be gzipped or regular zip
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();
      const xmlEntry = entries.find((e: any) => e.entryName.endsWith('.xml'));
      if (xmlEntry) {
        return xmlEntry.getData().toString('utf-8');
      }
      throw new Error('No XML file found in CWE archive');
    } catch {
      // Fallback: try to parse as-is (maybe it's already XML)
      return zipBuffer.toString('utf-8');
    }
  }

  private async parseXml(xmlContent: string): Promise<CweEntry[]> {
    const result = await parseStringPromise(xmlContent, {
      explicitArray: true,
      ignoreAttrs: false,
    });

    // Navigate to the Weaknesses element
    const weaknesses = result?.Weakness_Catalog?.Weaknesses?.[0]?.Weakness || [];
    return weaknesses;
  }

  private async processCwe(cwe: CweEntry): Promise<void> {
    const id = `CWE-${cwe.$.ID}`;
    const name = cwe.$.Name;
    const description = this.extractText(cwe.Description);
    const extendedDescription = this.extractText(cwe.Extended_Description);

    const relatedWeaknesses = cwe.Related_Weaknesses?.[0]?.Related_Weakness?.map(
      rw => `CWE-${rw.$.CWE_ID}`
    ) || [];

    const commonConsequences = cwe.Common_Consequences?.[0]?.Consequence?.map(c => ({
      scope: c.Scope || [],
      impact: c.Impact || [],
    })) || [];

    const potentialMitigations = cwe.Potential_Mitigations?.[0]?.Mitigation?.map(m => ({
      phase: m.Phase || [],
      description: this.extractText(m.Description),
    })) || [];

    const detectionMethods = cwe.Detection_Methods?.[0]?.Detection_Method?.map(d => ({
      method: d.Method?.[0] || '',
      description: this.extractText(d.Description),
    })) || [];

    const applicablePlatforms = {
      languages: cwe.Applicable_Platforms?.[0]?.Language?.map(l => ({
        name: l.$.Name,
        prevalence: l.$.Prevalence,
      })) || [],
      technologies: cwe.Applicable_Platforms?.[0]?.Technology?.map(t => ({
        name: t.$.Name,
        prevalence: t.$.Prevalence,
      })) || [],
    };

    const likelihoodOfExploit = cwe.Likelihood_Of_Exploit?.[0] || null;

    await this.prisma.cwe.upsert({
      where: { id },
      create: {
        id,
        name,
        description,
        extendedDescription,
        relatedWeaknesses,
        commonConsequences,
        potentialMitigations,
        detectionMethods,
        applicablePlatforms,
        likelihoodOfExploit,
      },
      update: {
        name,
        description,
        extendedDescription,
        relatedWeaknesses,
        commonConsequences,
        potentialMitigations,
        detectionMethods,
        applicablePlatforms,
        likelihoodOfExploit,
      },
    });
  }

  private extractText(arr?: string[]): string {
    if (!arr || arr.length === 0) return '';
    const text = arr[0];
    if (typeof text === 'string') return text.trim();
    if (typeof text === 'object' && '_' in text) return (text as any)._.trim();
    return '';
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
        nextSyncAt: status === 'success' ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined,
      },
      update: {
        status,
        recordCount: recordCount || undefined,
        errorMessage,
        lastSyncAt: now,
        lastSuccessAt: status === 'success' ? now : undefined,
        nextSyncAt: status === 'success' ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined,
      },
    });
  }
}
