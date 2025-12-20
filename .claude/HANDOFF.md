# ThreatDiviner - Handoff

## Current Task
**Feature 4: Dashboard UI**

## Status
🟢 DASHBOARD UI COMPLETE

## Owner
CLI

## Task Breakdown

### Feature 1: Platform Core (COMPLETE)
- [x] Create Docker Compose with Postgres, Redis, MinIO, Qdrant
- [x] NestJS API scaffold with health check
- [x] Next.js dashboard scaffold with health check
- [x] PostgreSQL schema: tenants, users tables
- [x] RLS policies for tenant isolation
- [x] JWT auth module (register, login, refresh)
- [x] Tenant middleware (set session context)
- [x] Seed script: 2 test tenants + 2 users each
- [x] Verify full stack runs locally
- [x] Fix dashboard hydration error (fresh scaffold)
- [x] Move auth to local libs folder (remove symlink)
- [x] Dashboard login page with form
- [x] Dashboard protected page with user info
- [x] Auth state redirect on home page

### Feature 2: SCM Integration (COMPLETE - API Layer)
- [x] Database schema: scm_connections, repositories, scan_configs, scans, findings, webhook_events
- [x] RLS policies for all SCM tables
- [x] Token encryption service (AES-256-GCM)
- [x] GitHub provider (OAuth, PAT, webhooks, check runs)
- [x] SCM service (connection management, repo management, scan triggers)
- [x] SCM controller (REST endpoints)
- [x] Webhooks controller (GitHub push/PR events)

### Feature 3: SAST Pipeline (COMPLETE - API Layer)
- [x] BullMQ queue module with job types
- [x] Git service (clone, checkout, language detection)
- [x] Local executor for scanner binaries
- [x] SARIF parser (universal scanner output)
- [x] Semgrep scanner implementation
- [x] Finding processor (dedupe, store, count)
- [x] Scan processor (main orchestrator)
- [x] Notify processor (GitHub check runs)

### Feature 4: Dashboard UI (COMPLETE)
- [x] Shared UI components (button, card, badge, table, modal)
- [x] API client library (lib/api.ts)
- [x] Auth context with global state management
- [x] Dashboard layout with sidebar navigation
- [x] Overview page with stats cards
- [x] Connections page (OAuth, PAT, list, delete)
- [x] Repositories page (add, scan, delete)
- [x] Scans page (list with filters)
- [x] Findings page (list, filter, detail modal, status update)
- [x] API endpoints for listing scans and findings

## Blockers
**None** - All major blockers resolved.

**Previous BullMQ Issue (RESOLVED):**
- `@nestjs/bullmq` had ModuleRef dependency injection issues with `@nestjs/core` 10.4.x
- Solution: Created custom `CustomBullModule` using `bullmq` directly
- Removed `@nestjs/bullmq` entirely
- Processors use standard NestJS services with Workers via `OnModuleInit`/`OnModuleDestroy`

## Recent Bug Fixes
- **Semgrep YAML syntax errors**: Fixed `security.yaml` - patterns with special YAML characters (`{}`, `:`, `[]`) must be quoted
  - Root cause: scans completing in 6ms with 0 findings, Semgrep exit code 7 (config error)
  - Fixed XSS pattern to valid Semgrep JSX syntax
  - 18 rules now validate correctly, 73 findings detected in test scan
- **Semgrep Windows encoding**: Registry rules fail with charmap error - created local rules file
  - Added `--no-git-ignore` flag to bypass Windows git ls-files issue
  - Auto-detects Windows and uses local rules
- **Git clone directory exists**: Fixed `createWorkDir()` in `git.service.ts` to clean up existing directories before cloning
- **Scan jobs not enqueued**: Added QueueService to ScmService, now properly calls `enqueueScan()` in `triggerScan()`
- **OAuth callback redirect**: Changed `/settings/connections` → `/dashboard/connections` in `scm.controller.ts`
- **AddRepository validation**: Added `externalId` optional field to DTO in `dto/index.ts`
- **Scans page crash**: Added null safety for `scan.trigger`, `scan.branch`, `scan.createdAt` in `scans/page.tsx`

## Dashboard UI

