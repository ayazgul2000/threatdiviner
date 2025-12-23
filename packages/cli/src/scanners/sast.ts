import { exec } from 'child_process';
import { promisify } from 'util';
import { ScanResult, Finding, Severity } from '../types';

const execAsync = promisify(exec);

interface SemgrepResult {
  results: Array<{
    check_id: string;
    path: string;
    start: { line: number; col: number };
    end: { line: number; col: number };
    extra: {
      message: string;
      severity: string;
      metadata?: {
        cwe?: string[];
        owasp?: string[];
        references?: string[];
      };
      lines?: string;
    };
  }>;
  errors: any[];
}

export async function runSastScan(targetPath: string, skipPaths: string[]): Promise<ScanResult> {
  const startTime = Date.now();
  const findings: Finding[] = [];

  try {
    // Build exclude pattern
    const excludeArgs = skipPaths.map(p => `--exclude "${p}"`).join(' ');

    // Run Semgrep with auto config
    const { stdout, stderr } = await execAsync(
      `semgrep scan --config auto --json ${excludeArgs} "${targetPath}"`,
      { maxBuffer: 50 * 1024 * 1024 } // 50MB buffer
    );

    const result: SemgrepResult = JSON.parse(stdout);

    for (const r of result.results) {
      findings.push({
        id: `sast-${r.check_id}-${r.path}-${r.start.line}`,
        scanner: 'semgrep',
        ruleId: r.check_id,
        title: r.extra.message.split('\n')[0],
        description: r.extra.message,
        severity: mapSemgrepSeverity(r.extra.severity),
        filePath: r.path,
        line: r.start.line,
        column: r.start.col,
        endLine: r.end.line,
        endColumn: r.end.col,
        codeSnippet: r.extra.lines,
        cwe: r.extra.metadata?.cwe,
        references: r.extra.metadata?.references,
      });
    }

    return {
      scanner: 'SAST',
      success: true,
      duration: Date.now() - startTime,
      findings,
    };

  } catch (error: any) {
    // Semgrep exits with code 1 when findings exist
    if (error.stdout) {
      try {
        const result: SemgrepResult = JSON.parse(error.stdout);

        for (const r of result.results) {
          findings.push({
            id: `sast-${r.check_id}-${r.path}-${r.start.line}`,
            scanner: 'semgrep',
            ruleId: r.check_id,
            title: r.extra.message.split('\n')[0],
            description: r.extra.message,
            severity: mapSemgrepSeverity(r.extra.severity),
            filePath: r.path,
            line: r.start.line,
            column: r.start.col,
            endLine: r.end.line,
            endColumn: r.end.col,
            codeSnippet: r.extra.lines,
            cwe: r.extra.metadata?.cwe,
            references: r.extra.metadata?.references,
          });
        }

        return {
          scanner: 'SAST',
          success: true,
          duration: Date.now() - startTime,
          findings,
        };
      } catch {
        // Parse error
      }
    }

    return {
      scanner: 'SAST',
      success: false,
      duration: Date.now() - startTime,
      findings: [],
      error: error.message || 'Semgrep scan failed',
    };
  }
}

function mapSemgrepSeverity(severity: string): Severity {
  switch (severity.toUpperCase()) {
    case 'ERROR':
      return 'critical';
    case 'WARNING':
      return 'high';
    case 'INFO':
      return 'medium';
    default:
      return 'low';
  }
}
