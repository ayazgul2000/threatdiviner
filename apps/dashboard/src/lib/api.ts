const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  login: (tenant: string, email: string, password: string) =>
    fetchApi<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ tenant, email, password }),
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

  getAvailableRepos: (connectionId: string) =>
    fetchApi<{ id: string; name: string; fullName: string; isPrivate: boolean }[]>(
      `/scm/connections/${connectionId}/available-repos`
    ),
};

// Repositories API
export const repositoriesApi = {
  list: () =>
    fetchApi<Repository[]>('/scm/repositories'),

  get: (id: string) =>
    fetchApi<Repository>(`/scm/repositories/${id}`),

  add: (connectionId: string, externalId: string, fullName: string) =>
    fetchApi<Repository>('/scm/repositories', {
      method: 'POST',
      body: JSON.stringify({ connectionId, externalId, fullName }),
    }),

  updateConfig: (id: string, config: Partial<ScanConfig>) =>
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

  get: (id: string) =>
    fetchApi<Scan>(`/scm/scans/${id}`),

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
