# 09 — Implementation Plan

## Overview

This document defines the phased implementation plan for ThreatDiviner Threat Modeling. Each phase has clear entry criteria, deliverables, exit criteria, and acceptance tests.

**Total Duration:** 11 weeks (reduced from 16 due to existing foundation)  
**Team Assumption:** Claude Code as primary implementer with human review at checkpoints

---

## Existing Foundation (Already Built)

The following capabilities **already exist** in the ThreatDiviner codebase and will be reused:

### ✅ Database Schema (Prisma)
- `ThreatModel` — Full CRUD with status, methodology, project linking
- `ThreatModelComponent` — Position X/Y, metadata, technology, criticality
- `ThreatModelDataFlow` — Source/target, protocol, auth, encryption
- `Threat` — STRIDE category, CWE/CAPEC, risk score, status
- `ThreatMitigation` — Status, priority, Jira integration
- `ThreatComponentMapping`, `ThreatDataFlowMapping`, `ThreatMitigationMapping`

### ✅ API Services (NestJS)
- `ThreatModelingService` — Full CRUD for models, components, dataflows, threats, mitigations
- `StrideAnalyzer`, `DreadCalculator`, `LinddunAnalyzer`, `PastaAnalyzer` — Analysis patterns
- `AttackTreeGenerator` — Attack path visualization
- `TerraformParser`, `OpenAPIParser` — IaC/API import patterns
- `DiagramService`, `ExportService` — Basic diagram operations

### ✅ Dashboard Pages (Next.js)
- `/dashboard/threat-modeling/page.tsx` — Model list
- `/dashboard/threat-modeling/[id]/page.tsx` — Model detail
- `/dashboard/threat-modeling/new/page.tsx` — Create model
- `/dashboard/threat-modeling/[id]/diagram/page.tsx` — Diagram editor

### ✅ Platform Services
- Multi-tenancy with `tenantId` on all tables
- Project linking via `projectId`
- User context (`createdBy`, `lastModifiedBy`)
- Audit logging (platform-wide)
- AI integration (Claude provider for triage/fix)
- Admin app shell at `/apps/admin`

### ✅ Code Paths to Reuse
| Existing Code | Reuse For |
|---------------|-----------|
| `apps/api/src/threat-modeling/threat-modeling.service.ts` | Extend with locking, versioning |
| `apps/api/src/threat-modeling/analyzers/*.ts` | Pattern for Threagile integration |
| `apps/api/src/threat-modeling/parsers/*.ts` | Pattern for Draw.io import |
| `apps/api/src/ai/providers/claude.provider.ts` | AI triage, chat builder |
| `apps/dashboard/src/app/dashboard/threat-modeling/*` | Enhance existing pages |
| `apps/admin/src/*` | Add admin screens |

---

## Phase Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION PHASES (11 weeks)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 0: Schema Extensions (3 days) ────────────────────────────────────▶ │
│      │    [NEW tables only - existing schema intact]                        │
│      ▼                                                                      │
│  Phase 1: Enhanced Editor (1.5 weeks) ───────────────────────────────────▶ │
│      │    [EXTENDS existing diagram page]                                   │
│      ▼                                                                      │
│  Phase 2: Threagile Integration (2 weeks) ───────────────────────────────▶ │
│      │    [USES existing Threat model]                                      │
│      ├───────────────────────┬───────────────────────┐                     │
│      ▼                       ▼                       ▼                     │
│  Phase 3: Admin      Phase 4: Compliance    Phase 5: Risk Mgmt            │
│  Console (2 wks)     (1.5 weeks)            (1.5 weeks)                   │
│  [EXTENDS admin]     [NEW tables]           [EXTENDS Threat]              │
│      │                       │                       │                     │
│      └───────────────────────┼───────────────────────┘                     │
│                              ▼                                              │
│                    Phase 6: CI/CD & Import (1.5 weeks)                     │
│                    [USES existing parsers, webhooks]                       │
│                              │                                              │
│                              ▼                                              │
│                    Phase 7: Polish & Launch (1 week)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Checkpoint Master List

> **CRITICAL: Claude Code must stop at EVERY checkpoint and wait for approval.**
> See `08_rules.md §11` for checkpoint procedure.

| Checkpoint | Version | Deliverable | Stop Point |
|------------|---------|-------------|------------|
| **Phase 0: Schema** | | | |
| 0.1 | v0.1.0 | Prisma schema file updated with all new models | After schema written, before migration |
| 0.2 | v0.2.0 | Migration applied, all tables created empty | After `prisma migrate dev` succeeds |
| **Phase 1: Editor** | | | |
| 1.1 | v1.1.0 | `DiagramCanvas` component renders with mxGraph | After component loads empty canvas |
| 1.2 | v1.2.0 | `ShapePalette` component loads shapes from API | After palette renders (empty is OK) |
| 1.3 | v1.3.0 | `PropertyPanel` component shows form for selected node | After form renders and validates |
| 1.4 | v1.4.0 | Save/load works — XML persisted to DiagramVersion | After Ctrl+S saves and reloads |
| 1.5 | v1.5.0 | Locking endpoints work — concurrent edit blocked | After lock acquired/released |
| **Phase 2: Threagile** | | | |
| 2.1 | v2.1.0 | Threagile Docker container runs, health check passes | After container starts |
| 2.2 | v2.2.0 | `YamlGeneratorService` outputs valid Threagile YAML | After manual YAML generation test |
| 2.3 | v2.3.0 | Analysis queue processes job, writes to AnalysisRun | After job completes |
| 2.4 | v2.4.0 | Risk parser creates Threat records from output | After risks visible in DB |
| 2.5 | v2.5.0 | Gap detection blocks analysis if fields missing | After validation error shown |
| 2.6 | v2.6.0 | Full "Run Analysis" flow works end-to-end | After UI shows risks |
| **Phase 3: Admin Console** | | | |
| 3.1 | v3.1.0 | Admin shell renders with navigation | After `/admin` loads |
| 3.2 | v3.2.0 | Shape Mapping CRUD works | After create/edit/delete |
| 3.3 | v3.3.0 | Canonical Risk CRUD works | After create/edit/delete |
| 3.4 | v3.4.0 | Compliance Framework CRUD works | After create/edit/delete |
| 3.5 | v3.5.0 | Playbook CRUD with steps works | After create/edit/delete |
| 3.6 | v3.6.0 | Wizard Question CRUD with options works | After create/edit/delete |
| 3.7 | v3.7.0 | Feed Config page with cron settings works | After schedule saves |
| 3.8 | v3.8.0 | Staging → Prod promotion workflow works | After promote succeeds |
| **Phase 4: Compliance** | | | |
| 4.1 | v4.1.0 | `ComplianceService` calculates gaps | After gaps returned |
| 4.2 | v4.2.0 | Compliance tab renders on model detail | After tab shows frameworks |
| 4.3 | v4.3.0 | Compliance report generates PDF/Excel | After file downloads |
| **Phase 5: Risk Management** | | | |
| 5.1 | v5.1.0 | Risk panel renders in editor | After risks display |
| 5.2 | v5.2.0 | Triage dropdown changes status | After status persists |
| 5.3 | v5.3.0 | AI triage runs and shows recommendations | After AI results display |
| 5.4 | v5.4.0 | Attack path modal renders | After path visualizes |
| 5.5 | v5.5.0 | Ticket export creates Jira/ServiceNow ticket | After ticket link saved |
| 5.6 | v5.6.0 | Playbook displays for risk | After steps render |
| **Phase 6: CI/CD & Import** | | | |
| 6.1 | v6.1.0 | GitHub webhook receives and parses event | After event logged |
| 6.2 | v6.2.0 | PR triggers analysis, posts comment | After comment visible |
| 6.3 | v6.3.0 | SARIF uploads to GitHub Security | After findings in GitHub |
| 6.4 | v6.4.0 | Draw.io XML import creates components | After import preview |
| 6.5 | v6.5.0 | Feed sync runs, AI mapping in staging | After AI output in staging |
| 6.6 | v6.6.0 | Document import extracts components | After extraction preview |
| 6.7 | v6.7.0 | Wizard flow creates model | After model saved |
| **Phase 7: Polish** | | | |
| 7.1 | v7.1.0 | Performance optimized, Lighthouse > 90 | After metrics pass |
| 7.2 | v7.2.0 | Accessibility audit passes WCAG AA | After audit report |
| 7.3 | v7.3.0 | Security hardening complete | After pen test |
| 7.4 | v7.4.0 | Documentation complete | After docs reviewed |
| 7.5 | v7.5.0 | Beta users onboarded | After feedback collected |

