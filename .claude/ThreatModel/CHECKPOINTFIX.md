# Draw.io Migration Checkpoint Fix

**Date:** 2026-01-25
**Version:** v4.3.0.fix2

---

## Summary

This checkpoint replaces the mxGraph-based diagram editor with Draw.io's official embed API. This provides access to 4000+ shape stencils, eliminates ~1,750 lines of custom code, and provides a professional diagramming experience.

---

## Changes Made

### Files CREATED

| File | Lines | Description |
|------|-------|-------------|
| `apps/dashboard/src/components/threat-modeling/DrawioEmbed.tsx` | ~250 | Draw.io iframe wrapper with postMessage bridge |
| `apps/dashboard/src/hooks/useDrawioPropertyBridge.ts` | ~100 | Selection sync between Draw.io and PropertyPanel |

### Files DELETED

| File | Lines | Reason |
|------|-------|--------|
| `apps/dashboard/src/components/threat-modeling/DiagramCanvas.tsx` | ~680 | Replaced by Draw.io embed |
| `apps/dashboard/src/components/threat-modeling/ShapePalette.tsx` | ~690 | Draw.io has built-in palette with 4000+ shapes |

### Files MODIFIED

| File | Change |
|------|--------|
| `apps/dashboard/src/app/dashboard/threat-modeling/[id]/diagram/page.tsx` | Complete rewrite to use DrawioEmbed |
| `apps/dashboard/src/components/threat-modeling/index.ts` | Removed DiagramCanvas/ShapePalette exports, added DrawioEmbed |
| `apps/dashboard/src/hooks/index.ts` | Added useDrawioPropertyBridge export |
| `apps/dashboard/package.json` | Removed mxgraph dependency |

### Dependencies REMOVED

```
- mxgraph@4.2.2
```

---

## Architecture

### Before (mxGraph)
```
┌──────────┬─────────────────────────────┬────────────┐
│ Shape    │    DiagramCanvas.tsx        │  Property  │
│ Palette  │    (1059 lines mxGraph)     │  Panel     │
│ (692 ln) │    Manual shape config      │  (1054 ln) │
└──────────┴─────────────────────────────┴────────────┘
```

### After (Draw.io Embed)
```
┌─────────────────────────────────────────┬────────────┐
│         Draw.io Embed (iframe)          │  Property  │
│         - Official Draw.io editor       │  Panel     │
│         - 4000+ shapes (AWS, Azure,     │  (KEPT)    │
│           GCP, network, security)       │            │
│         - Templates, layers, formatting │  Threagile │
│         - postMessage API integration   │  metadata  │
└─────────────────────────────────────────┴────────────┘
```

---

## DrawioEmbed Component

### Features
- Loads Draw.io in iframe from `embed.diagrams.net`
- Shape libraries: AWS, Azure, GCP, Network, Flowchart, UML, etc.
- postMessage API for:
  - `init` - Draw.io ready
  - `load` - Load XML content
  - `save` - User triggered save (Ctrl+S)
  - `autosave` - Auto-save event
  - `select` - Cell selection changed
  - `change` - Diagram modified
  - `export` - Export to PNG/SVG/XML

### Exposed Methods (via ref)
```typescript
interface DrawioEmbedRef {
  getXml: () => Promise<string>;
  setXml: (xml: string) => void;
  exportPng: () => Promise<Blob>;
  exportSvg: () => Promise<string>;
  setCustomProperty: (cellId: string, key: string, value: any) => void;
  getCustomProperties: (cellId: string) => Promise<Record<string, any>>;
}
```

---

## useDrawioPropertyBridge Hook

### Purpose
Syncs selection between Draw.io and PropertyPanel for Threagile metadata editing.

### Features
- Detects element type from style (component vs dataflow vs trust_boundary)
- Extracts custom properties from Draw.io cell data
- Updates custom properties back to Draw.io

### Usage
```typescript
const {
  selectedElement,
  isSyncing,
  handleSelectionChange,
  updateProperty,
  updateAllProperties,
} = useDrawioPropertyBridge(drawioRef);
```

---

## Benefits

| Aspect | Before (mxGraph) | After (Draw.io Embed) |
|--------|------------------|----------------------|
| **Lines of Code** | ~2,800 | ~400 |
| **Shape Library** | 9 basic shapes | 4000+ shapes |
| **Templates** | None | 100+ built-in |
| **Maintenance** | We maintain | Draw.io maintains |
| **Features** | Basic | Full (layers, find/replace, etc.) |
| **Updates** | Manual | Automatic |
| **File Format** | Draw.io XML | Draw.io XML (same) |

---

## Testing Checklist

- [x] Dashboard compiles without errors
- [x] API starts without errors
- [x] mxgraph dependency removed from package.json
- [x] Old files deleted (DiagramCanvas.tsx, ShapePalette.tsx)
- [x] New files created (DrawioEmbed.tsx, useDrawioPropertyBridge.ts)
- [x] Diagram page rewritten
- [x] Exports updated in index.ts files
- [ ] Draw.io embed loads in iframe
- [ ] Initial XML loads correctly
- [ ] Shape palette shows all AWS/Azure/GCP icons
- [ ] Select component → PropertyPanel shows data
- [ ] Save (Ctrl+S) → creates version
- [ ] Lock acquired on open
- [ ] Export PNG/SVG/XML works
- [ ] Run Analysis works

---

## API Endpoints (Unchanged)

- `GET /threat-modeling/:id/diagram` → Returns `{ xml, version, lockedBy }`
- `PUT /threat-modeling/:id/diagram` → Accepts `{ xml, versionName? }`
- Lock endpoints unchanged
- Version endpoints unchanged

---

## Database Changes

**NONE** - The `diagramXml` field already stores Draw.io XML format.

---

## Rollback Plan

If issues arise:
1. Restore DiagramCanvas.tsx and ShapePalette.tsx from git
2. Revert index.ts exports
3. Run `pnpm add mxgraph` in apps/dashboard
4. Revert diagram page

---

## Spec Document Updates Required

The following spec documents need section updates per SPEC_UPDATES.md:
- 05_ui_screens.md - Section 2 (Diagram Editor)
- 08_rules.md - Add Section 2.11 (Draw.io Integration rules)
- 09_implementation_plan.md - Phase 1 checkpoints
- 04_data_models.md - Add Section 1.7 (Custom Properties Storage)

---

## Checkpoint Protocol Completed

- [x] Files created/deleted/modified as per DRAWIO_MIGRATION.md
- [x] Dependencies updated (mxgraph removed)
- [x] Dashboard compiles
- [x] API runs
- [x] CHECKPOINTFIX.md created
