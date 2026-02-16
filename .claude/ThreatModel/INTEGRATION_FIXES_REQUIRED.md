# ThreatDiviner Integration Fixes Required

## Executive Summary

**Root Cause:** Components and services were built in isolation but never integrated into their parent pages. The CLI created new files without modifying existing pages to use them.

**Severity:** P0 CRITICAL - The visual editor (Phase 1) is completely non-functional despite components existing.

---

## Architecture Context (From 10_gap_analysis.md)

The specification explicitly states to **ENHANCE existing code, not replace it**:

> "ThreatDiviner **already has a substantial threat modeling implementation**. Our new specification enhances and extends these capabilities rather than replacing them."

### What Already Exists and MUST BE KEPT

| Layer | Existing | Status |
|-------|----------|--------|
| **Database** | `ThreatModel`, `ThreatModelComponent`, `ThreatModelDataFlow`, `Threat`, `ThreatMitigation` | ✅ KEEP |
| **Database** | `DiagramVersion`, `ThreatModelLock`, `AnalysisRun` | ✅ KEEP (added in Phase 0) |
| **API** | `ThreatModelingService` - full CRUD for models, components, threats | ✅ KEEP |
| **API** | Lock endpoints (GET/POST/DELETE `/lock`) | ✅ KEEP |
| **API** | Version endpoints (GET/POST `/versions`) | ✅ KEEP |
| **UI** | `/dashboard/threat-modeling/page.tsx` - model list | ✅ KEEP |
| **UI** | `/dashboard/threat-modeling/[id]/page.tsx` - model detail with tabs | ✅ KEEP |
| **UI** | `/dashboard/threat-modeling/new/page.tsx` - create model | ✅ KEEP |

### What Was Built But NOT INTEGRATED

| Component | File | Status |
|-----------|------|--------|
| `DiagramCanvas` | `components/threat-modeling/DiagramCanvas.tsx` | ⚠️ EXISTS, NOT USED |
| `ShapePalette` | `components/threat-modeling/ShapePalette.tsx` | ⚠️ EXISTS, NOT USED |
| `PropertyPanel` | `components/threat-modeling/PropertyPanel.tsx` | ⚠️ EXISTS, NOT USED |
| `LockManager` | `components/threat-modeling/LockManager.tsx` | ⚠️ EXISTS, NOT USED |
| `VersionManager` | `components/threat-modeling/VersionManager.tsx` | ⚠️ EXISTS, NOT USED |

### What's Currently Broken

| Page | Current State | Expected State |
|------|---------------|----------------|
| `/threat-modeling/[id]/diagram` | Old Mermaid.js viewer (READ-ONLY) | mxGraph editor with palette, properties, save |

---

## FIX #1: Rewrite Diagram Editor Page [P0 CRITICAL]

### Current State
```
apps/dashboard/src/app/dashboard/threat-modeling/[id]/diagram/page.tsx
- Uses Mermaid.js for READ-ONLY rendering
- Fetches `/diagram` endpoint which returns Mermaid string
- No editing capability
- No locking, no versioning, no property panel
```

### Required State (per 05_ui_screens.md §2)
```
┌────────────────────────────────────────────────────────────────────────────┐
│  [← Back] Model Name                   [Save] [▶ Run Analysis] [⋮ More]   │
├────────┬───────────────────────────────────────────────────────────┬───────┤
│        │                                                           │       │
│ SHAPES │                      CANVAS                               │ PROPS │
│ (250px)│                    (mxGraph)                              │(300px)│
│        │                                                           │       │
├────────┴───────────────────────────────────────────────────────────┴───────┤
│ LockManager | VersionManager                                               │
└────────────────────────────────────────────────────────────────────────────┘
```

### Fix Instructions

