// apps/api/src/knowledge/sync/owasp-sync.service.ts
// OWASP Cheatsheet sync service - fetches from GitHub API

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import * as https from 'https';

// GitHub API endpoint for OWASP CheatSheetSeries
const GITHUB_API_BASE = 'https://api.github.com/repos/OWASP/CheatSheetSeries/contents/cheatsheets';
const RAW_CONTENT_BASE = 'https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets';

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
}

interface CheatsheetSection {
  title: string;
  content: string;
  level: number;
}

@Injectable()
export class OwaspSyncService {
  private readonly logger = new Logger(OwaspSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Weekly sync for cheatsheets
  @Cron(CronExpression.EVERY_WEEK)
  async syncCheatsheets(): Promise<{ synced: number; errors: number }> {
    this.logger.log('OWASP Cheatsheet sync starting...');
    let synced = 0;
    let errors = 0;

    try {
      // Get list of cheatsheet files from GitHub API
      const files = await this.listCheatsheets();
      const mdFiles = files.filter(f => f.name.endsWith('.md') && f.name !== 'Index.md');

      this.logger.log(`Found ${mdFiles.length} cheatsheets to process`);

      // Process in batches to avoid rate limiting
      const batchSize = 10;
      for (let i = 0; i < mdFiles.length; i += batchSize) {
        const batch = mdFiles.slice(i, i + batchSize);

        for (const file of batch) {
          try {
            const content = await this.downloadCheatsheet(file.name);
            await this.upsertCheatsheet(file.name, content);
            synced++;
          } catch (e) {
            errors++;
            this.logger.warn(`Failed to sync ${file.name}: ${e}`);
          }
        }

        // Log progress
        this.logger.log(`Processed ${Math.min(i + batchSize, mdFiles.length)}/${mdFiles.length} cheatsheets`);

        // Rate limiting delay between batches
        if (i + batchSize < mdFiles.length) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      // Update sync status
      await this.prisma.dataSyncStatus.upsert({
        where: { sourceType: 'owasp-cheatsheet' },
        update: {
          lastSyncAt: new Date(),
          recordCount: synced,
          status: errors > 0 ? 'partial' : 'success',
          errorMessage: errors > 0 ? `${errors} records failed` : null,
        },
        create: {
          sourceType: 'owasp-cheatsheet',
          lastSyncAt: new Date(),
          recordCount: synced,
          status: errors > 0 ? 'partial' : 'success',
        },
      });

      this.logger.log(`OWASP Cheatsheet sync complete: ${synced} synced, ${errors} errors`);
    } catch (e) {
      this.logger.error('OWASP Cheatsheet sync failed', e);
      await this.prisma.dataSyncStatus.upsert({
        where: { sourceType: 'owasp-cheatsheet' },
        update: {
          status: 'failed',
          errorMessage: e instanceof Error ? e.message : String(e),
        },
        create: {
          sourceType: 'owasp-cheatsheet',
          status: 'failed',
          errorMessage: e instanceof Error ? e.message : String(e),
        },
      });
    }

    return { synced, errors };
  }

  private async listCheatsheets(): Promise<GitHubFile[]> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: '/repos/OWASP/CheatSheetSeries/contents/cheatsheets',
        headers: {
          'User-Agent': 'ThreatDiviner-Knowledge-Sync',
          Accept: 'application/vnd.github.v3+json',
        },
      };

      https.get(options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned ${res.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            resolve(data as GitHubFile[]);
          } catch (e) {
            reject(e);
          }
        });
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  private async downloadCheatsheet(filename: string): Promise<string> {
    const url = `${RAW_CONTENT_BASE}/${encodeURIComponent(filename)}`;

    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        // Handle redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            https.get(redirectUrl, (redirectRes) => {
              this.handleContentResponse(redirectRes, resolve, reject);
            }).on('error', reject);
          } else {
            reject(new Error('Redirect without location'));
          }
          return;
        }
        this.handleContentResponse(res, resolve, reject);
      }).on('error', reject);
    });
  }

  private handleContentResponse(
    res: any,
    resolve: (value: string) => void,
    reject: (reason: Error) => void
  ): void {
    if (res.statusCode !== 200) {
      reject(new Error(`HTTP ${res.statusCode}`));
      return;
    }

    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    res.on('error', reject);
  }

  private async upsertCheatsheet(filename: string, content: string): Promise<void> {
    // Generate slug from filename
    const slug = filename
      .replace(/_Cheat_Sheet\.md$/, '')
      .replace(/_/g, '-')
      .toLowerCase();

    // Extract title from first H1
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : filename.replace(/_/g, ' ').replace('.md', '');

    // Parse sections from markdown
    const sections = this.parseMarkdownSections(content);

    await this.prisma.owaspCheatsheet.upsert({
      where: { slug },
      update: {
        title,
        content,
        sections,
        updatedAt: new Date(),
      },
      create: {
        slug,
        title,
        content,
        sections,
      },
    });
  }

  private parseMarkdownSections(content: string): CheatsheetSection[] {
    const sections: CheatsheetSection[] = [];
    const lines = content.split('\n');
    let currentSection: CheatsheetSection | null = null;
    let contentBuffer: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.content = contentBuffer.join('\n').trim();
          if (currentSection.content) {
            sections.push(currentSection);
          }
        }

        // Start new section
        currentSection = {
          title: headerMatch[2].trim(),
          content: '',
          level: headerMatch[1].length,
        };
        contentBuffer = [];
      } else if (currentSection) {
        contentBuffer.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.content = contentBuffer.join('\n').trim();
      if (currentSection.content) {
        sections.push(currentSection);
      }
    }

    return sections;
  }

  // Manual sync trigger
  async syncManual(): Promise<{ synced: number; errors: number }> {
    return this.syncCheatsheets();
  }

  getSourceUrl(): string {
    return 'https://github.com/OWASP/CheatSheetSeries';
  }

  // Get sync status
  async getSyncStatus(): Promise<{ lastSync: Date | null; recordCount: number; status: string }> {
    const status = await this.prisma.dataSyncStatus.findUnique({
      where: { sourceType: 'owasp-cheatsheet' },
    });
    return {
      lastSync: status?.lastSyncAt || null,
      recordCount: status?.recordCount || 0,
      status: status?.status || 'never',
    };
  }

  // Search cheatsheets by keyword
  async searchCheatsheets(query: string): Promise<Array<{ slug: string; title: string; excerpt: string }>> {
    const cheatsheets = await this.prisma.owaspCheatsheet.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        slug: true,
        title: true,
        content: true,
      },
      take: 10,
    });

    return cheatsheets.map(cs => ({
      slug: cs.slug,
      title: cs.title,
      excerpt: this.extractExcerpt(cs.content, query),
    }));
  }

  private extractExcerpt(content: string, query: string): string {
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerContent.indexOf(lowerQuery);

    if (index === -1) {
      return content.substring(0, 200) + '...';
    }

    const start = Math.max(0, index - 100);
    const end = Math.min(content.length, index + query.length + 100);
    let excerpt = content.substring(start, end);

    if (start > 0) excerpt = '...' + excerpt;
    if (end < content.length) excerpt = excerpt + '...';

    return excerpt;
  }

  // Get cheatsheet by slug
  async getCheatsheet(slug: string): Promise<{
    slug: string;
    title: string;
    content: string;
    sections: CheatsheetSection[];
  } | null> {
    const cheatsheet = await this.prisma.owaspCheatsheet.findUnique({
      where: { slug },
    });

    if (!cheatsheet) return null;

    return {
      slug: cheatsheet.slug,
      title: cheatsheet.title,
      content: cheatsheet.content,
      sections: cheatsheet.sections as CheatsheetSection[],
    };
  }
}
