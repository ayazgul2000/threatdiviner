# Repository Security View - Development Handover

## Session Summary
**Date:** January 13, 2026
**Focus:** Building a Repository Security View UI for ThreatDiviner dashboard

---

## What We Built

### Final Component: Repository Security View
A visual dashboard showing repositories, branches, security scans, and (planned) merge relationships.

**Location:** `C:\Dev\threatdiviner-v0.2.0\apps\dashboard\src\app\dashboard\repos\page.tsx`

**URL:** `http://localhost:3000/dashboard/repos`

---

## Files Created (in order)

All files saved to `C:\Dev\threatdiviner-v0.2.0\.claude\ui\`:

| File | Description |
|------|-------------|
| `page-step5.tsx` - `page-step5c.tsx` | Activity cards (PR & Commit) |
| `page-step6.tsx` | Build cards |
| `page-step7.tsx` | Environment/Deployment cards |
| `page-step8.tsx` | Simple left-to-right connectors (deprecated) |
| `page-step8b.tsx` | SVG curved connectors (deprecated) |
| `page-step9.tsx` | Single branch column with elbows (wrong direction) |
| `page-step9b.tsx` | Fixed arrow direction |
| `page-step10.tsx` | Clean slate - Scans/Envs blank until populated |
| `page-step11.tsx` | Two columns only, scan status on branch card |
| `page-step12.tsx` | Two-column layout, smaller cards, commit source |
| `page-step13.tsx` | Fix scan display, alerts for no-scan/bypass |
| `page-step14.tsx` | Reorganized legend with scan type labels |
| `page-step15.tsx` | Clickable lines with PR/Commit detail modals |
| `page-step16.tsx` | **FINAL** - Connected to real API |
| `setup-gittest-branches.ps1` | Script to create test branches (not used) |

---

## Current UI Design

### Layout
```
[Repositories] | [Feature Branches] | gap | [Protected Branches]
```

### Components

1. **RepoCard** - Shows repo name, health score, findings count (C/H/M/L)
2. **BranchCard** - Shows:
   - Branch name
   - Health score
   - Default (star) / Protected (shield) indicators
   - Commit source: PR (green), Direct (blue), Bypass (red)
   - Scan status: Scanned (magnifier icon) or Alert (triangle)
   - Scan type icons: SAST, SCA, Secrets, IaC (colored)
   - Findings count

3. **Legend** - Shows all indicators:
   - Health: 80+ (green), 50-79 (amber), <50 (red)
   - Branch: Default (star), Protected (shield)
   - Commit: PR, Direct, Bypass
   - Scan: Scanned, Not Scanned
   - Types: SAST (violet), SCA (orange), Secrets (rose), IaC (sky)

4. **ConnectorLines** (SVG) - Elbow connectors showing merge relationships
   - Green dashed = PR merge
   - Blue solid = Direct commit
   - Red = Bypass
   - Clickable to show PR/Commit detail modal

5. **PRDetailModal** - Shows PR title, author, reviewers, checks, merge info
6. **CommitDetailModal** - Shows SHA, message, author, bypass warning

---

## API Integration

### Endpoints Used
```typescript
const API_BASE = 'http://localhost:3001';

// Repositories - requires projectId
GET /scm/repositories?projectId={projectId}

// Branches - just returns branch names
GET /scm/repositories/{repositoryId}/branches

// Scans - requires projectId
GET /scm/scans?projectId={projectId}&repositoryId={repositoryId}&limit=50

