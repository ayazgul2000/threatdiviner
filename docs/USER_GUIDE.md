# ThreatDiviner User Guide

## Getting Started

### 1. Creating Your First Project

Projects organize your security resources (repositories, scans, findings) by application.

1. Click the project selector in the sidebar
2. Click "New Project"
3. Enter a name and optional description
4. Click "Create"

### 2. Connecting Repositories

#### Via OAuth (Recommended)
1. Go to **Connections** in the sidebar
2. Click the GitHub/GitLab/Bitbucket/Azure DevOps card
3. Authorize ThreatDiviner
4. Your repositories will be imported automatically

#### Via Personal Access Token
1. Go to **Connections**
2. Click "Add PAT Connection"
3. Enter your token with required scopes:
   - GitHub: `repo`, `read:org`
   - GitLab: `read_api`, `read_repository`
   - Bitbucket: `repository:read`, `pullrequest:read`
4. Click "Connect"

### 3. Running Your First Scan

1. Go to **Repositories**
2. Click on a repository to view details
3. Click "Run Scan"
4. Wait for the scan to complete (typically 1-5 minutes)

### 4. Reviewing Findings

1. Go to **Findings**
2. Filter by severity, status, or scanner
3. Click a finding to see details
4. Use action buttons:
   - **AI Triage**: Get AI-powered analysis and recommendations
   - **Apply Fix**: Auto-generate and apply a fix
   - **Suppress**: Mark as false positive or accepted risk
   - **Create Jira**: Create a ticket for tracking

---

## Core Features

### Security Scanning

ThreatDiviner includes multiple security scanners:

| Scanner | Type | Languages/Targets |
|---------|------|-------------------|
| Semgrep | SAST | 30+ languages |
| Bandit | SAST | Python |
| Gosec | SAST | Go |
| Trivy | SCA | All package managers |
| Gitleaks | Secrets | All files |
| TruffleHog | Secrets | Git history |
| Checkov | IaC | Terraform, CloudFormation, K8s |
| Nuclei | DAST | Web applications |
| ZAP | DAST | Web applications |

### Threat Modeling

Create security threat models using industry-standard methodologies:

- **STRIDE**: Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege
- **PASTA**: Process for Attack Simulation and Threat Analysis (7-stage methodology)
- **LINDDUN**: Privacy threat modeling

#### Creating a Threat Model
1. Go to **Threat Modeling**
2. Click "New Threat Model"
3. Select methodology (STRIDE, PASTA, or LINDDUN)
4. Add components (processes, data stores, external entities)
5. Define data flows between components
6. Run analysis to identify threats
7. Add mitigations for each threat

### SBOM Management

Track your software dependencies:

- Auto-generated from SCA scans
- Upload SPDX or CycloneDX files manually
- CVE matching and vulnerability alerts
- License compliance tracking

#### Uploading an SBOM
1. Go to **SBOM**
2. Click "Upload SBOM"
3. Select format (CycloneDX or SPDX)
4. Choose your file
5. Click "Upload"

### Environment Tracking

Monitor your deployment environments:

- Track what's deployed where
- Health status monitoring
- Vulnerability counts per environment
- Deployment history

#### Adding an Environment
1. Go to **Environments**
2. Click "Add Environment"
3. Select type (Kubernetes, ECS, Cloud Run, Lambda, VM)
4. Enter configuration details
5. Add deployments

---

## Advanced Features

### Compliance Dashboards

Track compliance with security frameworks:

| Framework | Description |
|-----------|-------------|
| SOC 2 Type II | Trust services criteria |
| PCI DSS 4.0 | Payment card security |
| HIPAA | Healthcare data protection |
| GDPR | European data privacy |
| ISO 27001 | Information security management |

### SLA Dashboard

Monitor remediation timelines:

| Severity | Default SLA | Escalation |
|----------|-------------|------------|
| Critical | 7 days | 3 days |
| High | 30 days | 14 days |
| Medium | 90 days | 45 days |
| Low | 180 days | 90 days |
| KEV | 14 days | 7 days |

### Threat Intelligence

Query indicators of compromise:

- IP addresses and domains
- File hashes (MD5, SHA256)
- URLs and email addresses
- CVE IDs

Sources: AbuseIPDB, ThreatFox, URLhaus, MalwareBazaar, NVD, CISA KEV

### ATT&CK Matrix

View your security posture mapped to MITRE ATT&CK:

- Technique coverage
- Kill chain visualization
- Threat actor mapping

---

## Best Practices

### 1. Organize with Projects
Group related repositories into projects for better organization and reporting.

### 2. Configure Scanner Settings
Customize which scanners run for each repository:
- Enable DAST only for repos with running apps
- Enable IaC scanning only for infrastructure repos
- Adjust severity thresholds

### 3. Use Baselines
Suppress known issues that are accepted risks:
- Reduces noise in findings
- Maintains history of decisions
- Allows focus on new vulnerabilities

### 4. Set Up Notifications
Configure alerts in Settings > Notifications:
- Slack webhooks for critical findings
- Email notifications for scan completions
- PagerDuty for SLA breaches

### 5. Regular Reviews
- **Weekly**: Review new findings
- **Monthly**: Check SLA compliance
- **Quarterly**: Review threat models

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Quick search |
| `G D` | Go to Dashboard |
| `G F` | Go to Findings |
| `G R` | Go to Repositories |
| `G S` | Go to Scans |

---

## Getting Help

- **Documentation**: This guide and API docs
- **Support**: Contact your administrator
- **Issues**: Report bugs at your organization's issue tracker

---

## FAQ

### How do I fix a security finding?
1. Click on the finding to see details
2. Review the code snippet and recommendation
3. Either:
   - Click "Apply Fix" for auto-fix
   - Click "AI Triage" for AI recommendations
   - Fix manually and click "Mark Resolved"

### How do I exclude false positives?
1. Open the finding
2. Click "Suppress"
3. Select reason (False Positive, Won't Fix, etc.)
4. Add optional notes
5. Click "Confirm"

### How often should I scan?
- **On every PR**: Catches issues before merge
- **On every push to main**: Baseline for production
- **Weekly scheduled**: Catches new CVEs in dependencies

### How do I get API access?
1. Go to Settings > API Keys
2. Click "Create New Key"
3. Copy the key (shown only once)
4. Use the key in Authorization header
