# ThreatDiviner - Development Handoff Document

## Project Status: Phase 6 Complete

Last Updated: 2024-12-25

---

## Completed Features

### Phase 6 - Multi-SCM & PR Actions (Current Session)

#### Bitbucket Integration
- `apps/api/src/scm/providers/bitbucket.provider.ts`
- Full OAuth 2.0 flow for Bitbucket Cloud
- Repository listing, branches, and commits
- Build status updates (commit statuses)
- PR comments (general and inline)
- Code Insights API for annotations
- Webhook support for push and PR events

#### Azure DevOps Integration
- `apps/api/src/scm/providers/azure-devops.provider.ts`
- OAuth 2.0 and PAT authentication
- Project and repository listing
- Branch and commit operations
- Git status updates
- PR thread comments
- Service hooks for webhooks

#### Fix Module for PR Actions
- `apps/api/src/fix/` - New module
- Apply Fix endpoint (`POST /fix/:findingId`)
  - Reads file from GitHub
  - Applies auto-fix patches
  - Commits to branch
- Apply All Fixes endpoint (`POST /fix/all/:scanId`)
- Dismiss endpoint (`POST /fix/dismiss/:findingId`)
- AI Triage endpoint (`POST /fix/triage/:findingId`)
  - Calls Claude for analysis
  - Posts reply to PR comment
- Triage All endpoint (`POST /fix/triage-all/:scanId`)

#### Schema Updates
- Added `prDiffOnly` to ScanConfig for diff-only mode
- Added `autoFix`, `remediation` to Finding model
- Added `dismissReason`, `dismissedAt` to Finding model
- Added `prCommentId` to Finding model

#### SARIF Upload (Already Implemented)
- GitHub Code Scanning SARIF upload
- GitLab SAST report format conversion
- Bitbucket Code Insights annotations
- Azure DevOps status updates

---

## Architecture Overview

### API (`apps/api`)
- NestJS application
- PostgreSQL database with Prisma ORM
- Redis + BullMQ for job queue
- Modular architecture

### Dashboard (`apps/dashboard`)
- Next.js 14 application
- Tailwind CSS styling
- Recharts for analytics
- All pages functional

### Admin (`apps/admin`)
- Next.js 14 application
- Platform-wide administration

---

## Environment Variables Required

```bash
# Database
DATABASE_URL="postgresql://..."

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# GitLab OAuth
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
GITLAB_URL=https://gitlab.com

# Bitbucket OAuth (NEW)
BITBUCKET_CLIENT_ID=
BITBUCKET_CLIENT_SECRET=

# Azure DevOps OAuth (NEW)
AZURE_DEVOPS_CLIENT_ID=
AZURE_DEVOPS_CLIENT_SECRET=
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/yourorg

# AI Triage
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Notifications
SLACK_WEBHOOK_URL=

# Dashboard URL (for fix redirects)
DASHBOARD_URL=http://localhost:3000
```

---

## API Endpoints Summary

### SCM Connections
- `GET /scm/oauth/:provider` - Get OAuth URL
- `GET /scm/callback/:provider` - OAuth callback
- `GET /scm/connections` - List connections
- `DELETE /scm/connections/:id` - Remove connection

### Fix Actions (NEW)
- `POST /fix/:findingId` - Apply auto-fix
- `POST /fix/all/:scanId` - Apply all fixes
- `POST /fix/dismiss/:findingId` - Dismiss finding
- `POST /fix/triage/:findingId` - AI triage
- `POST /fix/triage-all/:scanId` - Triage all

### Webhooks
- `POST /webhooks/github` - GitHub events
- `POST /webhooks/gitlab` - GitLab events
- `POST /webhooks/bitbucket` - Bitbucket events (NEW)
- `POST /webhooks/azure-devops` - Azure DevOps events (NEW)

---

## Next Steps / Backlog

### High Priority
1. Implement webhook handlers for Bitbucket and Azure DevOps
2. Add PR diff filtering in scan processor
3. Add auto-fix generation using AI

### Medium Priority
1. Implement GitLab SARIF artifact upload
2. Add Bitbucket Code Insights full support
3. Complete Azure DevOps service hooks

### Low Priority
1. GitHub Enterprise support
2. GitLab self-hosted support
3. Bitbucket Server support

---

## Known Issues

1. **Windows encoding**: Semgrep may fail with encoding errors on Windows
2. **Prowler**: Must be installed separately for CSPM
3. **OpenSearch**: Optional; SIEM falls back to in-memory storage
4. **SARIF Upload**: Requires appropriate SCM permissions

---

## Testing

```bash
# Run API tests
cd apps/api && pnpm test

# Run dashboard tests
cd apps/dashboard && pnpm test

# TypeScript check
cd apps/api && npx tsc --noEmit
cd apps/dashboard && npx tsc --noEmit
```

---

## Deployment

```bash
# Development
cd deploy/docker
docker-compose -f docker-compose.dev.yml up -d

# Production
docker-compose up -d
```

---

## Files Modified This Session

### New Files
- `apps/api/src/scm/providers/bitbucket.provider.ts`
- `apps/api/src/scm/providers/azure-devops.provider.ts`
- `apps/api/src/fix/fix.module.ts`
- `apps/api/src/fix/fix.service.ts`
- `apps/api/src/fix/fix.controller.ts`
- `apps/api/src/fix/index.ts`

### Modified Files
- `apps/api/prisma/schema.prisma` - Added fields
- `apps/api/src/scm/providers/index.ts` - Added exports
- `apps/api/src/scm/scm.module.ts` - Added providers
- `apps/api/src/app.module.ts` - Added FixModule

---

## Contact

For questions about the codebase, refer to:
- `/CHANGELOG.md` - Version history
- `/docs/` - Architecture documentation
- Code comments in respective modules
