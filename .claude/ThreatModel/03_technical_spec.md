# 03 — Technical Specification

> ⚠️ **CODEBASE ALIGNMENT NOTE**
> This spec aligns with existing ThreatDiviner codebase conventions:
> - Uses `tenantId` (not `orgId`) for multi-tenancy
> - Uses `projectId` for project context
> - Threat model tables already exist (`ThreatModel`, `ThreatModelComponent`, `ThreatModelDataFlow`, `Threat`, `ThreatMitigation`)
> - Platform tables already exist (`Tenant`, `User`, `Project`, `Repository`)
> - Admin console is platform-level, serves all TD modules
> - See `apps/api/prisma/schema.prisma` for existing schema

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Next.js    │  │  mxGraph    │  │  GraphQL    │  │  WebSocket  │        │
│  │  Frontend   │  │  Editor     │  │  Client     │  │  Client     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     NestJS Application                               │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ GraphQL  │ │   REST   │ │ WebSocket│ │  Auth    │ │  License │  │   │
│  │  │ Resolver │ │ Webhooks │ │ Gateway  │ │ Guard    │ │  Guard   │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ Diagram  │ │ Threat   │ │ Triage   │ │Compliance│ │Remediate │  │   │
│  │  │ Service  │ │ Engine   │ │ Service  │ │ Service  │ │ Service  │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ Report   │ │ Version  │ │  CICD    │ │  Ticket  │ │  Parser  │  │   │
│  │  │ Service  │ │ Service  │ │ Service  │ │ Adapter  │ │ Service  │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
┌─────────────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
│      DATA LAYER         │ │   QUEUE LAYER   │ │    EXTERNAL SERVICES    │
├─────────────────────────┤ ├─────────────────┤ ├─────────────────────────┤
│  ┌─────────────────┐    │ │ ┌─────────────┐ │ │  ┌─────────────────┐    │
│  │   PostgreSQL    │    │ │ │   Redis     │ │ │  │   Threagile     │    │
│  │                 │    │ │ │   BullMQ    │ │ │  │   (Docker)      │    │
│  │ ┌─────────────┐ │    │ │ └─────────────┘ │ │  └─────────────────┘    │
│  │ │ platform.*  │ │    │ │ Queues:         │ │  ┌─────────────────┐    │
│  │ │ threatmodel.│ │    │ │ • threat-engine │ │  │   Claude API    │    │
│  │ │ admin.*     │ │    │ │ • ai-triage     │ │  │   (AI Triage)   │    │
│  │ └─────────────┘ │    │ │ • repo-discovery│ │  └─────────────────┘    │
│  └─────────────────┘    │ │ • report-gen    │ │  ┌─────────────────┐    │
│  ┌─────────────────┐    │ │ • feed-sync     │ │  │   GitHub/GitLab │    │
│  │   Redis Cache   │    │ └─────────────────┘ │  │   (Webhooks)    │    │
│  └─────────────────┘    │                     │  └─────────────────┘    │
└─────────────────────────┘ └───────────────────┘ └─────────────────────────┘
```

### 1.2 Deployment Modes

#### Standalone Mode
```
┌────────────────────────────────────────┐
│         Threat Modeling App            │
│  ┌──────────┐  ┌──────────────────┐   │
│  │  Auth    │  │  Billing         │   │
│  │  (Clerk) │  │  (Stripe)        │   │
│  └──────────┘  └──────────────────┘   │
│  ┌──────────────────────────────────┐ │
│  │  Full UI + API + Services        │ │
│  └──────────────────────────────────┘ │
│  ┌──────────────────────────────────┐ │
│  │  Own Database (threatmodel.*)    │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

#### TD-Bundled Mode
```
┌────────────────────────────────────────────────────────────────┐
│                    ThreatDiviner Platform                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Platform Core (Auth, Billing, Dashboard, Event Bus)      │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │  Code Scan │ │  Threat    │ │  DAST/     │ │   CSPM     │  │
│  │  Module    │ │  Modeling  │ │  PenTest   │ │   Module   │  │
│  │            │ │  Module    │ │  Module    │ │            │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Shared Database (platform.* + codescan.* + threatmodel.*)│  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### 1.3 Request Flow

```
User Request → Next.js → GraphQL/REST → Auth Guard → License Guard 
    → Service Layer → Database/Queue → Response

Async Job Flow:
Service → BullMQ Queue → Worker picks up → External Service (Threagile/Claude)
    → Result stored → WebSocket notification → UI updates
