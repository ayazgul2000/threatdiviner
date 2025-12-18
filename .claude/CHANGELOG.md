# ThreatDiviner - Changelog

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
