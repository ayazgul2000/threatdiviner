# SDD Document Updates for Draw.io Migration

This document contains the specific sections to UPDATE in the specification documents.

---

## 05_ui_screens.md Updates

### REPLACE Section 2.1 Layout

**OLD:**
```
## 2. Diagram Editor View

### 2.1 Layout

┌────────────────────────────────────────────────────────────────────────────┐
│  [← Back] Production API Architecture    [Save] [▶ Run Analysis] [⋮ More] │
├────────┬───────────────────────────────────────────────────────────┬───────┤
│        │                                                           │       │
│ SHAPES │                                                           │ PROPS │
│ ────── │                      CANVAS                               │ ───── │
│ 🔍 [...│                                                           │ Name  │
│        │                                                           │ [...] │
│ ▼ AWS  │    ┌─────────┐         ┌─────────┐                       │       │
│  EC2   │    │ Browser │─────────│   ALB   │                       │ Tech  │
│  RDS   │    └─────────┘         └────┬────┘                       │ [▼..] │
...
```

**NEW:**
```markdown
## 2. Diagram Editor View

### 2.1 Layout

The diagram editor uses Draw.io's official embed API, providing access to 4000+ shape stencils (AWS, Azure, GCP, network, security, etc.) with a professional diagramming experience.

┌────────────────────────────────────────────────────────────────────────────┐
│  [← Back] Production API Architecture    [Save] [▶ Run Analysis] [⋮ More] │
├─────────────────────────────────────────────────────────────────────┬──────┤
│                                                                      │      │
│                      DRAW.IO EMBED (iframe)                         │PROPS │
│                                                                      │───── │
│  ┌─────────────────────────────────────────────────────────────┐   │ Name │
│  │                                                              │   │[...] │
│  │   Full Draw.io editor with:                                 │   │      │
│  │   - Built-in shape palette (AWS, Azure, GCP, etc.)          │   │ Tech │
│  │   - Templates library                                        │   │[▼..] │
│  │   - Layers, find/replace, formatting                        │   │      │
│  │   - Standard Draw.io toolbar and menus                      │   │ Auth │
│  │                                                              │   │[▼..] │
│  │         ◄── postMessage API ──►                             │   │      │
│  │                                                              │   │[Save]│
│  └─────────────────────────────────────────────────────────────┘   │      │
│                                                                      │      │
├─────────────────────────────────────────────────────────────────────┴──────┤
│ 🔒 Locked by you | Version: v3 (Jan 25, 2026 10:30 AM) [▼ History]        │
└────────────────────────────────────────────────────────────────────────────┘

**Key Features:**
- Draw.io provides the full diagramming experience (shapes, templates, formatting)
- Our PropertyPanel (right sidebar) handles Threagile-specific metadata
- Selection in Draw.io syncs to PropertyPanel via postMessage API
- Custom properties stored in Draw.io XML format (native support)
```

### REPLACE Section 2.2 Components

**OLD:**
```markdown
### 2.2 Components

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `EditorPage` | `pages/editor/[id].tsx` | `modelId` | Page container with layout |
| `DiagramCanvas` | `components/editor/DiagramCanvas.tsx` | `xml`, `onChange`, `onSelect` | mxGraph wrapper |
| `ShapePalette` | `components/editor/ShapePalette.tsx` | `categories`, `onDragStart` | Left sidebar shapes |
...
```

