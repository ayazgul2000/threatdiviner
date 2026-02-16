# ThreatDiviner - Entity Definitions

Complete reference for all platform entities, relationships, and behaviors.

---

## **Tenant**

**Industry terms:** Organization, account, customer, workspace, company, client instance

**In ThreatDiviner:** Top-level isolation boundary. All data is tenant-scoped via row-level security. The billing unit and compliance reporting root.

**Hierarchy:** **Tenant** → Project → Repository → Scan → Finding (root node)

**Relations:**
- 1:n Users (many users per tenant)
- 1:n Projects (many projects per tenant)
- 1:n Connections (SCM integrations per tenant)
- 1:n CloudAccounts (CSPM accounts per tenant)
- 1:n ApiKeys (CI/CD keys per tenant)

**Created automatically when:** First user signs up, SSO domain verified, enterprise contract provisioned

**Created manually when:** Platform admin creates tenant via admin panel, API provisioning for enterprise

**Configured via:** Admin settings — plan tier, user limits, feature flags, SSO config, data retention policy

**Cannot be:** Merged with another tenant, accessed cross-tenant (hard isolation), deleted without cascade confirmation

**Statuses:** ACTIVE | SUSPENDED (non-payment) | DELETED (soft, 30-day retention)

**Contains:** All projects, users, connections, API keys, audit logs, billing info

**Unit of reporting:** Executive dashboard, billing invoice, total compliance posture, aggregate SLA metrics

**Examples:**
- "Acme Corp" tenant, Pro plan, 12 users, 5 projects, 847 total findings
- Enterprise tenant with SSO via Okta, custom retention policy 2 years

---

## **User**

**Industry terms:** Member, account, team member, developer, operator, admin

**In ThreatDiviner:** An authenticated person who can access the platform. Belongs to exactly one tenant. Has role-based permissions.

**Hierarchy:** Tenant → **User** (parallel to projects, not hierarchical)

**Relations:**
- n:1 Tenant (one user belongs to one tenant)
- 1:n AuditLogs (actions attributed to user)
- n:n Teams (user can be in multiple teams)

**Created automatically when:** OAuth signup (GitHub/GitLab), SSO login (SAML/OIDC), invite accepted

**Created manually when:** Admin invites via email, API user provisioning

**Configured via:** Profile settings — name, email, notification prefs, 2FA. Admin can change role.

**Cannot be:** In multiple tenants (must create separate account), deleted if sole admin

**Roles:** VIEWER (read-only) | DEVELOPER (read + trigger scans + triage) | ADMIN (full access + settings + team mgmt)

**Statuses:** ACTIVE | INVITED (pending acceptance) | DISABLED (admin suspended)

**Contains:** Profile info, notification preferences, API key ownership, audit trail

**Unit of reporting:** Audit logs per user, findings assigned to user, activity metrics

**Examples:**
- dev@acme.com, DEVELOPER role, GitHub OAuth, 2FA enabled
- admin@acme.com, ADMIN role, invited 3 team members this month

---

## **Project**

**Industry terms:** Application, product, workload, system, service, portfolio item

**In ThreatDiviner:** Organizational container grouping repos, threat models, environments that belong to one application. All metrics roll up here.

**Hierarchy:** Tenant → **Project** → Repository → Scan → Finding

**Relations:**
- n:1 Tenant (many projects per tenant)
- 1:n Repository (many repos per project)
- 1:n ThreatModel (many models per project)
- 1:n Environment (many envs per project)
- 1:n PipelineGate (many gates per project)

**Created automatically when:** (Optional) First repo imported if AUTO_CREATE_PROJECT enabled

**Created manually when:** User clicks "New Project" in sidebar or projects page, API call

**Configured via:** Project settings — name, description, default SLA policy, notification rules

**Cannot be:** Shared across tenants, deleted if contains active scans (must archive first)

**Statuses:** ACTIVE → ARCHIVED (hidden, read-only) → DELETED (soft delete, 30-day purge)

**Contains:** Grouped repositories, threat models, environments, pipeline gates, aggregated findings

**Unit of reporting:** Project dashboard, per-app compliance score, project-level SLA metrics, executive summaries

**Examples:**
- "Payment Gateway" project: 3 repos (api, frontend, infra), 1 threat model, 2 environments (staging, prod)
- "Customer Portal" project: 2 repos, 47 open findings, 89% SLA compliance

---

## **Repository**

**Industry terms:** Repo, codebase, source repository, git repo, code repository

**In ThreatDiviner:** Connected SCM repository that is the primary scan target. Links to external provider (GitHub/GitLab/Bitbucket/Azure).

