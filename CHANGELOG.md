# Changelog

All notable changes to ThreatDiviner will be documented in this file.

## [0.3.3] - 2026-01-07

### New Features

#### Katana URL Discovery Scanner
- **New scanner**: `katana.scanner.ts` in `apps/api/src/scanners/discovery/katana/`
- Crawls web applications to discover URLs, parameters, forms, and JS files
- Parses stdout URLs directly (Windows-compatible, `-o` flag unreliable)
- Configurable depth: quick (depth=1), standard (depth=3), comprehensive (depth=5)
- Deduplicates URLs and extracts unique parameters by path:name
- Feeds discovered endpoints to downstream vulnerability scanners

### Scanner Interface
```typescript
interface KatanaDiscoveryOutput extends ScanOutputWithDiscovery {
  discoveredUrls: string[];
  discoveredParams: DiscoveredParam[];
  discoveredForms: DiscoveredForm[];
  jsFiles: string[];
  totalRequests: number;
}
```

### Scan Flow Integration
- Quick scan: Katana → Nuclei → SSLyze
- Standard scan: Katana → Nuclei → SSLyze → ZAP
- Comprehensive scan: Katana → All scanners (including SQLMap)

### Testing & Validation

#### CLI Baseline Tests
| Scanner | Command | Result |
|---------|---------|--------|
| Katana | `katana -u <target> -d 2 -silent -nc` | 28 unique URLs, 8 with params |
| Nuclei | `nuclei -u <target> -t http/technologies/` | 8 technologies detected |
| SSLyze | `sslyze <target>` | No SSL on test target |
| SQLMap | `sqlmap --version` | v1.10 available |

#### Wrapper Comparison Tests

All wrappers validated to match CLI baseline output with <10% timing overhead.

| Scanner | CLI Result | Wrapper Result | Timing Overhead | Status |
|---------|-----------|----------------|-----------------|--------|
| Katana | 28 URLs | 28 URLs | -0.1% (13.8s) | ✓ PASS |
| Nuclei | 1 info finding | 1 info finding | 0.0% (5min) | ✓ PASS |
| SQLMap | 4 injection types | 4 injection types | 2.0% (29s) | ✓ PASS |

**SQLMap Injection Types Found:**
- boolean-based blind
- error-based
- time-based blind
- UNION query

**SSLyze:** Skipped (test target is HTTP-only, no SSL/TLS)
**ZAP:** Pending (Docker networking issue on Windows)

### Bug Fixes
- Fixed `parseStdoutUrls` method in katana.scanner.ts (was missing)
- Removed unused `parseDiscoveredUrls` and `extractFormFields` methods
- Removed unused `KatanaJsonOutput` interface

### Known Issues
- ZAP Docker on Windows: API calls proxied incorrectly, works only inside container
- Pentest API requires JWT auth (x-tenant-id header not sufficient)

### Files Changed

Backend (New):
- `apps/api/src/scanners/discovery/katana/katana.scanner.ts` (305 lines)
- `apps/api/test-katana-wrapper.js` - Katana wrapper vs CLI test
- `apps/api/test-nuclei-wrapper.js` - Nuclei wrapper vs CLI test
- `apps/api/test-sqlmap-wrapper.js` - SQLMap wrapper vs CLI test
- `apps/api/test-scan-flow.js` - Full flow test with auth handling
- `apps/api/test-quick-scan.js` - Quick scan API test

Backend (Modified):
- `apps/api/src/queue/processors/target-scan.processor.ts` - Integrated Katana discovery

---

## [0.3.2] - 2026-01-06

### Enhancements

#### Real-Time Verbose Logging
- **Live log streaming** during scanner execution:
  - New WebSocket event `scanner:log` streams stdout/stderr lines in real-time
  - Added `ScannerLogEvent` interface to `scan.gateway.ts`
  - Logs displayed in scan cockpit with terminal-style UI
  - 500 line buffer with color coding (green=stdout, yellow=stderr)

#### Process Cancellation
- **Proper process killing** for scan cancellation:
  - `LocalExecutorService` now tracks running processes by scanId
  - New `killProcess(scanId)` method sends SIGTERM/SIGKILL
  - `cancelScan` in pentest.service kills process before updating DB
  - Scanners pass `scanId` to executor for tracking

