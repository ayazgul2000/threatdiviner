# ThreatDiviner - Development Handoff Document

## Project Status: Bug Fixes and Build Verification Complete

Last Updated: 2025-12-25 (Overnight Autonomous Session)

---

## Completed Features (Latest Session)

### Bug Fixes and Build Verification

#### TypeScript Compilation Fixes

**API (`apps/api`)**
- Fixed `rag.service.ts`:
  - Removed unused `ConfigService` import
  - Fixed CWE property access (`potentialMitigations` instead of non-existent `mitigations`)
  - Changed AttackTechnique select to use `include` for proper relation loading
  - Fixed ComplianceControl property names (`name` instead of `title`)
  - Fixed Finding enrichment - using direct fields instead of non-existent `enrichment` relation
- Fixed `vulndb.service.ts`:
  - Fixed AttackTechnique queries to use `id` instead of `techniqueId` (id IS the technique ID)
  - Removed `enrichment` relation include (fields are directly on Finding)
- Added `AttackGroup` model to Prisma schema (was referenced but missing)
- Ran `prisma generate` to update Prisma client

**Dashboard (`apps/dashboard`)**
- Added `secondary` and `destructive` variants to Badge component
- Exported `BadgeVariant` type from badge component
- Fixed `getConfidenceLabel` function to accept `undefined`
- Fixed `SeverityBadge` type assertion for severity prop
- Fixed Date construction with proper null coalescing
- Escaped HTML entities in JSX text (`&quot;`, `&apos;`)
- Extended `Skeleton` component to accept standard div props (style)
- Added jest-dom types to tsconfig

#### Build Verification
- API builds successfully (`nest build`)
- Dashboard builds successfully (`next build`)
- All 33 pages generated successfully
- Static and dynamic routes working properly

---

### Previous Session: RAG Module and Attack Framework Dashboard

#### Phase 1: RAG Module with Qdrant Vector Search
Created `apps/api/src/rag/` module:
- `rag.service.ts` - Main RAG service with indexing and search
  - CWE remediation indexing
  - ATT&CK technique indexing
  - Compliance control indexing
  - Semantic search for remediations
  - AI-powered remediation generation
- `vector-db.service.ts` - Vector database abstraction
  - Qdrant integration for production
  - In-memory fallback for development
  - Cosine similarity search
  - Batch upsert operations
- `embedding.service.ts` - Text embedding service
  - OpenAI embedding API integration
  - Local hash-based fallback
  - Batch embedding support
- `rag.controller.ts` - REST API endpoints
- `rag.module.ts` - NestJS module

#### RAG API Endpoints
- `GET /rag/status` - Get RAG index status
- `POST /rag/index/all` - Index all data sources
- `POST /rag/index/cwe` - Index CWE remediations
- `POST /rag/index/attack` - Index ATT&CK techniques
- `POST /rag/index/compliance` - Index compliance controls
- `GET /rag/search/remediation?q=` - Search remediations
- `GET /rag/search/attack?q=` - Search attack techniques
- `GET /rag/search/compliance?q=` - Search compliance controls
- `GET /rag/remediation/:findingId` - Generate remediation for finding

#### Phase 2: Attack Framework Dashboard Pages
Created dashboard pages in `apps/dashboard/src/app/dashboard/attack/`:
- `page.tsx` - ATT&CK Matrix visualization with heat map
  - Tactic columns with technique cards
  - Finding count indicators
  - Heat coloring based on vulnerability density
- `killchain/page.tsx` - Cyber Kill Chain view
  - 7-stage kill chain visualization
  - Security score calculation
  - Stage status indicators
- `threats/page.tsx` - Threat Actors page
  - APT groups using matching techniques
  - Relevance scoring
  - Search and filter
- `surface/page.tsx` - Attack Surface dashboard
  - Overall exposure score
  - Tactic coverage radar
  - Top vulnerable techniques
  - Kill chain distribution
- `technique/[id]/page.tsx` - Technique detail page
  - Full technique description
  - Detection guidance
  - Mitigations list
  - Threat groups using technique
  - Associated software/malware
  - Your findings mapped to technique

#### Phase 3: VulnDB Dashboard Pages
Created dashboard pages in `apps/dashboard/src/app/dashboard/vulndb/`:
- `page.tsx` - VulnDB overview with stats
- `cve/page.tsx` - CVE search with filters
  - Keyword search
  - Severity filter
  - EPSS score filter
  - KEV only toggle
  - Pagination
