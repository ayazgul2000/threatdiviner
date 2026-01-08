export interface ScanJobData {
  scanId: string;
  tenantId: string;
  repositoryId: string;
  connectionId: string;
  commitSha: string;
  branch: string;
  cloneUrl: string;
  fullName: string;
  pullRequestId?: string;
  checkRunId?: string;
  triggeredBy?: string;
  config: ScanConfig;
}

export interface ScanConfig {
  enableSast: boolean;
  enableSca: boolean;
  enableSecrets: boolean;
  enableIac: boolean;
  enableDast: boolean;
  enableContainerScan: boolean;
  targetUrls?: string[];
  containerImages?: string[];
  skipPaths: string[];
  branches: string[];
  prDiffOnly?: boolean; // Only report findings on changed lines in PRs
}

export interface CloneJobData {
  scanId: string;
  tenantId: string;
  cloneUrl: string;
  commitSha: string;
  accessToken: string;
  workDir: string;
  shallow: boolean;
  depth?: number;
}

export interface SastJobData {
  scanId: string;
  tenantId: string;
  workDir: string;
  languages: string[];
  scanners: string[];
  skipPaths: string[];
  timeout: number;
}

export interface ResultsJobData {
  scanId: string;
  tenantId: string;
  repositoryId: string;
  scanner: string;
  outputPath: string;
  format: 'sarif' | 'json' | 'custom';
}

export interface NotifyJobData {
  scanId: string;
  tenantId: string;
  repositoryId: string;
  connectionId: string;
  fullName: string;
  pullRequestId?: string;
  checkRunId?: string;
  commitSha: string;
  findingsCount: FindingsCount;
  status: 'success' | 'failure' | 'neutral';
  scanDuration: number;
}

export interface FindingsCount {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface CleanupJobData {
  workDir: string;
  scanId: string;
}

export interface TargetScanJobData {
  scanId: string;
  tenantId: string;
  targetId: string;
  targetUrl: string;
  targetName: string;
  scanMode: 'quick' | 'standard' | 'comprehensive';
  /** @deprecated Use scanMode instead - kept for backwards compatibility */
  scanners?: string[];
  /** @deprecated Use scanMode instead */
  scanPhase?: 'discovery' | 'focused' | 'single' | 'full';
  detectedTechnologies?: string[];
  parentScanId?: string;
  config: TargetScanConfig;
}

export interface TargetScanConfig {
  authType?: string;
  authCredentials?: Record<string, unknown>;
  headers?: Record<string, string>;
  rateLimitPreset?: 'low' | 'medium' | 'high';
  /** @deprecated Use rateLimitPreset instead */
  rateLimitRps?: number;
  excludePaths?: string[];
  timeout?: number;
}
