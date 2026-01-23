# ThreatDiviner Threat Modeling — Gap Analysis

## Executive Summary

ThreatDiviner **already has a substantial threat modeling implementation**. Our new specification enhances and extends these capabilities rather than replacing them. The existing codebase provides a solid foundation, and the spec adds significant new features for automated analysis, visual editing, and enterprise workflows.

---

## Existing Implementation (Already Built)

### ✅ Database Schema (Prisma)

| Table | Status | Notes |
|-------|--------|-------|
| `ThreatModel` | ✅ Complete | Full CRUD with status, methodology, project linking |
| `ThreatModelComponent` | ✅ Complete | Position X/Y, metadata, technology, criticality |
| `ThreatModelDataFlow` | ✅ Complete | Source/target, protocol, auth, encryption |
| `Threat` | ✅ Complete | STRIDE category, CWE/CAPEC, risk score, status |
| `ThreatMitigation` | ✅ Complete | Status, priority, Jira integration |
| `ThreatComponentMapping` | ✅ Complete | Many-to-many threat↔component |
| `ThreatDataFlowMapping` | ✅ Complete | Many-to-many threat↔dataflow |
| `ThreatMitigationMapping` | ✅ Complete | Many-to-many threat↔mitigation |

### ✅ API Services (NestJS)

| Service | Status | Capabilities |
|---------|--------|--------------|
| `ThreatModelingService` | ✅ Complete | Full CRUD for models, components, dataflows, threats, mitigations |
| `StrideAnalyzer` | ✅ Complete | STRIDE category analysis |
| `DreadCalculator` | ✅ Complete | DREAD risk scoring |
| `LinddunAnalyzer` | ✅ Complete | Privacy threat analysis |
| `PastaAnalyzer` | ✅ Complete | Process-based threat analysis |
| `AttackTreeGenerator` | ✅ Complete | Attack path visualization |
| `TerraformParser` | ✅ Complete | IaC import |
| `OpenAPIParser` | ✅ Complete | API spec import |
| `DiagramService` | ✅ Exists | Basic diagram operations |
| `ExportService` | ✅ Exists | Basic export |

### ✅ Dashboard Pages (Next.js)

| Page | Status | Path |
|------|--------|------|
| Threat Model List | ✅ Exists | `/dashboard/threat-modeling/page.tsx` |
| Threat Model Detail | ✅ Exists | `/dashboard/threat-modeling/[id]/page.tsx` |
| New Threat Model | ✅ Exists | `/dashboard/threat-modeling/new/page.tsx` |
| Diagram Editor | ✅ Exists | `/dashboard/threat-modeling/[id]/diagram/page.tsx` |

### ✅ Platform Integration

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-tenancy | ✅ Complete | `tenantId` on all tables |
| Project linking | ✅ Complete | `projectId` foreign key |
| User context | ✅ Complete | `createdBy`, `lastModifiedBy` |
| Audit logging | ✅ Complete | Platform-wide audit service |
| AI integration | ✅ Complete | Claude provider for triage/fix |

---

## New Features from Specification (To Build)

### 🆕 Visual Diagram Editor Enhancements

| Feature | Spec Section | Priority | Notes |
|---------|--------------|----------|-------|
| mxGraph infinite canvas | 05_ui_screens §3 | High | Draw.io compatible, shape palette |
| Shape palette with categories | 05_ui_screens §3.3 | High | AWS/Azure/GCP/Generic icons |
| Property panel (enhanced) | 05_ui_screens §3.4 | High | Dynamic form based on element type |
| Trust boundary nesting | 04_data_models §3 | High | Visual boundary representation |
| Auto-layout algorithm | 05_ui_screens §3.2 | Medium | Force-directed graph layout |
| Minimap | 05_ui_screens §3.2 | Low | Navigation for large diagrams |

### 🆕 Threagile Integration