**Hierarchy:** Tenant → Project → **Repository** → Scan → Finding

**Relations:**
- n:1 Project (many repos per project, optional)
- n:1 Tenant (always scoped to tenant)
- n:1 Connection (uses one SCM connection for auth)
- 1:1 ScanConfig (one config per repo)
- 1:n Scan (many scans per repo)
- 1:n Finding (many findings per repo)
- 1:n SBOM (many SBOMs per repo, one per branch/version)
- 1:n Baseline (suppressed findings per repo)

**Created automatically when:** OAuth connection syncs accessible repos, webhook auto-registers repo

**Created manually when:** User adds repo via PAT + URL, user links existing repo to project

**Configured via:** Repo settings page — default branch, scan config toggles, DAST target URL, webhook secret

**Cannot be:** Moved between tenants, scanned without valid connection, deleted if scans in progress

**Statuses:** ACTIVE | INACTIVE (paused scanning) | ARCHIVED

**Contains:** Scan history, findings, SBOMs, baselines, scan config, last scan timestamp

**Unit of reporting:** Repo health badge, findings by severity, scan frequency, branch coverage

**Examples:**
- `payment-api` GitHub repo, TypeScript, main branch, last scanned 2 hours ago, 12 open findings
- `infrastructure` GitLab repo, HCL/Terraform, weekly scheduled scan, 3 IaC misconfigurations

---

## **Connection**

**Industry terms:** SCM connection, git integration, source control link, OAuth app, PAT token

**In ThreatDiviner:** Authentication credentials linking to a source code management platform. Enables repo access, PR comments, status checks.

**Hierarchy:** Tenant → **Connection** → Repository (enables access)

**Relations:**
- n:1 Tenant (many connections per tenant)
- 1:n Repository (one connection can access many repos)

**Created automatically when:** User completes OAuth flow (GitHub/GitLab/Bitbucket/Azure DevOps)

**Created manually when:** User enters PAT + provider, admin configures GitHub App installation

**Configured via:** Connections page — refresh token, scope permissions, repo access filters

**Cannot be:** Shared across tenants, used after token expires (must reauth)

**Types:** OAUTH (user-level, refresh flow) | PAT (personal access token, static) | APP (GitHub App installation)

**Statuses:** VALID | EXPIRED (needs reauth) | REVOKED (user revoked on provider side)

**Contains:** Access token (encrypted), refresh token, provider type, scope, last used timestamp

**Unit of reporting:** Connection health, repos accessible, last sync time

**Examples:**
- GitHub OAuth for user@acme.com, valid, 15 repos accessible, last used today
- GitLab PAT for CI/CD service account, expires in 30 days, 3 repos

---

## **ScanConfig**

**Industry terms:** Scan settings, scanner configuration, security policy, pipeline config

**In ThreatDiviner:** Per-repository configuration defining which scanners run and how. Controls scan behavior.

**Hierarchy:** Repository → **ScanConfig** (1:1 relationship)

**Relations:**
- 1:1 Repository (one config per repo)

**Created automatically when:** Repository is added (default config applied)

**Created manually when:** Never — always auto-created with repo

**Configured via:** Repo settings page — toggle each scanner, set DAST URL, enable diff-only mode, severity thresholds

**Cannot be:** Deleted independently (cascade from repo), shared across repos

**Toggles:**
- SAST: Semgrep (default on), Bandit (Python), Gosec (Go)
- SCA: Trivy (default on)
- Secrets: Gitleaks (default on), TruffleHog (deep history)
- IaC: Checkov (default on for .tf/.yaml files)
- DAST: Nuclei, ZAP (requires dastTargetUrl)
- Container: Trivy image scan

**Settings:** prDiffOnly (scan only changed files), dastTargetUrl, severity threshold, branch filters

**Unit of reporting:** N/A (configuration only)

**Examples:**
- Python API repo: Semgrep + Bandit + Trivy + Gitleaks enabled, Checkov disabled
- Frontend repo: Semgrep + Trivy only, prDiffOnly=true for faster PR scans

---

## **Scan**

**Industry terms:** Scan run, security scan, analysis job, pipeline check, CI security gate, code analysis

**In ThreatDiviner:** One execution of configured scanners against a repository branch at a specific commit. Produces findings. The unit of "when did we check security."

**Hierarchy:** Tenant → Project → Repository → **Scan** → Finding

**Relations:**
- n:1 Repository (many scans per repo)
- n:1 Project (inherited from repo)
- 1:n Finding (one scan produces 0-500+ findings)
- 1:1 Commit (tied to specific SHA)

**Created automatically when:** PR opened/updated, push to monitored branch, scheduled cron fires, webhook received from SCM