```

---

## 2. Tech Stack

### 2.1 Frontend

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Framework** | Next.js | 14.x | React framework, App Router, Server Components |
| **Language** | TypeScript | 5.x | Type safety |
| **Diagram Editor** | mxGraph | 4.2.2 | Draw.io compatible graph editor |
| **Styling** | TailwindCSS | 3.x | Utility-first CSS |
| **Components** | shadcn/ui | latest | Accessible component library |
| **State** | Zustand | 4.x | Lightweight state management |
| **GraphQL Client** | Apollo Client | 3.x | GraphQL queries/mutations/subscriptions |
| **WebSocket** | socket.io-client | 4.x | Real-time updates |
| **Forms** | React Hook Form | 7.x | Form handling |
| **Validation** | Zod | 3.x | Schema validation |
| **Icons** | Lucide React | latest | Icon library |
| **Charts** | Recharts | 2.x | Risk visualizations |

### 2.2 Backend

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Framework** | NestJS | 10.x | Node.js framework |
| **Language** | TypeScript | 5.x | Type safety |
| **API** | GraphQL (Apollo) | latest | Primary API |
| **REST** | Express (via Nest) | 4.x | Webhooks, file uploads |
| **WebSocket** | socket.io | 4.x | Real-time notifications |
| **ORM** | Prisma | 5.x | Database access |
| **Queue** | BullMQ | 4.x | Background jobs |
| **Cache** | ioredis | 5.x | Redis client |
| **Validation** | class-validator | 0.14.x | DTO validation |
| **Auth** | Passport | 0.6.x | JWT validation |
| **XML Parser** | xml2js | 0.6.x | Draw.io XML parsing |
| **YAML** | js-yaml | 4.x | Threagile YAML generation |
| **PDF** | PDFKit | 0.13.x | Report generation |
| **Excel** | ExcelJS | 4.x | Spreadsheet generation |

### 2.3 Database

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Primary DB** | PostgreSQL 15 | Main data store |
| **Schemas** | `platform.*`, `threatmodel.*`, `admin.*` | Logical separation |
| **RLS** | Row Level Security | Tenant isolation |
| **Cache** | Redis 7 | Session cache, diagram state, results cache |
| **Search** | PostgreSQL Full-Text | Risk/asset search (future: consider Elasticsearch) |

### 2.4 Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Container Runtime** | Docker | Threagile execution, deployment |
| **Orchestration** | Docker Compose (dev), Kubernetes (prod) | Container management |
| **Cloud** | AWS | Hosting (ECS/EKS, RDS, ElastiCache, S3) |
| **CDN** | CloudFront | Static assets, diagram images |
| **Secrets** | AWS Secrets Manager | API keys, credentials |
| **Logging** | CloudWatch / Loki | Centralized logs |
| **Monitoring** | Prometheus + Grafana | Metrics |
| **Tracing** | OpenTelemetry + Jaeger | Distributed tracing |
| **Error Tracking** | Sentry | Exception monitoring |

### 2.5 External Services

| Service | Purpose | Integration |
|---------|---------|-------------|
| **Threagile** | Threat analysis engine | Docker exec |
| **Claude API** | AI triage, doc extraction, chat builder | REST API |
| **GitHub** | Repo import, CI/CD webhooks, SARIF upload | REST API + OAuth |
| **GitLab** | Repo import, CI/CD webhooks | REST API + OAuth |
| **Azure DevOps** | Repo import, CI/CD webhooks | REST API + OAuth |
| **Jira** | Ticket creation | REST API |
| **ServiceNow** | Ticket creation | REST API |
| **Stripe** | Billing (standalone mode) | REST API |
| **Clerk/Auth0** | Authentication (standalone mode) | SDK |

---

## 3. Database Schema

### 3.1 Existing Schema (Already Built)

The following tables **already exist** in the ThreatDiviner platform. Do NOT recreate.

**Platform Tables (multi-tenant foundation):**
- `Tenant` — Multi-tenant root, all data scoped by `tenantId`
- `User` — Users with `tenantId`
- `Project` — Projects within tenant, contains repos/scans/findings
- `Repository` — Git repos linked to projects

**Threat Model Tables (already exist in Prisma):**
```prisma
model ThreatModel {
  id             String   @id @default(uuid())
  tenantId       String   @map("tenant_id")
  projectId      String?  @map("project_id")
  name           String
  description    String?
  methodology    String   @default("stride")
  status         String   @default("draft")
  repositoryId   String?  @map("repository_id")
  version        Int      @default(1)
  createdBy      String   @map("created_by")
  lastModifiedBy String?  @map("last_modified_by")
  // ... relations to components, dataFlows, threats, mitigations
}

model ThreatModelComponent { ... }  // Already exists
model ThreatModelDataFlow { ... }   // Already exists
model Threat { ... }                // Already exists
model ThreatMitigation { ... }      // Already exists
```

### 3.2 Platform Schema (Shared)

> **Already exists** — Do NOT recreate. Platform tables (`Tenant`, `User`, `Project`, `Repository`) are managed by the core ThreatDiviner platform.

### 3.3 Threat Model Schema

```sql
-- threatmodel.threat_models
CREATE TABLE threatmodel.threat_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft',  -- draft, active, archived
  compliance_frameworks TEXT[] DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  locked_by UUID REFERENCES platform.users(id),
  locked_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES platform.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- threatmodel.diagram_versions
CREATE TABLE threatmodel.diagram_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.organizations(id),
  threat_model_id UUID NOT NULL REFERENCES threatmodel.threat_models(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  name VARCHAR(255),
  description TEXT,
  diagram_xml TEXT NOT NULL,      -- Raw Draw.io XML
  graph_json JSONB NOT NULL,      -- Parsed internal model
  is_auto_save BOOLEAN DEFAULT FALSE,
  is_current BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES platform.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(threat_model_id, version_number)
);

-- threatmodel.assets
CREATE TABLE threatmodel.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.organizations(id),
  threat_model_id UUID NOT NULL REFERENCES threatmodel.threat_models(id) ON DELETE CASCADE,
  diagram_version_id UUID NOT NULL REFERENCES threatmodel.diagram_versions(id) ON DELETE CASCADE,
  external_id VARCHAR(100) NOT NULL,  -- ID from diagram XML
  name VARCHAR(255) NOT NULL,
  description TEXT,
  technology VARCHAR(100) NOT NULL,
  machine VARCHAR(50) NOT NULL,
  internet_facing BOOLEAN DEFAULT FALSE,
  encryption VARCHAR(50) DEFAULT 'none',
  authentication VARCHAR(50) DEFAULT 'none',
  authorization VARCHAR(50) DEFAULT 'none',
  multi_tenant BOOLEAN DEFAULT FALSE,
  redundant BOOLEAN DEFAULT FALSE,
  custom_developed BOOLEAN DEFAULT FALSE,
  out_of_scope BOOLEAN DEFAULT FALSE,
  data_assets_processed TEXT[] DEFAULT '{}',
  data_assets_stored TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  position JSONB,  -- {x, y}
  size JSONB,      -- {width, height}
  parent_boundary_id UUID,
  drawio_style VARCHAR(500),
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(diagram_version_id, external_id)
);

-- threatmodel.trust_boundaries
CREATE TABLE threatmodel.trust_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.organizations(id),
  threat_model_id UUID NOT NULL REFERENCES threatmodel.threat_models(id) ON DELETE CASCADE,
  diagram_version_id UUID NOT NULL REFERENCES threatmodel.diagram_versions(id) ON DELETE CASCADE,
  external_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  boundary_type VARCHAR(100) NOT NULL,
  position JSONB,
  size JSONB,
  parent_boundary_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(diagram_version_id, external_id)
);

-- threatmodel.communication_links
CREATE TABLE threatmodel.communication_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.organizations(id),
  threat_model_id UUID NOT NULL REFERENCES threatmodel.threat_models(id) ON DELETE CASCADE,
  diagram_version_id UUID NOT NULL REFERENCES threatmodel.diagram_versions(id) ON DELETE CASCADE,
  external_id VARCHAR(100) NOT NULL,
  source_asset_id UUID NOT NULL REFERENCES threatmodel.assets(id) ON DELETE CASCADE,
  target_asset_id UUID NOT NULL REFERENCES threatmodel.assets(id) ON DELETE CASCADE,
  title VARCHAR(255),
  description TEXT,
  protocol VARCHAR(50) DEFAULT 'https',
  authentication VARCHAR(50) DEFAULT 'none',
  authorization VARCHAR(50) DEFAULT 'none',
  encryption VARCHAR(50) DEFAULT 'none',
  vpn BOOLEAN DEFAULT FALSE,
  ip_filtered BOOLEAN DEFAULT FALSE,
  readonly BOOLEAN DEFAULT FALSE,
  data_assets_sent TEXT[] DEFAULT '{}',
  data_assets_received TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(diagram_version_id, external_id)
);