**Replace entire file** `apps/dashboard/src/app/dashboard/threat-modeling/[id]/diagram/page.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, useToast } from '@/components/ui';
import {
  DiagramCanvas,
  ShapePalette,
  PropertyPanel,
  LockManager,
  useLockManager,
  VersionManager,
  useVersionManager,
  GapFillDialog,
  AnalysisProgressModal,
} from '@/components/threat-modeling';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useGapDetection } from '@/hooks/useGapDetection';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DiagramEditorPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const modelId = params.id as string;

  // State
  const [model, setModel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [diagramXml, setDiagramXml] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Hooks
  const { lockInfo, acquireLock, releaseLock, isLocked, isLockedByMe } = useLockManager(modelId);
  const { versions, currentVersion, loadVersion, saveVersion } = useVersionManager(modelId);
  const { runAnalysis, analysisProgress, isAnalyzing } = useAnalysis(modelId);
  const { gaps, checkGaps } = useGapDetection(modelId);

  // Load model and diagram
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/threat-modeling/${modelId}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch model');
        const data = await res.json();
        setModel(data);
        setDiagramXml(data.diagramXml || '');
      } catch (err) {
        console.error(err);
        toast.error('Error', 'Failed to load threat model');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [modelId]);

  // Acquire lock on mount
  useEffect(() => {
    acquireLock();
    return () => {
      releaseLock();
    };
  }, []);

  // Handle diagram changes
  const handleDiagramChange = useCallback((xml: string) => {
    setDiagramXml(xml);
    setHasUnsavedChanges(true);
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!isLockedByMe) {
      toast.error('Cannot Save', 'You do not have the edit lock');
      return;
    }
    try {
      await saveVersion(diagramXml);
      setHasUnsavedChanges(false);
      toast.success('Saved', 'Diagram saved successfully');
    } catch (err) {
      toast.error('Save Failed', 'Could not save diagram');
    }
  }, [diagramXml, isLockedByMe, saveVersion]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Handle element selection
  const handleSelectElement = useCallback((element: any) => {
    setSelectedElement(element);
  }, []);

  // Handle property changes
  const handlePropertyChange = useCallback((updates: any) => {
    // Update element in diagram
    // DiagramCanvas will handle this via ref
  }, []);

  // Handle run analysis
  const handleRunAnalysis = useCallback(async () => {
    const detectedGaps = await checkGaps();
    if (detectedGaps.length > 0) {
      // Show gap fill dialog
      return;
    }
    await runAnalysis();
  }, [checkGaps, runAnalysis]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const isViewOnly = isLocked && !isLockedByMe;

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="h-14 border-b flex items-center justify-between px-4 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/threat-modeling/${modelId}`}>
            <Button variant="ghost" size="sm">← Back</Button>
          </Link>
          <h1 className="text-lg font-semibold">{model?.name}</h1>
          {hasUnsavedChanges && (
            <span className="text-sm text-amber-600">• Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleSave}
            disabled={isViewOnly || !hasUnsavedChanges}
          >
            Save
          </Button>
          <Button
            onClick={handleRunAnalysis}
            disabled={isViewOnly || isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing...' : '▶ Run Analysis'}
          </Button>
        </div>
      </div>

      {/* Lock Banner */}
      {isViewOnly && lockInfo && (
        <div className="bg-amber-100 dark:bg-amber-900/30 px-4 py-2 text-amber-800 dark:text-amber-200">
          This model is being edited by {lockInfo.lockedByName || 'another user'}. View-only mode.
        </div>
      )}

      {/* Main Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Shape Palette - Left */}
        <div className="w-64 border-r overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <ShapePalette
            disabled={isViewOnly}
            onDragStart={(shape) => {
              // Handle drag start for mxGraph
            }}
          />
        </div>

        {/* Canvas - Center */}
        <div className="flex-1 relative">
          <DiagramCanvas
            xml={diagramXml}
            onChange={handleDiagramChange}
            onSelect={handleSelectElement}
            readOnly={isViewOnly}
          />
        </div>

        {/* Property Panel - Right */}
        <div className="w-80 border-l overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <PropertyPanel
            element={selectedElement}
            onChange={handlePropertyChange}
            disabled={isViewOnly}
          />
        </div>
      </div>

      {/* Footer with Lock/Version info */}
      <div className="h-10 border-t flex items-center justify-between px-4 bg-gray-50 dark:bg-gray-900 text-sm">
        <LockManager lockInfo={lockInfo} />
        <VersionManager
          versions={versions}
          currentVersion={currentVersion}
          onLoadVersion={loadVersion}
        />
      </div>

      {/* Gap Fill Dialog */}
      <GapFillDialog
        gaps={gaps}
        onComplete={() => runAnalysis()}
      />

      {/* Analysis Progress Modal */}
      <AnalysisProgressModal
        progress={analysisProgress}
        isOpen={isAnalyzing}
      />
    </div>
  );
}
```

---

## FIX #2: Add/Modify API Endpoints [P1 HIGH]

### Current Problem
The `GET /threat-modeling/:id/diagram` endpoint returns **Mermaid string** for the old viewer:
```typescript
// CURRENT - returns Mermaid
@Get(':id/diagram')
async getDiagram(...) {
  const mermaid = await this.diagramService.generateMermaidDiagram(id);
  return { mermaid };
}
```

### Required State (per 05_ui_screens.md §2.5)
```typescript
// GET /threat-modeling/:id/diagram should return XML
Response: { xml: string, version: number, lockedBy?: User }

