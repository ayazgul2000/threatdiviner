# Remediation & MITRE Mapping Plan — Session Handover

**Date**: 2026-02-11
**Branch**: develop
**Status**: Planning complete, implementation not started

---

## Goal

Extend the CWE Bridge resolution output to include:
1. **Remediation** (potentialMitigations from CWE DB)
2. **NIST SP 800-53 Rev 5 controls** mapped to each CWE
3. **CAPEC attack patterns** linked to each CWE
4. **MITRE ATT&CK techniques** linked through CAPEC
5. **MITRE D3FEND defensive techniques** linked through ATT&CK

The linking chain: `NIST ← CWE → CAPEC → ATT&CK → D3FEND`

---

## Current Data Inventory (as of 2026-02-11)

### What Exists in the Database

| Dataset | Table | Records | Quality Notes |
|---------|-------|---------|---------------|
| CWE | `cwes` | 969 | Complete. Synced from `cwe.mitre.org/data/xml/cwec_latest.xml.zip` |
| CWE potentialMitigations | JSON field on `cwes` | 673/969 (69.5%) have data | Some entries have empty description text (CWE-89 has 10 entries, all empty desc) |
| CWE detectionMethods | JSON field on `cwes` | 497/969 (51.3%) | Decent coverage |
| CWE likelihoodOfExploit | String field on `cwes` | 185/969 (19.1%) | Sparse — High/Medium/Low |
| CAPEC | `capec_patterns` | 558 | 449 have `relatedCwes` populated. `mitigations` field is empty (sync bug — descriptions not extracted) |
| ATT&CK Tactics | `attack_tactics` | 14 | Complete |
| ATT&CK Techniques | `attack_techniques` | 835 (479 sub-techniques) | Only 36 have `capecIds`. **0 have `cweIds`**. 0 groups populated. |
| NIST Controls | `nist_controls` | **0** | Table exists in schema but never populated |
| D3FEND | **nothing** | 0 | No schema, no service, no data |
| Compliance Mappings | `cwe_compliance_mappings` | 178 across 11 frameworks | Only 49 unique CWEs covered. Hardcoded in `cwe-mapping-sync.service.ts` |

### Compliance Framework Breakdown

| Framework | Mappings |
|-----------|----------|
| nist | 47 |
| owasp | 40 |
| pci-dss | 28 |
| asvs | 20 |
| cis | 10 |
| nist-csf | 9 |
| hipaa | 8 |
| soc2 | 5 |
| gdpr | 4 |
| fedramp | 4 |
| iso27001 | 3 |

### Existing Sync Services

All in `apps/api/src/vulndb/sync/`:

| Service | Source | Populates |
|---------|--------|-----------|
| `cwe-sync.service.ts` | `cwe.mitre.org/data/xml/cwec_latest.xml.zip` | `Cwe` |
| `cwe-view-sync.service.ts` | Same CWE XML | `CweView`, `CweCategory`, `CweCategoryMember` |
| `cwe-mapping-sync.service.ts` | Hardcoded static mappings | `CweComplianceMapping` |
| `capec-sync.service.ts` | `capec.mitre.org/data/xml/capec_latest.xml` | `CapecPattern` |
| `attack-sync.service.ts` | `github.com/mitre/cti/.../enterprise-attack.json` | `AttackTactic`, `AttackTechnique`, `AttackGroup` |
| `nvd-sync.service.ts` | NVD API | `Cve` |
| `epss-sync.service.ts` | EPSS API | `Cve` (epssScore) |
| `kev-sync.service.ts` | CISA KEV catalog | `Cve` (isKev fields) |
| `owasp-sync.service.ts` | Hardcoded OWASP Top 10 | `OwaspTop10` |

### Existing Prisma Models (relevant)

```
model NistControl {
  id                   String   @id
  family               String
  name                 String
  description          String
  supplementalGuidance String?
  relatedControls      String[]
  baselineImpact       Json     @default("[]")
  // Table: nist_controls — EXISTS BUT EMPTY
}

model AttackTechnique {
  id              String  @id
  name            String
  description     String
  tacticId        String?
  isSubTechnique  Boolean @default(false)
  parentId        String?
  platforms       String[]
  dataSources     String[]
  detection       String?
  mitigations     Json    @default("[]")
  capecIds        String[]   // Only 36 techniques have these
  cweIds          String[]   // ALL EMPTY — never populated
  url             String?
}

model CapecPattern {
  id                    String   @id
  name                  String
  description           String
  likelihood            String?
  severity              String?
  prerequisites         Json     @default("[]")
  skillsRequired        Json     @default("[]")
  resourcesRequired     Json     @default("[]")
  consequences          Json     @default("[]")
  mitigations           Json     @default("[]")  // ALL EMPTY — sync bug
  relatedCwes           String[]                  // 449/558 populated
  relatedAttackPatterns String[]
  url                   String?
}
```

---

## What Needs to Be Done

### 1. Download: NIST SP 800-53 Rev 5 Controls

**Source URL** (needs verification):
```
https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json
```