-- threatmodel.data_assets
CREATE TABLE threatmodel.data_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.organizations(id),
  threat_model_id UUID NOT NULL REFERENCES threatmodel.threat_models(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  usage VARCHAR(50) DEFAULT 'business',
  quantity VARCHAR(50) DEFAULT 'many',
  confidentiality VARCHAR(50) DEFAULT 'confidential',
  integrity VARCHAR(50) DEFAULT 'critical',
  availability VARCHAR(50) DEFAULT 'important',
  justification_cia TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(threat_model_id, name)
);

-- threatmodel.analysis_runs
CREATE TABLE threatmodel.analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.organizations(id),
  threat_model_id UUID NOT NULL REFERENCES threatmodel.threat_models(id) ON DELETE CASCADE,
  diagram_version_id UUID NOT NULL REFERENCES threatmodel.diagram_versions(id),
  status VARCHAR(50) DEFAULT 'pending',  -- pending, running, completed, failed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  threagile_output JSONB,
  error_message TEXT,
  triggered_by UUID REFERENCES platform.users(id),
  trigger_source VARCHAR(50) DEFAULT 'manual',  -- manual, cicd, auto
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- threatmodel.risks
CREATE TABLE threatmodel.risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.organizations(id),
  threat_model_id UUID NOT NULL REFERENCES threatmodel.threat_models(id) ON DELETE CASCADE,
  analysis_run_id UUID NOT NULL REFERENCES threatmodel.analysis_runs(id) ON DELETE CASCADE,
  canonical_risk_id VARCHAR(100),  -- Links to canonical mapping
  threagile_risk_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  severity VARCHAR(50) NOT NULL,
  adjusted_severity VARCHAR(50),  -- After AI triage
  exploitation_likelihood VARCHAR(50),
  exploitation_impact VARCHAR(50),
  stride VARCHAR(100),
  cwe_id INT,
  affected_asset_id UUID REFERENCES threatmodel.assets(id),
  affected_link_id UUID REFERENCES threatmodel.communication_links(id),
  affected_boundary_id UUID REFERENCES threatmodel.trust_boundaries(id),
  action TEXT,
  mitigation TEXT,
  status VARCHAR(50) DEFAULT 'open',  -- open, in_progress, mitigated, resolved, accepted, false_positive
  status_justification TEXT,
  triage_output JSONB,  -- AI triage response
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- threatmodel.risk_compliance_mappings
CREATE TABLE threatmodel.risk_compliance_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.organizations(id),
  risk_id UUID NOT NULL REFERENCES threatmodel.risks(id) ON DELETE CASCADE,
  framework VARCHAR(100) NOT NULL,
  control_id VARCHAR(100) NOT NULL,
  control_title VARCHAR(500),
  gap_status VARCHAR(50) DEFAULT 'gap',  -- gap, partial, satisfied
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(risk_id, framework, control_id)
);

-- threatmodel.remediations
CREATE TABLE threatmodel.remediations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.organizations(id),
  risk_id UUID NOT NULL REFERENCES threatmodel.risks(id) ON DELETE CASCADE,
  playbook_id VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, completed
  assigned_to UUID REFERENCES platform.users(id),
  due_date DATE,
  notes TEXT,
  external_ticket_id VARCHAR(255),
  external_ticket_url VARCHAR(500),
  external_ticket_system VARCHAR(50),  -- jira, servicenow, ado
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- threatmodel.comments
CREATE TABLE threatmodel.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.organizations(id),
  threat_model_id UUID NOT NULL REFERENCES threatmodel.threat_models(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES threatmodel.comments(id),
  target_type VARCHAR(50) NOT NULL,  -- asset, link, boundary, risk, model
  target_id UUID NOT NULL,
  content TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES platform.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- threatmodel.shares
CREATE TABLE threatmodel.shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.organizations(id),
  threat_model_id UUID NOT NULL REFERENCES threatmodel.threat_models(id) ON DELETE CASCADE,
  share_token VARCHAR(100) UNIQUE NOT NULL,
  permission VARCHAR(50) DEFAULT 'view',  -- view, comment, edit
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES platform.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- threatmodel.cicd_configs
CREATE TABLE threatmodel.cicd_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.organizations(id),
  threat_model_id UUID NOT NULL REFERENCES threatmodel.threat_models(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,  -- github, gitlab, ado
  repository_url VARCHAR(500),
  enabled BOOLEAN DEFAULT TRUE,
  fail_on_severities TEXT[] DEFAULT '{critical,high}',
  ignore_risk_ids TEXT[] DEFAULT '{}',
  post_pr_comment BOOLEAN DEFAULT TRUE,
  upload_sarif BOOLEAN DEFAULT TRUE,
  webhook_secret VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(threat_model_id, provider)
);

-- RLS Policies for all threatmodel tables
ALTER TABLE threatmodel.threat_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE threatmodel.diagram_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE threatmodel.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE threatmodel.trust_boundaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE threatmodel.communication_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE threatmodel.data_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE threatmodel.analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE threatmodel.risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE threatmodel.risk_compliance_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE threatmodel.remediations ENABLE ROW LEVEL SECURITY;
ALTER TABLE threatmodel.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE threatmodel.shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE threatmodel.cicd_configs ENABLE ROW LEVEL SECURITY;

-- Apply same policy pattern to all tables
CREATE POLICY tenant_isolation ON threatmodel.threat_models
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
-- (Repeat for all tables)

-- Indexes
CREATE INDEX idx_threat_models_org ON threatmodel.threat_models(tenant_id);
CREATE INDEX idx_diagram_versions_model ON threatmodel.diagram_versions(threat_model_id);
CREATE INDEX idx_assets_model ON threatmodel.assets(threat_model_id);
CREATE INDEX idx_assets_version ON threatmodel.assets(diagram_version_id);
CREATE INDEX idx_risks_model ON threatmodel.risks(threat_model_id);
CREATE INDEX idx_risks_analysis ON threatmodel.risks(analysis_run_id);
CREATE INDEX idx_risks_status ON threatmodel.risks(status);
CREATE INDEX idx_risks_severity ON threatmodel.risks(severity);
```

### 3.4 Admin Schema (Config Staging)

```sql
-- admin.shape_mappings
CREATE TABLE admin.shape_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawio_style VARCHAR(255) NOT NULL UNIQUE,
  threagile_technology VARCHAR(100) NOT NULL,
  machine_type VARCHAR(50) DEFAULT 'virtual',
  default_properties JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'pending',  -- pending, approved, live
  approved_by UUID REFERENCES platform.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- admin.canonical_risk_mappings
CREATE TABLE admin.canonical_risk_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id VARCHAR(100) NOT NULL UNIQUE,
  canonical_title VARCHAR(500) NOT NULL,
  default_severity VARCHAR(50) NOT NULL,
  cwe_id INT,
  capec_ids INT[] DEFAULT '{}',
  attack_patterns TEXT[] DEFAULT '{}',
  sources JSONB NOT NULL,  -- [{type, id, title}]
  status VARCHAR(50) DEFAULT 'pending',
  approved_by UUID REFERENCES platform.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- admin.compliance_controls
CREATE TABLE admin.compliance_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework VARCHAR(100) NOT NULL,
  control_id VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  parent_control_id VARCHAR(100),
  status VARCHAR(50) DEFAULT 'live',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(framework, control_id)
);

