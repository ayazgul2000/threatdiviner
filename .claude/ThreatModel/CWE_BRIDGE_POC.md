# CWE Bridge POC — Session Handover Document

## Goal

Map **diagram icons** (from the Python `diagrams` library — AWS, Azure, GCP, K8s, etc.) to **CWE vulnerability IDs** through a 3-layer resolution system. When a user places an icon on a threat model diagram, the system automatically returns the relevant CWEs for that technology.

---

## Resolution Formula

```
Final CWEs = (Union(Layer1 per type) - Layer2_exclusions - Layer3_exclusions) + Layer3_additions
```

---

## The 3 Layers

### Layer 1 — Broad CWE Pool per Type
- Each icon has one or more **types** (e.g., `database`, `network`, `compute`)
- Each type maps to **CWE-699 subcategories** + **applicablePlatforms.technologies keywords**
- The union of all CWE members from those sources = the Layer 1 pool
- Example: `database` → CWE-699 subs `[CWE-1214, CWE-19]` + tech keyword `["Database Server"]` → 42 CWEs

### Layer 2 — Subcategory Exclusions within Types
- Within a type, icons are grouped into **subtypes** based on functional similarity
- Each subtype **excludes** CWEs from the Layer 1 pool that don't apply to that class of technology
- Example: `kv-store` subtype excludes SQL-specific CWEs (89, 564, 566, 619) because Redis/DynamoDB don't use SQL
- Subtypes are defined by their CWE exclusion patterns — icons that need the same CWEs excluded become a subtype

### Layer 3 — Per-Icon Overrides
- Individual icon-level adjustments: exclude specific CWEs, add specific CWEs
- Example: `mongodb` excludes buffer overflow CWEs (119, 121, 122) and adds NoSQL injection CWE-943
- Most granular level, used sparingly for well-known technologies

---

## Data Sources (in PostgreSQL)

### CWE-699 View (Prisma: `CweView`, `CweCategory`, `CweCategoryMember`)
- **CweView**: id="CWE-699" (Software Development view)
- **CweCategory**: 75 subcategories (e.g., "CWE-1214" = Data Integrity, "CWE-19" = Data Processing Errors)
- **CweCategoryMember**: Links categories to CWE IDs. 1,503 memberships across 969 unique CWEs
- Schema: `categoryId` (string "CWE-1214"), `cweId` (string "CWE-89")
- Table names: `cwe_views`, `cwe_categories`, `cwe_category_members`

### applicablePlatforms.technologies (on `cwes` table)
- **Cwe.applicablePlatforms**: JSON field with structure `{ languages: [...], technologies: [{ name, prevalence }] }`
- NOT a flat array — it's a nested object. Access via `applicablePlatforms.technologies[].name`
- 16 distinct technology values in DB. Layer 1 currently uses 5:
  - `"Database Server"`, `"Web Server"`, `"AI/ML"`, `"Microcontroller Hardware"`, `"Sensor Hardware"`
- Raw SQL to query: `SELECT id FROM cwes WHERE applicable_platforms::jsonb -> 'technologies' @> '[{"name":"Database Server"}]'::jsonb`

### CWE Weakness Table (Prisma: `Cwe`)
- id: string like "CWE-89"
- name, description, extendedDescription, applicablePlatforms (JSON), etc.
- Table name: `cwes`

---

## Files

All bridge files are in: `apps/api/src/vulndb/bridge/`

| File | Purpose | Key Details |
|------|---------|-------------|
| `icon-registry.json` | 2,128 icons from Python diagrams lib | `{ "iconName": { types: [], modules: [], classes: [] } }` |
| `icon-type-overrides.json` | Reassigns icons from provider catch-all modules to proper types | `{ "iconName": "correctedType" }` or `"skip"` for non-technical icons. ~192 overrides, ~59 skips. Keys starting with `_comment` are ignored. |
| `layer1-category-defaults.json` | 136 type entries mapping to CWE sources | `{ "typeName": { cwe699Subcategories: ["CWE-xxx"], technologyKeywords: ["keyword"] } }`. Keys starting with `_comment` are ignored. |
| `layer2-subcategory-exclusions.json` | Subtypes within types with CWE exclusion lists and icon assignments | `{ "subtypeName": { category: "parentType", icons: [...], excludeCwes: [...] } }`. Keys starting with `_comment` are ignored. |
| `layer3-icon-overrides.json` | Per-icon CWE adjustments | `{ "iconName": { subcategory: "sub", excludeCwes: [...], addCwes: [...] } }` |
| `cwe-bridge-resolution.service.ts` | NestJS service implementing the 3-layer resolution | Methods: `resolve()`, `resolveCategory()`, `getCategories()`, `getKnownIcons()`, `getStats()` |
| `cwe-bridge.controller.ts` | REST endpoints for the bridge | 5 endpoints under `/vulndb/bridge/` |
| `index.ts` | Barrel export | Exports service + controller |

