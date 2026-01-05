# Changelog

All notable changes to ThreatDiviner will be documented in this file.

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
