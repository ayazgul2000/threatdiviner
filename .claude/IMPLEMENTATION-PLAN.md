# ThreatDiviner - Comprehensive Implementation Plan

**Created:** 2026-01-08  
**Goal:** Complete all remaining features for production-ready DevSecOps platform

---

## Executive Summary

Based on codebase analysis, ThreatDiviner has solid foundations:
- ✅ Multi-scanner pipeline (Semgrep, Trivy, Gitleaks, Checkov, Nuclei, ZAP)
- ✅ Basic AI triage with Claude API
- ✅ Multi-tenant architecture with RLS
- ✅ Dashboard scaffolding
- ✅ Pentest module started

**Missing/Incomplete:**
- 🔴 Detailed reporting per scan/repo/pentest with CVE/CWE/MITRE
- 🔴 Cloud account connectivity and monitoring
- 🔴 Zero-day/SBOM vulnerability monitoring
- 🔴 Advanced threat modeling (STRIDE/PASTA templates)
- 🔴 RBAC completion and settings
- 🔴 Alert system
- 🔴 AI-powered features (beyond basic triage)

---

## Phase 1: Enhanced Reporting Engine (Priority: CRITICAL)

### 1.1 Unified Report Data Model
**Files to create/modify:**
- `apps/api/src/reporting/dto/report.dto.ts`
- `apps/api/src/reporting/interfaces/report.interface.ts`

```typescript
interface DetailedReport {
  id: string;
  type: 'scan' | 'pentest' | 'repository' | 'cloud' | 'compliance' | 'executive';
  scope: {
    projectId?: string;
    repositoryId?: string;
    scanId?: string;
    pentestId?: string;
    cloudAccountId?: string;
  };
  findings: EnrichedFinding[];
  compliance: ComplianceMapping[];
  trends: TrendData;
  metadata: ReportMetadata;
}

interface EnrichedFinding {
  // Core
  id: string;
  title: string;
  severity: string;
  
  // CVE Enrichment
  cve?: {
    id: string;
    cvssV3Score: number;
    cvssV3Vector: string;
    epssScore: number;
    isKev: boolean;
    exploitAvailable: boolean;
  };
  
  // CWE Mapping
  cwe?: {
    id: string;
    name: string;
    description: string;
    mitigations: string[];
  };
  
  // MITRE ATT&CK
  attack?: {
    techniqueId: string;
    tacticId: string;
    name: string;
    mitigations: string[];
  };
  
  // CAPEC
  capec?: {
    id: string;
    name: string;
    severity: string;
  };
  
  // Compliance Controls
  compliance: {
    framework: string;
    controlId: string;
    controlName: string;
  }[];
  
  // Remediation
  remediation: {
    summary: string;
    steps: string[];
    references: string[];
    aiSuggestion?: string;
  };
}
```

### 1.2 Report Templates by Type

| Report Type | Sections | Output Formats |
|-------------|----------|----------------|
| Scan Detail | Executive Summary, Findings by Scanner, CVE Details, Compliance Impact, Remediation Priority | PDF, HTML, JSON |
| Pentest | Attack Surface, Discovered Endpoints, Vulnerabilities, OWASP Top 10 Mapping, Risk Matrix | PDF, HTML |
| Repository | Historical Trends, Open vs Fixed, SBOM Summary, Dependency Risk | PDF, HTML, CSV |
| Cloud Account | Misconfigurations, Compliance Posture (CIS/SOC2), Resource Inventory | PDF, HTML |
| Compliance | Framework-specific (SOC2/PCI/HIPAA), Control Status, Evidence, Gaps | PDF, HTML |
| Executive | Risk Score, Trends, Top 10 Risks, Recommendations | PDF, PPTX |

### 1.3 Implementation Tasks

```
[ ] Create report schema with compliance standards selector
[ ] Build PDF generator with branded templates
[ ] Add CVE/CWE/MITRE enrichment service
[ ] Create report scheduling (weekly/monthly)
[ ] Add report sharing (public link with expiry)
[ ] Implement report versioning/history
```

---

## Phase 2: Cloud Account Connectivity

### 2.1 Cloud Provider Integration

**Current state:** `CloudAccount` model exists, basic CSPM started

**Needed:**
- AWS: IAM role assumption, cross-account access
- Azure: Service Principal, Management Group scan
- GCP: Service Account, Organization scan

**Files to create:**
- `apps/api/src/cspm/providers/aws.provider.ts`
- `apps/api/src/cspm/providers/azure.provider.ts`
- `apps/api/src/cspm/providers/gcp.provider.ts`
- `apps/api/src/cspm/sync/cloud-sync.service.ts`

### 2.2 Resource Discovery & Monitoring

```typescript
interface CloudResource {
  id: string;
  accountId: string;
  provider: 'aws' | 'azure' | 'gcp';
  resourceType: string;
  resourceId: string;
  region: string;
  tags: Record<string, string>;
  configuration: Record<string, unknown>;
  complianceStatus: 'compliant' | 'non_compliant' | 'unknown';
  lastChecked: Date;
}
```