**Created manually when:** User clicks "Run Scan" on repo detail page, API call `POST /scans`, CLI command `tdiv scan`

**Configured via:** ScanConfig on repository — toggle scanners on/off, set DAST target URL, enable PR-diff-only mode, set branch filters

**Cannot be:** Edited after creation, manually status-changed (status flows automatically), deleted individually (cascade from repo only)

**Statuses:** QUEUED → RUNNING → COMPLETED | FAILED (linear, no loops, no manual override)

**Contains:** Scanner results (SAST, SCA, Secrets, IaC, DAST), duration, branch, commit SHA, finding counts by severity

**Unit of reporting:** Pass/fail for pipeline gates, scan duration for performance, finding delta vs previous scan for trends

**Blocking behavior:** If PipelineGate configured and criticals > threshold, scan fails the PR check. Configurable per-project.

**Examples:**
- Auto: PR #47 triggers scan, runs SAST+SCA+Secrets, completes in 32s, posts findings as PR comment
- Manual: User clicks "Run Scan" on `payment-api`, selects `develop` branch, scan queues then runs full suite
- Scheduled: Cron `0 2 * * *` triggers nightly full scan including DAST against staging URL

---

## **Finding**

**Industry terms:** Vulnerability, issue, alert, defect, security bug, CVE hit, weakness, risk item

**In ThreatDiviner:** A single security issue detected by a scanner, normalized with severity, status, location, remediation. The atomic unit of security work.

**Hierarchy:** Tenant → Project → Repository → Scan → **Finding** (leaf node)

**Relations:**
- n:1 Scan (many findings per scan)
- n:1 Repository (many findings per repo)
- n:1 Project (inherited from repo)
- 0:1 CVE (optional link via cveId)
- 0:1 CWE (optional link via cweId)
- 0:1 JiraTicket (if synced to Jira)
- 0:1 Baseline (if suppressed)
- 0:1 SbomComponent (for SCA findings)

**Created automatically when:** Scanner detects issue. Deduplicated by ruleId + filePath + lineNumber — same issue across scans links to same finding.

**Created manually when:** Never — findings only come from scanners

**Configured via:** Status change (triage), dismiss with reason, add notes, link to Jira

**Cannot be:** Manually created, severity changed (from scanner), deleted (only resolved/dismissed)

**Statuses:** OPEN → IN_PROGRESS (assigned/working) → RESOLVED (code fixed) | DISMISSED (false positive/accepted risk)

**Auto-transitions:** If finding disappears in next scan → auto-RESOLVED. If dismissed finding reappears → stays DISMISSED (baseline).

**Contains:** ruleId, title, severity, scanner, filePath, lineNumber, cweId, cveId, description, remediation, firstSeenAt, slaDeadline

**Unit of reporting:** Individual finding for dev action. Aggregated by severity/scanner/status for dashboards. SLA tracking per finding.

**SLA behavior:** Deadline auto-calculated: CRITICAL=7d, HIGH=30d, MEDIUM=90d, LOW=180d, KEV=14d. Status: ON_TRACK | AT_RISK | BREACHED.

**Examples:**
- SQL Injection in `src/api/users.ts:47`, CRITICAL, SEMGREP, CWE-89, OPEN, SLA due in 5 days
- Vulnerable lodash@4.17.20, HIGH, TRIVY, CVE-2024-1234, RESOLVED (upgraded to 4.17.21)
- AWS key in `config.js:12`, CRITICAL, GITLEAKS, DISMISSED (test key, added to baseline)

---

## **Baseline**

**Industry terms:** Suppression, exception, whitelist, ignore rule, false positive marker, accepted risk

**In ThreatDiviner:** A suppressed finding that should not trigger alerts or fail gates. Tracks accepted risks and confirmed false positives.

**Hierarchy:** Repository → **Baseline** → Finding (links findings to suppression)

**Relations:**
- n:1 Repository (many baselines per repo)
- 1:n Finding (one baseline can cover many similar findings)

**Created automatically when:** User clicks "Dismiss" on finding with "Add to baseline" checked

**Created manually when:** User creates baseline rule via settings, API call, CLI baseline command

**Configured via:** Baseline settings — pattern matching (ruleId, filePath glob, reason), expiry date

**Cannot be:** Applied cross-repo, created without reason, permanent without review date