**NEW:**
```markdown
### 2.2 Components

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `DiagramEditorPage` | `app/dashboard/threat-modeling/[id]/diagram/page.tsx` | - | Page container with layout |
| `DrawioEmbed` | `components/threat-modeling/DrawioEmbed.tsx` | `initialXml`, `onXmlChange`, `onSelectionChange`, `readOnly` | Draw.io iframe wrapper with postMessage bridge |
| `PropertyPanel` | `components/threat-modeling/PropertyPanel.tsx` | `selectedType`, `selectedData`, `onUpdate` | Right sidebar Threagile metadata form |
| `LockManager` | `components/threat-modeling/LockManager.tsx` | `lockInfo` | Lock status display |
| `VersionManager` | `components/threat-modeling/VersionManager.tsx` | `versions`, `onLoadVersion` | Version history dropdown |
| `GapFillDialog` | `components/threat-modeling/GapFillDialog.tsx` | `gaps`, `onComplete` | Missing fields prompt |
| `AnalysisProgressModal` | `components/threat-modeling/AnalysisProgressModal.tsx` | `analysisRunId`, `isOpen` | Analysis progress display |

**Hooks:**
| Hook | File | Purpose |
|------|------|---------|
| `useDrawioPropertyBridge` | `hooks/useDrawioPropertyBridge.ts` | Sync selection between Draw.io and PropertyPanel |
| `useLockManager` | `components/threat-modeling/LockManager.tsx` | Lock acquisition and refresh |
| `useVersionManager` | `components/threat-modeling/VersionManager.tsx` | Version history management |
| `useAnalysis` | `hooks/useAnalysis.ts` | Threagile analysis trigger |
| `useGapDetection` | `hooks/useGapDetection.ts` | Pre-analysis gap detection |
```

### REPLACE Section 2.3 States & Behavior (Canvas row)

**OLD:**
```markdown
| **Canvas** | `loading`, `idle`, `dragging`, `connecting`, `selecting`, `panning` | mxGraph events → state updates; auto-save debounce 60s | Min 1 asset before analysis | Fallback to blank on corrupt XML; toast on render fail |
```

**NEW:**
```markdown
| **Draw.io Embed** | `loading`, `ready`, `editing` | Draw.io handles all internal states; postMessage for selection sync; auto-save via Draw.io's autosave event | Min 1 asset before analysis | Draw.io shows error internally; fallback to empty diagram |
```

### DELETE Section 3 (Shape Palette)

Remove entire section 3 "Shape Palette" (§3.1 through §3.4) — Draw.io provides built-in palette.

### KEEP Section 4 (Property Panel)

No changes — PropertyPanel handles Threagile metadata (technology, encryption, authentication, etc.)

---

## 08_rules.md Updates

### ADD New Rule in Section 2 (Architecture Rules)

```markdown
### 2.11 Draw.io Integration

**R2.11.1** The diagram editor MUST use Draw.io's official embed API (https://embed.diagrams.net), not a custom mxGraph implementation.

**R2.11.2** Custom Threagile properties (technology, encryption, authentication, etc.) MUST be stored in Draw.io's native custom properties format within the mxCell XML elements.

**R2.11.3** Communication between our application and the Draw.io iframe MUST use the postMessage API with proper origin validation.

**R2.11.4** The PropertyPanel component MUST remain separate from Draw.io, synced via selection events, to provide Threagile-specific metadata editing.

**R2.11.5** Draw.io XML format MUST be preserved exactly — no transformation or custom serialization.
```

---

## 09_implementation_plan.md Updates

### REPLACE Phase 1 Header and Description

**OLD:**
```markdown
## Phase 1: Enhanced Editor

**Duration:** 1.5 weeks  
**Goal:** Enhance existing diagram page with mxGraph canvas, shape palette, and property panel  
**Checkpoints:** v1.1.0, v1.2.0, v1.3.0, v1.4.0, v1.5.0

**Uses Existing:**
- `apps/dashboard/src/app/dashboard/threat-modeling/[id]/diagram/page.tsx`
- `apps/api/src/threat-modeling/services/diagram.service.ts`
- `ThreatModelComponent`, `ThreatModelDataFlow` Prisma models
```

**NEW:**
```markdown
## Phase 1: Draw.io Editor Integration

**Duration:** 1 week  
**Goal:** Integrate Draw.io embed with PropertyPanel for Threagile metadata  
**Checkpoints:** v1.1.0, v1.2.0, v1.3.0

**Uses Existing:**
- `apps/dashboard/src/app/dashboard/threat-modeling/[id]/diagram/page.tsx`
- `apps/api/src/threat-modeling/services/diagram.service.ts`
- `ThreatModelComponent`, `ThreatModelDataFlow` Prisma models
- Draw.io embed API (external service)
```

### REPLACE Checkpoint v1.1.0

