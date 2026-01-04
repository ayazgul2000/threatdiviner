export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export interface ScmConnection {
  id: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  accountName: string;
  accountId: string;
  status: 'active' | 'expired' | 'revoked';
  scopes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Repository {
  id: string;
  connectionId: string;
  externalId: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  webhookId: string | null;
  lastScanAt: string | null;
  createdAt: string;
  scanConfig?: ScanConfig;
  connection?: ScmConnection;
}

export interface ScanConfig {
  id: string;
  repositoryId: string;
  enabled: boolean;
  scanOnPush: boolean;
  scanOnPr: boolean;
  scanOnSchedule: boolean;
  schedulePattern: string | null;
  scanners: string[];
  excludePaths: string[];
  targetUrls: string[];
  containerImages: string[];
}

export interface Scan {
  id: string;
  repositoryId: string;
  commitSha: string;
  branch: string;
  trigger: 'push' | 'pull_request' | 'manual' | 'schedule';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  findingsCount: FindingsCount | null;
  errorMessage: string | null;
  createdAt: string;
  repository?: Repository;
}

export interface FindingsCount {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

export interface Finding {
  id: string;
  scanId: string;
  scanner: string;
  ruleId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  message: string;
  filePath: string;
  startLine: number;
  endLine: number | null;
  snippet: string | null;
  cwe: string[];
  fingerprint: string;
  status: 'open' | 'fixed' | 'ignored' | 'false_positive';
  firstSeenAt?: string;
  lastSeenAt?: string;
  createdAt?: string;
  scan?: Scan;
  // AI Triage fields
  aiAnalysis?: string | null;
  aiConfidence?: number | null;
  aiSeverity?: string | null;
  aiFalsePositive?: boolean | null;
  aiExploitability?: string | null;
  aiRemediation?: string | null;
  aiTriagedAt?: string | null;
}

export interface AiTriageResult {
  id: string;
  aiAnalysis: string | null;
  aiConfidence: number | null;
  aiSeverity: string | null;
  aiFalsePositive: boolean | null;
  aiExploitability: string | null;
  aiRemediation: string | null;
  aiTriagedAt: string | null;
}

export interface DashboardStats {
  totalRepositories: number;
  activeConnections: number;
  totalScans: number;
  openFindings: number;
  findingsBySeverity: FindingsCount;
  recentScans: Scan[];
  recentFindings: Finding[];
}

// API Error
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Fetch wrapper
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = 'An error occurred';
    let code: string | undefined;

    try {
      const error = await response.json();
      message = error.message || message;
      code = error.code;
    } catch {
      message = response.statusText;
    }

    throw new ApiError(message, response.status, code);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Auth API
export const authApi = {
  login: (tenantSlug: string, email: string, password: string) =>
    fetchApi<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ tenantSlug, email, password }),
    }),

  logout: () =>
    fetchApi<void>('/auth/logout', { method: 'POST' }),

  getProfile: () =>
    fetchApi<User>('/auth/profile'),

  refresh: () =>
    fetchApi<void>('/auth/refresh', { method: 'POST' }),
};

