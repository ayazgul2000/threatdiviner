// apps/api/src/reporting/interfaces/report-data.interface.ts

export interface EnrichedFinding {
  // Core finding data
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  scanner: string;
  ruleId: string;
  filePath: string;
  startLine: number | null;
  endLine: number | null;
  snippet: string | null;
  fingerprint: string | null;
  firstSeenAt: Date;
  createdAt: Date;

  // CVE Enrichment
  cve?: {
    id: string;
    description: string;
    cvssV3Score: number | null;
    cvssV3Vector: string | null;
    cvssV3Severity: string | null;
    epssScore: number | null;
    epssPercentile: number | null;
    isKev: boolean;
    kevDateAdded: Date | null;
    kevDueDate: Date | null;
    publishedDate: Date;
    references: any[];
    affectedProducts: any[];
  } | null;

  // CWE Mapping
  cwe?: {
    id: string;
    name: string;
    description: string;
    extendedDescription: string | null;
    likelihoodOfExploit: string | null;
    commonConsequences: any[];
    potentialMitigations: any[];
    relatedWeaknesses: string[];
  } | null;

  // OWASP Top 10
  owasp?: {
    id: string;
    year: number;
    rank: number;
    name: string;
    description: string;
    preventionTips: any[];
  } | null;

  // MITRE ATT&CK
  attack?: {
    techniqueId: string;
    tacticId: string;
    name: string;
    description: string;
    platforms: string[];
    detection: string | null;
    mitigations: any[];
  }[];

  // CAPEC
  capec?: {
    id: string;
    name: string;
    description: string;
    severity: string | null;
    likelihood: string | null;
    mitigations: any[];
  }[];

  // Compliance Controls
  compliance: {
    framework: string;
    frameworkName: string;
    controlId: string;
    controlName: string;
    controlDescription: string | null;
    category: string;
  }[];

  // AI Analysis
  aiAnalysis?: {
    analysis: string | null;
    confidence: number | null;
    severity: string | null;
    isFalsePositive: boolean | null;
    exploitability: string | null;
    remediation: string | null;
    triagedAt: Date | null;
  };

  // Risk Score
  riskScore: number | null;

  // Remediation
  remediation: {
    summary: string | null;
    autoFix: string | null;
    steps: string[];
    references: string[];
  };
}

export interface ScanReportData {
  scan: {
    id: string;
    branch: string;
    commitSha: string;
    status: string;
    triggeredBy: string;
    triggerEvent: string | null;
    pullRequestId: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    duration: number | null;
  };
  repository: {
    id: string;
    name: string;
    fullName: string;
    htmlUrl: string;
    defaultBranch: string;
    language: string | null;
  };
  scannerResults: {
    scanner: string;
    category: string;
    status: string;
    duration: number | null;
    findingsCount: number;
  }[];
  findings: EnrichedFinding[];
  summary: FindingSummary;
  trends?: TrendData;
  generatedAt: Date;
}

export interface FindingSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  byScanner: { scanner: string; count: number }[];
  byStatus: { status: string; count: number }[];
  newSinceLastScan?: number;
  fixedSinceLastScan?: number;
}

export interface TrendData {
  findingsOverTime: { date: string; count: number; severity: string }[];
  mttrOverTime: { date: string; mttr: number }[];
  scansOverTime: { date: string; count: number }[];
  severityDistributionOverTime: { date: string; critical: number; high: number; medium: number; low: number }[];
}