// PUT /threat-modeling/:id/diagram should save XML
Body: { xml: string, versionName?: string }
Response: { version: DiagramVersion }
```

### Fix Instructions

**Modify** `apps/api/src/threat-modeling/threat-modeling.controller.ts`:

```typescript
// REPLACE the existing @Get(':id/diagram') endpoint:

@Get(':id/diagram')
async getDiagram(@Req() req: AuthRequest, @Param('id') id: string) {
  const model = await this.service.getThreatModel(req.user.tenantId, id);
  const lock = await this.service.getLock(req.user.tenantId, id);
  
  // Get latest version number
  const versions = await this.service.listVersions(req.user.tenantId, id, 1);
  const latestVersion = versions[0]?.versionNumber || 0;
  
  return {
    xml: model.diagramXml || '',
    version: latestVersion,
    lockedBy: lock ? {
      id: lock.lockedBy,
      name: lock.lockedByName,
      expiresAt: lock.expiresAt,
    } : null,
  };
}

// ADD new PUT endpoint:

@Put(':id/diagram')
async saveDiagram(
  @Req() req: AuthRequest,
  @Param('id') id: string,
  @Body() body: { xml: string; versionName?: string },
) {
  // Check lock ownership
  const lock = await this.service.getLock(req.user.tenantId, id);
  if (!lock || lock.lockedBy !== req.user.id) {
    throw new ForbiddenException('You must hold the lock to save');
  }
  
  // Create version and update model
  const version = await this.service.createVersion(
    req.user.tenantId,
    id,
    req.user.id,
    body.xml,
    false, // not auto-save
    body.versionName,
  );
  
  return { version };
}
```

### Keep Mermaid Endpoint (for backward compatibility)

If other parts of the system use Mermaid, add a separate endpoint:

```typescript
@Get(':id/diagram/mermaid')
async getMermaidDiagram(@Req() req: AuthRequest, @Param('id') id: string) {
  const mermaid = await this.diagramService.generateMermaidDiagram(id, req.user.tenantId);
  return { mermaid };
}
```

---

## FIX #3: Verify Admin Console Pages Load [P1 HIGH]

### Verification Required

The admin pages exist but were never browser-tested. Each page must be verified to:
1. Load without JavaScript errors
2. Fetch data from API successfully
3. Display CRUD operations

### Pages to Verify

| Route | File | API Endpoint |
|-------|------|--------------|
| `/admin/shape-mappings` | `apps/admin/.../shape-mappings/page.tsx` | `GET /admin/shape-mappings` |
| `/admin/canonical-risks` | `apps/admin/.../canonical-risks/page.tsx` | `GET /admin/canonical-risks` |
| `/admin/compliance-frameworks` | `apps/admin/.../compliance-frameworks/page.tsx` | `GET /admin/compliance-frameworks` |
| `/admin/playbooks` | `apps/admin/.../playbooks/page.tsx` | `GET /admin/playbooks` |
| `/admin/wizard` | `apps/admin/.../wizard/page.tsx` | `GET /admin/wizard` |
| `/admin/feeds` | `apps/admin/.../feeds/page.tsx` | `GET /admin/feeds` |

### Verification Steps

```bash
# 1. Start API
cd apps/api && npm run start:dev

