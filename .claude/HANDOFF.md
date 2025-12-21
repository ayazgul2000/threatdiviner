# ThreatDiviner - Session Handoff

Last updated: 2024-12-22

## Current State

The platform is feature-complete for Phase 1 with all major components implemented:

### Completed Features

1. **Multi-Scanner Security Scanning**
   - Semgrep (SAST)
   - Gitleaks (secrets)
   - Trivy (containers/dependencies)
   - Bandit (Python)
   - Gosec (Go - requires Go installation)

2. **AI-Powered Triage**
   - Claude API integration for finding analysis
   - Auto-triage after scan completion
   - Manual triage via dashboard
   - Batch triage support

3. **Slack Notifications**
   - Webhook integration
   - Configurable events (scan start, complete, critical/high findings)
   - Block Kit message templates

4. **PDF Reporting**
   - Scan reports
   - Repository reports
   - Summary reports
   - MinIO storage integration

5. **Enhanced RBAC**
   - 5 roles: viewer, developer, member, security_lead, admin
   - Granular permissions system
   - Permission guard and decorator

6. **Dashboard Settings**
   - Notification configuration
   - Team management (UI ready, API TODO)
   - Profile/password management (UI ready, API TODO)

7. **Platform Admin Portal**
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
│       ├── auth/         # Tenant auth
│       ├── libs/auth/    # Auth package with RBAC
│       ├── notifications/ # Slack notifications
│       ├── platform/     # Platform admin API
│       ├── prisma/       # Database
│       ├── queue/        # BullMQ job processing
│       ├── reporting/    # PDF generation
│       ├── scanners/     # Security scanners
│       └── scm/          # GitHub/GitLab integration
│
├── dashboard/            # Next.js customer dashboard (port 3000)
│   └── src/
│       └── app/dashboard/
│           ├── connections/
│           ├── repositories/
│           ├── scans/
│           ├── findings/
│           └── settings/
│
└── admin/                # Next.js platform admin (port 3002)
    └── src/
        └── app/
            ├── login/
            └── (dashboard)/
                ├── tenants/
                └── settings/
```

---

## Database Schema (Key Models)

```prisma
model Tenant {
  id               String   @id
  name             String
  slug             String   @unique
  plan             String   // free, pro, enterprise
  maxUsers         Int
  maxRepositories  Int
  aiTriageEnabled  Boolean
  isActive         Boolean
}

model Finding {
  // ... standard fields ...
  aiAnalysis       String?
  aiConfidence     Float?
  aiSeverity       String?
  aiFalsePositive  Boolean?
  aiExploitability String?
  aiRemediation    String?
  aiTriagedAt      DateTime?
}

model PlatformConfig {
  aiProvider             String
  aiModel                String
  aiApiKey               String?
  defaultPlan            String
  defaultMaxUsers        Int
  defaultMaxRepositories Int
  maintenanceMode        Boolean
}

model PlatformAdmin {
  email        String   @unique
  passwordHash String
  name         String
  isSuperAdmin Boolean
  lastLoginAt  DateTime?
}
```

---

## Pending Tasks

### High Priority
1. **Gosec binary installation** - Requires Go to be installed
2. **Prisma migrate** - Run `npx prisma migrate dev` after stopping API
3. **Team management API** - Backend endpoints for inviting/managing users
4. **Profile update API** - Backend endpoints for profile/password changes

### Medium Priority
1. **User model enhancements** - Add `name`, `status`, `lastLoginAt` fields
2. **Invitation system** - Email-based team member invitations
3. **Webhook events** - GitHub/GitLab webhook handlers for auto-scan

### Low Priority
1. **Rate limiting** - Add rate limits to API endpoints
2. **Audit logging** - Track admin actions
3. **Email notifications** - Alternative to Slack

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
npx prisma db push
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

Uncommitted changes in:
- `apps/` - All new code
- `docker-compose.yml`

Consider committing with:
```bash
git add apps/ docker-compose.yml
git commit -m "feat: complete phase 1 - multi-scanner, AI triage, notifications, reporting, RBAC, admin portal"
```

---

## Notes for Next Session

1. Run `npx prisma migrate dev` to apply schema changes
2. Create initial platform admin:
   ```typescript
   await prisma.platformAdmin.create({
     data: {
       email: 'admin@example.com',
       passwordHash: await bcrypt.hash('password', 10),
       name: 'Admin',
       isSuperAdmin: true,
     }
   });
   ```
3. Install Go for Gosec scanner if needed
4. Test all features end-to-end before production
