# ThreatDiviner Architecture

## Overview

ThreatDiviner is a multi-tenant security scanning platform that aggregates findings from multiple sources, provides AI-powered triage, and integrates with CI/CD pipelines.

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Dashboard (Next.js)                        │
├─────────────────────────────────────────────────────────────────────┤
│                              API (NestJS)                            │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│   Auth      │    SCM      │  Scanners   │     AI      │  Reports    │
├─────────────┴─────────────┴─────────────┴─────────────┴─────────────┤
│                        Queue (BullMQ + Redis)                        │
├─────────────────────────────────────────────────────────────────────┤
│                        Database (PostgreSQL)                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Components

### Dashboard (`apps/dashboard`)

Next.js 14 application providing the user interface.

**Key Features:**
- Server-side rendering for initial load
- Real-time updates via polling
- Responsive design with Tailwind CSS
- Chart visualizations with Recharts

**Pages:**
- `/` - Dashboard overview
- `/repositories` - Repository management
- `/scans` - Scan history
- `/findings` - Finding browser
- `/compliance` - Compliance dashboards
- `/settings` - User and tenant settings

### API (`apps/api`)

NestJS application providing the REST API and background job processing.

**Module Structure:**

```
apps/api/src/
├── ai/                 # AI-powered features (Claude integration)
├── analytics/          # Analytics and metrics
├── api-keys/           # API key management
├── audit/              # Audit logging
├── auth/               # Authentication (JWT, OAuth)
├── baseline/           # Finding baselines
├── cache/              # Redis/in-memory caching
├── cli/                # CLI integration endpoints
├── common/             # Shared utilities
│   └── security/       # Security middleware, sanitization
├── compliance/         # Compliance frameworks and scoring
├── cspm/               # Cloud Security Posture Management
├── dashboard/          # Dashboard-specific endpoints
├── export/             # Export (CSV, JSON, SARIF, SBOM)
├── fix/                # Auto-fix and triage
├── jira/               # Jira integration
├── notifications/      # Notification providers
│   ├── slack/
│   ├── teams/
│   ├── discord/
│   ├── pagerduty/
│   └── opsgenie/
├── pipeline/           # Pipeline gates
├── platform/           # Platform management
├── prisma/             # Database client
├── queue/              # Job queue and processors
├── reporting/          # Report generation
├── retention/          # Data retention policies
├── scanners/           # Scanner integrations
│   └── services/
│       └── diff-filter.service.ts
├── scheduler/          # Scheduled tasks
├── scm/                # Source control management
│   └── providers/
│       ├── github.provider.ts
│       ├── gitlab.provider.ts
│       ├── bitbucket.provider.ts
│       └── azure-devops.provider.ts
├── siem/               # SIEM integrations
└── team/               # Team management
```

### CLI (`packages/cli`)

Command-line tool for CI/CD integration.

**Commands:**
- `upload` - Upload SARIF results
- `baseline` - Manage baselines
- `scan` - Trigger scans
- `status` - Check status

---

## Data Flow

### Scan Flow

```
1. Webhook received (PR opened/updated)
       │
       ▼
2. Job queued (BullMQ)
       │
       ▼
3. Scan processor executes
   ├── Clone/fetch repository
   ├── Run scanners (Semgrep, etc.)
   ├── Parse SARIF results
   ├── Apply diff filter (PR only)
   ├── Apply baseline filter
   └── Store findings
       │
       ▼
4. Post-scan actions
   ├── Post PR comments
   ├── Upload to SCM (Code Scanning)
   ├── Send notifications
   └── Update compliance scores
```

### Finding Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│   open   │────▶│ triaged  │────▶│  fixed   │
└──────────┘     └──────────┘     └──────────┘
     │                │
     │                ▼
     │          ┌──────────┐
     └─────────▶│dismissed │
                └──────────┘
```

---

## Database Schema

### Core Tables

```
Tenant
├── id
├── name
├── settings (JSON)
└── createdAt

User
├── id
├── email
├── tenantId → Tenant
├── role
└── oauthConnections[]

Repository
├── id
├── tenantId → Tenant
├── connectionId → SCMConnection
├── name
├── fullName
├── provider
├── defaultBranch
└── isActive

Scan
├── id
├── repositoryId → Repository
├── branch
├── commitSha
├── pullRequestId
├── status (queued|running|completed|failed)
├── startedAt
├── completedAt
└── findings[]

