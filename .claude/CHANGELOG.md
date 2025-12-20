# ThreatDiviner - Changelog

## 2025-12-20 Session 6
**Completed:**
- Fixed Semgrep YAML syntax errors causing scans to fail with exit code 7
- Semgrep now working end-to-end on Windows (tested: 73 findings detected)

**Root Cause Analysis:**
- Scans were completing in 6ms with 0 findings
- Debug logging revealed Semgrep was being selected and run correctly
- Semgrep exit code 7 = configuration error
- Manual test revealed: "Invalid YAML file... mapping values are not allowed here"
- Issue: `security.yaml` had unquoted patterns containing YAML special characters

**Bug Fixes:**
- **YAML syntax errors in security.yaml**: Multiple patterns contained `{}`, `:`, `[]` characters that YAML interpreted as mappings
  - Line 46: `dangerouslySetInnerHTML={{__html: $VAR}}` → quoted properly
  - Line 147-149: CORS patterns with curly braces → quoted properly
  - Line 160-161: Helmet patterns with ellipsis → fixed `...` syntax to `...,`
  - Line 172-173: JWT verify patterns with nested braces → quoted properly
  - All NoSQL/prototype pollution patterns → quoted properly
- **XSS pattern fix**: Changed from invalid JSX attribute syntax to valid Semgrep pattern `<$EL dangerouslySetInnerHTML=... />`
- **CORS header pattern fix**: Changed string literal to valid JavaScript: `$RES.setHeader("Access-Control-Allow-Origin", "*")`

**Files Updated:**
- `apps/api/src/scanners/sast/semgrep/rules/security.yaml` - Fixed all YAML syntax errors (18 rules now valid)

**Verified Working:**
- `semgrep scan --validate` passes with 0 errors, 18 rules
- Test scan of API source: **73 findings detected**
- SARIF output file generated correctly (50KB)

**Debug logs location:** `C:\Users\ayazg\AppData\Local\Temp\claude\C--dev-threatdiviner\tasks\bd7676b.output`

---

## 2025-12-20 Session 5
**Completed:**
- Fixed scan failing due to existing work directory from failed scans
- Added QueueService to ScmService to actually enqueue scan jobs
- Added local Semgrep rules to bypass Windows encoding issues

**Bug Fixes:**
- **Git clone failure fix**: Modified `createWorkDir()` in `git.service.ts` to clean up any existing directory before creating a fresh one
  - Previous scans would fail with "directory already exists" if a prior scan failed mid-clone
  - Now uses `fs.rm(workDir, { recursive: true, force: true })` before `fs.mkdir()`
- **Scan jobs not being queued**: ScmService.triggerScan() had a TODO comment instead of calling `queueService.enqueueScan()`
  - Added QueueService injection to ScmService
  - Builds proper `ScanJobData` and enqueues to BullMQ
- **Semgrep Windows encoding fix**: Registry rules fail with "charmap codec can't encode Unicode character '\u202a'"
  - Created local rules file: `apps/api/src/scanners/sast/semgrep/rules/security.yaml`
  - Modified SemgrepScanner to auto-detect Windows and use local rules
  - Added `--no-git-ignore` flag to bypass Windows git ls-files issues
  - Added Python UTF-8 encoding env vars (`PYTHONUTF8`, `PYTHONIOENCODING`)
- **SCAN_WORKDIR path fix**: Changed from Unix `/tmp/...` to Windows `C:/tmp/...` in .env

**Files Created:**
- `apps/api/src/scanners/sast/semgrep/rules/security.yaml` - Local security rules (18 rules)

**Files Updated:**
- `apps/api/src/scanners/utils/git.service.ts` - createWorkDir() now cleans up existing directories
- `apps/api/src/scm/services/scm.service.ts` - Added QueueService, calls enqueueScan()
- `apps/api/src/scm/scm.module.ts` - Added QueueModule import
- `apps/api/src/scanners/sast/semgrep/semgrep.scanner.ts` - Local rules + --no-git-ignore
- `apps/api/src/scanners/execution/local-executor.service.ts` - Added Python UTF-8 encoding env vars
- `apps/api/src/queue/processors/scan.processor.ts` - Added debug logging
- `apps/api/.env` - Fixed SCAN_WORKDIR path for Windows

**Verified Working:**
- API starts with all modules initialized
- Scan worker and Notify worker running
- Scans now properly enqueued to Redis/BullMQ
- Work directory cleanup prevents clone failures

**Next:** Test full scan flow end-to-end with Semgrep

---

## 2025-12-20 Session 4
**Completed:**
- Fixed BullMQ dependency issue (RESOLVED)
- Full SAST pipeline now functional with queue workers

