export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Confidence = 'high' | 'medium' | 'low';
export type OutputFormat = 'sarif' | 'json' | 'custom';

export interface ScanContext {
  scanId: string;
  workDir: string;
  targetPaths?: string[];
  excludePaths: string[];
  languages: string[];
  timeout: number;
  config?: Record<string, unknown>;
}

export interface ScanOutput {
  scanner: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  outputFile?: string;
  duration: number;
  timedOut: boolean;
}

export interface NormalizedFinding {
  scanner: string;
  ruleId: string;
  severity: Severity;
  confidence: Confidence;
  title: string;
  description: string;
  filePath: string;
  startLine: number;
  endLine?: number;
  startColumn?: number;
  endColumn?: number;
  snippet?: string;
  cweIds: string[];
  cveIds: string[];
  owaspIds: string[];
  references: string[];
  fix?: {
    description: string;
    diff?: string;
  };
  fingerprint: string;
  metadata: Record<string, unknown>;
}

export interface IScanner {
  readonly name: string;
  readonly version: string;
  readonly supportedLanguages: string[];
  readonly outputFormat: OutputFormat;

  isAvailable(): Promise<boolean>;
  getVersion(): Promise<string>;
  scan(context: ScanContext): Promise<ScanOutput>;
  parseOutput(output: ScanOutput): Promise<NormalizedFinding[]>;
}

export interface ScannerConfig {
  enabled: boolean;
  timeout: number;
  customRules?: string[];
  extraArgs?: string[];
}