**OLD:**
```markdown
### Checkpoint v1.1.0: DiagramCanvas Component

**Deliverable:** mxGraph canvas renders and loads existing data

| Task | Description | Output |
|------|-------------|--------|
| 1.1.1 | Install mxGraph | `pnpm add mxgraph` in dashboard |
| 1.1.2 | Create `DiagramCanvas` component | React wrapper for mxGraph |
| 1.1.3 | Initialize canvas | Infinite scroll, grid snap, zoom |
| 1.1.4 | Render existing components | Load `ThreatModelComponent` as nodes |
| 1.1.5 | Render existing dataflows | Load `ThreatModelDataFlow` as edges |
| 1.1.6 | Selection handling | Single/multi-select with shift |
| 1.1.7 | Undo/Redo stack | Ctrl+Z, Ctrl+Shift+Z |
| 1.1.8 | XML serialization | Convert graph ↔ Draw.io XML |

**STOP: After canvas renders with existing data, checkpoint v1.1.0**
```

**NEW:**
```markdown
### Checkpoint v1.1.0: Draw.io Embed Component

**Deliverable:** Draw.io iframe loads and displays existing diagram XML

| Task | Description | Output |
|------|-------------|--------|
| 1.1.1 | Create `DrawioEmbed` component | React component with iframe |
| 1.1.2 | Configure embed URL | Enable required shape libraries (AWS, Azure, GCP) |
| 1.1.3 | Implement postMessage bridge | Handle init, load, save, select events |
| 1.1.4 | Load initial XML | Pass `diagramXml` from threat model |
| 1.1.5 | Handle XML changes | Capture autosave and change events |
| 1.1.6 | Export methods via ref | `getXml`, `setXml`, `exportPng`, `exportSvg` |

**STOP: After Draw.io loads with existing diagram, checkpoint v1.1.0**
```

### REPLACE Checkpoint v1.2.0

**OLD:**
```markdown
### Checkpoint v1.2.0: ShapePalette Component

**Deliverable:** Shape palette loads from API and supports drag-drop

| Task | Description | Output |
|------|-------------|--------|
| 1.2.1 | Create `ShapePalette` component | Collapsible categories |
| 1.2.2 | Load shapes from API | `GET /api/admin/shape-mappings` |
| 1.2.3 | Shape search | Filter across categories |
| 1.2.4 | Drag-drop to canvas | mxGraph drag source |
| 1.2.5 | Shape tooltips | Technology type on hover |
| 1.2.6 | Recent shapes | localStorage tracking |
| 1.2.7 | Empty state | "No shapes configured" message |

**STOP: After palette renders (empty OK), checkpoint v1.2.0**
```

**NEW:**
```markdown
### Checkpoint v1.2.0: Property Bridge Hook

**Deliverable:** Selection in Draw.io syncs to PropertyPanel

| Task | Description | Output |
|------|-------------|--------|
| 1.2.1 | Create `useDrawioPropertyBridge` hook | Selection state management |
| 1.2.2 | Parse cell type from style | Detect component vs dataflow vs boundary |
| 1.2.3 | Extract custom properties | Read Threagile metadata from XML |
| 1.2.4 | Update custom properties | Write changes back via postMessage |
| 1.2.5 | Integrate with PropertyPanel | Pass `selectedElement` to panel |

**STOP: After selection syncs to PropertyPanel, checkpoint v1.2.0**
```

### REPLACE Checkpoint v1.3.0

**OLD:**
```markdown
### Checkpoint v1.3.0: PropertyPanel Component

**Deliverable:** Property panel shows form for selected node and saves

| Task | Description | Output |
|------|-------------|--------|
| 1.3.1 | Create `PropertyPanel` component | Context-aware form |
...
```