- `cwe/page.tsx` - CWE browser
  - Search functionality
  - Detail view with compliance mappings
  - Abstraction level badges
- `owasp/page.tsx` - OWASP Top 10 visualization
  - Year selector
  - Finding counts per category
  - Related CWEs display
- `sync/page.tsx` - Sync status dashboard
  - Source status indicators
  - Manual sync triggers
  - Error display

#### Phase 4: SLA Dashboard
Created `apps/dashboard/src/app/dashboard/sla/page.tsx`:
- Overall compliance percentage
- Compliance by severity with progress bars
- Mean Time to Remediate (MTTR) metrics
- At-risk findings table
- SLA breached findings table

#### Phase 5: Sidebar Navigation Update
Updated `apps/dashboard/src/components/layout/sidebar.tsx`:
- Added ATT&CK Matrix navigation
- Added VulnDB navigation
- Added SLA Dashboard navigation

#### Phase 6: VulnDB Controller Enhancements
Added new endpoints to `vulndb.controller.ts`:
- `GET /vulndb/attack/surface` - Attack surface data
- `GET /vulndb/attack/surface/:repositoryId` - Per-repo attack surface
- `GET /vulndb/attack/groups/relevant` - Relevant threat actors
- `GET /vulndb/attack/killchain` - Kill chain status

Added new methods to `vulndb.service.ts`:
- `getAttackSurface()` - Calculate attack surface metrics
- `getRelevantThreatGroups()` - Find matching APT groups
- `getKillChainStatus()` - Get kill chain stage status

#### Phase 7: Docker Compose Updates
Added Qdrant to `deploy/docker/docker-compose.dev.yml`:
```yaml
qdrant:
  image: qdrant/qdrant:latest
  ports:
    - "6333:6333"
    - "6334:6334"
  volumes:
    - qdrant_dev_data:/qdrant/storage
```

Added Qdrant to `deploy/docker/docker-compose.prod.yml`:
```yaml
qdrant:
  image: qdrant/qdrant:latest
  volumes:
    - qdrant_data:/qdrant/storage
```

Added environment variables:
- `QDRANT_URL` - Qdrant server URL
- `OPENAI_API_KEY` - For embeddings (optional)

---

### Previous Session: VulnDB Integration

#### Phase 1: VulnDB Schema
- Added Prisma models for vulnerability database:
  - `Cve` - CVE records from NVD
  - `Cwe` - CWE records from MITRE
  - `CweComplianceMapping` - CWE to compliance control mappings
  - `ComplianceFramework` / `ComplianceControl`
  - `OwaspTop10` - OWASP Top 10 categories
  - `CisBenchmark` / `NistControl`
  - `AttackTactic` / `AttackTechnique` - MITRE ATT&CK
  - `CapecPattern` - CAPEC attack patterns
  - `DataSyncStatus` - Sync tracking
- Updated `Finding` model with enrichment fields

#### Phase 2: Data Sync Services
Created sync services in `apps/api/src/vulndb/sync/`:
- `nvd-sync.service.ts` - NVD CVE sync (API 2.0)
- `cwe-sync.service.ts` - MITRE CWE XML sync
- `epss-sync.service.ts` - FIRST EPSS scores
- `kev-sync.service.ts` - CISA KEV catalog
- `owasp-sync.service.ts` - OWASP Top 10 2021 (static data)
- `cwe-mapping-sync.service.ts` - CWE to compliance mappings
- `attack-sync.service.ts` - MITRE ATT&CK STIX sync

#### Phase 3: VulnDB Module
- `apps/api/src/vulndb/vulndb.service.ts` - Core VulnDB service
  - CVE/CWE/OWASP/ATT&CK lookups
  - Search and filtering
  - Finding enrichment
  - Risk score calculation
- `apps/api/src/vulndb/vulndb.controller.ts` - REST API endpoints
- `apps/api/src/vulndb/vulndb.module.ts` - NestJS module

#### Phase 4: Scheduled Sync Jobs
- `apps/api/src/vulndb/vulndb-scheduler.service.ts`
  - Daily CVE sync (last 7 days) at 2 AM UTC
  - Daily EPSS sync at 3 AM UTC
  - Daily KEV sync at 4 AM UTC
  - Weekly CWE sync (Sunday 1 AM UTC)
  - Weekly ATT&CK sync (Sunday 5 AM UTC)
  - Monthly full CVE sync (1st at midnight)
  - Configurable via `VULNDB_SCHEDULED_SYNC` env var

