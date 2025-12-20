import { Injectable, Logger } from '@nestjs/common';
import { NormalizedFinding, Severity, Confidence } from '../interfaces';
import * as crypto from 'crypto';

// SARIF 2.1.0 types (simplified)
interface SarifReport {
  $schema?: string;
  version: string;
  runs: SarifRun[];
}

interface SarifRun {
  tool: {
    driver: {
      name: string;
      version?: string;
      rules?: SarifRule[];
    };
  };
  results: SarifResult[];
}

interface SarifRule {
  id: string;
  name?: string;
  shortDescription?: { text: string };
  fullDescription?: { text: string };
  helpUri?: string;
  defaultConfiguration?: {
    level?: 'error' | 'warning' | 'note' | 'none';
  };
  properties?: {
    tags?: string[];
    precision?: string;
    'security-severity'?: string;
  };
}

interface SarifResult {
  ruleId: string;
  ruleIndex?: number;
  level?: 'error' | 'warning' | 'note' | 'none';
  message: { text: string };
  locations?: SarifLocation[];
  fingerprints?: Record<string, string>;
  partialFingerprints?: Record<string, string>;
  fixes?: SarifFix[];
  properties?: Record<string, unknown>;
}

interface SarifLocation {
  physicalLocation?: {
    artifactLocation?: {
      uri?: string;
      uriBaseId?: string;
    };
    region?: {
      startLine?: number;
      endLine?: number;
      startColumn?: number;
      endColumn?: number;
      snippet?: { text: string };
    };
  };
}

interface SarifFix {
  description?: { text: string };
  artifactChanges?: Array<{
    artifactLocation?: { uri: string };
    replacements?: Array<{
      deletedRegion?: { startLine: number; endLine: number };
      insertedContent?: { text: string };
    }>;
  }>;
}

@Injectable()
export class SarifParser {
  private readonly logger = new Logger(SarifParser.name);

  parse(sarifJson: string, scannerName: string): NormalizedFinding[] {
    try {
      const report: SarifReport = JSON.parse(sarifJson);
      const findings: NormalizedFinding[] = [];

      for (const run of report.runs) {
        const rules = this.buildRuleMap(run.tool.driver.rules || []);

        for (const result of run.results) {
          const finding = this.convertResult(result, rules, scannerName);
          if (finding) {
            findings.push(finding);
          }
        }
      }

      this.logger.log(`Parsed ${findings.length} findings from SARIF`);
      return findings;
    } catch (error) {
      this.logger.error(`Failed to parse SARIF: ${error}`);
      return [];
    }
  }

  private buildRuleMap(rules: SarifRule[]): Map<string, SarifRule> {
    const map = new Map<string, SarifRule>();
    for (const rule of rules) {
      map.set(rule.id, rule);
    }
    return map;
  }

  private convertResult(
    result: SarifResult,
    rules: Map<string, SarifRule>,
    scannerName: string,
  ): NormalizedFinding | null {
    const rule = rules.get(result.ruleId);
    const location = result.locations?.[0]?.physicalLocation;

    if (!location?.artifactLocation?.uri) {
      return null;
    }

    const filePath = this.normalizeFilePath(location.artifactLocation.uri);
    const startLine = location.region?.startLine || 1;
    const snippet = location.region?.snippet?.text;

    // Generate fingerprint
    const fingerprint = this.generateFingerprint(
      result.ruleId,
      filePath,
      startLine,
      snippet,
    );

    // Extract CWE/CVE/OWASP from rule properties
    const { cweIds, cveIds, owaspIds } = this.extractSecurityIds(rule);

    return {
      scanner: scannerName,
      ruleId: result.ruleId,
      severity: this.mapSeverity(result.level, rule),
      confidence: this.mapConfidence(rule),
      title: rule?.shortDescription?.text || result.ruleId,
      description: result.message.text,
      filePath,
      startLine,
      endLine: location.region?.endLine,
      startColumn: location.region?.startColumn,
      endColumn: location.region?.endColumn,
      snippet,
      cweIds,
      cveIds,
      owaspIds,
      references: rule?.helpUri ? [rule.helpUri] : [],
      fix: this.extractFix(result),
      fingerprint,
      metadata: {
        ruleIndex: result.ruleIndex,
        properties: result.properties,
      },
    };
  }

  private normalizeFilePath(uri: string): string {
    // Remove file:// prefix and normalize slashes
    return uri
      .replace(/^file:\/\//, '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');
  }

  private mapSeverity(
    level: string | undefined,
    rule?: SarifRule,
  ): Severity {
    // Check for security-severity in rule properties
    const securitySeverity = rule?.properties?.['security-severity'];
    if (securitySeverity) {
      const score = parseFloat(securitySeverity);
      if (score >= 9.0) return 'critical';
      if (score >= 7.0) return 'high';
      if (score >= 4.0) return 'medium';
      if (score >= 0.1) return 'low';
      return 'info';
    }

    // Fall back to level mapping
    switch (level || rule?.defaultConfiguration?.level) {
      case 'error':
        return 'high';
      case 'warning':
        return 'medium';
      case 'note':
        return 'low';
      default:
        return 'info';
    }
  }

  private mapConfidence(rule?: SarifRule): Confidence {
    const precision = rule?.properties?.precision;
    switch (precision) {
      case 'very-high':
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      default:
        return 'low';
    }
  }

  private extractSecurityIds(rule?: SarifRule): {
    cweIds: string[];
    cveIds: string[];
    owaspIds: string[];
  } {
    const cweIds: string[] = [];
    const cveIds: string[] = [];
    const owaspIds: string[] = [];

    const tags = rule?.properties?.tags || [];
    for (const tag of tags) {
      if (tag.startsWith('CWE-')) {
        cweIds.push(tag);
      } else if (tag.startsWith('CVE-')) {
        cveIds.push(tag);
      } else if (tag.match(/^A\d{2}:\d{4}/)) {
        owaspIds.push(tag);
      }
    }

    return { cweIds, cveIds, owaspIds };
  }

  private extractFix(result: SarifResult): NormalizedFinding['fix'] | undefined {
    const fix = result.fixes?.[0];
    if (!fix) return undefined;

    return {
      description: fix.description?.text || 'Suggested fix available',
    };
  }

  private generateFingerprint(
    ruleId: string,
    filePath: string,
    startLine: number,
    snippet?: string,
  ): string {
    // Create a stable fingerprint for deduplication
    const data = [
      ruleId,
      filePath,
      startLine.toString(),
      snippet ? this.normalizeSnippet(snippet) : '',
    ].join('|');

    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 32);
  }

  private normalizeSnippet(snippet: string): string {
    // Remove whitespace variations for stable fingerprint
    return snippet.replace(/\s+/g, ' ').trim();
  }
}