### Bug Fixes
- **Fixed 15% hardcoded progress**: Removed fake 15% default, now shows 0% until real progress
- **Removed glowing severity boxes**: Deleted unused FindingsCounter components
- **Fixed cancel button**: Now properly kills running scanner processes

### Files Changed

Backend:
- `apps/api/src/scanners/execution/local-executor.service.ts` - Process tracking, killProcess() method
- `apps/api/src/scans/scan.gateway.ts` - Added ScannerLogEvent, emitScannerLog()
- `apps/api/src/queue/processors/target-scan.processor.ts` - onLog callback, scanId in context
- `apps/api/src/scanners/dast/nuclei/nuclei.scanner.ts` - onLog streaming, scanId to executor
- `apps/api/src/scanners/dast/zap/zap.scanner.ts` - onLog streaming, scanId tracking
- `apps/api/src/pentest/pentest.service.ts` - killProcess call in cancelScan

Frontend:
- `apps/dashboard/src/hooks/use-scan-stream.ts` - LogLine interface, scanner:log handler
- `apps/dashboard/src/app/dashboard/targets/[id]/scans/[scanId]/page.tsx` - Live logs UI, removed glowing boxes

---

## [0.3.1] - 2026-01-06

### Enhancements

#### Scan Mode Renaming
- **Renamed scan modes** for clarity:
  - `discovery` → `optimized` (two-phase: tech detection + focused templates)
  - `deep` → `full` (runs all vulnerability templates)
- Updated all UI labels and descriptions
- Backend phase names updated: `discovery`, `focused`, `single`, `full`

#### Rate Limit Presets
- **New rate limit preset system** replacing numeric RPS input:
  - **Low (50 RPS)**: Production safe - minimal target impact
  - **Medium (150 RPS)**: Staging/test environments (default)
  - **High (300 RPS)**: Local development and isolated targets
- Per-scanner configurations in `rate-limit.config.ts`:
  - Nuclei: rateLimit, bulkSize, concurrency
  - ZAP: maxRequestsPerSecond, threadCount
  - Nikto: timeout, pause
  - SQLMap: delay, threads

#### Real-Time Progress Tracking
- **Nuclei scanner**: Uses `-stats -stats-interval 3` flags to emit real progress
  - Parses `Requests: X/Y (Z%)` from stderr output
  - Emits `scanner:progress` WebSocket events with actual percentages
- **ZAP scanner**: Progress tracking via stdout parsing
  - Detects phases: spider, active-scan, passive-scan, analyzing
  - Emits estimated progress based on scan phase
- **VU Meters**: Now show real percentage instead of hardcoded 15%

#### Two-Phase Scan UI
- **Phase indicator** in scan cockpit for optimized scans:
  - Shows Discovery → Focused Scan progression
  - Displays detected technologies between phases (up to 5 tags)
  - Visual state indication (pending/active/complete) with animations
- New WebSocket event: `scan:phase` for phase transitions

### Bug Fixes
- Fixed TypeScript compilation errors in target-scan.processor.ts
- Fixed ScanResult interface to include `cancelled` status
- Fixed unescaped apostrophes in JSX text (ESLint errors)
- Added `detectedTechnologies` field to ScanResult interface

### Files Changed

Backend:
- `apps/api/src/scanners/rate-limit.config.ts` (NEW) - Centralized rate limit config
- `apps/api/src/scanners/dast/nuclei/nuclei.scanner.ts` - Progress tracking via -stats
- `apps/api/src/scanners/dast/zap/zap.scanner.ts` - Progress tracking via stdout
- `apps/api/src/scanners/execution/local-executor.service.ts` - Added onStdout callback
- `apps/api/src/scans/scan.gateway.ts` - Added scan:phase event, updated progress event
- `apps/api/src/queue/processors/target-scan.processor.ts` - Rate limit preset support
- `apps/api/src/queue/jobs/scan.job.ts` - Updated TargetScanJobData interfaces
- `apps/api/src/pentest/pentest.service.ts` - Uses new scan modes and rate limit presets
- `apps/api/prisma/schema.prisma` - Added rateLimitPreset field, updated scanPhase values

Frontend:
- `apps/dashboard/src/hooks/use-scan-stream.ts` - Added phase tracking, real progress
- `apps/dashboard/src/app/dashboard/targets/[id]/settings/page.tsx` - Rate limit preset UI
- `apps/dashboard/src/app/dashboard/targets/[id]/page.tsx` - Optimized/Full mode labels
- `apps/dashboard/src/app/dashboard/targets/[id]/scans/[scanId]/page.tsx` - Phase indicator UI

