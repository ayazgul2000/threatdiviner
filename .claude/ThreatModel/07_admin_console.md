# 07 — Admin Console Specification

> ⚠️ **PLATFORM-LEVEL ADMIN CONSOLE**
> This admin console serves ALL ThreatDiviner modules (SAST, SCA, DAST, CSPM, Threat Modeling).
> Canonical risks, CWE/CVE mappings, compliance frameworks, and playbooks are shared — not threat-model-specific.
> Location: `apps/admin` (already scaffolded)

## Implementation Protocol

**CRITICAL: For every admin feature below, Claude Code must:**

1. **Implement** with full CRUD, validation, and audit logging
2. **Test** each feature with permission checks, edge cases, rollback scenarios
3. **Checkpoint** — Output: (a) screenshot, (b) test results, (c) audit log verified
4. **Await Approval** — Do NOT proceed to next feature until explicit approval received

**Never hardcode config data — data enters via this admin UI or feed sync only. See `08_rules.md §10`.**

---

## 0. Config Data Reference

### 0.1 Config Data Table

| Config Data | Feed Sync | AI Suggests | Admin Approves | Notes |
|-------------|-----------|-------------|----------------|-------|
| **Shape Mappings** | ❌ | ✅ On Draw.io stencil update | ✅ | No external feed; AI maps new shapes |
| **Canonical Risks** | ✅ CWE/CAPEC | ✅ Title/desc generation | ✅ Auto if high confidence | Shared across all scanners |
| **Canonical Risk Sources** | ✅ Auto during sync | ✅ Match by CWE/title | ✅ | Links Semgrep/Trivy/Threagile rules |
| **Compliance Frameworks** | ✅ NIST/CIS/PCI | ❌ | ✅ Custom only | Official structure from feeds |
| **Compliance Controls** | ✅ With framework | ❌ | ✅ Custom only | Hierarchy from feed |
| **Risk-Control Mappings** | ❌ | ✅ AI matches risk→control | ✅ | AI proposes, admin reviews |
| **Remediation Playbooks** | ❌ | ✅ Generate from CWE guidance | ✅ | AI drafts, admin refines |
| **Playbook Steps** | ❌ | ✅ With playbook | ✅ | Part of playbook generation |
| **Playbook IaC Snippets** | ❌ | ✅ Generate Terraform/K8s | ✅ | AI generates code |
| **Wizard Questions** | ❌ | ✅ From usage patterns | ✅ | Low priority for AI |
| **Wizard Options** | ❌ | ✅ With question | ✅ | Triggers/conditions |

### 0.2 Feed Sync Sources

| Feed | Source URL | Default Schedule | Creates/Updates |
|------|------------|------------------|-----------------|
| CWE | `cwe.mitre.org/data/xml` | Weekly | CanonicalRisk |
| CAPEC | `capec.mitre.org/data/xml` | Weekly | Links to CanonicalRisk |
| ATT&CK | `attack.mitre.org/data/stix` | Monthly | Attack technique refs |
| NIST 800-53 | `csrc.nist.gov` | On release | ComplianceFramework + Controls |
| CIS Benchmarks | `cisecurity.org` | On release | ComplianceFramework + Controls |
| NVD | `nvd.nist.gov/feeds` | Daily | CVE refs (for SCA) |
| Draw.io Stencils | Detect version change | On update | Triggers shape mapping AI |

### 0.3 Feed Sync Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FEED SYNC WORKFLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. SYNC RUNS (Cron or Manual)                                             │
│     └─► Feed job pulls from external source                                │
│     └─► Raw data written to `sync_staging` schema                          │
│     └─► Delta calculated (new/changed/removed)                             │
│                                                                             │
│  2. DELTA DETECTED                                                          │
│     └─► Admin sees notification: "+12 CWEs, +3 controls"                   │
│     └─► Admin reviews delta in Feed Sync page                              │
│                                                                             │
│  3. ADMIN TRIGGERS AI                                                       │
│     └─► Admin clicks "Generate Mappings" button                            │
│     └─► AI job processes delta items                                       │
│     └─► Results written to `staging` schema                                │
│                                                                             │
│  4. ADMIN REVIEWS AI OUTPUT                                                 │
│     └─► Summary: "12 risks, 45 control mappings, 8 playbooks"              │
│     └─► Detail view for each item                                          │
│     └─► Admin edits/fixes AI mistakes                                      │
│                                                                             │
│  5. ADMIN APPROVES TO STAGING                                               │
│     └─► Clicks "Deploy to Staging"                                         │
│     └─► `staging` schema finalized                                         │
│                                                                             │
│  6. ADMIN TESTS IN SANDBOX                                                  │
│     └─► Uses sandbox environment with staging data                         │
│     └─► Runs test scans, verifies mappings work                            │
│                                                                             │
│  7. ADMIN PROMOTES TO PROD                                                  │
│     └─► Clicks "Promote to Production"                                     │
│     └─► Data copied from `staging` to `prod` schema                        │
│     └─► Live for all users                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 0.4 Three-Schema Pattern

| Schema | Purpose | Who Writes | Who Reads |
|--------|---------|------------|-----------|
| `sync_staging` | Raw feed data | Feed sync jobs | Admin (delta review) |
| `staging` | AI-processed + admin-edited | Admin approval | Sandbox testing |
| `prod` | Live data | Promote action | All platform users |

---

## 1. Admin Console Overview

### 1.1 Purpose

The Admin Console is a separate application for managing ThreatDiviner's configuration data:

- Shape mappings (Draw.io → Threagile)
- Canonical risk mappings (deduplication rules)
- Compliance frameworks and controls
- Remediation playbooks
- Wizard questionnaires
- Feed synchronization
- AI recommendation review

### 1.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         admin.threatdiviner.com                             │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Shapes    │  │    Risks    │  │ Compliance  │  │  Playbooks  │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Wizard    │  │    Feeds    │  │  AI Queue   │  │   Sandbox   │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                              STAGING SCHEMA                                 │
│                           (admin.* tables)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                            PRODUCTION SCHEMA                                │
│                          (public.* tables)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, TailwindCSS, shadcn/ui |
| State | Zustand, React Query |
| API | GraphQL (Apollo) |
| Auth | Shared platform auth (JWT) |
| Database | Same Postgres, `admin.*` schema |

### 1.4 Role-Based Access

| Role | Permissions |
|------|-------------|
| **SuperAdmin** | Full access, promote to production, manage users |
| **ConfigAdmin** | Edit staging configs, submit for review, cannot promote |
| **Viewer** | Read-only access to all configs |

### 1.5 Staging vs Production

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     STAGING     │────▶│     REVIEW      │────▶│   PRODUCTION    │
│                 │     │                 │     │                 │
│ admin.* schema  │     │  Approval flow  │     │ public.* schema │
│ status=pending  │     │  status=review  │     │ status=live     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                                               │
         │              ┌─────────────────┐              │
         └──────────────│    ROLLBACK     │◀─────────────┘
                        └─────────────────┘
