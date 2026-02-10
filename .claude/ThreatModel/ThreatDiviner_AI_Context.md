# ThreatDiviner — AI Implementation Context Document

> ⚠️ **MANDATORY: READ THIS ENTIRE DOCUMENT BEFORE IMPLEMENTING ANY CHECKPOINT**
> 
> This document provides essential context for Claude Code sessions. Skipping sections leads to architectural drift, rule violations, and checkpoint failures.


## 📚 CHECKPOINT → DOCUMENT MAPPING

**Before implementing any checkpoint, read ALL documents marked ✓ for that phase.**

### Phase 0: Schema & Migration (v0.1.0 - v0.2.0)
| Document | Required |
|----------|----------|
| 04_data_models.md | ✓ Full read |
| 08_rules.md | ✓ §3 Database Rules, §10 Dynamic Data |
| 09_implementation_plan.md | ✓ Phase 0 section |
Spc_Updates.md

### Phase 1: Enhanced Editor (v1.1.0 - v1.5.0)
| Document | Required |
|----------|----------|
| 02_functional_spec.md | ✓ Editor features |
| 03_technical_spec.md | ✓ Draw.io integration |
| 05_ui_screens.md | ✓ §2 Diagram Editor View |
| 06_user_flows.md | ✓ Editor flows |
| 08_rules.md | ✓ §1.2 React, §1.3 Styling |
| SPEC_UPDATES.md | ✓ Draw.io embed migration |

### Phase 2: Threagile Integration (v2.1.0 - v2.6.0)
| Document | Required |
|----------|----------|
| 03_technical_spec.md | ✓ Threagile, YAML generation |
| 04_data_models.md | ✓ AnalysisRun, Threat models |
| 05_ui_screens.md | ✓ §7.4 Progress stages |
| 06_user_flows.md | ✓ Analysis flows |
| 08_rules.md | ✓ §4 API Patterns, §6 Error Handling |

### Phase 3: Admin Console (v3.1.0 - v3.8.0)
| Document | Required |
|----------|----------|
| 04_data_models.md | ✓ Admin schema tables |
| 07_admin_console.md | ✓ Full read |
| 08_rules.md | ✓ §10 Dynamic Data Rule |
| 09_implementation_plan.md | ✓ Phase 3 section |

### Phase 4: Compliance (v4.1.0 - v4.3.0)
| Document | Required |
|----------|----------|
| 02_functional_spec.md | ✓ Compliance features |
| 04_data_models.md | ✓ ComplianceFramework, Control, RiskControlMapping |
| 05_ui_screens.md | ✓ Compliance tab UI |
| 09_implementation_plan.md | ✓ Phase 4 section |

### Phase 5: Risk Management (v5.1.0 - v5.6.0) — NEXT
| Document | Required |
|----------|----------|
| 02_functional_spec.md | ✓ Risk triage features |
| 03_technical_spec.md | ✓ AI triage, Claude integration |
| 04_data_models.md | ✓ Threat, ThreatMitigation |
| 05_ui_screens.md | ✓ Risk panel UI |
| 06_user_flows.md | ✓ Triage workflows |
| 08_rules.md | ✓ §6 Error Handling, §7 Unhappy Paths |

### Phase 6: CI/CD & Import (v6.1.0 - v6.7.0)
| Document | Required |
|----------|----------|
| 02_functional_spec.md | ✓ Import methods, webhooks |
| 03_technical_spec.md | ✓ Webhook handlers, SARIF |
| 04_data_models.md | ✓ WizardQuestion, FeedConfig |
| 06_user_flows.md | ✓ Import flows, wizard |
| 07_admin_console.md | ✓ Feed sync admin UI |

### Phase 7: Polish & Launch (v7.1.0 - v7.5.0)
| Document | Required |
|----------|----------|
| 08_rules.md | ✓ §12 Performance Rules |
| 09_implementation_plan.md | ✓ Phase 7 section |

