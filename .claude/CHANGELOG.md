# ThreatDiviner - Changelog

## 2025-12-19 Session 1
**Completed:**
- Fixed dashboard hydration error completely
- Pinned exact versions: Next.js 14.1.0, React 18.2.0, React-DOM 18.2.0
- Removed ESLint deps (not needed for core functionality)
- Clean reinstall of node_modules

**Result:** Dashboard running successfully at localhost:3000

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