```

**Workflow:**
1. ConfigAdmin creates/edits in staging (`status: pending`)
2. Submit for review (`status: review`)
3. SuperAdmin reviews, tests in sandbox
4. Approve → Promote to production (`status: live`)
5. If issues: Rollback to previous version

---

## 2. Shape Mapping Management

### 2.1 Purpose

Map Draw.io shape styles to Threagile technology types and default properties.

### 2.2 List View Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ SHAPE MAPPINGS                                    [+ Add] [↑ Import] [⚙]  │
├────────────────────────────────────────────────────────────────────────────┤
│ [Search...] [Category ▼] [Status ▼] [AI Suggested ▼]     Showing 1-50/247 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌─ AWS ──────────────────────────────────────────────────────────────────┐ │
│ │                                                                        │ │
│ │ ☑ │ Icon │ Draw.io Style          │ Technology   │ Status  │ Actions  │ │
│ │───┼──────┼────────────────────────┼──────────────┼─────────┼──────────│ │
│ │ ☐ │ [EC2]│ mxgraph.aws4.ec2       │ web-server   │ 🟢 Live │ [⋮]      │ │
│ │ ☐ │ [RDS]│ mxgraph.aws4.rds       │ database     │ 🟢 Live │ [⋮]      │ │
│ │ ☐ │ [S3] │ mxgraph.aws4.s3        │ file-server  │ 🟢 Live │ [⋮]      │ │
│ │ ☐ │ [λ]  │ mxgraph.aws4.lambda    │ function     │ 🟡 Review│ [⋮]     │ │
│ │ ☐ │ [?]  │ mxgraph.aws4.glue      │ -            │ 🔴 Pending│[⋮]     │ │
│ │                                                                        │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌─ Azure ────────────────────────────────────────────────────────────────┐ │
│ │ ...                                                                    │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ [◀ Prev] Page 1 of 5 [Next ▶]                                             │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Edit Dialog

```
┌────────────────────────────────────────────────────────────────────────────┐
│ EDIT SHAPE MAPPING                                                    [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ Draw.io Style *                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ mxgraph.aws4.ec2                                                       │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ Style Pattern (regex, optional)                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ mxgraph\.aws4\.ec2.*                                                   │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ THREAGILE MAPPING                                                          │
│                                                                            │
│ Technology *                        Machine Type *                         │
│ ┌──────────────────────┐           ┌──────────────────────┐               │
│ │ web-server         ▼ │           │ virtual            ▼ │               │
│ └──────────────────────┘           └──────────────────────┘               │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ DEFAULT PROPERTIES                                                         │
│                                                                            │
│ ☐ Internet Facing                                                         │
│                                                                            │
│ Encryption                          Authentication                         │
│ ┌──────────────────────┐           ┌──────────────────────┐               │
│ │ none               ▼ │           │ none               ▼ │               │
│ └──────────────────────┘           └──────────────────────┘               │
│                                                                            │
│ ☐ Multi-Tenant    ☐ Custom Developed                                      │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ DISPLAY                                                                    │
│                                                                            │
│ Display Name                        Category                               │
│ ┌──────────────────────┐           ┌──────────────────────┐               │
│ │ AWS EC2              │           │ aws                ▼ │               │
│ └──────────────────────┘           └──────────────────────┘               │
│                                                                            │
│ Icon URL                                                                   │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ https://cdn.threatdiviner.com/icons/aws/ec2.svg                        │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ METADATA                                                                   │
│                                                                            │
│ Status: 🟢 Live                     AI Suggested: No                       │
│ Created: 2025-01-15 by @admin       Last Modified: 2025-01-20 by @john    │
│                                                                            │
│                                                                            │
│                        [Cancel]  [Save Draft]  [Submit for Review]         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Bulk Import

```
┌────────────────────────────────────────────────────────────────────────────┐
│ IMPORT SHAPE MAPPINGS                                                 [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ Upload CSV or JSON file with shape mappings.                               │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                        │ │
│ │                    📁 Drop file here or click to browse                │ │
│ │                                                                        │ │
│ │                         Supported: .csv, .json                         │ │
│ │                                                                        │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ [Download Template CSV] [Download Template JSON]                           │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ PREVIEW (showing 5 of 50)                                                  │
│                                                                            │
│ │ Style                    │ Technology  │ Status     │                   │
│ │──────────────────────────┼─────────────┼────────────│                   │
│ │ mxgraph.aws4.eks         │ container   │ ✓ Valid    │                   │
│ │ mxgraph.aws4.fargate     │ container   │ ✓ Valid    │                   │
│ │ mxgraph.aws4.invalid     │ unknown     │ ⚠ Warning  │                   │
│ │ mxgraph.aws4.duplicate   │ web-server  │ ✗ Duplicate│                   │
│                                                                            │
│ Summary: 47 valid, 2 warnings, 1 duplicate                                 │
│                                                                            │
│                              [Cancel]  [Import 47 Mappings]                │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.5 API Endpoints

```typescript
// List shape mappings
GET /api/admin/shape-mappings
Query: { search?, category?, status?, aiSuggested?, limit?, offset? }
Response: { mappings: ShapeMapping[], total: number }

// Get single mapping
GET /api/admin/shape-mappings/:id
Response: { mapping: ShapeMapping }

// Create mapping
POST /api/admin/shape-mappings
Body: { drawioStyle, technology, machine, defaults, display }
Response: { mapping: ShapeMapping }

// Update mapping
PUT /api/admin/shape-mappings/:id
Body: { ...fields }
Response: { mapping: ShapeMapping }

// Delete mapping
DELETE /api/admin/shape-mappings/:id
Response: { success: boolean }

// Submit for review
POST /api/admin/shape-mappings/:id/submit
Response: { mapping: ShapeMapping }

// Approve and promote
POST /api/admin/shape-mappings/:id/approve
Response: { mapping: ShapeMapping }

// Bulk import
POST /api/admin/shape-mappings/import
Body: { mappings: ShapeMapping[] }
Response: { imported: number, skipped: number, errors: Error[] }
```

### 2.6 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `SM-001` | List mappings | Load page | Mappings displayed, grouped |
| `SM-002` | Search by style | Type "lambda" | Filtered results |
| `SM-003` | Filter by status | Select "Pending" | Only pending shown |
| `SM-004` | Create mapping | Fill form, save | Mapping created as pending |
| `SM-005` | Edit mapping | Change technology | Updated, status→pending |
| `SM-006` | Submit for review | Click submit | Status→review |
| `SM-007` | Approve (SuperAdmin) | Click approve | Status→live, promoted |
| `SM-008` | Approve (ConfigAdmin) | Click approve | Permission denied |
| `SM-009` | Bulk import CSV | Upload valid CSV | Mappings imported |
| `SM-010` | Bulk import duplicates | Upload with dups | Duplicates skipped |
| `SM-011` | Delete live mapping | Try delete | Warning, requires confirmation |
| `SM-012` | Rollback mapping | Click rollback | Previous version restored |

---

## 3. Canonical Risk Mapping Management

### 3.1 Purpose

Manage deduplication rules that consolidate overlapping risks from different sources (Threagile, CWE, CIS, Prowler, Trivy).

### 3.2 List View Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ CANONICAL RISK MAPPINGS                               [+ Add] [↑ Import]  │
├────────────────────────────────────────────────────────────────────────────┤
│ [Search...] [Source ▼] [Severity ▼] [Status ▼]           Showing 1-25/156 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ │ ID                      │ Title                    │ CWE  │ Sources │ St│ │
│ │─────────────────────────┼──────────────────────────┼──────┼─────────┼───│ │
│ │ public-storage-exposure │ Public Cloud Storage     │ 732  │ 5       │ 🟢│ │
│ │ missing-authentication  │ Missing Authentication   │ 306  │ 4       │ 🟢│ │
│ │ unencrypted-transit     │ Unencrypted Transmission │ 319  │ 6       │ 🟢│ │
│ │ sql-injection           │ SQL Injection            │ 89   │ 3       │ 🟡│ │
│ │ weak-credentials        │ Weak Credentials         │ 521  │ 2       │ 🔴│ │
│                                                                            │
│ [◀ Prev] Page 1 of 7 [Next ▶]                                             │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Edit Dialog

```
┌────────────────────────────────────────────────────────────────────────────┐
│ EDIT CANONICAL RISK MAPPING                                           [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ Canonical ID *                                                             │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ public-storage-exposure                                                │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ Title *                                                                    │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ Public Cloud Storage Exposure                                          │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ Description                                                                │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ Cloud storage bucket or blob is publicly accessible, potentially       │ │
│ │ exposing sensitive data to unauthorized users.                         │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ Default Severity *                                                         │
│ ┌──────────────────────┐                                                  │
│ │ high               ▼ │                                                  │
│ └──────────────────────┘                                                  │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ EXTERNAL REFERENCES                                                        │
│                                                                            │
│ CWE ID              CWE Name                                               │
│ ┌────────┐         ┌────────────────────────────────────────────────────┐ │
│ │ 732    │         │ Incorrect Permission Assignment for Critical Res.  │ │
│ └────────┘         └────────────────────────────────────────────────────┘ │
│                                                                            │
│ CAPEC IDs (comma-separated)          ATT&CK Techniques                     │
│ ┌──────────────────────┐            ┌──────────────────────┐              │
│ │ 1, 122               │            │ T1530                │              │
│ └──────────────────────┘            └──────────────────────┘              │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ SOURCE MAPPINGS                                                  [+ Add]  │
│                                                                            │
│ │ Source    │ ID                        │ Title                 │ [×]    │ │
│ │───────────┼───────────────────────────┼───────────────────────┼────────│ │
│ │ threagile │ missing-access-restriction│ Missing Access Restr. │ [×]    │ │
│ │ cis       │ CIS-AWS-2.1.5             │ Ensure S3 not public  │ [×]    │ │
│ │ prowler   │ s3_bucket_public_access   │ S3 Bucket Public      │ [×]    │ │
│ │ trivy     │ AVD-AWS-0086              │ S3 public enabled     │ [×]    │ │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ [Source ▼] [ID...                ] [Title...              ] [+ Add]   │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│                        [Cancel]  [Save Draft]  [Submit for Review]         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 AI Suggestion for New Source

When a new risk ID is detected (e.g., new Prowler rule), AI suggests mapping:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 🤖 AI SUGGESTION                                                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ New risk detected: prowler/s3_bucket_versioning_disabled                   │
│                                                                            │
│ AI recommends mapping to:                                                  │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ Canonical: data-integrity-risk                                         │ │
│ │ Confidence: 78%                                                        │ │
│ │ Reason: S3 versioning relates to data integrity and recovery           │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ Alternative suggestions:                                                   │
│ • unencrypted-storage (45% confidence)                                    │
│ • NEW canonical risk (create new)                                         │
│                                                                            │
│                    [Reject]  [Edit & Accept]  [Accept as Suggested]        │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `CR-001` | List canonical risks | Load page | Risks displayed with source counts |
| `CR-002` | View sources | Expand risk | All source mappings shown |
| `CR-003` | Add source mapping | Add Prowler ID | Source added to list |
| `CR-004` | Remove source | Click × on source | Source removed |
| `CR-005` | AI suggestion appears | New risk detected | Suggestion shown in queue |
| `CR-006` | Accept AI suggestion | Click Accept | Mapping created |
| `CR-007` | Reject AI suggestion | Click Reject | Removed from queue |
| `CR-008` | Create new canonical | Fill form, save | New risk created |
| `CR-009` | Duplicate source | Add existing source | Error "Already mapped" |
| `CR-010` | Search by CWE | Search "89" | SQL injection shown |

---

## 4. Compliance Control Management

### 4.1 Purpose

Manage compliance frameworks, controls, and risk-to-control mappings.

### 4.2 Framework List

```
┌────────────────────────────────────────────────────────────────────────────┐
│ COMPLIANCE FRAMEWORKS                                            [+ Add]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ ISO/IEC 27001:2022                                              [⋮]   │ │
│ │ Version: 2022 │ Controls: 93 │ Mappings: 156 │ Status: 🟢 Live        │ │
│ │ Last sync: 2025-01-20                                                  │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ NIST SP 800-53 Rev 5                                            [⋮]   │ │
│ │ Version: Rev 5 │ Controls: 1007 │ Mappings: 423 │ Status: 🟢 Live     │ │
│ │ Last sync: 2025-01-18                                                  │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ VPDSS 2.0                                                       [⋮]   │ │
│ │ Version: 2.0 │ Controls: 18 │ Mappings: 45 │ Status: 🟢 Live          │ │
│ │ Last sync: Manual                                                      │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ PCI-DSS 4.0                                                     [⋮]   │ │
│ │ Version: 4.0 │ Controls: 250 │ Mappings: 89 │ Status: 🟡 Review       │ │
│ │ Last sync: 2025-01-22 (pending review)                                 │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Control Hierarchy Editor

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ISO 27001:2022 CONTROLS                                [+ Add] [↑ Import] │
├────────────────────────────────────────────────────────────────────────────┤
│ [Search controls...] [Filter: All ▼]                                      │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ▼ A.5 Organizational controls (37)                                        │
│   ├─ ▼ A.5.1 Policies for information security (2)                       │
│   │    ├─ A.5.1.1 Policies for information security              [Edit]  │
│   │    └─ A.5.1.2 Review of policies                             [Edit]  │
│   ├─ ► A.5.2 Information security roles (3)                              │
│   ├─ ► A.5.3 Segregation of duties (1)                                   │
│   └─ ...                                                                  │
│                                                                            │
│ ▼ A.6 People controls (8)                                                 │
│   ├─ ► A.6.1 Screening (1)                                               │
│   └─ ...                                                                  │
│                                                                            │
│ ▼ A.7 Physical controls (14)                                              │
│   └─ ...                                                                  │
│                                                                            │
│ ▼ A.8 Technological controls (34)                                         │
│   ├─ ► A.8.1 User endpoint devices (1)                                   │
│   ├─ ► A.8.2 Privileged access rights (1)                                │
│   ├─ A.8.3 Information access restriction                        [Edit]  │
│   ├─ A.8.4 Access to source code                                 [Edit]  │
│   ├─ A.8.5 Secure authentication                                 [Edit]  │
│   └─ ...                                                                  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Control Edit Dialog

```
┌────────────────────────────────────────────────────────────────────────────┐
│ EDIT CONTROL: A.8.5                                                   [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ Control ID *                        Framework                              │
│ ┌──────────────────────┐           ┌──────────────────────┐               │
│ │ A.8.5                │           │ ISO 27001:2022       │               │
│ └──────────────────────┘           └──────────────────────┘               │
│                                                                            │
│ Title *                                                                    │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ Secure authentication                                                  │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ Description                                                                │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ Secure authentication technologies and procedures shall be implemented │ │
│ │ based on information access restrictions and the topic-specific policy │ │
│ │ on access control.                                                     │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ Parent Control                      Level                                  │
│ ┌──────────────────────┐           ┌──────────────────────┐               │
│ │ A.8 Technological  ▼ │           │ 2 - Control        ▼ │               │
│ └──────────────────────┘           └──────────────────────┘               │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ MAPPED RISKS                                                     [+ Add]  │
│                                                                            │
│ │ Canonical Risk            │ Relevance │ AI Conf. │ Status    │ [×]     │ │
│ │───────────────────────────┼───────────┼──────────┼───────────┼─────────│ │
│ │ missing-authentication    │ Primary   │ 95%      │ 🟢 Live   │ [×]     │ │
│ │ weak-credentials          │ Primary   │ 89%      │ 🟢 Live   │ [×]     │ │
│ │ missing-mfa               │ Secondary │ 82%      │ 🟡 Review │ [×]     │ │
│                                                                            │
│                              [Cancel]  [Save]                              │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 Bulk Import from Feed

```
┌────────────────────────────────────────────────────────────────────────────┐
│ IMPORT CONTROLS FROM NIST                                             [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ Source: NIST SP 800-53 Rev 5 JSON Feed                                    │
│ URL: https://csrc.nist.gov/CSRC/media/Projects/...                        │
│                                                                            │
│ Last imported: 2024-12-15                                                  │
│ Available version: Rev 5.1.1 (2025-01-10)                                 │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ CHANGES DETECTED                                                           │
│                                                                            │
│ │ Change   │ Control │ Description                                       │ │
│ │──────────┼─────────┼───────────────────────────────────────────────────│ │
│ │ 🟢 New   │ AC-25   │ Reference Monitor                                 │ │
│ │ 🟡 Mod   │ AC-2    │ Updated guidance text                             │ │
│ │ 🟡 Mod   │ SC-8    │ Added implementation guidance                     │ │
│ │ 🔴 Dep   │ SA-18   │ Deprecated, merged into SA-8                      │ │
│                                                                            │
│ Total: 1 new, 2 modified, 1 deprecated                                    │
│                                                                            │
│ ☑ Auto-generate AI mapping suggestions for new controls                   │
│                                                                            │
│                              [Cancel]  [Preview Changes]  [Import]         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.6 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `CC-001` | List frameworks | Load page | All frameworks shown |
| `CC-002` | View control tree | Click framework | Hierarchy displayed |
| `CC-003` | Search controls | Type "authentication" | Matching controls shown |
| `CC-004` | Edit control | Click Edit | Dialog with details |
| `CC-005` | Add risk mapping | Add canonical risk | Mapping created |
| `CC-006` | Import from NIST | Click Import | Changes detected |
| `CC-007` | Preview import | Click Preview | Diff shown |
| `CC-008` | Execute import | Click Import | Controls updated |
| `CC-009` | Create framework | Fill form | Framework created |
| `CC-010` | Add child control | Click + Add | Control added to tree |

---

## 5. Remediation Playbook Editor

### 5.1 Purpose

Create and manage step-by-step remediation instructions with IaC snippets.

### 5.2 List View

```
┌────────────────────────────────────────────────────────────────────────────┐
│ REMEDIATION PLAYBOOKS                                 [+ Add] [↑ Import]  │
├────────────────────────────────────────────────────────────────────────────┤
│ [Search...] [Effort ▼] [Has IaC ▼] [Status ▼]            Showing 1-25/78  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ │ Canonical Risk            │ Title                │ Steps │ IaC │ Status│ │
│ │───────────────────────────┼──────────────────────┼───────┼─────┼───────│ │
│ │ public-storage-exposure   │ Restrict Public S3   │ 5     │ ✓   │ 🟢    │ │
│ │ unencrypted-transit       │ Enable TLS/HTTPS     │ 5     │ ✓   │ 🟢    │ │
│ │ missing-authentication    │ Implement Auth       │ 4     │ ✓   │ 🟢    │ │
│ │ sql-injection             │ Parameterize Queries │ 3     │ ✗   │ 🟡    │ │
│ │ weak-credentials          │ Enforce Strong Pwd   │ 4     │ ✓   │ 🔴    │ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Playbook Editor

```
┌────────────────────────────────────────────────────────────────────────────┐
│ EDIT PLAYBOOK: Enable TLS/HTTPS                                       [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ Canonical Risk *                                                           │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ unencrypted-transit - Unencrypted Data Transmission                  ▼ │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ Title *                                                                    │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ Enable TLS/HTTPS for Data Transmission                                 │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ Description                                                                │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ Implement transport layer encryption to protect data in transit        │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ REMEDIATION STEPS                                      [+ Add Step] [↕ ]  │
│                                                                            │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ Step 1                                                    [↑] [↓] [×]│  │
│ │ Title: Obtain TLS certificate                                        │  │
│ │ ┌────────────────────────────────────────────────────────────────┐   │  │
│ │ │ Provision a TLS certificate using AWS Certificate Manager,     │   │  │
│ │ │ Let's Encrypt, or your internal CA. Use 2048-bit RSA minimum. │   │  │
│ │ └────────────────────────────────────────────────────────────────┘   │  │
│ │ Effort: [Low ▼]    Role: [DevOps ▼]    Est. Minutes: [15]           │  │
│ │ ☑ Automatable                                                        │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ Step 2                                                    [↑] [↓] [×]│  │
│ │ Title: Configure load balancer for HTTPS                             │  │
│ │ ┌────────────────────────────────────────────────────────────────┐   │  │
│ │ │ Update ALB/NLB listener to terminate TLS. Use TLS 1.2+.        │   │  │
│ │ │ Disable deprecated protocols (SSLv3, TLS 1.0, TLS 1.1).        │   │  │
│ │ └────────────────────────────────────────────────────────────────┘   │  │
│ │ Effort: [Low ▼]    Role: [DevOps ▼]    Est. Minutes: [20]           │  │
│ │ ☑ Automatable                                                        │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ IAC SNIPPETS                                                               │
│                                                                            │
│ [Terraform] [CloudFormation] [Kubernetes] [Pulumi] [+ Add]                │
│                                                                            │
│ ┌─ Terraform ────────────────────────────────────────────────────────────┐ │
│ │ resource "aws_lb_listener" "https" {                                   │ │
│ │   load_balancer_arn = aws_lb.main.arn                                  │ │
│ │   port              = 443                                              │ │
│ │   protocol          = "HTTPS"                                          │ │
│ │   ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"           │ │
│ │   certificate_arn   = aws_acm_certificate.main.arn                     │ │
│ │                                                                        │ │
│ │   default_action {                                                     │ │
│ │     type             = "forward"                                       │ │
│ │     target_group_arn = aws_lb_target_group.main.arn                    │ │
│ │   }                                                                    │ │
│ │ }                                                                      │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ REFERENCES                                                       [+ Add]  │
│                                                                            │
│ │ Title                          │ URL                           │ [×]   │ │
│ │────────────────────────────────┼───────────────────────────────┼───────│ │
│ │ AWS ALB HTTPS Listener         │ docs.aws.amazon.com/...       │ [×]   │ │
│ │ Mozilla SSL Config Generator   │ ssl-config.mozilla.org/       │ [×]   │ │
│ │ OWASP TLS Cheat Sheet          │ cheatsheetseries.owasp.org/...│ [×]   │ │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ SATISFIES CONTROLS                                               [+ Add]  │
│                                                                            │
│ │ Framework    │ Control │ Title                               │ [×]     │ │
│ │──────────────┼─────────┼─────────────────────────────────────┼─────────│ │
│ │ ISO 27001    │ A.8.24  │ Use of cryptography                 │ [×]     │ │
│ │ NIST 800-53  │ SC-8    │ Transmission Confidentiality        │ [×]     │ │
│ │ PCI-DSS      │ 4.1     │ Strong cryptography during transit  │ [×]     │ │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ SUMMARY                                                                    │
│                                                                            │
│ Total Effort: Low (2 hours)                                               │
│ Roles Required: DevOps, Developer                                          │
│ Automatable Steps: 3/5                                                     │
│                                                                            │
│                   [Cancel]  [Save Draft]  [Preview]  [Submit for Review]   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Playbook Preview

```
┌────────────────────────────────────────────────────────────────────────────┐
│ PREVIEW: Enable TLS/HTTPS                                             [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ═══════════════════════════════════════════════════════════════════════   │
│ REMEDIATION PLAYBOOK                                                       │
│ Enable TLS/HTTPS for Data Transmission                                     │
│ ═══════════════════════════════════════════════════════════════════════   │
│                                                                            │
│ RISK: Unencrypted Data Transmission (CWE-319)                             │
│ EFFORT: Low (2 hours) | ROLES: DevOps, Developer                          │
│                                                                            │
│ ───────────────────────────────────────────────────────────────────────   │
│ STEP 1: Obtain TLS certificate                                            │
│ ───────────────────────────────────────────────────────────────────────   │
│ Effort: Low | Role: DevOps | Est: 15 min | Automatable: ✓                 │
│                                                                            │
│ Provision a TLS certificate using AWS Certificate Manager, Let's          │
│ Encrypt, or your internal CA. Use 2048-bit RSA minimum.                   │
│                                                                            │
│ ───────────────────────────────────────────────────────────────────────   │
│ STEP 2: Configure load balancer for HTTPS                                 │
│ ───────────────────────────────────────────────────────────────────────   │
│ ...                                                                        │
│                                                                            │
│ ───────────────────────────────────────────────────────────────────────   │
│ TERRAFORM SNIPPET                                                          │
│ ───────────────────────────────────────────────────────────────────────   │
│ ```hcl                                                                     │
│ resource "aws_lb_listener" "https" { ... }                                │
│ ```                                                                        │
│                                                                            │
│ ───────────────────────────────────────────────────────────────────────   │
│ REFERENCES                                                                 │
│ ───────────────────────────────────────────────────────────────────────   │
│ • AWS ALB HTTPS Listener: docs.aws.amazon.com/...                         │
│ • Mozilla SSL Config Generator: ssl-config.mozilla.org/                   │
│                                                                            │
│                                                              [Close]       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.5 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `PB-001` | List playbooks | Load page | Playbooks shown with metadata |
| `PB-002` | Create playbook | Fill form | Playbook created as pending |
| `PB-003` | Add step | Click + Add Step | New step added to list |
| `PB-004` | Reorder steps | Drag step 3 to 1 | Order updated |
| `PB-005` | Add IaC snippet | Add Terraform tab | Snippet saved |
| `PB-006` | Validate IaC | Invalid HCL | Syntax error shown |
| `PB-007` | Add reference | Enter URL | Reference added |
| `PB-008` | Link control | Select ISO A.8.24 | Control linked |
| `PB-009` | Preview playbook | Click Preview | Formatted preview shown |
| `PB-010` | AI generate playbook | Click Generate | AI draft created |

---

## 6. Wizard Question Builder

### 6.1 Purpose

Create and manage the wizard questionnaire flow with conditional logic and triggers.

### 6.2 Decision Tree View

```
┌────────────────────────────────────────────────────────────────────────────┐
│ WIZARD QUESTIONS                                      [+ Add] [Test Flow] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                          ┌─────────────────┐                              │
│                          │  q_app_type     │                              │
│                          │  "What type of  │                              │
│                          │   application?" │                              │
│                          └────────┬────────┘                              │
│                    ┌──────────────┼──────────────┐                        │
│                    ▼              ▼              ▼                        │
│          ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                  │
│          │  web-app    │ │ api-service │ │mobile-backend│                  │
│          └──────┬──────┘ └──────┬──────┘ └──────┬──────┘                  │
│                 │               │               │                         │
│                 └───────────────┼───────────────┘                         │
│                                 ▼                                         │
│                       ┌─────────────────┐                                 │
│                       │ q_cloud_provider│                                 │
│                       │  "Which cloud?" │                                 │
│                       └────────┬────────┘                                 │
│                 ┌──────────────┼──────────────┐                           │
│                 ▼              ▼              ▼                           │
│        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                    │
│        │    aws      │ │   azure     │ │    gcp      │                    │
│        └──────┬──────┘ └──────┬──────┘ └──────┬──────┘                    │
│               │               │               │                           │
│               ▼               ▼               ▼                           │
│        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                    │
│        │q_compute_aws│ │q_compute_az │ │q_compute_gcp│                    │
│        └─────────────┘ └─────────────┘ └─────────────┘                    │
│                                                                            │
│ [Zoom In] [Zoom Out] [Fit] [Export]                                       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Question Editor

```
┌────────────────────────────────────────────────────────────────────────────┐
│ EDIT QUESTION: q_cloud_provider                                       [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ Question ID *                       Order Index                            │
│ ┌──────────────────────┐           ┌──────────────────────┐               │
│ │ q_cloud_provider     │           │ 2                    │               │
│ └──────────────────────┘           └──────────────────────┘               │
│                                                                            │
│ Question Text *                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ Which cloud provider hosts your infrastructure?                        │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ Help Text                                                                  │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ Select your primary cloud provider. Multi-cloud setups are supported. │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ Question Type *                                                            │
│ ┌──────────────────────┐                                                  │
│ │ single-select      ▼ │  ○ single-select  ○ multi-select                │
│ └──────────────────────┘  ○ text           ○ toggle                      │
│                                                                            │
│ ☐ Is Entry Point    ☐ Is Terminal                                         │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ CONDITIONS (show question only if)                               [+ Add]  │
│                                                                            │
│ │ Property        │ Operator │ Value                            │ [×]    │ │
│ │─────────────────┼──────────┼──────────────────────────────────┼────────│ │
│ │ appType         │ in       │ web-app, api-service, mobile     │ [×]    │ │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ OPTIONS                                                          [+ Add]  │
│                                                                            │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ Option 1                                                   [↑] [↓] [×]│  │
│ │ Value: aws    Label: Amazon Web Services    Icon: aws-icon           │  │
│ │ Description: AWS cloud infrastructure                                 │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ Option 2                                                   [↑] [↓] [×]│  │
│ │ Value: azure  Label: Microsoft Azure        Icon: azure-icon         │  │
│ │ Description: Azure cloud infrastructure                               │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ TRIGGERS (per option)                                                      │
│                                                                            │
│ ┌─ aws ──────────────────────────────────────────────────────────────────┐ │
│ │ Next Question: q_compute_aws                                           │ │
│ │                                                                        │ │
│ │ Add Boundaries:                                            [+ Add]     │ │
│ │ • { name: "AWS Cloud", type: "network-cloud-provider", ref: "cloud" } │ │
│ │ • { name: "VPC", type: "network-cloud-security-group", ref: "vpc" }   │ │
│ │                                                                        │ │
│ │ Set Global Properties:                                     [+ Add]     │ │
│ │ • cloudProvider = "aws"                                                │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌─ azure ────────────────────────────────────────────────────────────────┐ │
│ │ Next Question: q_compute_azure                                         │ │
│ │ ...                                                                    │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│                              [Cancel]  [Save]  [Test Question]             │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Trigger Configuration

```
┌────────────────────────────────────────────────────────────────────────────┐
│ EDIT TRIGGER: aws                                                     [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ Next Question ID                                                           │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ q_compute_aws                                                        ▼ │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ ADD NODES                                                        [+ Add]  │
│                                                                            │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ Node 1                                                            [×] │  │
│ │ Name: [Browser        ]  Ref: [client        ]                       │  │
│ │ Technology: [browser ▼]  Machine: [virtual ▼]                        │  │
│ │ Placement: [○ Outside  ● Inside boundary: cloud               ]      │  │
│ │                                                                       │  │
│ │ Defaults:                                                             │  │
│ │ ☐ Internet Facing  ☐ Multi-Tenant                                    │  │
│ │ Encryption: [none ▼]  Auth: [none ▼]                                 │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ ADD BOUNDARIES                                                   [+ Add]  │
│                                                                            │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ Boundary 1                                                        [×] │  │
│ │ Name: [AWS Cloud                  ]  Ref: [cloud      ]              │  │
│ │ Type: [network-cloud-provider ▼]                                     │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ ADD LINKS                                                        [+ Add]  │
│                                                                            │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ Link 1                                                            [×] │  │
│ │ Source Ref: [client  ]  Target Ref: [alb     ]                       │  │
│ │ Protocol: [https ▼]  Auth: [none ▼]  Encryption: [tls ▼]            │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ SET GLOBAL PROPERTIES                                            [+ Add]  │
│                                                                            │
│ │ Property        │ Value                                        │ [×]   │ │
│ │─────────────────┼──────────────────────────────────────────────┼───────│ │
│ │ cloudProvider   │ aws                                          │ [×]   │ │
│                                                                            │
│                                              [Cancel]  [Save Trigger]      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.5 Test Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│ TEST WIZARD FLOW                                                      [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌─ SIMULATOR ──────────────────────────┬─ PREVIEW ────────────────────┐   │
│ │                                      │                              │   │
│ │ Q1: What type of application?        │   ┌─────────┐                │   │
│ │ Selected: ● Web Application          │   │ Browser │                │   │
│ │                                      │   └────┬────┘                │   │
│ │ Q2: Which cloud provider?            │        │                     │   │
│ │ Selected: ● AWS                      │   ┌────┴────┐                │   │
│ │                                      │   │ AWS VPC │                │   │
│ │ Q3: Compute type?                    │   │ ┌─────┐ │                │   │
│ │ Selected: ● ECS                      │   │ │ ECS │ │                │   │
│ │                                      │   │ └─────┘ │                │   │
│ │ Q4: Database?                        │   └─────────┘                │   │
│ │ Options: ○ RDS  ○ DynamoDB  ○ None  │                              │   │
│ │                                      │                              │   │
│ │ [← Back]              [Next →]       │                              │   │
│ │                                      │                              │   │
│ └──────────────────────────────────────┴──────────────────────────────┘   │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ DEBUG OUTPUT                                                               │
│                                                                            │
│ globalProperties: { appType: "web-app", cloudProvider: "aws" }            │
│ nodes: [Browser, ECS]                                                      │
│ boundaries: [AWS Cloud, VPC]                                               │
│ links: [Browser→ECS]                                                       │
│                                                                            │
│                                                                   [Close]  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.6 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `WQ-001` | View decision tree | Load page | Tree visualization shown |
| `WQ-002` | Add question | Click + Add | New question created |
| `WQ-003` | Edit question text | Change text | Text updated |
| `WQ-004` | Add option | Click + Add Option | Option added |
| `WQ-005` | Configure trigger | Add boundary trigger | Trigger saved |
| `WQ-006` | Set condition | Add condition | Question conditionally shown |
| `WQ-007` | Test flow | Click Test Flow | Simulator opens |
| `WQ-008` | Simulate answers | Select options | Preview updates |
| `WQ-009` | Circular reference | Point Q2 → Q1 | Error "Circular reference" |
| `WQ-010` | Orphan question | Question with no path | Warning shown |

---

## 7. Feed Sync Dashboard

### 7.1 Purpose

Monitor and manage synchronization of external security data feeds.

### 7.2 Dashboard Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ FEED SYNCHRONIZATION                                          [⟳ Sync All]│
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌─ CWE (Common Weakness Enumeration) ────────────────────────────────────┐ │
│ │ Source: mitre.org/cwe                                                  │ │
│ │ Last Sync: 2025-01-22 03:00 UTC    Schedule: Daily 03:00 UTC          │ │
│ │ Status: ✓ Healthy                  Items: 943 weaknesses              │ │
│ │ Last Changes: +2 new, 5 modified                                       │ │
│ │                                              [View Log] [Sync Now] [⚙] │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌─ CAPEC (Attack Patterns) ──────────────────────────────────────────────┐ │
│ │ Source: capec.mitre.org                                                │ │
│ │ Last Sync: 2025-01-22 03:15 UTC    Schedule: Daily 03:00 UTC          │ │
│ │ Status: ✓ Healthy                  Items: 559 patterns               │ │
│ │ Last Changes: 0 new, 1 modified                                        │ │
│ │                                              [View Log] [Sync Now] [⚙] │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌─ MITRE ATT&CK ─────────────────────────────────────────────────────────┐ │
│ │ Source: attack.mitre.org                                               │ │
│ │ Last Sync: 2025-01-21 03:00 UTC    Schedule: Weekly Sun 03:00 UTC     │ │
│ │ Status: ✓ Healthy                  Items: 193 techniques             │ │
│ │ Last Changes: +1 new, 3 modified                                       │ │
│ │                                              [View Log] [Sync Now] [⚙] │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌─ NVD (National Vulnerability Database) ────────────────────────────────┐ │
│ │ Source: nvd.nist.gov                                                   │ │
│ │ Last Sync: 2025-01-22 06:00 UTC    Schedule: Every 6 hours            │ │
│ │ Status: ⚠ Warning (rate limited)   Items: 234,567 CVEs               │ │
│ │ Last Changes: +47 new, 123 modified                                    │ │
│ │                                              [View Log] [Sync Now] [⚙] │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌─ CIS Benchmarks ───────────────────────────────────────────────────────┐ │
│ │ Source: cisecurity.org (manual)                                        │ │
│ │ Last Sync: 2025-01-15 (manual)     Schedule: Manual                   │ │
│ │ Status: ✓ Healthy                  Items: 847 controls               │ │
│ │ Last Changes: Manual import of AWS v2.0                                │ │
│ │                                              [View Log] [Import] [⚙]  │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Feed Configuration

```
┌────────────────────────────────────────────────────────────────────────────┐
│ CONFIGURE FEED: CWE                                                   [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ Feed Name: CWE (Common Weakness Enumeration)                               │
│                                                                            │
│ Source URL                                                                 │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ https://cwe.mitre.org/data/xml/cwec_latest.xml.zip                     │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ Format: [XML ▼]                       Parser: [CWE XML Parser ▼]          │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ SCHEDULE                                                                   │
│                                                                            │
│ ● Scheduled    ○ Manual only                                              │
│                                                                            │
│ Frequency: [Daily ▼]    Time: [03:00 ▼] UTC                               │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ ON SYNC                                                                    │
│                                                                            │
│ ☑ Auto-create canonical risk mappings for new CWEs                        │
│ ☑ Generate AI mapping suggestions                                         │
│ ☑ Send notification on new items                                          │
│ ☐ Auto-approve AI suggestions (not recommended)                           │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ NOTIFICATIONS                                                              │
│                                                                            │
│ Email: admin@threatdiviner.com                                             │
│ Slack: #security-feeds                                                     │
│                                                                            │
│                                              [Cancel]  [Save Configuration]│
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 7.4 Sync Log Viewer

```
┌────────────────────────────────────────────────────────────────────────────┐
│ SYNC LOG: CWE - 2025-01-22 03:00 UTC                                  [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ Status: ✓ Completed successfully                                          │
│ Duration: 2m 34s                                                           │
│ Items Processed: 943                                                       │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ CHANGES                                                                    │
│                                                                            │
│ NEW (2):                                                                   │
│ • CWE-1395: Incomplete Enforcement of Token Binding                       │
│ • CWE-1396: Improper Handling of Physical Side-Channel Attacks            │
│                                                                            │
│ MODIFIED (5):                                                              │
│ • CWE-79: Cross-site Scripting - Updated examples                         │
│ • CWE-89: SQL Injection - Added remediation guidance                      │
│ • CWE-306: Missing Authentication - Updated references                    │
│ • CWE-732: Incorrect Permission Assignment - New relationships            │
│ • CWE-798: Hard-coded Credentials - Added detection methods               │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ AI SUGGESTIONS GENERATED                                                   │
│                                                                            │
│ • CWE-1395 → Suggested mapping to: token-validation-failure (72% conf)   │
│ • CWE-1396 → Suggested: CREATE NEW canonical risk (85% conf)             │
│                                                                            │
│ [View in AI Queue]                                                        │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ RAW LOG                                                                    │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ [03:00:01] Starting CWE sync...                                        │ │
│ │ [03:00:02] Downloading cwec_latest.xml.zip                             │ │
│ │ [03:00:15] Download complete (12.4 MB)                                 │ │
│ │ [03:00:16] Extracting archive...                                       │ │
│ │ [03:00:18] Parsing XML (943 weaknesses)...                             │ │
│ │ [03:02:01] Comparing with existing data...                             │ │
│ │ [03:02:25] Found 2 new, 5 modified                                     │ │
│ │ [03:02:26] Updating database...                                        │ │
│ │ [03:02:34] Generating AI suggestions...                                │ │
│ │ [03:02:35] Sync complete                                               │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│                                                                   [Close]  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 7.5 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `FS-001` | View feed status | Load page | All feeds shown with status |
| `FS-002` | Manual sync | Click Sync Now | Sync executes |
| `FS-003` | View sync log | Click View Log | Log details shown |
| `FS-004` | Configure schedule | Change to weekly | Schedule updated |
| `FS-005` | Feed error | Simulate timeout | Error status shown |
| `FS-006` | Rate limited | NVD rate limit | Warning status |
| `FS-007` | New items | After sync with new CWEs | AI suggestions created |
| `FS-008` | Sync all | Click Sync All | All feeds sync |
| `FS-009` | Disable feed | Toggle off | Feed skipped in sync |
| `FS-010` | Import CIS | Upload PDF | Controls imported |

---

## 8. AI Recommendation Queue

### 8.1 Purpose

Review and approve AI-generated suggestions for mappings and playbooks.

### 8.2 Queue Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ AI RECOMMENDATION QUEUE                              [Bulk Actions ▼] [⟳] │
├────────────────────────────────────────────────────────────────────────────┤
│ [All ▼] [Type ▼] [Confidence ▼]                          23 pending items │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ ☐  SHAPE MAPPING                                         95% confidence│ │
│ │ ───────────────────────────────────────────────────────────────────── │ │
│ │ New shape detected: mxgraph.aws4.bedrock                              │ │
│ │ Suggested mapping: → ai-service (technology)                          │ │
│ │                    → serverless (machine)                             │ │
│ │                                                                        │ │
│ │ Reason: AWS Bedrock is a managed AI/ML service                        │ │
│ │ Source: User diagram upload (model-123)                               │ │
│ │ Created: 2 hours ago                                                   │ │
│ │                                                                        │ │
│ │                          [Reject]  [Edit]  [Approve]                  │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ ☐  CANONICAL RISK MAPPING                                85% confidence│ │
│ │ ───────────────────────────────────────────────────────────────────── │ │
│ │ New CWE detected: CWE-1395 (Incomplete Token Binding)                 │ │
│ │ Suggested mapping: → token-validation-failure (existing)              │ │
│ │                                                                        │ │
│ │ Reason: CWE-1395 relates to token binding which aligns with           │ │
│ │         existing token-validation-failure canonical risk              │ │
│ │ Source: CWE feed sync                                                  │ │
│ │ Created: 5 hours ago                                                   │ │
│ │                                                                        │ │
│ │                          [Reject]  [Edit]  [Approve]                  │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ ☐  NEW CANONICAL RISK                                    78% confidence│ │
│ │ ───────────────────────────────────────────────────────────────────── │ │
│ │ AI suggests creating new canonical risk:                              │ │
│ │ ID: side-channel-attack                                               │ │
│ │ Title: Physical Side-Channel Attack Vulnerability                     │ │
│ │ CWE: 1396                                                              │ │
│ │                                                                        │ │
│ │ Reason: CWE-1396 is a new weakness category without existing mapping  │ │
│ │ Source: CWE feed sync                                                  │ │
│ │ Created: 5 hours ago                                                   │ │
│ │                                                                        │ │
│ │                          [Reject]  [Edit]  [Approve]                  │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ ☐  REMEDIATION PLAYBOOK                                  72% confidence│ │
│ │ ───────────────────────────────────────────────────────────────────── │ │
│ │ AI generated playbook for: container-escape-vulnerability             │ │
│ │ Steps: 4 remediation steps                                            │ │
│ │ IaC: Kubernetes manifest included                                     │ │
│ │                                                                        │ │
│ │ [Preview Playbook]                                                     │ │
│ │                          [Reject]  [Edit]  [Approve]                  │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ [◀ Prev] Page 1 of 3 [Next ▶]                                             │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Edit Before Approve

```
┌────────────────────────────────────────────────────────────────────────────┐
│ EDIT AI SUGGESTION: Shape Mapping                                     [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ AI SUGGESTION                                                              │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ Shape: mxgraph.aws4.bedrock                                            │ │
│ │ Technology: ai-service                                                 │ │
│ │ Machine: serverless                                                    │ │
│ │ Confidence: 95%                                                        │ │
│ │ Reason: AWS Bedrock is a managed AI/ML service                        │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ YOUR EDITS                                                                 │
│                                                                            │
│ Technology *                        Machine Type *                         │
│ ┌──────────────────────┐           ┌──────────────────────┐               │
│ │ ai-service         ▼ │           │ serverless         ▼ │               │
│ └──────────────────────┘           └──────────────────────┘               │
│                                                                            │
│ Display Name                        Category                               │
│ ┌──────────────────────┐           ┌──────────────────────┐               │
│ │ AWS Bedrock          │           │ aws                ▼ │               │
│ └──────────────────────┘           └──────────────────────┘               │
│                                                                            │
│ Default Properties:                                                        │
│ ☐ Internet Facing                                                         │
│ Encryption: [transparent ▼]  Auth: [token ▼]                              │
│                                                                            │
│ Edit Notes (optional)                                                      │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ Added default encryption and auth settings                             │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│                              [Cancel]  [Save & Approve]                    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 8.4 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `AQ-001` | View queue | Load page | Pending items shown |
| `AQ-002` | Filter by type | Select "Shape Mapping" | Only shapes shown |
| `AQ-003` | Filter by confidence | Select ">80%" | High confidence only |
| `AQ-004` | Approve directly | Click Approve | Item moved to staging |
| `AQ-005` | Reject item | Click Reject | Item removed from queue |
| `AQ-006` | Edit before approve | Click Edit, modify | Edited version approved |
| `AQ-007` | Bulk approve | Select 5, Bulk Approve | All 5 approved |
| `AQ-008` | Bulk reject | Select 3, Bulk Reject | All 3 rejected |
| `AQ-009` | Preview playbook | Click Preview | Playbook displayed |
| `AQ-010` | Low confidence warning | <50% confidence | Warning badge shown |

---

## 9. Sandbox Testing Environment

### 9.1 Purpose

Test configuration changes against sample data before promoting to production.

### 9.2 Sandbox Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ SANDBOX TESTING                                                           │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌─ TEST SHAPE MAPPINGS ─────────────────────────────────────────────────┐ │
│ │                                                                        │ │
│ │ Upload a Draw.io diagram to test shape recognition:                   │ │
│ │                                                                        │ │
│ │ ┌────────────────────────────────────────────────────────────────┐    │ │
│ │ │                    📁 Drop .drawio file here                   │    │ │
│ │ └────────────────────────────────────────────────────────────────┘    │ │
│ │                                                                        │ │
│ │ Or use sample diagram: [AWS 3-Tier ▼] [Load]                          │ │
│ │                                                                        │ │
│ │ ─────────────────────────────────────────────────────────────────     │ │
│ │ RESULTS                                                                │ │
│ │                                                                        │ │
│ │ │ Shape Style              │ Mapped To      │ Status    │ Config     │ │ │
│ │ │──────────────────────────┼────────────────┼───────────┼────────────│ │ │
│ │ │ mxgraph.aws4.ec2         │ web-server     │ ✓ Live    │ [View]     │ │ │
│ │ │ mxgraph.aws4.rds         │ database       │ ✓ Live    │ [View]     │ │ │
│ │ │ mxgraph.aws4.bedrock     │ ai-service     │ 🟡 Staging│ [View]     │ │ │
│ │ │ mxgraph.aws4.unknown     │ -              │ ❌ Missing│ [Create]   │ │ │
│ │                                                                        │ │
│ │ Summary: 3 mapped (2 live, 1 staging), 1 unmapped                     │ │
│ │                                                                        │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌─ TEST RISK DEDUPLICATION ─────────────────────────────────────────────┐ │
│ │                                                                        │ │
│ │ Enter risk IDs to test deduplication:                                 │ │
│ │                                                                        │ │
│ │ ┌────────────────────────────────────────────────────────────────┐    │ │
│ │ │ missing-access-restriction, CIS-AWS-2.1.5, s3_bucket_public    │    │ │
│ │ └────────────────────────────────────────────────────────────────┘    │ │
│ │                                                        [Test]         │ │
│ │                                                                        │ │
│ │ RESULT:                                                                │ │
│ │ All 3 risks deduplicate to: public-storage-exposure                   │ │
│ │ Sources preserved: threagile, cis, prowler                            │ │
│ │                                                                        │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌─ TEST PLAYBOOK RENDERING ─────────────────────────────────────────────┐ │
│ │                                                                        │ │
│ │ Select playbook to preview:                                            │ │
│ │ ┌────────────────────────────────────────────────────────────────┐    │ │
│ │ │ unencrypted-transit - Enable TLS/HTTPS                       ▼ │    │ │
│ │ └────────────────────────────────────────────────────────────────┘    │ │
│ │                                                                        │ │
│ │ Test with risk context:                                                │ │
│ │ Asset: [API Server ▼]  Technology: [web-server ▼]                     │ │
│ │                                                                        │ │
│ │                                             [Render Preview]          │ │
│ │                                                                        │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `SB-001` | Upload diagram | Drop .drawio file | Shapes analyzed |
| `SB-002` | All shapes mapped | Known shapes | All show ✓ |
| `SB-003` | Unknown shape | New shape | Shows ❌ Missing |
| `SB-004` | Create from sandbox | Click Create | Opens shape editor |
| `SB-005` | Test deduplication | Enter risk IDs | Canonical shown |
| `SB-006` | Dedup fails | Unknown risk ID | Error message |
| `SB-007` | Render playbook | Select and render | Preview shown |
| `SB-008` | Playbook with context | Add asset context | Personalized output |

---

## 10. Promotion Workflow

### 10.1 Workflow States

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   PENDING   │────▶│   REVIEW    │────▶│  APPROVED   │────▶│    LIVE     │
│  (staging)  │     │  (staging)  │     │  (staging)  │     │(production) │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
   [Edit]            [Request Changes]   [Promote]          [Rollback]
      │                   │                                       │
      │                   │                                       │
      └───────────────────┘                                       │
                                                                  │
                          ┌─────────────┐                         │
                          │  ARCHIVED   │◀────────────────────────┘
                          │  (backup)   │
                          └─────────────┘
```

### 10.2 Review Queue

```
┌────────────────────────────────────────────────────────────────────────────┐
│ PENDING REVIEW                                          [SuperAdmin Only] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ SHAPE MAPPING: mxgraph.aws4.bedrock                                    │ │
│ │ Submitted by: @john on 2025-01-22 10:30                               │ │
│ │ Changes: New mapping (AI-suggested, edited)                            │ │
│ │                                                                        │ │
│ │ [View Details]  [Test in Sandbox]  [Request Changes]  [Approve]       │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ REMEDIATION PLAYBOOK: container-escape-vulnerability                   │ │
│ │ Submitted by: @jane on 2025-01-22 09:15                               │ │
│ │ Changes: New playbook (AI-generated, reviewed)                         │ │
│ │                                                                        │ │
│ │ [View Details]  [Test in Sandbox]  [Request Changes]  [Approve]       │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Promotion Dialog

```
┌────────────────────────────────────────────────────────────────────────────┐
│ PROMOTE TO PRODUCTION                                                 [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ⚠️ You are about to promote the following items to production:            │
│                                                                            │
│ • Shape Mapping: mxgraph.aws4.bedrock → ai-service                        │
│ • Remediation Playbook: container-escape-vulnerability                    │
│                                                                            │
│ This will make these configurations available to all users immediately.   │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│                                                                            │
│ ☑ I have tested these changes in the sandbox                              │
│ ☑ I understand this affects production users                              │
│                                                                            │
│ Promotion Notes (optional)                                                 │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ Adding support for AWS Bedrock shapes and container escape playbook   │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│                                              [Cancel]  [Promote to Live]   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.4 Rollback

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ROLLBACK CONFIGURATION                                                [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ⚠️ Rolling back: Shape Mapping mxgraph.aws4.bedrock                       │
│                                                                            │
│ Current (Live):                                                            │
│ • Technology: ai-service                                                   │
│ • Machine: serverless                                                      │
│ • Promoted: 2025-01-22 14:30 by @admin                                    │
│                                                                            │
│ Previous Version:                                                          │
│ • (No previous version - this is a new mapping)                           │
│                                                                            │
│ Rollback Action:                                                           │
│ ● Delete mapping entirely (revert to unmapped)                            │
│ ○ Restore previous version (not available)                                │
│                                                                            │
│ Reason for Rollback *                                                      │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ Incorrect technology type causing analysis errors                      │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│                                              [Cancel]  [Confirm Rollback]  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.5 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `PW-001` | Submit for review | Click Submit | Status→review |
| `PW-002` | View pending reviews | Load review queue | Items listed |
| `PW-003` | Approve item | Click Approve | Status→approved |
| `PW-004` | Request changes | Click Request Changes | Status→pending, notes added |
| `PW-005` | Promote to live | Click Promote | Copied to production |
| `PW-006` | Promote without checkbox | Try promote | Button disabled |
| `PW-007` | Rollback to previous | Click Rollback | Previous version restored |
| `PW-008` | Rollback new item | Rollback new mapping | Mapping deleted |
| `PW-009` | ConfigAdmin promote | Try to promote | Permission denied |
| `PW-010` | Audit trail | Check logs | All actions logged |

---

## 11. Audit Log Viewer

### 11.1 Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ AUDIT LOG                                                     [↓ Export]  │
├────────────────────────────────────────────────────────────────────────────┤
│ [Search...] [User ▼] [Action ▼] [Resource ▼] [From ▼] [To ▼]   [Filter]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ │ Timestamp           │ User  │ Action   │ Resource              │ Detail│ │
│ │─────────────────────┼───────┼──────────┼───────────────────────┼───────│ │
│ │ 2025-01-22 14:30:15 │ @admin│ PROMOTE  │ shape_mapping/abc123  │ [View]│ │
│ │ 2025-01-22 14:25:03 │ @admin│ APPROVE  │ shape_mapping/abc123  │ [View]│ │
│ │ 2025-01-22 10:30:45 │ @john │ SUBMIT   │ shape_mapping/abc123  │ [View]│ │
│ │ 2025-01-22 10:28:12 │ @john │ UPDATE   │ shape_mapping/abc123  │ [View]│ │
│ │ 2025-01-22 10:15:00 │ SYSTEM│ AI_SUGGEST│ shape_mapping/abc123 │ [View]│ │
│ │ 2025-01-22 09:15:33 │ @jane │ CREATE   │ playbook/def456       │ [View]│ │
│ │ 2025-01-22 03:00:01 │ SYSTEM│ FEED_SYNC│ cwe_feed              │ [View]│ │
│                                                                            │
│ [◀ Prev] Page 1 of 156 [Next ▶]                               1547 entries│
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Entry Detail

```
┌────────────────────────────────────────────────────────────────────────────┐
│ AUDIT ENTRY DETAIL                                                    [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ Timestamp: 2025-01-22 14:28:12 UTC                                        │
│ User: @john (john@company.com)                                            │
│ IP Address: 203.45.67.89                                                   │
│ User Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...            │
│                                                                            │
│ Action: UPDATE                                                             │
│ Resource: shape_mapping/abc123                                             │
│ Resource Name: mxgraph.aws4.bedrock                                        │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ CHANGES                                                                    │
│                                                                            │
│ │ Field        │ Before              │ After                             │ │
│ │──────────────┼─────────────────────┼───────────────────────────────────│ │
│ │ technology   │ unknown             │ ai-service                        │ │
│ │ machine      │ -                   │ serverless                        │ │
│ │ displayName  │ -                   │ AWS Bedrock                       │ │
│ │ status       │ pending             │ pending                           │ │
│                                                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│ RAW DATA                                                                   │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                      │ │
│ │   "before": { "technology": "unknown", ... },                         │ │
│ │   "after": { "technology": "ai-service", ... }                        │ │
│ │ }                                                                      │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│                                                                   [Close]  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 11.3 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `AL-001` | View audit log | Load page | Entries listed |
| `AL-002` | Filter by user | Select @john | Only @john entries |
| `AL-003` | Filter by action | Select PROMOTE | Only promotions |
| `AL-004` | Filter by date range | Set last 7 days | Filtered entries |
| `AL-005` | View entry detail | Click View | Full detail shown |
| `AL-006` | Export log | Click Export | CSV downloaded |
| `AL-007` | Search by resource | Type "bedrock" | Matching entries |
| `AL-008` | System actions | Filter SYSTEM | Feed syncs, AI suggestions |

---

## 12. System Health Dashboard

### 12.1 Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM HEALTH                                              Last 24 hours  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌─ SERVICES ────────────────────────────────────────────────────────────┐ │
│ │                                                                        │ │
│ │ ✓ Database (PostgreSQL)     │ Healthy │ Latency: 2ms  │ Conn: 45/100 │ │
│ │ ✓ Cache (Redis)             │ Healthy │ Latency: 1ms  │ Memory: 256MB│ │
│ │ ✓ Threagile Container       │ Healthy │ Ready        │ Jobs: 0 queue│ │
│ │ ✓ Claude API                │ Healthy │ Latency: 450ms│ Quota: 80%   │ │
│ │ ⚠ NVD Feed                  │ Warning │ Rate limited │ Next: 2h     │ │
│ │                                                                        │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌─ QUEUE DEPTHS ────────────────────────────────────────────────────────┐ │
│ │                                                                        │ │
│ │ threat-analysis    ████░░░░░░░░░░░░░░░░  3 jobs   (avg wait: 45s)    │ │
│ │ ai-triage          ██░░░░░░░░░░░░░░░░░░  1 job    (avg wait: 12s)    │ │
│ │ feed-sync          ░░░░░░░░░░░░░░░░░░░░  0 jobs   (idle)             │ │
│ │ report-generation  ░░░░░░░░░░░░░░░░░░░░  0 jobs   (idle)             │ │
│ │                                                                        │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌─ METRICS (24h) ───────────────────────────────────────────────────────┐ │
│ │                                                                        │ │
│ │ Threat Models Created: 47        Analyses Run: 156                    │ │
│ │ Risks Identified: 1,234          AI Triage Calls: 892                 │ │
│ │ Reports Generated: 23            Tickets Created: 67                  │ │
│ │                                                                        │ │
│ │ API Requests: 45,678             Error Rate: 0.02%                    │ │
│ │ Avg Response Time: 120ms         P99 Response: 850ms                  │ │
│ │                                                                        │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌─ RECENT ERRORS ───────────────────────────────────────────────────────┐ │
│ │                                                                        │ │
│ │ 14:25 │ Threagile timeout │ model-789 │ Retried successfully         │ │
│ │ 11:03 │ Claude rate limit │ triage-batch-12 │ Queued for retry       │ │
│ │ 09:45 │ NVD 429 response │ feed-sync │ Backed off to 6h interval     │ │
│ │                                                                        │ │
│ │                                                      [View All Errors] │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `SH-001` | View health dashboard | Load page | All services shown |
| `SH-002` | Healthy state | All services up | Green checkmarks |
| `SH-003` | Service down | Simulate DB down | Red X, alert |
| `SH-004` | Queue backup | 50+ jobs queued | Warning indicator |
| `SH-005` | View metrics | Check 24h stats | Accurate counts |
| `SH-006` | View errors | Check error list | Recent errors shown |
| `SH-007` | Error detail | Click error | Full trace available |
| `SH-008` | API quota warning | >90% Claude usage | Warning shown |

---

## 13. Document References

| Doc | Purpose |
|-----|---------|
| `00_overview.md` | Product summary, vision, tiers |
| `01_product_context.md` | Personas, stories, JTBD |
| `02_functional_spec.md` | Features, behaviors |
| `03_technical_spec.md` | Architecture, stack, APIs |
| `04_data_models.md` | Schema definitions, mappings |
| `05_ui_screens.md` | UI specifications |
| `06_user_flows.md` | User journeys |
| **`07_admin_console.md`** | **This document** — Admin console spec |
| `08_rules.md` | Code constraints for Claude Code |
| `09_implementation_plan.md` | Phased build order |

---

*Last updated: 2025-01-23*
*Author: ThreatDiviner Product Team*