---

## 🏗️ PROJECT IDENTITY

**Product:** ThreatDiviner Threat Modeling Module
**Purpose:** AI-powered threat modeling that converts architecture diagrams to security risks mapped to compliance frameworks
**Target:** Mid-market SaaS companies ($99-$799/month), regulated industries

### Deployment Modes
| Mode | Description |
|------|-------------|
| **Standalone** | Full threat modeling application |
| **Embedded** | Module within ThreatDiviner platform |
| **API** | Headless mode for CI/CD integration |

---

## 🔧 TECHNICAL ARCHITECTURE

### Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui |
| Backend | NestJS 10, GraphQL (client), REST (webhooks) |
| Database | PostgreSQL 15, Prisma ORM |
| Queue | BullMQ + Redis |
| Analysis Engine | Threagile (Docker container) |
| Diagram Editor | Draw.io Embed API (NOT custom mxGraph) |

### Critical Architecture Decision
> **Draw.io Integration:** Uses official Draw.io embed API via iframe, NOT custom mxGraph implementation. XML is extracted via postMessage API. See `SPEC_UPDATES.md` for details.

### Monorepo Structure
```
apps/
├── api/                    # NestJS backend
│   ├── prisma/schema.prisma
│   └── src/
│       ├── threat-modeling/   # Core module
│       ├── admin/             # Admin endpoints
│       ├── queue/             # BullMQ processors
│       └── ai/                # Claude integration
├── dashboard/              # Next.js user frontend
│   └── src/
│       ├── app/dashboard/threat-modeling/
│       ├── components/threat-modeling/
│       └── hooks/
└── admin/                  # Next.js admin frontend
    └── src/app/(dashboard)/
```

---

## 💾 DATA MODEL SUMMARY

### Existing Tables (from platform)
- `Tenant`, `User`, `Organization`
- `Finding`, `Scan`, `Repository`

### Threat Modeling Tables (Phase 0)
| Table | Purpose |
|-------|---------|
| `ThreatModel` | Core model with diagramXml |
| `ThreatModelComponent` | Assets/nodes in diagram |
| `DataFlow` | Connections between components |
| `TrustBoundary` | Security perimeters |
| `DiagramVersion` | XML version history |
| `ThreatModelLock` | Concurrent edit prevention |
| `AnalysisRun` | Threagile job tracking |
| `Threat` | Identified risks with fingerprint |

### Admin Tables (Phase 3)
| Table | Purpose |
|-------|---------|
| `ShapeMapping` | Draw.io style → Threagile tech |
| `CanonicalRisk` | Deduplicated risk definitions |
| `CanonicalRiskSource` | CWE/CAPEC/Threagile mappings |
| `ComplianceFramework` | ISO, NIST, PCI-DSS, etc. |
| `ComplianceControl` | Hierarchical controls |
| `RiskControlMapping` | Risk → Control links |
| `RemediationPlaybook` | Step-by-step fixes |
| `PlaybookStep` | Individual remediation steps |
| `WizardQuestion` | Guided questionnaire |
| `FeedConfig` | External feed sync settings |

---

## 🚨 CRITICAL RULES

### 1. No Hardcoded Data (§10)
> **"Sample data in specs is illustrative only — never hardcode; always build CRUD + DB/config loading; if you see 5 examples, build the system that manages N items dynamically."**

Data enters ONLY via:
1. Admin UI (human entry or CSV/JSON import)
2. Feed sync (CWE/CAPEC/NIST sources)

**NO seed scripts. NO bootstrap files. NO config JSON in repo.**

### 2. Multi-Tenancy (§3.2)
- EVERY user-facing table has `tenantId` column
- EVERY query filters by `tenantId`
- Use `tenantId` NOT `orgId` (legacy field)

### 3. TypeScript Strictness (§1.1)
- ❌ NEVER use `any` — use `unknown` + type guards
- ✅ ALWAYS define explicit return types
- ✅ ALWAYS handle null/undefined explicitly

