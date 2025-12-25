# ThreatDiviner E2E Testing - Issues Found

**Date:** 2025-12-25
**Tested By:** Claude Code Automated Testing Suite

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 4 |
| High | 3 |
| Medium | 5 |
| Low | 2 |
| **Total** | **14** |

---

## Critical Issues

### Issue 1: SLA Dashboard - Wrong API URL Pattern

**Page:** `/dashboard/sla`
**File:** `apps/dashboard/src/app/dashboard/sla/page.tsx`
**Lines:** 55-60

**Error Message:** 404 Not Found (network request failure)

**Description:**
The SLA Dashboard page uses relative URLs like `/api/vulndb/sla/summary` instead of the full API URL. Since the dashboard runs on port 3000 and the API on port 3001, these requests will fail.

**Console Errors:**
```
GET http://localhost:3000/api/vulndb/sla/summary 404 (Not Found)
GET http://localhost:3000/api/vulndb/sla/summary/by-severity 404 (Not Found)
GET http://localhost:3000/api/vulndb/sla/at-risk 404 (Not Found)
GET http://localhost:3000/api/vulndb/sla/breached 404 (Not Found)
GET http://localhost:3000/api/vulndb/sla/mttr 404 (Not Found)
```

**Expected:** Fetch from `${API_URL}/vulndb/sla/summary` (localhost:3001)
**Actual:** Fetching from `/api/vulndb/sla/summary` (localhost:3000)

**Fix Required:**
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Change:
fetch('/api/vulndb/sla/summary')
// To:
fetch(`${API_URL}/vulndb/sla/summary`, { credentials: 'include' })
```

---

### Issue 2: ATT&CK Matrix Page - Wrong API URL Pattern

**Page:** `/dashboard/attack`
**File:** `apps/dashboard/src/app/dashboard/attack/page.tsx`
**Line:** 32

**Error Message:** 404 Not Found

**Description:**
Uses relative URL `/api/vulndb/attack/tactics` instead of full API URL.

**Console Errors:**
```
GET http://localhost:3000/api/vulndb/attack/tactics 404 (Not Found)
```

**Expected:** `${API_URL}/vulndb/attack/tactics`
**Actual:** `/api/vulndb/attack/tactics`

---

### Issue 3: VulnDB Overview Page - Wrong API URL Pattern

**Page:** `/dashboard/vulndb`
**File:** `apps/dashboard/src/app/dashboard/vulndb/page.tsx`
**Line:** 27

**Error Message:** 404 Not Found

**Description:**
Uses relative URL `/api/vulndb/stats` instead of full API URL.

**Console Errors:**
```
GET http://localhost:3000/api/vulndb/stats 404 (Not Found)
```

---

### Issue 4: Multiple VulnDB Sub-pages - Wrong API URL Pattern

**Pages Affected:**
- `/dashboard/vulndb/cve` - Uses `/api/vulndb/cve`
- `/dashboard/vulndb/cwe` - Uses `/api/vulndb/cwe`
- `/dashboard/vulndb/owasp` - Uses `/api/vulndb/owasp`
- `/dashboard/vulndb/sync` - Uses `/api/vulndb/sync/status`
- `/dashboard/attack/killchain` - Uses `/api/vulndb/attack/killchain`
- `/dashboard/attack/threats` - Uses `/api/vulndb/attack/groups/relevant`
- `/dashboard/attack/surface` - Uses `/api/vulndb/attack/surface`
- `/dashboard/attack/technique/[id]` - Uses `/api/vulndb/attack/techniques/:id`

**Fix Required:** All these pages need to use `${API_URL}/vulndb/...` pattern.

---

## High Issues

### Issue 5: Missing API Library Functions

**File:** `apps/dashboard/src/lib/api.ts`

**Description:**
The central API library is missing functions for several new modules:

1. **VulnDB API** - No functions for CVE, CWE, OWASP, ATT&CK endpoints
2. **SLA API** - No functions for SLA summary, at-risk, breached, MTTR
3. **SBOM API** - No functions for SBOM upload, list, delete
4. **Environments API** - No functions for environments/deployments
5. **Threat Modeling API** - No functions for threat models

**Expected:** Centralized API functions in `api.ts`
**Actual:** Direct `fetch()` calls scattered across pages with inconsistent patterns

---

### Issue 6: Badge Component Missing "outline" Variant

**File:** `apps/dashboard/src/components/ui/badge.tsx`
**Pages Affected:** Multiple pages use `variant="outline"`

**Error:** TypeScript accepts it but styling may be incorrect if variant not defined.

---

### Issue 7: Missing Credentials in Fetch Calls

**Pages Affected:**
- `attack/page.tsx`
- `vulndb/page.tsx`
- `sla/page.tsx`

**Description:**
Some fetch calls are missing `credentials: 'include'` which is required for authenticated endpoints.

**Example:**
```typescript
// Current (missing credentials):
const res = await fetch('/api/vulndb/stats');