#### Phase 5: Finding Enrichment
- `apps/api/src/vulndb/finding-enrichment.service.ts`
  - Auto-enrich findings with CVE/CWE data
  - Add OWASP category mappings
  - Add compliance control references
  - Add ATT&CK technique mappings
  - Calculate risk scores (CVSS + EPSS + KEV boost)
- Enrichment endpoints in controller

#### Phase 8: Extended Compliance Frameworks
Enhanced `cwe-mapping-sync.service.ts` with:
- 40+ CWE mappings (up from 20)
- NIST CSF framework controls
- FedRAMP controls
- OWASP ASVS controls
- Extended mappings for all OWASP Top 10 categories

#### Phase 10: SLA Tracking
- `apps/api/src/vulndb/sla.service.ts`
  - Severity-based SLA policies:
    - Critical: 7 days (escalation: 3 days)
    - High: 30 days (escalation: 14 days)
    - Medium: 90 days (escalation: 45 days)
    - Low: 180 days (escalation: 90 days)
    - KEV: 14 days (CISA BOD compliant)
  - SLA status calculation (on_track/at_risk/breached)
  - Summary by tenant and severity
  - At-risk and breached finding queries
  - MTTR (Mean Time To Remediation) calculation
  - Daily SLA check cron job (8 AM UTC)

### VulnDB API Endpoints

#### CVE Endpoints
- `GET /vulndb/cve/:id` - Get CVE by ID
- `GET /vulndb/cve` - Search CVEs (keyword, severity, isKev, minEpss, cweId)
- `GET /vulndb/cve/recent` - Recent CVEs
- `GET /vulndb/cve/kev` - KEV CVEs
- `GET /vulndb/cve/high-epss` - High EPSS CVEs

#### CWE Endpoints
- `GET /vulndb/cwe/:id` - Get CWE with compliance mappings
- `GET /vulndb/cwe` - Search CWEs

#### OWASP Endpoints
- `GET /vulndb/owasp` - OWASP Top 10 (by year)
- `GET /vulndb/owasp/:id` - OWASP category details

#### ATT&CK Endpoints
- `GET /vulndb/attack/tactics` - All tactics with techniques
- `GET /vulndb/attack/techniques/:id` - Technique details
- `GET /vulndb/attack/techniques` - Search techniques

#### Compliance Endpoints
- `GET /vulndb/compliance/cwe/:cweId` - Controls for CWE
- `GET /vulndb/compliance/framework/:frameworkId/cwes` - CWEs for framework

#### Sync Endpoints
- `GET /vulndb/sync/status` - Sync status for all sources
- `GET /vulndb/stats` - VulnDB statistics
- `POST /vulndb/sync/nvd` - Trigger NVD sync
- `POST /vulndb/sync/cwe` - Trigger CWE sync
- `POST /vulndb/sync/epss` - Trigger EPSS sync
- `POST /vulndb/sync/kev` - Trigger KEV sync
- `POST /vulndb/sync/owasp` - Trigger OWASP sync
- `POST /vulndb/sync/attack` - Trigger ATT&CK sync
- `POST /vulndb/sync/all` - Sync all sources

#### Enrichment Endpoints
- `POST /vulndb/enrichment/scan/:scanId` - Enrich all findings in scan
- `POST /vulndb/enrichment/finding/:findingId` - Enrich single finding
- `POST /vulndb/enrichment/batch` - Batch enrich unenriched findings
- `GET /vulndb/findings/kev` - Get KEV findings
- `GET /vulndb/findings/high-risk` - Get high EPSS findings
- `GET /vulndb/findings/compliance/:frameworkId` - Findings by framework

#### SLA Endpoints
- `GET /vulndb/sla/policies` - Get SLA policies
- `GET /vulndb/sla/summary` - Tenant SLA summary
- `GET /vulndb/sla/summary/by-severity` - SLA by severity
- `GET /vulndb/sla/at-risk` - Findings approaching SLA
- `GET /vulndb/sla/breached` - SLA breached findings
- `GET /vulndb/sla/mttr` - Mean time to remediation

---

## Previous Session

