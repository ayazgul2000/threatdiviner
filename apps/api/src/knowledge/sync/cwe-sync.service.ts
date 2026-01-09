// apps/api/src/knowledge/sync/cwe-sync.service.ts
// CWE (Common Weakness Enumeration) sync service - fetches from MITRE XML

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import * as https from 'https';
import * as zlib from 'zlib';
import { XMLParser } from 'fast-xml-parser';

const CWE_XML_URL = 'https://cwe.mitre.org/data/xml/cwec_latest.xml.zip';

interface CweWeakness {
  '@_ID': string;
  '@_Name': string;
  '@_Abstraction': string;
  '@_Status': string;
  Description?: string;
  Extended_Description?: string | { '#text': string };
  Related_Weaknesses?: {
    Related_Weakness: Array<{ '@_CWE_ID': string; '@_Nature': string }> | { '@_CWE_ID': string; '@_Nature': string };
  };
  Common_Consequences?: {
    Consequence: Array<{
      Scope: string | string[];
      Impact: string | string[];
      Note?: string;
    }> | {
      Scope: string | string[];
      Impact: string | string[];
      Note?: string;
    };
  };
  Potential_Mitigations?: {
    Mitigation: Array<{
      Phase: string | string[];
      Description: string | { '#text': string };
      Effectiveness?: string;
    }> | {
      Phase: string | string[];
      Description: string | { '#text': string };
      Effectiveness?: string;
    };
  };
  Detection_Methods?: {
    Detection_Method: Array<{
      Method: string;
      Description: string | { '#text': string };
      Effectiveness?: string;
    }> | {
      Method: string;
      Description: string | { '#text': string };
      Effectiveness?: string;
    };
  };
  Applicable_Platforms?: {
    Language?: Array<{ '@_Name': string; '@_Prevalence': string }> | { '@_Name': string; '@_Prevalence': string };
    Technology?: Array<{ '@_Name': string; '@_Prevalence': string }> | { '@_Name': string; '@_Prevalence': string };
    Operating_System?: Array<{ '@_Name': string }> | { '@_Name': string };
  };
  Likelihood_Of_Exploit?: string;
}

@Injectable()
export class CweSyncService {
  private readonly logger = new Logger(CweSyncService.name);
  private readonly parser: XMLParser;