// Should be:
const res = await fetch(`${API_URL}/vulndb/stats`, { credentials: 'include' });
```

---

## Medium Issues

### Issue 8: Inconsistent API_URL Declaration

**Description:**
Some pages declare `API_URL` at the top while others use relative URLs. This should be standardized across all pages.

**Pages with correct pattern:**
- `page.tsx` (main dashboard)
- `findings/page.tsx`
- `threat-modeling/page.tsx`
- `sbom/page.tsx`
- `environments/page.tsx`

**Pages with incorrect pattern (relative URLs):**
- `sla/page.tsx`
- `attack/page.tsx`
- `vulndb/page.tsx`
- All vulndb sub-pages
- All attack sub-pages

---

### Issue 9: TableRow Missing hoverable Prop

**File:** Multiple pages with tables

**Description:**
`TableRow` component is used without `hoverable={false}` in header rows in some places, leading to inconsistent table styling.

---

### Issue 10: Empty State Components Not Used Consistently

**Description:**
Some pages use dedicated empty state components (`NoThreatModelsEmpty`, `NoSbomEmpty`) while others use inline empty messages. Should be standardized.

**Pages using proper empty states:**
- `threat-modeling/page.tsx` - Uses `NoThreatModelsEmpty`
- `sbom/page.tsx` - Uses `NoSbomEmpty`

**Pages using inline empty messages:**
- `sla/page.tsx` - Uses inline "No at-risk findings" text
- `environments/page.tsx` - Uses inline empty card

---

### Issue 11: Form Component Usage Inconsistency

**Description:**
The `environments/page.tsx` uses `Form`, `FormField`, `Label`, etc. from the new form components, but form submission doesn't use `e.preventDefault()` properly in all cases.

---

### Issue 12: Potential Runtime Error in Badge Component

**File:** `apps/dashboard/src/app/dashboard/sla/page.tsx`
**Line:** 155, 208, 256, 314

**Description:**
Badge component is used with `className` that includes `getSeverityColor()` which returns Tailwind classes like `bg-red-600`. This may conflict with variant styling.

```typescript
<Badge className={getSeverityColor(item.severity)}>
```

Should use `variant` prop instead of className for colors.

---

## Low Issues

### Issue 13: Hardcoded MTTR Calculation

**File:** `apps/dashboard/src/app/dashboard/analytics/page.tsx`
**Line:** 95

**Description:**
MTTR is calculated with `Math.random()` instead of actual data:
```typescript
const mttr = fixedFindings > 0 ? Math.round(Math.random() * 10 + 2) : 0;
```

This should use real data from the API.

---

### Issue 14: Unused Import Warning Potential

**Description:**
Some pages import components that may not be used in all code paths. Should verify imports match actual usage.

---

## Recommended Fixes Summary

1. **Critical Fix (Issue 1-4):** Update all VulnDB and ATT&CK pages to use proper `${API_URL}/...` pattern with credentials.

2. **High Fix (Issue 5):** Add VulnDB, SLA, SBOM, Environments, and Threat Modeling API functions to `lib/api.ts`.

3. **High Fix (Issue 6-7):** Ensure all fetch calls include `credentials: 'include'` and verify badge variants.

4. **Medium Fix (Issue 8-12):** Standardize patterns across all pages.

5. **Low Fix (Issue 13-14):** Clean up mock data and unused imports.

---

## Files Requiring Changes

| File | Priority |
|------|----------|
| `apps/dashboard/src/app/dashboard/sla/page.tsx` | Critical |
| `apps/dashboard/src/app/dashboard/attack/page.tsx` | Critical |
| `apps/dashboard/src/app/dashboard/vulndb/page.tsx` | Critical |
| `apps/dashboard/src/app/dashboard/vulndb/cve/page.tsx` | Critical |
| `apps/dashboard/src/app/dashboard/vulndb/cwe/page.tsx` | Critical |
| `apps/dashboard/src/app/dashboard/vulndb/owasp/page.tsx` | Critical |
| `apps/dashboard/src/app/dashboard/vulndb/sync/page.tsx` | Critical |
| `apps/dashboard/src/app/dashboard/attack/killchain/page.tsx` | Critical |
| `apps/dashboard/src/app/dashboard/attack/threats/page.tsx` | Critical |
| `apps/dashboard/src/app/dashboard/attack/surface/page.tsx` | Critical |
| `apps/dashboard/src/app/dashboard/attack/technique/[id]/page.tsx` | Critical |
| `apps/dashboard/src/lib/api.ts` | High |
