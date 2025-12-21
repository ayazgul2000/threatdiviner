# ThreatDiviner - Context

## What is this?
Enterprise-grade DevSecOps-as-a-Service platform for SMB SaaS companies. Managed security scanning + SOC 2 compliance automation at $500-4K/month.

## Current Phase
**Phase 1: Platform Core** — COMPLETE

Completed features:
- Multi-scanner security scanning (Semgrep, Gitleaks, Trivy, Bandit, Gosec)
- AI-powered triage with Claude API
- Slack notifications with Block Kit templates
- PDF reporting with MinIO storage
- Enhanced RBAC with 5 roles and granular permissions
- Dashboard settings (notifications, team, profile)
- Platform Admin Portal (separate Next.js app)

## Architecture Summary
- **Backend:** NestJS API (auth, tenants, webhooks, jobs)
- **Frontend:** Next.js dashboard (customer + admin)
- **Workers:** Docker containers running scanners (Semgrep, Trivy, ZAP, etc.)
- **Queue:** BullMQ on Redis
- **Database:** PostgreSQL with Row-Level Security (multi-tenant)
- **AI:** Claude API + Qdrant RAG for triage
- **Storage:** S3/MinIO for artifacts

## Tech Stack
| Layer | Tech |
|-------|------|
| API | NestJS, TypeScript |
| Dashboard | Next.js, TypeScript, Tailwind |
| DB | PostgreSQL 16 + RLS |
| Queue | Redis + BullMQ |
| Vector DB | Qdrant |
| Object Storage | MinIO (local), S3 (prod) |
| Containers | Docker, Docker Compose |
| Scanners | Semgrep, Trivy, Gitleaks, Checkov, ZAP, Nuclei |
| AI | Claude Sonnet 4 API |
| Testing | Jest, Playwright, k6 |

## Multi-Tenant Model
- Single Postgres DB with `tenant_id` on all tables
- RLS policies enforce isolation at DB level
- Session context set via `SET app.tenant_id = 'xxx'` per request

## Deployment Strategy
- Build as Docker containers (portable)
- Local dev: Docker Compose
- Prod options: AWS ECS Fargate / Oracle Cloud ARM / Hetzner

## Key Decisions
- See DECISIONS.md for ADRs

## Team
- **Ayaz (Human):** Product owner, tester, final decisions
- **Claude GUI:** Architecture, planning, coordination
- **Claude CLI:** Code execution, commits, implementation

---
*Last updated: Session start*