**NEW:**
```markdown
### Checkpoint v1.3.0: Full Editor Integration

**Deliverable:** Complete editor page with Draw.io, PropertyPanel, lock, and version management

| Task | Description | Output |
|------|-------------|--------|
| 1.3.1 | Rewrite diagram page | Integrate DrawioEmbed + PropertyPanel |
| 1.3.2 | Add lock integration | Use existing `useLockManager` |
| 1.3.3 | Add version integration | Use existing `useVersionManager` |
| 1.3.4 | Add analysis integration | Use existing `useAnalysis` |
| 1.3.5 | Implement save flow | Ctrl+S → create version |
| 1.3.6 | Implement export | PNG, SVG, XML export options |
| 1.3.7 | Add keyboard shortcuts | Save, undo (handled by Draw.io) |

**STOP: After full editor works end-to-end, checkpoint v1.3.0**
```

### DELETE Checkpoints v1.4.0 and v1.5.0

Remove these checkpoints — functionality covered in v1.3.0 or handled by Draw.io:
- v1.4.0 (Save & Versioning) — merged into v1.3.0
- v1.5.0 (Locking) — merged into v1.3.0

### REPLACE Phase 1 Exit Criteria

**OLD:**
```markdown
### Exit Criteria
- [ ] Can drag shapes from palette to canvas
- [ ] Can edit properties and save
- [ ] Version history working
- [ ] Locking prevents concurrent edits
- [ ] Existing ThreatModelComponent data renders correctly
```

**NEW:**
```markdown
### Exit Criteria
- [ ] Draw.io embed loads with all shape libraries (AWS, Azure, GCP, etc.)
- [ ] Can drag shapes from Draw.io's built-in palette
- [ ] Selection syncs to PropertyPanel
- [ ] PropertyPanel edits sync back to Draw.io XML
- [ ] Save creates version with XML content
- [ ] Locking prevents concurrent edits
- [ ] Export works (PNG, SVG, XML)
- [ ] Existing diagramXml loads correctly
```

### REPLACE Phase 1 Acceptance Tests

**OLD:**
```gherkin
Feature: Enhanced Diagram Editor

Scenario: Load Existing Model
  Given a threat model exists with components
  When I open the diagram page
  Then components render as nodes
  And dataflows render as edges
  And positions match stored values

Scenario: Add Shape from Palette
  Given I am in the editor
  When I drag an EC2 shape from palette
  And I drop it on the canvas
  Then a node appears at drop position
  And property panel shows EC2 defaults
  And a ThreatModelComponent is created
...
```

**NEW:**
```gherkin
Feature: Draw.io Diagram Editor

Scenario: Load Existing Model
  Given a threat model exists with diagramXml
  When I open the diagram page
  Then Draw.io iframe loads
  And diagram renders from XML
  And all shapes are visible

Scenario: Add Shape from Draw.io Palette
  Given I am in the editor
  When I open Draw.io's shape panel
  And I drag an AWS EC2 shape to canvas
  Then the shape appears on canvas
  When I click the shape
  Then PropertyPanel shows for selection
  And I can set Threagile metadata

Scenario: Edit Threagile Properties
  Given I have selected a component
  When I change technology to "database" in PropertyPanel
  And I click Apply
  Then the custom property is saved to Draw.io XML
  And the change indicator shows unsaved

Scenario: Save Version
  Given I have made changes
  When I press Ctrl+S
  Then Draw.io XML is saved to DiagramVersion
  And version appears in dropdown
  And unsaved indicator clears

Scenario: Locking
  Given User A is editing model X
  When User B opens model X
  Then User B sees lock banner
  And Draw.io is in read-only mode
```

### REPLACE Phase 1 Checkpoint Output

**OLD:**
```markdown
### Checkpoint Output
## Phase 1 Checkpoint

### Components Implemented
- [x] DiagramCanvas (mxGraph wrapper)
- [x] ShapePalette (5 categories, 52 shapes)
- [x] PropertyPanel (asset, dataflow, boundary forms)
- [x] Version dropdown
- [x] Lock banner
...
```

