# ThreatDiviner Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2024-12-22 (Overnight Session)

### Session 4: Phase 2 Features - Scanners, Notifications, Audit, Rate Limiting

#### Added - TruffleHog Secrets Scanner
- `apps/api/src/scanners/secrets/trufflehog/trufflehog.scanner.ts` - Scanner implementation
- `apps/api/src/scanners/secrets/trufflehog/index.ts` - Module exports
- Parses JSONL output format
- Supports verified credential detection
- Integrated into scan processor alongside Gitleaks

#### Added - Enhanced Trivy Container Image Scanning
- Updated `apps/api/src/scanners/sca/trivy/trivy.scanner.ts`
- Added `scanContainerImage()` method for `trivy image` scans
- Added SARIF file merging for combined filesystem + container results
- New config option: `containerImages: string[]`

#### Added - Webhook Auto-Scan
- Updated `apps/api/src/scm/webhooks.controller.ts`
- Properly queues scan jobs via QueueService on push/PR events
- Respects `autoScanOnPush` and `autoScanOnPR` config flags
- Branch filtering for configured branches only
- Creates GitHub check runs for PR scans

#### Added - Email Notifications Module
- `apps/api/src/notifications/email/email.service.ts` - Nodemailer integration
- `apps/api/src/notifications/email/email.templates.ts` - HTML/text templates
  - Scan complete notifications
  - Critical finding alerts
  - Team invitation emails
  - Weekly summary emails
- Updated `notifications.service.ts` to send both Slack and email
- New config fields: `emailEnabled`, `emailRecipients`, `weeklyDigestEnabled`

#### Added - Audit Logging Module
- `apps/api/src/audit/audit.module.ts` - Global module
- `apps/api/src/audit/audit.service.ts` - Logging and query service
  - `log()` - Create audit entries
  - `query()` - Paginated log queries
  - `getRecentActivity()` - Recent activity for tenant
  - `getUserActivity()` - Activity for specific user
  - `getResourceHistory()` - History for specific resource
  - `getStats()` - Platform-wide statistics
  - `cleanup()` - Delete old logs
- `apps/api/src/audit/audit.controller.ts` - REST endpoints
- `apps/api/src/audit/audit.service.spec.ts` - Unit tests

#### Added - Rate Limiting
- `apps/api/src/common/throttle/throttle.guard.ts` - Custom throttler guard
- Uses `@nestjs/throttler` with tenant-aware tracking
- Three throttle tiers: short (1s), medium (1m), long (1h)
- Configurable via environment variables

#### Added - Swagger API Documentation
- Updated `apps/api/src/main.ts` with SwaggerModule setup
- API documentation available at `/api/docs`
- Tags for all API groups (auth, scm, scans, findings, etc.)
- Bearer auth support

#### Added - Team Management API
- `apps/api/src/team/team.module.ts` - Module setup
- `apps/api/src/team/team.service.ts` - Business logic
- `apps/api/src/team/team.controller.ts` - REST endpoints
  - `GET /team/users` - List tenant users
  - `POST /team/invite` - Invite user
  - `PUT /team/users/:id/role` - Update role
  - `DELETE /team/users/:id` - Remove user
  - `POST /team/resend-invite/:id` - Resend invitation
- DTOs for invite and role update

#### Added - Unit Tests
- `apps/api/src/audit/audit.service.spec.ts`
- `apps/api/src/notifications/notifications.service.spec.ts`

#### Changed - Prisma Schema
- `ScanConfig` model: Added `enableContainerScan`, `containerImages`, `autoScanOnPush`, `autoScanOnPR`
- `NotificationConfig` model: Added `emailEnabled`, `emailRecipients`, `weeklyDigestEnabled`
- New `AuditLog` model for tracking all actions

#### Changed - Scan Processor
- Updated to include TruffleHog in secrets scanning
- Passes `containerImages` config to Trivy scanner
- Passes `targetUrls` config to Nuclei scanner

#### Dependencies Added
- `@nestjs/throttler` - Rate limiting
- `@nestjs/swagger` - API documentation
- `swagger-ui-express` - Swagger UI
- `nodemailer` - Email sending
- `@types/nodemailer` - TypeScript types

---

## [Previous] - 2024-12-22

### Session 3: Platform Features + Admin Portal

#### Added - Slack Notifications Module
- `apps/api/src/notifications/notifications.module.ts` - Module setup
- `apps/api/src/notifications/notifications.service.ts` - Core notification logic
- `apps/api/src/notifications/notifications.controller.ts` - REST endpoints
- `apps/api/src/notifications/slack/slack.service.ts` - Slack webhook integration
- `apps/api/src/notifications/slack/slack.templates.ts` - Block Kit message templates
- Dashboard API client updated with `notificationsApi`