-- admin.risk_control_mappings
CREATE TABLE admin.risk_control_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_risk_id VARCHAR(100) NOT NULL,
  framework VARCHAR(100) NOT NULL,
  control_id VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  approved_by UUID REFERENCES platform.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(canonical_risk_id, framework, control_id)
);

-- admin.remediation_playbooks
CREATE TABLE admin.remediation_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_risk_id VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  steps JSONB NOT NULL,  -- [{order, title, description, effort, role}]
  iac_snippets JSONB DEFAULT '{}',  -- {terraform: "...", cloudformation: "..."}
  references JSONB DEFAULT '[]',  -- [{title, url}]
  status VARCHAR(50) DEFAULT 'pending',
  approved_by UUID REFERENCES platform.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(canonical_risk_id)
);

-- admin.wizard_questions
CREATE TABLE admin.wizard_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id VARCHAR(100) NOT NULL UNIQUE,
  question_text TEXT NOT NULL,
  help_text TEXT,
  question_type VARCHAR(50) NOT NULL,  -- single-select, multi-select, text, toggle
  options JSONB,  -- [{value, label, icon}]
  triggers JSONB,  -- {answer_value: {nextQuestionId, addNodes, ...}}
  maps_to JSONB,  -- {nodeProperty, boundaryProperty, ...}
  order_index INT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- admin.feed_sync_logs
CREATE TABLE admin.feed_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_type VARCHAR(50) NOT NULL,  -- cwe, capec, attack, nvd, cis
  status VARCHAR(50) NOT NULL,  -- started, completed, failed
  items_processed INT DEFAULT 0,
  items_added INT DEFAULT 0,
  items_updated INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Public (live) versions - copy of admin when approved
CREATE TABLE public.shape_mappings (LIKE admin.shape_mappings INCLUDING ALL);
CREATE TABLE public.canonical_risk_mappings (LIKE admin.canonical_risk_mappings INCLUDING ALL);
CREATE TABLE public.compliance_controls (LIKE admin.compliance_controls INCLUDING ALL);
CREATE TABLE public.risk_control_mappings (LIKE admin.risk_control_mappings INCLUDING ALL);
CREATE TABLE public.remediation_playbooks (LIKE admin.remediation_playbooks INCLUDING ALL);
CREATE TABLE public.wizard_questions (LIKE admin.wizard_questions INCLUDING ALL);
```

---

## 4. GraphQL API

### 4.1 Schema Overview

```graphql
# ============ TYPES ============

