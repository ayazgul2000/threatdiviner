# ThreatDiviner - Architecture Decision Records

## ADR-001: Multi-Tenant Strategy
**Date:** 2025-01-XX
**Status:** Accepted
**Decision:** Single PostgreSQL database with Row-Level Security (RLS)
**Context:** Need to support multiple customers in isolated fashion
**Options Considered:**
1. Separate database per tenant — Max isolation, high ops overhead
2. Separate schema per tenant — Good isolation, medium overhead
3. Shared tables with RLS — Lowest overhead, DB-enforced isolation
**Rationale:** RLS is battle-tested (Supabase, PostHog), simplifies ops at scale, can upgrade Tier 3 customers to dedicated DB if needed
**Consequences:** Must ensure tenant_id set on every request, audit RLS policies regularly

---

## ADR-002: Container Orchestration Strategy
**Date:** 2025-01-XX
**Status:** Accepted
**Decision:** Docker Compose for dev/early prod, ECS Fargate for scale
**Context:** Need portable deployment, uncertain about AWS credits
**Rationale:** Same Docker images run anywhere; start cheap (Oracle/Hetzner), migrate to Fargate when revenue justifies
**Consequences:** Avoid AWS-specific features until committed

---

## ADR-003: Package Manager
**Date:** 2025-01-XX
**Status:** Accepted
**Decision:** pnpm for all Node.js projects
**Rationale:** Faster installs, strict dependencies, disk efficient, monorepo-friendly
**Consequences:** All devs must have pnpm installed

---

## ADR-004: API Framework
**Date:** 2025-01-XX
**Status:** Accepted
**Decision:** NestJS with TypeScript strict mode
**Rationale:** Enterprise patterns (DI, modules, guards), excellent TypeScript support, good for multi-tenant SaaS
**Consequences:** Slightly more boilerplate than Express, but better structure at scale

---

## ADR-005: Frontend Framework
**Date:** 2025-01-XX
**Status:** Accepted
**Decision:** Next.js 14+ with App Router, Tailwind CSS
**Rationale:** Server components, API routes, good DX, Ayaz familiar with it
**Consequences:** Must use App Router patterns (not Pages)

---

## ADR-006: Queue System
**Date:** 2025-01-XX
**Status:** Accepted
**Decision:** BullMQ on Redis
**Rationale:** Mature, supports delayed jobs, retries, priorities, dashboard (Bull Board)
**Consequences:** Redis becomes critical infrastructure

---

## ADR-007: Dogfooding
**Date:** 2025-01-XX
**Status:** Accepted
**Decision:** ThreatDiviner scans itself
**Rationale:** Proves product works, ensures own security, builds credibility
**Consequences:** Must keep own vulns at zero (or explain why accepted)

---

*Add new ADRs as decisions are made*
