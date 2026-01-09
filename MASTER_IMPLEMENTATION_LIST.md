# ThreatDiviner: DEFINITIVE MASTER IMPLEMENTATION LIST
## Generated: 2026-01-09 | Full Production Implementation - No Stubs

This is the complete, verified list of all remaining work. Every item will be fully implemented.

---

# EXECUTIVE SUMMARY

| Category | Items | Est. Files | Priority |
|----------|-------|------------|----------|
| 1. Prisma Schema Fixes | 5 | 1 | 🔴 CRITICAL |
| 2. Knowledge Sync Services | 4 | 4 | 🔴 HIGH |
| 3. AI Provider System | 25 | 25 | 🔴 HIGH |
| 4. AI Services Completion | 8 | 10 | 🔴 HIGH |
| 5. Authentication & Security | 8 | 15 | 🔴 HIGH |
| 6. Report Generators | 5 | 5 | 🟡 MEDIUM |
| 7. Dashboard Pages | 35 | 45 | 🟡 MEDIUM |
| 8. Admin Dashboard | 8 | 12 | 🟡 MEDIUM |
| 9. CLI Fixes | 3 | 3 | 🟡 MEDIUM |
| 10. Alert Engine Enhancements | 4 | 4 | 🟡 MEDIUM |
| 11. Test Suite | 50+ | 60 | 🟡 MEDIUM |
| 12. DevOps & Infrastructure | 12 | 20 | 🟢 LOWER |
| 13. Documentation | 8 | 8 | 🟢 LOWER |
| **TOTAL** | **~175** | **~212** | |

---

# SECTION 1: PRISMA SCHEMA FIXES (CRITICAL - BLOCKING)

These MUST be fixed first - duplicate models will cause compilation errors.

| # | Task | File | Action |
|---|------|------|--------|
| 1.1 | Remove duplicate Cwe model | `apps/api/prisma/schema.prisma` | Keep line 658 definition, remove line 1559 |
| 1.2 | Remove duplicate AttackTactic model | `apps/api/prisma/schema.prisma` | Keep line 777 definition, remove line 1620 |
| 1.3 | Remove duplicate AttackTechnique model | `apps/api/prisma/schema.prisma` | Keep line 790 definition, remove line 1601 |
| 1.4 | Add missing indexes | `apps/api/prisma/schema.prisma` | Finding.aiTriagedAt, Threat.priority, Deployment.status |
| 1.5 | Run migration | N/A | `npx prisma migrate dev --name fix-duplicates` |

---

# SECTION 2: KNOWLEDGE SYNC SERVICES (HIGH - 4 Stubs)

All currently return `{ synced: 0, errors: 0 }` - need full implementation.

| # | Service | File | Implementation Required |
|---|---------|------|------------------------|
| 2.1 | CWE Sync | `apps/api/src/knowledge/sync/cwe-sync.service.ts` | Download CWE XML from MITRE, parse ~1000 weaknesses, store in DB with relationships |
| 2.2 | CAPEC Sync | `apps/api/src/knowledge/sync/capec-sync.service.ts` | Download CAPEC XML, parse attack patterns, map to CWE/ATT&CK |
| 2.3 | ATT&CK Sync | `apps/api/src/knowledge/sync/attack-sync.service.ts` | Fetch STIX bundles from MITRE, parse tactics/techniques/groups |
| 2.4 | OWASP Sync | `apps/api/src/knowledge/sync/owasp-sync.service.ts` | Clone OWASP CheatSheet repo, parse markdown files, store guidance |

**Dependencies:** Schema fixes must be done first (Section 1)

---

# SECTION 3: AI PROVIDER SYSTEM (HIGH - 25 Files)

Complete provider abstraction with registry, failover, and new providers.

## 3.1 Core Infrastructure (7 files)
| # | File | Action | Description |
|---|------|--------|-------------|
| 3.1.1 | `src/ai/interfaces/ai-provider.interface.ts` | UPDATE | Add providerId, displayName, configSchema, healthCheck() |
| 3.1.2 | `src/ai/interfaces/provider-config.interface.ts` | CREATE | Provider configuration types |
| 3.1.3 | `src/ai/types/provider.types.ts` | CREATE | Enums (ProviderId, ProviderStatus, Slot) |
| 3.1.4 | `src/ai/registry/provider-registry.service.ts` | CREATE | Central registry for all providers |
| 3.1.5 | `src/ai/registry/provider-factory.service.ts` | CREATE | Factory to instantiate from config |
| 3.1.6 | `src/ai/registry/provider-registry.module.ts` | CREATE | Module exports |
| 3.1.7 | `src/ai/providers/index.ts` | CREATE | Barrel exports |