### Phase 15-18 - Polish & Verification

- All TypeScript compiles cleanly
- Deployment configs updated with new environment variables
- Documentation completed

### Phase 14 - Deployment Configs

#### Docker Compose Production
- `deploy/docker/docker-compose.prod.yml` - Updated with all environment variables
  - Cache configuration
  - OAuth providers (GitHub, GitLab, Bitbucket, Azure DevOps)
  - Notification webhooks (Slack, Teams, Discord, PagerDuty, OpsGenie)
  - AI configuration

#### Kubernetes Manifests
- `deploy/k8s/configmap.yaml` - Added cache and AI config
- `deploy/k8s/secrets.yaml` - Added all OAuth and notification secrets

#### Environment Template
- `deploy/docker/.env.example` - Comprehensive environment template

### Phase 13 - Documentation

#### API Documentation
- `docs/API.md` - Full REST API reference
  - Authentication endpoints
  - Repository management
  - Scan operations
  - Findings management
  - Fix actions (triage, auto-fix, dismiss)
  - Compliance endpoints
  - Export endpoints
  - CLI integration
  - Webhook receivers

#### Deployment Guide
- `docs/DEPLOYMENT.md` - Complete deployment documentation
  - Local development setup
  - Docker Compose deployment
  - Kubernetes deployment
  - CI/CD integration examples
  - Scaling considerations
  - Backup and recovery

#### CLI Guide
- `docs/CLI.md` - CLI tool documentation
  - Installation
  - Configuration
  - Commands (upload, baseline, scan, status)
  - CI/CD integration examples (GitHub Actions, GitLab CI, Azure DevOps, Jenkins, CircleCI)

#### Architecture Documentation
- `docs/ARCHITECTURE.md` - System architecture
  - Component overview
  - Data flow diagrams
  - Database schema
  - Caching strategy
  - Security model
  - Queue architecture
  - Compliance engine details

### Phase 12 - Testing

#### Unit Tests Created
- `apps/api/src/compliance/compliance.service.spec.ts` - Compliance scoring tests
- `apps/api/src/cache/cache.service.spec.ts` - Cache service tests
- `apps/api/src/common/security/sanitize.service.spec.ts` - Security sanitization tests
- `apps/api/src/fix/fix.service.spec.ts` - Fix service tests

### Phase 11 - Security Hardening

#### Security Module
- `apps/api/src/common/security/sanitize.service.ts` - Input sanitization service
  - XSS prevention
  - SQL injection pattern detection (for logging)
  - Path traversal prevention
  - SSRF URL validation
  - Email/UUID validation
  - Deep object sanitization
- `apps/api/src/common/security/security.middleware.ts` - Request security middleware
  - Suspicious pattern detection and logging
  - Additional security headers
  - Request sanitization

### Phase 10 - Performance & Caching

#### Cache Module
- `apps/api/src/cache/cache.service.ts` - Redis/in-memory caching
  - Get/Set/Delete operations
  - Pattern-based deletion
  - getOrSet helper for cache-aside pattern
  - Tenant/Repository/Scan invalidation
  - Redis fallback to in-memory

### Phase 9 - Reports & Export

#### Enhanced Export Service
- SBOM (Software Bill of Materials) export in CycloneDX format
- Component extraction from vulnerability findings
- Package type detection

#### Compliance PDF Generator
- `apps/api/src/reporting/generators/compliance-pdf.generator.ts`
- Framework-specific compliance reports
- Control status visualization
- Violation details

### Phase 8 - Notifications Expansion

#### Microsoft Teams Integration
- `apps/api/src/notifications/teams/teams.service.ts`
- MessageCard format support
- Scan completed notifications
- Critical finding alerts

#### Discord Integration
- `apps/api/src/notifications/discord/discord.service.ts`
- Rich embeds support
- Scan and finding notifications

#### PagerDuty Integration
- `apps/api/src/notifications/pagerduty/pagerduty.service.ts`
- Events API v2 support
- Alert triggering and resolution
- Deduplication keys

#### OpsGenie Integration
- `apps/api/src/notifications/opsgenie/opsgenie.service.ts`
- Alert creation and closing
- Priority mapping
- Custom details support

### Phase 7 - Compliance Dashboards

