# ThreatDiviner Visual Walkthrough

## Demo Story: SecureFintech Ltd

This walkthrough demonstrates a **realistic 3-month security journey** for a payment processing startup.

### The Story

**SecureFintech Ltd** is a Series A payment processing startup. Sarah Chen (Security Lead) uses ThreatDiviner to manage their application security program.

---

## Prerequisites

### 1. Start the Services

```bash
# Terminal 1: Start API
cd apps/api
pnpm start:dev

# Terminal 2: Start Dashboard
cd apps/dashboard
pnpm dev
```

### 2. Load Demo Data

```bash
cd apps/api
npx ts-node prisma/seeds/demo-journey.seed.ts
```

### 3. Login

- **URL**: http://localhost:3000
- **Email**: sarah.chen@securefintech.io
- **Password**: Demo123!
- **Tenant**: securefintech

---

## Month 1: October - Initial Assessment

### Step 1.1: Dashboard Overview

**Navigate to**: Dashboard (Home)

**What you should see**:
- [ ] 1 CRITICAL finding alert (the new CVE from December)
- [ ] Security Score summary
- [ ] Recent scan activity
- [ ] Vulnerability trend chart

**Why it matters**: Sarah sees the security posture at a glance. The critical finding demands immediate attention.

---

### Step 1.2: View Threat Model

**Navigate to**: Threat Modeling

**What you should see**:
- [ ] "Payment Gateway API - STRIDE Analysis" threat model
- [ ] Status: **Completed**
- [ ] Methodology: **STRIDE**

**Click on the threat model**:
- [ ] 5 Components displayed:
  - API Gateway
  - Payment Service
  - Card Vault
  - Merchant Database
  - Webhook Queue
- [ ] 12 Threats listed (2 per STRIDE category)
- [ ] 11 Mitigated (green)
- [ ] 1 Open (red) - "API Response Leakage"

**Why it matters**: Sarah created a comprehensive threat model before writing code. This proactive approach identified 12 potential threats across all STRIDE categories.

---

### Step 1.3: Review Connected Repositories

**Navigate to**: Repositories

**What you should see**:
- [ ] GitHub connection active (green indicator)
- [ ] 3 repositories:
  - `payment-api` (TypeScript)
  - `merchant-portal` (TypeScript)
  - `infrastructure` (HCL)
- [ ] Each shows last scan date

**Why it matters**: GitHub integration enables automatic scanning on every push.

---

## Month 2: November - Remediation

### Step 2.1: Review Findings History

**Navigate to**: Findings

**What you should see**:
- [ ] 9 total findings
- [ ] Filter by Status shows:
  - 6 Fixed (green)
  - 1 Open (red) - the new CVE
  - 1 Accepted (yellow)

**Initial Findings (October)**:
| Finding | Severity | Status |
|---------|----------|--------|
| SQL Injection | CRITICAL | Fixed |
| Hardcoded AWS Creds | CRITICAL | Fixed |
| Vulnerable lodash | HIGH | Fixed |
| XSS in Errors | HIGH | Fixed |
| Insecure Cookies | HIGH | Fixed |
| Missing Rate Limit | MEDIUM | Fixed |
| Verbose Errors | MEDIUM | Accepted |
| Weak Password Policy | LOW | Fixed |

**Why it matters**: Sarah's team fixed 6 of 8 vulnerabilities before deploying to staging. The "Verbose Errors" finding was reviewed and accepted as it only affects development environments.

---

### Step 2.2: Check Baselines

**Navigate to**: Baselines (or Findings → Baselined tab)

**What you should see**:
- [ ] 1 baselined finding
- [ ] Reason: "Verbose error messages only shown in development environment"
- [ ] Baselined by: Sarah Chen

**Why it matters**: Not every finding is a real risk. Sarah documented why this was acceptable, creating an audit trail.

---

### Step 2.3: View Environment Progression

**Navigate to**: Environments

**What you should see**:
- [ ] 3 environments:
  - Development (deployed Oct 15)
  - Staging (deployed Nov 20)
  - Production (deployed Dec 5)
- [ ] Each shows deployment version

**Why it matters**: The team followed proper progression - fixing critical issues before each promotion.

---

## Month 3: December - Production & Incident

### Step 3.1: View Production Deployment

**Navigate to**: Environments → Production

**What you should see**:
- [ ] Version: v1.1.0
- [ ] Status: Running
- [ ] Replicas: 3
- [ ] Deployed: December 5, 2024

**Why it matters**: Production is live with 3 replicas for high availability.

---

### Step 3.2: The Incident - New CVE Detected!

**Navigate to**: Findings → Filter by CRITICAL + Open

**What you should see**:
- [ ] "CRITICAL: New CVE in lodash (CVE-2024-XXXX)"
- [ ] Detected: December 15, 2024
- [ ] Status: **OPEN**
- [ ] SLA: **72 hours** for CRITICAL

**Click on the finding**:
- [ ] Title: Remote code execution vulnerability in lodash.set()
- [ ] Remediation: "Upgrade lodash to 4.17.22 immediately"
- [ ] Affects: package.json in payment-api