// SCM Connections API
export const connectionsApi = {
  list: () =>
    fetchApi<ScmConnection[]>('/scm/connections'),

  initiateOAuth: (provider: string) =>
    fetchApi<{ authUrl: string }>('/scm/oauth/initiate', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    }),

  connectWithPat: (provider: string, token: string) =>
    fetchApi<ScmConnection>('/scm/connect/pat', {
      method: 'POST',
      body: JSON.stringify({ provider, token }),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/scm/connections/${id}`, { method: 'DELETE' }),

  getAvailableRepos: (connectionId: string, projectId?: string) => {
    const endpoint = projectId
      ? `/scm/connections/${connectionId}/available-repos-for-project?projectId=${projectId}`
      : `/scm/connections/${connectionId}/available-repos`;
    return fetchApi<{ id: string; name: string; fullName: string; isPrivate: boolean }[]>(endpoint);
  },
};

// Repositories API
export const repositoriesApi = {
  list: () =>
    fetchApi<Repository[]>('/scm/repositories'),

  get: async (id: string): Promise<Repository> => {
    const response = await fetchApi<{ repository: Repository }>(`/scm/repositories/${id}`);
    return response.repository;
  },

  add: (connectionId: string, externalId: string, fullName: string) =>
    fetchApi<Repository>('/scm/repositories', {
      method: 'POST',
      body: JSON.stringify({ connectionId, externalId, fullName }),
    }),

  updateConfig: (id: string, config: Partial<ScanConfig> & { scanners?: string[] }) =>
    fetchApi<ScanConfig>(`/scm/repositories/${id}/config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/scm/repositories/${id}`, { method: 'DELETE' }),
};

// Scans API
export const scansApi = {
  list: (repositoryId?: string) => {
    const query = repositoryId ? `?repositoryId=${repositoryId}` : '';
    return fetchApi<Scan[]>(`/scm/scans${query}`);
  },

  get: async (id: string): Promise<Scan> => {
    const response = await fetchApi<{ scan: Scan }>(`/scm/scans/${id}`);
    return response.scan;
  },

  trigger: (repositoryId: string, branch?: string) =>
    fetchApi<Scan>('/scm/scans', {
      method: 'POST',
      body: JSON.stringify({ repositoryId, branch }),
    }),

  cancel: (id: string) =>
    fetchApi<void>(`/scm/scans/${id}/cancel`, { method: 'POST' }),
};

// Findings API
export const findingsApi = {
  list: (filters?: {
    scanId?: string;
    repositoryId?: string;
    projectId?: string;
    severity?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchApi<{ findings: Finding[]; total: number }>(`/scm/findings${query}`);
  },

  get: (id: string) =>
    fetchApi<Finding>(`/scm/findings/${id}`),

  updateStatus: (id: string, status: Finding['status']) =>
    fetchApi<Finding>(`/scm/findings/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
};

// Dashboard API
export const dashboardApi = {
  getStats: () =>
    fetchApi<DashboardStats>('/dashboard/stats'),
};

// Notifications API
export interface NotificationConfig {
  id?: string;
  slackEnabled: boolean;
  slackWebhookUrl: string | null;
  slackChannel: string | null;
  notifyOnScanStart: boolean;
  notifyOnScanComplete: boolean;
  notifyOnCritical: boolean;
  notifyOnHigh: boolean;
}

export const notificationsApi = {
  getConfig: () =>
    fetchApi<NotificationConfig>('/notifications/config'),

  updateConfig: (config: Partial<NotificationConfig>) =>
    fetchApi<NotificationConfig>('/notifications/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  testSlack: () =>
    fetchApi<{ success: boolean; message: string }>('/notifications/test-slack', {
      method: 'POST',
    }),
};

// Reports API
export const reportsApi = {
  getScanReport: (scanId: string) =>
    `${API_URL}/reports/scan/${scanId}/pdf`,

  getRepositoryReport: (repositoryId: string) =>
    `${API_URL}/reports/repository/${repositoryId}/pdf`,

  getSummaryReport: () =>
    `${API_URL}/reports/summary/pdf`,
};

// AI Triage API
export const aiApi = {
  getStatus: () =>
    fetchApi<{ available: boolean; model: string }>('/ai/status'),

  triageFinding: (findingId: string) =>
    fetchApi<AiTriageResult>(`/ai/triage/${findingId}`, {
      method: 'POST',
    }),

  batchTriage: (findingIds: string[]) =>
    fetchApi<{ processed: number; results: AiTriageResult[] }>('/ai/triage/batch', {
      method: 'POST',
      body: JSON.stringify({ findingIds }),
    }),

  getTriageResult: (findingId: string) =>
    fetchApi<AiTriageResult>(`/ai/triage/${findingId}`),
};

// Analytics API
export interface AnalyticsData {
  totalScans: number;
  totalFindings: number;
  openFindings: number;
  fixedFindings: number;
  mttr: number;
  fixRate: number;
  findingsBySeverity: Record<string, number>;
  findingsByScanner: Record<string, number>;
  scansOverTime: Array<{ date: string; count: number }>;
  findingsTrend: Array<{ date: string; introduced: number; fixed: number }>;
  topVulnerableRepos: Array<{ name: string; count: number }>;
  topRecurringRules: Array<{ ruleId: string; count: number }>;
  complianceScores: Record<string, number>;
}

export const analyticsApi = {
  get: (range: '7d' | '30d' | '90d' = '30d') =>
    fetchApi<AnalyticsData>(`/analytics?range=${range}`),

  getScannerStats: (range: '7d' | '30d' | '90d' = '30d') =>
    fetchApi<Record<string, {
      total: number;
      bySeverity: Record<string, number>;
      openCount: number;
      fixedCount: number;
    }>>(`/analytics/scanners?range=${range}`),
};

// Branch and Language API (for repositories)
export interface ScmBranch {
  name: string;
  sha: string;
  isDefault: boolean;
  isProtected: boolean;
}

export interface ScmLanguages {
  [language: string]: number;
}

export const branchesApi = {
  list: (repositoryId: string) =>
    fetchApi<ScmBranch[]>(`/scm/repositories/${repositoryId}/branches`),

  getLanguages: (repositoryId: string) =>
    fetchApi<ScmLanguages>(`/scm/repositories/${repositoryId}/languages`),
};

// ==================== VulnDB API ====================
export const vulndbApi = {
  stats: () => fetchApi<any>('/vulndb/stats'),

  // CVE
  cve: {
    search: (params: { keyword?: string; severity?: string; isKev?: boolean; minEpss?: number; page?: number; limit?: number }) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v !== undefined && searchParams.append(k, String(v)));
      return fetchApi<any>(`/vulndb/cve?${searchParams}`);
    },
    get: (id: string) => fetchApi<any>(`/vulndb/cve/${id}`),
    recent: (limit = 20) => fetchApi<any[]>(`/vulndb/cve/recent?limit=${limit}`),
    kev: () => fetchApi<any[]>('/vulndb/cve/kev'),
    highEpss: (threshold = 0.5) => fetchApi<any[]>(`/vulndb/cve/high-epss?threshold=${threshold}`),
  },

  // CWE
  cwe: {
    search: (keyword: string) => fetchApi<any[]>(`/vulndb/cwe?keyword=${encodeURIComponent(keyword)}`),
    get: (id: string) => fetchApi<any>(`/vulndb/cwe/${id}`),
  },

  // OWASP
  owasp: {
    list: (year = 2021) => fetchApi<any[]>(`/vulndb/owasp?year=${year}`),
    get: (id: string) => fetchApi<any>(`/vulndb/owasp/${id}`),
  },

  // ATT&CK
  attack: {
    tactics: () => fetchApi<any[]>('/vulndb/attack/tactics'),
    techniques: (tacticId?: string) =>
      fetchApi<any[]>(tacticId ? `/vulndb/attack/techniques?tacticId=${tacticId}` : '/vulndb/attack/techniques'),
    getTechnique: (id: string) => fetchApi<any>(`/vulndb/attack/techniques/${id}`),
    surface: (repositoryId?: string) =>
      fetchApi<any>(repositoryId ? `/vulndb/attack/surface/${repositoryId}` : '/vulndb/attack/surface'),
    killchain: () => fetchApi<any>('/vulndb/attack/killchain'),
    groups: () => fetchApi<any[]>('/vulndb/attack/groups/relevant'),
  },

  // Sync
  sync: {
    status: () => fetchApi<any>('/vulndb/sync/status'),
    trigger: (source: string) => fetchApi<any>(`/vulndb/sync/${source}`, { method: 'POST' }),
  },
};

