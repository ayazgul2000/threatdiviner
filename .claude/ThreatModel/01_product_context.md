# 01 — Product Context

## 1. Problem Statement

### 1.1 The Current State of Threat Modeling

Threat modeling is a critical security practice — but it's broken in most organizations:

| Problem | Impact |
|---------|--------|
| **Time-intensive** | 2-4 weeks for a single threat model with architects + security SMEs in whiteboard sessions |
| **Expertise bottleneck** | Requires scarce security architects; junior teams produce inconsistent, incomplete models |
| **Static artifacts** | Threat models live in SharePoint/Confluence; never updated as architecture evolves |
| **Disconnected from code** | No link between diagrams and actual infrastructure (Terraform, K8s, Dockerfiles) |
| **Manual compliance mapping** | Mapping risks to ISO27001, NIST, VPDSS controls is a separate spreadsheet exercise |
| **No CI/CD integration** | Threat models don't gate deployments; security review is async, slows releases |
| **Outputs go nowhere** | Identified risks don't auto-create tickets; findings rot in documents |
| **No feedback loop** | Threat model doesn't inform what scanners should prioritize |

### 1.2 Why Existing Tools Fail

| Tool | Core Problem |
|------|--------------|
| **IriusRisk** | $50k+/yr, questionnaire-heavy, 6-month implementation, enterprise-only |
| **ThreatModeler** | High cost, dated UI, limited integrations, steep learning curve |
| **OWASP Threat Dragon** | Abandoned (no commits in 2+ years), basic features, no compliance |
| **Microsoft TMT** | Windows-only desktop app, no cloud, no API, no compliance mapping, XML hell |
| **Manual (Visio/Draw.io)** | No threat engine, no automation, pure documentation exercise |

### 1.3 The Opportunity

A modern threat modeling tool that:
- Is **visual-first** (diagram-driven, not questionnaire-driven)
- **Auto-discovers** architecture from code repos
- Uses **AI to triage** and explain risks
- **Maps to compliance** frameworks out of the box
- **Integrates CI/CD** pipelines natively
- **Outputs actionable items** (tickets, requirements, scanner inputs)
- Is **affordable** for mid-market teams

---

## 2. User Personas

### 2.1 Security Engineer (Primary User)

| Attribute | Detail |
|-----------|--------|
| **Role** | Security Engineer, AppSec Engineer, Security Analyst |
| **Company size** | 50-500 employees, Series A-C SaaS |
| **Reports to** | Security Lead or CISO |
| **Technical depth** | High — understands STRIDE, OWASP, can read Terraform |
| **Tools used** | Burp Suite, Semgrep, Snyk, GitHub Advanced Security, Jira |

**Goals:**
- Identify threats before code ships
- Prioritize which risks matter most
- Generate evidence for SOC2/ISO27001 audits
- Reduce back-and-forth with architects

**Pain points:**
- "I spend 3 days on each threat model manually"
- "Architects give me Visio diagrams with no security context"
- "I map risks to controls in Excel — it's error-prone"
- "Threat models are outdated the day after I finish them"
- "No one reads my threat model docs"

**Success looks like:**
- Threat model in <1 hour, not days
- Risks auto-mapped to compliance controls
- Findings become Jira tickets automatically
- CI/CD blocks risky PRs without my manual review

---

### 2.2 Solution Architect (Secondary User)

| Attribute | Detail |
|-----------|--------|
| **Role** | Solution Architect, Cloud Architect, Principal Engineer |
| **Company size** | 100-1000 employees |
| **Reports to** | CTO or VP Engineering |
| **Technical depth** | Very high — designs systems, writes Terraform, owns ADRs |
| **Tools used** | Draw.io, Lucidchart, Terraform, AWS Console, Confluence |

**Goals:**
- Design secure architectures from the start
- Get security sign-off without 2-week review cycles
- Document architecture decisions with security rationale
- Understand attack surface of proposed designs

