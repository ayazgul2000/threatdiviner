# ThreatDiviner System Glossary

This document provides a comprehensive glossary of all entities, concepts, and terminology used within the ThreatDiviner platform.

---

## Table of Contents

1. [Hierarchy Overview](#hierarchy-overview)
2. [Core Entities](#core-entities)
3. [Scanner Types](#scanner-types)
4. [Intelligence Entities](#intelligence-entities)
5. [Compliance Entities](#compliance-entities)
6. [SLA Entities](#sla-entities)
7. [Workflow Statuses](#workflow-statuses)
8. [SDLC Phase Mapping](#sdlc-phase-mapping)
9. [Reporting Units](#reporting-units)

---

## Hierarchy Overview

The following diagram illustrates the hierarchical relationships between core entities in ThreatDiviner:

```
Tenant (Organization)
├── Project (Application/Product)
│   ├── Repository (Codebase)
│   │   ├── Connection (SCM Connection)
│   │   ├── Scan (Security Scan Run)
│   │   │   ├── Finding (Vulnerability/Issue)
│   │   │   │   ├── CVE (Reference)
│   │   │   │   ├── CWE (Reference)
│   │   │   │   └── MITRE ATT&CK (Reference)
│   │   │   └── ScanConfig (Scanner Settings)
│   │   ├── SBOM (Software Bill of Materials)
│   │   │   └── Component (Dependency)
│   │   │       └── License
│   │   └── ThreatModel
│   │       ├── Asset
│   │       ├── Threat
│   │       └── Control
│   ├── Environment
│   │   └── Deployment
│   │       └── PipelineGate
│   └── ComplianceFramework
│       └── ComplianceControl
└── SLAPolicy
    └── SLARule
```

### Alternative View: Data Flow Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TENANT (Org)                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           PROJECT                                     │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │  │
│  │  │   REPOSITORY    │  │   REPOSITORY    │  │   REPOSITORY    │       │  │
│  │  │  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐  │       │  │
│  │  │  │   SCAN    │  │  │  │   SCAN    │  │  │  │   SCAN    │  │       │  │
│  │  │  │ ┌───────┐ │  │  │  │ ┌───────┐ │  │  │  │ ┌───────┐ │  │       │  │
│  │  │  │ │FINDING│ │  │  │  │ │FINDING│ │  │  │  │ │FINDING│ │  │       │  │
│  │  │  │ └───────┘ │  │  │  │ └───────┘ │  │  │  │ └───────┘ │  │       │  │
│  │  │  └───────────┘  │  │  └───────────┘  │  │  └───────────┘  │       │  │
│  │  │  ┌───────────┐  │  │  ┌───────────┐  │  │                 │       │  │
│  │  │  │   SBOM    │  │  │  │THREATMODEL│  │  │                 │       │  │
│  │  │  └───────────┘  │  │  └───────────┘  │  │                 │       │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │                        ENVIRONMENT                              │ │  │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                │ │  │
│  │  │  │ DEPLOYMENT │  │ DEPLOYMENT │  │ DEPLOYMENT │                │ │  │
│  │  │  │┌──────────┐│  │┌──────────┐│  │┌──────────┐│                │ │  │
│  │  │  ││PIPE GATE ││  ││PIPE GATE ││  ││PIPE GATE ││                │ │  │
│  │  │  │└──────────┘│  │└──────────┘│  │└──────────┘│                │ │  │
│  │  │  └────────────┘  └────────────┘  └────────────┘                │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Entities

### Tenant (Organization)

| Attribute | Value |
|-----------|-------|
| **Common Name** | Tenant, Organization, Account |
| **Industry Definition** | A logical isolation boundary representing a customer organization in a multi-tenant SaaS application |
| **In ThreatDiviner** | The top-level entity representing a customer organization. All resources, users, and configurations are scoped to a tenant. Provides complete data isolation between customers. |
| **Parent Entity** | None (Root entity) |
| **Child Entities** | Project, User, Team, SLAPolicy, Connection |
| **Unit of Reporting** | Per-tenant dashboards, billing, usage metrics |
| **Created** | Manual (during onboarding) |
| **Key Fields** | `id`, `name`, `slug`, `plan`, `settings`, `createdAt`, `updatedAt` |
| **Connects To** | Identity Provider (SSO), Billing System |
| **SDLC Phase** | All phases |
| **Example** | "Acme Corporation" tenant with 50 users, 15 projects, Enterprise plan |

---

### Project (Application/Product)

| Attribute | Value |
|-----------|-------|
| **Common Name** | Project, Application, Product, Workload |
| **Industry Definition** | A logical grouping of related software components that together deliver a business capability |
| **In ThreatDiviner** | A container for one or more repositories that comprise a single application or product. Projects aggregate security findings, SBOMs, and threat models for unified reporting and risk assessment. |
| **Parent Entity** | Tenant |
| **Child Entities** | Repository, Environment, ComplianceMapping, ThreatModel |
| **Unit of Reporting** | Project security posture, risk score, finding trends |
| **Created** | Manual or Auto (via SCM sync) |
| **Key Fields** | `id`, `tenantId`, `name`, `description`, `riskScore`, `criticality`, `tags`, `createdAt` |
| **Connects To** | Repository, Environment, ComplianceFramework, Team |
| **SDLC Phase** | Design, Development, Testing, Deployment, Operations |
| **Example** | "Payment Gateway" project containing 3 repositories (api, frontend, infrastructure) |

---

### Repository (Codebase)

| Attribute | Value |
|-----------|-------|
| **Common Name** | Repository, Repo, Codebase, Source Code Repository |
| **Industry Definition** | A storage location for source code managed by a version control system (Git) |
| **In ThreatDiviner** | A Git repository connected via an SCM connection. The primary target for security scans. Contains the source code, IaC files, container definitions, and configuration that are analyzed for vulnerabilities. |
| **Parent Entity** | Project |
| **Child Entities** | Scan, SBOM, Branch |
| **Unit of Reporting** | Repository health score, finding density, scan coverage |
| **Created** | Auto (via SCM sync) or Manual |
| **Key Fields** | `id`, `projectId`, `connectionId`, `name`, `url`, `defaultBranch`, `language`, `lastScanAt` |
| **Connects To** | Connection, Scan, SBOM, CI/CD Pipeline |
| **SDLC Phase** | Development, Build |
| **Example** | "acme/payment-api" repository on GitHub, primary language: TypeScript |

---

### Connection (SCM Connection)

| Attribute | Value |
|-----------|-------|
| **Common Name** | Connection, Integration, SCM Link, VCS Connection |
| **Industry Definition** | An authenticated link to a source code management platform |
| **In ThreatDiviner** | A configured connection to an SCM provider (GitHub, GitLab, Bitbucket, Azure DevOps) that enables repository discovery, code access, and webhook integration. Stores encrypted credentials and manages OAuth tokens. |
| **Parent Entity** | Tenant |
| **Child Entities** | Repository (via discovery) |
| **Unit of Reporting** | Connection health, sync status, repository count |
| **Created** | Manual (via OAuth flow or token configuration) |
| **Key Fields** | `id`, `tenantId`, `provider`, `name`, `credentials`, `scopes`, `status`, `lastSyncAt` |
| **Connects To** | Repository, Webhook, CI/CD System |
| **SDLC Phase** | Development |
| **Example** | GitHub App installation for "acme-org" with read access to 25 repositories |

---

### Scan (Security Scan Run)

| Attribute | Value |
|-----------|-------|
| **Common Name** | Scan, Security Scan, Analysis Run, Scan Job |
| **Industry Definition** | An execution of one or more security analysis tools against a target codebase |
| **In ThreatDiviner** | A scheduled or triggered execution of security scanners against a repository or container image. Produces findings, generates reports, and updates security metrics. Scans can be full or incremental. |
| **Parent Entity** | Repository |
| **Child Entities** | Finding, ScanResult |
| **Unit of Reporting** | Scan duration, finding count by severity, pass/fail status |
| **Created** | Auto (scheduled, webhook, pipeline) or Manual |
| **Key Fields** | `id`, `repositoryId`, `configId`, `type`, `status`, `branch`, `commit`, `startedAt`, `completedAt`, `findingCount` |
| **Connects To** | ScanConfig, Finding, Pipeline, Notification |
| **SDLC Phase** | Build, Test |
| **Example** | SAST scan of "main" branch triggered by PR, completed in 45 seconds, found 3 high-severity issues |

---

### Finding (Vulnerability/Issue)

| Attribute | Value |
|-----------|-------|
| **Common Name** | Finding, Vulnerability, Issue, Alert, Weakness |
| **Industry Definition** | A security issue identified during analysis that may pose risk to the application |
| **In ThreatDiviner** | A security vulnerability, weakness, or policy violation discovered during a scan. Findings are deduplicated, enriched with threat intelligence (CVE, CWE, EPSS), and tracked through a remediation workflow. |
| **Parent Entity** | Scan |
| **Child Entities** | None |
| **Unit of Reporting** | MTTR, finding age, severity distribution, remediation rate |
| **Created** | Auto (via scan) |
| **Key Fields** | `id`, `scanId`, `type`, `severity`, `title`, `description`, `filePath`, `lineNumber`, `cveId`, `cweId`, `status`, `assignee` |
| **Connects To** | CVE, CWE, MITRE ATT&CK, Ticket System, PR |
| **SDLC Phase** | Build, Test, Deploy |
| **Example** | SQL Injection in `/api/users.ts:45`, Severity: Critical, CWE-89, Status: Open |

---

### ScanConfig (Scanner Settings)

| Attribute | Value |
|-----------|-------|
| **Common Name** | Scan Configuration, Scanner Profile, Scan Policy |
| **Industry Definition** | A predefined set of rules and parameters that control scanner behavior |
| **In ThreatDiviner** | A reusable configuration template that defines which scanners to run, their rule sets, severity thresholds, exclusion patterns, and timeout settings. Can be applied to repositories or projects. |
| **Parent Entity** | Tenant or Project |
| **Child Entities** | None |
| **Unit of Reporting** | Repositories using config, override count |
| **Created** | Manual |
| **Key Fields** | `id`, `tenantId`, `name`, `scanners`, `rules`, `exclusions`, `timeout`, `isDefault` |
| **Connects To** | Scan, Repository, Scanner |
| **SDLC Phase** | Configuration |
| **Example** | "Strict SAST Config" enabling all Semgrep security rules with 10-minute timeout |

---

### SBOM (Software Bill of Materials)

| Attribute | Value |
|-----------|-------|
| **Common Name** | SBOM, Software Bill of Materials, Dependency Manifest |
| **Industry Definition** | A comprehensive inventory of all software components, libraries, and dependencies in an application (per NTIA/CISA guidelines) |
| **In ThreatDiviner** | A structured inventory of all first-party and third-party components in a repository, including versions, licenses, and vulnerability status. Supports CycloneDX and SPDX formats. Used for SCA, license compliance, and supply chain risk analysis. |
| **Parent Entity** | Repository |
| **Child Entities** | Component, License |
| **Unit of Reporting** | Dependency count, vulnerable dependency ratio, license risk |
| **Created** | Auto (via scan) |
| **Key Fields** | `id`, `repositoryId`, `format`, `version`, `components`, `generatedAt`, `toolVersion` |
| **Connects To** | Component, CVE, License, VEX |
| **SDLC Phase** | Build, Release |
| **Example** | CycloneDX 1.5 SBOM with 245 components, 12 with known CVEs, generated from package-lock.json |

---

### ThreatModel

| Attribute | Value |
|-----------|-------|
| **Common Name** | Threat Model, Threat Assessment, Security Design Review |
| **Industry Definition** | A structured analysis of potential threats to a system, using methodologies like STRIDE, PASTA, or LINDDUN |
| **In ThreatDiviner** | An automated or manual security analysis document that identifies assets, trust boundaries, data flows, threats, and mitigating controls. Integrated with MITRE ATT&CK for threat mapping and linked to findings for validation. |
| **Parent Entity** | Project or Repository |
| **Child Entities** | Asset, Threat, Control, DataFlow |
| **Unit of Reporting** | Threat coverage, control effectiveness, unmitigated risks |
| **Created** | Auto (via AI analysis) or Manual |
| **Key Fields** | `id`, `projectId`, `name`, `methodology`, `assets`, `threats`, `controls`, `status`, `reviewedAt` |
| **Connects To** | Finding, MITRE ATT&CK, ComplianceControl |
| **SDLC Phase** | Design, Architecture |
| **Example** | STRIDE threat model for Payment API identifying 15 threats with 12 mitigating controls |

---

### Environment

| Attribute | Value |
|-----------|-------|
| **Common Name** | Environment, Stage, Tier |
| **Industry Definition** | A distinct deployment target representing a phase in the software delivery lifecycle |
| **In ThreatDiviner** | A logical representation of a deployment stage (development, staging, production) where applications are deployed. Environments have different security policies, SLA requirements, and access controls. |
| **Parent Entity** | Project |
| **Child Entities** | Deployment |
| **Unit of Reporting** | Environment security posture, deployment frequency, finding exposure |
| **Created** | Manual |
| **Key Fields** | `id`, `projectId`, `name`, `type`, `criticality`, `slaPolicy`, `approvers` |
| **Connects To** | Deployment, SLAPolicy, PipelineGate |
| **SDLC Phase** | Deploy, Operate |
| **Example** | "Production" environment with Critical criticality and 24-hour SLA for critical findings |

---

### Deployment

| Attribute | Value |
|-----------|-------|
| **Common Name** | Deployment, Release, Deploy Event |
| **Industry Definition** | An instance of software being pushed to an environment |
| **In ThreatDiviner** | A record of a specific version of code being deployed to an environment. Tracks the security state at deployment time, including any bypassed gates or accepted risks. |
| **Parent Entity** | Environment |
| **Child Entities** | PipelineGate (results) |
| **Unit of Reporting** | Deployment frequency, security gate pass rate, risk acceptance rate |
| **Created** | Auto (via CI/CD integration) |
| **Key Fields** | `id`, `environmentId`, `repositoryId`, `version`, `commit`, `deployedAt`, `deployedBy`, `gateResults` |
| **Connects To** | PipelineGate, Finding, Notification |
| **SDLC Phase** | Deploy |
| **Example** | Deployment of v2.3.1 to production at 2024-01-15 14:30 UTC, all gates passed |

---

### PipelineGate

| Attribute | Value |
|-----------|-------|
| **Common Name** | Pipeline Gate, Security Gate, Quality Gate, Policy Check |
| **Industry Definition** | An automated checkpoint in a CI/CD pipeline that enforces security or quality criteria |
| **In ThreatDiviner** | A configurable policy checkpoint that evaluates security criteria before allowing deployment. Gates can block, warn, or require approval based on finding severity, count, age, or compliance status. |
| **Parent Entity** | Environment |
| **Child Entities** | GateResult |
| **Unit of Reporting** | Gate pass/fail rate, override frequency, block reasons |
| **Created** | Manual |
| **Key Fields** | `id`, `environmentId`, `name`, `type`, `criteria`, `action`, `approvers`, `bypassable` |
| **Connects To** | Deployment, Finding, Notification, Approval Workflow |
| **SDLC Phase** | Deploy |
| **Example** | "Critical Vulnerability Block" gate preventing deployment if any critical findings exist |

---

## Scanner Types

### SAST (Static Application Security Testing)

| Attribute | Value |
|-----------|-------|
| **Definition** | Analysis of source code without execution to identify security vulnerabilities |
| **In ThreatDiviner** | Automated code review using pattern matching and dataflow analysis |
| **Supported Tools** | Semgrep, Bandit (Python), Gosec (Go) |
| **Target** | Source code files |
| **Finding Types** | Injection flaws, XSS, insecure crypto, hardcoded secrets, unsafe deserialization |
| **SDLC Phase** | Development, Build |
| **Languages** | JavaScript, TypeScript, Python, Go, Java, C#, Ruby, PHP, and more |

#### Tool Details

| Tool | Language Focus | Rule Source | Performance |
|------|---------------|-------------|-------------|
| **Semgrep** | Multi-language | Semgrep Registry, Custom | Fast, low false positives |
| **Bandit** | Python | Built-in rules | Fast, Python-specific |
| **Gosec** | Go | Built-in rules | Fast, Go-specific |

---

### SCA (Software Composition Analysis)

| Attribute | Value |
|-----------|-------|
| **Definition** | Analysis of third-party components and dependencies for known vulnerabilities |
| **In ThreatDiviner** | Dependency scanning with CVE correlation and license compliance |
| **Supported Tools** | Trivy |
| **Target** | Package manifests (package.json, requirements.txt, go.mod, etc.) |
| **Finding Types** | Known CVEs in dependencies, outdated packages, license violations |
| **SDLC Phase** | Build |
| **Data Sources** | NVD, GitHub Advisory Database, OSV |

#### Trivy SCA Capabilities

| Feature | Description |
|---------|-------------|
| **Vulnerability Detection** | CVE matching against multiple databases |
| **SBOM Generation** | CycloneDX and SPDX format output |
| **License Detection** | Identify and classify dependency licenses |
| **Fixability Info** | Indicates if vulnerable versions have patches |

---

### Secrets Detection

| Attribute | Value |
|-----------|-------|
| **Definition** | Detection of hardcoded credentials, API keys, and sensitive data in source code |
| **In ThreatDiviner** | Pattern-based and entropy-based secret detection with verification |
| **Supported Tools** | Gitleaks, TruffleHog |
| **Target** | All text files, git history |
| **Finding Types** | API keys, passwords, tokens, private keys, connection strings |
| **SDLC Phase** | Development, Build |
| **Verification** | Optional live verification of detected secrets |

#### Tool Comparison

| Tool | Approach | Git History | Verification | Custom Rules |
|------|----------|-------------|--------------|--------------|
| **Gitleaks** | Regex patterns | Yes | No | Yes (TOML) |
| **TruffleHog** | Regex + Entropy | Yes | Yes | Yes |

---

### IaC (Infrastructure as Code) Scanning

| Attribute | Value |
|-----------|-------|
| **Definition** | Security analysis of infrastructure definitions and configuration files |
| **In ThreatDiviner** | Policy-as-code evaluation of cloud infrastructure templates |
| **Supported Tools** | Checkov |
| **Target** | Terraform, CloudFormation, Kubernetes, Dockerfile, Helm |
| **Finding Types** | Misconfigurations, compliance violations, insecure defaults |
| **SDLC Phase** | Development, Build |
| **Frameworks** | CIS Benchmarks, SOC2, PCI-DSS, HIPAA, NIST |

#### Checkov Coverage

| IaC Type | File Patterns | Example Checks |
|----------|--------------|----------------|
| **Terraform** | `*.tf`, `*.tfvars` | S3 bucket encryption, security group rules |
| **CloudFormation** | `*.yaml`, `*.json` | IAM policies, resource encryption |
| **Kubernetes** | `*.yaml` | Pod security, network policies |
| **Dockerfile** | `Dockerfile*` | Base image pinning, user privileges |
| **Helm** | `Chart.yaml`, templates | Security contexts, resource limits |

---

### DAST (Dynamic Application Security Testing)

| Attribute | Value |
|-----------|-------|
| **Definition** | Security testing of running applications by simulating attacks |
| **In ThreatDiviner** | Automated web application penetration testing |
| **Supported Tools** | Nuclei, ZAP (OWASP Zed Attack Proxy) |
| **Target** | Running web applications, APIs |
| **Finding Types** | XSS, SQL injection, CSRF, authentication flaws, misconfigurations |
| **SDLC Phase** | Test, Stage |
| **Prerequisites** | Deployed application endpoint |

#### Tool Comparison

| Tool | Approach | API Support | Custom Templates | Speed |
|------|----------|-------------|------------------|-------|
| **Nuclei** | Template-based | Yes | Yes (YAML) | Very Fast |
| **ZAP** | Active/Passive scan | Yes | Yes (Scripts) | Comprehensive |

---

### Container Scanning

| Attribute | Value |
|-----------|-------|
| **Definition** | Security analysis of container images for vulnerabilities and misconfigurations |
| **In ThreatDiviner** | Image layer analysis and runtime configuration checks |
| **Supported Tools** | Trivy |
| **Target** | Docker images, OCI images |
| **Finding Types** | OS package CVEs, application CVEs, misconfigurations, secrets |
| **SDLC Phase** | Build, Deploy |
| **Registries** | Docker Hub, ECR, GCR, ACR, Harbor |

#### Trivy Container Features

| Feature | Description |
|---------|-------------|
| **OS Packages** | Scan Alpine, Debian, Ubuntu, RHEL, etc. |
| **Language Packages** | Detect app dependencies in image |
| **Misconfigurations** | Dockerfile best practices |
| **Secrets** | Detect secrets in image layers |
| **SBOM** | Generate image SBOM |

---

### CSPM (Cloud Security Posture Management)

| Attribute | Value |
|-----------|-------|
| **Definition** | Continuous monitoring and assessment of cloud infrastructure security |
| **In ThreatDiviner** | Multi-cloud security configuration assessment |
| **Supported Tools** | Prowler |
| **Target** | AWS, Azure, GCP, Kubernetes accounts/clusters |
| **Finding Types** | Misconfigurations, compliance violations, excessive permissions |
| **SDLC Phase** | Operate |
| **Frameworks** | CIS Benchmarks, PCI-DSS, HIPAA, GDPR, SOC2 |

#### Prowler Coverage

| Cloud | Services | Check Count |
|-------|----------|-------------|
| **AWS** | 60+ services | 300+ checks |
| **Azure** | 30+ services | 150+ checks |
| **GCP** | 25+ services | 100+ checks |
| **Kubernetes** | Core resources | 50+ checks |

---

## Intelligence Entities

### CVE (Common Vulnerabilities and Exposures)

| Attribute | Value |
|-----------|-------|
| **Common Name** | CVE, Vulnerability ID |
| **Industry Definition** | A standardized identifier for publicly known security vulnerabilities, maintained by MITRE/CVE.org |
| **In ThreatDiviner** | A reference entity linking findings to known vulnerabilities. Enriched with CVSS scores, affected versions, and remediation guidance. |
| **Format** | CVE-YYYY-NNNNN (e.g., CVE-2024-12345) |
| **Data Sources** | NVD (NIST), CVE.org, GitHub Advisory Database |
| **Key Fields** | `cveId`, `description`, `cvssScore`, `cvssVector`, `affectedVersions`, `fixedVersions`, `references` |
| **Connects To** | Finding, SBOM Component, CWE |
| **Update Frequency** | Real-time sync from NVD |
| **Example** | CVE-2021-44228 (Log4Shell) - CVSS 10.0, Remote Code Execution in Apache Log4j |

---

### CWE (Common Weakness Enumeration)

| Attribute | Value |
|-----------|-------|
| **Common Name** | CWE, Weakness Type |
| **Industry Definition** | A categorized list of software and hardware weakness types, maintained by MITRE |
| **In ThreatDiviner** | A classification entity that categorizes findings by weakness type. Used for trend analysis, training prioritization, and compliance mapping. |
| **Format** | CWE-NNN (e.g., CWE-79) |
| **Data Sources** | MITRE CWE Database |
| **Key Fields** | `cweId`, `name`, `description`, `likelihood`, `impact`, `mitigations`, `relatedCwes` |
| **Connects To** | Finding, CVE, ComplianceControl |
| **Categories** | Injection, Authentication, Cryptographic, etc. |
| **Example** | CWE-89 (SQL Injection) - Improper Neutralization of Special Elements in SQL Commands |

#### Common CWE Categories

| CWE ID | Name | Description |
|--------|------|-------------|
| CWE-79 | XSS | Cross-site Scripting |
| CWE-89 | SQLi | SQL Injection |
| CWE-94 | Code Injection | Improper Control of Code Generation |
| CWE-200 | Information Exposure | Exposure of Sensitive Information |
| CWE-287 | Authentication Issues | Improper Authentication |
| CWE-306 | Missing Auth | Missing Authentication for Critical Function |
| CWE-502 | Deserialization | Deserialization of Untrusted Data |
| CWE-798 | Hardcoded Credentials | Use of Hard-coded Credentials |

---

### MITRE ATT&CK

| Attribute | Value |
|-----------|-------|
| **Common Name** | MITRE ATT&CK, ATT&CK Framework |
| **Industry Definition** | A knowledge base of adversary tactics, techniques, and procedures (TTPs) based on real-world observations |
| **In ThreatDiviner** | A threat intelligence framework used to map findings and threats to known attack patterns. Enables attack path analysis and threat-informed defense prioritization. |
| **Format** | Tactic: TA#### / Technique: T#### / Sub-technique: T####.### |
| **Data Sources** | MITRE ATT&CK Database (Enterprise, Mobile, ICS) |
| **Key Fields** | `techniqueId`, `name`, `tactic`, `description`, `platforms`, `dataSources`, `mitigations` |
| **Connects To** | Finding, ThreatModel, Detection Rule |
| **Matrices** | Enterprise, Mobile, ICS, Cloud |
| **Example** | T1190 (Exploit Public-Facing Application) - Initial Access tactic |

#### ATT&CK Tactics (Enterprise)

| Tactic ID | Name | Description |
|-----------|------|-------------|
| TA0001 | Initial Access | Gaining entry to the network |
| TA0002 | Execution | Running malicious code |
| TA0003 | Persistence | Maintaining access |
| TA0004 | Privilege Escalation | Gaining higher permissions |
| TA0005 | Defense Evasion | Avoiding detection |
| TA0006 | Credential Access | Stealing credentials |
| TA0007 | Discovery | Learning the environment |
| TA0008 | Lateral Movement | Moving through network |
| TA0009 | Collection | Gathering target data |
| TA0010 | Exfiltration | Stealing data |
| TA0011 | Command and Control | Communicating with compromised systems |
| TA0040 | Impact | Disruption and destruction |

---

### EPSS (Exploit Prediction Scoring System)

| Attribute | Value |
|-----------|-------|
| **Common Name** | EPSS, Exploit Probability Score |
| **Industry Definition** | A data-driven model that estimates the probability of a vulnerability being exploited in the wild within 30 days |
| **In ThreatDiviner** | A risk prioritization metric that supplements CVSS scores with real-world exploit likelihood. Used to focus remediation on vulnerabilities most likely to be weaponized. |
| **Format** | Decimal score 0.0 - 1.0 (0% - 100% probability) |
| **Data Sources** | FIRST.org EPSS Model |
| **Key Fields** | `cveId`, `epssScore`, `percentile`, `modelVersion`, `date` |
| **Connects To** | CVE, Finding |
| **Update Frequency** | Daily |
| **Example** | CVE-2021-44228 (Log4Shell): EPSS 0.975 (97.5% probability of exploitation) |

#### EPSS Score Interpretation

| Score Range | Percentile | Priority | Description |
|-------------|-----------|----------|-------------|
| 0.9 - 1.0 | 99th+ | Critical | Active exploitation highly likely |
| 0.5 - 0.9 | 90th-99th | High | Significant exploitation probability |
| 0.1 - 0.5 | 50th-90th | Medium | Moderate exploitation probability |
| 0.01 - 0.1 | 10th-50th | Low | Lower exploitation probability |
| 0.0 - 0.01 | <10th | Informational | Exploitation unlikely |

---

### KEV (Known Exploited Vulnerabilities)

| Attribute | Value |
|-----------|-------|
| **Common Name** | KEV, CISA KEV, Known Exploited Vulnerabilities Catalog |
| **Industry Definition** | CISA's authoritative catalog of vulnerabilities confirmed to be actively exploited in the wild |
| **In ThreatDiviner** | A critical threat intelligence feed that automatically elevates finding priority. KEV status triggers accelerated SLA timelines and mandatory remediation workflows. |
| **Format** | CVE IDs with exploitation metadata |
| **Data Sources** | CISA Known Exploited Vulnerabilities Catalog |
| **Key Fields** | `cveId`, `vendorProject`, `product`, `dateAdded`, `dueDate`, `shortDescription`, `requiredAction` |
| **Connects To** | CVE, Finding, SLAPolicy |
| **Update Frequency** | Real-time (CISA updates) |
| **Example** | CVE-2021-44228 added 2021-12-10, required action: "Apply updates per vendor instructions" |

#### KEV Implications in ThreatDiviner

| Trigger | Action |
|---------|--------|
| Finding matches KEV | Auto-escalate severity |
| KEV in production | Immediate notification to security team |
| KEV SLA | 24-48 hour remediation window (configurable) |
| KEV gate | Block deployment to production |

---

## Compliance Entities

### ComplianceFramework

| Attribute | Value |
|-----------|-------|
| **Common Name** | Compliance Framework, Regulatory Standard, Security Framework |
| **Industry Definition** | A structured set of guidelines, controls, and requirements for security and privacy |
| **In ThreatDiviner** | A configurable compliance standard that maps to findings, scan configurations, and reporting. Enables continuous compliance monitoring and audit evidence generation. |
| **Parent Entity** | Tenant |
| **Child Entities** | ComplianceControl |
| **Key Fields** | `id`, `name`, `version`, `description`, `controls`, `mappings` |
| **Connects To** | ComplianceControl, Finding, ScanConfig, Report |

#### Supported Frameworks

| Framework | Version | Description | Control Count |
|-----------|---------|-------------|---------------|
| **SOC 2** | 2017 | Service Organization Control Type 2 | 64 Trust Services Criteria |
| **PCI DSS** | 4.0 | Payment Card Industry Data Security Standard | 12 Requirements, 300+ sub-requirements |
| **HIPAA** | 2013 | Health Insurance Portability and Accountability Act | 54 Security Rule Standards |
| **NIST CSF** | 2.0 | Cybersecurity Framework | 6 Functions, 22 Categories |
| **NIST 800-53** | Rev 5 | Security and Privacy Controls | 1000+ Controls |
| **ISO 27001** | 2022 | Information Security Management | 93 Controls |
| **CIS Controls** | v8 | Center for Internet Security Controls | 18 Controls, 153 Safeguards |
| **GDPR** | 2016 | General Data Protection Regulation | 99 Articles |
| **FedRAMP** | Rev 5 | Federal Risk and Authorization | 3 Baselines (Low/Mod/High) |
| **OWASP ASVS** | 4.0 | Application Security Verification Standard | 3 Levels, 286 Requirements |

---

### ComplianceControl

| Attribute | Value |
|-----------|-------|
| **Common Name** | Control, Requirement, Safeguard |
| **Industry Definition** | A specific security measure or practice required by a compliance framework |
| **In ThreatDiviner** | An individual control requirement mapped to specific finding types, scanner rules, and evidence sources. Tracks control status (Pass/Fail/N/A) and generates audit evidence. |
| **Parent Entity** | ComplianceFramework |
| **Child Entities** | None |
| **Key Fields** | `id`, `frameworkId`, `controlId`, `name`, `description`, `category`, `mappedRules`, `status`, `evidence` |
| **Connects To** | Finding, ScanConfig Rule, Evidence |

#### Control Status Values

| Status | Description |
|--------|-------------|
| `passed` | All mapped checks passing |
| `failed` | One or more mapped checks failing |
| `partial` | Some checks passing, some pending |
| `not_applicable` | Control not relevant to scope |
| `not_assessed` | Control not yet evaluated |

#### Example Control Mapping

| Framework | Control ID | Description | Mapped Scanner Rules |
|-----------|-----------|-------------|---------------------|
| PCI DSS 4.0 | 6.2.4 | Protect against injection attacks | Semgrep: sql-injection, xss-* |
| SOC 2 | CC6.1 | Logical access security | Checkov: IAM policies |
| NIST 800-53 | AC-6 | Least privilege | Prowler: excessive-permissions |
| OWASP ASVS | V5.3.4 | Output encoding | Semgrep: output-encoding-* |

---

## SLA Entities

### SLAPolicy

| Attribute | Value |
|-----------|-------|
| **Common Name** | SLA Policy, Remediation Policy, Response Time Policy |
| **Definition** | A set of rules defining expected response and remediation times for security findings |
| **In ThreatDiviner** | A configurable policy that defines maximum allowed time for finding acknowledgment and remediation based on severity, finding type, and environment. |
| **Parent Entity** | Tenant |
| **Child Entities** | SLARule |
| **Key Fields** | `id`, `tenantId`, `name`, `description`, `rules`, `escalationPolicy`, `isDefault` |
| **Connects To** | Project, Environment, Finding, Notification |

### Default SLA Policies

#### Standard Policy

| Severity | Acknowledgment | Remediation | Escalation |
|----------|---------------|-------------|------------|
| **Critical** | 4 hours | 7 days | After 24 hours |
| **High** | 24 hours | 30 days | After 7 days |
| **Medium** | 72 hours | 90 days | After 30 days |
| **Low** | 7 days | 180 days | After 90 days |
| **Informational** | N/A | Best effort | N/A |

#### Strict Policy (Regulated Industries)

| Severity | Acknowledgment | Remediation | Escalation |
|----------|---------------|-------------|------------|
| **Critical** | 1 hour | 24 hours | Immediate |
| **High** | 4 hours | 7 days | After 24 hours |
| **Medium** | 24 hours | 30 days | After 7 days |
| **Low** | 72 hours | 90 days | After 30 days |
| **Informational** | N/A | Best effort | N/A |

#### KEV Override Policy

| Condition | Acknowledgment | Remediation |
|-----------|---------------|-------------|
| **KEV + Production** | 1 hour | 24-48 hours |
| **KEV + Non-Production** | 4 hours | 7 days |
| **EPSS > 0.9** | 4 hours | 7 days |
| **EPSS > 0.5** | 24 hours | 14 days |

### SLA Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **MTTA** | Mean Time to Acknowledge | < SLA acknowledgment time |
| **MTTR** | Mean Time to Remediate | < SLA remediation time |
| **SLA Compliance Rate** | % findings meeting SLA | > 95% |
| **Overdue Findings** | Findings past SLA | 0 for Critical/High |
| **Escalation Rate** | % findings escalated | < 10% |

---

## Workflow Statuses

### Finding Statuses

```
┌──────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────┐
│   NEW    │───▶│  CONFIRMED   │───▶│  IN_PROGRESS  │───▶│  FIXED   │
└──────────┘    └──────────────┘    └───────────────┘    └──────────┘
     │                │                     │                  │
     │                │                     │                  ▼
     │                ▼                     │           ┌──────────┐
     │         ┌──────────────┐             │           │ VERIFIED │
     │         │FALSE_POSITIVE│             │           └──────────┘
     │         └──────────────┘             │
     │                                      ▼
     │                              ┌───────────────┐
     └─────────────────────────────▶│   ACCEPTED    │
                                    │   (Risk)      │
                                    └───────────────┘
```

| Status | Description | Transitions To |
|--------|-------------|----------------|
| `new` | Finding just discovered, pending triage | `confirmed`, `false_positive`, `accepted` |
| `confirmed` | Finding validated as real issue | `in_progress`, `false_positive`, `accepted` |
| `in_progress` | Remediation work underway | `fixed`, `accepted` |
| `fixed` | Remediation applied, awaiting verification | `verified`, `in_progress` (if failed) |
| `verified` | Fix confirmed in subsequent scan | Terminal state |
| `false_positive` | Finding determined to be incorrect | Terminal state (can reopen) |
| `accepted` | Risk accepted with justification | Can reopen if risk changes |

### Scan Statuses

| Status | Description |
|--------|-------------|
| `queued` | Scan pending execution |
| `running` | Scan currently executing |
| `completed` | Scan finished successfully |
| `failed` | Scan encountered error |
| `cancelled` | Scan cancelled by user |
| `timed_out` | Scan exceeded time limit |

```
┌────────┐    ┌─────────┐    ┌───────────┐
│ QUEUED │───▶│ RUNNING │───▶│ COMPLETED │
└────────┘    └─────────┘    └───────────┘
                   │
                   ├────────▶ FAILED
                   │
                   ├────────▶ CANCELLED
                   │
                   └────────▶ TIMED_OUT
```

### Project Statuses

| Status | Description |
|--------|-------------|
| `active` | Project is active and being scanned |
| `inactive` | Project paused, no scheduled scans |
| `archived` | Project archived, read-only |
| `pending_setup` | Project created but not fully configured |

### ThreatModel Statuses

| Status | Description |
|--------|-------------|
| `draft` | Initial creation, not reviewed |
| `in_review` | Under security team review |
| `approved` | Reviewed and approved |
| `outdated` | Requires update due to changes |
| `archived` | No longer applicable |

```
┌─────────┐    ┌───────────┐    ┌──────────┐
│  DRAFT  │───▶│ IN_REVIEW │───▶│ APPROVED │
└─────────┘    └───────────┘    └──────────┘
                                     │
                                     ▼
                              ┌──────────┐    ┌──────────┐
                              │ OUTDATED │───▶│ ARCHIVED │
                              └──────────┘    └──────────┘
```

---

## SDLC Phase Mapping

This table maps ThreatDiviner entities and activities to Software Development Lifecycle phases:

| SDLC Phase | Activities | Entities | Scanner Types |
|------------|-----------|----------|---------------|
| **Plan** | Requirements, risk assessment | Project, ThreatModel | N/A |
| **Design** | Architecture review, threat modeling | ThreatModel, Asset, DataFlow | N/A |
| **Develop** | Coding, code review | Repository, Finding | SAST, Secrets |
| **Build** | Compilation, packaging | Scan, SBOM | SAST, SCA, Secrets, Container |
| **Test** | QA, security testing | Scan, Finding | SAST, DAST, SCA |
| **Release** | Packaging, signing | SBOM, PipelineGate | SCA, Container |
| **Deploy** | Infrastructure provisioning, deployment | Environment, Deployment, PipelineGate | IaC, Container |
| **Operate** | Monitoring, incident response | Finding, Alert | CSPM, DAST |
| **Monitor** | Continuous assessment | Finding, Scan | All |

### Phase-Specific Security Activities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SDLC SECURITY INTEGRATION                          │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│   PLAN   │  DESIGN  │ DEVELOP  │  BUILD   │   TEST   │  DEPLOY  │ OPERATE  │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Security │ Threat   │ IDE      │ CI/CD    │ DAST     │ Pipeline │ Runtime  │
│ Require- │ Modeling │ Plugins  │ Scans    │ Scans    │ Gates    │ Monitor  │
│ ments    │          │          │          │          │          │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Risk     │ STRIDE   │ Pre-     │ SAST     │ Pen      │ IaC      │ CSPM     │
│ Assess-  │ Analysis │ Commit   │ SCA      │ Testing  │ Scanning │ Alerts   │
│ ment     │          │ Hooks    │ Secrets  │          │          │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│          │ Security │          │ Container│          │ Approval │ Incident │
│          │ Controls │          │ Scanning │          │ Workflow │ Response │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

---

## Reporting Units

This table defines the primary unit of measurement for each metric category:

| Category | Primary Unit | Aggregation Levels | Example Metrics |
|----------|-------------|-------------------|-----------------|
| **Findings** | Individual Finding | Repo → Project → Tenant | Count, Density, Age |
| **Vulnerabilities** | CVE | Finding → Repo → Project | Affected repos, patch availability |
| **Risk** | Risk Score (0-100) | Repo → Project → Tenant | Overall risk, trend |
| **Compliance** | Control | Framework → Project → Tenant | Pass rate, coverage |
| **Coverage** | Repository | Project → Tenant | % repos scanned |
| **SBOM** | Component | Repo → Project | Dependency count, vulnerability rate |
| **SLA** | Finding | Severity → Repo → Project | MTTR, compliance rate |
| **Scans** | Scan Run | Repo → Project → Tenant | Frequency, duration, success rate |

### Metric Formulas

| Metric | Formula | Unit |
|--------|---------|------|
| **Finding Density** | Total Findings / Lines of Code × 1000 | Findings per KLOC |
| **Vulnerability Ratio** | Vulnerable Dependencies / Total Dependencies × 100 | Percentage |
| **MTTR** | Σ(Resolution Time) / Resolved Findings | Days |
| **SLA Compliance** | Findings within SLA / Total Findings × 100 | Percentage |
| **Risk Score** | Weighted sum of severity-adjusted findings | 0-100 |
| **Scan Coverage** | Repos with recent scan / Total Repos × 100 | Percentage |
| **Fix Rate** | Fixed Findings / Total Findings (period) × 100 | Percentage |

### Severity Weights (for Risk Scoring)

| Severity | Weight | Risk Points |
|----------|--------|-------------|
| Critical | 10 | 25 points each |
| High | 5 | 10 points each |
| Medium | 2 | 4 points each |
| Low | 1 | 1 point each |
| Informational | 0 | 0 points |

### Aggregation Examples

```
Tenant Risk Score = Σ(Project Risk Scores) / Project Count

Project Risk Score = Σ(Repository Risk Scores × Criticality Weight) / Σ(Criticality Weights)

Repository Risk Score = min(100, Σ(Finding Severity Weights × Finding Count))
```

---

## Appendix: Entity Relationship Summary

| Entity | Primary Key | Foreign Keys | Cardinality |
|--------|-------------|--------------|-------------|
| Tenant | tenantId | - | Root |
| Project | projectId | tenantId | Tenant 1:N Project |
| Repository | repositoryId | projectId, connectionId | Project 1:N Repository |
| Connection | connectionId | tenantId | Tenant 1:N Connection |
| Scan | scanId | repositoryId, configId | Repository 1:N Scan |
| Finding | findingId | scanId | Scan 1:N Finding |
| ScanConfig | configId | tenantId, projectId | Tenant/Project 1:N Config |
| SBOM | sbomId | repositoryId | Repository 1:N SBOM |
| ThreatModel | threatModelId | projectId | Project 1:N ThreatModel |
| Environment | environmentId | projectId | Project 1:N Environment |
| Deployment | deploymentId | environmentId | Environment 1:N Deployment |
| PipelineGate | gateId | environmentId | Environment 1:N Gate |
| ComplianceFramework | frameworkId | tenantId | Tenant N:M Framework |
| ComplianceControl | controlId | frameworkId | Framework 1:N Control |
| SLAPolicy | policyId | tenantId | Tenant 1:N Policy |

---

*Last Updated: 2024-01-15*
*Version: 1.0.0*
