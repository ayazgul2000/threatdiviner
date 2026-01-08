# ThreatDiviner - Complete Technical Handover

**Version:** 0.3.2
**Last Updated:** January 7, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Database Schema](#database-schema)
6. [API Modules](#api-modules)
7. [Dashboard Pages](#dashboard-pages)
8. [Scanners](#scanners)
9. [Authentication & Security](#authentication--security)
10. [Error Handling](#error-handling)
11. [WebSocket Events](#websocket-events)
12. [API Endpoints](#api-endpoints)
13. [Environment Variables](#environment-variables)
14. [Development Commands](#development-commands)
15. [Deployment](#deployment)
16. [Testing Strategy](#testing-strategy)
17. [Recent Changes](#recent-changes)
18. [Known Issues & TODOs](#known-issues--todos)

---

## Overview

ThreatDiviner is an enterprise application security platform that provides:

- **Code Security Scanning** (SAST, SCA, Secrets, IaC)
- **Runtime Security Scanning** (DAST, Penetration Testing)
- **Vulnerability Management** (CVE/CWE enrichment, EPSS scores, KEV tracking)
- **Compliance Management** (OWASP, NIST, CIS benchmarks)
- **Threat Modeling** (STRIDE methodology)
- **SBOM Management** (SPDX, CycloneDX)
- **Cloud Security Posture Management** (CSPM)
- **Container Security**
- **AI-Powered Triage** (Claude integration)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 14)                        │
│                         http://localhost:3000                        │
├─────────────────────────────────────────────────────────────────────┤
│                              │ REST API │ WebSocket                  │
├─────────────────────────────────────────────────────────────────────┤
│                         BACKEND (NestJS)                             │
│                         http://localhost:3001                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │   Auth   │ │   SCM    │ │ Scanners │ │  Queue   │ │ WebSocket│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────┐                       │
│  │   PostgreSQL     │    │      Redis       │                       │
│  │   (Prisma ORM)   │    │   (Bull Queue)   │                       │
│  └──────────────────┘    └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Repository Scans**: User connects GitHub/GitLab → Add repository → Trigger scan → Queue processes → Scanners run → Findings stored → WebSocket updates UI
2. **Target Scans**: User creates target → Configure auth → Start scan → Queue processes → DAST scanners run → Findings stored → Real-time updates

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | NestJS, TypeScript, Prisma ORM |
| Database | PostgreSQL |
| Queue | Bull (Redis-backed) |
| Real-time | Socket.IO |
| Auth | JWT (HTTP-only cookies) |
| Process Manager | PM2 |
| Scanners | Semgrep, Trivy, Gitleaks, Nuclei, ZAP, Nikto, SQLMap, SSLyze |

---

## Project Structure

```
threatdiviner/
├── apps/
│   ├── api/                          # NestJS Backend
│   │   ├── prisma/
│   │   │   └── schema.prisma         # Database schema (1400+ lines)
│   │   ├── src/
│   │   │   ├── ai/                   # AI triage (Claude integration)
│   │   │   ├── alerts/               # Alert rules and history
│   │   │   ├── analytics/            # Security analytics
│   │   │   ├── apikeys/              # API key management
│   │   │   ├── audit/                # Audit logging
│   │   │   ├── auth/                 # JWT authentication
│   │   │   ├── baseline/             # Finding baselines
│   │   │   ├── cache/                # Redis caching
│   │   │   ├── cli/                  # CLI endpoints
│   │   │   ├── common/               # Guards, decorators, middleware
│   │   │   │   ├── decorators/       # @Tenant, @AuditLog
│   │   │   │   ├── guards/           # RBAC, Tenant guards
│   │   │   │   ├── interceptors/     # Timeout, audit
│   │   │   │   ├── middleware/       # Tenant context
│   │   │   │   ├── security/         # Sanitization, XSS prevention
│   │   │   │   └── throttle/         # Rate limiting
│   │   │   ├── compliance/           # Compliance frameworks
│   │   │   ├── containers/           # Container registry scanning
│   │   │   ├── cspm/                 # Cloud security posture
│   │   │   ├── dashboard/            # Dashboard stats
│   │   │   ├── environments/         # K8s/cloud environments
│   │   │   ├── export/               # Export (JSON, CSV, SARIF)
│   │   │   ├── fix/                  # Auto-fix suggestions
│   │   │   ├── health/               # Health checks
│   │   │   ├── integrations/         # Third-party integrations
│   │   │   │   ├── github.service.ts # GitHub API
│   │   │   │   └── jira/             # Jira integration
│   │   │   ├── notifications/        # Slack, email notifications
│   │   │   ├── pentest/              # Penetration testing module
│   │   │   ├── pipeline/             # CI/CD pipeline gates
│   │   │   ├── platform/             # Platform admin
│   │   │   ├── prisma/               # Prisma module
│   │   │   ├── projects/             # Project management
│   │   │   ├── queue/                # Bull queue setup
│   │   │   │   ├── processors/       # Scan, notify processors
│   │   │   │   └── services/         # Queue service
│   │   │   ├── rag/                  # RAG for remediation
│   │   │   ├── reporting/            # PDF reports
│   │   │   ├── retention/            # Data retention
│   │   │   ├── sbom/                 # SBOM management
│   │   │   ├── scanners/             # Scanner implementations
│   │   │   │   ├── dast/
│   │   │   │   │   ├── nuclei/nuclei.scanner.ts
│   │   │   │   │   └── zap/zap.scanner.ts
│   │   │   │   ├── execution/
│   │   │   │   │   └── local-executor.service.ts
│   │   │   │   ├── iac/
│   │   │   │   │   └── checkov/checkov.scanner.ts
│   │   │   │   ├── parsers/sarif.parser.ts
│   │   │   │   ├── pentest/
│   │   │   │   │   ├── nikto/nikto.scanner.ts
│   │   │   │   │   ├── nuclei/nuclei.scanner.ts
│   │   │   │   │   ├── sqlmap/sqlmap.scanner.ts
│   │   │   │   │   └── sslyze/sslyze.scanner.ts
│   │   │   │   ├── sast/
│   │   │   │   │   ├── bandit/bandit.scanner.ts
│   │   │   │   │   ├── gosec/gosec.scanner.ts
│   │   │   │   │   └── semgrep/semgrep.scanner.ts
│   │   │   │   ├── sca/
│   │   │   │   │   └── trivy/trivy.scanner.ts
│   │   │   │   ├── secrets/
│   │   │   │   │   ├── gitleaks/gitleaks.scanner.ts
│   │   │   │   │   └── trufflehog/trufflehog.scanner.ts
│   │   │   │   ├── services/         # Finding processor, diff filter
│   │   │   │   └── utils/git.service.ts
│   │   │   ├── scans/                # Scan gateway (WebSocket)
│   │   │   ├── scheduler/            # Scheduled scans
│   │   │   ├── scm/                  # SCM (GitHub, GitLab, Bitbucket)
│   │   │   ├── settings/             # Tenant settings
│   │   │   ├── siem/                 # SIEM integration
│   │   │   ├── targets/              # DAST targets
│   │   │   ├── team/                 # Team management
│   │   │   ├── threat-intel/         # Threat intelligence
│   │   │   ├── threat-modeling/      # STRIDE threat modeling
│   │   │   ├── vulndb/               # Vulnerability database
│   │   │   ├── webhooks/             # GitHub/GitLab webhooks
│   │   │   ├── app.module.ts         # Root module
│   │   │   └── main.ts               # Entry point
│   │   └── test/                     # E2E tests
│   │
│   ├── dashboard/                    # Next.js Frontend
│   │   ├── src/
│   │   │   ├── app/                  # App Router pages
│   │   │   │   ├── dashboard/        # Dashboard pages
│   │   │   │   │   ├── analytics/
│   │   │   │   │   ├── attack/       # ATT&CK mapping
│   │   │   │   │   ├── baselines/
│   │   │   │   │   ├── cloud/
│   │   │   │   │   ├── cloud-accounts/
│   │   │   │   │   ├── compliance/
│   │   │   │   │   ├── connections/
│   │   │   │   │   ├── containers/
│   │   │   │   │   ├── cspm/
│   │   │   │   │   ├── environments/
│   │   │   │   │   ├── findings/
│   │   │   │   │   ├── monitoring/
│   │   │   │   │   ├── pen-testing/
│   │   │   │   │   ├── pipeline/
│   │   │   │   │   ├── projects/
│   │   │   │   │   ├── reports/
│   │   │   │   │   ├── repositories/
│   │   │   │   │   │   ├── [id]/
│   │   │   │   │   │   │   ├── scans/[scanId]/
│   │   │   │   │   │   │   └── settings/
│   │   │   │   │   ├── sbom/
│   │   │   │   │   ├── scans/
│   │   │   │   │   ├── settings/
│   │   │   │   │   │   ├── alerts/
│   │   │   │   │   │   ├── api-keys/
│   │   │   │   │   │   ├── integrations/
│   │   │   │   │   │   ├── notifications/
│   │   │   │   │   │   ├── org/              # DUPLICATE - consolidate
│   │   │   │   │   │   ├── organization/     # DUPLICATE - consolidate
│   │   │   │   │   │   ├── profile/
│   │   │   │   │   │   ├── project/
│   │   │   │   │   │   └── team/
│   │   │   │   │   ├── siem/
│   │   │   │   │   ├── sla/
│   │   │   │   │   ├── targets/
│   │   │   │   │   │   ├── [id]/
│   │   │   │   │   │   │   ├── scans/[scanId]/
│   │   │   │   │   │   │   └── settings/
│   │   │   │   │   ├── threat-intel/
│   │   │   │   │   ├── threat-modeling/
│   │   │   │   │   └── vulndb/
│   │   │   │   ├── login/
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── components/
│   │   │   │   ├── layout/           # Dashboard layout, sidebar
│   │   │   │   ├── providers.tsx     # React Query, Auth providers
│   │   │   │   └── ui/               # Reusable UI components
│   │   │   │       ├── badge.tsx
│   │   │   │       ├── button.tsx
│   │   │   │       ├── card.tsx
│   │   │   │       ├── form.tsx
│   │   │   │       ├── modal.tsx
│   │   │   │       ├── pagination.tsx
│   │   │   │       ├── scan-progress.tsx
│   │   │   │       ├── skeleton.tsx
│   │   │   │       ├── skeletons/    # Loading skeletons
│   │   │   │       ├── table.tsx
│   │   │   │       ├── tabs.tsx
│   │   │   │       └── toast.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── use-api-query.ts  # React Query wrapper
│   │   │   │   ├── use-fetch.ts      # Basic fetch hook
│   │   │   │   ├── use-safe-fetch.ts # Error-handled fetch
│   │   │   │   └── use-scan-stream.ts # WebSocket hook
│   │   │   └── lib/
│   │   │       ├── api.ts            # API client (900+ lines)
│   │   │       ├── auth-context.tsx  # Auth provider
│   │   │       ├── utils.ts          # Utilities
│   │   │       └── validation.ts     # Form validation
│   │   └── public/
│   │
│   └── admin/                        # Admin dashboard (minimal)
│
├── packages/
│   └── cli/                          # CLI tool
│
├── deploy/                           # Deployment configs
├── docs/                             # Documentation
├── scripts/                          # Utility scripts
├── ecosystem.config.js               # PM2 configuration
├── docker-compose.yml                # Docker setup
└── HANDOVER.md                       # This file
```

---

## Database Schema

### Core Models (48 tables)

#### Multi-Tenancy
| Model | Description |
|-------|-------------|
| `Tenant` | Organization/company |
| `User` | User account (belongs to tenant) |
| `OrgMember` | Organization membership |
| `ProjectMember` | Project membership |
| `Project` | Logical grouping of repositories |

#### SCM & Repositories
| Model | Description |
|-------|-------------|
| `ScmConnection` | GitHub/GitLab/Bitbucket connection |
| `Repository` | Git repository |
| `ScanConfig` | Repository scan configuration |
| `ProjectScmAccess` | Project-level SCM access |
| `ProjectRepoAccess` | Project-level repo access |

#### Scanning
| Model | Description |
|-------|-------------|
| `Scan` | Code security scan |
| `ScannerResult` | Per-scanner results |
| `Finding` | Security finding |
| `FindingBaseline` | Baselined findings |
| `DiffCache` | PR diff caching |

#### DAST/Penetration Testing
| Model | Description |
|-------|-------------|
| `PenTestTarget` | DAST target (URL) |
| `PenTestScan` | DAST scan |
| `PenTestFinding` | DAST finding |

#### Vulnerability Database
| Model | Description |
|-------|-------------|
| `Cve` | CVE entries |
| `Cwe` | CWE entries |
| `OwaspTop10` | OWASP Top 10 |
| `CweComplianceMapping` | CWE to compliance mapping |
| `ComplianceFramework` | Compliance frameworks |
| `ComplianceControl` | Compliance controls |
| `NistControl` | NIST controls |
| `CisBenchmark` | CIS benchmarks |

#### ATT&CK Framework
| Model | Description |
|-------|-------------|
| `AttackTactic` | MITRE ATT&CK tactics |
| `AttackTechnique` | ATT&CK techniques |
| `AttackGroup` | Threat actor groups |
| `CapecPattern` | CAPEC attack patterns |

#### Threat Modeling
| Model | Description |
|-------|-------------|
| `ThreatModel` | Threat model |
| `ThreatModelComponent` | System components |
| `ThreatModelDataFlow` | Data flows |
| `Threat` | Identified threats |
| `ThreatMitigation` | Mitigations |
| `ThreatComponentMapping` | Threat-component links |
| `ThreatDataFlowMapping` | Threat-dataflow links |
| `ThreatMitigationMapping` | Threat-mitigation links |

#### SBOM
| Model | Description |
|-------|-------------|
| `Sbom` | Software Bill of Materials |
| `SbomComponent` | SBOM components |
| `SbomVulnerability` | SBOM vulnerabilities |
| `SbomComponentVuln` | Component-vulnerability links |

#### Containers
| Model | Description |
|-------|-------------|
| `ContainerRegistry` | Container registries |
| `ContainerImage` | Container images |
| `ContainerScan` | Container scans |
| `ContainerFinding` | Container findings |

#### Cloud (CSPM)
| Model | Description |
|-------|-------------|
| `CloudAccount` | AWS/Azure/GCP accounts |
| `CspmFinding` | Cloud security findings |
| `Environment` | Deployment environments |
| `Deployment` | Application deployments |

#### Compliance
| Model | Description |
|-------|-------------|
| `ProjectComplianceConfig` | Project compliance config |
| `ProjectComplianceControl` | Control assessments |

#### Other
| Model | Description |
|-------|-------------|
| `WebhookEvent` | Webhook event log |
| `NotificationConfig` | Notification settings |
| `JiraConfig` | Jira integration config |
| `AlertRule` | Alert rules |
| `AlertHistory` | Alert history |
| `PipelineGate` | CI/CD gates |
| `ApiKey` | API keys |
| `AuditLog` | Audit log |
| `PlatformConfig` | Platform settings |
| `PlatformAdmin` | Platform admins |
| `DataSyncStatus` | Sync status |

### Key Database Indexes

Performance-critical indexes defined in `schema.prisma`:

| Table | Indexed Columns | Purpose |
|-------|-----------------|---------|
| `findings` | `tenantId`, `scanId`, `repositoryId`, `projectId`, `severity`, `status`, `fingerprint` | Filter by tenant, scan, severity |
| `scans` | `tenantId`, `repositoryId`, `projectId`, `status` | List scans by status |
| `audit_logs` | `tenantId`, `userId`, `action`, `resource`, `createdAt` | Audit trail queries |
| `cves` | `cvssV3Severity`, `publishedDate`, `isKev`, `epssScore` | VulnDB search |
| `pentest_scans` | `tenantId`, `targetId`, `status`, `parentScanId` | Two-phase scan linking |
| `threats` | `threatModelId`, `category`, `status`, `riskScore` | Threat model queries |

**Multi-tenant isolation**: All tenant-scoped tables have `@@index([tenantId])` for efficient filtering.

### Data Migration Strategy

```bash
# Development - auto-apply migrations
npx prisma migrate dev --name add-feature

# Production - apply pending migrations
npx prisma migrate deploy

# Zero-downtime approach (recommended):
# 1. Deploy new code with backward-compatible schema
# 2. Run migrations during low-traffic window
# 3. Deploy code that uses new schema
```

**Note**: No automatic rollback. Test migrations thoroughly in staging before production.

---

## API Modules

### Module Summary (40+ modules)

| Module | Purpose | Key Endpoints |
|--------|---------|---------------|
| `AuthModule` | JWT authentication | `/auth/login`, `/auth/logout`, `/auth/profile` |
| `ScmModule` | SCM connections & repositories | `/scm/connections`, `/scm/repositories`, `/scm/scans` |
| `ScannersModule` | Scanner implementations | Internal use |
| `QueueModule` | Bull queue processors | Internal use |
| `TargetsModule` | DAST targets | `/targets`, `/targets/:id/scan` |
| `PenTestModule` | Penetration testing | `/pentest/targets`, `/pentest/scans` |
| `AiModule` | AI triage | `/ai/status`, `/ai/triage/:id` |
| `VulnDbModule` | Vulnerability database | `/vulndb/cve`, `/vulndb/cwe`, `/vulndb/attack` |
| `ThreatModelingModule` | Threat modeling | `/threat-modeling` |
| `SbomModule` | SBOM management | `/sbom` |
| `ComplianceModule` | Compliance | `/compliance` |
| `AnalyticsModule` | Analytics | `/analytics` |
| `DashboardModule` | Dashboard stats | `/dashboard/stats` |
| `ReportingModule` | PDF reports | `/reports` |
| `ExportModule` | Data export | `/export` |
| `NotificationsModule` | Notifications | `/notifications` |
| `TeamModule` | Team management | `/team` |
| `ProjectsModule` | Projects | `/projects` |
| `ApiKeysModule` | API keys | `/api-keys` |
| `CspmModule` | Cloud security | `/cspm` |
| `ContainersModule` | Container security | `/containers` |
| `EnvironmentsModule` | Environments | `/environments` |
| `PipelineModule` | CI/CD gates | `/pipeline` |
| `SiemModule` | SIEM | `/siem` |
| `AlertsModule` | Alerts | `/alerts` |
| `SettingsModule` | Settings | `/settings` |
| `SchedulerModule` | Scheduled scans | Internal use |
| `JiraModule` | Jira integration | `/integrations/jira` |
| `BaselineModule` | Baselines | `/baselines` |
| `CliModule` | CLI support | `/cli` |
| `FixModule` | Auto-fix | `/fix` |
| `RagModule` | RAG search | `/rag` |
| `AuditModule` | Audit log | `/audit` |
| `CacheModule` | Caching | Internal use |
| `RetentionModule` | Data retention | Internal use |
| `ThreatIntelModule` | Threat intel | `/threat-intel` |
| `ScansModule` | WebSocket gateway | `/scans` namespace |

---

## Dashboard Pages

### Navigation Structure

```
Security Scanning (collapsible)
├── Repositories         → /dashboard/repositories
├── Targets              → /dashboard/targets
├── Cloud Accounts       → /dashboard/cloud-accounts    [PLACEHOLDER]
└── Monitoring           → /dashboard/monitoring        [PLACEHOLDER]

Insights (collapsible)
├── Dashboard            → /dashboard
├── Compliance           → /dashboard/compliance
├── Reports              → /dashboard/reports
└── Analytics            → /dashboard/analytics

Settings (collapsible)
├── Organization         → /dashboard/settings/organization
├── Team                 → /dashboard/settings/team
├── API Keys             → /dashboard/settings/api-keys
├── Notifications        → /dashboard/settings/notifications
└── Integrations         → /dashboard/settings/integrations [PARTIAL]
```

**Note:** `[PLACEHOLDER]` = UI exists but backend not implemented. `[PARTIAL]` = Some features work (Jira), others pending.

### Key Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/dashboard` | Security overview, recent scans, findings |
| Repositories | `/dashboard/repositories` | List of connected repositories |
| Repository Detail | `/dashboard/repositories/[id]` | Repository scan cockpit |
| Scan Results | `/dashboard/repositories/[id]/scans/[scanId]` | Scan findings |
| Targets | `/dashboard/targets` | DAST targets list |
| Target Detail | `/dashboard/targets/[id]` | Target scan cockpit |
| Target Scan | `/dashboard/targets/[id]/scans/[scanId]` | DAST findings |
| Findings | `/dashboard/findings` | All findings |
| Finding Detail | `/dashboard/findings/[id]` | Finding detail with AI triage |
| Compliance | `/dashboard/compliance` | Compliance dashboard |
| Analytics | `/dashboard/analytics` | Security metrics |
| Threat Modeling | `/dashboard/threat-modeling` | Threat models |
| SBOM | `/dashboard/sbom` | SBOM list |
| VulnDB | `/dashboard/vulndb` | CVE/CWE/OWASP database |
| ATT&CK | `/dashboard/attack` | ATT&CK mapping |

---

## Scanners

### Code Security Scanners

| Scanner | Category | Language | Output |
|---------|----------|----------|--------|
| Semgrep | SAST | Multi-language | SARIF |
| Bandit | SAST | Python | JSON |
| Gosec | SAST | Go | JSON |
| Trivy | SCA | Multi-language | JSON |
| Gitleaks | Secrets | All | JSON |
| Checkov | IaC | Terraform, K8s | JSON |

### DAST Scanners

| Scanner | Category | Purpose | Output |
|---------|----------|---------|--------|
| Nuclei | DAST | Template-based vuln scanning | JSON |
| ZAP | DAST | Web app scanning | JSON |
| Nikto | DAST | Web server scanning | JSON |
| SQLMap | DAST | SQL injection | JSON |
| SSLyze | DAST | SSL/TLS analysis | JSON |

### Scanner Interface

```typescript
interface IScanner {
  name: string;
  version: string;
  supportedLanguages: string[];
  outputFormat: 'json' | 'sarif' | 'text';

  isAvailable(): Promise<boolean>;
  getVersion(): Promise<string>;
  scan(context: ScanContext): Promise<ScanOutput>;
  parseOutput(output: ScanOutput): Promise<NormalizedFinding[]>;
}
```

### Scan Modes

| Mode | Description |
|------|-------------|
| **Optimized** | Two-phase: Discovery (tech detection) → Focused (targeted templates) |
| **Full** | All vulnerability templates in single pass |

### Rate Limit Presets

| Preset | RPS | Use Case |
|--------|-----|----------|
| Low | 50 | Production environments |
| Medium | 150 | Staging/testing (default) |
| High | 300 | Local development |

---

## Authentication & Security

### JWT Token Strategy

ThreatDiviner uses HTTP-only cookies with dual-token authentication:

```typescript
// Configuration (apps/api/src/auth/auth.module.ts)
{
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  accessTokenExpiry: '15m',      // Short-lived access token
  refreshTokenExpiry: '7d',       // Longer refresh token
  multiTenant: true,
}
```

### Token Flow

1. **Login** → Returns access token (15min) + refresh token (7d) as HTTP-only cookies
2. **API Requests** → Access token validated via `JwtAuthGuard`
3. **Token Refresh** → `POST /auth/refresh` exchanges refresh token for new access token
4. **Logout** → Clears both cookies

### Multi-Tenant Isolation

```typescript
// Every request sets tenant context via middleware
await prisma.setTenantContext(tenantId);

// All queries automatically filtered by tenant
// Users can only see their tenant's data
```

### Security Guards

| Guard | Purpose |
|-------|---------|
| `JwtAuthGuard` | Validates JWT token |
| `TenantGuard` | Ensures tenant context |
| `RbacGuard` | Role-based access control |
| `CustomThrottlerGuard` | Rate limiting |

### Rate Limiting

```typescript
// Three tiers (apps/api/src/app.module.ts)
throttlers: [
  { name: 'short', ttl: 1000, limit: 10 },    // 10 req/sec
  { name: 'medium', ttl: 60000, limit: 100 }, // 100 req/min
  { name: 'long', ttl: 3600000, limit: 1000 } // 1000 req/hr
]
```

---

## Error Handling

### Global Exception Filter

All errors pass through `AllExceptionsFilter` (`apps/api/src/common/filters/all-exceptions.filter.ts`):

```typescript
// Standard error response format
{
  statusCode: 404,
  timestamp: "2026-01-07T12:00:00.000Z",
  path: "/api/scans/invalid-id",
  method: "GET",
  message: "Record not found",
  error: "NotFoundError"
}
```

### Error Types Handled

| Error Type | Status | Example |
|------------|--------|---------|
| `HttpException` | Various | Validation errors, auth failures |
| Prisma `P2002` | 409 Conflict | Duplicate unique constraint |
| Prisma `P2025` | 404 Not Found | Record not found |
| Prisma `P2003` | 400 Bad Request | Foreign key constraint |
| Unknown errors | 500 | Internal server error |

### Logging Strategy

- **5xx errors** → `Logger.error()` with full stack trace
- **4xx errors** → `Logger.warn()` with request context
- All errors include: timestamp, method, URL, status, user-agent, IP

### Frontend Error Handling

```typescript
// API client (apps/dashboard/src/lib/api.ts)
class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

// Usage in components
try {
  await scansApi.trigger(repoId);
} catch (error) {
  if (error instanceof ApiError && error.status === 404) {
    // Handle not found
  }
}
```

### Retry Logic

Currently **not implemented** for:
- Webhook deliveries (TODO: exponential backoff)
- Failed scans (manual retry via UI)
- External API calls (GitHub, Jira)

---

## WebSocket Events

### Namespace: `/scans`

```typescript
// Client subscribes
socket.emit('subscribe', { scanId: 'uuid' });

// Server events
{
  type: 'scanner:start',
  scanner: 'nuclei',
  phase: 'discovery' | 'focused' | 'single'
}

{
  type: 'scanner:progress',
  scanner: 'nuclei',
  progress: 45,
  templatesCompleted: 500,
  templatesTotal: 2894
}

{
  type: 'scanner:log',
  scanner: 'nuclei',
  line: '[INF] Found XSS vulnerability',
  stream: 'stdout' | 'stderr',
  timestamp: '2026-01-07T12:00:00Z'
}

{
  type: 'scanner:finding',
  scanner: 'nuclei',
  finding: { ... }
}

{
  type: 'scanner:complete',
  scanner: 'nuclei',
  findingsCount: 15,
  duration: 45000
}

{
  type: 'scan:complete',
  totalFindings: 42,
  severityBreakdown: { critical: 2, high: 10, ... },
  duration: 180000
}
```

### Frontend Hook: `useScanStream`

```typescript
const { status, progress, logs, findings, scanners } = useScanStream(scanId);
```

### WebSocket Reconnection Workaround

The WebSocket client doesn't auto-resubscribe after disconnect. Workaround:

```typescript
// In your component using useScanStream
useEffect(() => {
  const socket = io(`${API_URL}/scans`);

  socket.on('connect', () => {
    // Re-subscribe on reconnect
    socket.emit('subscribe', { scanId });
  });

  socket.on('disconnect', () => {
    // Optional: Show reconnecting UI
  });

  return () => socket.disconnect();
}, [scanId]);
```

---

## API Endpoints

### API Versioning

**Current Status**: Unversioned endpoints (`/auth/login`, not `/v1/auth/login`)

**Rationale**: Single-tenant SaaS with controlled rollouts. Breaking changes are coordinated with frontend deployments.

**Future**: Version via header (`Accept: application/vnd.threatdiviner.v1+json`) when public API is released.

### Authentication
```
POST   /auth/login              Login with tenant/email/password
POST   /auth/logout             Logout
GET    /auth/profile            Get current user
POST   /auth/refresh            Refresh token
```

### SCM & Repositories
```
GET    /scm/connections                    List connections
POST   /scm/oauth/initiate                 Start OAuth flow
POST   /scm/connect/pat                    Connect with PAT
GET    /scm/repositories                   List repositories
POST   /scm/repositories                   Add repository
GET    /scm/repositories/:id               Get repository
DELETE /scm/repositories/:id               Delete repository
PUT    /scm/repositories/:id/config        Update config
GET    /scm/repositories/:id/branches      List branches
GET    /scm/repositories/:id/languages     Get languages
```

### Scans
```
GET    /scm/scans                List scans
POST   /scm/scans                Trigger scan
GET    /scm/scans/:id            Get scan
POST   /scm/scans/:id/cancel     Cancel scan
```

### Findings
```
GET    /scm/findings             List findings
GET    /scm/findings/:id         Get finding
PUT    /scm/findings/:id/status  Update status
```

### DAST Targets
```
GET    /targets                  List targets
POST   /targets                  Create target
GET    /targets/:id              Get target
PATCH  /targets/:id              Update target
DELETE /targets/:id              Delete target
POST   /targets/:id/scan         Start scan
GET    /targets/:id/scans        List target scans
GET    /targets/:id/scans/:scanId Get scan details
```

### AI Triage
```
GET    /ai/status                AI availability
POST   /ai/triage/:findingId     Triage finding
POST   /ai/triage/batch          Batch triage
```

### VulnDB
```
GET    /vulndb/stats             Database stats
GET    /vulndb/cve               Search CVEs
GET    /vulndb/cve/:id           Get CVE
GET    /vulndb/cwe               Search CWEs
GET    /vulndb/owasp             OWASP Top 10
GET    /vulndb/attack/tactics    ATT&CK tactics
GET    /vulndb/attack/techniques ATT&CK techniques
POST   /vulndb/sync/:source      Sync data
```

### Threat Modeling
```
GET    /threat-modeling          List models
POST   /threat-modeling          Create model
GET    /threat-modeling/:id      Get model
PUT    /threat-modeling/:id      Update model
DELETE /threat-modeling/:id      Delete model
POST   /threat-modeling/:id/analyze Run STRIDE analysis
```

### SBOM
```
GET    /sbom                     List SBOMs
GET    /sbom/:id                 Get SBOM
POST   /sbom/upload/spdx         Upload SPDX
POST   /sbom/upload/cyclonedx    Upload CycloneDX
POST   /sbom/:id/match-cves      Match vulnerabilities
```

### Other Endpoints
```
GET    /dashboard/stats          Dashboard stats
GET    /analytics                Analytics data
GET    /compliance/frameworks    List frameworks
GET    /compliance/score         Compliance score
GET    /projects                 List projects
POST   /projects                 Create project
GET    /team/members             List team
POST   /team/invite              Invite member
GET    /api-keys                 List API keys
POST   /api-keys                 Create API key
GET    /notifications/config     Get config
PUT    /notifications/config     Update config
GET    /cspm/accounts            List cloud accounts
GET    /containers/registries    List registries
GET    /environments             List environments
GET    /pipeline/gates           List gates
GET    /siem/events              List events
GET    /siem/alerts              List alerts
```

---

## Environment Variables

### Required
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/threatdiviner
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
```

### Optional
```env
# API Server
PORT=3001
NODE_ENV=development

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001

# Scanner Paths (if not in PATH)
SEMGREP_PATH=/usr/local/bin/semgrep
NUCLEI_PATH=/usr/local/bin/nuclei
TRIVY_PATH=/usr/local/bin/trivy
GITLEAKS_PATH=/usr/local/bin/gitleaks

# Docker (for sandboxed scanners)
NIKTO_DOCKER_IMAGE=secfigo/nikto
ZAP_DOCKER_IMAGE=owasp/zap2docker-stable

# GitHub Integration
GITHUB_APP_ID=12345
GITHUB_APP_PRIVATE_KEY=...
GITHUB_WEBHOOK_SECRET=...

# AI (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# Rate Limiting
THROTTLE_SHORT_LIMIT=10
THROTTLE_MEDIUM_LIMIT=100
THROTTLE_LONG_LIMIT=1000
```

---

## Development Commands

### Start Development
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Or manually
cd apps/api && pnpm start:dev
cd apps/dashboard && pnpm dev
```

### Database
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Reset database
npx prisma migrate reset

# Seed database
pnpm db:seed
```

### Testing
```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Test specific scanner
pnpm test -- --grep="NucleiScanner"
```

### PM2 Commands
```bash
pm2 start ecosystem.config.js  # Start apps
pm2 status                      # Check status
pm2 logs                        # View logs
pm2 logs --lines 50            # Recent logs
pm2 restart all                # Restart
pm2 stop all                   # Stop
pm2 delete all                 # Remove
```

### Docker
```bash
# Start services (PostgreSQL, Redis)
docker-compose up -d

# Stop services
docker-compose down
```

---

## Deployment

### Deployment Configurations

```
deploy/
├── docker/
│   ├── docker-compose.dev.yml   # Development with hot reload
│   └── docker-compose.prod.yml  # Production optimized
├── k8s/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── postgres.yaml
│   ├── redis.yaml
│   ├── api-deployment.yaml
│   ├── dashboard-deployment.yaml
│   └── ingress.yaml
└── nginx/
    ├── nginx.conf
    └── conf.d/                   # Site configs
```

### Docker Production

```bash
# Build production images
docker build -t threatdiviner-api:latest -f apps/api/Dockerfile .
docker build -t threatdiviner-dashboard:latest -f apps/dashboard/Dockerfile .

# Run with production compose
docker-compose -f deploy/docker/docker-compose.prod.yml up -d
```

### Kubernetes Deployment

```bash
# Create namespace and secrets
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/secrets.yaml
kubectl apply -f deploy/k8s/configmap.yaml

# Deploy databases
kubectl apply -f deploy/k8s/postgres.yaml
kubectl apply -f deploy/k8s/redis.yaml

# Deploy applications
kubectl apply -f deploy/k8s/api-deployment.yaml
kubectl apply -f deploy/k8s/dashboard-deployment.yaml
kubectl apply -f deploy/k8s/ingress.yaml
```

### Production Checklist

- [ ] Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET` (32+ chars)
- [ ] Configure PostgreSQL with proper credentials
- [ ] Enable SSL/TLS on all endpoints
- [ ] Set `NODE_ENV=production`
- [ ] Configure rate limiting for production load
- [ ] Set up log aggregation (ELK, CloudWatch, etc.)
- [ ] Configure backup for PostgreSQL
- [ ] Set up health check monitoring

---

## Testing Strategy

### Test Structure

```
apps/api/
├── src/
│   └── **/*.spec.ts          # Unit tests (co-located)
└── test/
    └── **/*.e2e-spec.ts      # E2E tests

apps/dashboard/
└── src/
    └── **/*.test.tsx         # Component tests (co-located)
```

### Unit Tests

```bash
# Run all unit tests
cd apps/api && pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:cov
```

### E2E Tests

```bash
# Run E2E (requires running API)
cd apps/api && pnpm test:e2e
```

### Test Coverage (Target)

| Area | Coverage | Notes |
|------|----------|-------|
| Scanners | 80%+ | Critical parsing logic |
| Services | 70%+ | Business logic |
| Controllers | 60%+ | Integration |
| Components | 50%+ | UI interactions |

### Key Test Files

| File | Tests |
|------|-------|
| `scanners/**/*.spec.ts` | Scanner output parsing |
| `queue/processors/*.spec.ts` | Scan job processing |
| `auth/*.spec.ts` | Authentication flows |
| `scm/*.spec.ts` | GitHub/GitLab integration |

### Manual Testing Checklist

1. **Auth Flow**: Login → Refresh → Logout
2. **Repository Scan**: Add repo → Trigger scan → View findings
3. **Target Scan**: Create target → Configure auth → Run DAST
4. **WebSocket**: Monitor real-time progress updates
5. **Export**: Download SARIF, CSV exports

---

## Recent Changes

### v0.3.3 (Current) - Scanner Testing & Katana Discovery

**New Scanner: Katana URL Discovery**
- Added `katana.scanner.ts` in `apps/api/src/scanners/discovery/katana/`
- Crawls target URLs to discover endpoints, parameters, and JS files
- Feeds discovered URLs to downstream scanners (Nuclei, SQLMap, etc.)
- Configurable depth and scan modes (quick/standard/comprehensive)

**Scanner Wrapper Tests (January 7, 2026)**

All scanner wrappers validated against CLI baselines. Goal: ensure wrappers produce same output as direct CLI execution with <10% timing overhead.

| Scanner | CLI Baseline | Wrapper Output | Timing Overhead | Status |
|---------|--------------|----------------|-----------------|--------|
| Katana | 28 URLs, 8 params | 28 URLs, 3 unique params | -0.1% (13.8s) | ✓ PASS |
| Nuclei | 1 info finding | 1 info finding | 0.0% (5min) | ✓ PASS |
| SQLMap | 4 injection types | 4 injection types | 2.0% (29s) | ✓ PASS |
| SSLyze | N/A | HTTP-only test site | - | Skipped |
| ZAP | Docker networking | Works inside container | - | Needs Fix |

**SQLMap Injection Types Found:**
- boolean-based blind
- error-based
- time-based blind
- UNION query

**Test Target:** `http://testphp.vulnweb.com` (Acunetix vulnerable test site)

**Known Issues:**
- ZAP Docker on Windows: API calls get proxied back, works only from inside container
- Pentest API requires JWT auth (test scripts need login flow)
- SSLyze skipped: test target is HTTP-only (no SSL/TLS)

**Test Files Created:**
- `apps/api/test-katana-wrapper.js` - Katana wrapper vs CLI comparison
- `apps/api/test-nuclei-wrapper.js` - Nuclei wrapper vs CLI comparison
- `apps/api/test-sqlmap-wrapper.js` - SQLMap wrapper vs CLI comparison
- `apps/api/test-scan-flow.js` - Full flow test with auth handling
- `apps/api/test-quick-scan.js` - Quick scan API test

---

### v0.3.2
- **Real-Time Verbose Logging**: Live log streaming during scanner execution via WebSocket
- **Process Cancellation Fix**: `LocalExecutorService` tracks processes by scanId
- **Bug Fixes**: Fixed 15% hardcoded progress, removed glowing severity boxes

### v0.3.1
- **Scan Mode Renaming**: `discovery` → `optimized`, `deep` → `full`
- **Rate Limit Presets**: Low/Medium/High dropdown
- **Real-Time Progress**: Nuclei shows actual % from `-stats` output

### v0.3.0
- **Menu Restructure**: Three collapsible sections
- **DAST/Code Security Separation**: Repositories for code, Targets for DAST
- **Targets Module**: Full CRUD for web apps, APIs, network services
- **Performance Fix**: Nuclei scans reduced from 7+ min to ~60 sec

---

## Known Issues & TODOs

### Placeholder Features (UI exists, backend incomplete)

| Feature | Status | Notes |
|---------|--------|-------|
| Cloud Accounts (`/dashboard/cloud-accounts`) | UI only | CSPM backend needs AWS/Azure/GCP SDK integration |
| Monitoring (`/dashboard/monitoring`) | UI only | Alert rules engine not implemented |
| Settings → Integrations | Partial | Jira works, Slack/PagerDuty TODO |
| Settings → org vs organization | Duplicate | Both folders exist, consolidation needed |

### Current Limitations

1. **WebSocket reconnection** - requires manual resubscribe (workaround in docs)
2. **SQLMap/SSLyze two-phase** - not fully implemented (uses level-based approach)
3. **ZAP scanner** - requires Docker Desktop running
4. **Inline PR comments** - only works when scanner provides line numbers
5. **Retry logic** - no automatic retries for webhooks or external API calls

### Technical Debt

- [ ] Consolidate `/settings/org/` and `/settings/organization/` folders
- [ ] Add retry logic for webhook deliveries (exponential backoff)
- [ ] Implement proper WebSocket auto-reconnect with resubscribe

### TODOs

**High Priority:**
- [ ] ZAP two-phase scanning (spider discovery → active scan)
- [ ] Webhook delivery retry with exponential backoff
- [ ] Rate limiting for public webhook endpoints

**Medium Priority:**
- [ ] SARIF export button in dashboard
- [ ] SQLMap endpoint storage for targeted deep scanning
- [ ] Slack/PagerDuty notification integrations

**Low Priority:**
- [ ] CLI binary distribution (homebrew, apt)
- [ ] Cloud Accounts full integration (AWS/Azure/GCP)
- [ ] Monitoring alerts rules engine

---

## Contact & Support

For development questions, refer to:
- `apps/api/src/app.module.ts` - Backend module structure
- `apps/dashboard/src/lib/api.ts` - Frontend API client
- `apps/api/prisma/schema.prisma` - Database schema

---

*Last updated: January 7, 2026*
