# Layer 3 Session Handover — Per-Icon CWE Overrides

**Date**: 2026-02-10
**Branch**: develop
**Status**: Files written, NOT YET VERIFIED or committed

---

## What Was Done This Session

### 1. Updated `layer3-icon-overrides.json`

**File**: `apps/api/src/vulndb/bridge/layer3-icon-overrides.json`

Expanded from 3 overrides to **18 overrides** across 3 phases:

| Phase | Icons | Total addCwes | Source |
|-------|-------|--------------|--------|
| Phase 1: Language | java (83), php (24), python (7), nodejs (10) | ~124 | `applicablePlatforms.languages` from CWE DB |
| Phase 2: Database | oracle, mysql, mariadb, neo4j, dynamodb, cassandra + existing mongodb/mssql/postgresql | ~9 | Curated, technology-specific |
| Phase 3: Infrastructure | redis, kafka, rabbitmq, vault, docker | ~7 | Curated, technology-specific |

**Key fix applied**: mongodb subcategory changed from `nosql-database` → `nosql-document` to match Layer 2.

### 2. Updated `CWE_BRIDGE_POC.md`

**File**: `.claude/ThreatModel/CWE_BRIDGE_POC.md`

- Rewrote the "Layer 3 Progress" section with full documentation of all 18 overrides
- Updated "What's Next" section — items 1 and 2 marked done

---

## What Still Needs To Be Done

### CRITICAL: CWE ID Verification (NOT done yet)

The following CWE IDs were referenced in Layer 3 but have NOT been verified to exist in the database. The DB verification attempt was blocked at the start of this session:

**High-risk IDs (newer CWEs that may not be in DB)**:
- CWE-1235 (java)
- CWE-1321 (nodejs — Prototype Pollution)
- CWE-1335 (java, nodejs)
- CWE-1336 (java, php, python, nodejs)
- CWE-1341 (java)
- CWE-1392 (rabbitmq — Use of Default Credentials)
- CWE-269 (docker — Improper Privilege Management)
- CWE-943 (neo4j, dynamodb, cassandra — already confirmed for mongodb)

**How to verify**: Run from `apps/api/`:
```js
// Use apps/api/check-run.js (scratch script) with:
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const ids = ['CWE-1235','CWE-1321','CWE-1335','CWE-1336','CWE-1341','CWE-1392','CWE-269','CWE-943'];
p.cWE.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
  .then(r => { console.log('Found:', r.length, '/', ids.length); r.forEach(c => console.log(c.id, c.name)); const found = r.map(x=>x.id); ids.filter(i=>!found.includes(i)).forEach(m=>console.log('MISSING:', m)); })
  .finally(() => p.$disconnect());
```

**If any are missing**: Remove them from the corresponding icon's `addCwes` array in `layer3-icon-overrides.json`. The system won't crash (the resolution service just won't find them in DB), but the counts will be inaccurate.

### API Testing

Once the API is running, verify with these endpoints:

```
GET /vulndb/bridge/resolve/java      → expect pool ~107 (24 base + 83 additions)
GET /vulndb/bridge/resolve/nodejs    → expect CWE-1321 (Prototype Pollution) in results
GET /vulndb/bridge/resolve/neo4j     → expect CWE-943 in results
GET /vulndb/bridge/resolve/redis     → expect CWE-94 in results
GET /vulndb/bridge/resolve/rabbitmq  → expect CWE-287 and CWE-1392 in results
GET /vulndb/bridge/stats             → should show 18 overrides (up from 3)
```

### Git Commit

Nothing has been committed yet. When ready:
```bash
git add apps/api/src/vulndb/bridge/layer3-icon-overrides.json
git add .claude/ThreatModel/CWE_BRIDGE_POC.md
git add .claude/ThreatModel/LAYER3_SESSION_HANDOVER.md
git commit -m "Expand Layer 3 icon overrides: 3 → 18 icons (language, database, infrastructure)"
```

---

## File Inventory

| File | Status | Description |
|------|--------|-------------|
| `apps/api/src/vulndb/bridge/layer3-icon-overrides.json` | MODIFIED | 18 icon overrides (was 3) |
| `.claude/ThreatModel/CWE_BRIDGE_POC.md` | MODIFIED | Layer 3 Progress section rewritten |
| `.claude/ThreatModel/LAYER3_SESSION_HANDOVER.md` | NEW | This file |

---

## Architecture Reminder

The resolution service is at `apps/api/src/vulndb/bridge/cwe-bridge-resolution.service.ts`. It reads all JSON config files at startup. The formula is:

```
Final CWEs = (Union(Layer1 per type) - Layer2_exclusions - Layer3_exclusions) + Layer3_additions
```

Layer 3 `addCwes` are added AFTER exclusions, so they always appear in the final pool regardless of Layer 1/2.

The `subcategory` field in Layer 3 entries tells the service which Layer 2 subtype the icon belongs to (for applying the correct Layer 2 exclusions). It must match a key in `layer2-subcategory-exclusions.json`.

---

## Context Files to Read in Next Session

1. `.claude/ThreatModel/CWE_BRIDGE_POC.md` — Full bridge system documentation
2. `apps/api/src/vulndb/bridge/layer3-icon-overrides.json` — The file we just updated
3. `apps/api/src/vulndb/bridge/cwe-bridge-resolution.service.ts` — Resolution service (if debugging needed)
4. This file — `.claude/ThreatModel/LAYER3_SESSION_HANDOVER.md`
