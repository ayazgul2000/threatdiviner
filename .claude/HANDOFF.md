# ThreatDiviner - Session Handoff

Last updated: 2024-12-22 (Overnight Session)

## Current State

The platform is feature-complete for Phase 2 with all major components implemented:

### Completed Features

1. **Multi-Scanner Security Scanning** (8 scanners total)
   - Semgrep (SAST - multi-language)
   - Bandit (Python SAST)
   - Gosec (Go SAST - requires Go installation)
   - Gitleaks (secrets detection)
   - **TruffleHog** (advanced secrets detection) - NEW
   - Trivy (SCA + container images) - ENHANCED
   - **Checkov** (IaC security) - NEW
   - **Nuclei** (DAST web scanning) - NEW

2. **AI-Powered Triage**
   - Claude API integration for finding analysis
   - Auto-triage after scan completion
   - Manual triage via dashboard
   - Batch triage support

3. **Notifications**
   - Slack webhook integration
   - **Email notifications** (nodemailer) - NEW
     - Scan complete emails
     - Critical finding alerts
     - Team invitation emails
     - Weekly digest support
   - Configurable events (scan start, complete, critical/high findings)

4. **PDF Reporting**
   - Scan reports
   - Repository reports
   - Summary reports
   - MinIO storage integration

5. **Enhanced RBAC**
   - 5 roles: viewer, developer, member, security_lead, admin
   - Granular permissions system
   - Permission guard and decorator

6. **Team Management** - NEW
   - `GET /team/users` - List tenant users
   - `POST /team/invite` - Invite user by email
   - `PUT /team/users/:id/role` - Update user role
   - `DELETE /team/users/:id` - Remove user from tenant
   - `POST /team/resend-invite/:id` - Resend invitation

7. **Profile Management** - NEW
   - `PUT /auth/profile` - Update name, email
   - `PUT /auth/password` - Change password

8. **Webhook Auto-Scan** - NEW
   - Auto-scan on push to configured branches
   - Auto-scan on PR open/sync/reopen
   - Configurable via `autoScanOnPush` and `autoScanOnPR` flags
   - GitHub check run integration

9. **Audit Logging** - NEW
   - Full action tracking (scan, finding, user, config changes)
   - Query and stats endpoints
   - Resource history lookup
   - Automatic cleanup of old logs

10. **Rate Limiting** - NEW
    - Global throttling with `@nestjs/throttler`
    - Per-tenant tracking
    - Configurable limits via env vars

11. **API Documentation** - NEW
    - Swagger UI at `/api/docs`
    - Full OpenAPI spec

12. **Platform Admin Portal**
    - Separate Next.js app at `apps/admin`
    - Platform admin authentication
    - Tenant management (CRUD)
    - System health monitoring
    - AI configuration
    - Maintenance mode

---

## Architecture

```
apps/
├── api/                  # NestJS backend (port 3001)
│   └── src/
│       ├── ai/           # AI triage module
│       ├── audit/        # Audit logging (NEW)
│       ├── auth/         # Tenant auth
│       ├── common/       # Throttle guard (NEW)
│       ├── libs/auth/    # Auth package with RBAC
│       ├── notifications/
│       │   ├── slack/    # Slack integration
│       │   └── email/    # Email integration (NEW)
│       ├── platform/     # Platform admin API
│       ├── prisma/       # Database
│       ├── queue/        # BullMQ job processing
│       ├── reporting/    # PDF generation
│       ├── scanners/
│       │   ├── sast/     # Semgrep, Bandit, Gosec
│       │   ├── sca/      # Trivy (enhanced)
│       │   ├── secrets/  # Gitleaks, TruffleHog (NEW)
│       │   ├── iac/      # Checkov (NEW)
│       │   └── dast/     # Nuclei (NEW)
│       ├── scm/          # GitHub/GitLab integration
│       └── team/         # Team management (NEW)
│
├── dashboard/            # Next.js customer dashboard (port 3000)
│
└── admin/                # Next.js platform admin (port 3002)
```

---

## Database Schema (Key Changes)

```prisma
model ScanConfig {
  // ... existing fields ...
  enableDast          Boolean  @default(false)
  enableContainerScan Boolean  @default(false)  // NEW
  targetUrls          String[] @default([])
  containerImages     String[] @default([])      // NEW
  autoScanOnPush      Boolean  @default(true)    // NEW
  autoScanOnPR        Boolean  @default(true)    // NEW
}

model NotificationConfig {
  // ... existing fields ...
  emailEnabled         Boolean  @default(false)  // NEW
  emailRecipients      String[] @default([])     // NEW
  weeklyDigestEnabled  Boolean  @default(false)  // NEW
}

model AuditLog {  // NEW
  id          String    @id @default(uuid())
  tenantId    String?
  userId      String?
  userEmail   String?
  action      String    // e.g., 'scan.trigger', 'user.invite'
  resource    String    // e.g., 'scan', 'finding', 'user'
  resourceId  String?
  details     Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime  @default(now())
}
```

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/threatdiviner

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key

# AI (Anthropic)
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-20250514

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=threatdiviner

# Email (NEW)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM_ADDRESS=noreply@threatdiviner.com
SMTP_FROM_NAME=ThreatDiviner

# Rate Limiting (NEW)
THROTTLE_SHORT_LIMIT=10    # per second
THROTTLE_MEDIUM_LIMIT=100  # per minute
THROTTLE_LONG_LIMIT=1000   # per hour

# Scanner Paths (optional)
TRUFFLEHOG_PATH=trufflehog
NUCLEI_PATH=nuclei
CHECKOV_PATH=checkov

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

---

## Running the Project

```bash
# Start infrastructure
docker-compose up -d

# API (port 3001)
cd apps/api
pnpm install
npx prisma generate
npx prisma db push  # or: npx prisma migrate dev
pnpm start:dev

# Dashboard (port 3000)
cd apps/dashboard
pnpm install
pnpm dev

# Admin Portal (port 3002)
cd apps/admin
pnpm install
pnpm dev
```

---

## Git Status

**Branch:** `main` (13 commits ahead of origin)

**Latest commit:**
```
4a2fd26 feat: Phase 2 complete - TruffleHog, Trivy container, webhooks, email, audit, rate limiting, Swagger
```

---

## Pending Tasks

### High Priority
1. **Prisma migrate** - Run `npx prisma migrate dev --name phase2_features`
2. **Install scanner binaries** - TruffleHog, Nuclei, Checkov need to be installed
3. **Test end-to-end** - Verify all new features work correctly

### Medium Priority
1. **Weekly digest scheduler** - Add cron job for weekly email summaries
2. **GitLab support** - Extend webhook controller for GitLab events
3. **Dashboard updates** - Add UI for new team management endpoints

### Low Priority
1. **More test coverage** - Expand unit and e2e tests
2. **Performance tuning** - Optimize scan processor for large repos
3. **CI/CD pipeline** - GitHub Actions for build/test/deploy

---

## Notes for Next Session

1. Run `npx prisma migrate dev` to apply schema changes
2. Install scanner binaries:
   ```bash
   pip install trufflehog checkov
   # Nuclei: https://github.com/projectdiscovery/nuclei/releases
   ```
3. Configure SMTP for email notifications
4. Test webhook auto-scan with a real GitHub webhook
5. API docs available at `http://localhost:3001/api/docs`