### 4. React Components (§1.2)
- ✅ Functional components with hooks only
- ✅ Named exports (no default exports)
- ✅ TypeScript interfaces for all props
- ✅ Tailwind CSS only (no CSS files)

### 5. API Patterns (§4)
- GraphQL for client queries/mutations
- REST for webhooks, uploads, health checks
- class-validator DTOs for all inputs

### 6. Checkpoint Protocol (§11)
- MUST checkpoint after each component/endpoint/migration
- NEVER work >1-2 hours without checkpoint
- STOP and wait for approval at phase boundaries

---

## 📁 KEY FILE PATHS

### Backend Services
```
apps/api/src/threat-modeling/
├── threat-modeling.controller.ts    # REST endpoints
├── threat-modeling.service.ts       # Core business logic
├── threat-modeling.module.ts        # NestJS module
├── dto/                             # Request/response DTOs
└── services/
    ├── threagile.service.ts         # Threagile integration
    ├── yaml-generator.service.ts    # XML → YAML conversion
    ├── risk-parser.service.ts       # Risk deduplication
    ├── gap-detection.service.ts     # Model validation
    └── compliance.service.ts        # Gap calculation
```

### Frontend Components
```
apps/dashboard/src/
├── app/dashboard/threat-modeling/
│   ├── page.tsx                     # List view
│   ├── new/page.tsx                 # Create flow
│   └── [id]/page.tsx                # Detail/editor
├── components/threat-modeling/
│   ├── DiagramCanvas.tsx            # Draw.io embed
│   ├── PropertyPanel.tsx            # Element properties
│   ├── LockManager.tsx              # Edit locking
│   ├── GapFillDialog.tsx            # Pre-analysis gaps
│   └── AnalysisProgressModal.tsx    # Progress tracking
└── hooks/
    ├── useThreatModel.ts
    ├── useAnalysis.ts
    ├── useLockManager.ts
    └── useGapDetection.ts
```

### Admin Console
```
apps/admin/src/app/(dashboard)/
├── shape-mappings/page.tsx
├── canonical-risks/page.tsx
├── compliance/page.tsx
├── playbooks/page.tsx
├── wizard/page.tsx
├── feeds/page.tsx
└── ai-queue/page.tsx
```

---

## 🔄 CHECKPOINT QUICK REFERENCE

### Version Format
| Format | Meaning |
|--------|---------|
| `vX.Y.0` | Phase X, Checkpoint Y |
| `vX.Y.1` | Phase X, Checkpoint Y, Fix 1 |

### All Checkpoints
| Version | Deliverable | Status |
|---------|-------------|--------|
| v0.1.0 | Schema file updated | ✅ |
| v0.2.0 | Migration applied | ✅ |
| v1.1.0 | DiagramCanvas component | ✅ |
| v1.2.0 | ShapePalette component | ✅ |
| v1.3.0 | PropertyPanel component | ✅ |
| v1.4.0 | Save & Versioning | ✅ |
| v1.5.0 | Locking system | ✅ |
| v2.1.0 | Threagile Docker setup | ✅ |
| v2.2.0 | YAML generation | ✅ |
| v2.3.0 | Analysis queue | ✅ |
| v2.4.0 | Risk parsing | ✅ |
| v2.5.0 | Gap detection | ✅ |
| v2.6.0 | Run Analysis UI | ✅ |
| v3.1.0 | Admin shell | ✅ |
| v3.2.0 | Shape Mapping CRUD | ✅ |
| v3.3.0 | Canonical Risk CRUD | ✅ |
| v3.4.0 | Compliance Framework CRUD | ✅ |
| v3.5.0 | Playbook CRUD | ✅ |
| v3.6.0 | Wizard CRUD | ✅ |
| v3.7.0 | Feed Config | ✅ |
| v3.8.0 | Staging/Prod workflow | ✅ |
| v4.1.0 | ComplianceService | ✅ |
| v4.2.0 | Compliance Tab UI | ✅ |
| v4.3.0 | Compliance Reports | ⏳ AWAITING |
| v5.1.0 | Risk Panel | ⬜ |
| v5.2.0 | Triage Workflow | ⬜ |
| v5.3.0 | AI Triage | ⬜ |
| v5.4.0 | Attack Path Viz | ⬜ |
| v5.5.0 | Ticket Export | ⬜ |
| v5.6.0 | Remediation Display | ⬜ |
| v6.1.0 | Webhook Handlers | ⬜ |
| v6.2.0 | PR Analysis Flow | ⬜ |
| v6.3.0 | SARIF Integration | ⬜ |
| v6.4.0 | Draw.io Import | ⬜ |
| v6.5.0 | Feed Sync Jobs | ⬜ |
| v6.6.0 | Document Import | ⬜ |
| v6.7.0 | Wizard Flow | ⬜ |
| v7.1.0 | Performance | ⬜ |
| v7.2.0 | Accessibility | ⬜ |
| v7.3.0 | Security Hardening | ⬜ |
| v7.4.0 | Documentation | ⬜ |
| v7.5.0 | Beta Launch | ⬜ |