  constructor(private readonly prisma: PrismaService) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      isArray: (name) => ['Weakness', 'Related_Weakness', 'Consequence', 'Mitigation', 'Detection_Method', 'Language', 'Technology', 'Operating_System'].includes(name),
    });
  }

  // Monthly full sync
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async syncCwes(): Promise<{ synced: number; errors: number }> {
    this.logger.log('CWE sync starting...');
    let synced = 0;
    let errors = 0;

    try {
      const xmlData = await this.downloadAndExtract();
      const parsed = this.parser.parse(xmlData);
      const weaknesses = parsed?.Weakness_Catalog?.Weaknesses?.Weakness || [];

      this.logger.log(`Found ${weaknesses.length} CWE weaknesses to process`);

      // Process in batches of 100
      const batchSize = 100;
      for (let i = 0; i < weaknesses.length; i += batchSize) {
        const batch = weaknesses.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((weakness: CweWeakness) => this.upsertCwe(weakness))
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            synced++;
          } else {
            errors++;
            this.logger.warn(`CWE sync error: ${result.reason}`);
          }
        }

        // Log progress every 500
        if ((i + batchSize) % 500 === 0) {
          this.logger.log(`Processed ${Math.min(i + batchSize, weaknesses.length)}/${weaknesses.length} CWEs`);
        }
      }

      // Update sync status
      await this.prisma.dataSyncStatus.upsert({
        where: { sourceType: 'cwe' },
        update: {
          lastSyncAt: new Date(),
          recordCount: synced,
          status: errors > 0 ? 'partial' : 'success',
          errorMessage: errors > 0 ? `${errors} records failed` : null,
        },
        create: {
          sourceType: 'cwe',
          lastSyncAt: new Date(),
          recordCount: synced,
          status: errors > 0 ? 'partial' : 'success',
        },
      });

      this.logger.log(`CWE sync complete: ${synced} synced, ${errors} errors`);
    } catch (e) {
      this.logger.error('CWE sync failed', e);
      await this.prisma.dataSyncStatus.upsert({
        where: { sourceType: 'cwe' },
        update: {
          status: 'failed',
          errorMessage: e instanceof Error ? e.message : String(e),
        },
        create: {
          sourceType: 'cwe',
          status: 'failed',
          errorMessage: e instanceof Error ? e.message : String(e),
        },
      });
    }

    return { synced, errors };
  }

  private async downloadAndExtract(): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(CWE_XML_URL, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);
            // The file is a ZIP containing XML
            const unzipped = zlib.unzipSync(buffer);
            resolve(unzipped.toString('utf-8'));
          } catch (e) {
            // If unzip fails, try gunzip
            try {
              const gunzipped = zlib.gunzipSync(Buffer.concat(chunks));
              resolve(gunzipped.toString('utf-8'));
            } catch {
              reject(e);
            }
          }
        });
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  private async upsertCwe(weakness: CweWeakness): Promise<void> {
    const id = `CWE-${weakness['@_ID']}`;
    const name = weakness['@_Name'] || '';
    const description = weakness.Description || '';

    // Handle extended description which can be string or object with #text
    let extendedDescription: string | null = null;
    if (weakness.Extended_Description) {
      extendedDescription = typeof weakness.Extended_Description === 'string'
        ? weakness.Extended_Description
        : weakness.Extended_Description['#text'] || null;
    }

    // Extract related weaknesses
    const relatedWeaknesses: string[] = [];
    if (weakness.Related_Weaknesses?.Related_Weakness) {
      const related = Array.isArray(weakness.Related_Weaknesses.Related_Weakness)
        ? weakness.Related_Weaknesses.Related_Weakness
        : [weakness.Related_Weaknesses.Related_Weakness];
      for (const r of related) {
        relatedWeaknesses.push(`CWE-${r['@_CWE_ID']}`);
      }
    }

    // Extract common consequences
    const commonConsequences: Array<{ scope: string[]; impact: string[]; note?: string }> = [];
    if (weakness.Common_Consequences?.Consequence) {
      const consequences = Array.isArray(weakness.Common_Consequences.Consequence)
        ? weakness.Common_Consequences.Consequence
        : [weakness.Common_Consequences.Consequence];
      for (const c of consequences) {
        commonConsequences.push({
          scope: Array.isArray(c.Scope) ? c.Scope : [c.Scope],
          impact: Array.isArray(c.Impact) ? c.Impact : [c.Impact],
          note: c.Note,
        });
      }
    }

    // Extract potential mitigations
    const potentialMitigations: Array<{ phase: string[]; description: string; effectiveness?: string }> = [];
    if (weakness.Potential_Mitigations?.Mitigation) {
      const mitigations = Array.isArray(weakness.Potential_Mitigations.Mitigation)
        ? weakness.Potential_Mitigations.Mitigation
        : [weakness.Potential_Mitigations.Mitigation];
      for (const m of mitigations) {
        const desc = typeof m.Description === 'string' ? m.Description : m.Description?.['#text'] || '';
        potentialMitigations.push({
          phase: Array.isArray(m.Phase) ? m.Phase : [m.Phase],
          description: desc,
          effectiveness: m.Effectiveness,
        });
      }
    }

    // Extract detection methods
    const detectionMethods: Array<{ method: string; description: string; effectiveness?: string }> = [];
    if (weakness.Detection_Methods?.Detection_Method) {
      const methods = Array.isArray(weakness.Detection_Methods.Detection_Method)
        ? weakness.Detection_Methods.Detection_Method
        : [weakness.Detection_Methods.Detection_Method];
      for (const d of methods) {
        const desc = typeof d.Description === 'string' ? d.Description : d.Description?.['#text'] || '';
        detectionMethods.push({
          method: d.Method,
          description: desc,
          effectiveness: d.Effectiveness,
        });
      }
    }

    // Extract applicable platforms
    const applicablePlatforms: { languages: string[]; technologies: string[]; operatingSystems: string[] } = {
      languages: [],
      technologies: [],
      operatingSystems: [],
    };
    if (weakness.Applicable_Platforms) {
      if (weakness.Applicable_Platforms.Language) {
        const langs = Array.isArray(weakness.Applicable_Platforms.Language)
          ? weakness.Applicable_Platforms.Language
          : [weakness.Applicable_Platforms.Language];
        applicablePlatforms.languages = langs.map(l => l['@_Name']);
      }
      if (weakness.Applicable_Platforms.Technology) {
        const techs = Array.isArray(weakness.Applicable_Platforms.Technology)
          ? weakness.Applicable_Platforms.Technology
          : [weakness.Applicable_Platforms.Technology];
        applicablePlatforms.technologies = techs.map(t => t['@_Name']);
      }
      if (weakness.Applicable_Platforms.Operating_System) {
        const os = Array.isArray(weakness.Applicable_Platforms.Operating_System)
          ? weakness.Applicable_Platforms.Operating_System
          : [weakness.Applicable_Platforms.Operating_System];
        applicablePlatforms.operatingSystems = os.map(o => o['@_Name']);
      }
    }

    await this.prisma.cwe.upsert({
      where: { id },
      update: {
        name,
        description,
        extendedDescription,
        relatedWeaknesses,
        commonConsequences,
        potentialMitigations,
        detectionMethods,
        applicablePlatforms,
        likelihoodOfExploit: weakness.Likelihood_Of_Exploit || null,
        updatedAt: new Date(),
      },
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
        likelihoodOfExploit: weakness.Likelihood_Of_Exploit || null,
      },
    });
  }

  // Manual sync trigger
  async syncManual(): Promise<{ synced: number; errors: number }> {
    return this.syncCwes();
  }

  getSourceUrl(): string {
    return CWE_XML_URL;
  }

  // Get sync status
  async getSyncStatus(): Promise<{ lastSync: Date | null; recordCount: number; status: string }> {
    const status = await this.prisma.dataSyncStatus.findUnique({
      where: { sourceType: 'cwe' },
    });
    return {
      lastSync: status?.lastSyncAt || null,
      recordCount: status?.recordCount || 0,
      status: status?.status || 'never',
    };
  }
}
