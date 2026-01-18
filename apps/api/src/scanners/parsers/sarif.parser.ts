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

    // Extract CWE/CVE/OWASP/CAPEC/ATT&CK from rule properties and ruleId
    const { cweIds, cveIds, owaspIds, capecIds, attackIds } = this.extractSecurityIds(rule, result.ruleId);

    return {
      scanner: scannerName,
      ruleId: result.ruleId,
      severity: this.mapSeverity(result.level, rule),
      confidence: this.mapConfidence(rule),
      title: this.getCleanTitle(rule, result.ruleId),
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
      capecIds,
      attackIds,
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

  /**
   * Get a clean title from rule metadata or ruleId
   * Handles cases where shortDescription/name contains full paths
   */
  private getCleanTitle(rule: SarifRule | undefined, ruleId: string): string {
    const rawTitle = rule?.shortDescription?.text || rule?.name || ruleId;

    // If the title looks like a path (contains multiple dots or slashes), extract clean name
    if (rawTitle.split(/[./]/).length > 3) {
      return this.extractCleanRuleName(rawTitle);
    }

    return rawTitle;
  }

  /**
   * Extract a clean, readable rule name from a full rule ID path
   */
  private extractCleanRuleName(ruleId: string): string {
    // Handle paths like "C.Dev.threatdiviner-v0.2.0.apps.api.src.scanners.sast.semgrep.rules.custom.sql-injection"
    // or "javascript.lang.security.detect-child-process"
    const parts = ruleId.split(/[./]/);
    const ruleName = parts[parts.length - 1] || ruleId;
    // Convert kebab-case to Title Case
    return ruleName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private extractSecurityIds(rule?: SarifRule, ruleId?: string): {
    cweIds: string[];
    cveIds: string[];
    owaspIds: string[];
    capecIds: string[];
    attackIds: string[];
  } {
    const cweIds: string[] = [];
    const cveIds: string[] = [];
    const owaspIds: string[] = [];
    const capecIds: string[] = [];
    const attackIds: string[] = [];

    const tags = rule?.properties?.tags || [];
    for (const tag of tags) {
      if (tag.startsWith('CWE-')) {
        cweIds.push(tag);
      } else if (tag.startsWith('CVE-')) {
        cveIds.push(tag);
      } else if (tag.match(/^A\d{2}:\d{4}/)) {
        owaspIds.push(tag);
      } else if (tag.startsWith('CAPEC-')) {
        capecIds.push(tag);
      } else if (tag.match(/^T\d{4}/)) {
        // MITRE ATT&CK technique IDs like T1059
        attackIds.push(tag);
      }
    }

    // For scanners like Trivy, CVE is often in the ruleId directly
    if (ruleId && cveIds.length === 0) {
      const cveMatch = ruleId.match(/CVE-\d{4}-\d+/i);
      if (cveMatch) {
        cveIds.push(cveMatch[0].toUpperCase());
      }
    }

    // Map CWE to CAPEC and ATT&CK if not already present
    if (cweIds.length > 0 && (capecIds.length === 0 || attackIds.length === 0)) {
      const mappings = this.getCweSecurityMappings(cweIds[0]);
      if (capecIds.length === 0 && mappings.capec) {
        capecIds.push(...mappings.capec);
      }
      if (attackIds.length === 0 && mappings.attack) {
        attackIds.push(...mappings.attack);
      }
      if (owaspIds.length === 0 && mappings.owasp) {
        owaspIds.push(...mappings.owasp);
      }
    }

    return { cweIds, cveIds, owaspIds, capecIds, attackIds };
  }

  /**
   * Map CWE to CAPEC, ATT&CK, and OWASP
   */
  private getCweSecurityMappings(cweId: string): { capec: string[]; attack: string[]; owasp: string[] } {
    const cweNumber = cweId.replace('CWE-', '');
    const mappings: Record<string, { capec: string[]; attack: string[]; owasp: string[] }> = {
      // Injection flaws
      '89': { capec: ['CAPEC-66'], attack: ['T1190'], owasp: ['A03:2021'] },   // SQL Injection
      '78': { capec: ['CAPEC-88'], attack: ['T1059'], owasp: ['A03:2021'] },   // OS Command Injection
      '79': { capec: ['CAPEC-86'], attack: ['T1059.007'], owasp: ['A03:2021'] }, // XSS
      '94': { capec: ['CAPEC-242'], attack: ['T1059'], owasp: ['A03:2021'] },  // Code Injection
      '917': { capec: ['CAPEC-242'], attack: ['T1059'], owasp: ['A03:2021'] }, // Expression Language Injection
      // Path Traversal
      '22': { capec: ['CAPEC-126'], attack: ['T1083'], owasp: ['A01:2021'] },  // Path Traversal
      '23': { capec: ['CAPEC-126'], attack: ['T1083'], owasp: ['A01:2021'] },  // Relative Path Traversal
      // Authentication/Crypto
      '287': { capec: ['CAPEC-114'], attack: ['T1078'], owasp: ['A07:2021'] }, // Improper Auth
      '327': { capec: ['CAPEC-97'], attack: ['T1573'], owasp: ['A02:2021'] },  // Broken Crypto
      '330': { capec: ['CAPEC-112'], attack: ['T1110'], owasp: ['A02:2021'] }, // Weak Random
      '798': { capec: ['CAPEC-191'], attack: ['T1552'], owasp: ['A07:2021'] }, // Hardcoded Credentials
      // SSRF
      '918': { capec: ['CAPEC-664'], attack: ['T1090'], owasp: ['A10:2021'] }, // SSRF
      // XXE
      '611': { capec: ['CAPEC-201'], attack: ['T1059'], owasp: ['A05:2021'] }, // XXE
      // Deserialization
      '502': { capec: ['CAPEC-586'], attack: ['T1059'], owasp: ['A08:2021'] }, // Deserialization
      // Security Misconfiguration
      '200': { capec: ['CAPEC-118'], attack: ['T1082'], owasp: ['A05:2021'] }, // Information Exposure
      '532': { capec: ['CAPEC-215'], attack: ['T1005'], owasp: ['A09:2021'] }, // Log Injection
    };
    return mappings[cweNumber] || { capec: [], attack: [], owasp: [] };
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