# 2. Start Admin
cd apps/admin && npm run dev

# 3. Open browser to http://localhost:3002/admin
# 4. Click each menu item
# 5. Check console for errors
# 6. Verify data loads (may be empty, that's OK)
```

---

## FIX #4: Verify Threagile Analysis Flow [P2 MEDIUM]

### Components to Verify

1. **ThreagileService** - Docker container runs
2. **YamlGeneratorService** - Generates valid YAML from components
3. **Analysis Queue** - BullMQ processes jobs
4. **WebSocket Progress** - Client receives updates
5. **Risk Parsing** - Results create Threat records

### Verification Steps

```bash
# 1. Ensure Threagile container is running
docker ps | grep threagile

# 2. Check health endpoint
curl http://localhost:3001/api/threat-modeling/threagile/health

# 3. Create a test threat model with components
# 4. Click "Run Analysis"
# 5. Watch for:
#    - Progress modal appears
#    - Stages update (validating → generating → running → complete)
#    - Risks populate in the Threats tab
```

---

## FIX #5: Working Features (NO FIX NEEDED)

These features are confirmed working:

| Feature | Status | Evidence |
|---------|--------|----------|
| ComplianceTab | ✅ Working | Imported and rendered in `[id]/page.tsx` |
| Compliance Reports | ✅ Working | Export modal functional |
| Model CRUD | ✅ Working | List, create, edit, delete all work |
| Component CRUD | ✅ Working | Tabs in detail page functional |
| Lock API | ✅ Working | Endpoints exist and tested |
| Version API | ✅ Working | Endpoints exist and tested |

---

## Migration Notes

### Database
- **NO CHANGES NEEDED** - Schema already has `diagramXml`, `DiagramVersion`, `ThreatModelLock`
- All existing data is preserved

### API
- **MODIFY** `GET /diagram` to return XML instead of Mermaid
- **ADD** `PUT /diagram` for saving
- **OPTIONAL** Add `GET /diagram/mermaid` for backward compatibility

### Frontend
- **REPLACE** `diagram/page.tsx` with mxGraph editor
- **KEEP** all other pages unchanged
- **KEEP** all existing components in use

---

## Implementation Order

| Priority | Fix | Effort | Dependencies |
|----------|-----|--------|--------------|
| P0 | #1 Rewrite diagram/page.tsx | 2-3 hours | None |
| P1 | #2 Modify API endpoints | 1 hour | None |
| P1 | #3 Verify admin pages | 1 hour | API running |
| P2 | #4 Verify Threagile flow | 1 hour | Docker, #1, #2 |

**Total Estimated Effort:** 5-6 hours

---

## Prevention: Updated Review Checklist

For every future checkpoint, reviewer MUST verify:

```markdown
### Integration Verification Checklist

#### File Integration
- [ ] New component is IMPORTED in parent page (check import statements)
- [ ] New component is RENDERED in JSX (check return statement)
- [ ] Export statement exists in index.ts

#### Runtime Verification  
- [ ] Route is accessible in browser (no 404)
- [ ] Page loads without console errors
- [ ] API endpoints respond (test with curl)
- [ ] Feature works end-to-end (manual test)

#### Spec Compliance
- [ ] Layout matches spec wireframe
- [ ] All required props are passed
- [ ] States and behaviors match spec
```

---

## Files Reference

### Must Modify
- `apps/dashboard/src/app/dashboard/threat-modeling/[id]/diagram/page.tsx` - REWRITE
- `apps/api/src/threat-modeling/threat-modeling.controller.ts` - ADD/MODIFY endpoints

### Must Verify (No Changes Expected)
- `apps/admin/src/app/(dashboard)/*/page.tsx` - All admin pages
- `apps/api/src/threat-modeling/services/threagile.service.ts` - Analysis flow

### Confirmed Working (No Changes)
- `apps/dashboard/src/app/dashboard/threat-modeling/[id]/page.tsx` - Detail page
- `apps/dashboard/src/components/compliance/*` - All compliance components
- `apps/dashboard/src/components/threat-modeling/*` - All editor components (just need integration)