---

## Phase 0: Schema Extensions

**Duration:** 3 days  
**Goal:** Add new tables to existing Prisma schema without modifying existing models  
**Checkpoints:** v0.1.0, v0.2.0

### Entry Criteria
- [ ] Specification documents 00-08 approved
- [ ] Access to existing codebase confirmed
- [ ] Existing schema reviewed

### Checkpoint v0.1.0: Schema File Updated

**Deliverable:** Prisma schema file with all new models added

#### 0.1 New Admin Schema Tables
| Task | Description | Output |
|------|-------------|--------|
| 0.1.1 | ShapeMapping model | Draw.io style → Threagile technology |
| 0.1.2 | CanonicalRisk model | Risk deduplication rules |
| 0.1.3 | CanonicalRiskSource model | Source mappings (CWE, Prowler, etc.) |
| 0.1.4 | ComplianceFramework model | ISO, NIST, PCI-DSS, etc. |
| 0.1.5 | ComplianceControl model | Hierarchical controls |
| 0.1.6 | RiskControlMapping model | Risk → Control relationships |
| 0.1.7 | RemediationPlaybook model | Step-by-step remediation |
| 0.1.8 | PlaybookStep model | Individual steps with IaC |
| 0.1.9 | PlaybookIacSnippet model | Terraform/K8s code |
| 0.1.10 | WizardQuestion model | Questionnaire flow |
| 0.1.11 | WizardOption model | Question options with triggers |
| 0.1.12 | FeedConfig model | Feed sync configuration |
| 0.1.13 | FeedSyncRun model | Sync job tracking |

#### 0.2 Threat Model Extensions
| Task | Description | Output |
|------|-------------|--------|
| 0.2.1 | DiagramVersion model | XML versioning for threat models |
| 0.2.2 | ThreatModelLock model | Concurrent edit prevention |
| 0.2.3 | AnalysisRun model | Threagile job tracking |
| 0.2.4 | Add `diagramXml` to ThreatModel | Store current Draw.io XML |
| 0.2.5 | Add `analysisStatus` to ThreatModel | Track last analysis state |
| 0.2.6 | Add relations | Link new tables to existing ThreatModel |

**STOP: After schema.prisma updated, checkpoint v0.1.0**

### Checkpoint v0.2.0: Migration Applied

**Deliverable:** Migration applied, all tables verified empty

#### 0.3 Migration Only (NO SEED DATA)
| Task | Description | Output |
|------|-------------|--------|
| 0.3.1 | Create Prisma migration | `prisma migrate dev --name threat_model_extensions` |
| 0.3.2 | Verify empty tables | All new tables created with 0 rows |
| 0.3.3 | Test relations | Foreign keys to existing ThreatModel work |
| 0.3.4 | Verify existing data | ThreatModel records unaffected |

**STOP: After migration succeeds, checkpoint v0.2.0**

> ⚠️ **CRITICAL CHECKPOINT — READ 08_rules.md §10 BEFORE PROCEEDING**
> 
> Tables start EMPTY and stay empty until:
> 1. **Admin UI** — Human entry or bulk CSV/JSON import (Phase 3)
> 2. **Feed sync** — CWE/CAPEC/NIST official sources (Phase 6)
> 
> No seed scripts. No bootstrap files. No config JSON in repo.

### Prisma Schema Additions