## 3.2 Provider Implementations (6 files)
| # | File | Action | Description |
|---|------|--------|-------------|
| 3.2.1 | `src/ai/providers/base.provider.ts` | CREATE | Abstract base class with common logic |
| 3.2.2 | `src/ai/providers/claude.provider.ts` | UPDATE | Add providerId, configSchema, healthCheck |
| 3.2.3 | `src/ai/providers/gemini.provider.ts` | UPDATE | Add providerId, configSchema, healthCheck |
| 3.2.4 | `src/ai/providers/openai.provider.ts` | CREATE | OpenAI GPT-4o provider |
| 3.2.5 | `src/ai/providers/azure-openai.provider.ts` | CREATE | Azure OpenAI provider |
| 3.2.6 | `src/ai/providers/bedrock.provider.ts` | CREATE | AWS Bedrock (Claude/Titan) |
| 3.2.7 | `src/ai/providers/ollama.provider.ts` | CREATE | Local Ollama for air-gapped |

## 3.3 Configuration & Secrets (5 files)
| # | File | Action | Description |
|---|------|--------|-------------|
| 3.3.1 | `src/secrets/secrets.module.ts` | CREATE | Secrets management module |
| 3.3.2 | `src/secrets/secrets.service.ts` | CREATE | Encrypt/decrypt, AWS SM integration |
| 3.3.3 | `src/secrets/secrets.constants.ts` | CREATE | Key path constants |
| 3.3.4 | `src/ai/config/ai-config.service.ts` | CREATE | Load/save provider configuration |
| 3.3.5 | `src/ai/config/ai-config.schema.ts` | CREATE | Zod schema for config validation |

## 3.4 Failover & Health (5 files)
| # | File | Action | Description |
|---|------|--------|-------------|
| 3.4.1 | `src/ai/failover/failover.service.ts` | CREATE | Dedicated failover logic |
| 3.4.2 | `src/ai/failover/failover.strategy.ts` | CREATE | Configurable strategies |
| 3.4.3 | `src/ai/failover/circuit-breaker.ts` | CREATE | Circuit breaker pattern |
| 3.4.4 | `src/ai/health/provider-health.service.ts` | CREATE | Periodic health checks |
| 3.4.5 | `src/ai/health/provider-metrics.service.ts` | CREATE | Latency, error rate tracking |

## 3.5 Service Updates (2 files)
| # | File | Action | Description |
|---|------|--------|-------------|
| 3.5.1 | `src/ai/ai.service.ts` | UPDATE | Use registry, dynamic primary/secondary |
| 3.5.2 | `src/ai/ai.module.ts` | UPDATE | Import registry, config modules |

---

# SECTION 4: AI SERVICES COMPLETION (HIGH - 10 Files)

| # | Service | File | Action | Description |
|---|---------|------|--------|-------------|
| 4.1 | AI Chat Service | `src/ai/services/chat.service.ts` | CREATE | Conversational AI for security questions |
| 4.2 | Chat History | `src/ai/services/chat-history.service.ts` | CREATE | Store/retrieve chat sessions |
| 4.3 | Chat Context | `src/ai/services/chat-context.service.ts` | CREATE | Context management for conversations |
| 4.4 | AI Rate Limiter | `src/ai/services/ai-rate-limiter.service.ts` | CREATE | Per-tenant rate limiting |
| 4.5 | AI Cost Attribution | `src/ai/services/ai-cost.service.ts` | CREATE | Track costs per tenant/feature |
| 4.6 | Prompt Templates | `src/ai/templates/prompt-template.service.ts` | CREATE | Handlebars-based template engine |
| 4.7 | Prompt Library | `src/ai/templates/prompts/*.hbs` | CREATE | Template files for each use case |
| 4.8 | Usage Tracking Update | `src/ai/services/usage-tracking.service.ts` | UPDATE | Track by slot (primary/secondary) |
| 4.9 | Usage Aggregation | `src/ai/services/usage-aggregation.service.ts` | CREATE | Aggregate stats for dashboard |
| 4.10 | Usage Alerts | `src/ai/services/usage-alerts.service.ts` | CREATE | Alert on quota thresholds |

