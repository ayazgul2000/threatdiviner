// apps/api/src/knowledge/sync/capec-sync.service.ts
// CAPEC (Common Attack Pattern Enumeration and Classification) sync service

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import * as https from 'https';
import * as zlib from 'zlib';
import { XMLParser } from 'fast-xml-parser';

const CAPEC_XML_URL = 'https://capec.mitre.org/data/xml/capec_latest.xml';

interface CapecAttackPattern {
  '@_ID': string;
  '@_Name': string;
  '@_Status': string;
  '@_Abstraction': string;
  Description?: string | { '#text': string };
  Likelihood_Of_Attack?: string;
  Typical_Severity?: string;
  Prerequisites?: {
    Prerequisite: string | string[];
  };
  Skills_Required?: {
    Skill: Array<{ '@_Level': string; '#text'?: string }> | { '@_Level': string; '#text'?: string };
  };
  Resources_Required?: {
    Resource: string | string[];
  };
  Indicators?: {
    Indicator: string | string[];
  };
  Consequences?: {
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
  Mitigations?: {
    Mitigation: Array<{
      Description: string | { '#text': string };
      Effectiveness?: string;
    }> | {
      Description: string | { '#text': string };
      Effectiveness?: string;
    };
  };
  Related_Weaknesses?: {
    Related_Weakness: Array<{ '@_CWE_ID': string }> | { '@_CWE_ID': string };
  };
  Related_Attack_Patterns?: {
    Related_Attack_Pattern: Array<{ '@_CAPEC_ID': string; '@_Nature': string }> | { '@_CAPEC_ID': string; '@_Nature': string };
  };
  Execution_Flow?: {
    Attack_Step: Array<{
      Step: string;
      Phase: string;
      Description: string | { '#text': string };
      Technique?: string | string[];
    }>;
  };
}

@Injectable()
export class CapecSyncService {
  private readonly logger = new Logger(CapecSyncService.name);
  private readonly parser: XMLParser;