```prisma
// ============================================
// ADMIN SCHEMA - Configuration Management
// ============================================

model ShapeMapping {
  id                  String   @id @default(uuid())
  drawioStyle         String   @unique @map("drawio_style")
  stylePattern        String?  @map("style_pattern")
  threagileType       String   @map("threagile_type")
  machineType         String   @default("virtual") @map("machine_type")
  defaultInternetFacing Boolean @default(false) @map("default_internet_facing")
  defaultEncryption   String   @default("none") @map("default_encryption")
  defaultAuthentication String @default("none") @map("default_authentication")
  defaultMultiTenant  Boolean  @default(false) @map("default_multi_tenant")
  displayName         String   @map("display_name")
  category            String   // aws, azure, gcp, generic
  iconUrl             String?  @map("icon_url")
  status              String   @default("pending") // pending, review, live
  aiSuggested         Boolean  @default(false) @map("ai_suggested")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")
  createdBy           String?  @map("created_by")

  @@index([category])
  @@index([status])
  @@map("shape_mappings")
}

model CanonicalRisk {
  id              String   @id @default(uuid())
  canonicalId     String   @unique @map("canonical_id")
  title           String
  description     String?
  defaultSeverity String   @default("medium") @map("default_severity")
  cweId           String?  @map("cwe_id")
  cweName         String?  @map("cwe_name")
  capecIds        String[] @default([]) @map("capec_ids")
  attackIds       String[] @default([]) @map("attack_ids")
  status          String   @default("pending")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  sources         CanonicalRiskSource[]
  controlMappings RiskControlMapping[]
  playbooks       RemediationPlaybook[]

  @@index([cweId])
  @@map("canonical_risks")
}

model CanonicalRiskSource {
  id              String        @id @default(uuid())
  canonicalRiskId String        @map("canonical_risk_id")
  source          String        // threagile, cis, prowler, trivy, semgrep
  sourceRuleId    String        @map("source_rule_id")
  sourceTitle     String?       @map("source_title")
  createdAt       DateTime      @default(now()) @map("created_at")
  canonicalRisk   CanonicalRisk @relation(fields: [canonicalRiskId], references: [id], onDelete: Cascade)

  @@unique([canonicalRiskId, source, sourceRuleId])
  @@index([source])
  @@map("canonical_risk_sources")
}

model ComplianceFramework {
  id          String   @id @default(uuid())
  frameworkId String   @unique @map("framework_id")
  name        String
  version     String
  description String?
  source      String?  // URL to official source
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  controls    ComplianceControl[]

  @@map("compliance_frameworks")
}

model ComplianceControl {
  id            String              @id @default(uuid())
  frameworkId   String              @map("framework_id")
  controlId     String              @map("control_id")
  parentId      String?             @map("parent_id")
  title         String
  description   String?
  level         Int                 @default(1)
  category      String?
  createdAt     DateTime            @default(now()) @map("created_at")
  updatedAt     DateTime            @updatedAt @map("updated_at")
  framework     ComplianceFramework @relation(fields: [frameworkId], references: [id], onDelete: Cascade)
  parent        ComplianceControl?  @relation("ControlHierarchy", fields: [parentId], references: [id])
  children      ComplianceControl[] @relation("ControlHierarchy")
  riskMappings  RiskControlMapping[]

  @@unique([frameworkId, controlId])
  @@index([frameworkId])
  @@index([parentId])
  @@map("compliance_controls")
}

model RiskControlMapping {
  id              String            @id @default(uuid())
  canonicalRiskId String            @map("canonical_risk_id")
  controlId       String            @map("control_id")
  relevance       String            @default("primary") // primary, secondary, related
  aiConfidence    Float?            @map("ai_confidence")
  createdAt       DateTime          @default(now()) @map("created_at")
  canonicalRisk   CanonicalRisk     @relation(fields: [canonicalRiskId], references: [id], onDelete: Cascade)
  control         ComplianceControl @relation(fields: [controlId], references: [id], onDelete: Cascade)

  @@unique([canonicalRiskId, controlId])
  @@map("risk_control_mappings")
}

model RemediationPlaybook {
  id              String          @id @default(uuid())
  canonicalRiskId String          @map("canonical_risk_id")
  title           String
  description     String?
  totalEffort     String?         @map("total_effort")
  status          String          @default("pending")
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")
  canonicalRisk   CanonicalRisk   @relation(fields: [canonicalRiskId], references: [id], onDelete: Cascade)
  steps           PlaybookStep[]
  iacSnippets     PlaybookIacSnippet[]

  @@index([canonicalRiskId])
  @@map("remediation_playbooks")
}

model PlaybookStep {
  id          String              @id @default(uuid())
  playbookId  String              @map("playbook_id")
  stepNumber  Int                 @map("step_number")
  title       String
  description String
  effort      String?
  role        String?
  estimatedMinutes Int?           @map("estimated_minutes")
  automatable Boolean             @default(false)
  createdAt   DateTime            @default(now()) @map("created_at")
  playbook    RemediationPlaybook @relation(fields: [playbookId], references: [id], onDelete: Cascade)

  @@unique([playbookId, stepNumber])
  @@map("playbook_steps")
}

model PlaybookIacSnippet {
  id          String              @id @default(uuid())
  playbookId  String              @map("playbook_id")
  platform    String              // terraform, cloudformation, kubernetes, pulumi
  code        String
  description String?
  createdAt   DateTime            @default(now()) @map("created_at")
  playbook    RemediationPlaybook @relation(fields: [playbookId], references: [id], onDelete: Cascade)

  @@unique([playbookId, platform])
  @@map("playbook_iac_snippets")
}

model WizardQuestion {
  id          String         @id @default(uuid())
  questionId  String         @unique @map("question_id")
  text        String
  helpText    String?        @map("help_text")
  type        String         // single-select, multi-select, text, toggle
  orderIndex  Int            @map("order_index")
  isEntryPoint Boolean       @default(false) @map("is_entry_point")
  isTerminal  Boolean        @default(false) @map("is_terminal")
  conditions  Json           @default("[]")
  status      String         @default("pending")
  createdAt   DateTime       @default(now()) @map("created_at")
  updatedAt   DateTime       @updatedAt @map("updated_at")
  options     WizardOption[]

  @@index([orderIndex])
  @@map("wizard_questions")
}

model WizardOption {
  id              String         @id @default(uuid())
  questionId      String         @map("question_id")
  value           String
  label           String
  description     String?
  iconUrl         String?        @map("icon_url")
  nextQuestionId  String?        @map("next_question_id")
  triggers        Json           @default("{}") // { addNodes, addBoundaries, addLinks, setProperties }
  createdAt       DateTime       @default(now()) @map("created_at")
  question        WizardQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([questionId, value])
  @@map("wizard_options")
}

// ============================================
// THREAT MODEL EXTENSIONS
// ============================================

model DiagramVersion {
  id              String      @id @default(uuid())
  threatModelId   String      @map("threat_model_id")
  versionNumber   Int         @map("version_number")
  versionName     String?     @map("version_name")
  xmlContent      String      @map("xml_content") @db.Text
  createdBy       String      @map("created_by")
  isAutoSave      Boolean     @default(false) @map("is_auto_save")
  createdAt       DateTime    @default(now()) @map("created_at")
  threatModel     ThreatModel @relation(fields: [threatModelId], references: [id], onDelete: Cascade)

  @@unique([threatModelId, versionNumber])
  @@index([threatModelId])
  @@map("diagram_versions")
}

model ThreatModelLock {
  id              String      @id @default(uuid())
  threatModelId   String      @unique @map("threat_model_id")
  lockedBy        String      @map("locked_by")
  lockedByName    String?     @map("locked_by_name")
  lockedAt        DateTime    @default(now()) @map("locked_at")
  expiresAt       DateTime    @map("expires_at")
  threatModel     ThreatModel @relation(fields: [threatModelId], references: [id], onDelete: Cascade)

  @@map("threat_model_locks")
}

model AnalysisRun {
  id              String      @id @default(uuid())
  threatModelId   String      @map("threat_model_id")
  tenantId        String      @map("tenant_id")
  status          String      @default("queued") // queued, running, completed, failed, cancelled
  engine          String      @default("threagile") // threagile, stride, dread
  triggeredBy     String      @map("triggered_by")
  startedAt       DateTime?   @map("started_at")
  completedAt     DateTime?   @map("completed_at")
  durationMs      Int?        @map("duration_ms")
  riskCount       Int         @default(0) @map("risk_count")
  criticalCount   Int         @default(0) @map("critical_count")
  highCount       Int         @default(0) @map("high_count")
  mediumCount     Int         @default(0) @map("medium_count")
  lowCount        Int         @default(0) @map("low_count")
  errorMessage    String?     @map("error_message")
  yamlInput       String?     @map("yaml_input") @db.Text
  rawOutput       Json?       @map("raw_output")
  createdAt       DateTime    @default(now()) @map("created_at")
  threatModel     ThreatModel @relation(fields: [threatModelId], references: [id], onDelete: Cascade)

  @@index([threatModelId])
  @@index([tenantId])
  @@index([status])
  @@map("analysis_runs")
}

// Add relations to existing ThreatModel (add these fields)
// diagramXml       String?     @map("diagram_xml") @db.Text
// analysisStatus   String?     @map("analysis_status")
// lastAnalysisAt   DateTime?   @map("last_analysis_at")
// lastAnalysisRunId String?    @map("last_analysis_run_id")
// diagramVersions  DiagramVersion[]
// lock             ThreatModelLock?
// analysisRuns     AnalysisRun[]
```

