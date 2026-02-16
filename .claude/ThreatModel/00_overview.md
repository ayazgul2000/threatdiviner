# 00 — Threat Modeling Product Overview

## 1. Product Vision

**AI-powered threat modeling that transforms architecture diagrams into actionable security risks mapped to compliance frameworks — integrated into the DevSecOps pipeline.**

---

## 2. Problem Statement

Manual threat modeling is broken:

- **Time-consuming:** Takes days/weeks with security architects in whiteboard sessions
- **Expertise-dependent:** Requires scarce security SMEs; inconsistent quality across teams
- **Static outputs:** Threat models rot in SharePoint/Confluence; never updated as architecture evolves
- **Disconnected from code:** No link between diagrams and actual infrastructure (Terraform, K8s, etc.)
- **Compliance afterthought:** Mapping risks to frameworks (ISO27001, NIST, VPDSS) is separate manual effort
- **No CI/CD integration:** Threat models don't gate deployments; security review is async bottleneck

Existing tools fail:

- **IriusRisk:** Expensive, complex questionnaire-heavy UX, enterprise sales cycle
- **ThreatModeler:** High cost, clunky interface, limited automation
- **OWASP Threat Dragon:** Abandoned, no active development, basic features only
- **Microsoft TMT:** Windows-only desktop app, no cloud, no API, no compliance mapping

---

## 3. Target Market

| Segment | Why They Need It |
|---------|------------------|
| **Mid-market SaaS companies** | Growing security requirements, SOC2/ISO27001 pressure, small security teams |
| **Regulated industries** | Finance (APRA CPS 234), Health (HIPAA), Government (VPDSS, ISM, NIST) — audit-driven |
| **Security consultancies** | Deliver threat models to clients faster, standardized methodology |
| **MSPs/MSSPs** | Multi-tenant threat modeling as service offering |
| **Enterprise DevSecOps teams** | Shift-left threat modeling into CI/CD pipelines |

**Primary buyer:** Security Lead / CISO
**Primary user:** Security Engineer, Solution Architect, DevOps Lead, Compliance Officer

---

## 4. Product Modes

### 4.1 Standalone Mode

- Own authentication (Clerk/Auth0)
- Own billing (Stripe)
- Full UI: dashboard, editor, reports, settings
- Own domain: `threatmodel.io` or `diviner.security`
- Complete product, no TD dependency

### 4.2 TD-Bundled Mode

- Headless service behind TD API gateway
- TD handles auth, billing, org/user context
- Appears as "Threat Modeling" module in TD dashboard
- Shares event bus: threat model risks feed into TD unified findings
- License check via TD subscription service (`product_id: threatmodel`)
- Same codebase, deployment flag switches mode

### 4.3 Mode Switching Logic

```
if (process.env.DEPLOYMENT_MODE === 'standalone') {
  // Full app: own auth, billing, UI shell
} else {
  // Bundled: headless API, TD provides context via JWT
}
```

---

## 5. Core Value Propositions

| # | Value Prop | How We Deliver |
|---|------------|----------------|
| 1 | **Diagram-first workflow** | Draw.io-based editor with security shape library; visual = intuitive |
| 2 | **Auto-discovery from code** | Parse Terraform, K8s, Docker, OpenAPI → bootstrap diagram automatically |
| 3 | **AI-powered triage** | Claude analyzes risks, scores severity, filters false positives, explains impact |
| 4 | **Compliance mapping built-in** | Select frameworks (VPDSS, ISM, NIST, ISO27001, APRA, PCI-DSS) → risks map to control gaps |
| 5 | **CI/CD native** | PR-triggered threat model validation; block merges on critical risks |
| 6 | **Single pane of glass** | Unified risk view: threat model risks + scanner findings (when TD-bundled) |

---

## 6. Output Usage — Where Threat Model Outputs Flow

| Output Type | Destination | Purpose |
|-------------|-------------|---------|
| **Remediation tickets** | Jira, ServiceNow, Azure DevOps, Linear | Actionable tasks assigned to dev/security teams with risk context, remediation steps, compliance references |
| **Security requirements** | Confluence, Notion, Markdown export | Generated security requirements doc per threat model for architecture review gates |
| **PR comments** | GitHub, GitLab, Bitbucket | CI/CD posts risk summary on PRs affecting modeled components; blocks merge if critical |
| **SARIF upload** | GitHub Security tab, IDE plugins | Standardized format for risks to appear in developer tooling |
| **TD unified findings** | ThreatDiviner dashboard | Threat model risks merge with scanner findings for single risk view |
| **Scanner prioritization** | TD Code Scan, DAST, PenTest modules | High-risk assets from threat model inform scan targeting (scan what matters) |
| **Compliance evidence** | Audit packages (PDF, Excel) | Pre-formatted reports for ISO27001, SOC2, VPDSS audits with control mappings |
| **Attack path data** | Security training, red team briefs | Visual attack chains for security awareness and penetration test scoping |
| **Architecture feedback** | Architects, DevOps | Identified design flaws fed back to architecture review process before build |
| **API/Webhook** | Custom integrations, SIEM, GRC tools | JSON payload of risks, assets, compliance gaps for downstream automation |