---

# SECTION 5: AUTHENTICATION & SECURITY (HIGH - 15 Files)

| # | Feature | Files | Description |
|---|---------|-------|-------------|
| 5.1 | MFA (TOTP) | `src/auth/mfa/mfa.service.ts`, `mfa.controller.ts`, `totp.service.ts` | Time-based OTP with QR codes |
| 5.2 | Password Reset | `src/auth/password/password-reset.service.ts`, `password-reset.controller.ts` | Token-based reset flow with email |
| 5.3 | Email Verification | `src/auth/email/email-verification.service.ts`, `email-verification.controller.ts` | Verify email on signup |
| 5.4 | SSO (SAML) | `src/auth/sso/saml.service.ts`, `saml.strategy.ts` | SAML 2.0 integration |
| 5.5 | SSO (OIDC) | `src/auth/sso/oidc.service.ts`, `oidc.strategy.ts` | OpenID Connect |
| 5.6 | Session Management | `src/auth/session/session.service.ts` | Redis-based sessions, multi-device |
| 5.7 | API Key Enhancement | `src/api-keys/apikeys.service.ts` | UPDATE - Add rotation, usage tracking |
| 5.8 | Admin MFA Guard | `src/platform/guards/mfa.guard.ts` | Require MFA for admin operations |

---

# SECTION 6: REPORT GENERATORS (MEDIUM - 5 Stubs)

These exist in `enhanced-report.service.ts` but throw "Not implemented".

| # | Report | Implementation Required |
|---|--------|------------------------|
| 6.1 | Pentest Report | PDF generation for pentest findings with methodology, tools, recommendations |
| 6.2 | Repository Report | Security posture report for single repository over time |
| 6.3 | Compliance Report | Framework-specific compliance status (SOC2, PCI-DSS, etc.) |
| 6.4 | Threat Model Report | Already exists but not wired up in enhanced-report.service.ts |
| 6.5 | Executive Report | High-level summary for leadership with trends and risk scores |

---

# SECTION 7: DASHBOARD PAGES (MEDIUM - 45 Files)

## 7.1 Complete/Wire Up Existing Stubs (20 pages)
| # | Page | File | Work Required |
|---|------|------|---------------|
| 7.1.1 | Repository Detail | `repositories/[id]/page.tsx` | Full implementation |
| 7.1.2 | Repository Settings | `repositories/[id]/settings/page.tsx` | Full implementation |
| 7.1.3 | Scan Detail | `scans/[id]/page.tsx` | Full implementation |
| 7.1.4 | Threat Model Detail | `threat-modeling/[id]/page.tsx` | Full implementation |
| 7.1.5 | Threat Model Diagram | `threat-modeling/[id]/diagram/page.tsx` | Full implementation |
| 7.1.6 | New Threat Model | `threat-modeling/new/page.tsx` | Full implementation |
| 7.1.7 | CVE Search | `vulndb/cve/page.tsx` | Full implementation |
| 7.1.8 | CWE Browser | `vulndb/cwe/page.tsx` | Full implementation |
| 7.1.9 | OWASP Top 10 | `vulndb/owasp/page.tsx` | Full implementation |
| 7.1.10 | Sync Status | `vulndb/sync/page.tsx` | Full implementation |
| 7.1.11 | Kill Chain | `attack/killchain/page.tsx` | Full implementation |
| 7.1.12 | Attack Surface | `attack/surface/page.tsx` | Full implementation |
| 7.1.13 | Threat Actors | `attack/threats/page.tsx` | Full implementation |
| 7.1.14 | Technique Detail | `attack/technique/[id]/page.tsx` | Full implementation |
| 7.1.15 | SBOM List | `sbom/page.tsx` | Full implementation |
| 7.1.16 | SBOM Detail | `sbom/[id]/page.tsx` | Full implementation |
| 7.1.17 | Containers | `containers/page.tsx` | Full implementation |
| 7.1.18 | Environments | `environments/page.tsx` | Full implementation |
| 7.1.19 | Environment Detail | `environments/[id]/page.tsx` | Full implementation |
| 7.1.20 | Targets | `targets/page.tsx` | Full implementation |

