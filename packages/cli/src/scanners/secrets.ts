import { exec } from 'child_process';
import { promisify } from 'util';
import { ScanResult, Finding, Severity } from '../types';

const execAsync = promisify(exec);

interface GitleaksResult {
  Description?: string;
  File?: string;
  StartLine?: number;
  EndLine?: number;
  StartColumn?: number;
  EndColumn?: number;
  Match?: string;
  Secret?: string;
  RuleID?: string;
  Entropy?: number;
  Commit?: string;
  Author?: string;
  Email?: string;
  Date?: string;
  Message?: string;
}

export async function runSecretsScan(targetPath: string, skipPaths: string[]): Promise<ScanResult> {
  const startTime = Date.now();
  const findings: Finding[] = [];

  try {
    // Run Gitleaks detect
    const { stdout } = await execAsync(
      `gitleaks detect --source "${targetPath}" --report-format json --no-git`,
      { maxBuffer: 50 * 1024 * 1024 }
    );

    // Gitleaks outputs array of findings
    const results: GitleaksResult[] = stdout.trim() ? JSON.parse(stdout) : [];

    for (const secret of results) {
      // Skip if in skipPaths
      if (secret.File) {
        const shouldSkip = skipPaths.some(p => secret.File!.includes(p));
        if (shouldSkip) continue;
      }

      findings.push({
        id: `secrets-${secret.RuleID}-${secret.File}-${secret.StartLine}`,
        scanner: 'gitleaks',
        ruleId: secret.RuleID || 'generic-secret',
        title: secret.Description || 'Potential secret detected',
        description: `Secret detected: ${secret.Description || 'Unknown'}. Match: ${maskSecret(secret.Match || '')}`,
        severity: mapSecretSeverity(secret.RuleID),
        filePath: secret.File || 'unknown',
        line: secret.StartLine,
        column: secret.StartColumn,
        endLine: secret.EndLine,
        endColumn: secret.EndColumn,
        remediation: 'Remove the secret from the codebase and rotate the credential immediately.',
      });
    }

    return {
      scanner: 'Secrets',
      success: true,
      duration: Date.now() - startTime,
      findings,
    };

  } catch (error: any) {
    // Gitleaks exits with code 1 when secrets are found
    if (error.stdout) {
      try {
        const results: GitleaksResult[] = error.stdout.trim() ? JSON.parse(error.stdout) : [];

        for (const secret of results) {
          if (secret.File) {
            const shouldSkip = skipPaths.some(p => secret.File!.includes(p));
            if (shouldSkip) continue;
          }

          findings.push({
            id: `secrets-${secret.RuleID}-${secret.File}-${secret.StartLine}`,
            scanner: 'gitleaks',
            ruleId: secret.RuleID || 'generic-secret',
            title: secret.Description || 'Potential secret detected',
            description: `Secret detected: ${secret.Description || 'Unknown'}. Match: ${maskSecret(secret.Match || '')}`,
            severity: mapSecretSeverity(secret.RuleID),
            filePath: secret.File || 'unknown',
            line: secret.StartLine,
            column: secret.StartColumn,
            endLine: secret.EndLine,
            endColumn: secret.EndColumn,
            remediation: 'Remove the secret from the codebase and rotate the credential immediately.',
          });
        }

        return {
          scanner: 'Secrets',
          success: true,
          duration: Date.now() - startTime,
          findings,
        };
      } catch {
        // Parse error
      }
    }

    return {
      scanner: 'Secrets',
      success: false,
      duration: Date.now() - startTime,
      findings: [],
      error: error.message || 'Gitleaks scan failed',
    };
  }
}

function mapSecretSeverity(ruleId?: string): Severity {
  // All secrets are high severity by default
  // Private keys and API keys are critical
  if (!ruleId) return 'high';

  const criticalPatterns = ['private-key', 'aws-secret', 'gcp-api-key', 'azure-secret'];
  if (criticalPatterns.some(p => ruleId.toLowerCase().includes(p))) {
    return 'critical';
  }

  return 'high';
}

function maskSecret(secret: string): string {
  if (!secret || secret.length < 8) return '****';
  return secret.substring(0, 4) + '****' + secret.substring(secret.length - 4);
}