type ThreatModel {
  id: ID!
  name: String!
  description: String
  status: ModelStatus!
  complianceFrameworks: [String!]!
  currentVersion: DiagramVersion
  versions: [DiagramVersion!]!
  assets: [Asset!]!
  boundaries: [TrustBoundary!]!
  links: [CommunicationLink!]!
  risks: [Risk!]!
  analysisRuns: [AnalysisRun!]!
  settings: JSON
  lockedBy: User
  lockedAt: DateTime
  createdBy: User!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type DiagramVersion {
  id: ID!
  versionNumber: Int!
  name: String
  description: String
  diagramXml: String!
  graphJson: JSON!
  isAutoSave: Boolean!
  isCurrent: Boolean!
  createdBy: User!
  createdAt: DateTime!
}

type Asset {
  id: ID!
  externalId: String!
  name: String!
  description: String
  technology: String!
  machine: MachineType!
  internetFacing: Boolean!
  encryption: EncryptionType!
  authentication: AuthType!
  authorization: AuthzType!
  multiTenant: Boolean!
  redundant: Boolean!
  customDeveloped: Boolean!
  outOfScope: Boolean!
  dataAssetsProcessed: [String!]!
  dataAssetsStored: [String!]!
  tags: [String!]!
  position: Position
  size: Size
  parentBoundary: TrustBoundary
  incomingLinks: [CommunicationLink!]!
  outgoingLinks: [CommunicationLink!]!
  risks: [Risk!]!
}

type TrustBoundary {
  id: ID!
  externalId: String!
  name: String!
  description: String
  boundaryType: BoundaryType!
  position: Position
  size: Size
  parentBoundary: TrustBoundary
  assetsInside: [Asset!]!
  childBoundaries: [TrustBoundary!]!
}

type CommunicationLink {
  id: ID!
  externalId: String!
  source: Asset!
  target: Asset!
  title: String
  description: String
  protocol: ProtocolType!
  authentication: AuthType!
  authorization: AuthzType!
  encryption: LinkEncryption!
  vpn: Boolean!
  ipFiltered: Boolean!
  readonly: Boolean!
  dataAssetsSent: [String!]!
  dataAssetsReceived: [String!]!
  risks: [Risk!]!
}

type Risk {
  id: ID!
  canonicalRiskId: String
  title: String!
  description: String
  category: String
  severity: Severity!
  adjustedSeverity: Severity
  exploitationLikelihood: String
  exploitationImpact: String
  stride: String
  cweId: Int
  affectedAsset: Asset
  affectedLink: CommunicationLink
  affectedBoundary: TrustBoundary
  action: String
  mitigation: String
  status: RiskStatus!
  statusJustification: String
  triageOutput: TriageOutput
  complianceMappings: [ComplianceMapping!]!
  remediation: Remediation
  sources: [RiskSource!]!
  attackPath: AttackPath
  createdAt: DateTime!
  updatedAt: DateTime!
}

type TriageOutput {
  adjustedSeverity: Severity!
  severityReasoning: String!
  falsePositiveLikelihood: String!
  falsePositiveReasoning: String!
  explanation: String!
  businessImpact: String!
  remediationPriority: Int!
  remediationSummary: String!
}

type ComplianceMapping {
  framework: String!
  controlId: String!
  controlTitle: String!
  gapStatus: GapStatus!
}

type Remediation {
  id: ID!
  playbook: RemediationPlaybook
  status: RemediationStatus!
  assignedTo: User
  dueDate: Date
  notes: String
  externalTicket: ExternalTicket
}

type RemediationPlaybook {
  id: ID!
  title: String!
  description: String
  steps: [PlaybookStep!]!
  iacSnippets: [IacSnippet!]!
  references: [Reference!]!
}

type AttackPath {
  entryPoint: Asset!
  target: Asset!
  hops: [AttackHop!]!
}

type AttackHop {
  order: Int!
  asset: Asset!
  link: CommunicationLink
  tactic: String!
  technique: String!
  description: String!
}

type AnalysisRun {
  id: ID!
  status: AnalysisStatus!
  startedAt: DateTime
  completedAt: DateTime
  risksFound: Int
  errorMessage: String
  triggeredBy: User
  triggerSource: String!
}

# ============ ENUMS ============

enum ModelStatus { DRAFT ACTIVE ARCHIVED }
enum MachineType { PHYSICAL VIRTUAL CONTAINER SERVERLESS }
enum EncryptionType { NONE TRANSPARENT DATA_WITH_SYMMETRIC DATA_WITH_ASYMMETRIC }
enum AuthType { NONE CREDENTIALS SESSION_ID TOKEN CERTIFICATE TWO_FACTOR EXTERNALIZED }
enum AuthzType { NONE TECHNICAL_USER ENDUSER_IDENTITY_PROPAGATION }
enum BoundaryType { NETWORK_CLOUD NETWORK_ON_PREM NETWORK_DEDICATED_HOSTER EXECUTION_ENVIRONMENT }
enum ProtocolType { HTTP HTTPS WS WSS GRPC TCP UDP JDBC ODBC SQL LDAP SMTP SSH SFTP }
enum LinkEncryption { NONE TLS }
enum Severity { CRITICAL HIGH MEDIUM LOW }
enum RiskStatus { OPEN IN_PROGRESS MITIGATED RESOLVED ACCEPTED FALSE_POSITIVE }
enum GapStatus { GAP PARTIAL SATISFIED }
enum RemediationStatus { PENDING IN_PROGRESS COMPLETED }
enum AnalysisStatus { PENDING RUNNING COMPLETED FAILED }

# ============ INPUTS ============

input CreateThreatModelInput {
  name: String!
  description: String
  complianceFrameworks: [String!]
  templateId: String
}

input UpdateThreatModelInput {
  name: String
  description: String
  status: ModelStatus
  complianceFrameworks: [String!]
}

input SaveDiagramInput {
  threatModelId: ID!
  diagramXml: String!
  versionName: String
  versionDescription: String
}

input UpdateAssetInput {
  id: ID!
  name: String
  description: String
  technology: String
  machine: MachineType
  internetFacing: Boolean
  encryption: EncryptionType
  authentication: AuthType
  authorization: AuthzType
  multiTenant: Boolean
  redundant: Boolean
  customDeveloped: Boolean
  outOfScope: Boolean
  dataAssetsProcessed: [String!]
  dataAssetsStored: [String!]
  tags: [String!]
}

input UpdateLinkInput {
  id: ID!
  title: String
  description: String
  protocol: ProtocolType
  authentication: AuthType
  authorization: AuthzType
  encryption: LinkEncryption
  vpn: Boolean
  ipFiltered: Boolean
  readonly: Boolean
  dataAssetsSent: [String!]
  dataAssetsReceived: [String!]
}

input TriageRiskInput {
  riskId: ID!
  status: RiskStatus!
  justification: String
}

input CreateTicketInput {
  riskId: ID!
  system: TicketSystem!
  projectKey: String!
  assignee: String
  priority: String
}

enum TicketSystem { JIRA SERVICENOW ADO }

input RunAnalysisInput {
  threatModelId: ID!
  diagramVersionId: ID
}

input CICDConfigInput {
  threatModelId: ID!
  provider: String!
  repositoryUrl: String
  enabled: Boolean
  failOnSeverities: [Severity!]
  ignoreRiskIds: [String!]
  postPrComment: Boolean
  uploadSarif: Boolean
}

# ============ QUERIES ============

type Query {
  # Threat Models
  threatModel(id: ID!): ThreatModel
  threatModels(status: ModelStatus, limit: Int, offset: Int): ThreatModelConnection!
  
  # Versions
  diagramVersion(id: ID!): DiagramVersion
  diagramVersions(threatModelId: ID!): [DiagramVersion!]!
  compareDiagramVersions(versionId1: ID!, versionId2: ID!): VersionDiff!
  
  # Risks
  risk(id: ID!): Risk
  risks(
    threatModelId: ID!
    severity: [Severity!]
    status: [RiskStatus!]
    framework: String
    limit: Int
    offset: Int
  ): RiskConnection!
  
  # Compliance
  complianceGaps(threatModelId: ID!, framework: String!): ComplianceGapReport!
  
  # Analysis
  analysisRun(id: ID!): AnalysisRun
  analysisRuns(threatModelId: ID!, limit: Int): [AnalysisRun!]!
  
  # Reference Data
  templates: [Template!]!
  complianceFrameworks: [Framework!]!
  shapeMappings: [ShapeMapping!]!
  
  # Search
  searchRisks(query: String!, threatModelId: ID): [Risk!]!
  searchAssets(query: String!, threatModelId: ID): [Asset!]!
}

# ============ MUTATIONS ============

type Mutation {
  # Threat Models
  createThreatModel(input: CreateThreatModelInput!): ThreatModel!
  updateThreatModel(id: ID!, input: UpdateThreatModelInput!): ThreatModel!
  deleteThreatModel(id: ID!): Boolean!
  duplicateThreatModel(id: ID!, name: String!): ThreatModel!
  
  # Diagrams
  saveDiagram(input: SaveDiagramInput!): DiagramVersion!
  restoreVersion(versionId: ID!): DiagramVersion!
  
  # Assets & Links (bulk update after diagram parse)
  updateAsset(input: UpdateAssetInput!): Asset!
  updateLink(input: UpdateLinkInput!): CommunicationLink!
  updateAssets(inputs: [UpdateAssetInput!]!): [Asset!]!
  updateLinks(inputs: [UpdateLinkInput!]!): [CommunicationLink!]!
  
  # Analysis
  runAnalysis(input: RunAnalysisInput!): AnalysisRun!
  cancelAnalysis(analysisRunId: ID!): Boolean!
  retryTriage(riskId: ID!): Risk!
  
  # Risk Management
  triageRisk(input: TriageRiskInput!): Risk!
  bulkTriageRisks(inputs: [TriageRiskInput!]!): [Risk!]!
  
  # Remediation
  createTicket(input: CreateTicketInput!): Remediation!
  bulkCreateTickets(riskIds: [ID!]!, system: TicketSystem!, projectKey: String!): [Remediation!]!
  updateRemediation(id: ID!, status: RemediationStatus, assignedTo: ID, dueDate: Date, notes: String): Remediation!
  
  # Collaboration
  acquireLock(threatModelId: ID!): ThreatModel!
  releaseLock(threatModelId: ID!): ThreatModel!
  createShare(threatModelId: ID!, permission: SharePermission!, expiresAt: DateTime): Share!
  revokeShare(shareId: ID!): Boolean!
  
  # Comments
  addComment(threatModelId: ID!, targetType: String!, targetId: ID!, content: String!, parentId: ID): Comment!
  resolveComment(commentId: ID!): Comment!
  
  # CI/CD
  saveCICDConfig(input: CICDConfigInput!): CICDConfig!
  
  # Import
  importFromRepo(threatModelId: ID!, repoUrl: String!, provider: String!): ImportResult!
  importFromDocument(threatModelId: ID!, fileUploadId: ID!): ImportResult!
}

# ============ SUBSCRIPTIONS ============

type Subscription {
  analysisProgress(threatModelId: ID!): AnalysisProgressEvent!
  riskUpdated(threatModelId: ID!): Risk!
  diagramUpdated(threatModelId: ID!): DiagramUpdateEvent!
  commentAdded(threatModelId: ID!): Comment!
}
```

### 4.2 Resolver Structure

```
src/graphql/
├── resolvers/
│   ├── threat-model.resolver.ts
│   ├── diagram.resolver.ts
│   ├── asset.resolver.ts
│   ├── risk.resolver.ts
│   ├── compliance.resolver.ts
│   ├── remediation.resolver.ts
│   ├── analysis.resolver.ts
│   ├── collaboration.resolver.ts
│   └── cicd.resolver.ts
├── types/
│   ├── threat-model.types.ts
│   ├── risk.types.ts
│   └── ...
├── inputs/
│   ├── create-threat-model.input.ts
│   └── ...
└── schema.graphql
```

---

## 5. REST Endpoints

### 5.1 Webhook Endpoints

```typescript
// GitHub Webhook
POST /api/webhooks/github
Headers: X-Hub-Signature-256, X-GitHub-Event
Body: GitHub webhook payload

// GitLab Webhook
POST /api/webhooks/gitlab
Headers: X-Gitlab-Token
Body: GitLab webhook payload

// Azure DevOps Webhook
POST /api/webhooks/ado
Headers: Authorization (Basic)
Body: ADO webhook payload

// Generic Webhook (API key auth)
POST /api/webhooks/generic
Headers: X-API-Key
Body: { threatModelId, event, payload }
```

### 5.2 File Upload

```typescript
// Document upload for AI extraction
POST /api/upload/document
Headers: Authorization: Bearer {token}
Content-Type: multipart/form-data
Body: file (PDF, DOCX, TXT, MD)
Response: { fileId, fileName, mimeType, size }

// Diagram image export
GET /api/export/diagram/:threatModelId/image
Query: format=png|svg, width, height
Response: Binary image
```

### 5.3 Report Download

```typescript
// PDF Report
GET /api/reports/:threatModelId/pdf
Query: includeCompliance=true, framework=iso27001
Response: Binary PDF

// Excel Report
GET /api/reports/:threatModelId/excel
Response: Binary XLSX

// JSON Export
GET /api/reports/:threatModelId/json
Response: JSON

// SARIF Export
GET /api/reports/:threatModelId/sarif
Response: SARIF JSON
```

### 5.4 Health & Metrics

```typescript
// Health check
GET /api/health
Response: { status: "ok", version, uptime }

// Readiness
GET /api/ready
Response: { db: "ok", redis: "ok", threagile: "ok" }

// Prometheus metrics
GET /api/metrics
Response: Prometheus format
```

---

## 6. Service Layer

### 6.1 Module Structure

```
src/
├── modules/
│   ├── threat-model/
│   │   ├── threat-model.module.ts
│   │   ├── threat-model.service.ts
│   │   ├── threat-model.repository.ts
│   │   └── dto/
│   ├── diagram/
│   │   ├── diagram.module.ts
│   │   ├── diagram.service.ts
│   │   ├── parser/
│   │   │   ├── drawio.parser.ts
│   │   │   ├── terraform.parser.ts
│   │   │   ├── kubernetes.parser.ts
│   │   │   └── docker-compose.parser.ts
│   │   └── layout/
│   │       └── dagre-layout.service.ts
│   ├── threat-engine/
│   │   ├── threat-engine.module.ts
│   │   ├── threat-engine.service.ts
│   │   ├── threagile.executor.ts
│   │   ├── yaml-generator.ts
│   │   └── risk-mapper.ts
│   ├── triage/
│   │   ├── triage.module.ts
│   │   ├── triage.service.ts
│   │   └── claude.client.ts
│   ├── compliance/
│   │   ├── compliance.module.ts
│   │   ├── compliance.service.ts
│   │   └── gap-calculator.ts
│   ├── remediation/
│   │   ├── remediation.module.ts
│   │   ├── remediation.service.ts
│   │   └── adapters/
│   │       ├── ticket-adapter.interface.ts
│   │       ├── jira.adapter.ts
│   │       ├── servicenow.adapter.ts
│   │       └── ado.adapter.ts
│   ├── report/
│   │   ├── report.module.ts
│   │   ├── report.service.ts
│   │   ├── pdf.generator.ts
│   │   ├── excel.generator.ts
│   │   └── sarif.generator.ts
│   ├── version/
│   │   ├── version.module.ts
│   │   ├── version.service.ts
│   │   └── diff.calculator.ts
│   ├── cicd/
│   │   ├── cicd.module.ts
│   │   ├── cicd.service.ts
│   │   ├── github.handler.ts
│   │   ├── gitlab.handler.ts
│   │   └── ado.handler.ts
│   ├── collaboration/
│   │   ├── collaboration.module.ts
│   │   ├── lock.service.ts
│   │   ├── share.service.ts
│   │   └── comment.service.ts
│   └── import/
│       ├── import.module.ts
│       ├── repo-import.service.ts
│       └── doc-import.service.ts
├── common/
│   ├── guards/
│   │   ├── auth.guard.ts
│   │   ├── license.guard.ts
│   │   └── tenant.guard.ts
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   └── tenant-context.interceptor.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── current-org.decorator.ts
│   └── filters/
│       └── exception.filter.ts
├── prisma/
│   ├── prisma.module.ts
│   ├── prisma.service.ts
│   └── schema.prisma
├── queue/
│   ├── queue.module.ts
│   ├── processors/
│   │   ├── threat-analysis.processor.ts
│   │   ├── ai-triage.processor.ts
│   │   ├── repo-discovery.processor.ts
│   │   ├── report-generation.processor.ts
│   │   └── feed-sync.processor.ts
│   └── jobs/
└── websocket/
    ├── websocket.module.ts
    └── websocket.gateway.ts
```

### 6.2 Service Responsibilities

| Service | Responsibilities |
|---------|------------------|
| **ThreatModelService** | CRUD for threat models, status management, settings |
| **DiagramService** | Parse Draw.io XML, manage versions, coordinate parsers |
| **ThreatEngineService** | Generate YAML, execute Threagile, parse results, map risks |
| **TriageService** | Send risks to Claude, parse triage output, update risks |
| **ComplianceService** | Load frameworks, map risks to controls, calculate gaps |
| **RemediationService** | Load playbooks, manage status, coordinate ticket adapters |
| **ReportService** | Generate PDF/Excel/JSON/SARIF, template management |
| **VersionService** | Save versions, calculate diffs, manage rollback |
| **CICDService** | Handle webhooks, run validation, post PR comments |
| **CollaborationService** | Lock management, share links, comments |
| **ImportService** | Repo parsing, document extraction, graph generation |

---

## 7. Background Jobs

### 7.1 Queue Configuration

```typescript
// queue.module.ts
@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
      },
    }),
    BullModule.registerQueue(
      { name: 'threat-analysis' },
      { name: 'ai-triage' },
      { name: 'repo-discovery' },
      { name: 'report-generation' },
      { name: 'feed-sync' },
    ),
  ],
})
export class QueueModule {}
```

### 7.2 Job Definitions

| Queue | Job Type | Trigger | Timeout | Retries |
|-------|----------|---------|---------|---------|
| `threat-analysis` | Run Threagile | Manual, CI/CD, Auto-save | 120s | 2 |
| `ai-triage` | Triage single risk | After analysis | 30s | 3 |
| `ai-triage` | Batch triage | After analysis | 300s | 1 |
| `repo-discovery` | Parse repo | Import request | 180s | 2 |
| `report-generation` | Generate PDF | Manual, Scheduled | 60s | 2 |
| `report-generation` | Generate Excel | Manual, Scheduled | 60s | 2 |
| `feed-sync` | Sync CWE | Scheduled (daily) | 600s | 3 |
| `feed-sync` | Sync CAPEC | Scheduled (weekly) | 600s | 3 |
| `feed-sync` | Sync ATT&CK | Scheduled (weekly) | 600s | 3 |
| `feed-sync` | Sync NVD | Scheduled (daily) | 1800s | 3 |

### 7.3 Processor Example

```typescript
// threat-analysis.processor.ts
@Processor('threat-analysis')
export class ThreatAnalysisProcessor {
  constructor(
    private threatEngineService: ThreatEngineService,
    private triageService: TriageService,
    private websocketGateway: WebsocketGateway,
  ) {}