## 7.2 Settings Pages (10 pages)
| # | Page | File | Work Required |
|---|------|------|---------------|
| 7.2.1 | Profile | `settings/profile/page.tsx` | User profile, password change |
| 7.2.2 | Org General | `settings/org/general/page.tsx` | Org name, settings |
| 7.2.3 | Org Team | `settings/org/team/page.tsx` | Team member management |
| 7.2.4 | Project Team | `settings/project/team/page.tsx` | Project member management |
| 7.2.5 | Project SCM Access | `settings/project/scm-access/page.tsx` | SCM connection management |
| 7.2.6 | Notifications | `settings/notifications/page.tsx` | Notification preferences |
| 7.2.7 | API Keys | `settings/api-keys/page.tsx` | API key management |
| 7.2.8 | Integrations | `settings/integrations/page.tsx` | Jira, Slack setup |
| 7.2.9 | Alerts | `settings/alerts/page.tsx` | Alert rules configuration |
| 7.2.10 | Connections | `connections/page.tsx` | SCM connections management |

## 7.3 New Pages (10 pages)
| # | Page | File | Description |
|---|------|------|-------------|
| 7.3.1 | AI Chat | `chat/page.tsx` | AI chat interface |
| 7.3.2 | NLQ Search | Component in layout | Natural language query bar |
| 7.3.3 | Cloud Findings | `cloud/findings/page.tsx` | CSPM findings list |
| 7.3.4 | Cloud Compliance | `cloud/compliance/page.tsx` | Cloud compliance status |
| 7.3.5 | Pen Testing | `pen-testing/page.tsx` | Pentest target management |
| 7.3.6 | Pipeline | `pipeline/page.tsx` | CI/CD gate management |
| 7.3.7 | Reports | `reports/page.tsx` | Report generation/download |
| 7.3.8 | SLA | `sla/page.tsx` | SLA tracking dashboard |
| 7.3.9 | Threat Intel | `threat-intel/page.tsx` | Threat intelligence feeds |
| 7.3.10 | Monitoring | `monitoring/page.tsx` | Replace "Coming Soon" placeholder |

## 7.4 Components (5 components)
| # | Component | File | Description |
|---|-----------|------|-------------|
| 7.4.1 | AI Chat Widget | `components/ai/chat-widget.tsx` | Floating chat interface |
| 7.4.2 | NLQ Search | `components/search/nlq-search.tsx` | Natural language search bar |
| 7.4.3 | SBOM Graph | `components/sbom/dependency-graph.tsx` | Dependency visualization |
| 7.4.4 | Diagram Editor | `components/threat-model/diagram-editor.tsx` | Threat model diagram tool |
| 7.4.5 | Real-time Progress | `components/scan/realtime-progress.tsx` | WebSocket scan progress |

---

# SECTION 8: ADMIN DASHBOARD (MEDIUM - 12 Files)

## 8.1 Fix Existing Pages (3 files)
| # | Page | Issue | Fix Required |
|---|------|-------|--------------|
| 8.1.1 | Dashboard | Uses hardcoded data | Wire up `platformStatsApi.get()` and `getHealth()` |
| 8.1.2 | Settings | Uses hardcoded data | Wire up `platformConfigApi.get()` |
| 8.1.3 | Tenants | Uses hardcoded data | Wire up `tenantsApi.list()`, add pagination/search |

## 8.2 New Admin Pages (6 pages)
| # | Page | File | Description |
|---|------|------|-------------|
| 8.2.1 | AI Providers | `ai-providers/page.tsx` | Provider selection, API key management |
| 8.2.2 | User Management | `users/page.tsx` | Admin user CRUD |
| 8.2.3 | Audit Logs | `audit/page.tsx` | Audit log viewer with filters |
| 8.2.4 | System Health | `health/page.tsx` | Service status, metrics |
| 8.2.5 | Usage/Billing | `usage/page.tsx` | Usage stats, cost tracking |
| 8.2.6 | Feature Flags | `features/page.tsx` | Feature toggle management |