**Key principle:** Threat model is not a static document — it's a living input that drives actions across the DevSecOps lifecycle.

---

## 7. Licensing Tiers

| Feature | Starter | Pro | Enterprise |
|---------|---------|-----|------------|
| **Price** | $99/mo | $299/mo | $799/mo |
| **Users** | 3 | 10 | Unlimited |
| **Threat Models** | 5 | 25 | Unlimited |
| Manual diagram editor | ✅ | ✅ | ✅ |
| Threagile threat engine | ✅ | ✅ | ✅ |
| Template library | ✅ | ✅ | ✅ |
| Repo auto-discovery | ❌ | ✅ | ✅ |
| Doc upload + AI extraction | ❌ | ✅ | ✅ |
| AI chat builder | ❌ | ✅ | ✅ |
| Wizard questionnaire | ❌ | ✅ | ✅ |
| AI triage | ❌ | ✅ | ✅ |
| Compliance frameworks | ❌ | 1 framework | All frameworks |
| Attack path visualization | ❌ | ✅ | ✅ |
| CI/CD integration | ❌ | ✅ | ✅ |
| Ticket export (Jira/ServiceNow/ADO) | ❌ | ✅ | ✅ |
| API access | ❌ | ❌ | ✅ |
| SSO (SAML/OIDC) | ❌ | ❌ | ✅ |
| Admin console access | ❌ | ❌ | ✅ |
| Custom risk rules | ❌ | ❌ | ✅ |
| Dedicated support | ❌ | ❌ | ✅ |

---

## 8. Integration Points (TD Platform)

When bundled with ThreatDiviner platform:

| Integration | Mechanism |
|-------------|-----------|
| **Auth context** | TD JWT contains `tenant_id`, `user_id`, `roles` — Threat Modeling service validates and extracts |
| **License check** | API gateway calls `LicenseService.hasProduct(tenant_id, 'threatmodel')` before routing |
| **Database** | Shared Postgres, existing schema with RLS on `tenant_id` |
| **Event bus** | Publishes `threat.risk.created`, `threat.model.updated` events; TD dashboard subscribes |
| **Unified findings** | Threat model risks appear in TD's unified risk dashboard alongside scanner findings |
| **Cross-linking** | Threat model asset → linked to Repository/Scan; click-through navigation |
| **Dashboard widget** | TD dashboard shows "Threat Models: 5 | Critical Risks: 12" summary card |

---

## 9. Competitive Landscape

| Tool | Weakness | Our Advantage |
|------|----------|---------------|
| **IriusRisk** | Expensive ($50k+/yr), questionnaire-heavy, slow | Visual-first, AI-assisted, 10x cheaper |
| **ThreatModeler** | Complex UI, high cost, limited integrations | Modern UX, CI/CD native, DevSecOps-focused |
| **OWASP Threat Dragon** | Abandoned, basic features, no compliance | Active development, AI triage, full compliance mapping |
| **Microsoft TMT** | Windows-only, desktop app, no API, no cloud | Cloud-native, cross-platform, API-first |
| **Manual (Visio/Draw.io)** | No threat engine, no automation | Automated threat detection, compliance mapping |

**Our positioning:** The modern, affordable, AI-powered threat modeling tool built for DevSecOps teams.

---

## 10. Out of Scope

Explicitly NOT building (for now):

| Item | Reason | Future Consideration |
|------|--------|----------------------|
| Real-time collaborative editing | CRDT complexity; lock-based editing sufficient | Post-launch if demand |
| Mobile app | Low priority for threat modeling workflow | Unlikely |
| On-premise deployment | SaaS-first; adds operational complexity | Enterprise demand only |
| Custom threat library UI (end-user) | Admin console handles; not user-facing | Keep in admin |
| Offline mode | Cloud-native, requires Threagile Docker | No plans |
| White-label/reseller | Complexity; direct sales first | Enterprise tier later |

---

## 11. Success Criteria

### Launch Metrics (First 90 Days)

| Metric | Target |
|--------|--------|
| Threat models created | 500+ |
| Risks identified | 5,000+ |
| Compliance reports generated | 200+ |
| Avg time to first analysis | <5 minutes |
| CI/CD integrations active | 50+ |
| Paid conversions | 30+ |

### Ongoing KPIs

| Metric | Definition |
|--------|------------|
| **Activation rate** | % of signups that create first threat model within 7 days |
| **Engagement** | Avg threat models per org per month |
| **Retention** | Monthly active orgs (ran at least 1 analysis) |
| **Expansion** | % orgs upgrading tiers |
| **NPS** | Net promoter score from in-app survey |

---

## 12. Document Index

This overview is part of the Threat Modeling Product Specification:

| Doc | Purpose |
|-----|---------|
| `00_overview.md` | This document — product summary |
| `01_product_context.md` | Personas, user stories, JTBD |
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