// ==================== SLA API ====================
export const slaApi = {
  summary: () => fetchApi<any>('/vulndb/sla/summary'),
  policies: () => fetchApi<any[]>('/vulndb/sla/policies'),
  bySeverity: () => fetchApi<any>('/vulndb/sla/summary/by-severity'),
  atRisk: (limit = 20) => fetchApi<any[]>(`/vulndb/sla/at-risk?limit=${limit}`),
  breached: (limit = 20) => fetchApi<any[]>(`/vulndb/sla/breached?limit=${limit}`),
  mttr: () => fetchApi<any>('/vulndb/sla/mttr'),
};

// ==================== Threat Modeling API ====================
export const threatModelingApi = {
  list: (status?: string) => {
    const params = status ? `?status=${status}` : '';
    return fetchApi<any[]>(`/threat-modeling${params}`);
  },
  get: (id: string) => fetchApi<any>(`/threat-modeling/${id}`),
  create: (data: any) =>
    fetchApi<any>('/threat-modeling', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    fetchApi<any>(`/threat-modeling/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    fetchApi<void>(`/threat-modeling/${id}`, { method: 'DELETE' }),
  duplicate: (id: string) =>
    fetchApi<any>(`/threat-modeling/${id}/duplicate`, { method: 'POST' }),
  stats: (id: string) => fetchApi<any>(`/threat-modeling/${id}/stats`),
  diagram: (id: string) => fetchApi<any>(`/threat-modeling/${id}/diagram`),

  // STRIDE Analysis
  analyze: (id: string, methodology = 'stride') =>
    fetchApi<any>(`/threat-modeling/${id}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ methodology }),
    }),

  // Components
  addComponent: (modelId: string, data: any) =>
    fetchApi<any>(`/threat-modeling/${modelId}/components`, { method: 'POST', body: JSON.stringify(data) }),
  updateComponent: (modelId: string, componentId: string, data: any) =>
    fetchApi<any>(`/threat-modeling/${modelId}/components/${componentId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteComponent: (modelId: string, componentId: string) =>
    fetchApi<void>(`/threat-modeling/${modelId}/components/${componentId}`, { method: 'DELETE' }),

  // Data Flows
  addDataFlow: (modelId: string, data: any) =>
    fetchApi<any>(`/threat-modeling/${modelId}/data-flows`, { method: 'POST', body: JSON.stringify(data) }),
  updateDataFlow: (modelId: string, flowId: string, data: any) =>
    fetchApi<any>(`/threat-modeling/${modelId}/data-flows/${flowId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDataFlow: (modelId: string, flowId: string) =>
    fetchApi<void>(`/threat-modeling/${modelId}/data-flows/${flowId}`, { method: 'DELETE' }),

  // Threats
  addThreat: (modelId: string, data: any) =>
    fetchApi<any>(`/threat-modeling/${modelId}/threats`, { method: 'POST', body: JSON.stringify(data) }),
  updateThreat: (modelId: string, threatId: string, data: any) =>
    fetchApi<any>(`/threat-modeling/${modelId}/threats/${threatId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteThreat: (modelId: string, threatId: string) =>
    fetchApi<void>(`/threat-modeling/${modelId}/threats/${threatId}`, { method: 'DELETE' }),

  // Mitigations
  addMitigation: (modelId: string, threatId: string, data: any) =>
    fetchApi<any>(`/threat-modeling/${modelId}/threats/${threatId}/mitigations`, { method: 'POST', body: JSON.stringify(data) }),
  updateMitigation: (modelId: string, mitigationId: string, data: any) =>
    fetchApi<any>(`/threat-modeling/${modelId}/mitigations/${mitigationId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMitigation: (modelId: string, mitigationId: string) =>
    fetchApi<void>(`/threat-modeling/${modelId}/mitigations/${mitigationId}`, { method: 'DELETE' }),
};

// ==================== SBOM API ====================
export const sbomApi = {
  list: () => fetchApi<any[]>('/sbom'),
  get: (id: string) => fetchApi<any>(`/sbom/${id}`),
  delete: (id: string) => fetchApi<void>(`/sbom/${id}`, { method: 'DELETE' }),
  stats: (id: string) => fetchApi<any>(`/sbom/${id}/stats`),
  tree: (id: string) => fetchApi<any>(`/sbom/${id}/tree`),
  matchCves: (id: string) => fetchApi<any>(`/sbom/${id}/match-cves`, { method: 'POST' }),

  // Upload - using FormData
  uploadSpdx: async (repositoryId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('repositoryId', repositoryId);

    const response = await fetch(`${API_URL}/sbom/upload/spdx`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new ApiError(error.message, response.status);
    }

    return response.json();
  },

  uploadCyclonedx: async (repositoryId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('repositoryId', repositoryId);

    const response = await fetch(`${API_URL}/sbom/upload/cyclonedx`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new ApiError(error.message, response.status);
    }

    return response.json();
  },

  // Components
  addComponent: (sbomId: string, data: any) =>
    fetchApi<any>(`/sbom/${sbomId}/components`, { method: 'POST', body: JSON.stringify(data) }),
  deleteComponent: (componentId: string) =>
    fetchApi<void>(`/sbom/components/${componentId}`, { method: 'DELETE' }),

  // Vulnerabilities
  updateVulnStatus: (vulnId: string, status: string) =>
    fetchApi<any>(`/sbom/vulnerabilities/${vulnId}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
};

// ==================== Environments API ====================
export const environmentsApi = {
  list: () => fetchApi<any[]>('/environments'),
  get: (id: string) => fetchApi<any>(`/environments/${id}`),
  create: (data: any) =>
    fetchApi<any>('/environments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    fetchApi<any>(`/environments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    fetchApi<void>(`/environments/${id}`, { method: 'DELETE' }),
  summary: () => fetchApi<any>('/environments/summary'),

  // Deployments
  deployments: {
    list: (environmentId?: string) => {
      const params = environmentId ? `?environmentId=${environmentId}` : '';
      return fetchApi<any[]>(`/environments/deployments/all${params}`);
    },
    get: (id: string) => fetchApi<any>(`/environments/deployments/${id}`),
    create: (environmentId: string, data: any) =>
      fetchApi<any>(`/environments/${environmentId}/deployments`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      fetchApi<any>(`/environments/deployments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchApi<void>(`/environments/deployments/${id}`, { method: 'DELETE' }),
  },
};

// ==================== Compliance API ====================
export const complianceApi = {
  frameworks: () => fetchApi<any[]>('/compliance/frameworks'),
  score: (repositoryId?: string) =>
    fetchApi<any>(repositoryId ? `/compliance/score/${repositoryId}` : '/compliance/score'),
  violations: (frameworkId: string) => fetchApi<any>(`/compliance/violations/${frameworkId}`),
  trend: (frameworkId: string) => fetchApi<any>(`/compliance/trend/${frameworkId}`),
  report: (frameworkId: string) => fetchApi<any>(`/compliance/report/${frameworkId}`),
};

// ==================== Pipeline API ====================
export const pipelineApi = {
  gates: () => fetchApi<any[]>('/pipeline/gates'),
  getGate: (id: string) => fetchApi<any>(`/pipeline/gates/${id}`),
  createGate: (data: any) =>
    fetchApi<any>('/pipeline/gates', { method: 'POST', body: JSON.stringify(data) }),
  updateGate: (id: string, data: any) =>
    fetchApi<any>(`/pipeline/gates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGate: (id: string) =>
    fetchApi<void>(`/pipeline/gates/${id}`, { method: 'DELETE' }),
  status: () => fetchApi<any>('/pipeline/status'),
  runs: (limit = 20) => fetchApi<any[]>(`/pipeline/runs?limit=${limit}`),
  evaluate: (scanId: string) =>
    fetchApi<any>(`/pipeline/evaluate/${scanId}`, { method: 'POST' }),
};

// ==================== Team API ====================
export const teamApi = {
  members: () => fetchApi<any[]>('/team/members'),
  invite: (email: string, role: string) =>
    fetchApi<any>('/team/invite', { method: 'POST', body: JSON.stringify({ email, role }) }),
  updateRole: (userId: string, role: string) =>
    fetchApi<any>(`/team/members/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  remove: (userId: string) =>
    fetchApi<void>(`/team/members/${userId}`, { method: 'DELETE' }),
  pendingInvites: () => fetchApi<any[]>('/team/invites'),
  cancelInvite: (inviteId: string) =>
    fetchApi<void>(`/team/invites/${inviteId}`, { method: 'DELETE' }),
};

// ==================== API Keys API ====================
export const apiKeysApi = {
  list: () => fetchApi<any[]>('/api-keys'),
  create: (data: { name: string; permissions: string[]; expiresAt?: string }) =>
    fetchApi<any>('/api-keys', { method: 'POST', body: JSON.stringify(data) }),
  revoke: (id: string) =>
    fetchApi<void>(`/api-keys/${id}`, { method: 'DELETE' }),
};

// ==================== RAG API ====================
export const ragApi = {
  status: () => fetchApi<any>('/rag/status'),
  indexAll: () => fetchApi<any>('/rag/index/all', { method: 'POST' }),
  searchRemediation: (query: string) =>
    fetchApi<any[]>(`/rag/search/remediation?q=${encodeURIComponent(query)}`),
  searchAttack: (query: string) =>
    fetchApi<any[]>(`/rag/search/attack?q=${encodeURIComponent(query)}`),
  searchCompliance: (query: string) =>
    fetchApi<any[]>(`/rag/search/compliance?q=${encodeURIComponent(query)}`),
  getRemediation: (findingId: string) => fetchApi<any>(`/rag/remediation/${findingId}`),
};

// ==================== Export API ====================
export const exportApi = {
  findings: (format: 'json' | 'csv' = 'json', filters?: Record<string, any>) => {
    const params = new URLSearchParams({ format });
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => v && params.append(k, String(v)));
    }
    return `${API_URL}/export/findings?${params}`;
  },
  scans: (format: 'json' | 'csv' = 'json') =>
    `${API_URL}/export/scans?format=${format}`,
  sarif: (scanId: string) => `${API_URL}/export/sarif/${scanId}`,
  sbom: (repositoryId: string) => `${API_URL}/export/sbom/${repositoryId}`,
};

// ==================== CSPM API ====================
export const cspmApi = {
  accounts: () => fetchApi<any[]>('/cspm/accounts'),
  getAccount: (id: string) => fetchApi<any>(`/cspm/accounts/${id}`),
  addAccount: (data: any) =>
    fetchApi<any>('/cspm/accounts', { method: 'POST', body: JSON.stringify(data) }),
  deleteAccount: (id: string) =>
    fetchApi<void>(`/cspm/accounts/${id}`, { method: 'DELETE' }),
  scanAccount: (id: string) =>
    fetchApi<any>(`/cspm/accounts/${id}/scan`, { method: 'POST' }),
  findings: (accountId?: string) => {
    const params = accountId ? `?accountId=${accountId}` : '';
    return fetchApi<any[]>(`/cspm/findings${params}`);
  },
};

// ==================== SIEM API ====================
export const siemApi = {
  events: (filters?: Record<string, any>) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => v && params.append(k, String(v)));
    }
    return fetchApi<any[]>(`/siem/events?${params}`);
  },
  alerts: (status?: string) => {
    const params = status ? `?status=${status}` : '';
    return fetchApi<any[]>(`/siem/alerts${params}`);
  },
  acknowledgeAlert: (id: string) =>
    fetchApi<any>(`/siem/alerts/${id}/acknowledge`, { method: 'POST' }),
  resolveAlert: (id: string) =>
    fetchApi<any>(`/siem/alerts/${id}/resolve`, { method: 'POST' }),
  rules: () => fetchApi<any[]>('/siem/rules'),
  createRule: (data: any) =>
    fetchApi<any>('/siem/rules', { method: 'POST', body: JSON.stringify(data) }),
  updateRule: (id: string, data: any) =>
    fetchApi<any>(`/siem/rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRule: (id: string) =>
    fetchApi<void>(`/siem/rules/${id}`, { method: 'DELETE' }),
};

// ==================== Containers API ====================
export const containersApi = {
  registries: () => fetchApi<any[]>('/containers/registries'),
  getRegistry: (id: string) => fetchApi<any>(`/containers/registries/${id}`),
  createRegistry: (data: any) =>
    fetchApi<any>('/containers/registries', { method: 'POST', body: JSON.stringify(data) }),
  deleteRegistry: (id: string) =>
    fetchApi<void>(`/containers/registries/${id}`, { method: 'DELETE' }),

  images: (registryId?: string) => {
    const params = registryId ? `?registryId=${registryId}` : '';
    return fetchApi<any[]>(`/containers/images${params}`);
  },
  getImage: (id: string) => fetchApi<any>(`/containers/images/${id}`),

  scans: (imageId?: string) => {
    const params = imageId ? `?imageId=${imageId}` : '';
    return fetchApi<any[]>(`/containers/scans${params}`);
  },
  scanImage: (imageId: string) =>
    fetchApi<any>(`/containers/images/${imageId}/scan`, { method: 'POST' }),
};

// ==================== Settings API ====================
export const settingsApi = {
  tenant: () => fetchApi<any>('/settings/tenant'),
  updateTenant: (data: any) =>
    fetchApi<any>('/settings/tenant', { method: 'PUT', body: JSON.stringify(data) }),
  notifications: () => fetchApi<any>('/settings/notifications'),
  updateNotifications: (data: any) =>
    fetchApi<any>('/settings/notifications', { method: 'PUT', body: JSON.stringify(data) }),
  threatIntel: () => fetchApi<any>('/settings/threat-intel'),
  updateThreatIntel: (data: any) =>
    fetchApi<any>('/settings/threat-intel', { method: 'PUT', body: JSON.stringify(data) }),
};

// ==================== Projects API ====================
export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectScmAccess {
  id: string;
  projectId: string;
  connectionId: string;
  createdAt: string;
  connection?: {
    id: string;
    provider: string;
    externalName: string;
  };
  repoAccess?: ProjectRepoAccess[];
}

export interface ProjectRepoAccess {
  id: string;
  projectAccessId: string;
  externalRepoId: string;
  fullName: string;
  createdAt: string;
}

export const projectsApi = {
  list: () => fetchApi<Project[]>('/projects'),
  get: (id: string) => fetchApi<Project>(`/projects/${id}`),
  create: (data: { name: string; description?: string }) =>
    fetchApi<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; description?: string }) =>
    fetchApi<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    fetchApi<void>(`/projects/${id}`, { method: 'DELETE' }),

  // SCM Access Management
  scmAccess: {
    list: (projectId: string) =>
      fetchApi<ProjectScmAccess[]>(`/projects/${projectId}/scm-access`),
    grant: (projectId: string, connectionId: string) =>
      fetchApi<ProjectScmAccess>(`/projects/${projectId}/scm-access`, {
        method: 'POST',
        body: JSON.stringify({ connectionId }),
      }),
    revoke: (projectId: string, connectionId: string) =>
      fetchApi<void>(`/projects/${projectId}/scm-access/${connectionId}`, { method: 'DELETE' }),

    // Repo access within a connection
    getRepos: (projectId: string, connectionId: string) =>
      fetchApi<ProjectRepoAccess[]>(`/projects/${projectId}/scm-access/${connectionId}/repos`),
    grantRepos: (projectId: string, connectionId: string, repos: { externalRepoId: string; fullName: string }[]) =>
      fetchApi<ProjectRepoAccess[]>(`/projects/${projectId}/scm-access/${connectionId}/repos`, {
        method: 'POST',
        body: JSON.stringify({ repos }),
      }),
    revokeRepos: (projectId: string, connectionId: string, externalRepoIds: string[]) =>
      fetchApi<void>(`/projects/${projectId}/scm-access/${connectionId}/repos`, {
        method: 'DELETE',
        body: JSON.stringify({ externalRepoIds }),
      }),
  },
};