### Exit Criteria
- [ ] All new tables created via migration
- [ ] All tables are EMPTY (0 rows)
- [ ] Existing data unaffected
- [ ] Relations to existing ThreatModel working

### Acceptance Tests
```gherkin
Feature: Schema Extensions

Scenario: New Tables Created Empty
  Given I run prisma migrate
  Then all new tables exist
  And all new tables have 0 rows
  And existing ThreatModel table is unchanged

Scenario: No Seed Data
  Given migration completes
  Then ShapeMapping has 0 entries
  And ComplianceFramework has 0 entries
  And CanonicalRisk has 0 entries
```

### Checkpoint Output
```markdown
## Phase 0 Checkpoint

### Migration Status
- [x] New admin tables created (10 tables)
- [x] Threat model extension tables created (3 tables)
- [x] ThreatModel fields added
- [x] All relations verified
- [x] ALL TABLES EMPTY (no seed data)

### Existing Data Impact
- ThreatModel records: 0 affected
- All existing tests: PASS

### Anti-Hardcoding Verification
- [ ] I have read 08_rules.md §10
- [ ] I understand data comes ONLY from admin UI or feed sync
- [ ] I will NOT create seed scripts or bootstrap files

**Status: AWAITING APPROVAL**
```

---

## Phase 1: Enhanced Editor

**Duration:** 1.5 weeks  
**Goal:** Enhance existing diagram page with mxGraph canvas, shape palette, and property panel  
**Checkpoints:** v1.1.0, v1.2.0, v1.3.0, v1.4.0, v1.5.0

**Uses Existing:**
- `apps/dashboard/src/app/dashboard/threat-modeling/[id]/diagram/page.tsx`
- `apps/api/src/threat-modeling/services/diagram.service.ts`
- `ThreatModelComponent`, `ThreatModelDataFlow` Prisma models

### Entry Criteria
- [ ] Phase 0 approved (v0.2.0)
- [ ] mxGraph library added to package.json
- [ ] Shape icon assets available (AWS/Azure/GCP SVGs)

### Checkpoint v1.1.0: DiagramCanvas Component

**Deliverable:** mxGraph canvas renders and loads existing data

| Task | Description | Output |
|------|-------------|--------|
| 1.1.1 | Install mxGraph | `pnpm add mxgraph` in dashboard |
| 1.1.2 | Create `DiagramCanvas` component | React wrapper for mxGraph |
| 1.1.3 | Initialize canvas | Infinite scroll, grid snap, zoom |
| 1.1.4 | Render existing components | Load `ThreatModelComponent` as nodes |
| 1.1.5 | Render existing dataflows | Load `ThreatModelDataFlow` as edges |
| 1.1.6 | Selection handling | Single/multi-select with shift |
| 1.1.7 | Undo/Redo stack | Ctrl+Z, Ctrl+Shift+Z |
| 1.1.8 | XML serialization | Convert graph ↔ Draw.io XML |

**STOP: After canvas renders with existing data, checkpoint v1.1.0**

### Checkpoint v1.2.0: ShapePalette Component

**Deliverable:** Shape palette loads from API and supports drag-drop

| Task | Description | Output |
|------|-------------|--------|
| 1.2.1 | Create `ShapePalette` component | Collapsible categories |
| 1.2.2 | Load shapes from API | `GET /api/admin/shape-mappings` |
| 1.2.3 | Shape search | Filter across categories |
| 1.2.4 | Drag-drop to canvas | mxGraph drag source |
| 1.2.5 | Shape tooltips | Technology type on hover |
| 1.2.6 | Recent shapes | localStorage tracking |
| 1.2.7 | Empty state | "No shapes configured" message |

**STOP: After palette renders (empty OK), checkpoint v1.2.0**

### Checkpoint v1.3.0: PropertyPanel Component

**Deliverable:** Property panel shows form for selected node and saves

| Task | Description | Output |
|------|-------------|--------|
| 1.3.1 | Create `PropertyPanel` component | Context-aware form |
| 1.3.2 | Asset properties form | Name, technology, criticality, etc. |
| 1.3.3 | DataFlow properties form | Protocol, auth, encryption |
| 1.3.4 | Trust boundary form | Type, nested boundaries |
| 1.3.5 | Field validation | Zod schema validation |
| 1.3.6 | Apply to graph | Update node/edge on change |
| 1.3.7 | Sync to API | PATCH component/dataflow |

**STOP: After property edits persist, checkpoint v1.3.0**

### Checkpoint v1.4.0: Save & Versioning

**Deliverable:** Ctrl+S saves XML, version history loads

| Task | Description | Output |
|------|-------------|--------|
| 1.4.1 | Manual save (Ctrl+S) | Save XML to DiagramVersion |
| 1.4.2 | Auto-save (60s debounce) | Background save as auto-save |
| 1.4.3 | Version dropdown | Load previous versions |
| 1.4.4 | Sync components | XML → ThreatModelComponent sync |

**STOP: After save/load works, checkpoint v1.4.0**

### Checkpoint v1.5.0: Locking

**Deliverable:** Concurrent edit prevention works

| Task | Description | Output |
|------|-------------|--------|
| 1.5.1 | Lock acquisition endpoint | `POST /api/threat-models/:id/lock` |
| 1.5.2 | Lock release endpoint | `DELETE /api/threat-models/:id/lock` |
| 1.5.3 | Lock status check | `GET /api/threat-models/:id/lock` |
| 1.5.4 | Lock timeout (5 min) | Background job to expire |
| 1.5.5 | UI lock banner | Show locked state, owner name |
| 1.5.6 | View-only mode | Disable editing when locked |

**STOP: After locking works, checkpoint v1.5.0**

### Exit Criteria
- [ ] Can drag shapes from palette to canvas
- [ ] Can edit properties and save
- [ ] Version history working
- [ ] Locking prevents concurrent edits
- [ ] Existing ThreatModelComponent data renders correctly

