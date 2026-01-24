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

// Shape Mapping Types
export interface ShapeMapping {
  id: string;
  drawioStyle: string;
  stylePattern: string | null;
  threagileType: string;
  machineType: string;
  defaultInternetFacing: boolean;
  defaultEncryption: string;
  defaultAuthentication: string;
  defaultMultiTenant: boolean;
  displayName: string;
  category: string;
  iconUrl: string | null;
  status: 'pending' | 'review' | 'live';
  aiSuggested: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface ShapeMappingListQuery {
  search?: string;
  category?: string;
  status?: string;
  aiSuggested?: string;
  limit?: number;
  offset?: number;
}

export interface CreateShapeMappingData {
  drawioStyle: string;
  stylePattern?: string;
  threagileType: string;
  machineType?: string;
  defaultInternetFacing?: boolean;
  defaultEncryption?: string;
  defaultAuthentication?: string;
  defaultMultiTenant?: boolean;
  displayName: string;
  category: string;
  iconUrl?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ style: string; error: string }>;
}

// Shape Mappings API
export const shapeMappingsApi = {
  list: (query: ShapeMappingListQuery = {}) => {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.category) params.set('category', query.category);
    if (query.status) params.set('status', query.status);
    if (query.aiSuggested !== undefined) params.set('aiSuggested', query.aiSuggested);
    if (query.limit) params.set('limit', String(query.limit));
    if (query.offset) params.set('offset', String(query.offset));
    const qs = params.toString();
    return fetchApi<{ mappings: ShapeMapping[]; total: number }>(`/admin/shape-mappings${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) =>
    fetchApi<{ mapping: ShapeMapping }>(`/admin/shape-mappings/${id}`),

  create: (data: CreateShapeMappingData) =>
    fetchApi<{ mapping: ShapeMapping }>('/admin/shape-mappings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CreateShapeMappingData>) =>
    fetchApi<{ mapping: ShapeMapping }>(`/admin/shape-mappings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/admin/shape-mappings/${id}`, { method: 'DELETE' }),

  submitForReview: (id: string) =>
    fetchApi<{ mapping: ShapeMapping }>(`/admin/shape-mappings/${id}/submit`, { method: 'POST' }),

  approve: (id: string) =>
    fetchApi<{ mapping: ShapeMapping }>(`/admin/shape-mappings/${id}/approve`, { method: 'POST' }),

  bulkImport: (mappings: CreateShapeMappingData[]) =>
    fetchApi<ImportResult>('/admin/shape-mappings/import', {
      method: 'POST',
      body: JSON.stringify({ mappings }),
    }),

  getCategories: () =>
    fetchApi<{ categories: string[] }>('/admin/shape-mappings/categories'),
};

// Canonical Risk Types
export interface CanonicalRiskSource {
  id: string;
  source: string;
  sourceRuleId: string;
  sourceTitle: string | null;
  createdAt: string;
}

export interface CanonicalRisk {
  id: string;
  canonicalId: string;
  title: string;
  description: string | null;
  defaultSeverity: string;
  cweId: string | null;
  cweName: string | null;
  capecIds: string[];
  attackIds: string[];
  status: 'pending' | 'review' | 'live';
  createdAt: string;
  updatedAt: string;
  sources?: CanonicalRiskSource[];
  _count?: { sources: number };
}

export interface CanonicalRiskListQuery {
  search?: string;
  source?: string;
  severity?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface CreateCanonicalRiskData {
  canonicalId: string;
  title: string;
  description?: string;
  defaultSeverity?: string;
  cweId?: string;
  cweName?: string;
  capecIds?: string[];
  attackIds?: string[];
}

export interface AddSourceData {
  source: string;
  sourceRuleId: string;
  sourceTitle?: string;
}

export interface CanonicalRiskImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ canonicalId: string; error: string }>;
}

// Canonical Risks API
export const canonicalRisksApi = {
  list: (query: CanonicalRiskListQuery = {}) => {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.source) params.set('source', query.source);
    if (query.severity) params.set('severity', query.severity);
    if (query.status) params.set('status', query.status);
    if (query.limit) params.set('limit', String(query.limit));
    if (query.offset) params.set('offset', String(query.offset));
    const qs = params.toString();
    return fetchApi<{ risks: CanonicalRisk[]; total: number }>(`/admin/canonical-risks${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) =>
    fetchApi<{ risk: CanonicalRisk }>(`/admin/canonical-risks/${id}`),

  create: (data: CreateCanonicalRiskData) =>
    fetchApi<{ risk: CanonicalRisk }>('/admin/canonical-risks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CreateCanonicalRiskData>) =>
    fetchApi<{ risk: CanonicalRisk }>(`/admin/canonical-risks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/admin/canonical-risks/${id}`, { method: 'DELETE' }),

  addSource: (riskId: string, data: AddSourceData) =>
    fetchApi<{ source: CanonicalRiskSource }>(`/admin/canonical-risks/${riskId}/sources`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeSource: (riskId: string, sourceId: string) =>
    fetchApi<{ success: boolean }>(`/admin/canonical-risks/${riskId}/sources/${sourceId}`, {
      method: 'DELETE',
    }),

  submitForReview: (id: string) =>
    fetchApi<{ risk: CanonicalRisk }>(`/admin/canonical-risks/${id}/submit`, { method: 'POST' }),

  approve: (id: string) =>
    fetchApi<{ risk: CanonicalRisk }>(`/admin/canonical-risks/${id}/approve`, { method: 'POST' }),

  bulkImport: (risks: CreateCanonicalRiskData[]) =>
    fetchApi<CanonicalRiskImportResult>('/admin/canonical-risks/import', {
      method: 'POST',
      body: JSON.stringify({ risks }),
    }),

  getSources: () =>
    fetchApi<{ sources: string[] }>('/admin/canonical-risks/sources'),

  getSeverities: () =>
    fetchApi<{ severities: string[] }>('/admin/canonical-risks/severities'),
};

// Compliance Framework Types
export interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  description: string;
  sourceUrl: string;
  lastUpdated: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  controls?: ComplianceControl[];
  _count?: { controls: number };
}

export interface ComplianceControl {
  id: string;
  frameworkId: string;
  controlId: string;
  parentId: string | null;
  category: string;
  name: string;
  description: string;
  guidance: string | null;
  level: number;
  createdAt: string;
  updatedAt: string;
  children?: ComplianceControl[];
  riskMappings?: RiskControlMapping[];
  _count?: { children: number; riskMappings: number };
}

export interface RiskControlMapping {
  id: string;
  canonicalRiskId: string;
  complianceControlId: string;
  relevance: string;
  aiConfidence: number | null;
  createdAt: string;
  canonicalRisk?: {
    id: string;
    canonicalId: string;
    title: string;
    status: string;
  };
}

export interface ComplianceFrameworkListQuery {
  search?: string;
  isActive?: string;
  limit?: number;
  offset?: number;
}

export interface ComplianceControlListQuery {
  search?: string;
  category?: string;
  level?: string;
  parentId?: string;
  limit?: number;
  offset?: number;
}

export interface CreateComplianceFrameworkData {
  id: string;
  name: string;
  version: string;
  description?: string;
  sourceUrl?: string;
  isActive?: boolean;
}

export interface CreateComplianceControlData {
  controlId: string;
  parentId?: string;
  category: string;
  name: string;
  description?: string;
  guidance?: string;
  level?: number;
}

export interface AddRiskMappingData {
  canonicalRiskId: string;
  relevance?: string;
  aiConfidence?: number;
}

export interface FrameworkImportResult {
  frameworksImported: number;
  controlsImported: number;
  errors: Array<{ item: string; error: string }>;
}

// Compliance Frameworks API
export const complianceFrameworksApi = {
  list: (query: ComplianceFrameworkListQuery = {}) => {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.isActive) params.set('isActive', query.isActive);
    if (query.limit) params.set('limit', String(query.limit));
    if (query.offset) params.set('offset', String(query.offset));
    const qs = params.toString();
    return fetchApi<{ frameworks: ComplianceFramework[]; total: number }>(`/admin/compliance-frameworks${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) =>
    fetchApi<{ framework: ComplianceFramework }>(`/admin/compliance-frameworks/${id}`),

  create: (data: CreateComplianceFrameworkData) =>
    fetchApi<{ framework: ComplianceFramework }>('/admin/compliance-frameworks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Omit<CreateComplianceFrameworkData, 'id'>>) =>
    fetchApi<{ framework: ComplianceFramework }>(`/admin/compliance-frameworks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/admin/compliance-frameworks/${id}`, { method: 'DELETE' }),

  getMappingsCount: (id: string) =>
    fetchApi<{ count: number }>(`/admin/compliance-frameworks/${id}/mappings-count`),

  // Control endpoints
  listControls: (frameworkId: string, query: ComplianceControlListQuery = {}) => {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.category) params.set('category', query.category);
    if (query.level) params.set('level', query.level);
    if (query.parentId !== undefined) params.set('parentId', query.parentId);
    if (query.limit) params.set('limit', String(query.limit));
    if (query.offset) params.set('offset', String(query.offset));
    const qs = params.toString();
    return fetchApi<{ controls: ComplianceControl[]; total: number }>(`/admin/compliance-frameworks/${frameworkId}/controls${qs ? `?${qs}` : ''}`);
  },

  getControlTree: (frameworkId: string) =>
    fetchApi<{ controls: ComplianceControl[] }>(`/admin/compliance-frameworks/${frameworkId}/controls/tree`),

  getCategories: (frameworkId: string) =>
    fetchApi<{ categories: string[] }>(`/admin/compliance-frameworks/${frameworkId}/controls/categories`),

  getControl: (frameworkId: string, controlId: string) =>
    fetchApi<{ control: ComplianceControl }>(`/admin/compliance-frameworks/${frameworkId}/controls/${controlId}`),

  createControl: (frameworkId: string, data: CreateComplianceControlData) =>
    fetchApi<{ control: ComplianceControl }>(`/admin/compliance-frameworks/${frameworkId}/controls`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateControl: (frameworkId: string, controlId: string, data: Partial<CreateComplianceControlData>) =>
    fetchApi<{ control: ComplianceControl }>(`/admin/compliance-frameworks/${frameworkId}/controls/${controlId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteControl: (frameworkId: string, controlId: string) =>
    fetchApi<{ success: boolean }>(`/admin/compliance-frameworks/${frameworkId}/controls/${controlId}`, { method: 'DELETE' }),

  // Risk mapping endpoints
  getRiskMappings: (controlId: string) =>
    fetchApi<{ mappings: RiskControlMapping[] }>(`/admin/compliance-frameworks/controls/${controlId}/mappings`),

  addRiskMapping: (controlId: string, data: AddRiskMappingData) =>
    fetchApi<{ mapping: RiskControlMapping }>(`/admin/compliance-frameworks/controls/${controlId}/mappings`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeRiskMapping: (controlId: string, mappingId: string) =>
    fetchApi<{ success: boolean }>(`/admin/compliance-frameworks/controls/${controlId}/mappings/${mappingId}`, {
      method: 'DELETE',
    }),

  // Bulk import
  bulkImport: (data: CreateComplianceFrameworkData & { controls?: CreateComplianceControlData[] }) =>
    fetchApi<FrameworkImportResult>('/admin/compliance-frameworks/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Remediation Playbook Types
export interface PlaybookStep {
  id: string;
  playbookId: string;
  stepNumber: number;
  title: string;
  description: string;
  effort: string | null;
  role: string | null;
  estimatedMinutes: number | null;
  automatable: boolean;
  createdAt: string;
}

export interface PlaybookIacSnippet {
  id: string;
  playbookId: string;
  platform: string;
  code: string;
  description: string | null;
  createdAt: string;
}

export interface RemediationPlaybook {
  id: string;
  canonicalRiskId: string;
  title: string;
  description: string | null;
  totalEffort: string | null;
  status: 'pending' | 'review' | 'live';
  createdAt: string;
  updatedAt: string;
  canonicalRisk?: {
    id: string;
    canonicalId: string;
    title: string;
    cweId?: string;
    cweName?: string;
  };
  steps?: PlaybookStep[];
  iacSnippets?: PlaybookIacSnippet[];
  _count?: { steps: number; iacSnippets: number };
}

export interface PlaybookStats {
  totalSteps: number;
  automatableSteps: number;
  totalMinutes: number;
  roles: string[];
  platforms: string[];
}

export interface PlaybookListQuery {
  search?: string;
  effort?: string;
  hasIac?: string;
  status?: string;
  canonicalRiskId?: string;
  page?: number;
  limit?: number;
}

export interface CreatePlaybookData {
  canonicalRiskId: string;
  title: string;
  description?: string;
  totalEffort?: string;
}

export interface CreateStepData {
  title: string;
  description: string;
  effort?: string;
  role?: string;
  estimatedMinutes?: number;
  automatable?: boolean;
}

export interface CreateIacSnippetData {
  platform: string;
  code: string;
  description?: string;
}

export interface PlaybookImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// Playbooks API
export const playbooksApi = {
  list: (query: PlaybookListQuery = {}) => {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.effort) params.set('effort', query.effort);
    if (query.hasIac) params.set('hasIac', query.hasIac);
    if (query.status) params.set('status', query.status);
    if (query.canonicalRiskId) params.set('canonicalRiskId', query.canonicalRiskId);
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    return fetchApi<{ playbooks: RemediationPlaybook[]; total: number; page: number; limit: number; totalPages: number }>(`/admin/playbooks${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) =>
    fetchApi<{ playbook: RemediationPlaybook }>(`/admin/playbooks/${id}`),

  getStats: (id: string) =>
    fetchApi<{ stats: PlaybookStats }>(`/admin/playbooks/${id}/stats`),

  create: (data: CreatePlaybookData) =>
    fetchApi<{ playbook: RemediationPlaybook }>('/admin/playbooks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CreatePlaybookData>) =>
    fetchApi<{ playbook: RemediationPlaybook }>(`/admin/playbooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/admin/playbooks/${id}`, { method: 'DELETE' }),

  submitForReview: (id: string) =>
    fetchApi<{ playbook: RemediationPlaybook }>(`/admin/playbooks/${id}/submit`, { method: 'POST' }),

  approve: (id: string) =>
    fetchApi<{ playbook: RemediationPlaybook }>(`/admin/playbooks/${id}/approve`, { method: 'POST' }),

  bulkImport: (playbooks: Array<CreatePlaybookData & { steps?: Array<CreateStepData & { stepNumber: number }>; iacSnippets?: CreateIacSnippetData[] }>) =>
    fetchApi<PlaybookImportResult>('/admin/playbooks/import', {
      method: 'POST',
      body: JSON.stringify({ playbooks }),
    }),

  getEffortOptions: () =>
    fetchApi<{ options: string[] }>('/admin/playbooks/options/effort'),

  getRoleOptions: () =>
    fetchApi<{ options: string[] }>('/admin/playbooks/options/roles'),

  getPlatformOptions: () =>
    fetchApi<{ options: string[] }>('/admin/playbooks/options/platforms'),

  // Step endpoints
  listSteps: (playbookId: string) =>
    fetchApi<{ steps: PlaybookStep[] }>(`/admin/playbooks/${playbookId}/steps`),

  createStep: (playbookId: string, data: CreateStepData) =>
    fetchApi<{ step: PlaybookStep }>(`/admin/playbooks/${playbookId}/steps`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateStep: (playbookId: string, stepId: string, data: Partial<CreateStepData>) =>
    fetchApi<{ step: PlaybookStep }>(`/admin/playbooks/${playbookId}/steps/${stepId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteStep: (playbookId: string, stepId: string) =>
    fetchApi<{ success: boolean }>(`/admin/playbooks/${playbookId}/steps/${stepId}`, { method: 'DELETE' }),

  reorderSteps: (playbookId: string, stepIds: string[]) =>
    fetchApi<{ steps: PlaybookStep[] }>(`/admin/playbooks/${playbookId}/steps/reorder`, {
      method: 'POST',
      body: JSON.stringify({ stepIds }),
    }),

  // IaC Snippet endpoints
  listIacSnippets: (playbookId: string) =>
    fetchApi<{ snippets: PlaybookIacSnippet[] }>(`/admin/playbooks/${playbookId}/iac-snippets`),

  createIacSnippet: (playbookId: string, data: CreateIacSnippetData) =>
    fetchApi<{ snippet: PlaybookIacSnippet }>(`/admin/playbooks/${playbookId}/iac-snippets`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateIacSnippet: (playbookId: string, snippetId: string, data: Partial<Omit<CreateIacSnippetData, 'platform'>>) =>
    fetchApi<{ snippet: PlaybookIacSnippet }>(`/admin/playbooks/${playbookId}/iac-snippets/${snippetId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteIacSnippet: (playbookId: string, snippetId: string) =>
    fetchApi<{ success: boolean }>(`/admin/playbooks/${playbookId}/iac-snippets/${snippetId}`, { method: 'DELETE' }),
};

// Wizard Question Types
export interface WizardCondition {
  property: string;
  operator: string;
  value: string;
}

export interface WizardTriggerNode {
  name: string;
  ref: string;
  technology?: string;
  machineType?: string;
  placementBoundary?: string;
  internetFacing?: boolean;
  multiTenant?: boolean;
  encryption?: string;
  authentication?: string;
}

export interface WizardTriggerBoundary {
  name: string;
  ref: string;
  type: string;
}

export interface WizardTriggerLink {
  sourceRef: string;
  targetRef: string;
  protocol?: string;
  authentication?: string;
  encryption?: string;
}

export interface WizardTrigger {
  addNodes?: WizardTriggerNode[];
  addBoundaries?: WizardTriggerBoundary[];
  addLinks?: WizardTriggerLink[];
  setProperties?: Record<string, string>;
}

export interface WizardOption {
  id: string;
  questionId: string;
  value: string;
  label: string;
  description: string | null;
  iconUrl: string | null;
  nextQuestionId: string | null;
  triggers: WizardTrigger;
  createdAt: string;
}

export interface WizardQuestion {
  id: string;
  questionId: string;
  text: string;
  helpText: string | null;
  type: 'single-select' | 'multi-select' | 'text' | 'toggle';
  orderIndex: number;
  isEntryPoint: boolean;
  isTerminal: boolean;
  conditions: WizardCondition[];
  status: 'pending' | 'review' | 'live';
  createdAt: string;
  updatedAt: string;
  options?: WizardOption[];
  _count?: { options: number };
}

export interface WizardDecisionTree {
  questions: Array<{
    id: string;
    questionId: string;
    text: string;
    type: string;
    orderIndex: number;
    isEntryPoint: boolean;
    isTerminal: boolean;
    status: string;
    options: Array<{
      id: string;
      value: string;
      label: string;
      nextQuestionId: string | null;
    }>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    label: string;
  }>;
}

export interface WizardTestFlowResult {
  globalProperties: Record<string, string>;
  nodes: Array<{ name: string; ref: string; technology?: string }>;
  boundaries: Array<{ name: string; ref: string; type: string }>;
  links: Array<{ sourceRef: string; targetRef: string; protocol?: string }>;
  path: Array<{ questionId: string; selectedValue: string; questionText: string }>;
}

export interface WizardStats {
  totalQuestions: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  entryPoints: number;
  terminalQuestions: number;
  orphanedQuestions: number;
}

export interface WizardQuestionListQuery {
  search?: string;
  type?: string;
  status?: string;
  isEntryPoint?: string;
}

export interface CreateWizardQuestionData {
  questionId: string;
  text: string;
  helpText?: string;
  type: string;
  orderIndex: number;
  isEntryPoint?: boolean;
  isTerminal?: boolean;
  conditions?: WizardCondition[];
}

export interface CreateWizardOptionData {
  value: string;
  label: string;
  description?: string;
  iconUrl?: string;
  nextQuestionId?: string;
  triggers?: WizardTrigger;
}

export interface WizardImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// Wizard API
export const wizardApi = {
  // Question endpoints
  listQuestions: (query: WizardQuestionListQuery = {}) => {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.type) params.set('type', query.type);
    if (query.status) params.set('status', query.status);
    if (query.isEntryPoint) params.set('isEntryPoint', query.isEntryPoint);
    const qs = params.toString();
    return fetchApi<{ questions: WizardQuestion[]; total: number }>(`/admin/wizard/questions${qs ? `?${qs}` : ''}`);
  },

  getQuestion: (id: string) =>
    fetchApi<WizardQuestion>(`/admin/wizard/questions/${id}`),

  createQuestion: (data: CreateWizardQuestionData) =>
    fetchApi<WizardQuestion>('/admin/wizard/questions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateQuestion: (id: string, data: Partial<CreateWizardQuestionData> & { status?: string }) =>
    fetchApi<WizardQuestion>(`/admin/wizard/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteQuestion: (id: string) =>
    fetchApi<void>(`/admin/wizard/questions/${id}`, { method: 'DELETE' }),

  reorderQuestions: (questionIds: string[]) =>
    fetchApi<void>('/admin/wizard/questions/reorder', {
      method: 'POST',
      body: JSON.stringify({ questionIds }),
    }),

  submitForReview: (id: string) =>
    fetchApi<{ id: string; questionId: string; status: string }>(`/admin/wizard/questions/${id}/submit-for-review`, { method: 'POST' }),

  approve: (id: string) =>
    fetchApi<{ id: string; questionId: string; status: string }>(`/admin/wizard/questions/${id}/approve`, { method: 'POST' }),

  // Option endpoints
  listOptions: (questionId: string) =>
    fetchApi<WizardOption[]>(`/admin/wizard/questions/${questionId}/options`),

  getOption: (optionId: string) =>
    fetchApi<WizardOption>(`/admin/wizard/options/${optionId}`),

  createOption: (questionId: string, data: CreateWizardOptionData) =>
    fetchApi<WizardOption>(`/admin/wizard/questions/${questionId}/options`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateOption: (optionId: string, data: Partial<CreateWizardOptionData>) =>
    fetchApi<WizardOption>(`/admin/wizard/options/${optionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteOption: (optionId: string) =>
    fetchApi<void>(`/admin/wizard/options/${optionId}`, { method: 'DELETE' }),

  // Decision tree & test flow
  getDecisionTree: () =>
    fetchApi<WizardDecisionTree>('/admin/wizard/decision-tree'),

  testFlow: (answers: Array<{ questionId: string; selectedValue: string }>) =>
    fetchApi<WizardTestFlowResult>('/admin/wizard/test-flow', {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),

  // Stats & metadata
  getStats: () =>
    fetchApi<WizardStats>('/admin/wizard/stats'),

  getQuestionTypes: () =>
    fetchApi<string[]>('/admin/wizard/question-types'),

  getConditionOperators: () =>
    fetchApi<string[]>('/admin/wizard/condition-operators'),

  // Bulk import
  bulkImport: (questions: Array<CreateWizardQuestionData & { options?: CreateWizardOptionData[] }>) =>
    fetchApi<WizardImportResult>('/admin/wizard/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ questions }),
    }),
};
