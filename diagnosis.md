# ThreatDiviner Diagnostic Report

Generated: 2026-01-02

---

## 1. Dashboard Pages (55 total)

### Root Pages
- `/app/page.tsx` - Landing page
- `/app/login/page.tsx` - Login page

### Dashboard Pages (53)
| Path | Description |
|------|-------------|
| `/dashboard/page.tsx` | Main dashboard |
| `/dashboard/projects/page.tsx` | Projects list |
| `/dashboard/repositories/page.tsx` | Repositories list |
| `/dashboard/repositories/[id]/page.tsx` | Repository detail |
| `/dashboard/repositories/[id]/settings/page.tsx` | Repository settings |
| `/dashboard/scans/page.tsx` | Scans list |
| `/dashboard/scans/[id]/page.tsx` | Scan detail |
| `/dashboard/findings/page.tsx` | Findings list |
| `/dashboard/findings/[id]/page.tsx` | Finding detail |
| `/dashboard/baselines/page.tsx` | Baselines management |
| `/dashboard/threat-modeling/page.tsx` | Threat models list |
| `/dashboard/threat-modeling/new/page.tsx` | New threat model |
| `/dashboard/threat-modeling/[id]/page.tsx` | Threat model detail |
| `/dashboard/threat-modeling/[id]/diagram/page.tsx` | Threat model diagram |
| `/dashboard/compliance/page.tsx` | Compliance dashboard |
| `/dashboard/sbom/page.tsx` | SBOM list |
| `/dashboard/sbom/[id]/page.tsx` | SBOM detail |
| `/dashboard/containers/page.tsx` | Container scanning |
| `/dashboard/environments/page.tsx` | Environments list |
| `/dashboard/environments/[id]/page.tsx` | Environment detail |
| `/dashboard/pipeline/page.tsx` | Pipeline gates |
| `/dashboard/connections/page.tsx` | SCM connections |
| `/dashboard/analytics/page.tsx` | Analytics |
| `/dashboard/sla/page.tsx` | SLA tracker |
| `/dashboard/reports/page.tsx` | Reports |
| `/dashboard/vulndb/page.tsx` | Vulnerability DB |
| `/dashboard/vulndb/cve/page.tsx` | CVE browser |
| `/dashboard/vulndb/cwe/page.tsx` | CWE browser |
| `/dashboard/vulndb/owasp/page.tsx` | OWASP browser |
| `/dashboard/vulndb/sync/page.tsx` | VulnDB sync |
| `/dashboard/attack/page.tsx` | ATT&CK matrix |
| `/dashboard/attack/killchain/page.tsx` | Kill chain |
| `/dashboard/attack/threats/page.tsx` | Threats |
| `/dashboard/attack/surface/page.tsx` | Attack surface |
| `/dashboard/attack/technique/[id]/page.tsx` | Technique detail |
| `/dashboard/cloud/page.tsx` | Cloud security |
| `/dashboard/cloud/findings/page.tsx` | Cloud findings |
| `/dashboard/cloud/compliance/page.tsx` | Cloud compliance |
| `/dashboard/cspm/page.tsx` | CSPM |
| `/dashboard/siem/page.tsx` | SIEM |
| `/dashboard/siem/alerts/page.tsx` | SIEM alerts |
| `/dashboard/siem/rules/page.tsx` | SIEM rules |
| `/dashboard/threat-intel/page.tsx` | Threat intelligence |
| `/dashboard/settings/page.tsx` | Settings hub |
| `/dashboard/settings/project/page.tsx` | Project settings |
| `/dashboard/settings/project/team/page.tsx` | Project team |
| `/dashboard/settings/org/page.tsx` | Org settings |
| `/dashboard/settings/org/team/page.tsx` | Org team |
| `/dashboard/settings/profile/page.tsx` | Profile |
| `/dashboard/settings/team/page.tsx` | Team (legacy) |
| `/dashboard/settings/notifications/page.tsx` | Notifications |
| `/dashboard/settings/api-keys/page.tsx` | API keys |
| `/dashboard/settings/alerts/page.tsx` | Alert rules |

---

## 2. API Controllers (36 total)

