# ThreatDiviner - Handoff

## Current Task
**Feature 1: Platform Core — Setup Docker Compose + Base Services**

## Status
🟡 NOT STARTED

## Owner
CLI (pending handoff)

## Task Breakdown
- [ ] Create Docker Compose with Postgres, Redis, MinIO, Qdrant
- [ ] NestJS API scaffold with health check
- [ ] Next.js dashboard scaffold with health check
- [ ] PostgreSQL schema: tenants, users, base tables
- [ ] RLS policies for tenant isolation
- [ ] JWT auth module (register, login, refresh)
- [ ] Tenant middleware (set session context)
- [ ] Seed script: 2-3 test tenants + users
- [ ] Verify full stack runs locally

## Blockers
None

## Next Steps
1. CLI to scaffold Docker Compose
2. CLI to create NestJS API boilerplate
3. CLI to create Next.js dashboard boilerplate
4. GUI to review, Ayaz to test

## Notes for CLI
- Use pnpm as package manager
- NestJS with strict TypeScript
- Next.js App Router (not Pages)
- Postgres port: 5432
- Redis port: 6379
- API port: 3001
- Dashboard port: 3000
- MinIO port: 9000 (console: 9001)
- Qdrant port: 6333

## Completed This Session
(none yet)

---
*Format: Update after each work block with DONE / NEXT / BLOCKED*