#### Added - PDF Reporting Module
- `apps/api/src/reporting/reporting.module.ts` - Module setup
- `apps/api/src/reporting/reporting.service.ts` - MinIO storage integration
- `apps/api/src/reporting/reporting.controller.ts` - REST endpoints for PDF downloads
- `apps/api/src/reporting/generators/pdf.generator.ts` - PDFKit report generation
- Dashboard API client updated with `reportsApi`

#### Added - Enhanced RBAC System
- `apps/api/src/libs/auth/permissions/permissions.enum.ts` - Permission and Role enums
- `apps/api/src/libs/auth/permissions/permissions.decorator.ts` - @RequirePermissions decorator
- `apps/api/src/libs/auth/permissions/permissions.guard.ts` - NestJS permission guard
- Role-Permission matrix: viewer, developer, member, security_lead, admin

#### Added - Dashboard Settings Pages
- `apps/dashboard/src/app/dashboard/settings/page.tsx` - Settings redirect
- `apps/dashboard/src/app/dashboard/settings/layout.tsx` - Settings layout with sidebar
- `apps/dashboard/src/app/dashboard/settings/notifications/page.tsx` - Slack config UI
- `apps/dashboard/src/app/dashboard/settings/team/page.tsx` - Team management UI
- `apps/dashboard/src/app/dashboard/settings/profile/page.tsx` - Profile/password UI
- Updated sidebar with Settings navigation link

#### Added - Platform Admin Portal (apps/admin)
- New Next.js 14 application for platform administration
- Login page with platform admin authentication
- Dashboard with system health monitoring (API, DB, Redis, Storage)
- Tenant management CRUD (plans, limits, AI triage settings)
- Platform settings (AI provider/model, API key, maintenance mode)

#### Added - Platform API Backend
- `apps/api/src/platform/platform.module.ts` - Platform module
- `apps/api/src/platform/platform-auth.controller.ts` - Admin login/logout
- `apps/api/src/platform/platform-auth.service.ts` - JWT-based admin auth
- `apps/api/src/platform/platform-tenants.controller.ts` - Tenant CRUD
- `apps/api/src/platform/platform-tenants.service.ts` - Tenant logic with stats
- `apps/api/src/platform/platform-config.controller.ts` - Platform config
- `apps/api/src/platform/platform-config.service.ts` - AI/defaults management
- `apps/api/src/platform/platform-stats.controller.ts` - Stats endpoints
- `apps/api/src/platform/platform-stats.service.ts` - Platform-wide metrics
- `apps/api/src/platform/guards/platform-admin.guard.ts` - Admin route protection
- `apps/api/src/platform/decorators/current-admin.decorator.ts` - Current admin param

#### Changed - Prisma Schema
- `Tenant` model: Added `maxUsers`, `maxRepositories`, `aiTriageEnabled`, `isActive`
- `PlatformConfig` model: Restructured for AI settings, defaults, maintenance mode
- `PlatformAdmin` model: Added `isSuperAdmin`, `lastLoginAt`

---

## [Previous] - 2024-12-21

### Session 2: Multi-Scanner + AI Triage

#### Added - Multiple Security Scanners
- Semgrep scanner (SAST)
- Gitleaks scanner (secrets detection)
- Trivy scanner (container/dependency vulnerabilities)
- Bandit scanner (Python security)
- Gosec scanner (Go security - requires Go installation)
- Checkov scanner (IaC security)
- Nuclei scanner (DAST)

#### Added - AI Triage System
- `apps/api/src/ai/ai.module.ts` - AI module setup
- `apps/api/src/ai/ai.service.ts` - Claude API integration
- `apps/api/src/ai/ai.controller.ts` - Triage endpoints
- Auto-triage after scan completion in scan processor
- Dashboard UI for AI triage with modal display

#### Changed - Finding Model
- Added AI fields: `aiAnalysis`, `aiConfidence`, `aiSeverity`, `aiFalsePositive`
- Added: `aiExploitability`, `aiRemediation`, `aiTriagedAt`, `firstSeenAt`

#### Added - Dashboard AI Triage UI
- AI triage button in findings modal
- Display AI analysis, confidence, exploitability
- Batch triage support

---

## [Initial] - 2024-12-20

### Session 1: Project Foundation

#### Added - Project Structure
- Monorepo with apps/ directory (api, dashboard)
- NestJS API backend with TypeScript
- Next.js 14 dashboard with App Router
- Docker Compose for local development
- PostgreSQL + Redis + MinIO setup

#### Added - Core Modules
- Authentication with JWT + cookies
- Multi-tenant architecture with tenant context
- SCM connections (GitHub OAuth/PAT)
- Repository management
- Scan queue with BullMQ
- Basic Semgrep scanner
- Findings storage and display

#### Added - Dashboard
- Login page
- Dashboard overview with stats
- Connections management
- Repositories list
- Scans history
- Findings list with severity filters