### Acceptance Tests
```gherkin
Feature: Enhanced Diagram Editor

Scenario: Load Existing Model
  Given a threat model exists with components
  When I open the diagram page
  Then components render as nodes
  And dataflows render as edges
  And positions match stored values

Scenario: Add Shape from Palette
  Given I am in the editor
  When I drag an EC2 shape from palette
  And I drop it on the canvas
  Then a node appears at drop position
  And property panel shows EC2 defaults
  And a ThreatModelComponent is created

Scenario: Edit Properties
  Given I have selected a node
  When I change technology to "database"
  And I click Apply
  Then the node updates visually
  And ThreatModelComponent is updated

Scenario: Save Version
  Given I have made changes
  When I press Ctrl+S
  Then a DiagramVersion is created
  And version appears in dropdown

Scenario: Locking
  Given User A is editing model X
  When User B opens model X
  Then User B sees lock banner
  And User B cannot edit
```

### Checkpoint Output
```markdown
## Phase 1 Checkpoint

### Components Implemented
- [x] DiagramCanvas (mxGraph wrapper)
- [x] ShapePalette (5 categories, 52 shapes)
- [x] PropertyPanel (asset, dataflow, boundary forms)
- [x] Version dropdown
- [x] Lock banner

### API Endpoints
- GET /api/admin/shape-mappings ✅
- POST /api/threat-models/:id/lock ✅
- DELETE /api/threat-models/:id/lock ✅
- POST /api/threat-models/:id/versions ✅

### Test Results
- Unit: 45/45 passing
- Integration: 12/12 passing
- Coverage: 82%

### Screenshots
[Canvas with shapes]
[Property panel editing]
[Version dropdown]

**Status: AWAITING APPROVAL**
```

---

## Phase 2: Threagile Integration

**Duration:** 2 weeks  
**Goal:** Integrate Threagile engine for automated threat detection  
**Checkpoints:** v2.1.0, v2.2.0, v2.3.0, v2.4.0, v2.5.0, v2.6.0

**Uses Existing:**
- `apps/api/src/threat-modeling/threat-modeling.service.ts` — Threat CRUD
- `apps/api/src/threat-modeling/analyzers/*.ts` — Analysis patterns
- `Threat`, `ThreatMitigation` Prisma models
- BullMQ queue infrastructure

### Entry Criteria
- [ ] Phase 1 approved (v1.5.0)
- [ ] Threagile Docker image available
- [ ] Sample Threagile YAML validated manually

### Checkpoint v2.1.0: Threagile Docker Setup

**Deliverable:** Threagile container runs, health check passes

| Task | Description | Output |
|------|-------------|--------|
| 2.1.1 | Add Threagile to docker-compose | Sidecar container |
| 2.1.2 | Health check endpoint | `/api/threagile/health` |
| 2.1.3 | Threagile client service | `ThreagileService` in NestJS |
| 2.1.4 | Timeout handling | 120s max, retry logic |
| 2.1.5 | Error parsing | Extract meaningful error messages |

**STOP: After health check passes, checkpoint v2.1.0**

### Checkpoint v2.2.0: YAML Generation

**Deliverable:** `YamlGeneratorService` outputs valid Threagile YAML

| Task | Description | Output |
|------|-------------|--------|
| 2.2.1 | Create `YamlGeneratorService` | Transform internal → Threagile |
| 2.2.2 | Load shape mappings | From `ShapeMapping` table (prod schema) |
| 2.2.3 | Technology resolution | Draw.io style → Threagile tech |
| 2.2.4 | Trust boundary generation | From XML boundaries |
| 2.2.5 | Communication link mapping | DataFlow → links |
| 2.2.6 | Data asset inclusion | Reference in flows |
| 2.2.7 | YAML schema validation | Before submit to Threagile |
| 2.2.8 | Missing mapping error | "Shape X not found" message |

**STOP: After YAML generates correctly, checkpoint v2.2.0**

### Checkpoint v2.3.0: Analysis Job Queue

**Deliverable:** BullMQ job processes and updates AnalysisRun

| Task | Description | Output |
|------|-------------|--------|
| 2.3.1 | Create `analysis` BullMQ queue | Redis-backed |
| 2.3.2 | Analysis job processor | Worker implementation |
| 2.3.3 | Progress tracking | Stages: validating → generating → running → processing |
| 2.3.4 | WebSocket progress | Real-time updates to client |
| 2.3.5 | Job cancellation | User-initiated abort |
| 2.3.6 | Update `AnalysisRun` record | Status, duration, counts |

**STOP: After job completes and AnalysisRun updated, checkpoint v2.3.0**

### Checkpoint v2.4.0: Risk Parsing

**Deliverable:** Threagile output creates Threat records

| Task | Description | Output |
|------|-------------|--------|
| 2.4.1 | Parse Threagile JSON output | Extract risks |
| 2.4.2 | Lookup canonical risk | `CanonicalRiskSource` matching |
| 2.4.3 | Create/update `Threat` records | Using existing model |
| 2.4.4 | Link to components | `ThreatComponentMapping` |
| 2.4.5 | Severity normalization | Threagile → internal levels |
| 2.4.6 | Deduplication by fingerprint | Prevent duplicates on re-run |

**STOP: After Threat records created, checkpoint v2.4.0**

### Checkpoint v2.5.0: Gap Detection

**Deliverable:** Missing fields block analysis with helpful error

| Task | Description | Output |
|------|-------------|--------|
| 2.5.1 | Validation rules engine | Required fields by tech type |
| 2.5.2 | Gap detection service | Find missing properties |
| 2.5.3 | Gap-fill dialog component | List gaps, allow inline edit |
| 2.5.4 | Batch update endpoint | Fill multiple gaps |
| 2.5.5 | Re-validate after fill | Proceed only when valid |

**STOP: After gap detection blocks invalid analysis, checkpoint v2.5.0**

### Checkpoint v2.6.0: Run Analysis UI

**Deliverable:** Full "Run Analysis" flow works end-to-end

| Task | Description | Output |
|------|-------------|--------|
| 2.6.1 | "Run Analysis" button | In editor toolbar |
| 2.6.2 | Progress modal | WebSocket-driven stages |
| 2.6.3 | Gap-fill integration | Show dialog if gaps found |
| 2.6.4 | Completion handling | Close modal, refresh risks |
| 2.6.5 | Error display | Show failure reason |

**STOP: After UI shows risks, checkpoint v2.6.0**

### Exit Criteria
- [ ] Analysis runs on valid diagrams
- [ ] Risks created in existing Threat table
- [ ] Gap detection prevents invalid analysis
- [ ] Progress updates real-time
- [ ] Canonical deduplication working

### Acceptance Tests
```gherkin
Feature: Threagile Analysis

Scenario: Run Analysis Successfully
  Given a diagram with EC2, RDS, and connections
  And all required properties are filled
  When I click "Run Analysis"
  Then progress modal shows stages
  And analysis completes in <120s
  And Threat records are created

Scenario: Gap Detection Blocks Analysis
  Given a diagram with missing technology
  When I click "Run Analysis"
  Then gap-fill dialog appears
  And lists missing fields
  When I fill required fields
  And click "Continue"
  Then analysis proceeds

Scenario: Canonical Risk Deduplication
  Given I run analysis twice
  Then same risks are not duplicated
  And fingerprints match

Scenario: Analysis Timeout
  Given a very complex diagram
  When analysis exceeds 120s
  Then timeout error shown
  And AnalysisRun marked as failed
```