**Why it matters**: A new vulnerability was disclosed AFTER deployment. ThreatDiviner detected it during scheduled scanning.

---

### Step 3.3: Verify Alert Was Sent

**Navigate to**: Settings → Alerts (or Alerts)

**Alert Rules tab**:
- [ ] "Critical Vulnerability Alert" rule
- [ ] Enabled: Yes
- [ ] Severities: CRITICAL
- [ ] Notify: Slack + Email

**Alert History tab**:
- [ ] Alert triggered on December 15, 2024
- [ ] Matched event: finding.created
- [ ] Sample: "CRITICAL: New CVE in lodash"

**Why it matters**: Sarah was immediately notified about the critical vulnerability. No manual checking required.

---

### Step 3.4: Review Pipeline Gates

**Navigate to**: Pipeline (or Settings → CI/CD)

**What you should see**:
- [ ] 3 pipeline gates configured:
  - deploy-dev: Blocks NONE
  - deploy-staging: Blocks CRITICAL
  - deploy-prod: Blocks HIGH and above

**Why it matters**: Even if someone tried to deploy with this critical CVE, the pipeline gate would block it.

---

### Step 3.5: Check Audit Trail

**Navigate to**: Settings → Audit Log (or /audit-logs)

**What you should see** (chronological):
- [ ] project.create (Oct 5)
- [ ] threat_model.create (Oct 10)
- [ ] threat_model.complete (Oct 15)
- [ ] scan.complete (Oct 10)
- [ ] finding.status_change → fixed (Oct 15)
- [ ] deployment.create → Development (Oct 15)
- [ ] finding.status_change → fixed (Nov 1)
- [ ] finding.baseline (Nov 15)
- [ ] deployment.create → Staging (Nov 20)
- [ ] deployment.create → Production (Dec 5)
- [ ] finding.create → NEW CVE (Dec 15)
- [ ] alert.trigger (Dec 15)

**Why it matters**: Complete audit trail for compliance. Every action is logged with timestamp and user.

---

## Analytics & Reporting

### Step 4.1: View Analytics Dashboard

**Navigate to**: Analytics

**What you should see**:
- [ ] Vulnerability trend over time
- [ ] MTTR (Mean Time to Remediate)
- [ ] Findings by severity
- [ ] Findings by scanner

**Why it matters**: Sarah can show leadership the security improvements over 3 months.

---

### Step 4.2: SBOM (Software Bill of Materials)

**Navigate to**: SBOM

**What you should see**:
- [ ] List of dependencies
- [ ] Affected versions
- [ ] CVE associations

**Why it matters**: Understanding what's in the software helps assess blast radius when new CVEs are announced.

---

## Verification Checklist

### Data Counts

| Entity | Expected Count | Verified |
|--------|---------------|----------|
| Users | 2 | [ ] |
| Repositories | 3 | [ ] |
| Environments | 3 | [ ] |
| Scans | 6 | [ ] |
| Findings (total) | 9 | [ ] |
| - Fixed | 6 | [ ] |
| - Open | 1 | [ ] |
| - Accepted | 1 | [ ] |
| Threat Model | 1 | [ ] |
| - Components | 5 | [ ] |
| - Threats | 12 | [ ] |
| Alert Rules | 1 | [ ] |
| Alert History | 1 | [ ] |
| Audit Events | 12+ | [ ] |

### Feature Functionality

| Feature | Works | Notes |
|---------|-------|-------|
| Login | [ ] | sarah.chen@securefintech.io / Demo123! |
| Dashboard loads | [ ] | Shows overview with metrics |
| Findings list | [ ] | 9 findings with correct statuses |
| Threat Model view | [ ] | 5 components, 12 threats |
| STRIDE categories | [ ] | 2 threats per category |
| Environments list | [ ] | 3 environments with deployments |
| Alert rules | [ ] | Critical vulnerability alert |
| Alert history | [ ] | December 15 alert for CVE |
| Audit logs | [ ] | 12+ events in chronological order |

---

## Troubleshooting

### Seed Data Not Appearing

```bash
# Re-run seed
cd apps/api
npx prisma db push --force-reset
npx ts-node prisma/seeds/demo-journey.seed.ts
```

### API Not Responding

```bash
# Check API is running
curl http://localhost:3001/health

# Restart API
cd apps/api
pnpm start:dev
```

### Login Issues

- Ensure tenant slug is `securefintech`
- Password is case-sensitive: `Demo123!`
- Check browser console for errors

---

## Summary

This walkthrough demonstrates:

1. **Proactive Security**: Threat modeling BEFORE code is deployed
2. **Continuous Scanning**: Automatic detection of vulnerabilities
3. **Remediation Tracking**: Clear visibility into fix progress
4. **Risk Acceptance**: Documented baselines for accepted risks
5. **Environment Progression**: Controlled promotion through stages
6. **Incident Response**: Immediate alerting when new CVEs affect production
7. **Compliance**: Complete audit trail of all security activities

ThreatDiviner provides the visibility and automation needed for a modern application security program.
