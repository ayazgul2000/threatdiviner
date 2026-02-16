# CLEANUP INSTRUCTIONS - DO EXACTLY THIS

## TASK 1: Remove Nuclei and Container scanners from repo settings

File: `C:\Dev\threatdiviner-v0.2.0\apps\dashboard\src\app\dashboard\repositories\[id]\settings\page.tsx`

Find and DELETE any lines/blocks that contain:
- `nuclei` (scanner option)
- `container` (scanner option)
- "Nuclei" (label)
- "Container Scan" (label)
- "DAST" (related to Nuclei)
- "Container image" (related to Container scanner)

Keep only these scanners: Semgrep (SAST), Trivy (SCA), Gitleaks (Secrets), Checkov (IaC)

## TASK 2: Add "Repository" link to sidebar navigation

File: Find the sidebar/navigation component (likely in `components/ui/sidebar.tsx` or `components/layout/sidebar.tsx` or similar)

Add a new nav item for "Repository" that links to `/dashboard/repos`

It should appear near other main navigation items like:
- Dashboard
- Findings
- Scans
- Repositories (existing one at /dashboard/repositories)

The new link should be:
- Label: "Repository" 
- URL: "/dashboard/repos"
- Icon: GitBranch (or similar git-related icon)

Place it after the existing "Repositories" link or rename/replace it.

## VERIFICATION

After changes:
1. Check repo settings page no longer shows Nuclei or Container scanner options
2. Check sidebar has "Repository" link that navigates to /dashboard/repos