**Pain points:**
- "Security team is a bottleneck — I wait weeks for threat model review"
- "I don't know what threats apply to my design"
- "I draw diagrams but they don't connect to security analysis"
- "Compliance requirements are opaque to me"

**Success looks like:**
- I draw architecture → instantly see threats
- Self-service threat modeling without waiting for security team
- Clear guidance on what to fix before security review
- Architecture docs include security analysis automatically

---

### 2.3 DevOps / Platform Engineer (Tertiary User)

| Attribute | Detail |
|-----------|--------|
| **Role** | DevOps Engineer, Platform Engineer, SRE |
| **Company size** | 50-500 employees |
| **Reports to** | Engineering Manager or VP Infrastructure |
| **Technical depth** | High — owns CI/CD, Terraform, Kubernetes, AWS |
| **Tools used** | GitHub Actions, Terraform, Kubernetes, ArgoCD, Datadog |

**Goals:**
- Ship secure infrastructure without slowing releases
- Automate security gates in pipelines
- Understand security impact of infrastructure changes
- Avoid security team blocking deployments

**Pain points:**
- "Security review is manual and async — blocks my PRs for days"
- "I don't know if my Terraform change introduces risks"
- "Threat models are Word docs — I can't automate against them"
- "No feedback loop between infra changes and security posture"

**Success looks like:**
- PR triggers automated threat model check
- Clear pass/fail in CI/CD pipeline
- Self-service: I see risks before security team reviews
- Infrastructure changes auto-update threat model

---

### 2.4 Compliance Officer / GRC Analyst (Stakeholder)

| Attribute | Detail |
|-----------|--------|
| **Role** | Compliance Officer, GRC Analyst, IT Auditor |
| **Company size** | 100-1000 employees, regulated industry |
| **Reports to** | CISO, CFO, or General Counsel |
| **Technical depth** | Low-medium — understands controls, not code |
| **Tools used** | Vanta, Drata, OneTrust, Excel, ServiceNow GRC |

**Goals:**
- Demonstrate compliance for audits (SOC2, ISO27001, VPDSS, APRA)
- Map security controls to frameworks
- Generate evidence packages quickly
- Track remediation of identified gaps

**Pain points:**
- "I manually map threat model findings to control frameworks"
- "Evidence collection for audits takes weeks"
- "I can't tell if threat models are current or stale"
- "No traceability from risk to remediation to closure"

**Success looks like:**
- Threat model auto-maps to my compliance frameworks
- One-click audit report generation
- Real-time view of control gaps
- Remediation tracking with evidence

---

## 3. User Stories

### 3.1 Diagram Creation

| ID | Persona | User Story |
|----|---------|------------|
| US-001 | Security Engineer | As a Security Engineer, I want to create a threat model by drawing a diagram so that I can visually represent the system architecture |
| US-002 | Security Engineer | As a Security Engineer, I want to import an existing Draw.io diagram so that I don't have to redraw from scratch |
| US-003 | Solution Architect | As a Solution Architect, I want to use familiar AWS/Azure/GCP icons so that my diagrams match our architecture standards |
| US-004 | Security Engineer | As a Security Engineer, I want to define trust boundaries so that I can identify where security controls are needed |
| US-005 | Security Engineer | As a Security Engineer, I want to draw data flows between components so that I can trace sensitive data movement |
| US-006 | Solution Architect | As a Solution Architect, I want to label data flows with protocol and authentication so that security context is captured |
| US-007 | DevOps Engineer | As a DevOps Engineer, I want to auto-generate a diagram from my Terraform files so that the threat model matches actual infrastructure |
| US-008 | DevOps Engineer | As a DevOps Engineer, I want to auto-generate a diagram from Kubernetes manifests so that I don't manually recreate cluster architecture |
| US-009 | DevOps Engineer | As a DevOps Engineer, I want to auto-generate a diagram from docker-compose.yml so that local dev environments are modeled |
| US-010 | Security Engineer | As a Security Engineer, I want to upload an architecture document (PDF/Word) and have AI extract components so that I can bootstrap from existing docs |
| US-011 | Solution Architect | As a Solution Architect, I want to describe my system in natural language chat and have a diagram generated so that I can quickly sketch ideas |
| US-012 | Security Engineer | As a Security Engineer, I want to use a guided questionnaire to build a diagram so that I don't miss key components |
| US-013 | Solution Architect | As a Solution Architect, I want to start from a template (3-tier web, serverless API, microservices) so that I have a baseline to customize |
| US-014 | Security Engineer | As a Security Engineer, I want to import from OpenAPI/Swagger spec so that API endpoints are automatically modeled |
| US-015 | DevOps Engineer | As a DevOps Engineer, I want to import from CloudFormation/Pulumi so that AWS infrastructure is captured |

