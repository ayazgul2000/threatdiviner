export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Finding {
  id: string;
  scanner: string;
  ruleId: string;
  title: string;
  description?: string;
  severity: Severity;
  filePath: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  codeSnippet?: string;
  remediation?: string;
  cwe?: string[];
  cve?: string;
  cvss?: number;
  references?: string[];
}

export interface ScanResult {
  scanner: string;
  success: boolean;
  duration: number; // ms
  findings: Finding[];
  error?: string;
}

export interface ScanSummary {
  startTime: Date;
  endTime: Date;
  duration: number;
  repository: string;
  branch?: string;
  commit?: string;
  scanners: string[];
  results: ScanResult[];
  totalFindings: number;
  findingsBySeverity: Record<Severity, number>;
}

export interface ScanConfig {
  // Scanners
  enableSast: boolean;
  enableSca: boolean;
  enableSecrets: boolean;
  enableIac: boolean;

  // Paths
  targetPath: string;
  skipPaths: string[];

  // Output
  outputFormat: 'json' | 'sarif' | 'text';
  outputFile?: string;

  // Thresholds
  failOnSeverity?: Severity;
  maxFindings?: number;

  // Verbosity
  verbose: boolean;
  quiet: boolean;
}

export interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

export interface SarifRun {
  tool: {
    driver: {
      name: string;
      version: string;
      informationUri?: string;
      rules?: SarifRule[];
    };
  };
  results: SarifResult[];
}

export interface SarifRule {
  id: string;
  name?: string;
  shortDescription?: { text: string };
  fullDescription?: { text: string };
  helpUri?: string;
  defaultConfiguration?: {
    level?: 'error' | 'warning' | 'note' | 'none';
  };
}

export interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note' | 'none';
  message: { text: string };
  locations?: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region?: {
        startLine: number;
        startColumn?: number;
        endLine?: number;
        endColumn?: number;
        snippet?: { text: string };
      };
    };
  }>;
  fingerprints?: Record<string, string>;
}