### 2.3 Dashboard Pages
- `/dashboard/cloud/accounts` - Account management
- `/dashboard/cloud/resources` - Resource inventory
- `/dashboard/cloud/misconfigs` - Misconfiguration findings
- `/dashboard/cloud/compliance` - CIS/SOC2/PCI compliance

---

## Phase 3: Vulnerability Monitoring (Zero-Day + SBOM)

### 3.1 SBOM-Based Monitoring

**Current:** Basic SBOM service exists

**Needed:**
- Real-time CVE matching against SBOM
- Automated alerts for new CVEs
- Dependency graph visualization
- License compliance tracking

**Service enhancements:**
```typescript
// apps/api/src/sbom/sbom-monitor.service.ts
interface VulnerabilityAlert {
  sbomId: string;
  packageName: string;
  packageVersion: string;
  cve: {
    id: string;
    severity: string;
    published: Date;
    isZeroDay: boolean;
    exploitAvailable: boolean;
  };
  affectedProjects: string[];
  remediation: {
    fixedVersion?: string;
    workaround?: string;
  };
}
```

### 3.2 Zero-Day Intelligence Feed

**Sources to integrate:**
- NVD API (already have)
- CISA KEV (already have)
- GitHub Security Advisories
- OSV (Open Source Vulnerabilities)
- Exploit-DB
- PacketStorm

**Implementation:**
```
[ ] Create threat intel aggregator service
[ ] Implement CVE-to-SBOM matching
[ ] Build alert pipeline for new disclosures
[ ] Add vulnerability timeline view
[ ] Create "packages at risk" dashboard
```

---

## Phase 4: Advanced Threat Modeling

### 4.1 Current State Analysis

Existing models:
- `ThreatModel`, `Threat`, `ThreatMitigation`
- `ThreatModelComponent`, `ThreatModelDataFlow`
- Basic STRIDE support

**Missing:**
- PASTA methodology implementation
- Template-based threat generation
- Diagram import (draw.io, Lucidchart)
- AI-assisted threat identification

### 4.2 Template References Integration

Based on your earlier templates, implement:

```typescript
interface ThreatModelTemplate {
  methodology: 'stride' | 'pasta' | 'linddun' | 'custom';
  components: ComponentTemplate[];
  dataFlowPatterns: DataFlowPattern[];
  threatPatterns: ThreatPattern[];
}

interface ThreatPattern {
  id: string;
  strideCategory: 'S' | 'T' | 'R' | 'I' | 'D' | 'E';
  title: string;
  description: string;
  applicableComponentTypes: string[];
  defaultLikelihood: string;
  defaultImpact: string;
  mitigationTemplates: string[];
  cweIds: string[];
  attackTechniqueIds: string[];
}
```

### 4.3 Implementation Tasks

```
[ ] Create threat pattern library (50+ patterns)
[ ] Implement PASTA 7-stage workflow
[ ] Add diagram import/export (JSON, draw.io XML)
[ ] Build AI threat suggestion engine
[ ] Create threat model report generator
[ ] Add threat-to-finding correlation
```

---

## Phase 5: RBAC & Settings

### 5.1 Current RBAC State

Roles exist: `admin`, `member`, `viewer`, `developer`, `security`

**Missing:**
- Granular permission system
- Custom role creation
- Project-level permissions
- Audit trail for permission changes

### 5.2 Permission Matrix

| Permission | Admin | Security | Developer | Member | Viewer |
|------------|-------|----------|-----------|--------|--------|
| manage_users | ✅ | ❌ | ❌ | ❌ | ❌ |
| manage_projects | ✅ | ✅ | ❌ | ❌ | ❌ |
| run_scans | ✅ | ✅ | ✅ | ✅ | ❌ |
| triage_findings | ✅ | ✅ | ✅ | ❌ | ❌ |
| view_findings | ✅ | ✅ | ✅ | ✅ | ✅ |
| manage_integrations | ✅ | ✅ | ❌ | ❌ | ❌ |
| generate_reports | ✅ | ✅ | ✅ | ✅ | ❌ |
| access_api | ✅ | ✅ | ✅ | ❌ | ❌ |

### 5.3 Settings Pages

```
[ ] /settings/profile - User profile, password, 2FA
[ ] /settings/team - User management, invites
[ ] /settings/roles - Custom roles (admin only)
[ ] /settings/notifications - Alert preferences
[ ] /settings/integrations - SCM, Jira, Slack
[ ] /settings/api-keys - API key management
[ ] /settings/billing - Subscription (future)
```

---

## Phase 6: Alert System

### 6.1 Alert Types