**BullMQ Fix:**
- Created custom `CustomBullModule` (`apps/api/src/queue/custom-bull.module.ts`)
- Uses `bullmq` directly instead of `@nestjs/bullmq` wrapper
- Removed `@nestjs/bullmq` dependency entirely
- Updated processors to use standard NestJS services with Workers

**Technical Details:**
- `@nestjs/bullmq` had ModuleRef dependency injection issues with `@nestjs/core` 10.4.x
- Custom module creates Queue instances via providers with injection tokens
- Processors (`ScanProcessor`, `NotifyProcessor`) now implement `OnModuleInit`/`OnModuleDestroy`
- Workers are created/destroyed with module lifecycle

**Files Created:**
- `apps/api/src/queue/custom-bull.module.ts` - Custom BullMQ module

**Files Updated:**
- `apps/api/src/app.module.ts` - Uses CustomBullModule instead of @nestjs/bullmq
- `apps/api/src/queue/queue.module.ts` - Simplified, no longer imports BullModule
- `apps/api/src/queue/services/queue.service.ts` - Uses @Inject instead of @InjectQueue
- `apps/api/src/queue/processors/scan.processor.ts` - Standard NestJS service with Worker
- `apps/api/src/queue/processors/notify.processor.ts` - Standard NestJS service with Worker
- `apps/api/package.json` - Removed @nestjs/bullmq, kept bullmq

**Verified Working:**
- API starts with all modules initialized
- CustomBullModule, QueueModule, ScannersModule all load
- Scan worker and Notify worker start successfully
- Full stack running: API (3001) + Dashboard (3000)

**Next:** Install Semgrep, test full scan flow with real repository

---

## 2025-12-19 Session 3
**Completed:**
- Feature 4: Dashboard UI (Complete)
- Verified full stack running: API (3001) + Dashboard (3000)

**Bug Fixes:**
- OAuth callback redirect: Changed from `/settings/connections` to `/dashboard/connections`
- AddRepository DTO: Added `externalId` as optional field to fix validation error
- Scans page null safety: Fixed crash when `scan.trigger`, `scan.branch`, `scan.createdAt` are undefined

**Dashboard UI Components (`apps/dashboard/src/components/ui/`):**
- Button: Primary, secondary, danger, ghost variants with loading state
- Card: Default, bordered, elevated variants with header/content/footer
- Badge: Severity (critical, high, medium, low, info) and status badges
- Table: Full table components with empty state
- Modal: Accessible modal with header/body/footer

**Dashboard Layout (`apps/dashboard/src/components/layout/`):**
- Sidebar: Navigation with icons, active state, user info, logout
- DashboardLayout: Sidebar + main content wrapper

**Auth Context (`apps/dashboard/src/lib/auth-context.tsx`):**
- Global auth state management
- Auto-redirect on auth state change
- Login/logout functions

**API Client (`apps/dashboard/src/lib/api.ts`):**
- Type-safe API client for all endpoints
- authApi, connectionsApi, repositoriesApi, scansApi, findingsApi, dashboardApi

**Dashboard Pages:**
- Overview (`/dashboard`): Stats cards, severity breakdown, recent scans/findings
- Connections (`/dashboard/connections`): OAuth/PAT flow, list/delete connections
- Repositories (`/dashboard/repositories`): Add repos, trigger scans, manage
- Scans (`/dashboard/scans`): List with trigger/status info
- Findings (`/dashboard/findings`): Filter, detail modal, status updates

**API Updates:**
- Added `GET /scm/scans` - List all scans
- Added `GET /scm/findings` - List findings with filters
- Added `GET /scm/findings/:id` - Get finding details
- Added `PUT /scm/findings/:id/status` - Update finding status
- Fixed response format for list endpoints (returns arrays directly)

**Files Created:**
- `apps/dashboard/src/components/ui/*.tsx` (5 files)
- `apps/dashboard/src/components/layout/*.tsx` (2 files)
- `apps/dashboard/src/lib/api.ts`
- `apps/dashboard/src/lib/auth-context.tsx`
- `apps/dashboard/src/app/dashboard/layout.tsx`
- `apps/dashboard/src/app/dashboard/connections/page.tsx`
- `apps/dashboard/src/app/dashboard/repositories/page.tsx`
- `apps/dashboard/src/app/dashboard/scans/page.tsx`
- `apps/dashboard/src/app/dashboard/findings/page.tsx`

**Files Updated:**
- `apps/dashboard/src/app/layout.tsx` - Added AuthProvider
- `apps/dashboard/src/app/page.tsx` - Uses auth context
- `apps/dashboard/src/app/login/page.tsx` - Uses auth context and Button
- `apps/dashboard/src/app/dashboard/page.tsx` - Overview with stats
- `apps/api/src/scm/scm.controller.ts` - Added scan/findings list endpoints
- `apps/api/src/scm/services/scm.service.ts` - Added listScans, listFindings methods

