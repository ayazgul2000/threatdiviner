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

    // Extract CWE/CVE/OWASP/CAPEC/ATT&CK from rule properties, ruleId, and description
    const { cweIds, cveIds, owaspIds, capecIds, attackIds } = this.extractSecurityIds(rule, result.ruleId, result.message.text);

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

  private extractSecurityIds(rule?: SarifRule, ruleId?: string, description?: string): {
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

    // If no CWE found from tags, try to infer from title/description/ruleId
    if (cweIds.length === 0) {
      const textToSearch = [
        rule?.shortDescription?.text,
        rule?.fullDescription?.text,
        rule?.name,
        ruleId,
        description,
      ].filter(Boolean).join(' ');

      const inferredCwe = this.inferCweFromText(textToSearch);
      if (inferredCwe) {
        cweIds.push(inferredCwe);
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
   * Infer CWE from vulnerability text (title, description, ruleId)
   * This helps scanners like Trivy that may not include explicit CWE tags
   */
  private inferCweFromText(text: string): string | null {
    const lowerText = text.toLowerCase();

    // Map of vulnerability patterns to CWE IDs
    const patterns: Array<{ patterns: string[]; cwe: string }> = [
      // Injection flaws
      { patterns: ['sql injection', 'sqli', 'sql-injection'], cwe: 'CWE-89' },
      { patterns: ['command injection', 'os command', 'shell injection', 'rce via command'], cwe: 'CWE-78' },
      { patterns: ['cross-site scripting', 'xss', 'cross site scripting'], cwe: 'CWE-79' },
      { patterns: ['code injection', 'remote code execution', 'rce', 'arbitrary code'], cwe: 'CWE-94' },
      { patterns: ['ldap injection'], cwe: 'CWE-90' },
      { patterns: ['xpath injection'], cwe: 'CWE-643' },
      { patterns: ['expression language injection', 'el injection', 'ognl injection'], cwe: 'CWE-917' },

      // Path Traversal
      { patterns: ['path traversal', 'directory traversal', 'file inclusion', 'lfi', 'rfi', '../'], cwe: 'CWE-22' },

      // Authentication/Authorization
      { patterns: ['authentication bypass', 'improper authentication', 'auth bypass'], cwe: 'CWE-287' },
      { patterns: ['authorization bypass', 'improper authorization', 'privilege escalation', 'broken access'], cwe: 'CWE-862' },
      { patterns: ['hardcoded credential', 'hardcoded password', 'embedded credential', 'default credential'], cwe: 'CWE-798' },
      { patterns: ['missing authentication', 'no authentication'], cwe: 'CWE-306' },

      // Cryptography
      { patterns: ['weak crypto', 'broken crypto', 'insecure crypto', 'weak cipher', 'des ', 'rc4', 'md5 hash', 'sha1 hash'], cwe: 'CWE-327' },
      { patterns: ['weak random', 'insecure random', 'predictable random', 'math.random'], cwe: 'CWE-330' },
      { patterns: ['cleartext transmission', 'unencrypted', 'plain text password', 'http://'], cwe: 'CWE-319' },

      // SSRF/XXE
      { patterns: ['ssrf', 'server-side request forgery', 'server side request'], cwe: 'CWE-918' },
      { patterns: ['xxe', 'xml external entity', 'xml injection'], cwe: 'CWE-611' },

      // Deserialization
      { patterns: ['deserialization', 'insecure deserial', 'pickle', 'yaml.load', 'object injection'], cwe: 'CWE-502' },

      // Information Exposure
      { patterns: ['information disclosure', 'information exposure', 'sensitive data exposure', 'data leak'], cwe: 'CWE-200' },
      { patterns: ['log injection', 'log forging', 'sensitive data in log'], cwe: 'CWE-532' },
      { patterns: ['error message', 'stack trace', 'debug info'], cwe: 'CWE-209' },

      // Buffer/Memory
      { patterns: ['buffer overflow', 'buffer overrun', 'heap overflow', 'stack overflow'], cwe: 'CWE-120' },
      { patterns: ['out of bounds', 'oob read', 'oob write'], cwe: 'CWE-125' },
      { patterns: ['use after free', 'double free', 'memory corruption'], cwe: 'CWE-416' },
      { patterns: ['integer overflow', 'integer underflow'], cwe: 'CWE-190' },
      { patterns: ['null pointer', 'null dereference'], cwe: 'CWE-476' },

      // Input Validation
      { patterns: ['open redirect', 'url redirect', 'unvalidated redirect'], cwe: 'CWE-601' },
      { patterns: ['csrf', 'cross-site request forgery', 'cross site request forgery'], cwe: 'CWE-352' },
      { patterns: ['improper input validation', 'input validation'], cwe: 'CWE-20' },

      // DoS
      { patterns: ['denial of service', 'dos', 'resource exhaustion', 'regex dos', 'redos'], cwe: 'CWE-400' },

      // Race Conditions
      { patterns: ['race condition', 'toctou', 'time of check'], cwe: 'CWE-362' },

      // File Operations
      { patterns: ['arbitrary file write', 'file write vulnerability'], cwe: 'CWE-73' },
      { patterns: ['arbitrary file read', 'file read vulnerability'], cwe: 'CWE-22' },
      { patterns: ['insecure file permission', 'world writable', 'chmod 777'], cwe: 'CWE-732' },

      // Prototype Pollution (JavaScript)
      { patterns: ['prototype pollution'], cwe: 'CWE-1321' },
    ];

    for (const { patterns: patternList, cwe } of patterns) {
      for (const pattern of patternList) {
        if (lowerText.includes(pattern)) {
          return cwe;
        }
      }
    }

    return null;
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
      '90': { capec: ['CAPEC-136'], attack: ['T1190'], owasp: ['A03:2021'] },  // LDAP Injection
      '643': { capec: ['CAPEC-83'], attack: ['T1190'], owasp: ['A03:2021'] },  // XPath Injection
      '917': { capec: ['CAPEC-242'], attack: ['T1059'], owasp: ['A03:2021'] }, // Expression Language Injection

      // Path Traversal
      '22': { capec: ['CAPEC-126'], attack: ['T1083'], owasp: ['A01:2021'] },  // Path Traversal
      '23': { capec: ['CAPEC-126'], attack: ['T1083'], owasp: ['A01:2021'] },  // Relative Path Traversal
      '73': { capec: ['CAPEC-13'], attack: ['T1059'], owasp: ['A01:2021'] },   // External Control of File Name

      // Authentication/Authorization
      '287': { capec: ['CAPEC-114'], attack: ['T1078'], owasp: ['A07:2021'] }, // Improper Auth
      '862': { capec: ['CAPEC-122'], attack: ['T1548'], owasp: ['A01:2021'] }, // Missing Authorization
      '306': { capec: ['CAPEC-36'], attack: ['T1190'], owasp: ['A07:2021'] },  // Missing Auth for Critical Function
      '798': { capec: ['CAPEC-191'], attack: ['T1552'], owasp: ['A07:2021'] }, // Hardcoded Credentials

      // Cryptography
      '327': { capec: ['CAPEC-97'], attack: ['T1573'], owasp: ['A02:2021'] },  // Broken Crypto
      '330': { capec: ['CAPEC-112'], attack: ['T1110'], owasp: ['A02:2021'] }, // Weak Random
      '319': { capec: ['CAPEC-102'], attack: ['T1557'], owasp: ['A02:2021'] }, // Cleartext Transmission

      // SSRF/XXE
      '918': { capec: ['CAPEC-664'], attack: ['T1090'], owasp: ['A10:2021'] }, // SSRF
      '611': { capec: ['CAPEC-201'], attack: ['T1059'], owasp: ['A05:2021'] }, // XXE

      // Deserialization
      '502': { capec: ['CAPEC-586'], attack: ['T1059'], owasp: ['A08:2021'] }, // Deserialization

      // Information Exposure
      '200': { capec: ['CAPEC-118'], attack: ['T1082'], owasp: ['A05:2021'] }, // Information Exposure
      '532': { capec: ['CAPEC-215'], attack: ['T1005'], owasp: ['A09:2021'] }, // Log Injection
      '209': { capec: ['CAPEC-54'], attack: ['T1082'], owasp: ['A05:2021'] },  // Info Exposure Through Error

      // Buffer/Memory
      '120': { capec: ['CAPEC-100'], attack: ['T1203'], owasp: ['A06:2021'] }, // Buffer Overflow
      '125': { capec: ['CAPEC-540'], attack: ['T1203'], owasp: ['A06:2021'] }, // Out-of-bounds Read
      '416': { capec: ['CAPEC-233'], attack: ['T1203'], owasp: ['A06:2021'] }, // Use After Free
      '190': { capec: ['CAPEC-92'], attack: ['T1203'], owasp: ['A06:2021'] },  // Integer Overflow
      '476': { capec: ['CAPEC-129'], attack: ['T1499'], owasp: ['A06:2021'] }, // NULL Pointer Dereference

      // Input Validation
      '601': { capec: ['CAPEC-194'], attack: ['T1566'], owasp: ['A01:2021'] }, // Open Redirect
      '352': { capec: ['CAPEC-62'], attack: ['T1185'], owasp: ['A01:2021'] },  // CSRF
      '20': { capec: ['CAPEC-153'], attack: ['T1190'], owasp: ['A03:2021'] },  // Improper Input Validation

      // DoS
      '400': { capec: ['CAPEC-469'], attack: ['T1499'], owasp: ['A06:2021'] }, // Resource Exhaustion

      // Race Conditions
      '362': { capec: ['CAPEC-26'], attack: ['T1068'], owasp: ['A06:2021'] },  // Race Condition

      // File Operations
      '732': { capec: ['CAPEC-17'], attack: ['T1222'], owasp: ['A05:2021'] },  // Incorrect Permission

      // Prototype Pollution
      '1321': { capec: ['CAPEC-242'], attack: ['T1059'], owasp: ['A03:2021'] }, // Prototype Pollution
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
