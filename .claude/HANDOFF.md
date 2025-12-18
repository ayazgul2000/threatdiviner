# ThreatDiviner - Handoff

## Current Task
**Feature 1: Platform Core — Auth Module (Local)**

## Status
🟢 AUTH MODULE COMPLETE (LOCAL COPY)

## Owner
CLI

## Task Breakdown
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

## Blockers
None

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

### Usage in ThreatDiviner
```typescript
// apps/api/src/auth/auth.module.ts
import { AuthModule as LocalAuthModule } from '../libs/auth';

@Module({
  imports: [
    LocalAuthModule.registerAsync({
      imports: [ConfigModule, PrismaModule],
      inject: [ConfigService, PrismaService],
      useFactory: (config, prisma) => ({
        jwtSecret: config.get('JWT_SECRET'),
        jwtRefreshSecret: config.get('JWT_REFRESH_SECRET'),
        multiTenant: true,
        userRepository: new UserRepository(prisma),
        tenantRepository: new TenantRepository(prisma),
        setTenantContext: (tenantId) => prisma.setTenantContext(tenantId),
      }),
    }),
  ],
})
export class AuthModule {}
```

## Auth Endpoints
| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | /auth/register | Register new user | No |
| POST | /auth/login | Login, returns tokens in cookies | No |
| POST | /auth/refresh | Refresh access token | Refresh cookie |
| POST | /auth/logout | Clear auth cookies | No |
| GET | /auth/profile | Get current user profile | Yes |
| GET | /auth/me | Alias for profile | Yes |

### Test Credentials
| Tenant | Email | Password | Role |
|--------|-------|----------|------|
| acme-corp | admin@acme.com | admin123 | admin |
| acme-corp | dev@acme.com | dev123 | member |
| beta-inc | admin@beta.io | admin123 | admin |
| beta-inc | dev@beta.io | dev123 | member |

### Test Commands
```bash
# Login
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"admin123","tenantSlug":"acme-corp"}'
```

## Database Configuration

### Connection
```
Host: localhost
Port: 5433 (mapped to internal 5432)
Database: threatdiviner
User: postgres
Password: threatdiviner_dev
```

### RLS Policies
- `tenant_isolation_policy` on tenants
- `user_tenant_isolation_policy` on users
- `superuser_bypass_*` policies for admin access
- Function: `set_tenant_context(tenant_id TEXT)`

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
1. Protected routes with role-based guards
2. Dashboard login page integration
3. API key management for external integrations

## Files Structure

### Auth Module (Local)
```
apps/api/src/libs/auth/
├── index.ts
├── auth.module.ts
├── auth.service.ts
├── auth.controller.ts
├── auth.constants.ts
├── jwt.strategy.ts
├── interfaces/
│   ├── index.ts
│   └── auth-config.interface.ts
├── dto/
│   ├── index.ts
│   ├── login.dto.ts
│   └── register.dto.ts
├── decorators/
│   ├── index.ts
│   ├── current-user.decorator.ts
│   ├── roles.decorator.ts
│   └── public.decorator.ts
├── guards/
│   ├── index.ts
│   ├── jwt-auth.guard.ts
│   └── roles.guard.ts
└── middleware/
    ├── index.ts
    └── tenant.middleware.ts
```

### ThreatDiviner Auth (imports local auth)
```
apps/api/src/auth/
├── auth.module.ts              # Imports ../libs/auth
└── repositories/
    ├── index.ts
    ├── user.repository.ts      # Implements IUserRepository
    └── tenant.repository.ts    # Implements ITenantRepository
```

### Database Files
```
apps/api/
├── .env
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
└── src/prisma/
    └── prisma.service.ts
```

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
```

---
*Last updated: 2025-12-19 (auth moved to local) — CLI Session*