### 3.2 Threat Analysis

| ID | Persona | User Story |
|----|---------|------------|
| US-020 | Security Engineer | As a Security Engineer, I want to run threat analysis on my diagram so that risks are automatically identified |
| US-021 | Security Engineer | As a Security Engineer, I want to see STRIDE-categorized threats so that I understand threat types |
| US-022 | Security Engineer | As a Security Engineer, I want risks scored by severity so that I can prioritize remediation |
| US-023 | Security Engineer | As a Security Engineer, I want AI to explain each risk in plain language so that I can communicate to stakeholders |
| US-024 | Security Engineer | As a Security Engineer, I want AI to filter false positives based on context so that I focus on real risks |
| US-025 | Security Engineer | As a Security Engineer, I want to see CWE references for each risk so that I have industry-standard classification |
| US-026 | Security Engineer | As a Security Engineer, I want to see CAPEC attack patterns for each risk so that I understand exploitation methods |
| US-027 | Security Engineer | As a Security Engineer, I want to see ATT&CK techniques mapped to risks so that I can align with threat intelligence |
| US-028 | Security Engineer | As a Security Engineer, I want to add custom risk rules so that organization-specific policies are enforced |
| US-029 | Security Engineer | As a Security Engineer, I want to click a risk and see the attack path highlighted on the diagram so that I understand the threat chain |
| US-030 | Security Engineer | As a Security Engineer, I want deduplicated risks (CIS + CWE + Threagile merged) so that I don't see the same issue 5 times |
| US-031 | Solution Architect | As a Solution Architect, I want to see risks immediately when I change the diagram so that I get instant feedback |

### 3.3 Compliance Mapping

| ID | Persona | User Story |
|----|---------|------------|
| US-040 | Compliance Officer | As a Compliance Officer, I want to select which frameworks apply (ISO27001, NIST, VPDSS, APRA, PCI-DSS) so that mapping is relevant |
| US-041 | Compliance Officer | As a Compliance Officer, I want each risk mapped to specific control clauses so that I see exactly what's non-compliant |
| US-042 | Compliance Officer | As a Compliance Officer, I want a compliance gap report showing missing controls so that I can plan remediation |
| US-043 | Compliance Officer | As a Compliance Officer, I want to filter the view by framework so that I can focus on one audit at a time |
| US-044 | Security Engineer | As a Security Engineer, I want to see which risks affect which compliance frameworks so that I can prioritize by audit impact |
| US-045 | Compliance Officer | As a Compliance Officer, I want remediation status tracked per control gap so that I can report progress to auditors |
| US-046 | Compliance Officer | As a Compliance Officer, I want to export a compliance evidence package so that auditors have what they need |

### 3.4 Remediation