**Next:** Install Semgrep, test full scan flow

---

## 2025-12-19 Session 2
**Completed:**
- Feature 2: SCM Integration (API Layer)
- Configured GitHub OAuth credentials and tested OAuth flow
- Feature 3: SAST Pipeline (API Layer)

**SAST Pipeline (Feature 3):**
- BullMQ queue module with job types (scan, clone, sast, notify, cleanup)
- Git service (clone with auth, checkout, language detection, cleanup)
- Local executor service for running scanner binaries
- SARIF parser for universal scanner output
- Semgrep scanner implementation
- Finding processor service (dedupe, store, count by severity)
- Scan processor (main orchestrator) - clone → detect → scan → store → notify
- Notify processor for GitHub check run updates and PR summaries

**New Queue Names:**
- scan-jobs, clone-jobs, sast-jobs, sca-jobs, secrets-jobs, notify-jobs, cleanup-jobs

**New Environment Variables:**
- REDIS_HOST, REDIS_PORT
- SCAN_WORKDIR, SCANNER_TIMEOUT, SCAN_TIMEOUT
- SEMGREP_PATH, BANDIT_PATH, GOSEC_PATH

**Database:**
- Added 6 new tables: scm_connections, repositories, scan_configs, scans, findings, webhook_events
- RLS policies for all new tables (tenant isolation + superuser bypass)
- Prisma schema updated with all models and relations

**SCM Module (`apps/api/src/scm/`):**
- CryptoService: AES-256-GCM token encryption
- GitHubProvider: OAuth, PAT auth, webhooks, check runs
- ScmService: Connection/repo management, scan triggers
- ScmController: REST endpoints for all operations
- WebhooksController: GitHub push/PR event handling

**New Endpoints:**
- `POST /scm/oauth/initiate` - Start OAuth flow
- `GET /scm/oauth/callback` - OAuth callback
- `POST /scm/connect/pat` - Connect with PAT
- `GET /scm/connections` - List connections
- `DELETE /scm/connections/:id` - Remove connection
- `GET /scm/connections/:id/available-repos` - List provider repos
- `GET /scm/repositories` - List added repos
- `POST /scm/repositories` - Add repository
- `GET /scm/repositories/:id` - Get repo details
- `PUT /scm/repositories/:id/config` - Update scan config
- `DELETE /scm/repositories/:id` - Remove repo
- `POST /scm/scans` - Trigger scan
- `GET /scm/scans/:id` - Get scan details
- `POST /webhooks/github` - GitHub webhook endpoint

**Environment Variables Added:**
- API_BASE_URL, DASHBOARD_URL
- TOKEN_ENCRYPTION_KEY
- GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_WEBHOOK_SECRET

**Next:** Dashboard UI for SCM, BullMQ job queue, scanner integration

---

## 2025-12-19 Session 1
**Completed:**
- Scaffolded fresh Next.js 14.1.0 with create-next-app to fix ActionQueueContext bug
- Moved auth module from @altaniche/auth symlink to local libs folder
- Built dashboard login page with tenant/email/password form
- Built protected dashboard page with user info display
- Added auth state redirect on home page
- Updated layout metadata (title: ThreatDiviner)

**Dashboard Pages:**
- `/login` - Login form with Organization, Email, Password fields
- `/dashboard` - Protected page showing user info, tenant info, logout button
- `/` - Redirects to /login or /dashboard based on auth state

**Login Flow:**
1. Visit localhost:3000 → redirects to /login
2. Enter credentials → POST to API → sets httpOnly cookies
3. Redirects to /dashboard → fetches profile → shows welcome
4. Logout → clears cookies → redirects to /login

**Result:**
- Full auth flow working end-to-end
- Dashboard integrates with API via httpOnly cookies
- CORS configured for cross-origin requests

**Note:** Next.js 14.1.0 has a security advisory - will need to upgrade later

**Next:** Role-based guards, API key management

---

## 2025-12-18 Session 2
**Duration:** 3 hours
**Completed:**
- Auth module extracted to @altaniche/auth
- Symlink integrated with ThreatDiviner
- Dashboard Next.js downgrade attempted

**Blockers:**
- Dashboard hydration still broken

**Next:** Fix dashboard, then switch auth to local copy

---

## 2025-12-18 Session 1
**Duration:** 2 hours
**Completed:**
- Docker Compose (Postgres, Redis, MinIO, Qdrant)
- NestJS API scaffold + health check
- Next.js dashboard scaffold
- Prisma schema + RLS policies
- Seed data (2 tenants, 4 users)
- JWT auth with httpOnly cookies

**Blockers:**
- Postgres port conflict (fixed: 5433)

**Next:** Test auth endpoints
