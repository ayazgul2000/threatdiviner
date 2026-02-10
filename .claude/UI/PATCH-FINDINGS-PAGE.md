# Patch Findings Page to Support scanId Filter

**File:** `apps/dashboard/src/app/dashboard/findings/page.tsx`

## Change 1: Add import for useSearchParams

Find:
```typescript
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
```

Replace with:
```typescript
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
```

## Change 2: Read scanId from URL params and add scan/repo state

Find:
```typescript
export default function FindingsPage() {
  const { currentProject } = useProject();
  const [findings, setFindings] = useState<Finding[]>([]);
```

Replace with:
```typescript
export default function FindingsPage() {
  const { currentProject } = useProject();
  const searchParams = useSearchParams();
  const scanIdParam = searchParams.get('scanId');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanInfo, setScanInfo] = useState<{ repoName: string; branch: string } | null>(null);
```

## Change 3: Pass scanId to API call and fetch scan info

Find:
```typescript
      const filterParams: Record<string, string> = {};
      if (filters.severity) filterParams.severity = filters.severity;
      if (filters.status) filterParams.status = filters.status;

      const data = await findingsApi.list({ ...filterParams, projectId: currentProject.id });
```

Replace with:
```typescript
      const filterParams: Record<string, string> = {};
      if (filters.severity) filterParams.severity = filters.severity;
      if (filters.status) filterParams.status = filters.status;
      if (scanIdParam) filterParams.scanId = scanIdParam;

      const data = await findingsApi.list({ ...filterParams, projectId: currentProject.id });
      
      // Fetch scan info if filtering by scanId
      if (scanIdParam) {
        try {
          const scanRes = await fetch(`${API_URL}/scm/scans/${scanIdParam}`, { credentials: 'include' });
          if (scanRes.ok) {
            const scanData = await scanRes.json();
            const scan = scanData.scan || scanData;
            if (scan.repositoryId) {
              const repoRes = await fetch(`${API_URL}/scm/repositories/${scan.repositoryId}`, { credentials: 'include' });
              if (repoRes.ok) {
                const repoData = await repoRes.json();
                const repo = repoData.repository || repoData;
                setScanInfo({ repoName: repo.fullName || repo.name, branch: scan.branch || 'main' });
              }
            }
          }
        } catch (e) { /* ignore */ }
      } else {
        setScanInfo(null);
      }
```

## Change 4: Add scanIdParam to useEffect dependencies

Find:
```typescript
  useEffect(() => {
    fetchFindings();
  }, [filters.severity, filters.status, currentProject]);
```

Replace with:
```typescript
  useEffect(() => {
    fetchFindings();
  }, [filters.severity, filters.status, currentProject, scanIdParam]);
```

## Change 5: Add computed counts for open/closed

Add after the `availableScanners` useMemo:
```typescript
  // Calculate open/closed counts
  const findingCounts = useMemo(() => {
    const open = filteredFindings.filter(f => f.status === 'open').length;
    const closed = filteredFindings.filter(f => ['fixed', 'ignored', 'false_positive'].includes(f.status)).length;
    return { open, closed, total: filteredFindings.length };
  }, [filteredFindings]);
```

## Change 6: Update PageHeader to show scan context and counts

Find the PageHeader component usage and replace with:
```typescript
<PageHeader
  title={scanInfo ? `Findings for ${scanInfo.repoName}` : 'Findings'}
  description={
    scanInfo 
      ? `Branch: ${scanInfo.branch} • ${findingCounts.open} open, ${findingCounts.closed} resolved`
      : `${findingCounts.open} open, ${findingCounts.closed} resolved of ${findingCounts.total} total`
  }
/>

{scanIdParam && (
  <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
    <span>Scan:</span>
    <code className="bg-gray-100 px-2 py-0.5 rounded font-mono">{scanIdParam.substring(0, 8)}...</code>
    <Link href="/dashboard/findings" className="text-indigo-600 hover:underline ml-2">
      ← View all findings
    </Link>
  </div>
)}
```