| ID | Persona | User Story |
|----|---------|------------|
| US-050 | Security Engineer | As a Security Engineer, I want each risk to have remediation guidance so that developers know how to fix |
| US-051 | Security Engineer | As a Security Engineer, I want IaC code snippets for remediations so that fixes are copy-paste ready |
| US-052 | Security Engineer | As a Security Engineer, I want to create a Jira ticket from a risk with one click so that it enters the backlog |
| US-053 | Security Engineer | As a Security Engineer, I want to create a ServiceNow incident from a risk so that IT workflow is triggered |
| US-054 | DevOps Engineer | As a DevOps Engineer, I want to create an Azure DevOps work item from a risk so that it fits our tooling |
| US-055 | Security Engineer | As a Security Engineer, I want to bulk-export risks to tickets so that I don't click one by one |
| US-056 | Security Engineer | As a Security Engineer, I want to track remediation status (open/in-progress/resolved) so that I can report progress |
| US-057 | Security Engineer | As a Security Engineer, I want to mark a risk as accepted (with justification) so that known risks are documented |
| US-058 | Security Engineer | As a Security Engineer, I want to mark a risk as false positive so that it doesn't reappear |

### 3.5 Reporting

| ID | Persona | User Story |
|----|---------|------------|
| US-060 | Security Engineer | As a Security Engineer, I want a PDF executive summary so that I can share with leadership |
| US-061 | Security Engineer | As a Security Engineer, I want an Excel risk register export so that I can work in spreadsheets |
| US-062 | Security Engineer | As a Security Engineer, I want JSON export of all risks so that I can feed into other tools |
| US-063 | Compliance Officer | As a Compliance Officer, I want a compliance gap report PDF so that I can submit to auditors |
| US-064 | Security Engineer | As a Security Engineer, I want the diagram exported as PNG/SVG so that I can embed in documents |
| US-065 | Solution Architect | As a Solution Architect, I want a security requirements document generated from risks so that devs have clear specs |

### 3.6 CI/CD Integration

| ID | Persona | User Story |
|----|---------|------------|
| US-070 | DevOps Engineer | As a DevOps Engineer, I want a GitHub Action that validates threat model on PR so that security is automated |
| US-071 | DevOps Engineer | As a DevOps Engineer, I want the PR blocked if critical risks exist so that we don't ship insecure code |
| US-072 | DevOps Engineer | As a DevOps Engineer, I want risk summary posted as PR comment so that reviewers see security context |
| US-073 | DevOps Engineer | As a DevOps Engineer, I want risks uploaded as SARIF so that they appear in GitHub Security tab |
| US-074 | DevOps Engineer | As a DevOps Engineer, I want GitLab CI integration so that it works with our pipeline |
| US-075 | DevOps Engineer | As a DevOps Engineer, I want Azure DevOps pipeline integration so that enterprise teams are supported |
| US-076 | DevOps Engineer | As a DevOps Engineer, I want to configure which risk severity blocks merge so that I control the threshold |

### 3.7 Version Control & History

| ID | Persona | User Story |
|----|---------|------------|
| US-080 | Security Engineer | As a Security Engineer, I want diagram version history so that I can see how architecture evolved |
| US-081 | Security Engineer | As a Security Engineer, I want to compare threats between versions so that I see what changed |
| US-082 | Security Engineer | As a Security Engineer, I want to rollback to a previous version so that I can undo mistakes |
| US-083 | Compliance Officer | As a Compliance Officer, I want audit trail of all changes so that I can demonstrate control |

### 3.8 Collaboration

| ID | Persona | User Story |
|----|---------|------------|
| US-090 | Security Engineer | As a Security Engineer, I want to share a threat model link with architects so that they can view |
| US-091 | Solution Architect | As a Solution Architect, I want to add comments on diagram elements so that I can ask questions |
| US-092 | Security Engineer | As a Security Engineer, I want to assign risks to team members so that ownership is clear |
| US-093 | Security Engineer | As a Security Engineer, I want to lock a threat model for editing so that concurrent edits don't conflict |
| US-094 | Compliance Officer | As a Compliance Officer, I want read-only access to threat models so that I can review without changing |

### 3.9 Platform Integration (TD-Bundled)