### Checkpoint Output
```markdown
## Phase 2 Checkpoint

### Services Implemented
- [x] ThreagileService (Docker client)
- [x] YamlGeneratorService
- [x] AnalysisQueueService (BullMQ)
- [x] GapDetectionService

### API Endpoints
- POST /api/threat-models/:id/analyze ✅
- GET /api/threat-models/:id/analysis-runs ✅
- POST /api/threat-models/:id/validate ✅
- WS /analysis-progress/:runId ✅

### Test Results
- Unit: 38/38 passing
- Integration: 15/15 passing
- E2E: 5/5 analysis flows passing

### Sample Analysis Output
- Model: AWS 3-Tier
- Components: 8
- Risks detected: 12
- Duration: 45s

**Status: AWAITING APPROVAL**
```

---

## Phase 3: Admin Console

**Duration:** 2 weeks  
**Goal:** Build admin screens for configuration management  
**Checkpoints:** v3.1.0, v3.2.0, v3.3.0, v3.4.0, v3.5.0, v3.6.0, v3.7.0, v3.8.0

**Uses Existing:**
- `apps/admin/src/*` — Admin app shell
- `apps/api/src/auth/*` — Role-based access
- Platform audit logging

### Entry Criteria
- [ ] Phase 2 approved (v2.6.0)
- [ ] Admin roles defined (SuperAdmin, ConfigAdmin, Viewer)

### Checkpoint v3.1.0: Admin Shell

**Deliverable:** Admin app renders with navigation

| Task | Description | Output |
|------|-------------|--------|
| 3.1.1 | Admin layout | Sidebar with menu items |
| 3.1.2 | Role check | Redirect if not admin |
| 3.1.3 | Navigation | Links to all admin sections |
| 3.1.4 | Dashboard | Overview metrics (empty OK) |

**STOP: After `/admin` loads with navigation, checkpoint v3.1.0**

### Checkpoint v3.2.0: Shape Mapping CRUD

**Deliverable:** Shape mappings can be created, edited, deleted

| Task | Description | Output |
|------|-------------|--------|
| 3.2.1 | List view page | `/admin/shape-mappings` |
| 3.2.2 | Create/edit form | Full property editing |
| 3.2.3 | Bulk CSV import | Upload and preview |
| 3.2.4 | Delete with confirm | Soft delete |
| 3.2.5 | Status badges | Pending/Review/Live |

**STOP: After CRUD works, checkpoint v3.2.0**

### Checkpoint v3.3.0: Canonical Risk CRUD

**Deliverable:** Canonical risks can be created, edited, deleted with sources

| Task | Description | Output |
|------|-------------|--------|
| 3.3.1 | List view page | `/admin/canonical-risks` |
| 3.3.2 | Create/edit form | Title, description, severity |
| 3.3.3 | Source management | Add/remove source mappings |
| 3.3.4 | CWE/CAPEC linking | External references |
| 3.3.5 | AI suggestion queue | Review AI proposals |

**STOP: After CRUD works, checkpoint v3.3.0**

### Checkpoint v3.4.0: Compliance Framework CRUD

**Deliverable:** Frameworks and controls can be managed

| Task | Description | Output |
|------|-------------|--------|
| 3.4.1 | List view page | `/admin/compliance-frameworks` |
| 3.4.2 | Framework form | Name, version, source URL |
| 3.4.3 | Control tree view | Hierarchical display |
| 3.4.4 | Control editor | Add/edit/delete controls |
| 3.4.5 | Risk-control mapping | Link risks to controls |

**STOP: After CRUD works, checkpoint v3.4.0**

### Checkpoint v3.5.0: Playbook CRUD

**Deliverable:** Playbooks with steps and IaC snippets

| Task | Description | Output |
|------|-------------|--------|
| 3.5.1 | List view page | `/admin/playbooks` |
| 3.5.2 | Step builder | Drag-drop ordering |
| 3.5.3 | IaC snippet editor | Syntax highlighting |
| 3.5.4 | Preview mode | Rendered output |
| 3.5.5 | Link to canonical risk | Association |

**STOP: After CRUD works, checkpoint v3.5.0**

### Checkpoint v3.6.0: Wizard CRUD

**Deliverable:** Wizard questions and options can be managed

| Task | Description | Output |
|------|-------------|--------|
| 3.6.1 | List view page | `/admin/wizard` |
| 3.6.2 | Decision tree view | Visual question flow |
| 3.6.3 | Question editor | All question types |
| 3.6.4 | Option editor | Triggers, next question |
| 3.6.5 | Test simulator | Preview wizard flow |

**STOP: After CRUD works, checkpoint v3.6.0**

### Checkpoint v3.7.0: Feed Configuration

**Deliverable:** Feed cron schedules can be configured

| Task | Description | Output |
|------|-------------|--------|
| 3.7.1 | Feed list page | `/admin/feeds` |
| 3.7.2 | Feed config form | URL, schedule, options |
| 3.7.3 | Cron selector | Daily/weekly/monthly/manual |
| 3.7.4 | Test connection | Validate feed URL |
| 3.7.5 | Sync history | Past runs with status |

**STOP: After feed config saves, checkpoint v3.7.0**

### Checkpoint v3.8.0: Staging → Prod Workflow

**Deliverable:** Promotion workflow works end-to-end

| Task | Description | Output |
|------|-------------|--------|
| 3.8.1 | Review queue | Items pending approval |
| 3.8.2 | Approve/reject actions | Status transitions |
| 3.8.3 | Deploy to staging | Copy to staging schema |
| 3.8.4 | Sandbox test | Use staging data |
| 3.8.5 | Promote to prod | Copy to prod schema |
| 3.8.6 | Rollback | Revert to previous |
| 3.8.7 | Audit log viewer | All config changes |

**STOP: After promote succeeds, checkpoint v3.8.0**

---

## Phase 4: Compliance Module

**Duration:** 1.5 weeks  
**Goal:** Implement compliance frameworks and gap analysis  
**Checkpoints:** v4.1.0, v4.2.0, v4.3.0

**Uses Existing:**
- `ComplianceFramework`, `ComplianceControl` tables (from Phase 0)
- `RiskControlMapping` table (from Phase 0)
- Existing report generation patterns
- Admin CRUD from Phase 3 (v3.4.0)

### Entry Criteria
- [ ] Phase 3 approved (v3.8.0)
- [ ] At least one framework exists in prod schema (via admin UI)

### Checkpoint v4.1.0: ComplianceService

**Deliverable:** Gap calculation logic works

| Task | Description | Output |
|------|-------------|--------|
| 4.1.1 | Create `ComplianceService` | Gap calculation logic |
| 4.1.2 | Risk→Control matching | Using `RiskControlMapping` |
| 4.1.3 | Score calculation | % compliant per framework |
| 4.1.4 | Gap identification | Controls not satisfied |
| 4.1.5 | Cache compliance scores | Redis for performance |