### Module Registration
- Registered in `apps/api/src/vulndb/vulndb.module.ts`
- `CweBridgeResolutionService` in providers, `CweBridgeController` in controllers
- Uses `PrismaService` for DB queries

---

## REST API Endpoints

All under `/vulndb/bridge/`, JWT-authenticated:

| Method | Path | Returns |
|--------|------|---------|
| GET | `/resolve/:iconName` | Full resolution result with layer breakdown |
| GET | `/category/:category` | Layer 1 CWEs for a type (no Layer 2/3) |
| GET | `/categories` | List of all Layer 1 type names |
| GET | `/icons` | All icons with types, overrides, subcategory info |
| GET | `/stats` | Registry stats: total, mapped, unmapped, skipped counts |

---

## Icon Registry Details

- **2,128 total icons** extracted from Python `diagrams` library
- Sources: AWS, Azure, GCP, K8s, Alibaba Cloud, OCI, IBM, DigitalOcean, Elastic, Generic, etc.
- Each icon has: `types[]` (from module path), `modules[]` (provider.module), `classes[]` (Python class names)
- Icons can have multiple types (e.g., an icon in both `database` and `analytics` modules)

### Icon Type Overrides (CRITICAL)
- Many provider modules dump icons into `general` or `other` catch-all modules
- `icon-type-overrides.json` reassigns these to proper types (e.g., `"generic-database"` → `"database"`, `"ftp"` → `"network"`)
- `"skip"` value marks non-technical icons (UI chrome, logos, status indicators) — these get NO CWEs
- **Every script/query that counts icons per type MUST apply these overrides**
- After overrides: **59 skipped**, **34 unmapped** (flowchart symbols, GIS formats — excluded, no CWEs)

---

## Type Inventory

136 entries in Layer 1, including aliases. After dedup and applying overrides:
- **132 types with icons assigned** (some types are aliases with identical CWE mappings)
- `general` and `other` are NOT catch-alls — they are types like any other. Their icons have mostly been reassigned via overrides to proper types. The remaining icons in general/other are the ones that genuinely belong there (tech-agnostic infrastructure icons).

### Top types by icon count (after overrides applied):

| Type | Icons | Type | Icons | Type | Icons |
|------|-------|------|-------|------|-------|
| network | 188 | compute | 180 | security | 138 |
| iot | 127 | database | 114 | storage | 113 |
| management | 100 | analytics | 92 | ml | 64 |
| integration | 59 | networking | 54 | identity | 44 |
| devtools | 42 | monitoring | 41 | general | 36 |
| managementgovernance | 33 | devops | 33 | aimachinelearning | 32 |
| blockchain | 29 | web | 27 | framework | 25 |

(Full list: 132 types, 2,265 total icon assignments — some icons counted in multiple types)

---

## Layer 2 Progress — COMPLETE

**All 132 categories covered. 484 total subtypes. File: 7,210 lines.**

### Breakdown

- **29 categories with multiple subtypes** (granular CWE exclusion patterns)
- **103 categories with single `-all` subtypes** (all CWEs in pool apply uniformly to all icons)

### Categories with multiple subtypes (by subtype count):

| Category | Subtypes | Category | Subtypes |
|----------|----------|----------|----------|
| network | 12 | analytics | 7 |
| database | 7 | general | 7 |
| security | 7 | aimachinelearning | 6 |
| blockchain | 6 | compute | 6 |
| identity | 6 | language | 6 |
| storage | 6 | web | 6 |
| devops | 5 | devtools | 5 |
| framework | 5 | integration | 5 |
| intune | 5 | iot | 5 |
| management | 5 | managementgovernance | 5 |
| migration | 5 | networking | 5 |
| applications | 5 | databases | 5 |
| connectivity | 4 | data | 4 |
| elasticsearch | 4 | media | 4 |
| ml | 4 | mobile | 4 |
| monitor | 4 | monitoring | 4 |
| application | 4 | server | 4 |
| container | 3 | governance | 3 |
| infrastructure | 4 | user | 3 |