---

## 🎯 IMPLEMENTATION CHECKLIST

Before starting any checkpoint:

- [ ] Read this entire document
- [ ] Read ALL required spec documents for the phase (see mapping above)
- [ ] Check current status matches what you expect
- [ ] Verify no blocking issues from previous checkpoint

During implementation:

- [ ] Follow TypeScript strictness rules
- [ ] No hardcoded config data
- [ ] Include tenantId in all queries
- [ ] Write tests (80% unit, 90% integration)
- [ ] Handle all error cases

At checkpoint:

- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Update CHECKPOINT.md (append, don't replace)
- [ ] Generate repomix output in zip (exclude repomix and repomix xml)
- [ ] STOP and wait for approval

---

## 📋 ERROR CODE REFERENCE

| Code | HTTP | When |
|------|------|------|
| VALIDATION_ERROR | 400 | Invalid input |
| UNAUTHENTICATED | 401 | Missing/invalid token |
| FORBIDDEN | 403 | No permission |
| NOT_FOUND | 404 | Resource missing |
| CONFLICT | 409 | Version/lock conflict |
| RESOURCE_LOCKED | 409 | Edit lock held |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## 🏷️ TERMINOLOGY QUICK LOOKUP

| Term | Meaning |
|------|---------|
| ThreatModel | Container for diagram + risks |
| Component | Asset/node in diagram (server, DB, etc.) |
| DataFlow | Connection between components |
| TrustBoundary | Security perimeter grouping |
| CanonicalRisk | Deduplicated risk definition |
| ShapeMapping | Draw.io style → Threagile tech |
| AnalysisRun | Single Threagile execution |
| Fingerprint | SHA256 hash for risk dedup |

---

## 📖 SPEC DOCUMENT INDEX

| File | Purpose |
|------|---------|
| `00_overview.md` | Product vision, tiers, competitive landscape |
| `01_product_context.md` | Personas, user stories, JTBD |
| `02_functional_spec.md` | Features, behaviors, interactions |
| `03_technical_spec.md` | Architecture, APIs, integrations |
| `04_data_models.md` | Schema definitions, field mappings |
| `05_ui_screens.md` | Screen-by-screen UI specifications |
| `06_user_flows.md` | Step-by-step user journeys |
| `07_admin_console.md` | Admin application spec |
| `08_rules.md` | Code constraints for Claude Code |
| `09_implementation_plan.md` | Phased build order with checkpoints |
| `10_gap_analysis.md` | Existing vs new capabilities |
| `SPEC_UPDATES.md` | Draw.io embed migration changes |
| `CHECKPOINT.md` | Living checkpoint history |

---

*Document Version: 2026-01-25*