| Controller | Path |
|------------|------|
| health.controller.ts | Health checks |
| auth.controller.ts | Authentication |
| projects.controller.ts | Projects CRUD |
| scm.controller.ts | SCM (repos, scans, findings) |
| webhooks.controller.ts | Webhooks |
| threat-modeling.controller.ts | Threat modeling |
| sbom.controller.ts | SBOM management |
| compliance.controller.ts | Compliance |
| environments.controller.ts | Environments |
| containers.controller.ts | Container scanning |
| pipeline.controller.ts | Pipeline gates |
| baseline.controller.ts | Baselines |
| export.controller.ts | Data export |
| apikeys.controller.ts | API key management |
| team.controller.ts | Team management |
| notifications.controller.ts | Notifications |
| alerts.controller.ts | Alert rules |
| audit.controller.ts | Audit logs |
| ai.controller.ts | AI triage |
| analytics.controller.ts | Analytics |
| dashboard.controller.ts | Dashboard stats |
| reporting.controller.ts | Report generation |
| schedule.controller.ts | Scheduled tasks |
| retention.controller.ts | Data retention |
| vulndb.controller.ts | Vulnerability DB |
| threat-intel.controller.ts | Threat intelligence |
| cspm.controller.ts | CSPM |
| siem.controller.ts | SIEM |
| fix.controller.ts | Fix/PR actions |
| rag.controller.ts | RAG module |
| cli.controller.ts | CLI commands |
| jira.controller.ts | Jira integration |
| platform-tenants.controller.ts | Platform tenants |
| platform-config.controller.ts | Platform config |
| platform-stats.controller.ts | Platform stats |
| platform-auth.controller.ts | Platform auth |

---

## 3. Prisma Schema Models (56 models)

| Model | Purpose |
|-------|---------|
| Tenant | Multi-tenant organization |
| Project | Project grouping |
| User | User accounts |
| OrgMember | Org-level roles |
| ProjectMember | Project-level roles |
| ScmConnection | GitHub/GitLab/etc connections |
| Repository | Git repositories |
| ScanConfig | Scanner configuration |
| Scan | Security scans |
| Finding | Security findings |
| FindingBaseline | Finding suppressions |
| WebhookEvent | Webhook events |
| NotificationConfig | Notification settings |
| ApiKey | API keys |
| AuditLog | Audit trail |
| AlertRule | Alert rules |
| AlertHistory | Alert history |
| PipelineGate | CI/CD gates |
| Environment | Deployment environments |
| Deployment | Deployments |
| ThreatModel | Threat models |
| ThreatModelComponent | Components |
| ThreatModelDataFlow | Data flows |
| Threat | Threats |
| ThreatMitigation | Mitigations |
| Sbom | Software BOMs |
| SbomComponent | BOM components |
| SbomVulnerability | Component vulns |
| ContainerRegistry | Container registries |
| ContainerImage | Container images |
| ContainerScan | Container scans |
| ContainerFinding | Container findings |
| CloudAccount | Cloud accounts (CSPM) |
| CspmFinding | Cloud findings |
| Cve | CVE database |
| Cwe | CWE database |
| OwaspTop10 | OWASP Top 10 |
| AttackTactic | MITRE tactics |
| AttackTechnique | MITRE techniques |
| AttackGroup | Threat groups |
| ComplianceFramework | Framework configs |
| ComplianceControl | Control status |
| ProjectComplianceConfig | Project compliance |
| ProjectComplianceControl | Project controls |
| ... (and more) |

---

## 4. Sidebar Menu Structure

### Menu Configuration (Dynamic based on project)

```
═══ WORKSPACE ═══
- Dashboard
- Projects

═══ PROJECT: [Name] ═══  (only when project selected)
- Repositories
- Scans
- Findings
- Baselines

═══ SECURITY ANALYSIS ═══
- Threat Models
- Compliance
- SBOM
- Containers

═══ DEPLOYMENTS ═══
- Environments
- Pipeline

═══ INTELLIGENCE ═══
- Vulnerabilities
- ATT&CK Matrix
- Analytics
- SLA Tracker

═══ SETTINGS ═══
- Project Settings (when project selected)
- Organization
```

### Key Features:
- Uses `useProject()` hook from project-context
- `hasProject` boolean controls conditional sections
- Accordion-style collapsible sections
- Auto-expands section containing active route
- Project name shown in section header (truncated to 15 chars)