  @Process('run-analysis')
  async handleAnalysis(job: Job<{ analysisRunId: string; tenantId: string }>) {
    const { analysisRunId, tenantId } = job.data;
    
    try {
      // Update status to running
      await this.updateStatus(analysisRunId, 'running');
      this.websocketGateway.emitProgress(tenantId, analysisRunId, 10, 'Generating YAML...');
      
      // Generate Threagile YAML
      const yaml = await this.threatEngineService.generateYaml(analysisRunId);
      this.websocketGateway.emitProgress(tenantId, analysisRunId, 30, 'Running threat analysis...');
      
      // Execute Threagile
      const results = await this.threatEngineService.execute(yaml);
      this.websocketGateway.emitProgress(tenantId, analysisRunId, 60, 'Processing results...');
      
      // Map and deduplicate risks
      const risks = await this.threatEngineService.mapRisks(analysisRunId, results);
      this.websocketGateway.emitProgress(tenantId, analysisRunId, 80, 'Running AI triage...');
      
      // Queue AI triage for each risk
      await this.triageService.queueBatchTriage(risks);
      
      // Update status to completed
      await this.updateStatus(analysisRunId, 'completed', risks.length);
      this.websocketGateway.emitProgress(tenantId, analysisRunId, 100, 'Complete');
      
    } catch (error) {
      await this.updateStatus(analysisRunId, 'failed', 0, error.message);
      throw error;
    }
  }
}
```

---

## 8. Integrations

### 8.1 Threagile Executor

```typescript
// threagile.executor.ts
@Injectable()
export class ThreagileExecutor {
  private readonly dockerImage = 'threagile/threagile:latest';
  private readonly timeout = 120000; // 120 seconds
  
