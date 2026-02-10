# Repository Security View - Handover Documentation

## Overview

New repository security visualization feature for ThreatDiviner that provides a tree-based view of repositories, branches, and their security posture with PR merge relationship lines.

## Feature Summary

### Pages Created

| Page | Route | Purpose |
|------|-------|---------|
| Repos List | `/dashboard/repos` | Tree/List view of all repos with branch visualization |
| Repo Detail | `/dashboard/repos/[repoId]` | Single repo with tree view + tabs (Scans, PRs, Settings link) |
| Branch Detail | `/dashboard/repos/[repoId]/branch/[branchId]` | Branch scans, commits, settings with inheritance |
| Scan Detail | `/dashboard/scans/[id]` | Scanner breakdown, findings summary, link to findings list |

### Backend Changes

Added `getPullRequests` endpoint to fetch PR data for merge visualization:

**Files Modified:**
- `apps/api/src/scm/providers/scm-provider.interface.ts` - Interface
- `apps/api/src/scm/providers/github.provider.ts` - GitHub implementation
- `apps/api/src/scm/providers/gitlab.provider.ts` - GitLab implementation  
- `apps/api/src/scm/providers/azure-devops.provider.ts` - Azure DevOps implementation
- `apps/api/src/scm/providers/bitbucket.provider.ts` - Bitbucket implementation
- `apps/api/src/scm/services/scm.service.ts` - Service layer
- `apps/api/src/scm/scm.controller.ts` - REST endpoint

**Endpoint:** `GET /scm/repositories/:id/pulls?state=all&limit=100`

**Response:**
```json
{
  "pulls": [
    {
      "number": 1,
      "title": "Feature PR",
      "state": "merged",
      "htmlUrl": "https://github.com/...",
      "headSha": "abc123",
      "baseBranch": "main",
      "headBranch": "feature/x"
    }
  ]
}
```

## UI Components

### Tree View
- Two-column layout: Feature Branches | Protected Branches
- Connector lines show PR merge relationships (green dashed = PR merge)
- Branch cards show: health score, scan status, commit source icon
- Click branch → Branch detail page

### List View
- Table format: Repo, Health, Branches, Findings, Last Scan
- Click row → Repo detail page

### Branch Settings (Inheritance)
- Shows inherited settings from repo (read-only, grayed out)
- Override toggle to customize for specific branch
- Protected branches can set different PR block severity

## Deployment Commands

```powershell
# 1. Repos list page (with tree/list toggle)
Copy-Item "C:\Dev\threatdiviner-v0.2.0\.claude\ui\page-step18.tsx" `
  "C:\Dev\threatdiviner-v0.2.0\apps\dashboard\src\app\dashboard\repos\page.tsx" -Force

# 2. Repo detail page
New-Item -ItemType Directory -Force `
  -Path "C:\Dev\threatdiviner-v0.2.0\apps\dashboard\src\app\dashboard\repos\[repoId]"
Copy-Item "C:\Dev\threatdiviner-v0.2.0\.claude\ui\repo-detail-page.tsx" `
  "C:\Dev\threatdiviner-v0.2.0\apps\dashboard\src\app\dashboard\repos\[repoId]\page.tsx" -Force

# 3. Branch detail page
New-Item -ItemType Directory -Force `
  -Path "C:\Dev\threatdiviner-v0.2.0\apps\dashboard\src\app\dashboard\repos\[repoId]\branch\[branchId]"
Copy-Item "C:\Dev\threatdiviner-v0.2.0\.claude\ui\branch-detail-page.tsx" `
  "C:\Dev\threatdiviner-v0.2.0\apps\dashboard\src\app\dashboard\repos\[repoId]\branch\[branchId]\page.tsx" -Force

# 4. Scan detail page
Copy-Item "C:\Dev\threatdiviner-v0.2.0\.claude\ui\scan-detail-page.tsx" `
  "C:\Dev\threatdiviner-v0.2.0\apps\dashboard\src\app\dashboard\scans\[id]\page.tsx" -Force
```

## Files in .claude/ui/

| File | Purpose |
|------|---------|
| `page-step18.tsx` | Repos list with tree/list toggle |
| `repo-detail-page.tsx` | Single repo detail |
| `branch-detail-page.tsx` | Branch detail with inheritance settings |
| `scan-detail-page.tsx` | Scan detail with scanner breakdown |
| `CLI-INSTRUCTIONS-ADD-PULLS.md` | Backend API instructions (completed) |
| `CLI-CLEANUP-INSTRUCTIONS.md` | Remove Nuclei/Container, add sidebar nav |

## Pending Tasks

1. **Run CLI cleanup** - Remove Nuclei/Container from settings, add sidebar nav
2. **Test branch commits API** - `/scm/repositories/:id/commits?branch=xxx` may need implementation
3. **Test branch settings API** - `/scm/repositories/:id/settings` may need branch override support

## API Dependencies

The UI expects these endpoints:

| Endpoint | Status |
|----------|--------|
| `GET /scm/repositories` | ✅ Exists |
| `GET /scm/repositories/:id` | ✅ Exists |
| `GET /scm/repositories/:id/branches` | ✅ Exists |
| `GET /scm/repositories/:id/pulls` | ✅ Added this session |
| `GET /scm/repositories/:id/commits` | ⚠️ May need branch filter |
| `GET /scm/repositories/:id/settings` | ⚠️ Check exists |
| `GET /scm/scans/:id` | ⚠️ Check exists |
| `GET /scm/scans?branch=xxx` | ⚠️ Check branch filter works |
| `GET /scm/findings?scanId=xxx` | ✅ Exists |

## Visual Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Repository Security                    [Tree] [List] [Refresh] │
├─────────────────────────────────────────────────────────────────┤
│  REPOSITORIES    │  FEATURE BRANCHES        │  PROTECTED        │
│  ┌────────────┐  │  ┌────────────┐          │  ┌────────────┐   │
│  │ Gittest    │  │  │ feature/x  │──PR#1───▶│  │ main ⭐🛡️  │   │
│  │ 78%        │  │  │ 65% 🔍📦   │          │  │ 85% 🔍📦🔑  │   │
│  └────────────┘  │  └────────────┘          │  └────────────┘   │
│                  │  ┌────────────┐          │                   │
│  ┌────────────┐  │  │ bugfix/y   │──────────┘                   │
│  │ timeslice  │  │  │ N/A ⚠️     │                              │
│  │ 100%       │  │  └────────────┘                              │
│  └────────────┘  │                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Legend

- ⭐ Default branch
- 🛡️ Protected branch  
- 🔍 SAST scan
- 📦 SCA scan
- 🔑 Secrets scan
- ☁️ IaC scan
- ⚠️ Not scanned / Alert
- Green dashed line = PR merge
- Blue solid line = Direct push
- Red line = Bypass/Force push