- Official OSCAL JSON format from NIST GitHub
- ~1,100+ controls across 20 families (AC, AU, CM, IA, SC, SI, etc.)
- **Action**: Create `NistSyncService` to download and populate the existing empty `nist_controls` table

### 2. Download: CWE→NIST Mapping

**Source URL** (needs verification):
```
https://raw.githubusercontent.com/center-for-threat-informed-defense/mappings-explorer/main/mappings/nist_800_53_rev5/cwe/cwe_to_nist.json
```

- From MITRE's Center for Threat-Informed Defense
- Should contain ~800+ CWE→NIST control pairs
- **Action**: Download and load into `cwe_compliance_mappings` table (replacing the 47 hardcoded NIST mappings)

### 3. Download: D3FEND Ontology

**Source URL** (needs verification):
```
https://d3fend.mitre.org/ontology/d3fend.json
```

- JSON-LD format, full D3FEND ontology
- ~250 defensive techniques organized by tactic (Harden, Detect, Isolate, Deceive, Evict, Restore)
- Each technique maps to ATT&CK techniques it counters (`d3f:counters`)
- **Action**: Create new Prisma model (`D3fendTechnique`), new `D3fendSyncService`

### 4. Fix: CAPEC Mitigations (sync bug)

The `capec-sync.service.ts` downloads CAPEC XML but the `mitigations` field on all 558 records is empty `[]`. The parser likely isn't extracting the mitigation descriptions from the XML.

- **Action**: Fix the CAPEC sync parser to correctly extract mitigation text

### 5. Fix: ATT&CK→CWE Links

835 ATT&CK techniques have `cweIds: []` (all empty). The `attack-sync.service.ts` doesn't extract CWE references.

- **Action**: Either derive CWE links through CAPEC (ATT&CK→CAPEC→CWE chain), or update the sync to extract from STIX external_references

### 6. Fix: CAPEC→ATT&CK Links (only 36/835)

The ATT&CK STIX JSON only includes CAPEC refs on some techniques. The CAPEC XML itself has richer `TAXONOMY_MAPPING` entries referencing ATT&CK technique IDs.

- **Action**: Update `capec-sync.service.ts` to extract ATT&CK technique IDs from CAPEC XML taxonomy mappings

### 7. Extract: CWE→CAPEC Reverse Links

CWE XML has `Related_Attack_Patterns` on each CWE entry. The `cwe-sync.service.ts` doesn't extract this.

- **Action**: Add `relatedCapecs String[]` field to CWE model, update sync to extract

---

## URL Verification Status

**ALL URLs NEED VERIFICATION** — they were constructed from known MITRE/NIST project structures but have NOT been fetched and confirmed. Before implementing:

1. Verify the NIST OSCAL catalog URL returns valid JSON
2. Verify the CTID CWE→NIST mapping URL exists and has the expected structure
3. Verify the D3FEND ontology URL returns JSON-LD with defensive techniques
4. Check if there's a better CAPEC→ATT&CK mapping source than extracting from XML

Alternative sources to check if primary URLs fail:
- NIST: `https://csrc.nist.gov/extensions/nudp/services/json/cef/framework/v2.0/` (NIST CSF)
- NIST 800-53: `https://csrc.nist.gov/CSRC/media/Projects/risk-management/800-53rev5-mappings/...`
- D3FEND: `https://d3fend.mitre.org/api/` (REST API alternative)
- CTID mappings: `https://github.com/center-for-threat-informed-defense/mappings-explorer` (browse repo)

---

## Implementation Order (Suggested)

1. **Fix CAPEC mitigations** (quick parser fix, unlocks CAPEC remediation data)
2. **Extract CWE→CAPEC links** (update CWE sync, builds the first chain link)
3. **Download + sync NIST 800-53 controls** (new service, fills empty table)
4. **Download CWE→NIST mapping** (replaces 47 hardcoded with ~800+ mappings)
5. **Fix CAPEC→ATT&CK links** (update CAPEC sync, strengthens chain)
6. **Derive ATT&CK→CWE links** (computed from CAPEC, fills empty cweIds)
7. **Download D3FEND + create sync** (new model + service, completes the chain)
8. **Build resolution endpoint** that walks the full chain: CWE → remediation + NIST + CAPEC → ATT&CK → D3FEND

---

## Files to Read in Next Session

1. This file — `.claude/ThreatModel/REMEDIATION_MAPPING_PLAN.md`
2. `.claude/ThreatModel/CWE_BRIDGE_POC.md` — Full bridge system docs + verification results
3. `apps/api/prisma/schema.prisma` (lines 683-880) — CWE, NIST, ATT&CK, CAPEC models
4. `apps/api/src/vulndb/sync/capec-sync.service.ts` — CAPEC sync (has mitigation bug)
5. `apps/api/src/vulndb/sync/attack-sync.service.ts` — ATT&CK sync
6. `apps/api/src/vulndb/sync/cwe-sync.service.ts` — CWE sync (missing CAPEC extraction)
7. `apps/api/src/vulndb/sync/cwe-mapping-sync.service.ts` — Hardcoded compliance mappings
8. `apps/api/src/vulndb/vulndb.service.ts` — Static CWE→CAPEC and CWE→ATT&CK mappings (lines 32-75)