| Feature | Spec Section | Priority | Notes |
|---------|--------------|----------|-------|
| Threagile YAML generation | 04_data_models §3 | Critical | Convert internal model to Threagile format |
| Threagile Docker runner | 03_technical_spec §4 | Critical | Run Threagile analysis |
| Risk parsing & deduplication | 04_data_models §5 | Critical | Canonical risk mapping |
| Shape→Technology mapping | 04_data_models §4 | Critical | Admin-managed mappings |

### 🆕 Admin Console

| Feature | Spec Section | Priority | Notes |
|---------|--------------|----------|-------|
| Shape mapping admin | 07_admin_console §2 | High | CRUD for Draw.io→Threagile mappings |
| Canonical risk admin | 07_admin_console §3 | High | Deduplication rules |
| Remediation playbook admin | 07_admin_console §5 | Medium | Step-by-step guides with IaC |
| Wizard question admin | 07_admin_console §6 | Medium | Decision tree builder |
| Feed sync dashboard | 07_admin_console §7 | Medium | CWE/CAPEC/ATT&CK sync |
| AI recommendation queue | 07_admin_console §8 | Medium | Review AI suggestions |
| Staging→Production workflow | 07_admin_console §10 | High | Config promotion |

### 🆕 Enhanced Import Methods

| Feature | Spec Section | Priority | Notes |
|---------|--------------|----------|-------|
| Draw.io XML import | 06_user_flows §5.5 | High | Parse .drawio files |
| Document upload (PDF/Word) | 06_user_flows §3 | Medium | AI extraction |
| AI Chat builder | 06_user_flows §4 | Medium | Conversational diagram building |
| Guided wizard | 06_user_flows §5 | Medium | Question-based model creation |

### 🆕 Compliance Module

| Feature | Spec Section | Priority | Notes |
|---------|--------------|----------|-------|
| Framework management | 04_data_models §6 | High | ISO 27001, NIST, PCI-DSS, etc. |
| Risk→Control mapping | 04_data_models §6 | High | Automatic compliance gaps |
| Compliance reports | 05_ui_screens §11 | Medium | PDF/Excel export |
| Gap calculation | 06_user_flows §9 | Medium | % compliant per framework |

### 🆕 CI/CD Integration

| Feature | Spec Section | Priority | Notes |
|---------|--------------|----------|-------|
| GitHub webhook handler | 06_user_flows §11 | High | PR analysis trigger |
| PR comment posting | 06_user_flows §11 | High | Risk summary in PR |
| SARIF upload | 06_user_flows §11 | Medium | GitHub Security integration |
| Threshold configuration | 05_ui_screens §13 | Medium | Fail-on severity settings |

### 🆕 Locking & Collaboration

| Feature | Spec Section | Priority | Notes |
|---------|--------------|----------|-------|
| Lock acquisition | 06_user_flows §6 | High | Prevent concurrent edits |
| Share links | 06_user_flows §12 | Medium | View/comment/edit permissions |
| Comment system | 06_user_flows §12 | Low | Asset-level comments |

---

## Integration Points

### Database Schema Changes

The existing schema is **compatible** but needs extensions:

```prisma
// EXISTING (keep as-is)
model ThreatModel { ... }
model ThreatModelComponent { ... }
model ThreatModelDataFlow { ... }
model Threat { ... }
model ThreatMitigation { ... }

// NEW TABLES NEEDED
model DiagramVersion {
  id              String   @id @default(uuid())
  threatModelId   String   @map("threat_model_id")
  versionNumber   Int      @map("version_number")
  xmlContent      String   @map("xml_content") // Draw.io XML
  createdBy       String   @map("created_by")
  createdAt       DateTime @default(now())
  isAutoSave      Boolean  @default(false)
  threatModel     ThreatModel @relation(...)
}

model ThreatModelLock {
  id            String   @id @default(uuid())
  threatModelId String   @unique @map("threat_model_id")
  lockedBy      String   @map("locked_by")
  lockedAt      DateTime @default(now())
  expiresAt     DateTime @map("expires_at")
}

model AnalysisRun {
  id            String   @id @default(uuid())
  threatModelId String   @map("threat_model_id")
  status        String   // queued, running, completed, failed
  startedAt     DateTime?
  completedAt   DateTime?
  rawOutput     Json?
  riskCount     Int      @default(0)
  // ... links to generated risks
}

// ADMIN SCHEMA
model ShapeMapping { ... }
model CanonicalRisk { ... }
model ComplianceFramework { ... }
model ComplianceControl { ... }
model RemediationPlaybook { ... }
model WizardQuestion { ... }
```