| Alert Type | Trigger | Channels |
|------------|---------|----------|
| Critical Finding | New critical severity | Slack, Email, PagerDuty |
| Zero-Day | New CVE affects SBOM | Email, Slack |
| SLA Breach | Finding past due | Email, Jira |
| Scan Failed | Scanner error | Slack, Email |
| Compliance Drop | Score < threshold | Email |
| Cloud Misconfiguration | New high/critical | Slack, Email |

### 6.2 Alert Rule Engine

```typescript
interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    type: 'finding' | 'scan' | 'compliance' | 'sla' | 'cloud';
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains';
    value: string | number;
  }[];
  actions: {
    type: 'slack' | 'email' | 'pagerduty' | 'jira' | 'webhook';
    config: Record<string, string>;
  }[];
  throttle: {
    count: number;
    windowMinutes: number;
  };
}
```

---

## Phase 7: AI-Powered Features

### 7.1 Current AI State

- Basic triage with Claude API
- Simple fix suggestions

### 7.2 Enhanced AI Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Smart Triage | Context-aware false positive detection | HIGH |
| Fix Generation | Multi-file fix suggestions with PR creation | HIGH |
| Threat Prediction | Predict likely attack vectors from findings | MEDIUM |
| Natural Language Query | "Show me all SQL injection in auth module" | MEDIUM |
| Report Summary | AI-generated executive summaries | MEDIUM |
| Code Review | Security-focused code review comments | LOW |

### 7.3 Implementation

```typescript
// apps/api/src/ai/ai-features.service.ts

interface AITriageResult {
  findingId: string;
  isFalsePositive: boolean;
  confidence: number;
  reasoning: string;
  suggestedSeverity?: string;
  relatedFindings?: string[];
  remediationSteps: string[];
}

interface AIFixResult {
  findingId: string;
  canAutoFix: boolean;
  fix: {
    file: string;
    originalCode: string;
    fixedCode: string;
    explanation: string;
  }[];
  testSuggestions?: string[];
}
```

---

## Execution Order

### Sprint 1 (Week 1-2): Reporting Foundation
1. Enhanced report data model with CVE/CWE/MITRE
2. PDF/HTML report templates
3. Report API endpoints
4. Report dashboard page

### Sprint 2 (Week 3-4): Cloud & Monitoring
1. Cloud provider connectors (AWS priority)
2. SBOM vulnerability monitoring
3. Zero-day alert system
4. Cloud compliance dashboard

### Sprint 3 (Week 5-6): Threat Modeling & AI
1. STRIDE/PASTA templates
2. Threat pattern library
3. AI triage improvements
4. AI fix generation

### Sprint 4 (Week 7-8): Polish & Settings
1. RBAC completion
2. Settings pages
3. Alert rule engine
4. E2E testing
5. Documentation

---

## File Structure Summary

```
apps/api/src/
├── reporting/
│   ├── dto/
│   │   ├── create-report.dto.ts
│   │   └── report-response.dto.ts
│   ├── generators/
│   │   ├── pdf.generator.ts (enhance)
│   │   ├── html.generator.ts
│   │   └── compliance.generator.ts
│   ├── templates/
│   │   ├── scan-report.hbs
│   │   ├── pentest-report.hbs
│   │   └── compliance-report.hbs
│   └── reporting.service.ts (enhance)
├── cspm/
│   ├── providers/
│   │   ├── aws.provider.ts
│   │   ├── azure.provider.ts
│   │   └── gcp.provider.ts
│   └── cspm-sync.service.ts
├── alerts/
│   ├── alert-engine.service.ts
│   ├── channels/
│   │   ├── slack.channel.ts
│   │   ├── email.channel.ts
│   │   └── pagerduty.channel.ts
│   └── alerts.controller.ts
├── ai/
│   ├── triage.service.ts (enhance)
│   ├── fix-generator.service.ts
│   ├── threat-predictor.service.ts
│   └── nlq.service.ts (natural language query)
└── threat-modeling/
    ├── templates/
    │   ├── stride.templates.ts
    │   └── pasta.templates.ts
    └── threat-modeling.service.ts (enhance)

apps/dashboard/src/app/dashboard/
├── reports/
│   ├── page.tsx (enhance)
│   ├── [id]/page.tsx
│   └── generate/page.tsx
├── cloud/
│   ├── accounts/page.tsx
│   ├── resources/page.tsx
│   ├── compliance/page.tsx
│   └── [accountId]/page.tsx
├── alerts/
│   ├── page.tsx
│   ├── rules/page.tsx
│   └── history/page.tsx
└── settings/
    ├── profile/page.tsx
    ├── team/page.tsx
    ├── roles/page.tsx
    ├── notifications/page.tsx
    └── integrations/page.tsx
```

---

## Commands to Start

```bash
# Navigate to project
cd C:\dev\threatdiviner

# Check current state
git status
pnpm install

# Start development servers
cd apps/api && pnpm start:dev
cd apps/dashboard && pnpm dev

# Run tests
pnpm test
```

---

*This plan will be updated as implementation progresses.*