#### Compliance Module
- `apps/api/src/compliance/compliance.module.ts`
- `apps/api/src/compliance/compliance.service.ts`
- `apps/api/src/compliance/compliance.controller.ts`
- `apps/api/src/compliance/frameworks.ts` - Framework definitions

#### Supported Frameworks
- SOC 2 Type II
- PCI DSS 4.0
- HIPAA Security Rule
- GDPR
- ISO 27001:2022

#### Features
- CWE to control mapping
- Category-based control inference
- Compliance score calculation
- Control violation tracking
- Trend analysis
- Compliance report generation

### Phase 6 - Auto-Fix Implementation

#### Enhanced Fix Service
- AI-powered auto-fix generation using Claude
- File content fetching for context
- Fix preview without applying
- Fix status endpoint

### Phase 5 - CLI Tool Enhancements

#### CLI Commands
- `packages/cli/src/commands/upload.ts` - SARIF upload
- `packages/cli/src/commands/baseline.ts` - Baseline management
- `packages/cli/src/utils/auth.ts` - API configuration

#### CLI API Module
- `apps/api/src/cli/cli.module.ts`
- `apps/api/src/cli/cli.service.ts`
- `apps/api/src/cli/cli.controller.ts`

### Phase 4 - Webhook Handlers for All Providers

#### Enhanced Webhooks Controller
- GitLab webhook handler (merge_request, push)
- Bitbucket webhook handler (pullrequest:*, repo:push)
- Azure DevOps webhook handler (git.pullrequest.*)
- Unified enqueueScan helper

### Phase 3 - Complete SARIF Integration

#### Multi-Provider SARIF Upload
- `apps/api/src/scm/services/sarif-upload.service.ts`
- GitHub Code Scanning API
- GitLab SAST integration
- Bitbucket Code Insights
- Azure DevOps build status

### Phase 2 - PR Diff-Only Mode

#### Diff Filter Service
- `apps/api/src/scanners/services/diff-filter.service.ts`
- Unified diff parsing
- Finding filtering by changed lines
- Context line support
- Diff caching

#### Integration
- `apps/api/src/queue/processors/scan.processor.ts` - Diff filter integration
- `apps/api/src/scm/providers/github.provider.ts` - getPullRequestDiff method

### Phase 1 - Pipeline Module

#### Pipeline Gates
- `apps/api/src/pipeline/pipeline.module.ts`
- Already existing service and controller integrated

---

## Architecture Overview

### API (`apps/api`)
- NestJS application
- PostgreSQL database with Prisma ORM
- Redis + BullMQ for job queue
- Redis caching (with in-memory fallback)
- Modular architecture

### Dashboard (`apps/dashboard`)
- Next.js 14 application
- Tailwind CSS styling
- Recharts for analytics
- All pages functional

### CLI (`packages/cli`)
- Commander.js CLI tool
- SARIF upload
- Baseline management
- CI/CD integration

---

## Environment Variables Required

```bash
# Database
DATABASE_URL="postgresql://..."

# Redis (for Queue and Cache)
REDIS_URL=redis://localhost:6379

# Cache Configuration
CACHE_TTL_SECONDS=300
CACHE_KEY_PREFIX=td:

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# GitLab OAuth
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
GITLAB_URL=https://gitlab.com

# Bitbucket OAuth
BITBUCKET_CLIENT_ID=
BITBUCKET_CLIENT_SECRET=

# Azure DevOps OAuth
AZURE_DEVOPS_CLIENT_ID=
AZURE_DEVOPS_CLIENT_SECRET=
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/yourorg

# AI Features
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# RAG / Vector Search
QDRANT_URL=http://localhost:6333
OPENAI_API_KEY=
EMBEDDING_MODEL=text-embedding-3-small
VECTOR_SIZE=1536

# Notifications
SLACK_WEBHOOK_URL=
TEAMS_WEBHOOK_URL=
DISCORD_WEBHOOK_URL=
PAGERDUTY_ROUTING_KEY=
OPSGENIE_API_KEY=

# Dashboard URL (for redirects)
DASHBOARD_URL=http://localhost:3000
```

---

## API Endpoints Summary

### Compliance
- `GET /compliance/frameworks` - List frameworks
- `GET /compliance/score` - Tenant compliance score
- `GET /compliance/score/:repositoryId` - Repository score
- `GET /compliance/violations/:frameworkId` - Control violations
- `GET /compliance/trend/:frameworkId` - Score trend
- `GET /compliance/report/:frameworkId` - Generate report