  async execute(yamlContent: string, customRules?: string[]): Promise<ThreagileOutput> {
    const tempDir = await this.createTempDir();
    const modelPath = path.join(tempDir, 'model.yaml');
    const outputPath = path.join(tempDir, 'output');
    
    try {
      // Write YAML to temp file
      await fs.writeFile(modelPath, yamlContent);
      
      // Build Docker command
      const args = [
        'run', '--rm',
        '-v', `${tempDir}:/app/work`,
        this.dockerImage,
        '-model', '/app/work/model.yaml',
        '-output', '/app/work/output',
      ];
      
      if (customRules?.length) {
        args.push('-custom-risk-rules', '/app/work/custom-rules/');
      }
      
      // Execute Docker
      await this.execWithTimeout('docker', args, this.timeout);
      
      // Parse output files
      const risksJson = await fs.readFile(path.join(outputPath, 'risks.json'), 'utf-8');
      const risks = JSON.parse(risksJson);
      
      return {
        risks,
        outputPath,
        success: true,
      };
      
    } catch (error) {
      if (error.killed) {
        throw new Error('Threagile execution timed out');
      }
      throw error;
    } finally {
      await this.cleanup(tempDir);
    }
  }
}
```

### 8.2 Claude Client

```typescript
// claude.client.ts
@Injectable()
export class ClaudeClient {
  private readonly client: Anthropic;
  
