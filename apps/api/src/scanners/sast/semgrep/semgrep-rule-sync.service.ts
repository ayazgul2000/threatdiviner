import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

interface SemgrepRule {
  id: string;
  metadata?: {
    cwe?: string | string[];
    owasp?: string | string[];
    severity?: string;
    category?: string;
    technology?: string[];
    confidence?: string;
  };
  severity?: string;
  message?: string;
  pattern?: string;
  patterns?: any[];
  languages?: string[];
}


@Injectable()
export class SemgrepRuleSyncService {
  private readonly logger = new Logger(SemgrepRuleSyncService.name);
  private readonly rulesDir: string;
  private readonly registryDir: string;
  private readonly rulePacks: string[];
  private readonly enabled: boolean;

  // Semgrep registry API endpoints
  private readonly REGISTRY_BASE = 'https://semgrep.dev';

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Rules are stored in src/ folder, not dist/
    // Calculate path relative to project root (apps/api)
    const projectRoot = this.findProjectRoot(__dirname);
    this.rulesDir = path.join(projectRoot, 'src', 'scanners', 'sast', 'semgrep', 'rules');
    this.registryDir = path.join(this.rulesDir, 'registry');
    this.enabled = this.configService.get('SEMGREP_RULE_SYNC', 'true') === 'true';

    // Default rule packs to sync
    const defaultPacks = 'p/default,p/security-audit,p/owasp-top-ten,p/cwe-top-25,p/secrets';
    this.rulePacks = this.configService.get('SEMGREP_RULE_PACKS', defaultPacks).split(',').map((p: string) => p.trim());

