# ThreatDiviner - Backlog

## In Progress
- Nothing currently in progress

## Up Next
- [ ] TypeScript compilation check (`npx tsc --noEmit`)
- [ ] Push to remote repository
- [ ] Deploy to staging environment
- [ ] User acceptance testing

## Future Ideas
- [ ] AI-powered red team simulation (PentestGPT style)
- [ ] Kubernetes runtime protection
- [ ] Browser extension for security headers
- [ ] Mobile app for alerts
- [ ] White-label for MSPs
- [ ] Upgrade Next.js to patched version (security CVE)
- [ ] Upgrade ESLint to 9.x

## Completed

### Phase 5: Dashboard Rebuild + CLI (2024-12-24)
- [x] Scan detail page with charts and scanner tabs
- [x] Single finding page with CVE/CVSS/CWE/compliance
- [x] Pipeline security view with stage gates
- [x] Analytics dashboard with metrics and charts
- [x] CSPM dashboard (accounts, findings, compliance)
- [x] SIEM dashboard (events, alerts, rules)
- [x] Repository scanner configuration UI
- [x] Branch selector and language detection
- [x] UI polish components (skeletons, empty states, toasts)
- [x] CLI tool for CI/CD (`packages/cli`)

### Phase 4: Production Infrastructure (2024-12-23)
- [x] OWASP ZAP DAST integration
- [x] CSPM module with multi-cloud support
- [x] SIEM-lite module with OpenSearch
- [x] Security hardening (Helmet, SQL injection, command injection)
- [x] Testing infrastructure (unit + E2E)
- [x] Docker/Kubernetes deployment configs

### Phase 3: Advanced Features (2024-12-22)
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

### Phase 2: Notifications + Admin (2024-12-22)
- [x] TruffleHog secrets scanner
- [x] Enhanced Trivy container scanning
- [x] Webhook auto-scan
- [x] Email notifications module
- [x] Audit logging module
- [x] Rate limiting
- [x] Swagger API documentation
- [x] Team management API

### Phase 1: Platform Core (2024-12-21)
- [x] **Feature 1: Platform Core** - Multi-tenant architecture, JWT auth, Prisma ORM
- [x] **Feature 2: SCM Integration** - GitHub OAuth, PAT auth, webhooks, GitLab support
- [x] **Feature 3: SAST Pipeline** - Semgrep integration
- [x] **Feature 4: SCA Pipeline** - Trivy dependency scanning
- [x] **Feature 5: Secrets Detection** - Gitleaks and TruffleHog integration
- [x] **Feature 6: IaC Scanning** - Checkov integration
- [x] **Feature 7: Container Scanning** - Trivy container image scanning
- [x] **Feature 8: DAST** - Nuclei + OWASP ZAP integration
- [x] **Feature 9: CSPM** - Prowler integration
- [x] **Feature 10: AI Triage Engine** - Claude AI triage
- [x] **Feature 11: Notifications & Integrations** - Slack, Email, Jira
- [x] **Feature 12: Dashboard & Reporting** - PDF reports, MinIO storage
- [x] **Feature 13: Admin Panel** - Platform admin with tenant management
- [x] **Feature 14: SIEM-Lite** - OpenSearch integration
- [x] **Feature 15: Testing & Hardening** - Unit tests, E2E tests, security fixes

---

## New Dashboard Pages (Phase 5)

| Page | Route | Status |
|------|-------|--------|
| Scan Detail | `/dashboard/scans/[id]` | Done |
| Finding Detail | `/dashboard/findings/[id]` | Done |
| Pipeline | `/dashboard/pipeline` | Done |
| Analytics | `/dashboard/analytics` | Done |
| Cloud Accounts | `/dashboard/cloud` | Done |
| Cloud Findings | `/dashboard/cloud/findings` | Done |
| Compliance | `/dashboard/cloud/compliance` | Done |
| SIEM Events | `/dashboard/siem` | Done |
| SIEM Alerts | `/dashboard/siem/alerts` | Done |
| SIEM Rules | `/dashboard/siem/rules` | Done |
| Repo Detail | `/dashboard/repositories/[id]` | Done |
| Repo Settings | `/dashboard/repositories/[id]/settings` | Done |

---

## CLI Tool (Phase 5)

```bash
# Install
npm install -g @threatdiviner/cli

# Commands
tdiv scan                    # Run security scan
tdiv scan --output sarif     # SARIF output for CI
tdiv scan --fail-on high     # Fail on high severity
tdiv config init             # Create config file
tdiv config show             # Show config
tdiv config validate         # Validate config
```
