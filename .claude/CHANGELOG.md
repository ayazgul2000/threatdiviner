# ThreatDiviner - Changelog

## 2025-12-19 Session 1
**Completed:**
- Scaffolded fresh Next.js 14.1.0 with create-next-app to fix ActionQueueContext bug
- Used: `npx create-next-app@14.1.0 dashboard --typescript --tailwind --eslint --app --src-dir --use-pnpm`
- Clean scaffold ensures all Next.js internals are properly aligned
- Moved auth module from @altaniche/auth symlink to local libs folder
- Copied all auth files to `apps/api/src/libs/auth/`
- Removed external package dependency
- Updated all imports to use local auth module
- Fixed TypeScript type compatibility issues with @nestjs/jwt
- Verified login endpoint works with local auth

**Result:**
- Dashboard running successfully at localhost:3000
- API auth working with local libs/auth module

**Note:** Next.js 14.1.0 has a security advisory (see nextjs.org/blog/security-update-2025-12-11) - will need to upgrade once hydration issue is resolved in newer versions

**Next:** Protected routes, dashboard login page integration

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