| ID | Persona | User Story |
|----|---------|------------|
| US-100 | Security Engineer | As a Security Engineer, I want threat model risks to appear in TD unified dashboard so that I have single pane of glass |
| US-101 | Security Engineer | As a Security Engineer, I want to link threat model assets to scanned repositories so that findings correlate |
| US-102 | Security Engineer | As a Security Engineer, I want high-risk assets from threat model to prioritize scanner targets so that we scan what matters |
| US-103 | Security Engineer | As a Security Engineer, I want scanner findings to validate/invalidate threat model risks so that models stay accurate |

---

## 4. Jobs To Be Done (JTBD)

| Situation | Motivation | Outcome |
|-----------|------------|---------|
| When I'm designing a new microservice | I want to understand its security risks | So I can address them before writing code |
| When I receive a Visio diagram from architects | I want to quickly turn it into a threat model | So I don't spend days recreating it |
| When our infrastructure changes | I want the threat model to update automatically | So it doesn't become stale |
| When preparing for SOC2 audit | I want to generate compliance evidence | So I can respond to auditors quickly |
| When a PR changes security-sensitive code | I want automated threat validation | So risky changes don't slip through |
| When I identify a critical risk | I want to create a ticket immediately | So it gets into the dev backlog |
| When explaining risks to leadership | I want a clear executive summary | So they understand impact without technical jargon |
| When onboarding a new system | I want to start from a template | So I have a baseline threat model quickly |
| When multiple teams share infrastructure | I want a single source of truth for threats | So we don't duplicate effort |
| When auditors ask "how do you do threat modeling?" | I want to demonstrate a repeatable process | So we pass the audit control |

---

## 5. Competitive Pain Points (What Users Hate)

| Tool | User Complaint |
|------|----------------|
| **IriusRisk** | "Questionnaires take forever", "Costs more than our entire security budget", "6-month implementation" |
| **ThreatModeler** | "UI feels like 2005", "Can't figure out how to use it", "No API for automation" |
| **Threat Dragon** | "It's dead — no updates in years", "Missing basic features", "No compliance mapping" |
| **Microsoft TMT** | "Windows only?!", "XML files are unmanageable", "Can't integrate with anything" |
| **Manual process** | "Takes 2 weeks per model", "Outdated immediately", "No one reads the docs" |

---

## 6. Success Metrics

### 6.1 Activation Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| Time to first diagram | Minutes from signup to first saved diagram | <10 min |
| Time to first analysis | Minutes from signup to first threat analysis run | <15 min |
| Activation rate | % signups who complete first threat analysis in 7 days | >40% |

### 6.2 Engagement Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| Threat models per org/month | Average models created or updated | >3 |
| Analysis runs per model/month | How often threat engine is executed | >5 |
| Risks triaged per week | Risks marked resolved/accepted/false-positive | >20 |

### 6.3 Value Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| Avg risks identified per model | Number of risks found per threat model | >15 |
| Compliance reports generated/month | Reports exported for audit evidence | >2 per org |
| Tickets created from risks | Risks converted to actionable tickets | >50% of high/critical |
| CI/CD integrations active | Orgs with pipeline integration enabled | >30% of Pro+ |

### 6.4 Business Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| Free to paid conversion | % free users upgrading to paid tier | >5% |
| Net revenue retention | Revenue retained + expansion | >110% |
| NPS | Net promoter score | >40 |

---

## 7. Document References

| Doc | Purpose |
|-----|---------|
| `00_overview.md` | Product summary, vision, tiers |
| **`01_product_context.md`** | **This document** — personas, stories, JTBD |
| `02_functional_spec.md` | Features, interactions, behaviors |
| `03_technical_spec.md` | Architecture, stack, APIs |
| `04_data_models.md` | Schema definitions, mappings |
| `05_ui_screens.md` | Screen-by-screen UI spec |
| `06_user_flows.md` | Step-by-step user journeys |
| `07_admin_console.md` | Admin app specification |
| `08_rules.md` | Code constraints for Claude Code |
| `09_implementation_plan.md` | Phased build order |

---

*Last updated: 2025-01-23*
*Author: ThreatDiviner Product Team*