  constructor(private readonly prisma: PrismaService) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      isArray: (name) => ['Attack_Pattern', 'Prerequisite', 'Skill', 'Resource', 'Indicator', 'Consequence', 'Mitigation', 'Related_Weakness', 'Related_Attack_Pattern', 'Attack_Step', 'Technique'].includes(name),
    });
  }

  // Monthly full sync
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async syncCapecs(): Promise<{ synced: number; errors: number }> {
    this.logger.log('CAPEC sync starting...');
    let synced = 0;
    let errors = 0;

    try {
      const xmlData = await this.downloadXml();
      const parsed = this.parser.parse(xmlData);
      const patterns = parsed?.Attack_Pattern_Catalog?.Attack_Patterns?.Attack_Pattern || [];

      this.logger.log(`Found ${patterns.length} CAPEC attack patterns to process`);

      // Process in batches of 100
      const batchSize = 100;
      for (let i = 0; i < patterns.length; i += batchSize) {
        const batch = patterns.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((pattern: CapecAttackPattern) => this.upsertCapec(pattern))
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            synced++;
          } else {
            errors++;
            this.logger.warn(`CAPEC sync error: ${result.reason}`);
          }
        }

        // Log progress
        if ((i + batchSize) % 200 === 0) {
          this.logger.log(`Processed ${Math.min(i + batchSize, patterns.length)}/${patterns.length} CAPECs`);
        }
      }

      // Update sync status
      await this.prisma.dataSyncStatus.upsert({
        where: { sourceType: 'capec' },
        update: {
          lastSyncAt: new Date(),
          recordCount: synced,
          status: errors > 0 ? 'partial' : 'success',
          errorMessage: errors > 0 ? `${errors} records failed` : null,
        },
        create: {
          sourceType: 'capec',
          lastSyncAt: new Date(),
          recordCount: synced,
          status: errors > 0 ? 'partial' : 'success',
        },
      });

      this.logger.log(`CAPEC sync complete: ${synced} synced, ${errors} errors`);
    } catch (e) {
      this.logger.error('CAPEC sync failed', e);
      await this.prisma.dataSyncStatus.upsert({
        where: { sourceType: 'capec' },
        update: {
          status: 'failed',
          errorMessage: e instanceof Error ? e.message : String(e),
        },
        create: {
          sourceType: 'capec',
          status: 'failed',
          errorMessage: e instanceof Error ? e.message : String(e),
        },
      });
    }

    return { synced, errors };
  }

  private async downloadXml(): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(CAPEC_XML_URL, (res) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            https.get(redirectUrl, (redirectRes) => {
              this.handleResponse(redirectRes, resolve, reject);
            }).on('error', reject);
          } else {
            reject(new Error('Redirect without location header'));
          }
          return;
        }
        this.handleResponse(res, resolve, reject);
      }).on('error', reject);
    });
  }

  private handleResponse(res: any, resolve: (value: string) => void, reject: (reason: Error) => void): void {
    if (res.statusCode !== 200) {
      reject(new Error(`HTTP ${res.statusCode}`));
      return;
    }

    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const contentEncoding = res.headers['content-encoding'];

        if (contentEncoding === 'gzip') {
          const decompressed = zlib.gunzipSync(buffer);
          resolve(decompressed.toString('utf-8'));
        } else {
          resolve(buffer.toString('utf-8'));
        }
      } catch (e) {
        reject(e as Error);
      }
    });
    res.on('error', reject);
  }

  private async upsertCapec(pattern: CapecAttackPattern): Promise<void> {
    const capecId = `CAPEC-${pattern['@_ID']}`;
    const name = pattern['@_Name'] || '';

    // Extract description
    const description = typeof pattern.Description === 'string'
      ? pattern.Description
      : pattern.Description?.['#text'] || '';

    // Extract attack steps from execution flow
    const attackSteps: Array<{ step: string; phase: string; description: string; techniques: string[] }> = [];
    if (pattern.Execution_Flow?.Attack_Step) {
      for (const step of pattern.Execution_Flow.Attack_Step) {
        const stepDesc = typeof step.Description === 'string'
          ? step.Description
          : step.Description?.['#text'] || '';
        attackSteps.push({
          step: step.Step,
          phase: step.Phase,
          description: stepDesc,
          techniques: step.Technique
            ? (Array.isArray(step.Technique) ? step.Technique : [step.Technique])
            : [],
        });
      }
    }

    // Extract prerequisites
    const prerequisites: string[] = [];
    if (pattern.Prerequisites?.Prerequisite) {
      const prereqs = Array.isArray(pattern.Prerequisites.Prerequisite)
        ? pattern.Prerequisites.Prerequisite
        : [pattern.Prerequisites.Prerequisite];
      prerequisites.push(...prereqs);
    }

    // Extract skills required
    const skillsRequired: Array<{ level: string; description: string }> = [];
    if (pattern.Skills_Required?.Skill) {
      const skills = Array.isArray(pattern.Skills_Required.Skill)
        ? pattern.Skills_Required.Skill
        : [pattern.Skills_Required.Skill];
      for (const s of skills) {
        skillsRequired.push({
          level: s['@_Level'] || 'Unknown',
          description: s['#text'] || '',
        });
      }
    }

    // Extract resources required
    const resourcesRequired: string[] = [];
    if (pattern.Resources_Required?.Resource) {
      const resources = Array.isArray(pattern.Resources_Required.Resource)
        ? pattern.Resources_Required.Resource
        : [pattern.Resources_Required.Resource];
      resourcesRequired.push(...resources);
    }

    // Extract indicators
    const indicators: string[] = [];
    if (pattern.Indicators?.Indicator) {
      const inds = Array.isArray(pattern.Indicators.Indicator)
        ? pattern.Indicators.Indicator
        : [pattern.Indicators.Indicator];
      indicators.push(...inds);
    }

    // Extract consequences
    const consequences: Array<{ scope: string[]; impact: string[]; note?: string }> = [];
    if (pattern.Consequences?.Consequence) {
      const cons = Array.isArray(pattern.Consequences.Consequence)
        ? pattern.Consequences.Consequence
        : [pattern.Consequences.Consequence];
      for (const c of cons) {
        consequences.push({
          scope: Array.isArray(c.Scope) ? c.Scope : [c.Scope],
          impact: Array.isArray(c.Impact) ? c.Impact : [c.Impact],
          note: c.Note,
        });
      }
    }

    // Extract mitigations
    const mitigations: Array<{ description: string; effectiveness?: string }> = [];
    if (pattern.Mitigations?.Mitigation) {
      const mits = Array.isArray(pattern.Mitigations.Mitigation)
        ? pattern.Mitigations.Mitigation
        : [pattern.Mitigations.Mitigation];
      for (const m of mits) {
        const desc = typeof m.Description === 'string'
          ? m.Description
          : m.Description?.['#text'] || '';
        mitigations.push({
          description: desc,
          effectiveness: m.Effectiveness,
        });
      }
    }

    // Extract related CWEs
    const relatedCwes: string[] = [];
    if (pattern.Related_Weaknesses?.Related_Weakness) {
      const weaknesses = Array.isArray(pattern.Related_Weaknesses.Related_Weakness)
        ? pattern.Related_Weaknesses.Related_Weakness
        : [pattern.Related_Weaknesses.Related_Weakness];
      for (const w of weaknesses) {
        relatedCwes.push(`CWE-${w['@_CWE_ID']}`);
      }
    }

    // Upsert into the Capec model (knowledge base simplified model)
    await this.prisma.capec.upsert({
      where: { capecId },
      update: {
        name,
        description,
        attackSteps,
        prerequisites,
        skillsRequired,
        resourcesRequired,
        indicators,
        consequences,
        mitigations,
        relatedCwes,
        severity: pattern.Typical_Severity || null,
        updatedAt: new Date(),
      },
      create: {
        capecId,
        name,
        description,
        attackSteps,
        prerequisites,
        skillsRequired,
        resourcesRequired,
        indicators,
        consequences,
        mitigations,
        relatedCwes,
        severity: pattern.Typical_Severity || null,
      },
    });

    // Also sync to CapecPattern model with full data structure
    await this.prisma.capecPattern.upsert({
      where: { id: capecId },
      update: {
        name,
        description,
        likelihood: pattern.Likelihood_Of_Attack || null,
        severity: pattern.Typical_Severity || null,
        prerequisites,
        skillsRequired,
        resourcesRequired,
        consequences,
        mitigations,
        relatedCwes,
        relatedAttackPatterns: this.extractRelatedPatterns(pattern),
        url: `https://capec.mitre.org/data/definitions/${pattern['@_ID']}.html`,
        updatedAt: new Date(),
      },
      create: {
        id: capecId,
        name,
        description,
        likelihood: pattern.Likelihood_Of_Attack || null,
        severity: pattern.Typical_Severity || null,
        prerequisites,
        skillsRequired,
        resourcesRequired,
        consequences,
        mitigations,
        relatedCwes,
        relatedAttackPatterns: this.extractRelatedPatterns(pattern),
        url: `https://capec.mitre.org/data/definitions/${pattern['@_ID']}.html`,
      },
    });
  }

  private extractRelatedPatterns(pattern: CapecAttackPattern): string[] {
    const related: string[] = [];
    if (pattern.Related_Attack_Patterns?.Related_Attack_Pattern) {
      const patterns = Array.isArray(pattern.Related_Attack_Patterns.Related_Attack_Pattern)
        ? pattern.Related_Attack_Patterns.Related_Attack_Pattern
        : [pattern.Related_Attack_Patterns.Related_Attack_Pattern];
      for (const p of patterns) {
        related.push(`CAPEC-${p['@_CAPEC_ID']}`);
      }
    }
    return related;
  }

  // Manual sync trigger
  async syncManual(): Promise<{ synced: number; errors: number }> {
    return this.syncCapecs();
  }

  getSourceUrl(): string {
    return CAPEC_XML_URL;
  }

  // Get sync status
  async getSyncStatus(): Promise<{ lastSync: Date | null; recordCount: number; status: string }> {
    const status = await this.prisma.dataSyncStatus.findUnique({
      where: { sourceType: 'capec' },
    });
    return {
      lastSync: status?.lastSyncAt || null,
      recordCount: status?.recordCount || 0,
      status: status?.status || 'never',
    };
  }
}