---

## [0.3.0] - 2026-01-06

### Major Features

#### Menu Restructure & Navigation Overhaul
- **Three-Section Sidebar**: Collapsible sections with auto-expand for active routes
  - **Security Scanning**: Repositories, Targets, Cloud Accounts, Monitoring
  - **Insights**: Dashboard, Compliance, Reports, Analytics
  - **Settings**: Organization, Team, API Keys, Notifications, Integrations

#### DAST/Runtime Separation from Repositories
- **Repositories** now only run code security scanners:
  - Semgrep (SAST)
  - Trivy (SCA)
  - Gitleaks (Secrets)
  - Checkov (IaC)
- **Targets** manage all DAST/runtime scanning:
  - Nuclei
  - OWASP ZAP
  - Nikto
  - SQLMap
  - SSLyze

#### New Targets Module
- **Target List Page** (`/dashboard/targets`):
  - Add Target modal with URL, type (Web App/API/Network), description
  - Table with name, URL, type, last scan, risk score
  - Search filtering
  - Actions dropdown (Start Scan, Settings, Delete)

- **Target Detail Page** (`/dashboard/targets/[id]`):
  - Overview tab with stats cards (Risk Score, Total Scans, Findings, Last Scan)
  - Scans tab with scan history table
  - Findings tab (placeholder for aggregated view)
  - Start Scan modal with scanner selection and scan mode (Discovery/Deep)

- **Target Settings Page** (`/dashboard/targets/[id]/settings`):
  - General settings (name, URL, type, description)
  - Default scanner selection with checkboxes
  - Scan mode configuration (Discovery/Deep)
  - Authentication settings (None, Basic Auth, Bearer Token, Session Cookie)
  - Advanced settings (rate limiting, exclude paths)

- **Target Scan Cockpit** (`/dashboard/targets/[id]/scans/[scanId]`):
  - Real-time progress tracking with phase steps
  - Scanner status cards with individual progress
  - Findings summary with severity breakdown
  - Expandable findings list with details
  - VU meter-style visualization with LED segments
  - Live elapsed time counter
  - CRT scanline effect toggle

#### Targets API Backend
- **New `/targets` Endpoints**:
  - `GET /targets` - List targets for project
  - `POST /targets` - Create target with auth config
  - `GET /targets/:id` - Get target details
  - `PATCH /targets/:id` - Update target
  - `DELETE /targets/:id` - Delete target
  - `POST /targets/:id/scan` - Start scan with scanner selection
  - `GET /targets/:id/scans` - List scan history
  - `GET /targets/:id/scans/:scanId` - Get scan details with findings

- **Prisma Schema Updates** (`PenTestTarget` model):
  - `authType` - Authentication method (none, basic, bearer, cookie)
  - `authCredentials` - Encrypted credentials JSON
  - `defaultScanners` - Array of scanner names
  - `defaultScanMode` - Discovery or deep
  - `rateLimitRps` - Request rate limiting
  - `excludePaths` - Paths to skip
  - `riskScore` - Calculated risk (0-100)
  - `lastScanId` - Reference to most recent scan

- **BullMQ Target Scan Processor**:
  - `target-scan-jobs` queue for async processing
  - WebSocket events via ScanGateway
  - Real-time findings streaming
  - Risk score calculation

#### New Placeholder Pages
- **Cloud Accounts** (`/dashboard/cloud-accounts`): AWS, Azure, GCP integration placeholder
- **Monitoring** (`/dashboard/monitoring`): Security alerts, custom rules, integrations
- **Organization Settings** (`/dashboard/settings/organization`): Hub for org-wide settings
- **Integrations** (`/dashboard/settings/integrations`): GitHub, Slack, PagerDuty, Jira, Webhooks

### Enhancements
- **WebSocket Real-Time Updates**: Integrated `useScanStream` hook in Target Scan Cockpit for live updates
- **VU Meter Visual Polish**:
  - Added CSS glow effects for severity counters (critical=red, high=orange, medium=yellow, low=blue)
  - Added CRT scanline animation keyframes
  - Added terminal text shadow effect for elapsed time display
  - WebSocket connection indicator in scan header