**Types:** FALSE_POSITIVE (scanner wrong) | ACCEPTED_RISK (known, won't fix) | WONT_FIX (technical debt acknowledged)

**Statuses:** ACTIVE | EXPIRED (past review date) | REVOKED (admin removed)

**Contains:** Pattern (ruleId, path), reason, created by, review date, linked findings

**Unit of reporting:** Baseline coverage, expiring baselines, accepted risk inventory

**Examples:**
- Suppress `hardcoded-secret` in `test/fixtures/*` — reason: "Test data only"
- Accept CVE-2024-5678 in lodash — reason: "No upgrade path, mitigated by WAF" — review: 2025-03-01

---

## **SBOM**

**Industry terms:** Software Bill of Materials, dependency list, component inventory, package manifest, SPDX, CycloneDX

**In ThreatDiviner:** Machine-readable inventory of all software components in a repository version. Basis for continuous CVE monitoring.

**Hierarchy:** Tenant → Project → Repository → **SBOM** → SbomComponent

**Relations:**
- n:1 Repository (many SBOMs per repo, one per branch/version)
- n:1 Project (inherited from repo)
- 1:n SbomComponent (one SBOM has many components)
- 1:n SbomVulnerability (vulnerabilities found in components)

**Created automatically when:** Trivy SCA scan completes (generates CycloneDX), container scan runs

**Created manually when:** User uploads SPDX/CycloneDX file via UI or API

**Configured via:** SBOM settings — format preference, auto-generation on scan toggle

**Cannot be:** Edited (immutable snapshot), merged across repos

**Formats:** CYCLONEDX (default) | SPDX

**Contains:** Component list with name, version, license, purl, vulnerabilities, dependency tree

**Unit of reporting:** Component count, vulnerability count by severity, license distribution, dependency depth

**Continuous monitoring:** Daily CVE match against components — new CVE affecting existing component triggers alert without rescan.

**Examples:**
- SBOM for payment-api@main: 142 components, 3 critical vulns, generated from Trivy scan
- Uploaded SPDX for legacy-service: 89 components, used for compliance audit

---

## **SbomComponent**

**Industry terms:** Package, dependency, library, module, artifact, third-party component

**In ThreatDiviner:** A single software package within an SBOM. Tracked for vulnerabilities and license compliance.

**Hierarchy:** SBOM → **SbomComponent** → SbomVulnerability

**Relations:**
- n:1 SBOM (many components per SBOM)
- 1:n SbomVulnerability (one component can have many CVEs)

**Created automatically when:** SBOM is generated or uploaded

**Created manually when:** Never — comes from SBOM parser

**Cannot be:** Edited, deleted individually, added without SBOM

**Contains:** name, version, type (npm/pypi/maven/go), license, purl (package URL), isDirect (direct vs transitive)

**Unit of reporting:** Per-component vulnerability status, license type, update availability

**Examples:**
- lodash@4.17.20, npm, MIT license, direct dependency, 1 HIGH vulnerability
- express@4.18.2, npm, MIT, direct, 0 vulnerabilities

---

## **ThreatModel**

**Industry terms:** Threat model, security architecture, risk assessment, STRIDE analysis, attack tree, DFD

**In ThreatDiviner:** Visual and analytical security design document identifying threats and mitigations for a system. Created during design phase.

**Hierarchy:** Tenant → Project → **ThreatModel** → ThreatModelComponent, Threat

**Relations:**
- n:1 Project (many models per project)
- n:1 Tenant (scoped to tenant)
- 1:n ThreatModelComponent (system parts)
- 1:n ThreatModelDataFlow (data movements)
- 1:n Threat (identified threats)
- 1:n ThreatMitigation (countermeasures)

**Created automatically when:** (Optional) Generated from OpenAPI spec, Terraform, or Kubernetes manifests

**Created manually when:** User clicks "New Threat Model", imports from draw.io/Visio, API creation

**Configured via:** Threat model editor — add components, draw data flows, run analysis, add mitigations

**Cannot be:** Shared cross-project, auto-updated (manual refresh required)

**Methodologies:** STRIDE | PASTA | LINDDUN | DREAD

**Statuses:** DRAFT → IN_PROGRESS → COMPLETED → ARCHIVED

**Contains:** Components (processes, datastores, external entities), data flows, trust boundaries, threats, mitigations

**Unit of reporting:** Threat count, mitigation coverage %, risk score, component count

**Examples:**
- "Payment API Threat Model" using STRIDE: 8 components, 23 threats, 15 mitigations, 65% coverage
- Auto-generated from OpenAPI: 12 endpoints mapped to data flows, 18 STRIDE threats identified

---

## **ThreatModelComponent**

**Industry terms:** System component, DFD element, architecture block, service, node

**In ThreatDiviner:** A part of the system being threat modeled — process, datastore, external entity, or trust boundary.

**Hierarchy:** ThreatModel → **ThreatModelComponent**

**Relations:**
- n:1 ThreatModel (many components per model)
- 1:n ThreatModelDataFlow (as source or target)
- 1:n Threat (threats targeting this component)

**Created automatically when:** Threat model generated from spec/IaC

**Created manually when:** User adds component in editor

**Types:** PROCESS | DATASTORE | EXTERNAL_ENTITY | TRUST_BOUNDARY

**Contains:** name, type, technology, criticality (LOW/MEDIUM/HIGH/CRITICAL), dataClassification, description

**Examples:**
- "API Gateway" — PROCESS, NestJS, CRITICAL criticality, handles CONFIDENTIAL data
- "PostgreSQL DB" — DATASTORE, PostgreSQL, CRITICAL, stores RESTRICTED data

---

## **Threat**

**Industry terms:** Threat, risk, attack vector, vulnerability class, STRIDE category

**In ThreatDiviner:** An identified security threat from threat modeling analysis. Linked to components and mitigations.

**Hierarchy:** ThreatModel → **Threat** → ThreatMitigation

**Relations:**
- n:1 ThreatModel (many threats per model)
- n:1 ThreatModelComponent (threat targets a component)
- 1:n ThreatMitigation (mitigations addressing this threat)
- 0:1 CWE (mapped to weakness type)

**Created automatically when:** STRIDE/PASTA/LINDDUN analysis runs on threat model

**Created manually when:** User adds threat in editor

**Categories (STRIDE):** SPOOFING | TAMPERING | REPUDIATION | INFORMATION_DISCLOSURE | DENIAL_OF_SERVICE | ELEVATION_OF_PRIVILEGE

**Statuses:** IDENTIFIED → MITIGATED | ACCEPTED | TRANSFERRED

**Contains:** title, category, description, likelihood, impact, riskScore, cweId, status

**Risk calculation:** likelihood × impact = riskScore (1-10 scale)

**Examples:**
- "SQL Injection on user input" — TAMPERING, HIGH likelihood, CRITICAL impact, risk 9, CWE-89
- "Unauthorized admin access" — ELEVATION_OF_PRIVILEGE, LOW likelihood, CRITICAL impact, risk 7

---

## **ThreatMitigation**

**Industry terms:** Countermeasure, control, safeguard, security measure, remediation

**In ThreatDiviner:** A security control that addresses an identified threat. Tracks implementation status.

**Hierarchy:** Threat → **ThreatMitigation**

**Relations:**
- n:1 Threat (many mitigations per threat)

**Created automatically when:** AI suggests mitigations during analysis

**Created manually when:** User adds mitigation in editor

**Statuses:** PROPOSED → PLANNED → IMPLEMENTED → VERIFIED

**Contains:** title, description, status, implementedBy, verifiedAt, notes

**Examples:**
- "Use parameterized queries" for SQL Injection threat — IMPLEMENTED, verified by code review
- "Implement MFA for admin" for elevation threat — PLANNED, scheduled for Q1

---

## **Environment**

**Industry terms:** Deployment environment, runtime environment, stage, target, infra

**In ThreatDiviner:** A tracked deployment target where software runs. Links deployments to security posture.

**Hierarchy:** Tenant → Project → **Environment** → Deployment

**Relations:**
- n:1 Project (many environments per project)
- n:1 Tenant (scoped to tenant)
- 1:n Deployment (many deployments per environment)

**Created automatically when:** (Future) CI/CD integration reports deployment

**Created manually when:** User clicks "Add Environment" in project settings

**Configured via:** Environment settings — name, type, cloud provider, health check URL

**Cannot be:** Shared cross-project, deleted if active deployments exist

**Types:** KUBERNETES | ECS | CLOUD_RUN | LAMBDA | VM | BARE_METAL

**Cloud providers:** AWS | AZURE | GCP | ON_PREM

**Health statuses:** HEALTHY | DEGRADED | UNHEALTHY | UNKNOWN

**Contains:** name, type, cloudProvider, region, healthStatus, deployments, vulnerability count

**Unit of reporting:** Environment health, deployment count, vulnerable deployments

**Examples:**
- "Production" — KUBERNETES on AWS, HEALTHY, 5 deployments, 2 with vulnerabilities
- "Staging" — ECS on AWS, DEGRADED, 3 deployments

---

## **Deployment**

**Industry terms:** Deployed service, running instance, workload, release, container

**In ThreatDiviner:** A specific version of software running in an environment. Links SBOM to runtime.

**Hierarchy:** Environment → **Deployment**

**Relations:**
- n:1 Environment (many deployments per env)
- 0:1 Repository (source repo, optional)
- 0:1 SBOM (active SBOM for this version)

**Created automatically when:** (Future) CI/CD webhook reports deployment

**Created manually when:** User adds deployment in environment settings

**Configured via:** Deployment settings — name, version, image URL, linked repo/SBOM

**Contains:** name, version, imageUrl, healthStatus, vulnerabilityCount, lastDeployedAt

**Unit of reporting:** Version tracking, vulnerability count, deployment frequency

**Examples:**
- payment-api v2.3.1 in Production — HEALTHY, 2 vulnerabilities, deployed 3 days ago
- auth-service v1.8.0 in Staging — HEALTHY, 0 vulnerabilities

---

## **PipelineGate**

**Industry terms:** Quality gate, security gate, CI/CD gate, policy check, PR check, merge blocker

**In ThreatDiviner:** Configurable checkpoint that passes/fails based on scan results. Blocks PRs or deployments.

**Hierarchy:** Tenant → Project → **PipelineGate**

**Relations:**
- n:1 Project (many gates per project)
- n:n Scan (evaluates scans against gate rules)

**Created automatically when:** Never — always manual

**Created manually when:** User adds gate in project settings

**Configured via:** Gate settings — stage, severity thresholds, scanner requirements, override permissions

**Cannot be:** Applied cross-project, overridden without ADMIN role (if strict mode)

**Stages:** BUILD | DEPLOY | RELEASE

**Contains:** name, stage, enabled, rules (max criticals, required scanners), override history

**Evaluation:** Scan completes → gate evaluates → PASS (findings within threshold) | FAIL (exceeds threshold)

**Unit of reporting:** Pass/fail rate, blocked PRs, override frequency

**Examples:**
- "Production Deploy Gate" — blocks if criticals > 0 or high > 5
- "PR Check" — blocks if any secrets detected, warns on high severity

---

## **CloudAccount**

**Industry terms:** Cloud account, AWS account, Azure subscription, GCP project, cloud credentials

**In ThreatDiviner:** Connected cloud account for CSPM scanning. Stores credentials for read-only security assessment.

**Hierarchy:** Tenant → **CloudAccount** → CspmFinding

**Relations:**
- n:1 Tenant (many accounts per tenant)
- 1:n CspmFinding (many findings per account)

**Created automatically when:** Never — requires manual credential input

**Created manually when:** User adds cloud account with credentials/role ARN

**Configured via:** Cloud account settings — credentials, regions to scan, scan schedule, frameworks

**Cannot be:** Shared cross-tenant, used without valid credentials

**Providers:** AWS | AZURE | GCP

**Auth methods:**
- AWS: IAM role ARN (cross-account assume), access keys
- Azure: Service principal (client ID + secret)
- GCP: Service account JSON key

**Statuses:** ACTIVE | INVALID_CREDENTIALS | SCANNING | PAUSED

**Contains:** provider, accountId, credentials (encrypted), regions, lastScannedAt, findingCounts

**Unit of reporting:** Account compliance score, findings by service, framework compliance %

**Examples:**
- AWS account 123456789012, IAM role, us-east-1 + us-west-2, 85% CIS compliance
- Azure subscription, service principal auth, 12 HIGH findings in storage config

---

## **CspmFinding**

**Industry terms:** Cloud misconfiguration, posture finding, cloud security issue, compliance violation

**In ThreatDiviner:** A security misconfiguration detected in cloud infrastructure by CSPM scan.

**Hierarchy:** Tenant → CloudAccount → **CspmFinding**

**Relations:**
- n:1 CloudAccount (many findings per account)
- n:1 Tenant (scoped to tenant)
- 0:n ComplianceControl (maps to framework controls)

**Created automatically when:** Prowler/cloud scanner detects misconfiguration

**Created manually when:** Never — scanner only

**Cannot be:** Manually created, edited (scanner data)

**Contains:** ruleId, title, severity, service (S3, IAM, RDS), resource ARN, region, remediationSteps, frameworks

**Statuses:** OPEN | RESOLVED (config fixed) | SUPPRESSED (accepted risk)

**Auto-resolve:** If misconfiguration fixed and next scan passes → auto-RESOLVED

**Unit of reporting:** Per-account posture, by service breakdown, compliance framework gaps

**Examples:**
- "S3 bucket is publicly accessible" — CRITICAL, arn:aws:s3:::public-bucket, maps to CIS 2.1.1
- "RDS instance not encrypted" — HIGH, arn:aws:rds:us-east-1:123:db:mydb, maps to SOC2 CC6.1

---

## **CVE**

**Industry terms:** CVE, Common Vulnerabilities and Exposures, vulnerability, security advisory

**In ThreatDiviner:** Synced vulnerability record from NVD. Enriched with EPSS and KEV status. Used for finding enrichment and SBOM matching.

**Hierarchy:** (Reference data) **CVE** ← Finding, SbomVulnerability

**Relations:**
- 1:n Finding (CVE linked to many findings)
- 1:n SbomVulnerability (CVE affects SBOM components)
- 0:1 EPSS (has EPSS score)
- 0:1 KEV (may be in KEV catalog)

**Created automatically when:** VulnDB sync runs (daily for recent, monthly full)

**Created manually when:** Never — synced from NVD only

**Source:** NVD (National Vulnerability Database) API

**Contains:** cveId, description, cvssScore, cvssVector, severity, publishedAt, modifiedAt, affectedProducts, references

**Enrichment:** EPSS score (exploitation probability), KEV status (known exploited), vendor advisories

**Sync schedule:** Daily (last 7 days), monthly (full refresh)

**Examples:**
- CVE-2024-1234, CVSS 9.8 CRITICAL, EPSS 0.95, in KEV catalog, affects lodash < 4.17.21
- CVE-2024-5678, CVSS 7.5 HIGH, EPSS 0.12, not in KEV, affects axios < 1.6.0

---

## **CWE**

**Industry terms:** CWE, Common Weakness Enumeration, weakness type, vulnerability category

**In ThreatDiviner:** Synced weakness taxonomy from MITRE. Used for finding categorization and compliance mapping.

**Hierarchy:** (Reference data) **CWE** ← Finding, Threat, ComplianceControl

**Relations:**
- 1:n Finding (CWE categorizes many findings)
- 1:n Threat (threats map to CWE)
- n:n ComplianceControl (CWE maps to controls)

**Created automatically when:** VulnDB sync runs (weekly)

**Created manually when:** Never — synced from MITRE only

**Source:** MITRE CWE database

**Contains:** cweId, name, description, extendedDescription, potentialMitigations, relatedWeaknesses

**Compliance mapping:** CWE-89 (SQL Injection) → PCI-DSS 6.5.1, SOC2 CC6.1, OWASP A03

**Examples:**
- CWE-89 "SQL Injection" — maps to 5 compliance controls
- CWE-79 "Cross-site Scripting" — maps to 4 compliance controls

---

## **ComplianceFramework**

**Industry terms:** Compliance standard, regulatory framework, security framework, audit requirement

**In ThreatDiviner:** A security compliance standard with controls. Used for compliance scoring and reporting.

**Hierarchy:** **ComplianceFramework** → ComplianceControl

**Relations:**
- 1:n ComplianceControl (framework has many controls)

**Created automatically when:** Platform initialized (built-in frameworks)

**Created manually when:** Admin adds custom framework

**Built-in frameworks:** SOC2 | PCI_DSS_4 | HIPAA | GDPR | ISO27001 | NIST_CSF | ESSENTIAL_EIGHT | OWASP_TOP_10

**Contains:** name, version, description, controlCount, category (regulatory/industry/internal)

**Unit of reporting:** Framework compliance %, control pass rate, gap analysis

**Examples:**
- SOC 2 Type II — 64 controls, 89% compliant based on findings
- PCI DSS 4.0 — 78 controls, 12 controls failing due to open findings

---

## **ComplianceControl**

**Industry terms:** Control, requirement, safeguard, security control, audit control

**In ThreatDiviner:** A specific requirement within a compliance framework. Mapped to CWEs — findings with mapped CWEs indicate control violations.

**Hierarchy:** ComplianceFramework → **ComplianceControl** ← CWE ← Finding

**Relations:**
- n:1 ComplianceFramework (many controls per framework)
- n:n CWE (control maps to weakness types)

**Created automatically when:** Framework synced/initialized

**Created manually when:** Admin adds custom control

**Contains:** controlId, name, description, frameworkId, mappedCwes

**Status derivation:** If any OPEN finding has CWE mapped to this control → control FAILING, else PASSING

**Examples:**
- PCI-DSS 6.5.1 "Injection flaws" — maps to CWE-89, CWE-78, CWE-77
- SOC2 CC6.1 "Security vulnerabilities" — maps to 15 CWEs

---

## **ApiKey**

**Industry terms:** API key, access token, service account, CI/CD token, machine credential

**In ThreatDiviner:** Issued credential for API access. Used by CI/CD pipelines and automation. Scoped permissions.

**Hierarchy:** Tenant → **ApiKey**

**Relations:**
- n:1 Tenant (many keys per tenant)
- n:1 User (created by user, optional ownership)

**Created automatically when:** Never — always manual

**Created manually when:** User clicks "Create API Key" in settings, API request

**Configured via:** API key settings — name, permissions, expiry date

**Cannot be:** Viewed after creation (shown once), transferred between tenants

**Permissions:** Scoped to specific actions (read:scans, write:scans, read:findings, admin:*)

**Statuses:** ACTIVE | EXPIRED | REVOKED

**Contains:** key (hashed after creation), name, permissions[], expiresAt, lastUsedAt, createdBy

**Unit of reporting:** Key usage, last used, permission audit

**Examples:**
- "CI/CD Pipeline Key" — read:scans, write:scans, expires in 90 days, last used today
- "Reporting Service" — read:findings, read:compliance, no expiry, used for weekly reports

---

## **AuditLog**

**Industry terms:** Audit log, activity log, event log, change history, audit trail

**In ThreatDiviner:** Immutable record of user and system actions. Used for security audit and compliance.

**Hierarchy:** Tenant → **AuditLog**

**Relations:**
- n:1 Tenant (many logs per tenant)
- n:1 User (action by user, optional for system actions)

**Created automatically when:** Any create/update/delete action, auth events, API calls, setting changes

**Created manually when:** Never — system generated only

**Cannot be:** Edited, deleted (immutable), disabled (always on)

**Contains:** timestamp, action, resource, resourceId, userId, tenantId, ipAddress, userAgent, details, outcome

**Retention:** Configurable per tenant (default 90 days, enterprise 2+ years)

**Unit of reporting:** Activity timeline, user action audit, compliance evidence

**Examples:**
- 2024-12-30 10:15:32 — user@acme.com CREATE project "Payment Gateway" from 203.0.113.50
- 2024-12-30 10:20:45 — system SCAN_COMPLETED scan#142 with 12 findings

---

## **AlertRule**

**Industry terms:** Alert rule, notification rule, trigger, monitor, threshold

**In ThreatDiviner:** Configurable rule that triggers notifications based on security events.

**Hierarchy:** Tenant → **AlertRule** → Notification

**Relations:**
- n:1 Tenant (many rules per tenant)
- 1:n AlertHistory (triggered alerts)

**Created automatically when:** Default rules on tenant creation (critical findings, scan failures)

**Created manually when:** User creates rule in notification settings

**Configured via:** Alert settings — conditions, thresholds, channels, schedule

**Cannot be:** Applied cross-tenant

**Conditions:** finding.severity = CRITICAL | scan.status = FAILED | sla.status = BREACHED | cspm.severity = HIGH

**Channels:** Slack | Email | Teams | PagerDuty | OpsGenie | Webhook

**Contains:** name, conditions, threshold, channels[], enabled, cooldownMinutes

**Examples:**
- "Critical Finding Alert" — notify Slack #security when any CRITICAL finding detected, cooldown 5 min
- "SLA Breach Alert" — email security-team@ when any SLA breached, daily digest

---

## **Notification Channels**

**Industry terms:** Integration, webhook, notification channel, alerting destination

**In ThreatDiviner:** Configured destinations for alerts and notifications. Supports multiple providers.

**Types:**
- **Slack:** Webhook URL, channel selection, message formatting
- **Email:** SMTP config or SendGrid, recipient lists, templates
- **Microsoft Teams:** Incoming webhook URL, adaptive cards
- **Jira:** API token, project, issue type, field mapping
- **PagerDuty:** Routing key, severity mapping
- **OpsGenie:** API key, priority mapping
- **Webhook:** Custom URL, headers, payload template

**Created manually when:** User configures in settings

**Tested via:** "Send Test" button, validates connectivity

**Examples:**
- Slack #security-alerts for critical findings
- Jira SECOPS project for finding ticket creation
- PagerDuty for after-hours critical alerts

---

## **SLA Policy**

**Industry terms:** SLA, remediation SLA, fix timeline, response time, service level

**In ThreatDiviner:** Severity-based policies defining maximum time to remediate findings. Tracks compliance.

**Default policies:**
- CRITICAL: 7 days
- HIGH: 30 days
- MEDIUM: 90 days
- LOW: 180 days
- KEV (Known Exploited): 14 days (overrides severity)

**Statuses:** ON_TRACK | AT_RISK (within 20% of deadline) | BREACHED (past deadline)

**Configured via:** Tenant settings — custom timelines per severity, business hours, excluded days

**Unit of reporting:** SLA compliance %, MTTR, breached count, at-risk count

**Examples:**
- Finding with CRITICAL severity, firstSeenAt 2024-12-28, SLA deadline 2025-01-04, status ON_TRACK (6 days left)
- KEV finding overrides HIGH severity SLA: 14 days instead of 30

---

*End of ThreatDiviner Entity Definitions*
