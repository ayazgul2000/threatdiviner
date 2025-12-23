import chalk from 'chalk';
import * as fs from 'fs';
import { ScanSummary, Finding, SarifLog, SarifRun, SarifResult, Severity } from '../types';

export function formatOutput(summary: ScanSummary, format: string): string {
  switch (format) {
    case 'json':
      return JSON.stringify(summary, null, 2);
    case 'sarif':
      return JSON.stringify(toSarif(summary), null, 2);
    default:
      return formatText(summary);
  }
}

export function writeJsonOutput(summary: ScanSummary, filePath: string): void {
  fs.writeFileSync(filePath, JSON.stringify(summary, null, 2));
}

export function writeSarifOutput(summary: ScanSummary, filePath: string): void {
  fs.writeFileSync(filePath, JSON.stringify(toSarif(summary), null, 2));
}

function formatText(summary: ScanSummary): string {
  const lines: string[] = [];
  const allFindings = summary.results.flatMap(r => r.findings);

  if (allFindings.length === 0) {
    return chalk.green('\nNo security issues found.\n');
  }

  lines.push('');
  lines.push(chalk.bold('Findings:'));
  lines.push('');

  // Group by severity
  const bySeverity: Record<Severity, Finding[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
    info: [],
  };

  for (const finding of allFindings) {
    bySeverity[finding.severity].push(finding);
  }

  for (const severity of ['critical', 'high', 'medium', 'low', 'info'] as Severity[]) {
    const findings = bySeverity[severity];
    if (findings.length === 0) continue;

    const severityColor = getSeverityColor(severity);
    lines.push(severityColor(`${severity.toUpperCase()} (${findings.length}):`));
    lines.push('');

    for (const finding of findings) {
      lines.push(`  ${chalk.bold(finding.title)}`);
      lines.push(`  ${chalk.gray(finding.filePath)}${finding.line ? chalk.gray(`:${finding.line}`) : ''}`);
      lines.push(`  ${chalk.gray(`Scanner: ${finding.scanner} | Rule: ${finding.ruleId}`)}`);
      if (finding.cve) {
        lines.push(`  ${chalk.cyan(`CVE: ${finding.cve}`)}`);
      }
      if (finding.cvss) {
        lines.push(`  ${chalk.cyan(`CVSS: ${finding.cvss}`)}`);
      }
      if (finding.remediation) {
        lines.push(`  ${chalk.green(`Fix: ${finding.remediation}`)}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function getSeverityColor(severity: Severity): chalk.Chalk {
  switch (severity) {
    case 'critical':
      return chalk.red.bold;
    case 'high':
      return chalk.magenta;
    case 'medium':
      return chalk.yellow;
    case 'low':
      return chalk.blue;
    default:
      return chalk.gray;
  }
}

function toSarif(summary: ScanSummary): SarifLog {
  const runs: SarifRun[] = [];

  // Group findings by scanner
  const byScanner = new Map<string, Finding[]>();
  for (const result of summary.results) {
    const existing = byScanner.get(result.scanner) || [];
    existing.push(...result.findings);
    byScanner.set(result.scanner, existing);
  }

  for (const [scanner, findings] of byScanner) {
    const rules = new Map<string, { id: string; name: string; description: string }>();
    const results: SarifResult[] = [];

    for (const finding of findings) {
      // Add rule if not already added
      if (!rules.has(finding.ruleId)) {
        rules.set(finding.ruleId, {
          id: finding.ruleId,
          name: finding.title,
          description: finding.description || finding.title,
        });
      }

      results.push({
        ruleId: finding.ruleId,
        level: severityToLevel(finding.severity),
        message: { text: finding.description || finding.title },
        locations: finding.filePath ? [{
          physicalLocation: {
            artifactLocation: { uri: finding.filePath },
            region: finding.line ? {
              startLine: finding.line,
              startColumn: finding.column,
              endLine: finding.endLine,
              endColumn: finding.endColumn,
              snippet: finding.codeSnippet ? { text: finding.codeSnippet } : undefined,
            } : undefined,
          },
        }] : undefined,
        fingerprints: {
          'finding-id': finding.id,
        },
      });
    }

    runs.push({
      tool: {
        driver: {
          name: `ThreatDiviner/${scanner}`,
          version: '1.0.0',
          informationUri: 'https://threatdiviner.io',
          rules: Array.from(rules.values()).map(r => ({
            id: r.id,
            name: r.name,
            shortDescription: { text: r.name },
            fullDescription: { text: r.description },
          })),
        },
      },
      results,
    });
  }

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs,
  };
}

function severityToLevel(severity: Severity): 'error' | 'warning' | 'note' | 'none' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
    case 'info':
      return 'note';
    default:
      return 'none';
  }
}