**STOP: After service returns correct gaps, checkpoint v4.1.0**

### Checkpoint v4.2.0: Compliance Tab UI

**Deliverable:** Compliance tab renders on model detail

| Task | Description | Output |
|------|-------------|--------|
| 4.2.1 | Add tab to model detail | `/threat-modeling/[id]` |
| 4.2.2 | Framework selector | Multi-select enabled |
| 4.2.3 | Framework cards | Score, progress bar |
| 4.2.4 | Gap list | Controls needing attention |
| 4.2.5 | Control detail modal | Full info + related risks |

**STOP: After tab shows frameworks, checkpoint v4.2.0**

### Checkpoint v4.3.0: Compliance Reports

**Deliverable:** PDF/Excel reports generate and download

| Task | Description | Output |
|------|-------------|--------|
| 4.3.1 | Report dialog | Select sections, format |
| 4.3.2 | PDF generation | Using existing patterns |
| 4.3.3 | Excel generation | Detailed control status |
| 4.3.4 | Executive summary | High-level metrics |

**STOP: After file downloads, checkpoint v4.3.0**

---

## Phase 5: Risk Management & Triage

**Duration:** 1.5 weeks  
**Goal:** Enhanced risk panel, AI triage, ticket export  
**Checkpoints:** v5.1.0, v5.2.0, v5.3.0, v5.4.0, v5.5.0, v5.6.0

**Uses Existing:**
- `apps/api/src/ai/providers/claude.provider.ts` — AI integration
- `apps/api/src/ai/prompts/triage.prompt.ts` — Triage prompts
- `Threat`, `ThreatMitigation` models
- Existing Jira integration patterns

### Entry Criteria
- [ ] Phase 2 approved (v2.6.0 - risks being created)
- [ ] Claude API access confirmed

### Checkpoint v5.1.0: Risk Panel

**Deliverable:** Risk panel renders in editor with risks

| Task | Description | Output |
|------|-------------|--------|
| 5.1.1 | Bottom panel in editor | Collapsible, resizable |
| 5.1.2 | Risk list with filters | Severity, status, asset |
| 5.1.3 | Risk card component | Title, severity, affected asset |
| 5.1.4 | Click to highlight | Select asset on canvas |
| 5.1.5 | Severity grouping | Critical/High/Medium/Low |

**STOP: After risks display, checkpoint v5.1.0**

### Checkpoint v5.2.0: Triage Workflow

**Deliverable:** Triage dropdown changes status and persists

| Task | Description | Output |
|------|-------------|--------|
| 5.2.1 | Triage dropdown | In risk card |
| 5.2.2 | Status transitions | Open → Triaged states |
| 5.2.3 | Justification input | Required for accept/FP |
| 5.2.4 | Triage history | Audit trail |
| 5.2.5 | Bulk triage | Multi-select |

**STOP: After status persists, checkpoint v5.2.0**

### Checkpoint v5.3.0: AI Triage

**Deliverable:** AI triage runs and shows recommendations

| Task | Description | Output |
|------|-------------|--------|
| 5.3.1 | Triage job processor | Batch process risks |
| 5.3.2 | Context-aware prompts | Include diagram context |
| 5.3.3 | Confidence scoring | Display AI confidence |
| 5.3.4 | Human override | Accept/reject AI recommendation |
| 5.3.5 | Graceful fallback | Work when AI unavailable |

**STOP: After AI results display, checkpoint v5.3.0**

### Checkpoint v5.4.0: Attack Path Visualization

**Deliverable:** Attack path modal renders

| Task | Description | Output |
|------|-------------|--------|
| 5.4.1 | Attack path modal | Graph visualization |
| 5.4.2 | Path calculation | Using `AttackTreeGenerator` |
| 5.4.3 | ATT&CK linking | MITRE technique references |
| 5.4.4 | Narrative text | Step-by-step description |

**STOP: After path visualizes, checkpoint v5.4.0**

### Checkpoint v5.5.0: Ticket Export

**Deliverable:** Ticket export creates Jira/ServiceNow ticket

| Task | Description | Output |
|------|-------------|--------|
| 5.5.1 | Ticket dialog | System selection |
| 5.5.2 | Jira adapter | OAuth integration |
| 5.5.3 | ServiceNow adapter | API key |
| 5.5.4 | ADO adapter | PAT integration |
| 5.5.5 | Ticket link storage | Track created tickets |

**STOP: After ticket link saved, checkpoint v5.5.0**

### Checkpoint v5.6.0: Remediation Display

**Deliverable:** Playbook displays for risk

| Task | Description | Output |
|------|-------------|--------|
| 5.6.1 | Playbook lookup | By canonical risk |
| 5.6.2 | Playbook panel | In risk detail |
| 5.6.3 | Step-by-step view | Expandable |
| 5.6.4 | IaC snippets | Copy to clipboard |

**STOP: After steps render, checkpoint v5.6.0**

---

## Phase 6: CI/CD & Import Methods

**Duration:** 1.5 weeks  
**Goal:** Webhooks, PR integration, import enhancements  
**Checkpoints:** v6.1.0, v6.2.0, v6.3.0, v6.4.0, v6.5.0, v6.6.0, v6.7.0

**Uses Existing:**
- `apps/api/src/threat-modeling/parsers/*.ts` — Parser patterns
- Webhook infrastructure
- SCM OAuth flows (GitHub, GitLab)

### Entry Criteria
- [ ] Phase 2 approved (v2.6.0)
- [ ] GitHub/GitLab OAuth apps configured

### Checkpoint v6.1.0: Webhook Handlers

**Deliverable:** GitHub webhook receives and parses event

| Task | Description | Output |
|------|-------------|--------|
| 6.1.1 | GitHub webhook endpoint | `/webhooks/github` |
| 6.1.2 | GitLab webhook endpoint | `/webhooks/gitlab` |
| 6.1.3 | ADO webhook endpoint | `/webhooks/ado` |
| 6.1.4 | Signature validation | Security check |
| 6.1.5 | Event parsing | PR/commit extraction |

**STOP: After event logged, checkpoint v6.1.0**

### Checkpoint v6.2.0: PR Analysis Flow

**Deliverable:** PR triggers analysis, posts comment

| Task | Description | Output |
|------|-------------|--------|
| 6.2.1 | Model lookup by repo | Find linked model |
| 6.2.2 | Trigger analysis | Queue job on PR |
| 6.2.3 | Threshold evaluation | Pass/fail logic |
| 6.2.4 | Status reporting | Commit status API |
| 6.2.5 | PR comment | Risk summary markdown |

**STOP: After comment visible, checkpoint v6.2.0**

### Checkpoint v6.3.0: SARIF Integration

**Deliverable:** SARIF uploads to GitHub Security