### Service Layer Changes

| Existing Service | Enhancement Needed |
|------------------|-------------------|
| `ThreatModelingService` | Add locking, versioning, analysis queue |
| `DiagramService` | Add XML parsing, shape mapping, auto-layout |
| `ExportService` | Add Threagile YAML, SARIF, compliance reports |

| New Service | Purpose |
|-------------|---------|
| `ThreagileService` | Docker container management, YAML generation |
| `AnalysisQueueService` | BullMQ job processing |
| `CanonicalRiskService` | Risk deduplication and mapping |
| `ComplianceService` | Framework gaps calculation |
| `ShapeMappingService` | Draw.io→Threagile technology mapping |
| `WebhookService` | GitHub/GitLab/ADO integration |

### UI Component Changes

| Existing Component | Enhancement Needed |
|--------------------|-------------------|
| Diagram page | Full mxGraph editor with palette, properties |
| Model detail | Add compliance tab, risk panel, version history |
| Model list | Add templates, import options |

| New Component | Purpose |
|---------------|---------|
| `ShapePalette` | Draggable shape library |
| `PropertyPanel` | Dynamic form for selected element |
| `RiskPanel` | Grouped risk display with triage |
| `ComplianceTab` | Framework gaps visualization |
| `ProgressModal` | Analysis progress with WebSocket |
| `GapFillDialog` | Pre-analysis validation prompts |
| `AIChatDrawer` | Conversational diagram building |
| `WizardFlow` | Guided model creation |

---

## Recommended Implementation Order

Based on the gap analysis, here's the **adjusted implementation plan**:

### Phase 0: Schema Extensions (1 week)
- Add missing tables to Prisma schema
- Create migrations
- Update seed scripts
- **Uses existing**: Multi-tenancy, auth, audit

### Phase 1: Enhanced Editor (2 weeks)  
- mxGraph canvas with shape palette
- Property panel with validation
- Save/load XML versions
- **Uses existing**: ThreatModelComponent, ThreatModelDataFlow models

### Phase 2: Threagile Integration (2 weeks)
- YAML generator using existing components
- Docker runner service
- Risk parser → existing Threat model
- **Uses existing**: Threat, ThreatMitigation models

### Phase 3: Admin Console (2 weeks)
- Shape mapping CRUD
- Canonical risk mapping
- Compliance framework management
- **Uses existing**: Admin app shell at `/apps/admin`

### Phase 4: CI/CD & Compliance (2 weeks)
- Webhook handlers
- PR comments
- Compliance gap calculation
- **Uses existing**: AI service, project linking

### Phase 5: Import Enhancements (1 week)
- Draw.io XML import
- Document AI extraction
- **Uses existing**: TerraformParser, OpenAPIParser patterns

### Phase 6: Polish (1 week)
- Wizard flow
- AI chat builder
- Performance optimization
- **Uses existing**: Claude provider

---

## Summary

| Category | Existing | New | Effort |
|----------|----------|-----|--------|
| Database Tables | 8 | 10+ | Medium |
| API Services | 10+ | 8 | Medium |
| UI Pages | 4 | 6+ | High |
| Admin Screens | 3 | 12 | High |
| Integrations | Claude, Jira | Threagile, GitHub webhooks | Medium |

**Total New Development:** ~10-12 weeks  
**Reuse from Existing:** ~40% of foundation already built

The specification **complements** rather than replaces the existing implementation. Key advantages:
1. Existing data models are compatible
2. Platform services (auth, audit, multi-tenancy) are ready
3. AI integration already exists
4. Admin app shell is scaffolded
5. Analyzer patterns (STRIDE, DREAD) can be reused

**Recommendation:** Update spec documents to reference existing code paths and add "Uses Existing" annotations to the implementation plan.
