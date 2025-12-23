import { exec } from 'child_process';
import { promisify } from 'util';
import { ScanResult, Finding, Severity } from '../types';

const execAsync = promisify(exec);

interface CheckovResult {
  results?: {
    passed_checks?: any[];
    failed_checks?: Array<{
      check_id: string;
      check_name?: string;
      check_result?: { result: string };
      file_path?: string;
      resource?: string;
      file_line_range?: [number, number];
      code_block?: string[][];
      guideline?: string;
      severity?: string;
      bc_check_id?: string;
      cwe?: string[];
      owasp?: string[];
    }>;
    skipped_checks?: any[];
  };
}

export async function runIacScan(targetPath: string, skipPaths: string[]): Promise<ScanResult> {
  const startTime = Date.now();
  const findings: Finding[] = [];

  try {
    // Build skip file pattern
    const skipPattern = skipPaths.join(',');

    // Run Checkov
    const { stdout } = await execAsync(
      `checkov -d "${targetPath}" --output json --skip-path ${skipPattern} --quiet`,
      { maxBuffer: 50 * 1024 * 1024 }
    );

    // Checkov may output multiple JSON objects, take the main one
    const lines = stdout.trim().split('\n');
    let result: CheckovResult | null = null;

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.results) {
          result = parsed;
          break;
        }
      } catch {
        continue;
      }
    }

    if (result?.results?.failed_checks) {
      for (const check of result.results.failed_checks) {
        const filePath = check.file_path || 'unknown';

        // Skip if in skipPaths
        const shouldSkip = skipPaths.some(p => filePath.includes(p));
        if (shouldSkip) continue;

        findings.push({
          id: `iac-${check.check_id}-${filePath}-${check.file_line_range?.[0] || 0}`,
          scanner: 'checkov',
          ruleId: check.check_id,
          title: check.check_name || check.check_id,
          description: `${check.check_name || check.check_id} - Resource: ${check.resource || 'unknown'}`,
          severity: mapCheckovSeverity(check.severity),
          filePath: filePath,
          line: check.file_line_range?.[0],
          endLine: check.file_line_range?.[1],
          codeSnippet: check.code_block?.map(b => b[1]).join('\n'),
          remediation: check.guideline,
          cwe: check.cwe,
        });
      }
    }

    return {
      scanner: 'IaC',
      success: true,
      duration: Date.now() - startTime,
      findings,
    };

  } catch (error: any) {
    // Checkov exits with code 1 when findings exist
    if (error.stdout) {
      try {
        const lines = error.stdout.trim().split('\n');
        let result: CheckovResult | null = null;

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.results) {
              result = parsed;
              break;
            }
          } catch {
            continue;
          }
        }

        if (result?.results?.failed_checks) {
          for (const check of result.results.failed_checks) {
            const filePath = check.file_path || 'unknown';

            const shouldSkip = skipPaths.some(p => filePath.includes(p));
            if (shouldSkip) continue;

            findings.push({
              id: `iac-${check.check_id}-${filePath}-${check.file_line_range?.[0] || 0}`,
              scanner: 'checkov',
              ruleId: check.check_id,
              title: check.check_name || check.check_id,
              description: `${check.check_name || check.check_id} - Resource: ${check.resource || 'unknown'}`,
              severity: mapCheckovSeverity(check.severity),
              filePath: filePath,
              line: check.file_line_range?.[0],
              endLine: check.file_line_range?.[1],
              codeSnippet: check.code_block?.map(b => b[1]).join('\n'),
              remediation: check.guideline,
              cwe: check.cwe,
            });
          }

          return {
            scanner: 'IaC',
            success: true,
            duration: Date.now() - startTime,
            findings,
          };
        }
      } catch {
        // Parse error
      }
    }

    return {
      scanner: 'IaC',
      success: false,
      duration: Date.now() - startTime,
      findings: [],
      error: error.message || 'Checkov scan failed',
    };
  }
}

function mapCheckovSeverity(severity?: string): Severity {
  if (!severity) return 'medium';

  switch (severity.toUpperCase()) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    default:
      return 'info';
  }
}
