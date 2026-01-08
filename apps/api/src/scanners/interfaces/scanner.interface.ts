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
  config?: {
    hasTerraform?: boolean;
    hasDockerfile?: boolean;
    hasKubernetes?: boolean;
    hasCloudFormation?: boolean;
    targetUrls?: string[];
    containerImages?: string[];
    [key: string]: unknown;
  };
}

export interface ScanOutput {
  scanner: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  outputFile?: string;
  rawOutput?: string; // Raw output for parsing (e.g., from Docker stdout)
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

/**
 * Template execution status tracking for Nuclei scanner
 */
export type TemplateStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface TemplateResult {
  templateId: string;
  templatePath?: string;
  status: TemplateStatus;
  matchCount: number;
  errorCount: number;
  requestCount: number;
  duration?: number;
  errors?: string[];
}

export interface TemplateStats {
  totalTemplates: number;
  completedTemplates: number;
  failedTemplates: number;
  skippedTemplates: number;
  totalRequests: number;
  totalMatches: number;
  totalErrors: number;
  templates: TemplateResult[];
}

export interface ScanOutputWithTemplates extends ScanOutput {
  templateStats?: TemplateStats;
  streamedFindings?: NormalizedFinding[]; // Findings collected during real-time streaming
}

export interface ScanOutputWithFindings extends ScanOutput {
  findings?: NormalizedFinding[];
}

/**
 * Extended output for DAST scanners that discover URLs
 */
export interface ScanOutputWithDiscovery extends ScanOutputWithFindings {
  discoveredUrls?: string[];
  discoveredForms?: DiscoveredForm[];
  discoveredParams?: DiscoveredParam[];
}

export interface DiscoveredForm {
  url: string;
  method: string;
  action: string;
  fields: string[];
}

export interface DiscoveredParam {
  url: string;
  method: string;
  name: string;
  type: 'query' | 'body' | 'header' | 'cookie';
}