| Task | Description | Output |
|------|-------------|--------|
| 6.3.1 | SARIF generator | From analysis results |
| 6.3.2 | GitHub upload | Code scanning API |
| 6.3.3 | Error handling | Graceful failures |

**STOP: After findings in GitHub, checkpoint v6.3.0**

### Checkpoint v6.4.0: Draw.io Import

**Deliverable:** Draw.io XML import creates components

| Task | Description | Output |
|------|-------------|--------|
| 6.4.1 | XML parser | Parse .drawio files |
| 6.4.2 | Shape detection | Using `ShapeMapping` |
| 6.4.3 | Unknown shape handling | Prompt for classification |
| 6.4.4 | Import preview | Review before import |

**STOP: After import preview, checkpoint v6.4.0**

### Checkpoint v6.5.0: Feed Sync Jobs

**Deliverable:** Feed sync runs, delta detected, AI mapping triggered

| Task | Description | Output |
|------|-------------|--------|
| 6.5.1 | CWE feed sync job | Parse XML, detect delta |
| 6.5.2 | CAPEC feed sync job | Link to canonical risks |
| 6.5.3 | NIST 800-53 sync job | Framework + controls |
| 6.5.4 | Delta notification | Alert admin |
| 6.5.5 | AI mapping trigger | Button in admin UI |
| 6.5.6 | AI job processor | Generate mappings to staging |

**STOP: After AI output in staging, checkpoint v6.5.0**

### Checkpoint v6.6.0: Document Import

**Deliverable:** PDF/DOCX upload extracts components

| Task | Description | Output |
|------|-------------|--------|
| 6.6.1 | File upload endpoint | PDF, DOCX support |
| 6.6.2 | Text extraction | Using existing libs |
| 6.6.3 | AI extraction prompt | Component identification |
| 6.6.4 | Review UI | Confirm extracted data |

**STOP: After extraction preview, checkpoint v6.6.0**

### Checkpoint v6.7.0: Wizard Flow

**Deliverable:** Wizard flow creates model

| Task | Description | Output |
|------|-------------|--------|
| 6.7.1 | Question loader | From `WizardQuestion` |
| 6.7.2 | Wizard page | Step indicator |
| 6.7.3 | Trigger execution | Apply options |
| 6.7.4 | Preview pane | Live diagram |
| 6.7.5 | Completion flow | Create model |

**STOP: After model saved, checkpoint v6.7.0**

---

## Phase 7: Polish & Launch

**Duration:** 1 week  
**Goal:** Performance, accessibility, documentation, launch prep  
**Checkpoints:** v7.1.0, v7.2.0, v7.3.0, v7.4.0, v7.5.0

**Uses Existing:**
- Platform monitoring infrastructure
- Deployment pipelines

### Entry Criteria
- [ ] Phase 6 approved (v6.7.0)
- [ ] No P0/P1 bugs open

### Checkpoint v7.1.0: Performance Optimization

**Deliverable:** Performance optimized, Lighthouse > 90

| Task | Description | Output |
|------|-------------|--------|
| 7.1.1 | Bundle analysis | Reduce chunk sizes |
| 7.1.2 | Lazy loading | Route-based splitting |
| 7.1.3 | API caching | Redis for configs |
| 7.1.4 | Canvas performance | 200+ node handling |
| 7.1.5 | Query optimization | Index review |

**STOP: After metrics pass, checkpoint v7.1.0**

### Checkpoint v7.2.0: Accessibility

**Deliverable:** Accessibility audit passes WCAG AA

| Task | Description | Output |
|------|-------------|--------|
| 7.2.1 | Keyboard navigation | Tab order |
| 7.2.2 | Screen reader | ARIA labels |
| 7.2.3 | Color contrast | WCAG AA |
| 7.2.4 | Focus indicators | Visible states |

**STOP: After audit report, checkpoint v7.2.0**

### Checkpoint v7.3.0: Security Hardening

**Deliverable:** Security hardening complete

| Task | Description | Output |
|------|-------------|--------|
| 7.3.1 | Penetration testing | External audit |
| 7.3.2 | Rate limiting | API throttling |
| 7.3.3 | CSP headers | Content policy |
| 7.3.4 | Dependency audit | npm audit |

**STOP: After pen test, checkpoint v7.3.0**

### Checkpoint v7.4.0: Documentation

**Deliverable:** Documentation complete

| Task | Description | Output |
|------|-------------|--------|
| 7.4.1 | User guide | Getting started |
| 7.4.2 | Admin guide | Config management |
| 7.4.3 | API docs | OpenAPI/GraphQL |
| 7.4.4 | CI/CD guide | Integration setup |

**STOP: After docs reviewed, checkpoint v7.4.0**

### Checkpoint v7.5.0: Launch Prep

**Deliverable:** Beta users onboarded

| Task | Description | Output |
|------|-------------|--------|
| 7.5.1 | Onboarding flow | Welcome modal, tour |
| 7.5.2 | Sample templates | Pre-built diagrams (via admin UI) |
| 7.5.3 | Monitoring dashboard | Key metrics |
| 7.5.4 | Alerting rules | PagerDuty/Slack |
| 7.5.5 | Beta rollout | 10-20 users |

**STOP: After feedback collected, checkpoint v7.5.0 — LAUNCH READY**

---

## Summary Timeline

| Phase | Duration | Key Milestone |
|-------|----------|---------------|
| **Phase 0** | 3 days | Schema extensions complete |
| **Phase 1** | 1.5 weeks | Enhanced editor functional |
| **Phase 2** | 2 weeks | Threagile analysis working |
| **Phase 3** | 2 weeks | Admin console complete |
| **Phase 4** | 1.5 weeks | Compliance module ready |
| **Phase 5** | 1.5 weeks | Risk triage & tickets |
| **Phase 6** | 1.5 weeks | CI/CD & imports |
| **Phase 7** | 1 week | Launch ready |

**Total: 11 weeks** (down from 16 due to existing foundation)

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Threagile performance | Medium | High | Early load testing, container scaling |
| Claude API rate limits | Medium | Medium | Batching, caching, fallback mode |
| mxGraph complexity | Medium | Medium | Use existing diagram page as base |
| Schema migration issues | Low | High | Test on staging, rollback plan |
| Scope creep | High | High | Strict phase gates, reuse existing code |

---

## Document References

| Doc | Purpose |
|-----|---------|
| `00_overview.md` | Product summary, vision, tiers |
| `01_product_context.md` | Personas, stories, JTBD |
| `02_functional_spec.md` | Features, behaviors |
| `03_technical_spec.md` | Architecture, stack, APIs |
| `04_data_models.md` | Schema definitions, mappings |
| `05_ui_screens.md` | UI specifications |
| `06_user_flows.md` | User journeys |
| `07_admin_console.md` | Admin console spec |
| `08_rules.md` | Code constraints |
| **`09_implementation_plan.md`** | **This document** — Build phases |
| `10_gap_analysis.md` | Comparison with existing codebase |

---

*Last updated: 2025-01-23*
*Author: ThreatDiviner Product Team*
