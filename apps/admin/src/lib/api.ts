const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types
export interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  maxUsers: number;
  maxRepositories: number;
  aiTriageEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  stats?: TenantStats;
}

export interface TenantStats {
  userCount: number;
  repositoryCount: number;
  scanCount: number;
  findingCount: number;
}

export interface PlatformConfig {
  id: string;
  aiProvider: string;
  aiModel: string;
  aiApiKeySet: boolean;
  defaultPlan: string;
  defaultMaxUsers: number;
  defaultMaxRepositories: number;
  maintenanceMode: boolean;
  updatedAt: string;
}

export interface SystemHealth {
  api: { status: 'healthy' | 'degraded' | 'down'; latency: number };
  database: { status: 'healthy' | 'degraded' | 'down'; latency: number };
  redis: { status: 'healthy' | 'degraded' | 'down'; latency: number };
  storage: { status: 'healthy' | 'degraded' | 'down'; usage: number };
}

export interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalRepositories: number;
  totalScans: number;
  totalFindings: number;
  scansToday: number;
  findingsToday: number;
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

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Platform Auth API
export const platformAuthApi = {
  login: (email: string, password: string) =>
    fetchApi<{ admin: PlatformAdmin }>('/platform/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    fetchApi<void>('/platform/auth/logout', { method: 'POST' }),

  getProfile: () =>
    fetchApi<PlatformAdmin>('/platform/auth/profile'),
};

// Tenants API
export const tenantsApi = {
  list: () =>
    fetchApi<Tenant[]>('/platform/tenants'),

  get: (id: string) =>
    fetchApi<Tenant>(`/platform/tenants/${id}`),

  create: (data: { name: string; slug: string; plan?: string }) =>
    fetchApi<Tenant>('/platform/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Tenant>) =>
    fetchApi<Tenant>(`/platform/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/platform/tenants/${id}`, { method: 'DELETE' }),
};

// Platform Config API
export const platformConfigApi = {
  get: () =>
    fetchApi<PlatformConfig>('/platform/config'),

  update: (data: Partial<PlatformConfig>) =>
    fetchApi<PlatformConfig>('/platform/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateAiKey: (apiKey: string) =>
    fetchApi<{ success: boolean }>('/platform/config/ai-key', {
      method: 'PUT',
      body: JSON.stringify({ apiKey }),
    }),
};

// Platform Stats API
export const platformStatsApi = {
  get: () =>
    fetchApi<PlatformStats>('/platform/stats'),

  getHealth: () =>
    fetchApi<SystemHealth>('/platform/health'),
};