Finding
├── id
├── scanId → Scan
├── ruleId
├── title
├── description
├── severity (critical|high|medium|low)
├── filePath
├── startLine
├── endLine
├── snippet
├── cweId
├── status (open|dismissed|fixed)
├── autoFix
├── aiAnalysis
├── aiConfidence
└── aiFalsePositive
```

### Supporting Tables

```
SCMConnection
├── id
├── tenantId → Tenant
├── provider
├── accessToken (encrypted)
└── refreshToken (encrypted)

ApiKey
├── id
├── tenantId → Tenant
├── keyHash
├── name
├── scopes[]
└── expiresAt

AuditLog
├── id
├── tenantId → Tenant
├── userId
├── action
├── resourceType
├── resourceId
├── metadata (JSON)
└── createdAt

Baseline
├── id
├── repositoryId → Repository
├── branch
├── findingHashes[]
└── createdAt
```

---

## Caching Strategy

### Cache Layers

1. **In-Memory Cache** (fallback)
   - Map-based cache
   - Per-instance (not shared)
   - Used when Redis unavailable

2. **Redis Cache** (primary)
   - Shared across instances
   - TTL-based expiration
   - Pattern-based invalidation

### Cache Keys

```
tenant:{tenantId}:*          # Tenant-level caches
repo:{repositoryId}:*        # Repository caches
scan:{scanId}:*              # Scan caches
compliance:{tenantId}:{fw}   # Compliance scores
```

### Invalidation

- On finding create/update → invalidate scan, repo, tenant caches
- On scan complete → invalidate repo stats
- On baseline update → invalidate repo caches

---

## Security Model

### Authentication

- **JWT Tokens**: For dashboard users
- **API Keys**: For CLI and integrations
- **OAuth**: GitHub, GitLab, Bitbucket, Azure DevOps

### Authorization

- Role-based access control (RBAC)
- Tenant isolation at database level
- Resource-level permissions

### Input Validation

- Request sanitization middleware
- XSS prevention
- SQL injection pattern detection
- Path traversal prevention
- SSRF URL validation

---

## Queue Architecture

### BullMQ Jobs

```
scan-queue
├── scan:process    # Run scanner
├── scan:upload     # Upload results to SCM
└── scan:notify     # Send notifications

triage-queue
├── triage:single   # Triage one finding
└── triage:batch    # Triage multiple findings

fix-queue
├── fix:generate    # Generate auto-fix
└── fix:apply       # Apply fix and create PR
```

### Job Options

- **Retry**: 3 attempts with exponential backoff
- **Timeout**: 10 minutes for scans
- **Concurrency**: Configurable per queue

---

## Notification Flow

```
Event (scan complete, finding created)
       │
       ▼
NotificationService
       │
       ├──▶ SlackService (Webhook)
       ├──▶ TeamsService (MessageCard)
       ├──▶ DiscordService (Embeds)
       ├──▶ PagerDutyService (Events API v2)
       └──▶ OpsGenieService (Alerts API)
```

### Notification Types

- Scan completed
- Critical finding detected
- Pipeline gate failed
- Compliance score changed

---

## Compliance Engine

### Framework Support

| Framework | Controls | CWE Mappings |
|-----------|----------|--------------|
| SOC 2     | 20       | Yes          |
| PCI DSS   | 12       | Yes          |
| HIPAA     | 7        | Yes          |
| GDPR      | 6        | Yes          |
| ISO 27001 | 10       | Yes          |

### Score Calculation

```
For each control:
  1. Get mapped CWEs
  2. Find open findings with matching CWEs
  3. Weight by severity:
     - Critical: 1.0
     - High: 0.7
     - Medium: 0.3
     - Low: 0.1
  4. Control fails if weighted score > threshold

Overall Score = (Passed Controls / Total Controls) × 100
```

---

## AI Integration

### Claude Integration

Used for:
- Finding triage (true/false positive analysis)
- Auto-fix generation
- Remediation suggestions

### API Usage

```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 2048,
  messages: [{ role: 'user', content: prompt }]
});
```

---

## Scalability

### Horizontal Scaling

- API servers are stateless
- Queue workers scale independently
- Redis for shared state

### Performance Optimizations

- Database connection pooling
- Query optimization with proper indexes
- Caching of expensive operations
- Diff-only scanning for PRs

### Recommended Limits

| Resource | Soft Limit | Hard Limit |
|----------|------------|------------|
| Repositories per tenant | 100 | 500 |
| Scans per day | 1000 | 5000 |
| Findings per scan | 10000 | 50000 |
| Concurrent scans | 10 | 50 |