### Bug Fixes
- Extended `StatusBadge` component to support all scan pipeline statuses (queued, cloning, scanning, analyzing, storing, notifying)
- Fixed TypeScript compilation errors in new pages
- Added 'running' status type to ScanResult interface for WebSocket compatibility
- **Fixed slow nuclei scans** (7+ min down to ~60 sec):
  - Changed per-request timeout from 300s to 30s (`nuclei.scanner.ts`)
  - Fixed VU meter showing 50% at start - now shows 15% when scanner running
  - Backend now tracks active scanners and sends status when client subscribes (`scan.gateway.ts`)
- Added cancel scan button to Target Scan Cockpit

### Files Changed

Frontend (New):
- `apps/dashboard/src/app/dashboard/targets/page.tsx`
- `apps/dashboard/src/app/dashboard/targets/[id]/page.tsx`
- `apps/dashboard/src/app/dashboard/targets/[id]/settings/page.tsx`
- `apps/dashboard/src/app/dashboard/targets/[id]/scans/[scanId]/page.tsx`
- `apps/dashboard/src/app/dashboard/cloud-accounts/page.tsx`
- `apps/dashboard/src/app/dashboard/monitoring/page.tsx`
- `apps/dashboard/src/app/dashboard/settings/organization/page.tsx`
- `apps/dashboard/src/app/dashboard/settings/integrations/page.tsx`

Frontend (Modified):
- `apps/dashboard/src/components/layout/sidebar.tsx` - Complete rewrite with new menu structure
- `apps/dashboard/src/components/ui/badge.tsx` - Extended StatusBadge types
- `apps/dashboard/src/app/dashboard/repositories/[id]/page.tsx` - Removed DAST scanners
- `apps/dashboard/src/app/dashboard/repositories/[id]/settings/page.tsx` - Removed DAST config

Backend (New):
- `apps/api/src/targets/targets.controller.ts` - REST endpoints at `/targets`
- `apps/api/src/targets/targets.module.ts` - NestJS module
- `apps/api/src/scans/scans.module.ts` - WebSocket gateway module
- `apps/api/src/queue/processors/target-scan.processor.ts` - BullMQ worker

Backend (Modified):
- `apps/api/src/scm/services/scm.service.ts` - Force enableDast=false for repo scans, filter DAST scanners
- `apps/api/src/pentest/dto/index.ts` - Added StartTargetScanDto, extended DTOs
- `apps/api/src/pentest/pentest.service.ts` - Added startTargetScan, getTargetScans methods
- `apps/api/src/pentest/pentest.module.ts` - Added QueueModule import
- `apps/api/src/queue/queue.constants.ts` - Added TARGET_SCAN queue
- `apps/api/src/queue/jobs/scan.job.ts` - Added TargetScanJobData interface
- `apps/api/src/queue/services/queue.service.ts` - Added enqueueTargetScan method
- `apps/api/src/scanners/scanners.module.ts` - Added ScansModule, TargetScanProcessor
- `apps/api/src/app.module.ts` - Added TargetsModule, ScansModule
- `apps/api/prisma/schema.prisma` - Extended PenTestTarget model

---

## [0.2.0] - 2026-01-05

### Major Features

#### Repo-Centric UX Overhaul
- **Simplified Repository List**: Clean table with status dots (green/yellow/red), last scanned date, and single "Open" button
- **Redesigned Repository Detail Page**:
  - Hero section with repo name, GitHub link, and prominent "Run Scan" button
  - Modal-based scan configuration with branch selector and scanner toggles
  - Scans table with status badges, trigger icons (manual/webhook/CLI), duration, and findings count
  - Settings gear opens slide-out panel for webhook/CLI/scan config

#### New Scan Dashboard ("Cockpit" View)
- Dark theme with VU meter-style visualization
- Real-time scanner activity bars with color gradients based on severity
- Animated findings counter with live severity breakdown
- Streaming findings panel with expandable cards
- CRT scanline overlay effect (toggleable)
- Live elapsed time counter

#### Two-Phase Penetration Testing
- **Discovery Phase**: Fast technology detection using lightweight templates
- **Deep Phase**: Focused vulnerability scanning based on detected technologies
- Technology detection extracts: Apache, Nginx, WordPress, Tomcat, PHP, Node.js, Spring, etc.
- Automatic template selection based on discovered stack
- Finding deduplication across phases (merges duplicates, keeps highest severity)