### Structure
```
apps/dashboard/src/
├── app/
│   ├── layout.tsx              # Root layout with AuthProvider
│   ├── page.tsx                # Home redirect
│   ├── login/page.tsx          # Login form
│   └── dashboard/
│       ├── layout.tsx          # Dashboard layout with sidebar
│       ├── page.tsx            # Overview with stats
│       ├── connections/page.tsx # SCM connections
│       ├── repositories/page.tsx # Repositories
│       ├── scans/page.tsx      # Scan history
│       └── findings/page.tsx   # Security findings
├── components/
│   ├── ui/
│   │   ├── index.ts
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── table.tsx
│   │   └── modal.tsx
│   └── layout/
│       ├── index.ts
│       ├── sidebar.tsx
│       └── dashboard-layout.tsx
└── lib/
    ├── api.ts                  # API client
    └── auth-context.tsx        # Auth state management
```

### Features
- Responsive sidebar navigation
- Dark mode support (via Tailwind)
- Loading states and error handling
- OAuth and PAT connection flows
- Repository management with scan triggers
- Finding detail modal with status updates
- Severity badges (critical, high, medium, low, info)
- Status badges (pending, running, completed, failed)

### Dashboard Pages
| Route | Description |
|-------|-------------|
| /dashboard | Overview with stats, recent scans, recent findings |
| /dashboard/connections | Manage SCM provider connections |
| /dashboard/repositories | Manage repositories, trigger scans |
| /dashboard/scans | View scan history |
| /dashboard/findings | View and manage security findings |

## API Endpoints (Updated)

### SCM Endpoints
| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | /scm/oauth/initiate | Start OAuth flow | Yes |
| GET | /scm/oauth/callback | OAuth callback (redirects) | No |
| POST | /scm/connect/pat | Connect with PAT | Yes |
| GET | /scm/connections | List connections | Yes |
| DELETE | /scm/connections/:id | Remove connection | Yes (admin) |
| GET | /scm/connections/:id/available-repos | List repos from provider | Yes |
| GET | /scm/repositories | List added repositories | Yes |
| POST | /scm/repositories | Add repository | Yes |
| GET | /scm/repositories/:id | Get repository details | Yes |
| PUT | /scm/repositories/:id/config | Update scan config | Yes |
| DELETE | /scm/repositories/:id | Remove repository | Yes (admin) |
| GET | /scm/scans | List scans | Yes |
| POST | /scm/scans | Trigger scan | Yes |
| GET | /scm/scans/:id | Get scan details | Yes |
| GET | /scm/findings | List findings | Yes |
| GET | /scm/findings/:id | Get finding details | Yes |
| PUT | /scm/findings/:id/status | Update finding status | Yes |
| POST | /webhooks/github | GitHub webhook endpoint | No (signature verified) |

## SAST Pipeline

### Queue Module Structure
```
apps/api/src/queue/
├── queue.module.ts
├── queue.constants.ts
├── services/queue.service.ts
├── processors/
│   ├── scan.processor.ts      # Main orchestrator
│   └── notify.processor.ts    # GitHub notifications
└── jobs/scan.job.ts           # Job type definitions
```

### Scanners Module Structure
```
apps/api/src/scanners/
├── scanners.module.ts
├── interfaces/scanner.interface.ts
├── utils/git.service.ts
├── execution/local-executor.service.ts
├── parsers/sarif.parser.ts
├── sast/semgrep/
│   ├── semgrep.scanner.ts
│   └── rules/security.yaml     # Local rules (18 rules, Windows-compatible)
└── services/finding-processor.service.ts
```

### Scan Flow
1. Webhook/manual trigger → Create scan record
2. Enqueue ScanJob to BullMQ
3. ScanProcessor:
   - Clone repository with auth token
   - Checkout specific commit
   - Detect languages
   - Select appropriate scanners
   - Run scanners in parallel
   - Parse SARIF output
   - Deduplicate findings
   - Store in database
   - Update GitHub check run
4. NotifyProcessor:
   - Post final summary to PR

## Database Schema

### Tables
| Table | Description |
|-------|-------------|
| tenants | Multi-tenant organizations |
| users | User accounts with tenant association |
| scm_connections | OAuth/PAT connections to SCM providers |
| repositories | Repositories added for scanning |
| scan_configs | Per-repo scan settings |
| scans | Individual scan runs |
| findings | Vulnerabilities found by scanners |
| webhook_events | Webhook audit log |