    this.logger.log(`Rules directory: ${this.rulesDir}`);
    this.logger.log(`Registry directory: ${this.registryDir}`);
  }

  /**
   * Find the project root by looking for package.json
   */
  private findProjectRoot(startDir: string): string {
    let dir = startDir;
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    // Fallback: assume we're in dist/scanners/sast/semgrep or src/scanners/sast/semgrep
    return path.resolve(startDir, '..', '..', '..', '..');
  }

  async sync(): Promise<{ totalRules: number; packs: number; errors: string[] }> {
    if (!this.enabled) {
      this.logger.log('Semgrep rule sync is disabled');
      return { totalRules: 0, packs: 0, errors: [] };
    }

    await this.updateSyncStatus('semgrep-rules', 'syncing');

    const errors: string[] = [];
    let totalRules = 0;
    let packsProcessed = 0;

    try {
      // Ensure registry directory exists
      this.ensureDirectoryExists(this.registryDir);

      for (const pack of this.rulePacks) {
        try {
          this.logger.log(`Fetching rule pack: ${pack}`);
          const rules = await this.fetchRulePack(pack);

          if (rules.length > 0) {
            const packName = pack.replace('p/', '').replace(/\//g, '-');
            await this.saveRulePack(packName, rules);
            totalRules += rules.length;
            packsProcessed++;
            this.logger.log(`Saved ${rules.length} rules from ${pack}`);
          }
        } catch (error) {
          const errMsg = `Failed to fetch ${pack}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.logger.error(errMsg);
          errors.push(errMsg);
        }
      }

      // Save metadata
      await this.saveMetadata(totalRules, packsProcessed);

      await this.updateSyncStatus('semgrep-rules', 'success', totalRules);
      this.logger.log(`Semgrep rule sync complete: ${totalRules} rules from ${packsProcessed} packs`);

      return { totalRules, packs: packsProcessed, errors };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      await this.updateSyncStatus('semgrep-rules', 'failed', totalRules, errMsg);
      throw error;
    }
  }

  private async fetchRulePack(pack: string): Promise<SemgrepRule[]> {
    // Use semgrep CLI to download rules as YAML
    // Alternative: Use the registry API directly
    return new Promise((resolve, reject) => {
      const packPath = pack.startsWith('p/') ? pack : `p/${pack}`;
      const url = `${this.REGISTRY_BASE}/c/${packPath}`;

      https.get(url, { headers: { 'Accept': 'application/json' } }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Follow redirect
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            this.fetchFromUrl(redirectUrl).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          try {
            const data = Buffer.concat(chunks).toString('utf-8');
            const rules = this.parseRulesFromYaml(data, pack);
            resolve(rules);
          } catch (error) {
            reject(error);
          }
        });
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  private fetchFromUrl(url: string): Promise<SemgrepRule[]> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : require('http');

      protocol.get(url, (response: any) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          try {
            const data = Buffer.concat(chunks).toString('utf-8');
            const rules = this.parseRulesFromYaml(data, url);
            resolve(rules);
          } catch (error) {
            reject(error);
          }
        });
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  private parseRulesFromYaml(content: string, source: string): any[] {
    // Semgrep rules are in YAML format
    // Preserve the full rule structure to maintain all pattern types
    const yaml = require('js-yaml');

    try {
      const parsed = yaml.load(content);

      if (parsed && parsed.rules && Array.isArray(parsed.rules)) {
        // Return rules as-is to preserve all fields (pattern, patterns, pattern-either, etc.)
        return parsed.rules.filter((rule: any) => rule.id);
      }

      return [];
    } catch {
      // If YAML parsing fails, return empty
      this.logger.warn(`Failed to parse YAML from ${source}`);
      return [];
    }
  }

  private async saveRulePack(packName: string, rules: any[]): Promise<void> {
    const packDir = path.join(this.registryDir, packName);
    this.ensureDirectoryExists(packDir);

    // Clean rules: remove null values and filter out rules with Unicode patterns
    // that would become empty after sanitization (e.g., bidi/trojan detection rules)
    const cleanedRules = this.removeNullValues(rules).filter((rule: any) => {
      return !this.hasEmptyPatternAfterSanitize(rule);
    });

    this.logger.debug(`Pack ${packName}: ${cleanedRules.length}/${rules.length} rules after filtering`);

    // Save as a single YAML file per pack (sanitized for Windows compatibility)
    const yaml = require('js-yaml');
    const rulesYaml = this.sanitizeContent(yaml.dump({ rules: cleanedRules }));

    const filePath = path.join(packDir, `${packName}.yaml`);
    fs.writeFileSync(filePath, rulesYaml, 'utf-8');

    // Also save individual rules for granular control
    for (const rule of cleanedRules) {
      const ruleFileName = this.sanitizeFileName(rule.id) + '.yaml';
      const rulePath = path.join(packDir, ruleFileName);
      const ruleYaml = this.sanitizeContent(yaml.dump({ rules: [rule] }));
      fs.writeFileSync(rulePath, ruleYaml, 'utf-8');
    }
  }

  /**
   * Check if a rule has patterns that would become empty after sanitization
   */
  private hasEmptyPatternAfterSanitize(rule: any): boolean {
    const checkPatterns = (obj: any): boolean => {
      if (typeof obj === 'string') {
        // Check if this is a pattern value that would become empty
        const sanitized = this.sanitizeContent(obj);
        return obj.length > 0 && sanitized.trim().length === 0;
      }
      if (Array.isArray(obj)) {
        return obj.some(item => checkPatterns(item));
      }
      if (obj && typeof obj === 'object') {
        // Check pattern-related keys
        const patternKeys = ['pattern', 'pattern-regex', 'pattern-either', 'pattern-inside', 'pattern-not', 'pattern-not-inside', 'patterns'];
        for (const key of patternKeys) {
          if (obj[key] && checkPatterns(obj[key])) {
            return true;
          }
        }
      }
      return false;
    };
    return checkPatterns(rule);
  }

  private async saveMetadata(totalRules: number, packs: number): Promise<void> {
    const metadata = {
      syncedAt: new Date().toISOString(),
      totalRules,
      packs,
      rulePacks: this.rulePacks,
    };

    const metadataPath = path.join(this.registryDir, '_metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 100);
  }

  /**
   * Recursively remove null/undefined values from an object
   */
  private removeNullValues(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeNullValues(item)).filter(item => item !== null && item !== undefined);
    }
    if (obj !== null && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined) {
          result[key] = this.removeNullValues(value);
        }
      }
      return result;
    }
    return obj;
  }

  /**
   * Sanitize string content to remove non-ASCII characters that cause
   * encoding issues on Windows with Semgrep's charmap codec.
   */
  private sanitizeContent(content: string): string {
    // Replace common problematic Unicode characters with ASCII equivalents
    return content
      // Smart quotes to regular quotes
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      // Dashes
      .replace(/[\u2013\u2014]/g, '-')
      // Ellipsis
      .replace(/\u2026/g, '...')
      // Other common replacements
      .replace(/\u00A0/g, ' ')  // Non-breaking space
      .replace(/\u00B7/g, '*')  // Middle dot
      // Remove any remaining non-ASCII characters
      .replace(/[^\x00-\x7F]/g, '');
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
      },
      update: {
        status,
        recordCount: recordCount || undefined,
        errorMessage,
        lastSyncAt: now,
        lastSuccessAt: status === 'success' ? now : undefined,
      },
    });
  }

  getRegistryRulesPath(): string {
    return this.registryDir;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
