# ThreatDiviner - Backlog

## In Progress
- [ ] **Feature 15: Testing & Hardening** 🟡

## Up Next
- [ ] Feature 8: DAST / Automated Pen Testing (ZAP, Nuclei)
- [ ] Feature 9: CSPM (Prowler, ScoutSuite)
- [ ] Feature 14: SIEM-Lite (Wazuh, OpenSearch)

## Future Ideas
- [ ] AI-powered red team simulation (PentestGPT style)
- [ ] Kubernetes runtime protection
- [ ] Browser extension for security headers
- [ ] Mobile app for alerts
- [ ] White-label for MSPs

## Completed
- [x] **Feature 1: Platform Core** - Multi-tenant architecture, JWT auth, Prisma ORM
- [x] **Feature 2: SCM Integration** - GitHub OAuth, PAT auth, webhooks, GitLab support
- [x] **Feature 3: SAST Pipeline** - Semgrep integration
- [x] **Feature 4: SCA Pipeline** - Trivy dependency scanning
- [x] **Feature 5: Secrets Detection** - Gitleaks and TruffleHog integration
- [x] **Feature 6: IaC Scanning** - Checkov integration (stubs)
- [x] **Feature 7: Container Scanning** - Trivy container image scanning
- [x] **Feature 10: AI Triage Engine** - Claude AI triage with severity/exploitability analysis
- [x] **Feature 11: Notifications & Integrations** - Slack, Email, Jira integration
- [x] **Feature 12: Dashboard & Reporting** - PDF reports, MinIO storage
- [x] **Feature 13: Admin Panel** - Platform admin with tenant management

## Phase 3 Features (Just Completed)
- [x] Scheduled Scans with cron support
- [x] Jira Integration with auto-create issues
- [x] PR Inline Comments with GitHub check runs
- [x] GitLab SCM Integration
- [x] Weekly Digest Email Scheduler
- [x] Data Export (CSV/JSON/SARIF)
- [x] Baseline Management for findings
- [x] Customer API Keys for CI/CD
- [x] Data Retention Policies
- [x] GitHub Actions CI/CD Workflows

---

## Feature Detail Template
```
### Feature X: Name
**Priority:** P0/P1/P2
**Dependencies:** Feature Y
**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2
**Test Repos:** WebGoat, DVWA, etc.
```