Scanner updates for two-phase:
- **Nuclei**: `getDiscoveryTemplates()`, `getFocusedTemplates(techs)`, `parseTechnologies()`
- **Nikto**: Phase-aware tuning options per technology
- **SQLMap**: Discovery (level 1) vs Deep (level 5) modes
- **SSLyze**: Quick protocol check vs full cipher analysis

#### Real-Time Streaming
- **WebSocket Gateway** (`/scans` namespace):
  - `scanner:start` - Scanner begins execution
  - `scanner:progress` - File/endpoint counts
  - `scanner:finding` - Individual findings as discovered
  - `scanner:complete` - Scanner finished
  - `scan:complete` - Full scan completed
- **SSE Endpoint** (`GET /scans/:id/stream`) for CLI integration
- Frontend hook `useScanStream()` for React components

#### Webhook Integration
- GitHub webhook handler (`POST /webhooks/github/:repoId`)
- GitLab webhook handler (`POST /webhooks/gitlab/:repoId`)
- Branch filtering (include/exclude patterns with glob support)
- Signature verification (HMAC-SHA256 for GitHub, token for GitLab)
- Configurable scanner selection per repository
- Diff-only scanning option

#### GitHub Integration Service
- PR summary comments with severity breakdown
- Inline code comments on specific lines
- Commit status updates (pass/fail based on severity threshold)
- Automatic merge blocking for critical/high findings

#### Duration Tracking & Estimates
- Scan duration stored in database
- `DurationEstimateService` for predictions based on history
- Per-scanner duration breakdowns
- Repository/target scan statistics

### Schema Changes

Added to `Repository` model:
- `webhookUrl` - Unique webhook endpoint
- `webhookSecret` - HMAC signature secret
- `webhookBranchFilters` - Include patterns
- `webhookBranchExcludes` - Exclude patterns
- `webhookScannersEnabled` - Scanner list
- `webhookBlockSeverity` - Merge blocking threshold
- `webhookDiffOnly` - Scan only changed files
- `webhookInlineComments` - Post inline PR comments

`PenTestScan` model already had:
- `scanPhase` - discovery/deep/both/single
- `detectedTechnologies` - Array of detected tech names
- `parentScanId` - Links deep scan to discovery scan

### API Endpoints

New pentest endpoints:
- `POST /pentest/scans/full-analysis` - Run two-phase scan
- `GET /pentest/scans/:id/technologies` - Get detected technologies
- `GET /pentest/targets/:id/estimate` - Get duration estimate

New scan endpoints:
- `GET /scans/:id/stream` - SSE stream for real-time updates
- `GET /scans/:id/status` - Current scan status

Webhook endpoints:
- `POST /webhooks/github/:repoId` - GitHub webhooks
- `POST /webhooks/gitlab/:repoId` - GitLab webhooks

### Files Changed

Frontend:
- `apps/dashboard/src/app/dashboard/repositories/page.tsx` - Simplified list
- `apps/dashboard/src/app/dashboard/repositories/[id]/page.tsx` - Rebuilt detail
- `apps/dashboard/src/app/dashboard/repositories/[id]/scans/[scanId]/page.tsx` - New cockpit
- `apps/dashboard/src/hooks/use-scan-stream.ts` - WebSocket hook

Backend:
- `apps/api/prisma/schema.prisma` - Webhook fields
- `apps/api/src/scanners/dast/nuclei/nuclei.scanner.ts` - Two-phase templates
- `apps/api/src/scanners/pentest/nikto/nikto.scanner.ts` - Phase-aware tuning
- `apps/api/src/pentest/pentest.service.ts` - `runTwoPhase()` method
- `apps/api/src/pentest/pentest.controller.ts` - New endpoints
- `apps/api/src/scans/scan.gateway.ts` - WebSocket gateway
- `apps/api/src/scans/scans.controller.ts` - SSE endpoint
- `apps/api/src/scans/duration-estimate.service.ts` - Duration estimates
- `apps/api/src/webhooks/webhook.controller.ts` - Webhook handlers
- `apps/api/src/integrations/github.service.ts` - GitHub PR integration

---

## [0.1.0] - Previous Release

Initial release with:
- Multi-tenant architecture
- SAST scanning (Semgrep)
- SCA scanning (Trivy)
- Secrets detection (Gitleaks)
- IaC scanning (Checkov)
- DAST scanning (Nuclei, ZAP)
- Penetration testing (SQLMap, SSLyze, Nikto)
- Project management
- Scan configuration
- Finding management