### Why 103 categories use single subtypes

Each was reviewed against its CWE pool and icon list. The pattern is consistent:
- **Small icon counts** (1–10 icons) — splitting creates 1–2 icon groups with no analytical value
- **Homogeneous icons** — all icons within each type are functionally similar (e.g., all CI tools, all chat platforms, all K8s RBAC objects)
- **Focused CWE pools** — most pull from 1–3 CWE-699 subcategories, producing narrow pools where all CWEs apply to all icons equally

### Example: `database` type (most detailed)

**Pool**: 42 CWEs from CWE-699 subs `[CWE-1214, CWE-19]` + Tech keyword `["Database Server"]`

**7 subtypes, 134 icons, 0 unassigned:**

| Subtype | Icons | Excluded CWEs | Effective CWEs | Exclusion Groups |
|---------|-------|---------------|----------------|-----------------|
| sql-database | 71 | 5 (90,472,565,601,1073) | 37 | LDAP, Web, Non-SQL |
| kv-store | 18 | 10 (89,90,472,564,565,566,601,611,619,776) | 32 | SQL, LDAP, Web, XML |
| data-warehouse | 13 | 4 (90,472,565,601) | 38 | LDAP, Web |
| nosql-document | 11 | 8 (89,90,472,564,565,566,601,619) | 34 | SQL, LDAP, Web |
| wide-column | 9 | 10 (89,90,472,564,565,566,601,611,619,776) | 32 | SQL, LDAP, Web, XML |
| graph-database | 5 | 10 (89,90,472,564,565,566,601,611,619,776) | 32 | SQL, LDAP, Web, XML |
| time-series | 5 | 10 (89,90,472,564,565,566,601,611,619,776) | 32 | SQL, LDAP, Web, XML |
| search-engine | 2 | 8 (89,90,472,564,565,566,601,619) | 34 | SQL, LDAP, Web |

---

## Layer 3 Progress — COMPLETE

**18 icon overrides across 3 phases. ~139 CWE additions total.**

### Phase 1: Language Icons (data-driven from `applicablePlatforms.languages`)

Uses the CWE database's own language-specific mappings — the CWE project itself says these CWEs apply to these languages.

| Icon | Subcategory | addCwes | Rationale |
|------|-------------|---------|-----------|
| java | lang-jvm | 83 CWEs (J2EE/EJB/Struts, deserialization, threading, type safety) | `applicablePlatforms.languages = "Java"` |
| php | lang-scripting | 24 CWEs (file inclusion, variable manipulation, deserialization, eval) | `applicablePlatforms.languages = "PHP"` |
| python | lang-scripting | 7 CWEs (eval injection, pickle deserialization, template injection) | `applicablePlatforms.languages = "Python"` |
| nodejs | lang-webjs | 10 CWEs (prototype pollution CWE-1321, deserialization, eval) | `applicablePlatforms.languages = "JavaScript"` |

### Phase 2: Database Icons (curated, technology-specific)

| Icon | Subcategory | addCwes | excludeCwes | Rationale |
|------|-------------|---------|-------------|-----------|
| mongodb | nosql-document | CWE-943 | CWE-119, 121, 122 | NoSQL injection; exclude buffer overflows (managed runtime) |
| mssql | sql-database | CWE-78 | — | OS command injection via xp_cmdshell |
| postgresql | sql-database | CWE-78 | — | OS command injection via COPY/extensions |
| oracle | sql-database | CWE-78 | — | OS command injection via DBMS_SCHEDULER, Java stored procs |
| mysql | sql-database | CWE-78 | — | OS command injection via INTO OUTFILE, LOAD_FILE, UDFs |
| mariadb | sql-database | CWE-78 | — | Same as MySQL (fork), UDFs, INTO OUTFILE |
| neo4j | graph-database | CWE-943 | — | Cypher injection (graph query language injection) |
| dynamodb | kv-store | CWE-943 | — | NoSQL injection via expression attributes |
| cassandra | wide-column | CWE-943 | — | CQL injection |