## 8.3 Admin Components (3 components)
| # | Component | File | Description |
|---|-----------|------|-------------|
| 8.3.1 | Provider Card | `components/ai/provider-card.tsx` | Provider status card |
| 8.3.2 | API Key Input | `components/ai/api-key-input.tsx` | Masked API key field |
| 8.3.3 | Usage Chart | `components/charts/usage-chart.tsx` | Usage visualization |

---

# SECTION 9: CLI FIXES (MEDIUM - 3 Files)

| # | Issue | File | Fix Required |
|---|-------|------|--------------|
| 9.1 | SBOM not registered | `packages/cli/src/index.ts` | Import and register sbom command |
| 9.2 | SBOM standalone | `packages/cli/src/commands/sbom.ts` | Refactor to export Command, remove standalone parse() |
| 9.3 | README incomplete | `packages/cli/README.md` | Document baseline, upload, sbom commands |

---

# SECTION 10: ALERT ENGINE ENHANCEMENTS (MEDIUM - 4 Files)

| # | Feature | File | Description |
|---|---------|------|-------------|
| 10.1 | Alert Deduplication | `src/alerts/deduplication.service.ts` | Prevent duplicate alerts within window |
| 10.2 | Alert Escalation | `src/alerts/escalation.service.ts` | Auto-escalate unacked alerts |
| 10.3 | Webhook Channel | `src/notifications/webhook/webhook.service.ts` | Generic webhook notifications |
| 10.4 | Alert Storage | `src/alerts/alert-engine.service.ts` | Fix commented Alert model storage |

---

# SECTION 11: TEST SUITE (MEDIUM - 60 Files)

## 11.1 API Unit Tests (40 files)
All `.spec.ts` files currently with `it.todo()`:

| Module | Test File |
|--------|-----------|
| AI | `ai.service.spec.ts`, `claude.provider.spec.ts`, `gemini.provider.spec.ts` |
| API Keys | `apikeys.service.spec.ts` |
| Audit | `audit.service.spec.ts` |
| Baseline | `baseline.service.spec.ts` |
| Cache | `cache.service.spec.ts` |
| Fix | `fix.service.spec.ts` |
| Jira | `jira.service.spec.ts` |
| Retention | `retention.service.spec.ts` |
| SBOM | `sbom.service.spec.ts` |
| Scanners | `semgrep.scanner.spec.ts`, (one per scanner) |
| (All 43 modules need tests) | |

## 11.2 Integration Tests (10 files)
| # | Test | File | Description |
|---|------|------|-------------|
| 11.2.1 | Auth Flow | `auth.integration.spec.ts` | Login, register, token refresh |
| 11.2.2 | Scan Flow | `scan.integration.spec.ts` | Trigger, process, findings |
| 11.2.3 | AI Triage | `ai.integration.spec.ts` | Full triage pipeline |
| 11.2.4 | Compliance | `compliance.integration.spec.ts` | Score calculation |
| 11.2.5 | Notifications | `notifications.integration.spec.ts` | All 6 channels |
| 11.2.6 | SCM | `scm.integration.spec.ts` | All 4 providers |
| 11.2.7 | Reports | `reports.integration.spec.ts` | PDF generation |
| 11.2.8 | Knowledge | `knowledge.integration.spec.ts` | Sync services |
| 11.2.9 | RAG | `rag.integration.spec.ts` | Embedding + search |
| 11.2.10 | Admin | `admin.integration.spec.ts` | Platform admin |

## 11.3 E2E Tests (10 files)
| # | Test | File | Description |
|---|------|------|-------------|
| 11.3.1 | User Onboarding | `onboarding.e2e.spec.ts` | Register → Connect → Scan |
| 11.3.2 | Finding Workflow | `findings.e2e.spec.ts` | Triage → Fix → Close |
| 11.3.3 | PR Integration | `pr.e2e.spec.ts` | Webhook → Scan → Comment |
| 11.3.4 | Compliance | `compliance.e2e.spec.ts` | Full compliance workflow |
| 11.3.5 | Reports | `reports.e2e.spec.ts` | Generate → Download |
| 11.3.6 | Admin | `admin.e2e.spec.ts` | Platform admin flows |
| 11.3.7 | AI Chat | `chat.e2e.spec.ts` | Chat session workflow |
| 11.3.8 | Threat Model | `threat-model.e2e.spec.ts` | Create → Analyze → Export |
| 11.3.9 | SBOM | `sbom.e2e.spec.ts` | Upload → Analyze → Alert |
| 11.3.10 | CLI | `cli.e2e.spec.ts` | All CLI commands |

