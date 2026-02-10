import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as https from 'https';
import { parseStringPromise } from 'xml2js';
import AdmZip from 'adm-zip';

interface XmlCategory {
  $: { ID: string; Name: string; Status: string };
  Summary?: string[];
  Relationships?: Array<{
    Has_Member?: Array<{ $: { CWE_ID: string; View_ID: string } }>;
  }>;
}

interface XmlView {
  $: { ID: string; Name: string; Type: string; Status: string };
  Objective?: string[];
  Members?: Array<{
    Has_Member?: Array<{ $: { CWE_ID: string; View_ID: string } }>;
  }>;
}

interface XmlWeakness {
  $: { ID: string };
}

const TARGET_VIEW_IDS = ['699', '1194', '1003', '1400'];

@Injectable()
export class CweViewSyncService {
  private readonly logger = new Logger(CweViewSyncService.name);
  private readonly CWE_URL = 'https://cwe.mitre.org/data/xml/cwec_latest.xml.zip';

  constructor(private readonly prisma: PrismaService) {}

  async sync(): Promise<{ views: number; categories: number; members: number; errors: number }> {
    await this.updateSyncStatus('cwe-views', 'syncing');
    let viewCount = 0;
    let categoryCount = 0;
    let memberCount = 0;
    let errors = 0;

    try {
      this.logger.log('Downloading CWE data for view/category sync...');
      const xmlContent = await this.downloadAndExtract();

      this.logger.log('Parsing CWE XML for views and categories...');
      const parsed = await this.parseXml(xmlContent);

      // Get all weakness IDs to validate member references
      const weaknessIds = new Set(
        parsed.weaknesses.map((w: XmlWeakness) => `CWE-${w.$.ID}`)
      );

      // Process target views
      for (const view of parsed.views) {
        if (!TARGET_VIEW_IDS.includes(view.$.ID)) continue;

        try {
          await this.processView(view);
          viewCount++;
        } catch (error) {
          this.logger.error(`Error processing view CWE-${view.$.ID}:`, error);
          errors++;
        }
      }

      // Process categories that belong to target views
      for (const category of parsed.categories) {
        try {
          const viewMembership = this.findCategoryViewMembership(category, parsed.views);
          if (!viewMembership) continue;

          await this.processCategory(category, viewMembership, weaknessIds);
          categoryCount++;

          // Count members
          const members = category.Relationships?.[0]?.Has_Member || [];
          memberCount += members.filter(
            (m: { $: { CWE_ID: string } }) => weaknessIds.has(`CWE-${m.$.CWE_ID}`)
          ).length;
        } catch (error) {
          this.logger.error(`Error processing category CWE-${category.$.ID}:`, error);
          errors++;
        }
      }

      await this.updateSyncStatus('cwe-views', 'success', viewCount + categoryCount + memberCount);
      this.logger.log(
        `CWE view sync complete: ${viewCount} views, ${categoryCount} categories, ${memberCount} members, ${errors} errors`,
      );
      return { views: viewCount, categories: categoryCount, members: memberCount, errors };
    } catch (error) {
      await this.updateSyncStatus(
        'cwe-views',
        'failed',
        0,
        error instanceof Error ? error.message : 'Unknown error',
      );
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
            const zip = new AdmZip(zipBuffer);
            const entries = zip.getEntries();
            const xmlEntry = entries.find((e: AdmZip.IZipEntry) => e.entryName.endsWith('.xml'));
            if (xmlEntry) {
              resolve(xmlEntry.getData().toString('utf-8'));
            } else {
              reject(new Error('No XML file found in CWE archive'));
            }
          } catch (error) {
            reject(
              new Error(
                `Failed to extract CWE ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`,
              ),
            );
          }
        });
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  private async parseXml(xmlContent: string) {
    const result = await parseStringPromise(xmlContent, {
      explicitArray: true,
      ignoreAttrs: false,
    });

    const views: XmlView[] = result?.Weakness_Catalog?.Views?.[0]?.View || [];
    const categories: XmlCategory[] = result?.Weakness_Catalog?.Categories?.[0]?.Category || [];
    const weaknesses: XmlWeakness[] = result?.Weakness_Catalog?.Weaknesses?.[0]?.Weakness || [];

    this.logger.log(
      `Parsed: ${views.length} views, ${categories.length} categories, ${weaknesses.length} weaknesses`,
    );

    return { views, categories, weaknesses };
  }

  private async processView(view: XmlView): Promise<void> {
    const id = `CWE-${view.$.ID}`;
    const name = view.$.Name;
    const type = view.$.Type;
    const status = view.$.Status;
    const description = this.extractText(view.Objective);

    await this.prisma.cweView.upsert({
      where: { id },
      create: { id, name, type, status, description },
      update: { name, type, status, description },
    });
  }

  private findCategoryViewMembership(
    category: XmlCategory,
    views: XmlView[],
  ): string | null {
    const categoryId = category.$.ID;

    for (const view of views) {
      if (!TARGET_VIEW_IDS.includes(view.$.ID)) continue;

      const members = view.Members?.[0]?.Has_Member || [];
      const isMember = members.some(
        (m: { $: { CWE_ID: string } }) => m.$.CWE_ID === categoryId,
      );
      if (isMember) {
        return `CWE-${view.$.ID}`;
      }
    }

    return null;
  }

  private async processCategory(
    category: XmlCategory,
    viewId: string,
    weaknessIds: Set<string>,
  ): Promise<void> {
    const id = `CWE-${category.$.ID}`;
    const name = category.$.Name;
    const status = category.$.Status;
    const description = this.extractText(category.Summary);

    await this.prisma.cweCategory.upsert({
      where: { id },
      create: { id, name, status, description, viewId },
      update: { name, status, description, viewId },
    });

    // Process members — clear and re-create for idempotent sync
    await this.prisma.cweCategoryMember.deleteMany({
      where: { categoryId: id },
    });

    const members = category.Relationships?.[0]?.Has_Member || [];
    const validMembers = members.filter(
      (m: { $: { CWE_ID: string } }) => weaknessIds.has(`CWE-${m.$.CWE_ID}`),
    );

    if (validMembers.length > 0) {
      await this.prisma.cweCategoryMember.createMany({
        data: validMembers.map((m: { $: { CWE_ID: string } }) => ({
          categoryId: id,
          cweId: `CWE-${m.$.CWE_ID}`,
        })),
        skipDuplicates: true,
      });
    }
  }

  private extractText(arr?: string[]): string {
    if (!arr || arr.length === 0) return '';
    const text = arr[0];
    if (typeof text === 'string') return text.trim();
    if (typeof text === 'object' && '_' in text) return (text as Record<string, string>)._.trim();
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
        nextSyncAt:
          status === 'success' ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined,
      },
      update: {
        status,
        recordCount: recordCount || undefined,
        errorMessage,
        lastSyncAt: now,
        lastSuccessAt: status === 'success' ? now : undefined,
        nextSyncAt:
          status === 'success' ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined,
      },
    });
  }
}