### Fix Actions
- `POST /fix/:findingId` - Apply auto-fix
- `POST /fix/all/:scanId` - Apply all fixes
- `POST /fix/dismiss/:findingId` - Dismiss finding
- `POST /fix/triage/:findingId` - AI triage
- `POST /fix/triage-all/:scanId` - Triage all
- `POST /fix/generate/:findingId` - Generate fix preview
- `GET /fix/status/:findingId` - Get fix status

### CLI
- `POST /cli/upload` - Upload SARIF
- `POST /cli/register-scan` - Register scan

### Export
- `GET /export/findings` - Export findings (CSV/JSON)
- `GET /export/scans` - Export scans
- `GET /export/repositories` - Export repositories
- `GET /export/audit-logs` - Export audit logs
- `GET /export/sarif/:scanId` - Export as SARIF
- `GET /export/sbom/:repositoryId` - Export SBOM (CycloneDX)

### Webhooks
- `POST /webhooks/github` - GitHub events
- `POST /webhooks/gitlab` - GitLab events
- `POST /webhooks/bitbucket` - Bitbucket events
- `POST /webhooks/azure-devops` - Azure DevOps events

---

## Module Dependencies

```
AppModule
├── ConfigModule (Global)
├── ThrottlerModule
├── CustomBullModule
├── PrismaModule
├── CacheModule (Global)
├── SecurityModule (Global)
├── AuditModule
├── AuthModule
├── ScmModule
├── QueueModule
├── ScannersModule
├── AiModule
├── NotificationsModule (expanded)
├── ReportingModule
├── PlatformModule
├── TeamModule
├── SchedulerModule
├── JiraModule
├── ExportModule
├── BaselineModule
├── ApiKeysModule
├── RetentionModule
├── CspmModule
├── SiemModule
├── DashboardModule
├── AnalyticsModule
├── FixModule
├── PipelineModule
├── CliModule
├── ComplianceModule
├── VulnDbModule
│   ├── VulnDbService
│   ├── FindingEnrichmentService
│   ├── SlaService
│   ├── VulnDbSchedulerService
│   └── Sync Services (NVD, CWE, EPSS, KEV, OWASP, ATT&CK)
└── RagModule ← NEW (Latest Session)
    ├── RagService
    ├── VectorDbService
    └── EmbeddingService
```

---

## Files Modified This Session

### New Files
- `apps/api/src/compliance/` - Full module
- `apps/api/src/cache/` - Full module
- `apps/api/src/common/security/` - Security module
- `apps/api/src/cli/` - CLI API module
- `apps/api/src/notifications/teams/` - Teams integration
- `apps/api/src/notifications/discord/` - Discord integration
- `apps/api/src/notifications/pagerduty/` - PagerDuty integration
- `apps/api/src/notifications/opsgenie/` - OpsGenie integration
- `apps/api/src/scanners/services/diff-filter.service.ts`
- `apps/api/src/reporting/generators/compliance-pdf.generator.ts`
- `packages/cli/src/commands/upload.ts`
- `packages/cli/src/commands/baseline.ts`
- `packages/cli/src/utils/auth.ts`

### Modified Files
- `apps/api/src/app.module.ts` - Added new modules
- `apps/api/src/ai/ai.service.ts` - Added generateAutoFix
- `apps/api/src/fix/fix.service.ts` - Enhanced with AI fix generation
- `apps/api/src/fix/fix.controller.ts` - New endpoints
- `apps/api/src/scm/webhooks.controller.ts` - All provider handlers
- `apps/api/src/scm/services/sarif-upload.service.ts` - Multi-provider
- `apps/api/src/queue/processors/scan.processor.ts` - Diff filtering
- `apps/api/src/export/export.service.ts` - SBOM export
- `apps/api/src/notifications/notifications.module.ts` - New providers

---

## All Phases Complete

All 18 phases of the ThreatDiviner build have been completed:
- Phase 1-11: Core features implemented
- Phase 12: Unit tests created for new modules
- Phase 13: Full documentation suite created
- Phase 14: Deployment configs updated
- Phase 15-18: Verification and polish complete

The application is ready for deployment and testing.

---

## Contact

For questions about the codebase, refer to:
- `/CHANGELOG.md` - Version history
- `/docs/` - Architecture documentation
- Code comments in respective modules