---

## 5. Service ProjectId Filtering

### Threat-Modeling Service
**File:** `apps/api/src/threat-modeling/threat-modeling.service.ts`

```typescript
async listThreatModels(tenantId: string, options?: {
  projectId?: string;  // ✅ HAS projectId filtering
  status?: string;
  repositoryId?: string;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = { tenantId };

  if (options?.projectId) where.projectId = options.projectId;  // ✅ FILTERS
  // ...
}
```

**Status:** ✅ PROPERLY FILTERS BY projectId

---

### Environments Service
**File:** `apps/api/src/environments/environments.service.ts`

```typescript
async listEnvironments(tenantId: string, projectId?: string) {
  const where: Prisma.EnvironmentWhereInput = { tenantId };
  if (projectId) {
    where.projectId = projectId;  // ✅ FILTERS
  }
  // ...
}
```

**Status:** ✅ PROPERLY FILTERS BY projectId

---

## 6. Compliance Frameworks - OWASP Versions

**File:** `apps/api/src/compliance/frameworks.ts`

### OWASP Versions Present:
```typescript
// Line 79: OWASP Top 10 2021 Controls (FREE TIER)
export const OWASP2021_CONTROLS: ComplianceControl[] = [...]

// Line 241: Framework registration
{ id: 'owasp-2021', name: 'OWASP Top 10', version: '2021', tier: 'free', controls: OWASP2021_CONTROLS }
```

**Status:** ✅ ONLY OWASP 2021 EXISTS (no 2012 or 2017 versions)

### All Frameworks Available:
| ID | Name | Version | Tier |
|----|------|---------|------|
| owasp-2021 | OWASP Top 10 | 2021 | free |
| cwe-top-25 | CWE Top 25 | 2023 | free |
| essential-eight | Essential Eight | 2023 | free |
| soc2 | SOC 2 Type II | 2017 | growth |
| pci | PCI DSS | 4.0 | growth |
| iso27001 | ISO 27001 | 2022 | growth |
| hipaa | HIPAA Security Rule | 2013 | scale |
| gdpr | GDPR | 2018 | scale |

---

## 7. Project Context

**File:** `apps/dashboard/src/contexts/project-context.tsx`

**Status:** ✅ EXISTS

The file provides:
- `ProjectProvider` component
- `useProject()` hook
- `currentProject` state
- `setCurrentProject()` method
- `createProject()` method
- localStorage persistence

---

## 8. API Health Check

**Endpoint:** `GET http://localhost:3001/health`

**Response:**
```json
{
  "status": "ok",
  "service": "threatdiviner-api",
  "timestamp": "2026-01-02T11:16:19.057Z",
  "uptime": 4787.96
}
```

**Status:** ✅ API IS RUNNING

---

## 9. Endpoint Tests

All protected endpoints return 401 Unauthorized (expected without auth token):

| Endpoint | Response |
|----------|----------|
| `GET /projects` | 401 - Authentication required |
| `GET /threat-modeling?projectId=test-id` | 401 - Authentication required |
| `GET /environments?projectId=test-id` | 401 - Authentication required |
| `GET /compliance/frameworks` | 401 - Authentication required |

**Status:** ✅ ENDPOINTS EXIST AND REQUIRE AUTHENTICATION (correct behavior)

---

## 10. Summary

| Check | Status | Notes |
|-------|--------|-------|
| Dashboard Pages | ✅ 55 pages | All routes defined |
| API Controllers | ✅ 36 controllers | Full coverage |
| Prisma Models | ✅ 56 models | Complete schema |
| Sidebar | ✅ Project-aware | Dynamic menu |
| Threat-modeling projectId | ✅ Filters | Line 92 |
| Environments projectId | ✅ Filters | Line 45-46 |
| OWASP Versions | ✅ 2021 only | No old versions |
| project-context.tsx | ✅ Exists | Full implementation |
| API Health | ✅ Running | Uptime: ~80 min |
| Endpoint Auth | ✅ Working | 401 on unauth |

---

---

## 11. DETAILED CODE ANALYSIS

### 11.1 threat-modeling/page.tsx - How projectId flows