### RLS Policies
All tables have:
- `{table}_tenant_isolation` - Restricts access to tenant's data
- `{table}_superuser_bypass` - Allows postgres user full access

## Environment Variables
```bash
# Database
DATABASE_URL="postgresql://postgres:threatdiviner_dev@localhost:5433/threatdiviner"

# JWT
JWT_SECRET="your-jwt-secret-here"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# API URLs
API_BASE_URL="http://localhost:3001"
DASHBOARD_URL="http://localhost:3000"

# SCM Integration
TOKEN_ENCRYPTION_KEY="change-this-to-a-secure-random-string"
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GITHUB_WEBHOOK_SECRET=""

# Redis (for BullMQ)
REDIS_HOST="localhost"
REDIS_PORT=6379

# Scanning
SCAN_WORKDIR="C:/tmp/threatdiviner-scans"  # Windows path
SCANNER_TIMEOUT=300000
SCAN_TIMEOUT=600000
SEMGREP_PATH="semgrep"
SEMGREP_USE_LOCAL_RULES="true"  # Optional: force local rules (auto-detected on Windows)
```

## Auth Module (Local Copy)

### Location
```
apps/api/src/libs/auth/
```

### Features
- Multi-tenant JWT authentication
- httpOnly cookie tokens (access + refresh)
- Tenant middleware for RLS context
- Role-based access control decorators
- Fully contained in the project (no external dependencies)

### Test Credentials
| Tenant | Email | Password | Role |
|--------|-------|----------|------|
| acme-corp | admin@acme.com | admin123 | admin |
| acme-corp | dev@acme.com | dev123 | member |
| beta-inc | admin@beta.io | admin123 | admin |
| beta-inc | dev@beta.io | dev123 | member |

## Database Configuration

### Connection
```
Host: localhost
Port: 5433 (mapped to internal 5432)
Database: threatdiviner
User: postgres
Password: threatdiviner_dev
```

## Infrastructure Status
| Service | Status | Port |
|---------|--------|------|
| Postgres | Running | 5433 |
| Redis | Running | 6379 |
| MinIO | Running | 9000/9001 |
| Qdrant | Running | 6333/6334 |
| API | Running | 3001 |
| Dashboard | Running | 3000 |

## Next Steps
1. ~~Install Semgrep binary for local testing~~ ✅ DONE - 18 local rules working
2. Test full scan flow with a real repository (GitHub OAuth + trigger scan via UI)
3. ~~Add Bandit scanner (Python)~~ ✅ DONE
4. ~~Add Gosec scanner (Go)~~ ✅ DONE
5. ~~Add Trivy scanner (SCA/containers)~~ ✅ DONE
6. ~~Add Gitleaks scanner (secrets)~~ ✅ DONE
7. Complete AI Triage integration (API endpoint, auto-triage during scan)
8. Add triage UI in findings page (show AI analysis, allow override)
9. Bull Board UI at /admin/queues (may need custom implementation)

## Scanner Status
| Scanner | Type | Status | Binary Required |
|---------|------|--------|-----------------|
| Semgrep | SAST | ✅ Working | semgrep |
| Bandit | SAST (Python) | 🔧 Ready | bandit (pip install) |
| Gosec | SAST (Go) | 🔧 Ready | gosec (go install) |
| Trivy | SCA | 🔧 Ready | trivy |
| Gitleaks | Secrets | 🔧 Ready | gitleaks |

## AI Triage
- **Module**: `apps/api/src/ai/`
- **Service**: `AiService` with `triageFinding()` and `batchTriageFindings()`
- **Config**: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (defaults to claude-sonnet-4-20250514)
- **Returns**: Analysis, suggested severity, false positive likelihood, exploitability, remediation, references

## Debug Logs
API logs for scan debugging: `C:\Users\ayazg\AppData\Local\Temp\claude\C--dev-threatdiviner\tasks\bd7676b.output`

## Commands
```bash
# Build API
cd apps/api && pnpm build

# Run API
cd apps/api && pnpm start:dev

# Run seed
cd apps/api && pnpm db:seed

# Run Dashboard
cd apps/dashboard && pnpm dev

# Regenerate Prisma client
cd apps/api && npx prisma generate

# Push schema changes (dev)
cd apps/api && npx prisma db push
```

---
*Last updated: 2025-12-20 (Added 4 scanners + AI triage module + display fixes) — CLI Session*
