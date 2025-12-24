# Changelog

All notable changes to ThreatDiviner will be documented in this file.

## [Unreleased] - Phase 6 (2024-12-25)

### Added

#### Bitbucket Integration
- BitbucketProvider with full OAuth 2.0 support
- Repository listing and branch management
- Build status updates via commit statuses
- PR comments (general and inline)
- Code Insights API for security annotations
- Webhook support for push and PR events

#### Azure DevOps Integration
- AzureDevOpsProvider with OAuth/PAT authentication
- Multi-project repository listing
- Git status updates for commits
- PR thread comments with inline support
- Service hooks integration for webhooks

#### Fix Module for PR Actions
- New `/fix` module for PR-based security actions
- Apply Fix endpoint - commits auto-fix patches
- Apply All Fixes - batch fix application
- Dismiss endpoint - dismiss findings from PR
- AI Triage endpoint - Claude-powered analysis with PR reply
- Triage All - batch AI triage with summary

#### Schema Enhancements
- Added `prDiffOnly` to ScanConfig for diff-only scanning
- Added `autoFix`, `remediation` fields to Finding model
- Added `dismissReason`, `dismissedAt` for dismissal tracking
- Added `prCommentId` for PR comment linking

### Changed
- Updated SCM module to include Bitbucket and Azure DevOps providers
- Updated app.module.ts to include FixModule

---

## [Phase 5] - 2024-12-24

### Added
- Dashboard API modules for overview stats
- Analytics module with scan/finding trends
- Dashboard module for overview metrics

### Fixed
- Dashboard hydration issues with Next.js 14.1.0

---

## [Phase 4] - 2024-12-23

### Added

#### OWASP ZAP DAST Integration
- ZapScanner service with baseline, full, and API scan modes
- Docker container execution support for ZAP scans
- Local ZAP installation detection and execution
- ZAP JSON report parsing with normalized findings
- Authentication configuration support for authenticated scans

#### CSPM Module (Cloud Security Posture Management)
- Multi-cloud support for AWS, Azure, and GCP
- CloudAccount Prisma model for storing cloud credentials
- CspmFinding Prisma model for cloud security findings
- AWS provider with credential validation
- Azure provider with service principal authentication
- GCP provider with service account support
- Prowler scanner integration for CSPM assessments
- Compliance framework tracking (CIS, SOC2, HIPAA, PCI-DSS)

#### SIEM-Lite Module
- Security event recording and indexing service
- OpenSearch integration with automatic fallback to in-memory storage
- Alert rules with threshold-based triggering
- AlertRule and AlertHistory Prisma models
- Event search with severity and source filtering
- Dashboard aggregation endpoints
- Threat intelligence summary generation
- Export functionality for compliance/audit (JSON/CSV)

#### Production Infrastructure
- Multi-stage Dockerfiles for API, Dashboard, and Admin apps
- Docker Compose production configuration with health checks
- Docker Compose development configuration
- Nginx reverse proxy with SSL/TLS termination
- Nginx rate limiting and security headers
- Kubernetes namespace and resource manifests
- Kubernetes deployments with anti-affinity rules
- Kubernetes Ingress with cert-manager integration
- Kubernetes ConfigMaps and Secrets templates
- StatefulSets for PostgreSQL and Redis with persistent storage

#### Testing Infrastructure
- Unit tests for AI triage service
- Unit tests for notification service
- Unit tests for queue service
- Unit tests for Semgrep scanner
- Unit tests for Prisma service
- E2E tests for authentication endpoints
- E2E tests for scan endpoints
- E2E tests for findings endpoints
- E2E tests for API key endpoints
- Dashboard component tests with Jest and React Testing Library
- Tests for Button, Card, Badge, Table, and Modal components

### Security

#### Hardening Improvements
- Added Helmet middleware for security headers (CSP, XSS protection, HSTS)
- Fixed SQL injection vulnerability in PrismaService tenant context
- Added UUID validation for tenant IDs
- Added command injection protection in LocalExecutorService
- Implemented command allowlist for scanner execution
- Added dangerous character filtering for command arguments
- Added argument length limits to prevent buffer overflow attacks

### Changed
- Updated scanners module to include ZapScanner
- Updated app.module.ts to include CSPM and SIEM modules
- Updated Prisma schema with new CSPM and SIEM models

### Known Issues
- Semgrep may fail with encoding errors on Windows systems
- Prowler CLI must be installed separately for CSPM scanning
- OpenSearch is optional; SIEM falls back to in-memory storage

---

## [Phase 3] - 2024-12-22

### Added
- Scheduled scans with cron expression support
- PR inline comments for GitHub and GitLab
- Check run annotations for CI/CD integration
- Jira integration with automatic ticket creation
- API key authentication with scoped permissions
- Finding baselines for suppression management
- Data retention policies with automatic cleanup
- CSV, JSON, and SARIF export functionality

---

## [Phase 2] - 2024-12-21

### Added
- GitLab SCM integration
- GitHub SCM integration with OAuth
- AI-powered triage with Claude
- Slack notifications
- Email notifications
- PDF report generation with MinIO storage
- Audit logging with retention

---

## [Phase 1] - Initial Release

### Added
- Multi-tenant architecture with Row Level Security
- OAuth authentication (GitHub, GitLab) + PAT support
- Semgrep SAST scanner (multi-language)
- Bandit Python SAST scanner
- Gosec Go SAST scanner
- Gitleaks secrets detection
- TruffleHog advanced secrets scanning
- Trivy SCA and container scanning
- Checkov IaC security scanning
- Nuclei DAST web scanning
- BullMQ job queue for scan processing
- Team management with RBAC
- Rate limiting with throttler