**NEW:**
```markdown
### Checkpoint Output
## Phase 1 Checkpoint

### Components Implemented
- [x] DrawioEmbed (iframe wrapper with postMessage bridge)
- [x] useDrawioPropertyBridge (selection sync hook)
- [x] PropertyPanel (Threagile metadata forms) — existing, integrated
- [x] LockManager — existing, integrated
- [x] VersionManager — existing, integrated

### Draw.io Configuration
- Shape libraries: AWS, Azure, GCP, Network, Security, Generic
- Features: Layers, find/replace, formatting, templates
- Custom properties: Threagile metadata stored in XML

### API Endpoints (unchanged)
- GET /api/threat-models/:id/diagram ✅
- PUT /api/threat-models/:id/diagram ✅
- POST /api/threat-models/:id/lock ✅
- DELETE /api/threat-models/:id/lock ✅
- POST /api/threat-models/:id/versions ✅

### Test Results
- Unit: 15/15 passing
- Integration: 8/8 passing
- E2E: 5/5 editor flows passing

### Screenshots
[Draw.io embed with AWS shapes]
[PropertyPanel with Threagile fields]
[Version dropdown]

**Status: AWAITING APPROVAL**
```

---

## 04_data_models.md Updates

### ADD clarification in Section 1 (Draw.io XML Schema)

Add to the beginning of Section 1:

```markdown
> **Note:** ThreatDiviner uses Draw.io's embed API for diagram editing. The XML format below is Draw.io's native format, which we store directly in `diagramXml` without transformation.

> **Custom Properties:** Threagile-specific metadata (technology, encryption, authentication, etc.) is stored using Draw.io's native custom properties feature within `<Object>` elements inside each `<mxCell>`.
```

### ADD Custom Properties Storage Example

Add after Section 1.6:

```markdown
### 1.7 Threagile Custom Properties Storage

Draw.io supports custom data via `<Object>` child elements. ThreatDiviner stores Threagile metadata this way:

```xml
<mxCell id="api-server" value="API Server" 
        style="shape=mxgraph.aws4.ec2;fillColor=#ED7100;..."
        vertex="1" parent="1">
  <mxGeometry x="100" y="200" width="120" height="60" as="geometry" />
  <!-- Threagile custom properties -->
  <Object 
    td_technology="web-application"
    td_criticality="critical"
    td_internetFacing="true"
    td_authentication="token"
    td_encryption="transparent"
    td_multiTenant="false"
    td_redundant="false"
    td_customDevelopment="true"
    td_outOfScope="false"
    as="threagileData" />
</mxCell>
```

**Property Prefix:** All Threagile properties use `td_` prefix to avoid conflicts with Draw.io's internal properties.

**Property Types:**

| Property | Type | Values | Element Types |
|----------|------|--------|---------------|
| `td_technology` | string | See Threagile technology list | Component |
| `td_criticality` | enum | `critical`, `important`, `operational`, `archive` | Component |
| `td_internetFacing` | boolean | `true`, `false` | Component |
| `td_encryption` | enum | `none`, `transparent`, `data-with-*` | Component |
| `td_authentication` | enum | `none`, `credentials`, `token`, etc. | Component |
| `td_multiTenant` | boolean | `true`, `false` | Component |
| `td_redundant` | boolean | `true`, `false` | Component |
| `td_customDevelopment` | boolean | `true`, `false` | Component |
| `td_outOfScope` | boolean | `true`, `false` | Component |
| `td_justificationOutOfScope` | string | Free text | Component |
| `td_protocol` | string | `https`, `grpc`, `jdbc`, etc. | DataFlow |
| `td_vpn` | boolean | `true`, `false` | DataFlow |
| `td_ipFiltered` | boolean | `true`, `false` | DataFlow |
| `td_dataAssets` | string | Comma-separated IDs | DataFlow |
| `td_boundaryType` | enum | `network-cloud-provider`, etc. | TrustBoundary |
```

---

## Summary of Document Changes

| Document | Sections Changed |
|----------|-----------------|
| **05_ui_screens.md** | §2.1 (Layout), §2.2 (Components), §2.3 (Canvas row), DELETE §3 (Shape Palette) |
| **08_rules.md** | ADD §2.11 (Draw.io Integration rules) |
| **09_implementation_plan.md** | Phase 1 header, v1.1.0, v1.2.0, v1.3.0, DELETE v1.4.0/v1.5.0, Exit Criteria, Acceptance Tests, Checkpoint Output |
| **04_data_models.md** | ADD note at §1 start, ADD §1.7 (Custom Properties Storage) |