  constructor(private configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get('ANTHROPIC_API_KEY'),
    });
  }
  
  async triageRisk(input: TriageInput): Promise<TriageOutput> {
    const prompt = this.buildTriagePrompt(input);
    
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }
    
    return this.parseTriageResponse(content.text);
  }
  
  async extractFromDocument(documentText: string): Promise<ExtractedGraph> {
    const prompt = this.buildExtractionPrompt(documentText);
    
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    
    return this.parseExtractionResponse(response.content[0].text);
  }
  
  async *chatBuilder(currentGraph: any, userMessage: string): AsyncGenerator<string> {
    const prompt = this.buildChatPrompt(currentGraph, userMessage);
    
    const stream = await this.client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield chunk.delta.text;
      }
    }
  }
}
```

### 8.3 Ticket Adapters

```typescript
// ticket-adapter.interface.ts
export interface TicketAdapter {
  name: string;
  createTicket(input: CreateTicketInput): Promise<TicketResult>;
  updateTicket(ticketId: string, update: TicketUpdate): Promise<void>;
  getTicketStatus(ticketId: string): Promise<TicketStatus>;
}

// jira.adapter.ts
@Injectable()
export class JiraAdapter implements TicketAdapter {
  name = 'jira';
  
  async createTicket(input: CreateTicketInput): Promise<TicketResult> {
    const response = await this.client.post('/rest/api/3/issue', {
      fields: {
        project: { key: input.projectKey },
        summary: `[Threat Model] ${input.risk.title}`,
        description: this.formatDescription(input),
        issuetype: { name: 'Security Task' },
        priority: { name: this.mapSeverity(input.risk.severity) },
        labels: ['threat-model', 'security', ...input.frameworks],
      },
    });
    
    return {
      ticketId: response.data.key,
      ticketUrl: `${this.baseUrl}/browse/${response.data.key}`,
    };
  }
}
```

---

## 9. Security

### 9.1 Authentication Flow

```
1. User authenticates via Clerk/Auth0 (standalone) or TD Auth (bundled)
2. JWT issued with claims: { sub, tenant_id, email, roles, permissions }
3. Every request includes Authorization: Bearer {jwt}
4. AuthGuard validates JWT signature and expiry
5. TenantGuard extracts tenant_id, sets PostgreSQL session variable
6. LicenseGuard checks org has 'threatmodel' product license
7. Request proceeds to resolver/controller
```

### 9.2 RLS Implementation

```typescript
// prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient {
  async setTenantContext(tenantId: string): Promise<void> {
    await this.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
  }
}

// tenant-context.interceptor.ts
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}
  
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;
    
    if (tenantId) {
      await this.prisma.setTenantContext(tenantId);
    }
    
    return next.handle();
  }
}
```

### 9.3 License Guard

```typescript
// license.guard.ts
@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(private licenseService: LicenseService) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;
    
    if (!tenantId) return false;
    
    const hasLicense = await this.licenseService.hasProduct(tenantId, 'threatmodel');
    
    if (!hasLicense) {
      throw new ForbiddenException('Threat Modeling license required');
    }
    
    return true;
  }
}
```

### 9.4 Input Validation

```typescript
// All DTOs use class-validator
export class CreateThreatModelDto {
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  name: string;
  
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;
  
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  complianceFrameworks?: string[];
}
```

### 9.5 Audit Logging

```typescript
// All mutations logged
interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: string;      // create, update, delete, run_analysis, etc.
  resourceType: string; // threat_model, risk, remediation
  resourceId: string;
  changes: object;     // Before/after diff
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}
```

---

## 10. Performance

### 10.1 Caching Strategy

| Data | Cache Location | TTL | Invalidation |
|------|----------------|-----|--------------|
| Shape mappings | Redis | 1 hour | Admin approval |
| Compliance controls | Redis | 1 hour | Admin approval |
| Canonical risk mappings | Redis | 1 hour | Admin approval |
| Diagram state (active edit) | Redis | 5 minutes | On save |
| Analysis results | Redis | 24 hours | New analysis |
| User session | Redis | Session lifetime | Logout |

### 10.2 Pagination

```graphql
# All list queries use cursor-based pagination
type RiskConnection {
  edges: [RiskEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type RiskEdge {
  cursor: String!
  node: Risk!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

### 10.3 Large Diagram Handling

- Diagrams > 100 assets: Show performance warning
- Diagrams > 200 assets: Suggest splitting into sub-models
- Lazy load asset properties (fetch on select)
- Virtualized rendering for large canvases
- Incremental analysis (only re-analyze changed portions)

---

## 11. Observability

### 11.1 Logging

```typescript
// Structured JSON logging
{
  "timestamp": "2025-01-23T10:30:00Z",
  "level": "info",
  "message": "Analysis completed",
  "context": {
    "tenantId": "xxx",
    "threatModelId": "yyy",
    "analysisRunId": "zzz",
    "risksFound": 15,
    "duration": 45000
  },
  "traceId": "abc123"
}
```

### 11.2 Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `threat_models_total` | Counter | tenant_id, status |
| `analysis_runs_total` | Counter | tenant_id, status, trigger |
| `analysis_duration_seconds` | Histogram | tenant_id |
| `risks_identified_total` | Counter | tenant_id, severity |
| `triage_duration_seconds` | Histogram | - |
| `api_request_duration_seconds` | Histogram | endpoint, method, status |
| `queue_job_duration_seconds` | Histogram | queue, job_type |
| `queue_depth` | Gauge | queue |

### 11.3 Health Checks

```typescript
// GET /api/health
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 86400,
  "checks": {
    "database": { "status": "ok", "latency": 5 },
    "redis": { "status": "ok", "latency": 2 },
    "threagile": { "status": "ok" },
    "claude": { "status": "ok" }
  }
}
```

---

## 12. Document References

| Doc | Purpose |
|-----|---------|
| `00_overview.md` | Product summary, vision, tiers |
| `01_product_context.md` | Personas, stories, JTBD |
| `02_functional_spec.md` | Features, behaviors |
| **`03_technical_spec.md`** | **This document** — architecture, stack, APIs |
| `04_data_models.md` | Schema definitions, mappings |
| `05_ui_screens.md` | Screen-by-screen UI spec |
| `06_user_flows.md` | Step-by-step user journeys |
| `07_admin_console.md` | Admin app specification |
| `08_rules.md` | Code constraints for Claude Code |
| `09_implementation_plan.md` | Phased build order |

---

*Last updated: 2025-01-23*
*Author: ThreatDiviner Product Team*