---

# SECTION 12: DEVOPS & INFRASTRUCTURE (LOWER - 20 Files)

| # | Item | Files | Description |
|---|------|-------|-------------|
| 12.1 | Kubernetes | `deploy/k8s/*.yaml` (8 files) | Deployments, services, configmaps, secrets, ingress |
| 12.2 | Terraform AWS | `deploy/terraform/aws/*.tf` (5 files) | VPC, RDS, ElastiCache, ECS, S3 |
| 12.3 | CI/CD Pipeline | `.github/workflows/*.yml` (3 files) | Test, build, deploy workflows |
| 12.4 | Prometheus | `deploy/monitoring/prometheus.yml` | Metrics collection |
| 12.5 | Grafana | `deploy/monitoring/grafana/*.json` (2 files) | Dashboard definitions |
| 12.6 | Backup Scripts | `scripts/backup.sh`, `restore.sh` | Database backup/restore |

---

# SECTION 13: DOCUMENTATION (LOWER - 8 Files)

| # | Document | File | Description |
|---|----------|------|-------------|
| 13.1 | API Reference | `docs/API.md` | UPDATE - Complete all endpoints |
| 13.2 | Developer Guide | `docs/DEVELOPER.md` | CREATE - Setup, architecture, contributing |
| 13.3 | AI Provider Setup | `docs/AI-PROVIDERS.md` | CREATE - Provider configuration guide |
| 13.4 | Admin API | `docs/AI-ADMIN-API.md` | CREATE - Admin endpoints reference |
| 13.5 | Runbook: Key Rotation | `docs/runbooks/ROTATE-AI-KEY.md` | CREATE - Key rotation procedure |
| 13.6 | Runbook: New Provider | `docs/runbooks/ADD-PROVIDER.md` | CREATE - Adding provider guide |
| 13.7 | Runbook: Failover | `docs/runbooks/FAILOVER.md` | CREATE - Troubleshooting guide |
| 13.8 | CLI Reference | `packages/cli/README.md` | UPDATE - Full command docs |

---

# IMPLEMENTATION ORDER

## Phase 1: Critical Fixes (Week 1)
1. **Prisma Schema Fixes** (Section 1) - BLOCKING
2. **Knowledge Sync Services** (Section 2) - Required for RAG

## Phase 2: Core AI (Weeks 2-3)
3. **AI Provider System** (Section 3)
4. **AI Services** (Section 4)

## Phase 3: Security (Week 4)
5. **Auth & Security** (Section 5)

## Phase 4: Features (Weeks 5-6)
6. **Report Generators** (Section 6)
7. **Alert Enhancements** (Section 10)
8. **CLI Fixes** (Section 9)

## Phase 5: Frontend (Weeks 7-9)
9. **Dashboard Pages** (Section 7)
10. **Admin Dashboard** (Section 8)

## Phase 6: Quality (Weeks 10-11)
11. **Test Suite** (Section 11)

## Phase 7: Operations (Week 12)
12. **DevOps** (Section 12)
13. **Documentation** (Section 13)

---

# NOTES

1. **All implementations will be production-ready** - no stubs, placeholders, or TODOs
2. **Each file will include**: proper error handling, logging, TypeScript types, tests
3. **Dependencies are tracked** - Schema fixes before Knowledge Sync, etc.
4. **This list is definitive** - verified against actual codebase audit

---

# VERIFICATION SOURCES

This list was created from:
- Full audit of `apps/api/src/` (43 modules, 95+ services)
- Full audit of `apps/dashboard/` (64 pages, 40+ components)
- Full audit of `apps/admin/` (5 pages, 3 utilities)
- Full audit of `packages/cli/` (5 commands)
- Full audit of `apps/api/prisma/schema.prisma` (68 models)
- Verification of all notification services (6 complete)
- Verification of all SCM providers (4 complete)
- Verification of all report generators (4 complete, 1 partial)
- Verification of all knowledge sync services (1 complete, 4 stubs)
- Cross-reference with user-provided implementation lists