**File:** `apps/dashboard/src/app/dashboard/threat-modeling/page.tsx`

#### Q: How does it get projectId?
**A:** From `useProject()` context hook (line 26, 64)

```typescript
import { useProject } from '@/contexts/project-context';
// ...
const { currentProject } = useProject();
```

#### Q: Does it pass projectId to the API fetch call?
**A:** ✅ YES (lines 87-91)

```typescript
const fetchModels = async () => {
  if (!currentProject) return;  // Guard: don't fetch without project
  // ...
  const params = new URLSearchParams();
  params.set('projectId', currentProject.id);  // ✅ ADDS projectId
  // ...
  const res = await fetch(`${API_URL}/threat-modeling?${params}`, {...});
```

**API URL called:** `http://localhost:3001/threat-modeling?projectId=<uuid>`

#### Q: What happens if no project is selected?
**A:** Shows empty state (lines 162-181)

```typescript
if (!currentProject) {
  return (
    <div className="space-y-6">
      <PageHeader title="Threat Modeling" ... />
      <Card variant="bordered">
        <CardContent className="p-12 text-center">
          <h3>No project selected</h3>
          <p>Select a project from the sidebar to view threat models</p>
          <Link href="/dashboard/projects">
            <Button>Go to Projects</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### 11.2 project-context.tsx - How currentProject is managed

**File:** `apps/dashboard/src/contexts/project-context.tsx`

#### Q: How is currentProject set when user creates a new project?
**A:** Via `createProject()` function (lines 93-114)

```typescript
const createProject = useCallback(async (name: string, description?: string): Promise<Project> => {
  // ... POST to /projects ...
  const newProject = await res.json();
  setProjects((prev) => [newProject, ...prev]);  // Add to list
  setCurrentProject(newProject);  // ✅ AUTO-SELECTS new project
  return newProject;
}, [setCurrentProject]);
```

**Result:** New project is AUTOMATICALLY set as currentProject ✅

#### Q: How is it set when user clicks a project from the list?
**A:** Via `setCurrentProject()` function (lines 84-91)

```typescript
const setCurrentProject = useCallback((project: Project | null) => {
  setCurrentProjectState(project);  // Update React state
  if (project) {
    localStorage.setItem(STORAGE_KEY, project.id);  // ✅ Persist to localStorage
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}, []);
```

#### Q: Is it persisted correctly?
**A:** ✅ YES - uses localStorage with key `threatdiviner_current_project`

On page load (lines 58-69):
```typescript
// Restore saved project or select first
const savedProjectId = localStorage.getItem(STORAGE_KEY);
if (savedProjectId) {
  const savedProject = data.find((p: Project) => p.id === savedProjectId);
  if (savedProject) {
    setCurrentProjectState(savedProject);  // ✅ Restores from localStorage
  } else if (data.length > 0) {
    setCurrentProjectState(data[0]);  // Fallback to first project
  }
}
```

---

### 11.3 projects/page.tsx - Click behavior

**File:** `apps/dashboard/src/app/dashboard/projects/page.tsx`

#### Q: When I click a project, does it call setCurrentProject()?
**A:** ✅ YES (lines 48-53, 115)

```typescript
const selectAndNavigate = (project: typeof currentProject) => {
  if (project) {
    setCurrentProject(project);  // ✅ Sets in context
    router.push('/dashboard');   // ✅ Navigates to dashboard
  }
};

// Card onClick handler (line 115):
onClick={() => selectAndNavigate(project)}
```

#### Q: Does it navigate to /dashboard/projects/[id] or stay at /dashboard/projects?
**A:** It navigates to `/dashboard` (the main dashboard), NOT to `/dashboard/projects/[id]`

---

### 11.4 Manual Browser Test Checklist

To verify the flow works:

1. **Create project "TestEmpty":**
   - Go to `/dashboard/projects`
   - Click "New Project"
   - Enter name "TestEmpty", click Create
   - Should auto-navigate to `/dashboard`
   - Check localStorage: `localStorage.getItem('threatdiviner_current_project')` should return the new project ID

2. **Click on it (if not auto-selected):**
   - The project card should show "Current" badge
   - Clicking it calls `setCurrentProject()` and navigates to `/dashboard`

3. **Go to /dashboard/threat-modeling:**
   - Open DevTools Network tab
   - Filter by "threat-modeling"

4. **Expected API call:**
   ```
   GET http://localhost:3001/threat-modeling?projectId=<new-project-uuid>
   ```

   **If projectId is missing:** The bug is in how `currentProject` is being read - likely a race condition or context not propagating.

5. **Check Console:**
   - Look for `currentProject` value
   - Add `console.log('currentProject:', currentProject)` in threat-modeling/page.tsx if needed

---

## 12. Potential Issues to Investigate

### Issue 1: Race Condition on First Load
When navigating from project creation to threat-modeling:
- `createProject()` sets `currentProject`
- Then navigates to `/dashboard`
- User clicks "Threat Models" in sidebar
- BUT: Does the context have time to propagate?

**Test:** After creating project, wait 1 second, then go to threat-modeling. Does projectId appear?

### Issue 2: Context Not Wrapping Correctly
Check `apps/dashboard/src/components/layout/dashboard-layout.tsx`:
- Is `<ProjectProvider>` wrapping the children?
- Is it rendered at the right level?

### Issue 3: localStorage Token Missing
The `fetchProjects()` function checks for `localStorage.getItem('token')`:
```typescript
const token = localStorage.getItem('token');
if (!token) {
  setLoading(false);
  return;  // ← Returns early, projects never loaded!
}
```

If token is missing, projects won't load and currentProject stays null.

---

## Conclusion

All diagnostic checks pass. The system is properly configured with:
- Project-scoped data filtering in services
- Only OWASP 2021 in compliance frameworks
- Project context provider implemented
- API running and responding
- All endpoints protected by authentication

**Code analysis shows:**
- threat-modeling/page.tsx ✅ correctly passes `projectId` from context
- project-context.tsx ✅ correctly persists to localStorage
- projects/page.tsx ✅ correctly calls `setCurrentProject()` on click
- Flow: Create/Select → Sets context → Persists to localStorage → Pages read from context → Pass to API

---

## 13. BUGS FOUND AND FIXED (BATCH-21 Continuation)

### Critical Bug: API Endpoints Missing projectId Validation

The CHANGELOG claimed endpoints return 400 when projectId is missing, but several controllers were NOT enforcing this:

| Controller | Endpoint | Before | After |
|------------|----------|--------|-------|
| environments | `GET /environments` | ❌ No projectId param | ✅ Required + 400 |
| environments | `POST /environments` | ❌ projectId optional | ✅ Required + 400 |
| scm | `GET /scm/repositories` | ❌ projectId optional | ✅ Required + 400 |
| scm | `GET /scm/scans` | ❌ projectId optional | ✅ Required + 400 |
| scm | `GET /scm/findings` | ❌ projectId optional | ✅ Required + 400 |

### Files Fixed

1. **apps/api/src/environments/environments.controller.ts**
   - Added `BadRequestException` import
   - `listEnvironments()`: Added `@Query('projectId') projectId: string` + validation
   - `createEnvironment()`: Added `projectId` to body type + validation

2. **apps/api/src/scm/scm.controller.ts**
   - Added `BadRequestException` import
   - `listRepositories()`: Changed `projectId?` to `projectId` + validation
   - `listScans()`: Changed `projectId?` to `projectId` + validation
   - `listFindings()`: Changed `projectId?` to `projectId` + validation

### Impact

**Before fix:**
- API returned ALL tenant data when projectId was missing
- New project showed data from other projects (cross-project data leak)

**After fix:**
- API returns 400 Bad Request: "projectId query parameter is required"
- No data returned without explicit project scope

### Controllers Now Properly Enforcing projectId

| Controller | Status |
|------------|--------|
| threat-modeling | ✅ Throws 400 |
| sbom | ✅ Throws 400 |
| baseline | ✅ Throws 400 |
| environments | ✅ **FIXED** - Now throws 400 |
| scm (repositories) | ✅ **FIXED** - Now throws 400 |
| scm (scans) | ✅ **FIXED** - Now throws 400 |
| scm (findings) | ✅ **FIXED** - Now throws 400 |
| compliance | ✅ Filters by projectId (optional for tenant-wide view) |