// Findings - requires projectId
GET /scm/findings?projectId={projectId}&repositoryId={repositoryId}&limit=1
```

### Project Context
Uses `useProject` hook from `@/contexts/project-context` to get `currentProject.id`

---

## Key Decisions Made

### 1. Pipeline View Scope Reduction
**Original plan:** Full CI/CD pipeline view (Repos → Branches → Build → Deploy → Environments)

**Problem:** GitHub/ADO pipeline data requires additional OAuth scopes:
- GitHub: `actions:read`
- GitLab: `read_api`  
- Azure DevOps: `vso.build`, `vso.release`

**Current scopes only provide:** `repo`, `read:user`

**Decision:** Show only what current permissions allow:
- Repos ✅
- Branches ✅
- PRs/Commits ✅ (basic info)
- PR checks status ✅
- ThreatDiviner scan results ✅

### 2. Build Column
**Decision:** Show builds only when ThreatDiviner scans run (manual or pipeline-triggered), not GitHub Actions builds.

### 3. Environments Column
**Decision:** Show environments only when:
- CSPM connects and tags an environment
- Pentest targets are run
- Manually configured in Settings

### 4. Branch Classification
- **Protected:** `main`, `master`, `develop`, `development` → Right column
- **Feature:** Everything else → Left column

### 5. Scan Status (not pass/fail)
Scans don't "pass" or "fail" - they produce findings:
- Scan completed → Show findings count
- 0 findings = clean (green check)
- >0 findings = has issues (count shown)

### 6. Alerts Shown For
- No scan on branch (red triangle)
- Bypass/force push to protected branch (red triangle)
- Direct push to protected branch auto-flags as bypass

---

## What's NOT Working / Incomplete

### 1. Merge Relationship Lines
**Problem:** The branches API only returns branch names, not PR/merge relationships.

**What's needed:** A new endpoint to fetch PRs and build the merge graph:
```
GET /scm/repositories/{repositoryId}/pulls
```

This would return PR data including:
- Source branch
- Target branch
- Status (open/merged/closed)
- Reviewers, checks, etc.

**Current state:** Branches show but connector lines don't appear (no merge data).

### 2. PR Detail on Line Click
Lines are clickable but won't show PR details without the merge relationship data.

### 3. Test Data
The Gittest repo setup script ran on wrong repo (threatdiviner instead of Gittest).

---

## Technical Notes

### Branch Data Transform
```typescript
function transformBranches(apiBranches: any[], scans: any[]): Branch[] {
  // Maps branch names to scan data
  // Determines protected vs feature based on naming
  // Returns UI-ready branch objects
}
```

### Health Score Calculation
```typescript
function calculateHealthScore(findings: Finding): number | null {
  // critical=-20, high=-10, medium=-5, low=-2
  // Returns 0-100 score
}
```

### Auto-Bypass Detection
```typescript
// Direct push to protected branch = bypass
const effectiveCommitSource = (isProtected || isDefault) && commitSource === 'direct' 
  ? 'bypass' 
  : commitSource;
```

---

## Future Enhancements

### Phase 2: Full Pipeline View (requires new OAuth scopes)
1. Add `actions:read` scope for GitHub
2. Create `/scm/workflows` endpoint for pipeline runs
3. Add Build column with real CI/CD status

### Phase 3: Environments
1. Create Settings/Environments page
2. Allow manual environment creation (DEV/STG/PROD)
3. Link environments to repos
4. Connect CSPM for runtime security
5. Use environments for SLA priority (PROD > DEV)

### Phase 4: PR Merge Graph
1. Add `/scm/repositories/{id}/pulls` endpoint
2. Fetch merged PRs to build relationship graph
3. Draw connector lines between branches
4. Show PR details on line click

---

## How to Test

1. Start API: `cd apps/api && npm run start:dev` (port 3001)
2. Start Dashboard: `cd apps/dashboard && npm run dev` (port 3000)
3. Navigate to: `http://localhost:3000/dashboard/repos`
4. Select a project with connected repos
5. Click repo to expand branches

---

## Context Files Provided This Session

- `controllers-dump.txt` - All API controllers
- `services-dump.txt` - All services
- `pages-dump.txt` - Dashboard pages
- `components-dump.txt` - UI components
- `schema-dump.txt` - Prisma schema
- `HANDOVER.md` - Previous session handover
- Various screenshots of UI iterations

---

## Summary

Built a Repository Security View that shows repos and branches with security scan status. The main limitation is the lack of PR/merge relationship data from the API, which prevents showing the connector lines between branches. The UI components (modals, cards, legends) are complete and working - just needs the backend endpoint to fetch PR data.

**Next session priority:** Add `/scm/pulls` endpoint to enable merge relationship visualization.