### Phase 3: Infrastructure Icons (curated, technology-specific)

| Icon | Subcategory | addCwes | Rationale |
|------|-------------|---------|-----------|
| redis | inmemory-all | CWE-94 | Lua script injection via EVAL command |
| kafka | queue-all | CWE-287 | Default no-auth PLAINTEXT listeners |
| rabbitmq | queue-all | CWE-287, CWE-1392 | Default guest/guest credentials, auth bypass |
| vault | encryption-kms | CWE-200, CWE-287 | Secret exposure, auth method bypass |
| docker | container-runtime | CWE-269 | Privilege escalation via container escape |

**Note**: The mongodb subcategory was fixed from `nosql-database` to `nosql-document` to match Layer 2.

---

## Temporary Scripts

`apps/api/check-run.js` and `apps/api/layer2-analysis.js` are disposable scratch scripts overwritten constantly for ad-hoc DB queries and analysis. They are not part of the application.

---

## Key Patterns and Gotchas

1. **JSON comment keys**: All JSON config files use `"_comment_*"` keys for section headers. These MUST be filtered out in all processing (`key.startsWith('_')` check).

2. **Icon type resolution order**: Override → Registry types → Icon name as fallback. See `findIconPlacement()` in the service.

3. **Multi-type icons**: An icon can belong to multiple types. Resolution unions CWEs from ALL matching types.

4. **applicablePlatforms structure**: It's `{ languages: [...], technologies: [{ name, prevalence }] }`, NOT a flat array of `{ type, name }`. This is critical for DB queries.

5. **Prisma string IDs**: All CWE IDs are strings like `"CWE-89"`, not integers. Category IDs are also strings like `"CWE-1214"`.

6. **Windows environment**: Scripts run on Windows with bash via Git Bash. Use `cd "C:\path"` with quotes. Use `rm -f` not `del`.

7. **The 134 vs 114 discrepancy**: The type count script shows `database: 114` because it counts icons whose registry type is `database`. But `database` + `databases` + overridden icons = 134 total database icons in Layer 2. The Layer 2 file is authoritative.

8. **general and other are regular types**: They exist in Layer 1 with broad CWE mappings. Most of their icons have been reassigned via overrides. The remaining ones are legitimately technology-agnostic. Do NOT refer to them as "catch-alls" or treat them as special.

---

## Pitfalls & Rules to Abide By

These are mandatory practices for anyone writing code against the CWE Bridge system. Each addresses a known failure mode where silent, hard-to-debug errors occur.

### Rule 1: Centralize JSON config loading — never filter comment keys ad-hoc

All bridge JSON files use `"_comment_*"` keys as section headers. The current pattern of filtering with `key.startsWith('_')` at every call site is fragile — one missed check and comment keys get processed as real entries.

**Rule**: All JSON config reads MUST go through a single utility function (e.g., `loadBridgeConfig(filePath)`) that strips `_`-prefixed keys on load. No direct `JSON.parse` + manual filtering. Alternatively, migrate to JSONC (JSON with Comments) using `jsonc-parser`, which eliminates the problem entirely.

### Rule 2: Never bypass the resolution service for type lookups

An icon can belong to multiple types (e.g., both `database` and `analytics`). The resolution service correctly unions CWE pools from all matching types. Ad-hoc queries that assume one icon = one type will produce incomplete results.

**Rule**: Always use the resolution service's `resolve()` method for CWE lookups. If you need raw type info outside the service, use `findIconPlacement()` as the reference — never query the registry directly and assume a single type.

### Rule 3: Respect the `applicablePlatforms` nested structure

The `applicablePlatforms` column on the `cwes` table is a JSON field with a **nested** structure, not a flat array. Wrong queries fail silently (zero rows, no error).

**Correct structure**:
```json
{
  "languages": [{ "name": "Java", "prevalence": "Often" }],
  "technologies": [{ "name": "Database Server", "prevalence": "Often" }]
}
```

**Correct Postgres query**:
```sql
WHERE applicable_platforms::jsonb -> 'technologies' @> '[{"name":"Database Server"}]'
```

**Rule**: Add a typed TypeScript interface for this field:
```typescript
interface ApplicablePlatforms {
  languages?: { name: string; prevalence: string }[];
  technologies?: { name: string; prevalence: string }[];
}
```
Use this interface everywhere instead of treating the field as opaque `Json`. Add a comment in the Prisma schema on the `applicablePlatforms` field documenting the structure.

