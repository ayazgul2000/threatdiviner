import { exec } from 'child_process';
import { promisify } from 'util';
import { ScanResult, Finding, Severity } from '../types';

const execAsync = promisify(exec);

interface TrivyResult {
  Results?: Array<{
    Target: string;
    Vulnerabilities?: Array<{
      VulnerabilityID: string;
      PkgName: string;
      InstalledVersion: string;
      FixedVersion?: string;
      Title?: string;
      Description?: string;
      Severity: string;
      CVSS?: {
        nvd?: { V3Score?: number };
        redhat?: { V3Score?: number };
      };
      References?: string[];
      CweIDs?: string[];
    }>;
  }>;
}

export async function runScaScan(targetPath: string, skipPaths: string[]): Promise<ScanResult> {
  const startTime = Date.now();
  const findings: Finding[] = [];

  try {
    // Run Trivy filesystem scan
    const { stdout } = await execAsync(
      `trivy fs --format json --scanners vuln "${targetPath}"`,
      { maxBuffer: 50 * 1024 * 1024 }
    );

    const result: TrivyResult = JSON.parse(stdout);

    if (result.Results) {
      for (const target of result.Results) {
        if (!target.Vulnerabilities) continue;

        for (const vuln of target.Vulnerabilities) {
          // Skip if in skipPaths
          const shouldSkip = skipPaths.some(p => target.Target.includes(p));
          if (shouldSkip) continue;

          const cvssScore = vuln.CVSS?.nvd?.V3Score || vuln.CVSS?.redhat?.V3Score;

          findings.push({
            id: `sca-${vuln.VulnerabilityID}-${vuln.PkgName}`,
            scanner: 'trivy',
            ruleId: vuln.VulnerabilityID,
            title: vuln.Title || `${vuln.VulnerabilityID} in ${vuln.PkgName}`,
            description: vuln.Description || `Vulnerability found in ${vuln.PkgName}@${vuln.InstalledVersion}`,
            severity: mapTrivySeverity(vuln.Severity),
            filePath: target.Target,
            cve: vuln.VulnerabilityID,
            cvss: cvssScore,
            cwe: vuln.CweIDs,
            references: vuln.References,
            remediation: vuln.FixedVersion ? `Upgrade to version ${vuln.FixedVersion}` : undefined,
          });
        }
      }
    }

    return {
      scanner: 'SCA',
      success: true,
      duration: Date.now() - startTime,
      findings,
    };

  } catch (error: any) {
    return {
      scanner: 'SCA',
      success: false,
      duration: Date.now() - startTime,
      findings: [],
      error: error.message || 'Trivy scan failed',
    };
  }
}

function mapTrivySeverity(severity: string): Severity {
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
