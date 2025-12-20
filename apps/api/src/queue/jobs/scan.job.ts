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
  config: ScanConfig;
}

export interface ScanConfig {
  enableSast: boolean;
  enableSca: boolean;
  enableSecrets: boolean;
  enableIac: boolean;
  skipPaths: string[];
  branches: string[];
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