### Rule 4: Normalize CWE IDs at every entry point

All CWE IDs in the database are strings like `"CWE-89"`, not integers. Passing `89` or `"89"` returns zero results with no error.

**Rule**: Create and use a `normalizeCweId(input)` utility that accepts `89`, `"89"`, or `"CWE-89"` and always returns `"CWE-89"`. Apply it at:
- API controller parameter parsing
- JSON config file loading
- Any ad-hoc scripts or queries

The bridge controller endpoints MUST reject IDs that don't match the `CWE-\d+` pattern with a clear error message instead of returning empty results.

### Rule 5: Use effective counts, not registry counts

The icon registry reports `database: 114` (raw module-derived types). Layer 2 reports 134 database icons (after applying type overrides and the `databases` alias). Both are correct in context, but only the effective count matters for CWE resolution.

**Rule**: User-facing stats (the `/stats` endpoint, dashboards, reports) MUST report **effective** counts — the numbers after overrides are applied. If both raw and effective counts are shown, label them explicitly:
- `registryDatabaseIcons: 114` (before overrides)
- `effectiveDatabaseIcons: 134` (after overrides — authoritative)

Never present the raw registry count alone as "number of database icons."

---

## CWE-699 Subcategories Used in Layer 1

24 of 75 subcategories currently assigned:

| CWE-699 Sub | Name (approximate) | Used by types |
|-------------|-------------------|---------------|
| CWE-19 | Data Processing Errors | database, analytics, etl, search, media, data, migrate |
| CWE-137 | Data Neutralization | network, web, api, integration, cdn, search, etl, media |
| CWE-199 | Information Management Errors | storage, monitoring, data, management, filesharing |
| CWE-255 | Credentials Management | security, auth, identity, user, payment, rbac |
| CWE-265 | Privilege / Sandbox Issues | rbac, container, ci/cd, devops, iac, vcs, management, os |
| CWE-275 | Permission Issues | rbac |
| CWE-310 | Cryptographic Issues | security, certificates, blockchain, payment |
| CWE-320 | Key Management Errors | security, certificates |
| CWE-355 | User Interface Security | client, web, mobile, cli, desktop, frontend, enduser |
| CWE-399 | Resource Management Errors | compute, container, iot, inmemory, media, os |
| CWE-417 | Communication Channel Errors | network, queue, messaging, dns, iot, cdn, chat |
| CWE-452 | Initialization and Cleanup | container |
| CWE-557 | Concurrency Issues | container, queue, messaging |
| CWE-840 | Business Logic Errors | integration, workflow, payment, business |
| CWE-1210 | Audit / Logging Errors | logging, monitoring, tracing, observability, management |
| CWE-1211 | Authentication Errors | security, auth, identity, user, saas, management |
| CWE-1212 | Authorization Errors | security, auth, identity, rbac, governance, management |
| CWE-1214 | Data Integrity Issues | database, analytics, blockchain, inmemory, data |
| CWE-1215 | Data Validation Issues | web, api, application, frontend |
| CWE-1217 | User Session Errors | web, mobile, saas |
| CWE-1218 | Memory Buffer Errors | compute, iot, os |
| CWE-1219 | File Handling Issues | storage, vcs, filesharing, os |
| CWE-1227 | Encapsulation Issues | iac |
| CWE-1228 | API / Microservice Issues | integration, api, ci/cd, devops, application, saas, framework |

51 unused CWE-699 subcategories remain — may be needed as more types get detailed Layer 2 work.

---

## What's Next

1. ~~**Fix Layer 3 mongodb subcategory**~~ — DONE (changed `nosql-database` → `nosql-document`)
2. ~~**Expand Layer 3 overrides**~~ — DONE (18 icons across 3 phases: 4 language, 9 database, 5 infrastructure)
3. **Global completeness verification**: Confirm every icon in registry is either assigned to a Layer 2 subtype, skipped, or marked excluded
4. **Integration testing**: Ensure the resolution service correctly handles all 132 categories and 484 subtypes end-to-end
5. **CWE ID verification**: Validate that all CWE IDs referenced in Layer 3 addCwes exist in the database (especially CWE-1235, CWE-1335, CWE-1336, CWE-1341, CWE-1321, CWE-1392, CWE-269)
