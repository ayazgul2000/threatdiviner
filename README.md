# ThreatDiviner

Enterprise-grade DevSecOps-as-a-Service for SMB SaaS companies.

## What is this?

Managed security scanning + SOC 2 compliance automation. Outsource your entire security function for less than one security hire.

## Features

- 🔍 **SAST** — Static code analysis (Semgrep, Bandit, Gosec)
- 📦 **SCA** — Dependency scanning (Trivy, Grype, OSV)
- 🔑 **Secrets** — Credential detection (Gitleaks, TruffleHog)
- 🏗️ **IaC** — Infrastructure as Code scanning (Checkov, tfsec)
- 🐳 **Containers** — Image vulnerability scanning (Trivy)
- 🌐 **DAST** — Dynamic application testing (ZAP, Nuclei)
- ☁️ **CSPM** — Cloud security posture (Prowler, ScoutSuite)
- 🤖 **AI Triage** — False positive filtering, auto-fixes (Claude API)
- 📋 **Compliance** — SOC 2, Essential Eight, OWASP mapping

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Customer Environment                  │
│  GitHub/GitLab ──webhook──► API                         │
│  AWS/Azure/GCP ──agents──► API                          │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                    ThreatDiviner Platform               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────┐  │
│  │ NestJS  │  │ Next.js │  │ Workers │  │ AI Triage │  │
│  │   API   │  │Dashboard│  │(Scanners│  │  (Claude) │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  └─────┬─────┘  │
│       │            │            │              │        │
│  ┌────┴────────────┴────────────┴──────────────┴────┐  │
│  │  PostgreSQL │ Redis │ MinIO/S3 │ Qdrant          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Local Development

```bash
# Prerequisites
docker --version  # 24+
pnpm --version    # 8+

# Start all services
docker compose up -d

# API (localhost:3001)
cd apps/api && pnpm install && pnpm dev

# Dashboard (localhost:3000)
cd apps/dashboard && pnpm install && pnpm dev
```

## Project Structure

```
threatdiviner/
├── .claude/           # Coordination files (GUI/CLI sync)
├── apps/
│   ├── api/           # NestJS backend
│   └── dashboard/     # Next.js frontend
├── packages/
│   └── shared/        # Shared types, utils
├── workers/
│   ├── sast/          # Semgrep, Bandit, Gosec
│   ├── sca/           # Trivy, Grype
│   ├── secrets/       # Gitleaks, TruffleHog
│   ├── iac/           # Checkov, tfsec
│   ├── dast/          # ZAP, Nuclei
│   └── cspm/          # Prowler, ScoutSuite
├── docker-compose.yml
└── README.md
```

## Coordination

This project uses a multi-Claude workflow:
- **GUI Claude** — Architecture, planning, decisions
- **CLI Claude** — Code execution, implementation
- **Human** — Product owner, testing, approvals

State is synced via `.claude/` directory:
- `CONTEXT.md` — Current state, architecture
- `HANDOFF.md` — Active task, progress
- `DECISIONS.md` — ADRs
- `BACKLOG.md` — Feature queue

## License

Proprietary — All rights reserved.
