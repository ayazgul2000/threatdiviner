# 05 — UI Screens Specification

## Implementation Protocol

**CRITICAL: For every screen/component below, Claude Code must:**

1. **Build** — Implement the component with all states, validation, and error handling
2. **Test** — Write unit + integration tests covering all listed test cases
3. **Checkpoint** — Output: (a) screenshot/mockup, (b) test results, (c) edge cases covered
4. **Await Approval** — Do NOT proceed to next screen until explicit approval received

**Never hardcode sample data — data enters via admin UI or feed sync only. See `08_rules.md §10`.**

---

## 1. Dashboard / Model List

### 1.1 Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│  [Logo] Threat Modeling                    [Search...] [+ New] [User ▼]   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  My Threat Models                                    [Grid ▣] [List ≡]    │
│  ─────────────────────────────────────────────────────────────────────    │
│  [Filter: All ▼] [Status: All ▼] [Sort: Updated ▼]                        │
│                                                                            │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐           │
│  │ ◉ Production API │ │ ◎ Staging Env    │ │ ○ New Project    │           │
│  │ ───────────────  │ │ ───────────────  │ │ ───────────────  │           │
│  │ 🔴 3  🟠 5  🟡 12 │ │ 🔴 1  🟠 2  🟡 8  │ │ Draft            │           │
│  │ Updated 2h ago   │ │ Updated 1d ago   │ │ Created just now │           │
│  │ [⋮]              │ │ [⋮]              │ │ [⋮]              │           │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘           │
│                                                                            │
│  ┌──────────────────┐ ┌──────────────────┐                                │
│  │ + New Threat     │ │ ↑ Import         │                                │
│  │   Model          │ │                  │                                │
│  └──────────────────┘ └──────────────────┘                                │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Components

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `DashboardPage` | `pages/dashboard.tsx` | - | Page container |
| `ModelGrid` | `components/dashboard/ModelGrid.tsx` | `models`, `view`, `onSelect` | Grid/list view of models |
| `ModelCard` | `components/dashboard/ModelCard.tsx` | `model`, `onOpen`, `onMenu` | Individual model card |
| `RiskBadges` | `components/shared/RiskBadges.tsx` | `counts: {critical, high, medium, low}` | Severity count pills |
| `CreateModelDialog` | `components/dashboard/CreateModelDialog.tsx` | `open`, `onClose`, `onCreate` | New model modal |
| `ImportDialog` | `components/dashboard/ImportDialog.tsx` | `open`, `onClose`, `onImport` | Import options modal |
| `ModelContextMenu` | `components/dashboard/ModelContextMenu.tsx` | `model`, `onAction` | Dropdown menu (edit, duplicate, archive, delete) |

### 1.3 States & Behavior

| Element | States | Behavior | Validation | Error Handling |
|---------|--------|----------|------------|----------------|
| **Page Load** | `loading`, `loaded`, `empty`, `error` | Fetch models on mount, skeleton during load | - | Show error state with retry button |
| **Model Card** | `idle`, `hover`, `selected`, `locked` | Click opens editor; show lock icon if locked by another user | - | Toast if cannot open (locked/deleted) |
| **Search** | `idle`, `typing`, `searching`, `no-results` | Debounce 300ms, filter locally + API search | Min 2 chars | Clear on escape, show "no results" state |
| **Create Button** | `idle`, `loading`, `success` | Opens dialog; on submit creates model | Name required, max 255 chars | Toast on API error, keep dialog open |
| **Delete Action** | `confirm`, `deleting`, `deleted` | Confirmation dialog required | Cannot delete if in use by CI/CD | Toast error if deletion fails |
| **Filter/Sort** | `idle`, `applied` | Persist to URL params, local storage | - | Reset to defaults on invalid params |

### 1.4 Test Cases

| ID | Test Case | Type | Expected Result |
|----|-----------|------|-----------------|
| `D-001` | Load dashboard with 0 models | Unit | Show empty state with "Create your first model" CTA |
| `D-002` | Load dashboard with 50 models | Integration | Paginate or virtual scroll, no performance degradation |
| `D-003` | Search for "api" | Unit | Filter models containing "api" in name/description |
| `D-004` | Search with no results | Unit | Show "No models found" with clear search option |
| `D-005` | Create model with valid name | Integration | Model created, redirect to editor |
| `D-006` | Create model with empty name | Unit | Show validation error, block submit |
| `D-007` | Create model - API fails | Integration | Toast error, dialog stays open, can retry |
| `D-008` | Delete model - confirm | Integration | Model removed from list |
| `D-009` | Delete model - cancel | Unit | Model unchanged |
| `D-010` | Delete model - API fails | Integration | Toast error, model still in list |
| `D-011` | Open locked model | Integration | Toast "Model is being edited by [user]" |
| `D-012` | Grid to List view toggle | Unit | View changes, persists to localStorage |
| `D-013` | Filter by status "active" | Unit | Only active models shown |
| `D-014` | Sort by "name" | Unit | Models sorted alphabetically |
| `D-015` | Refresh after external change | Integration | New data reflected after refetch |

### 1.5 API Endpoints

```typescript
// List models
GET /api/threat-models
Query: { search?, status?, sortBy?, sortOrder?, limit?, offset? }
Response: { models: ThreatModel[], total: number, hasMore: boolean }

// Create model
POST /api/threat-models
Body: { name: string, description?: string, templateId?: string }
Response: { model: ThreatModel }

// Delete model
DELETE /api/threat-models/:id
Response: { success: boolean }
```

---

## 2. Diagram Editor View

### 2.1 Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│  [← Back] Production API Architecture    [Save] [▶ Run Analysis] [⋮ More] │
├────────┬───────────────────────────────────────────────────────────┬───────┤
│        │                                                           │       │
│ SHAPES │                                                           │ PROPS │
│ ────── │                                                           │ ───── │
│ 🔍 [...│                      CANVAS                               │ Name  │
│        │                                                           │ [...] │
│ ▼ AWS  │    ┌─────────┐         ┌─────────┐                       │       │
│  EC2   │    │ Browser │─────────│   ALB   │                       │ Tech  │
│  RDS   │    └─────────┘         └────┬────┘                       │ [▼..] │
│  S3    │                             │                             │       │
│  Lambda│    ┌────────────────────────┼────────────────────┐       │ Auth  │
│        │    │ VPC                    │                    │       │ [▼..] │
│ ▼ Azure│    │         ┌─────────┐    │    ┌─────────┐    │       │       │
│        │    │         │   API   │────┼────│   RDS   │    │       │ Data  │
│ ▼ GCP  │    │         └─────────┘         └─────────┘    │       │ [+..] │
│        │    │                                             │       │       │
│ ▼ Trust│    └─────────────────────────────────────────────┘       │       │
│  Bound │                                                           │ [Save]│
│        │    [Minimap ◫]                                           │       │
├────────┴───────────────────────────────────────────────────────────┴───────┤
│ RISKS │ 🔴 3 Critical │ 🟠 5 High │ 🟡 12 Medium │ 🟢 2 Low │ [Filter ▼]   │
│ ► Missing Auth on API → RDS connection                      [Triage] [→]  │
│ ► Unencrypted data at rest: RDS                            [Triage] [→]  │
│ ► Public S3 bucket exposure                                 [Triage] [→]  │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Components

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `EditorPage` | `pages/editor/[id].tsx` | `modelId` | Page container with layout |
| `DiagramCanvas` | `components/editor/DiagramCanvas.tsx` | `xml`, `onChange`, `onSelect` | mxGraph wrapper |
| `ShapePalette` | `components/editor/ShapePalette.tsx` | `categories`, `onDragStart` | Left sidebar shapes |
| `ShapeCategory` | `components/editor/ShapeCategory.tsx` | `name`, `shapes`, `expanded` | Collapsible category |
| `PropertyPanel` | `components/editor/PropertyPanel.tsx` | `element`, `onUpdate` | Right sidebar form |
| `RiskPanel` | `components/editor/RiskPanel.tsx` | `risks`, `onSelect`, `onTriage` | Bottom risk list |
| `RiskRow` | `components/editor/RiskRow.tsx` | `risk`, `onClick`, `onAction` | Single risk item |
| `EditorToolbar` | `components/editor/EditorToolbar.tsx` | `onSave`, `onAnalyze`, `...` | Top action bar |
| `Minimap` | `components/editor/Minimap.tsx` | `graph`, `viewport` | Navigation thumbnail |
| `GapFillDialog` | `components/editor/GapFillDialog.tsx` | `gaps`, `onComplete` | Missing fields prompt |

### 2.3 States & Behavior

| Element | States | Behavior | Validation | Error Handling |
|---------|--------|----------|------------|----------------|
| **Canvas** | `loading`, `idle`, `dragging`, `connecting`, `selecting`, `panning` | mxGraph events → state updates; auto-save debounce 60s | Min 1 asset before analysis | Fallback to blank on corrupt XML; toast on render fail |
| **Save Button** | `idle`, `saving`, `saved`, `error`, `disabled` | POST diagram XML; disable during save | Block if validation errors | Retry 3x; local backup; show error toast |
| **Run Analysis** | `idle`, `disabled`, `running`, `complete`, `failed` | Queue job; show progress modal; poll or websocket | Must save first; no critical gaps | Timeout 120s → offer retry; show error details |
| **Shape Drag** | `idle`, `dragging`, `invalid`, `dropped` | Ghost preview; snap to grid; add to graph | Must drop in valid area | Snap to nearest valid; toast if invalid |
| **Property Panel** | `empty`, `loading`, `editing`, `saving` | Load on selection; debounce updates 500ms | Per-field validation (see 3.4) | Highlight invalid fields; block save |
| **Risk Panel** | `loading`, `loaded`, `empty`, `filtered` | Load after analysis; click highlights asset | - | Show "Run analysis first" if empty |
| **Lock** | `unlocked`, `locked-by-me`, `locked-by-other` | Acquire on first edit; release on close/timeout | - | Toast if cannot acquire; view-only mode |

### 2.4 Test Cases

| ID | Test Case | Type | Expected Result |
|----|-----------|------|-----------------|
| `E-001` | Load editor with valid model | Integration | Canvas renders with existing diagram |
| `E-002` | Load editor with empty model | Unit | Blank canvas, palette visible |
| `E-003` | Load editor with corrupt XML | Integration | Show recovery dialog, offer blank start |
| `E-004` | Drag EC2 shape to canvas | Unit | Node created at drop position, property panel opens |
| `E-005` | Drag shape outside canvas | Unit | Shape snaps back, no node created |
| `E-006` | Connect two nodes | Unit | Edge created, link property modal opens |
| `E-007` | Delete selected node | Unit | Node + connected edges removed, undo available |
| `E-008` | Undo delete | Unit | Node + edges restored |
| `E-009` | Save diagram | Integration | API called, "Saved" indicator shown |
| `E-010` | Save fails - network | Integration | Toast error, local backup created, retry available |
| `E-011` | Save fails - conflict (locked) | Integration | Toast "Model locked by [user]", offer force save |
| `E-012` | Run analysis - success | Integration | Progress shown, risks populated |
| `E-013` | Run analysis - timeout | Integration | Toast "Timed out", retry button shown |
| `E-014` | Run analysis - no assets | Unit | Button disabled, tooltip "Add assets first" |
| `E-015` | Run analysis - gaps exist | Unit | Gap-fill dialog shown before analysis |
| `E-016` | Select risk in panel | Unit | Corresponding asset highlighted on canvas |
| `E-017` | Canvas with 200+ nodes | Performance | No lag on pan/zoom (measure FPS > 30) |
| `E-018` | Multiple users open same model | Integration | Second user sees "locked by [user]" |
| `E-019` | Lock timeout after 5min idle | Integration | Lock released, toast shown |
| `E-020` | Keyboard shortcut Ctrl+S | Unit | Save triggered |
| `E-021` | Keyboard shortcut Ctrl+Z | Unit | Undo triggered |
| `E-022` | Browser refresh with unsaved | Unit | Confirmation dialog shown |
| `E-023` | Property panel - invalid tech | Unit | Red border, error message, save blocked |
| `E-024` | Auto-save after 60s | Integration | Save triggered silently, "Auto-saved" indicator |

### 2.5 API Endpoints

```typescript
// Get diagram
GET /api/threat-models/:id/diagram
Response: { xml: string, version: number, lockedBy?: User }

// Save diagram
PUT /api/threat-models/:id/diagram
Body: { xml: string, versionName?: string }
Response: { version: DiagramVersion }

// Acquire lock
POST /api/threat-models/:id/lock
Response: { acquired: boolean, lockedBy?: User, expiresAt?: string }

// Release lock
DELETE /api/threat-models/:id/lock
Response: { released: boolean }

// Run analysis
POST /api/threat-models/:id/analyze
Response: { analysisRunId: string }

// Get analysis status
GET /api/analysis-runs/:id
Response: { status, progress, risks?, error? }
```

---

## 3. Shape Palette

### 3.1 Layout

```
┌─────────────────────┐
│ 🔍 Search shapes... │
├─────────────────────┤
│ ⭐ Recent           │
│  [EC2] [RDS] [S3]  │
├─────────────────────┤
│ ▼ AWS              │
│  ┌───┐ ┌───┐ ┌───┐│
│  │EC2│ │RDS│ │ S3││
│  └───┘ └───┘ └───┘│
│  ┌───┐ ┌───┐ ┌───┐│
│  │λ  │ │API│ │SQS││
│  └───┘ └───┘ └───┘│
│  [Show more...]    │
├─────────────────────┤
│ ► Azure            │
├─────────────────────┤
│ ► GCP              │
├─────────────────────┤
│ ► Generic          │
├─────────────────────┤
│ ▼ Trust Boundaries │
│  ┌─────────────┐   │
│  │ VPC         │   │
│  └─────────────┘   │
│  ┌─────────────┐   │
│  │ Subnet      │   │
│  └─────────────┘   │
├─────────────────────┤
│ ► Actors           │
└─────────────────────┘
```

### 3.2 Components

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `ShapePalette` | `components/editor/ShapePalette.tsx` | `onDragStart`, `onSearch` | Container |
| `ShapeSearch` | `components/editor/ShapeSearch.tsx` | `value`, `onChange` | Search input |
| `RecentShapes` | `components/editor/RecentShapes.tsx` | `shapes`, `onSelect` | Recently used |
| `ShapeCategory` | `components/editor/ShapeCategory.tsx` | `category`, `expanded`, `onToggle` | Collapsible section |
| `ShapeItem` | `components/editor/ShapeItem.tsx` | `shape`, `onDragStart` | Draggable shape |
| `ShapeTooltip` | `components/editor/ShapeTooltip.tsx` | `shape` | Hover info |

### 3.3 States & Behavior

| Element | States | Behavior | Validation | Error Handling |
|---------|--------|----------|------------|----------------|
| **Search** | `idle`, `typing`, `filtered`, `no-results` | Filter shapes across all categories; highlight matches | - | Show "No shapes found" with suggestions |
| **Category** | `collapsed`, `expanded`, `loading` | Toggle on click; lazy load shapes | - | Show skeleton during load |
| **Shape Item** | `idle`, `hover`, `dragging`, `disabled` | Drag to canvas; show tooltip on hover | - | Disable if license doesn't include |
| **Recent** | `empty`, `loaded` | Store last 10 used in localStorage | - | Graceful empty state |

### 3.4 Test Cases

| ID | Test Case | Type | Expected Result |
|----|-----------|------|-----------------|
| `P-001` | Load palette | Unit | All categories rendered, AWS expanded by default |
| `P-002` | Search "lambda" | Unit | Lambda shape highlighted, others filtered |
| `P-003` | Search "xyz" (no match) | Unit | "No shapes found" message |
| `P-004` | Expand Azure category | Unit | Azure shapes loaded and shown |
| `P-005` | Collapse AWS category | Unit | AWS shapes hidden, state persisted |
| `P-006` | Drag shape from palette | Unit | Ghost preview follows cursor |
| `P-007` | Hover shape | Unit | Tooltip with name and description |
| `P-008` | Recent shapes after use | Unit | Used shape appears in Recent section |
| `P-009` | Clear search | Unit | All shapes visible again |
| `P-010` | Shapes load from config DB | Integration | Dynamic shapes, not hardcoded |

---

## 4. Property Panel

### 4.1 Layout

```
┌─────────────────────────────┐
│ PROPERTIES                  │
│ ─────────────────────────── │
│                             │
│ Name *                      │
│ ┌─────────────────────────┐ │
│ │ API Server              │ │
│ └─────────────────────────┘ │
│                             │
│ Description                 │
│ ┌─────────────────────────┐ │
│ │ Main backend API        │ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
│ Technology *                │
│ ┌─────────────────────────┐ │
│ │ web-server            ▼ │ │
│ └─────────────────────────┘ │
│                             │
│ Machine Type *              │
│ ┌─────────────────────────┐ │
│ │ container             ▼ │ │
│ └─────────────────────────┘ │
│                             │
│ ☑ Internet Facing          │
│                             │
│ Authentication *            │
│ ┌─────────────────────────┐ │
│ │ token                 ▼ │ │
│ └─────────────────────────┘ │
│                             │
│ Encryption at Rest          │
│ ┌─────────────────────────┐ │
│ │ transparent           ▼ │ │
│ └─────────────────────────┘ │
│                             │
│ Data Processed              │
│ ┌─────────────────────────┐ │
│ │ [PII ×] [Credentials ×] │ │
│ │ [+ Add data asset]      │ │
│ └─────────────────────────┘ │
│                             │
│ Tags                        │
│ ┌─────────────────────────┐ │
│ │ [backend ×] [critical ×]│ │
│ │ [+ Add tag]             │ │
│ └─────────────────────────┘ │
│                             │
│ ☐ Out of Scope             │
│                             │
│ ┌─────────────────────────┐ │
│ │      Apply Changes      │ │
│ └─────────────────────────┘ │
│                             │
│ ⚠ 2 validation errors      │
│   • Technology is required  │
│   • Authentication needed   │
│     for internet-facing     │
└─────────────────────────────┘
```

### 4.2 Components

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `PropertyPanel` | `components/editor/PropertyPanel.tsx` | `element`, `onUpdate`, `onClose` | Container |
| `PropertyForm` | `components/editor/PropertyForm.tsx` | `values`, `onChange`, `errors` | Form wrapper |
| `TextField` | `components/shared/TextField.tsx` | `label`, `value`, `onChange`, `error` | Text input |
| `SelectField` | `components/shared/SelectField.tsx` | `label`, `options`, `value`, `onChange` | Dropdown |
| `CheckboxField` | `components/shared/CheckboxField.tsx` | `label`, `checked`, `onChange` | Toggle |
| `ChipInput` | `components/shared/ChipInput.tsx` | `values`, `onChange`, `suggestions` | Multi-value chips |
| `ValidationSummary` | `components/shared/ValidationSummary.tsx` | `errors` | Error list |

### 4.3 Field Definitions

| Field | Type | Required | Options/Validation | Default |
|-------|------|----------|-------------------|---------|
| `name` | text | Yes | Max 255 chars | Shape label |
| `description` | textarea | No | Max 2000 chars | - |
| `technology` | select | Yes | Load from `shape_mappings` | From shape |
| `machine` | select | Yes | physical, virtual, container, serverless | From shape |
| `internetFacing` | checkbox | No | - | false |
| `encryption` | select | No | none, transparent, data-with-symmetric, data-with-asymmetric | none |
| `authentication` | select | Yes if internet-facing | none, credentials, session-id, token, certificate, two-factor, externalized | none |
| `authorization` | select | No | none, technical-user, enduser-identity-propagation | none |
| `multiTenant` | checkbox | No | - | false |
| `redundant` | checkbox | No | - | false |
| `customDeveloped` | checkbox | No | - | false |
| `outOfScope` | checkbox | No | - | false |
| `dataAssetsProcessed` | chips | No | Select from data assets | [] |
| `dataAssetsStored` | chips | No | Select from data assets | [] |
| `tags` | chips | No | Freeform | [] |

### 4.4 Validation Rules

```typescript
const validationRules = {
  name: {
    required: true,
    maxLength: 255,
  },
  technology: {
    required: true,
    enum: loadFromDatabase('technologies'),
  },
  authentication: {
    required: (values) => values.internetFacing === true,
    notEqual: (values) => values.internetFacing ? 'none' : null,
    message: 'Internet-facing assets require authentication',
  },
  dataAssetsProcessed: {
    custom: (values) => {
      if (values.technology === 'database' && values.dataAssetsStored.length === 0) {
        return 'Database should store at least one data asset';
      }
      return null;
    },
  },
};
```

### 4.5 States & Behavior

| Element | States | Behavior | Error Handling |
|---------|--------|----------|----------------|
| **Panel** | `empty`, `loading`, `editing`, `saving`, `error` | Load on selection; update on change | Show skeleton during load |
| **Field** | `pristine`, `dirty`, `valid`, `invalid` | Validate on blur; show error below | Red border + error message |
| **Apply Button** | `idle`, `disabled`, `saving` | Disabled if invalid; save on click | Toast on save error |
| **Form** | `clean`, `dirty`, `submitting` | Track changes; warn on close if dirty | Confirmation dialog on close |

### 4.6 Test Cases

| ID | Test Case | Type | Expected Result |
|----|-----------|------|-----------------|
| `PP-001` | Select asset | Unit | Panel loads with asset properties |
| `PP-002` | Select nothing | Unit | Panel shows "Select an element" |
| `PP-003` | Edit name | Unit | Field marked dirty, Apply enabled |
| `PP-004` | Clear required field | Unit | Validation error shown |
| `PP-005` | Internet-facing without auth | Unit | Validation error for authentication |
| `PP-006` | Add data asset chip | Unit | Chip added, suggestions shown |
| `PP-007` | Remove tag chip | Unit | Chip removed |
| `PP-008` | Apply valid changes | Integration | Asset updated, panel refreshes |
| `PP-009` | Apply with errors | Unit | Button disabled, errors listed |
| `PP-010` | Close panel with unsaved | Unit | Confirmation dialog shown |
| `PP-011` | Technology options load from DB | Integration | Dynamic list, not hardcoded |
| `PP-012` | Select link (not asset) | Unit | Link properties shown instead |

---

## 5. Risk Panel

### 5.1 Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ RISKS (23)  │ 🔴 3 │ 🟠 5 │ 🟡 12 │ 🟢 3 │  [Filter ▼] [Search...] [↻]   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ 🔴 CRITICAL  Missing Authentication                                    │ │
│ │ ────────────────────────────────────────────────────────────────────── │ │
│ │ API Server → Database connection lacks authentication                  │ │
│ │ Affected: Database | CWE-306 | STRIDE: Spoofing                       │ │
│ │ [ISO27001: A.8.5] [NIST: IA-2]                                        │ │
│ │                                              [Triage ▼] [View Details] │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ 🔴 CRITICAL  Unencrypted Data Transmission                            │ │
│ │ ────────────────────────────────────────────────────────────────────── │ │
│ │ ALB → API Server uses HTTP instead of HTTPS                           │ │
│ │ Affected: API Server | CWE-319 | STRIDE: Tampering                    │ │
│ │                                              [Triage ▼] [View Details] │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ► 🟠 HIGH (5 risks) ─────────────────────────────────────────────────────  │
│                                                                            │
│ ► 🟡 MEDIUM (12 risks) ──────────────────────────────────────────────────  │
│                                                                            │
│ ► 🟢 LOW (3 risks) ──────────────────────────────────────────────────────  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Components

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `RiskPanel` | `components/editor/RiskPanel.tsx` | `risks`, `onSelect`, `onTriage` | Container |
| `RiskSummaryBar` | `components/editor/RiskSummaryBar.tsx` | `counts`, `filter`, `onFilter` | Header with counts |
| `RiskGroup` | `components/editor/RiskGroup.tsx` | `severity`, `risks`, `expanded` | Collapsible severity group |
| `RiskCard` | `components/editor/RiskCard.tsx` | `risk`, `onClick`, `onAction` | Individual risk |
| `RiskTriageMenu` | `components/editor/RiskTriageMenu.tsx` | `risk`, `onTriage` | Status change dropdown |
| `RiskDetailModal` | `components/editor/RiskDetailModal.tsx` | `risk`, `onClose` | Full risk details |
| `ComplianceBadge` | `components/shared/ComplianceBadge.tsx` | `framework`, `controlId` | Control reference chip |

### 5.3 States & Behavior

| Element | States | Behavior | Error Handling |
|---------|--------|----------|----------------|
| **Panel** | `empty`, `loading`, `loaded`, `error` | Load after analysis complete | Show "Run analysis" CTA if empty |
| **Risk Card** | `collapsed`, `expanded`, `selected`, `triaging` | Click to select (highlight on canvas); expand for details | - |
| **Filter** | `all`, `severity`, `status`, `compliance` | Filter risk list; persist to URL | Reset on clear |
| **Triage Menu** | `closed`, `open`, `submitting` | Change risk status; require justification for accept/false-positive | Toast on API error |
| **Refresh** | `idle`, `refreshing` | Re-fetch risks from latest analysis | Toast if no new analysis |

### 5.4 Triage Actions

| Action | New Status | Requires | Result |
|--------|------------|----------|--------|
| **Acknowledge** | `in-progress` | - | Risk marked as being worked on |
| **Mark Mitigated** | `mitigated` | - | Risk treated, pending verification |
| **Mark Resolved** | `resolved` | - | Risk fully addressed |
| **Accept Risk** | `accepted` | Justification text | Risk accepted with documented reason |
| **False Positive** | `false-positive` | Justification text | Risk excluded from counts |
| **Reopen** | `open` | - | Reset to open status |

### 5.5 Test Cases

| ID | Test Case | Type | Expected Result |
|----|-----------|------|-----------------|
| `R-001` | Load risks after analysis | Integration | Risks grouped by severity |
| `R-002` | No risks found | Unit | "No risks identified" message |
| `R-003` | Click risk card | Unit | Asset highlighted on canvas |
| `R-004` | Expand risk details | Unit | Full description, remediation shown |
| `R-005` | Filter by severity | Unit | Only matching risks shown |
| `R-006` | Filter by status "open" | Unit | Only open risks shown |
| `R-007` | Search "authentication" | Unit | Matching risks highlighted |
| `R-008` | Triage - accept without justification | Unit | Error "Justification required" |
| `R-009` | Triage - accept with justification | Integration | Status updated, risk de-emphasized |
| `R-010` | Triage API fails | Integration | Toast error, status unchanged |
| `R-011` | View compliance badges | Unit | Control IDs shown, clickable |
| `R-012` | Bulk triage (select multiple) | Integration | All selected updated |
| `R-013` | Refresh risks | Integration | Fetches latest from server |
| `R-014` | Risk links to attack path | Unit | Opens attack path modal |

---

## 6. Compliance Tab

### 6.1 Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ COMPLIANCE                                                [Export Report ▼]│
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ Select Frameworks:                                                         │
│ [☑ ISO 27001] [☑ NIST 800-53] [☐ PCI-DSS] [☐ VPDSS] [☐ APRA CPS 234]     │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌────────────────────────────────────┐ ┌────────────────────────────────┐ │
│ │ ISO 27001                          │ │ NIST 800-53                    │ │
│ │ ════════════════════               │ │ ════════════════════           │ │
│ │                                    │ │                                │ │
│ │   78% Compliant                    │ │   65% Compliant                │ │
│ │   ████████████░░░░                 │ │   ██████████░░░░░░             │ │
│ │                                    │ │                                │ │
│ │   ✓ 72 Satisfied                   │ │   ✓ 650 Satisfied              │ │
│ │   ◐ 8 Partial                      │ │   ◐ 120 Partial                │ │
│ │   ✗ 13 Gaps                        │ │   ✗ 237 Gaps                   │ │
│ │                                    │ │                                │ │
│ │   [View Details →]                 │ │   [View Details →]             │ │
│ └────────────────────────────────────┘ └────────────────────────────────┘ │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ GAPS (21 total)                                            [Filter ▼]     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ A.8.24 - Use of Cryptography                           ISO 27001      │ │
│ │ ────────────────────────────────────────────────────────────────────── │ │
│ │ Related Risks: Unencrypted Data Transmission (Critical)               │ │
│ │ Status: Gap                                    [View Remediation →]   │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │ SC-8 - Transmission Confidentiality                    NIST 800-53    │ │
│ │ ────────────────────────────────────────────────────────────────────── │ │
│ │ Related Risks: Unencrypted Data Transmission (Critical)               │ │
│ │ Status: Gap                                    [View Remediation →]   │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Components

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `ComplianceTab` | `components/editor/ComplianceTab.tsx` | `threatModelId`, `frameworks` | Container |
| `FrameworkSelector` | `components/compliance/FrameworkSelector.tsx` | `selected`, `onChange` | Checkbox list |
| `ComplianceCard` | `components/compliance/ComplianceCard.tsx` | `framework`, `stats` | Summary card |
| `ComplianceProgress` | `components/compliance/ComplianceProgress.tsx` | `percentage`, `color` | Progress bar |
| `GapList` | `components/compliance/GapList.tsx` | `gaps`, `onSelect` | Gap items |
| `GapCard` | `components/compliance/GapCard.tsx` | `gap`, `onClick` | Individual gap |
| `ControlDetailModal` | `components/compliance/ControlDetailModal.tsx` | `control`, `gaps` | Full control info |

### 6.3 States & Behavior

| Element | States | Behavior | Error Handling |
|---------|--------|----------|----------------|
| **Framework Selector** | `loading`, `loaded` | Load available frameworks; persist selection | Toast if load fails |
| **Compliance Card** | `loading`, `loaded`, `error` | Calculate stats from risks + mappings | Show "Error loading" with retry |
| **Gap List** | `empty`, `loaded`, `filtered` | Filter by framework, status | Show "No gaps" if compliant |
| **Export** | `idle`, `generating`, `complete` | Generate PDF/Excel report | Toast on error, offer retry |

### 6.4 Test Cases

| ID | Test Case | Type | Expected Result |
|----|-----------|------|-----------------|
| `C-001` | Load compliance tab | Integration | Selected frameworks shown with stats |
| `C-002` | No frameworks selected | Unit | Prompt to select frameworks |
| `C-003` | 100% compliant framework | Unit | "Fully Compliant" badge, no gaps |
| `C-004` | Select additional framework | Unit | Stats recalculated, gaps updated |
| `C-005` | Click gap card | Unit | Related risk highlighted |
| `C-006` | View control details | Unit | Modal with full control info |
| `C-007` | Export PDF report | Integration | PDF generated and downloaded |
| `C-008` | Export Excel report | Integration | Excel generated and downloaded |
| `C-009` | Filter gaps by framework | Unit | Only selected framework gaps shown |
| `C-010` | Framework list loads from DB | Integration | Dynamic, not hardcoded |

---

## 7. Attack Path Modal

### 7.1 Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ATTACK PATH: SQL Injection → Data Breach                              [×] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐          │
│  │ Browser │──1──▶│   ALB   │──2──▶│   API   │──3──▶│   RDS   │          │
│  └─────────┘      └─────────┘      └─────────┘      └─────────┘          │
│       │                                                   │                │
│       │                                                   │                │
│  Initial Access                                     Data Breach            │
│  T1190                                              T1005                   │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ATTACK NARRATIVE                                                           │
│ ═══════════════                                                            │
│                                                                            │
│ 1. INITIAL ACCESS (T1190 - Exploit Public-Facing Application)             │
│    └─ Attacker sends malicious request to public ALB endpoint             │
│                                                                            │
│ 2. EXECUTION (T1059 - Command and Scripting Interpreter)                  │
│    └─ Malicious payload passed through to API Server                      │
│    └─ SQL injection in user input field                                   │
│                                                                            │
│ 3. COLLECTION (T1005 - Data from Local System)                            │
│    └─ Injected SQL query extracts sensitive data from RDS                 │
│    └─ CWE-89: Improper Neutralization of SQL Commands                     │
│                                                                            │
│ IMPACT                                                                     │
│ ══════                                                                     │
│ • Data at risk: PII, Credentials (2,500+ records)                         │
│ • Compliance impact: ISO27001 A.8.5, NIST SI-10, PCI-DSS 6.5.1           │
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │                        View Remediation                                │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Components

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `AttackPathModal` | `components/editor/AttackPathModal.tsx` | `risk`, `path`, `onClose` | Modal container |
| `AttackPathDiagram` | `components/editor/AttackPathDiagram.tsx` | `path`, `onHopClick` | Visual path |
| `AttackHopNode` | `components/editor/AttackHopNode.tsx` | `hop`, `isActive` | Single hop in path |
| `AttackNarrative` | `components/editor/AttackNarrative.tsx` | `hops` | Text explanation |
| `TacticBadge` | `components/shared/TacticBadge.tsx` | `tactic`, `technique` | ATT&CK badge |

### 7.3 Test Cases

| ID | Test Case | Type | Expected Result |
|----|-----------|------|-----------------|
| `AP-001` | Open attack path modal | Unit | Path diagram and narrative rendered |
| `AP-002` | Hover hop node | Unit | Tooltip with technique details |
| `AP-003` | Click hop node | Unit | Corresponding asset highlighted on canvas |
| `AP-004` | ATT&CK technique link | Unit | Opens MITRE ATT&CK page in new tab |
| `AP-005` | Path with 5+ hops | Unit | Horizontal scroll or wrap, no cutoff |
| `AP-006` | View remediation button | Unit | Opens remediation for root risk |
| `AP-007` | Close modal | Unit | Modal closes, canvas visible |

---

## 8. Wizard Flow Screens

### 8.1 Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          CREATE THREAT MODEL                               │
│                                                                            │
│  ○───────○───────●───────○───────○───────○───────○───────○                │
│  Type   Cloud  Compute   DB    Auth   Public  Security  Review            │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                    What compute platform runs your app?                    │
│                                                                            │
│    ┌─────────────────────────────────────────────────────────────────┐    │
│    │                                                                 │    │
│    │   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐   │    │
│    │   │     🖥️        │   │     🐳        │   │     ☸️        │   │    │
│    │   │     EC2       │   │     ECS       │   │     EKS       │   │    │
│    │   │               │   │               │   │               │   │    │
│    │   │ Virtual       │   │ Containers    │   │ Kubernetes    │   │    │
│    │   │ Machines      │   │               │   │               │   │    │
│    │   └───────────────┘   └───────────────┘   └───────────────┘   │    │
│    │                                                                 │    │
│    │   ┌───────────────┐   ┌───────────────┐                       │    │
│    │   │     λ         │   │     🌐        │                       │    │
│    │   │   Lambda      │   │  App Service  │                       │    │
│    │   │               │   │               │                       │    │
│    │   │ Serverless    │   │    PaaS       │                       │    │
│    │   └───────────────┘   └───────────────┘                       │    │
│    │                                                                 │    │
│    └─────────────────────────────────────────────────────────────────┘    │
│                                                                            │
│  ℹ️ Select how your application code runs. This determines the base       │
│     architecture for your threat model.                                    │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  PREVIEW                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │     ┌─────────┐                                                      │ │
│  │     │ Browser │                                                      │ │
│  │     └────┬────┘                                                      │ │
│  │          │                                                           │ │
│  │     ┌────┴────┐                                                      │ │
│  │     │  ????   │  ← Your selection will appear here                   │ │
│  │     └─────────┘                                                      │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│                        [← Back]              [Next →]                      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Components

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `WizardPage` | `pages/wizard.tsx` | `templateId?` | Page container |
| `WizardProgress` | `components/wizard/WizardProgress.tsx` | `steps`, `currentStep` | Step indicator |
| `WizardQuestion` | `components/wizard/WizardQuestion.tsx` | `question`, `value`, `onChange` | Question renderer |
| `OptionCard` | `components/wizard/OptionCard.tsx` | `option`, `selected`, `onClick` | Selectable option |
| `WizardPreview` | `components/wizard/WizardPreview.tsx` | `graph` | Live diagram preview |
| `WizardNavigation` | `components/wizard/WizardNavigation.tsx` | `onBack`, `onNext`, `canProceed` | Navigation buttons |

### 8.3 States & Behavior

| Element | States | Behavior | Error Handling |
|---------|--------|----------|----------------|
| **Wizard** | `loading`, `active`, `completing`, `complete` | Load questions from DB; track answers | Toast on load error |
| **Question** | `unanswered`, `answered`, `skipped` | Render based on type; apply triggers | Skip if conditions not met |
| **Option** | `idle`, `hover`, `selected`, `disabled` | Click to select; show selection state | Disable if license restricted |
| **Preview** | `empty`, `updating`, `rendered` | Update on each answer | Show placeholder if empty |
| **Navigation** | `back-enabled`, `next-enabled`, `finish` | Back always; Next if answered | Validate before proceed |

### 8.4 Test Cases

| ID | Test Case | Type | Expected Result |
|----|-----------|------|-----------------|
| `W-001` | Start wizard | Unit | First question shown |
| `W-002` | Select option | Unit | Answer stored, preview updates |
| `W-003` | Next without selection | Unit | Button disabled or validation error |
| `W-004` | Back button | Unit | Previous question shown, answer preserved |
| `W-005` | Skip conditional question | Unit | Question hidden if condition not met |
| `W-006` | Complete wizard | Integration | Threat model created with diagram |
| `W-007` | Cancel wizard | Unit | Confirmation dialog, discard progress |
| `W-008` | Multi-select question | Unit | Multiple options selectable |
| `W-009` | Text input question | Unit | Free text accepted |
| `W-010` | Questions load from DB | Integration | Dynamic, not hardcoded |
| `W-011` | Preview shows all added nodes | Unit | Each answer reflects in preview |
| `W-012` | Resume incomplete wizard | Integration | Progress restored from localStorage |

---

## 9. AI Chat Drawer

### 9.1 Layout

```
┌──────────────────────────────────────────────────────┐
│ AI ASSISTANT                                    [×]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 👤 I have a React app on Vercel calling a        │ │
│ │    Node API on AWS ECS with PostgreSQL           │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 🤖 I've added the following components:          │ │
│ │                                                  │ │
│ │ ✓ Browser (client)                              │ │
│ │ ✓ Vercel Edge (CDN)                             │ │
│ │ ✓ ECS Service (container)                       │ │
│ │ ✓ RDS PostgreSQL (database)                     │ │
│ │ ✓ VPC boundary with public/private subnets      │ │
│ │                                                  │ │
│ │ The diagram has been updated. What else would   │ │
│ │ you like to add?                                │ │
│ │                                                  │ │
│ │ [View changes on diagram]                        │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 👤 Add Redis for caching between API and DB      │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 🤖 Adding ElastiCache Redis...                   │ │
│ │ ░░░░░░░░░░                                       │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
├──────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────┐ [➤] │
│ │ Describe what to add or change...          │      │
│ └────────────────────────────────────────────┘      │
│                                                      │
│ 💡 Try: "Add authentication with Cognito"           │
│ 💡 Try: "What if the database was public?"          │
└──────────────────────────────────────────────────────┘
```

### 9.2 Components

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `AIChatDrawer` | `components/editor/AIChatDrawer.tsx` | `open`, `onClose`, `onDiagramChange` | Drawer container |
| `ChatHistory` | `components/chat/ChatHistory.tsx` | `messages` | Message list |
| `ChatMessage` | `components/chat/ChatMessage.tsx` | `message`, `isUser` | Single message |
| `ChatInput` | `components/chat/ChatInput.tsx` | `onSend`, `disabled` | Input with send button |
| `DiagramChangesSummary` | `components/chat/DiagramChangesSummary.tsx` | `changes` | List of changes made |
| `ChatSuggestions` | `components/chat/ChatSuggestions.tsx` | `suggestions`, `onSelect` | Quick prompts |

### 9.3 States & Behavior

| Element | States | Behavior | Error Handling |
|---------|--------|----------|----------------|
| **Drawer** | `closed`, `open`, `minimized` | Slide in/out; persist state | - |
| **Chat** | `idle`, `sending`, `streaming`, `error` | Send to Claude; stream response | Show error message; offer retry |
| **Message** | `sending`, `sent`, `error` | Show sending indicator | Red text for errors |
| **Diagram Update** | `pending`, `applied`, `failed` | Parse AI response; apply to graph | Show "Failed to update" with manual option |

### 9.4 Test Cases

| ID | Test Case | Type | Expected Result |
|----|-----------|------|-----------------|
| `AI-001` | Open chat drawer | Unit | Drawer slides in, input focused |
| `AI-002` | Send message | Integration | Message sent to API, response streamed |
| `AI-003` | Streaming response | Unit | Characters appear incrementally |
| `AI-004` | AI adds nodes | Integration | Nodes appear on canvas |
| `AI-005` | AI error response | Integration | Error message shown, retry available |
| `AI-006` | API timeout | Integration | "Request timed out" message |
| `AI-007` | View changes link | Unit | Highlights new elements on canvas |
| `AI-008` | Suggestion click | Unit | Suggestion text sent as message |
| `AI-009` | Empty message submit | Unit | Button disabled, no action |
| `AI-010` | Chat history scroll | Unit | Scrolls to bottom on new message |
| `AI-011` | Close drawer mid-stream | Unit | Request cancelled, partial preserved |
| `AI-012` | Multi-turn conversation | Integration | Context preserved across messages |

---

## 10. Import Screens

### 10.1 Import Dialog

```
┌────────────────────────────────────────────────────────────────────────────┐
│ IMPORT THREAT MODEL                                                   [×]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Choose import source:                                                     │
│                                                                            │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐   │
│  │       📁          │  │       🔗          │  │       📄          │   │
│  │                   │  │                   │  │                   │   │
│  │  From Repository  │  │   From Draw.io    │  │  From Document    │   │
│  │                   │  │                   │  │                   │   │
│  │  Terraform, K8s   │  │  Existing diagram │  │  PDF, Word, MD    │   │
│  │  Docker, OpenAPI  │  │                   │  │                   │   │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Repo Import Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│ IMPORT FROM REPOSITORY                                                [×]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Step 1 of 3: Connect Repository                                           │
│  ○───────────●───────────○                                                 │
│  Connect    Scan       Review                                              │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │  GitHub    [Connected as @user ✓]              [Disconnect]        │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  Repository URL:                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ https://github.com/org/repo                                        │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  Branch:                                                                   │
│  ┌─────────────────────┐                                                  │
│  │ main              ▼ │                                                  │
│  └─────────────────────┘                                                  │
│                                                                            │
│  Files to scan:                                                            │
│  ☑ Terraform (*.tf)                                                       │
│  ☑ Kubernetes (*.yaml in k8s/)                                            │
│  ☑ Docker Compose (docker-compose.yml)                                    │
│  ☐ CloudFormation (*.yaml)                                                │
│  ☑ OpenAPI (openapi.yaml, swagger.json)                                   │
│                                                                            │
│                                              [Cancel]  [Scan Repository →] │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Scan Progress

```
┌────────────────────────────────────────────────────────────────────────────┐
│ IMPORT FROM REPOSITORY                                                [×]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Step 2 of 3: Scanning Repository                                          │
│  ●───────────●───────────○                                                 │
│  Connect    Scan       Review                                              │
│                                                                            │
│  Scanning github.com/org/repo...                                           │
│                                                                            │
│  ████████████████░░░░░░░░░░░░░░░░  45%                                    │
│                                                                            │
│  ✓ Found 3 Terraform files                                                │
│  ✓ Found 5 Kubernetes manifests                                           │
│  ✓ Found docker-compose.yml                                               │
│  ◐ Parsing infrastructure...                                              │
│  ○ Building diagram...                                                    │
│                                                                            │
│  Discovered so far:                                                        │
│  • 8 compute resources                                                    │
│  • 3 databases                                                            │
│  • 2 load balancers                                                       │
│  • 12 connections                                                         │
│                                                                            │
│                                                    [Cancel]                │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.4 Review & Confirm

```
┌────────────────────────────────────────────────────────────────────────────┐
│ IMPORT FROM REPOSITORY                                                [×]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Step 3 of 3: Review Discovered Architecture                               │
│  ●───────────●───────────●                                                 │
│  Connect    Scan       Review                                              │
│                                                                            │
│  ┌──────────────────────────────────────────┬─────────────────────────┐   │
│  │                                          │ COMPONENTS (15)         │   │
│  │        [Diagram Preview]                 │                         │   │
│  │                                          │ ☑ ECS Cluster           │   │
│  │   ┌─────────┐      ┌─────────┐          │ ☑ API Service           │   │
│  │   │   ALB   │──────│   ECS   │          │ ☑ Worker Service        │   │
│  │   └─────────┘      └────┬────┘          │ ☑ RDS PostgreSQL        │   │
│  │                         │               │ ☑ ElastiCache           │   │
│  │                    ┌────┴────┐          │ ☑ S3 Bucket             │   │
│  │                    │   RDS   │          │ ☑ ALB                   │   │
│  │                    └─────────┘          │ ☐ CloudWatch (exclude)  │   │
│  │                                          │                         │   │
│  │                                          │ ⚠ 3 items need review   │   │
│  │                                          │                         │   │
│  └──────────────────────────────────────────┴─────────────────────────┘   │
│                                                                            │
│  ⚠ Some components need additional information:                           │
│  • API Service: Technology type unclear [Set →]                           │
│  • Worker Service: Technology type unclear [Set →]                        │
│  • S3 Bucket: Data classification needed [Set →]                          │
│                                                                            │
│                                    [← Back]  [Cancel]  [Create Model →]   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.5 Components

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `ImportDialog` | `components/import/ImportDialog.tsx` | `open`, `onClose`, `onComplete` | Main modal |
| `ImportSourceSelect` | `components/import/ImportSourceSelect.tsx` | `onSelect` | Source cards |
| `RepoConnector` | `components/import/RepoConnector.tsx` | `provider`, `onConnect` | OAuth flow |
| `RepoScanner` | `components/import/RepoScanner.tsx` | `repoUrl`, `onProgress`, `onComplete` | Scan progress |
| `ImportReview` | `components/import/ImportReview.tsx` | `graph`, `onConfirm` | Review step |
| `ComponentList` | `components/import/ComponentList.tsx` | `components`, `onToggle` | Checkbox list |
| `GapFillPrompt` | `components/import/GapFillPrompt.tsx` | `gaps`, `onFill` | Missing info |

### 10.6 Test Cases

| ID | Test Case | Type | Expected Result |
|----|-----------|------|-----------------|
| `I-001` | Open import dialog | Unit | Source selection shown |
| `I-002` | Select repo import | Unit | Repo connector shown |
| `I-003` | Connect GitHub OAuth | Integration | OAuth flow completes |
| `I-004` | Invalid repo URL | Unit | Validation error shown |
| `I-005` | Scan repo - success | Integration | Components discovered |
| `I-006` | Scan repo - no IaC found | Unit | "No infrastructure files found" message |
| `I-007` | Scan repo - timeout | Integration | Error with retry option |
| `I-008` | Review - exclude component | Unit | Component unchecked, removed from preview |
| `I-009` | Review - fill gap | Unit | Modal opens, value saved |
| `I-010` | Create model | Integration | Model created with discovered components |
| `I-011` | Import Draw.io XML | Integration | Diagram loaded into editor |
| `I-012` | Import document (PDF) | Integration | AI extraction runs, components discovered |
| `I-013` | Cancel mid-scan | Unit | Scan aborted, dialog closed |

---

## 11. Report Preview

### 11.1 Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ GENERATE REPORT                                                       [×]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Report Type:  [PDF ▼]                                                    │
│                                                                            │
│  Include Sections:                                                         │
│  ☑ Executive Summary                                                      │
│  ☑ Architecture Diagram                                                   │
│  ☑ Risk Inventory                                                         │
│  ☑ Compliance Gaps                                                        │
│  ☐ Full Risk Details                                                      │
│  ☑ Remediation Roadmap                                                    │
│                                                                            │
│  Compliance Frameworks:                                                    │
│  ☑ ISO 27001                                                              │
│  ☑ NIST 800-53                                                            │
│  ☐ PCI-DSS                                                                │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  PREVIEW                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ ┌────────────────────────────────────────────────────────────────┐  │ │
│  │ │                                                                │  │ │
│  │ │               THREAT MODEL REPORT                              │  │ │
│  │ │               Production API Architecture                      │  │ │
│  │ │                                                                │  │ │
│  │ │               Generated: Jan 23, 2025                          │  │ │
│  │ │                                                                │  │ │
│  │ └────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                      │ │
│  │  Page 1 of 12                                    [◀] [▶]            │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│                                    [Cancel]           [Download Report]    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Components

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `ReportDialog` | `components/report/ReportDialog.tsx` | `threatModelId`, `onClose` | Modal container |
| `ReportTypeSelect` | `components/report/ReportTypeSelect.tsx` | `type`, `onChange` | PDF/Excel selector |
| `SectionCheckboxes` | `components/report/SectionCheckboxes.tsx` | `sections`, `onChange` | Section toggles |
| `ReportPreview` | `components/report/ReportPreview.tsx` | `previewUrl` | PDF embed viewer |
| `ReportDownload` | `components/report/ReportDownload.tsx` | `onDownload`, `loading` | Download button |

### 11.3 Test Cases

| ID | Test Case | Type | Expected Result |
|----|-----------|------|-----------------|
| `RP-001` | Open report dialog | Unit | Options and preview shown |
| `RP-002` | Select PDF format | Unit | PDF preview rendered |
| `RP-003` | Select Excel format | Unit | Preview shows sheet names |
| `RP-004` | Toggle section off | Unit | Section removed from preview |
| `RP-005` | Select compliance framework | Unit | Preview updates with framework |
| `RP-006` | Download PDF | Integration | PDF file downloaded |
| `RP-007` | Download Excel | Integration | Excel file downloaded |
| `RP-008` | Generate with no risks | Unit | Report shows "No risks identified" |
| `RP-009` | Large report (100+ risks) | Performance | Generation completes < 30s |
| `RP-010` | Cancel mid-generation | Unit | Generation cancelled |

---

## 12. Version History Modal

### 12.1 Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ VERSION HISTORY                                                       [×]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────────────────┐  ┌────────────────────────────┐  │
│  │ VERSIONS                            │  │ CHANGES                    │  │
│  │                                     │  │                            │  │
│  │ ● v12 - Current                     │  │ Comparing v10 → v12        │  │
│  │   Jan 23, 2025 10:30am              │  │                            │  │
│  │   by @john                          │  │ Added:                     │  │
│  │                                     │  │ + Redis Cache              │  │
│  │ ○ v11 - Auto-save                   │  │ + ElastiCache boundary     │  │
│  │   Jan 23, 2025 10:15am              │  │                            │  │
│  │   by @john                          │  │ Modified:                  │  │
│  │                                     │  │ ~ API Server (auth changed)│  │
│  │ ○ v10 - "Before Redis"              │  │                            │  │
│  │   Jan 23, 2025 9:45am               │  │ Removed:                   │  │
│  │   by @jane                          │  │ - Legacy Worker            │  │
│  │                                     │  │                            │  │
│  │ ○ v9                                │  │ Risk Changes:              │  │
│  │   Jan 22, 2025 4:30pm               │  │ + 2 new risks identified   │  │
│  │   by @john                          │  │ - 1 risk resolved          │  │
│  │                                     │  │                            │  │
│  │ ○ v8                                │  │                            │  │
│  │ ○ v7                                │  │                            │  │
│  │ ○ v6                                │  │                            │  │
│  │ ...                                 │  │                            │  │
│  │                                     │  │                            │  │
│  │ [Load more]                         │  │                            │  │
│  └─────────────────────────────────────┘  └────────────────────────────┘  │
│                                                                            │
│  Selected: v10                          [View Diagram]  [Restore Version]  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Components

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `VersionHistoryModal` | `components/version/VersionHistoryModal.tsx` | `threatModelId`, `onClose` | Modal |
| `VersionList` | `components/version/VersionList.tsx` | `versions`, `selected`, `onSelect` | Version list |
| `VersionItem` | `components/version/VersionItem.tsx` | `version`, `isCurrent` | Single version |
| `VersionDiff` | `components/version/VersionDiff.tsx` | `fromVersion`, `toVersion` | Changes display |
| `VersionPreview` | `components/version/VersionPreview.tsx` | `version` | Read-only diagram |

### 12.3 Test Cases

| ID | Test Case | Type | Expected Result |
|----|-----------|------|-----------------|
| `V-001` | Open version history | Unit | Versions listed, current highlighted |
| `V-002` | Select old version | Unit | Diff shown against current |
| `V-003` | View old diagram | Unit | Read-only preview opens |
| `V-004` | Restore version | Integration | Current becomes copy of selected |
| `V-005` | Restore confirmation | Unit | Confirmation dialog shown |
| `V-006` | Load more versions | Unit | Pagination loads older versions |
| `V-007` | Diff shows added nodes | Unit | Green highlighted items |
| `V-008` | Diff shows removed nodes | Unit | Red highlighted items |
| `V-009` | Diff shows risk changes | Unit | Risk delta displayed |

---

## 13. Settings Screens

### 13.1 Model Settings

```
┌────────────────────────────────────────────────────────────────────────────┐
│ MODEL SETTINGS                                                        [×]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  [General] [CI/CD] [Integrations] [Sharing]                               │
│                                                                            │
│  ─────────────────────────────────────────────────────────────────────    │
│                                                                            │
│  Model Name                                                                │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ Production API Architecture                                        │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  Description                                                               │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ Main production API serving mobile and web clients                 │   │
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  Status                                                                    │
│  ┌─────────────────────┐                                                  │
│  │ Active            ▼ │                                                  │
│  └─────────────────────┘                                                  │
│                                                                            │
│  Default Compliance Frameworks                                             │
│  ☑ ISO 27001                                                              │
│  ☑ NIST 800-53                                                            │
│  ☐ PCI-DSS                                                                │
│  ☐ VPDSS                                                                  │
│                                                                            │
│  ─────────────────────────────────────────────────────────────────────    │
│                                                                            │
│  DANGER ZONE                                                               │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ Archive this model                               [Archive]         │   │
│  ├────────────────────────────────────────────────────────────────────┤   │
│  │ Delete this model permanently                    [Delete]          │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│                                              [Cancel]  [Save Changes]      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 13.2 Test Cases

| ID | Test Case | Type | Expected Result |
|----|-----------|------|-----------------|
| `S-001` | Open settings | Unit | Current values loaded |
| `S-002` | Change name | Unit | Save enabled |
| `S-003` | Save settings | Integration | Settings persisted |
| `S-004` | Archive model | Integration | Status changed, removed from active list |
| `S-005` | Delete model | Integration | Confirmation required, model deleted |
| `S-006` | CI/CD tab | Unit | Integration settings shown |
| `S-007` | Save CI/CD config | Integration | Webhook configured |
| `S-008` | Sharing tab | Unit | Share links listed |
| `S-009` | Create share link | Integration | Link generated |
| `S-010` | Revoke share link | Integration | Link invalidated |

---

## 14. Component Library

### 14.1 Shared Components

| Component | File | Props | Usage |
|-----------|------|-------|-------|
| `Button` | `components/ui/Button.tsx` | `variant`, `size`, `loading`, `disabled` | All buttons |
| `Input` | `components/ui/Input.tsx` | `label`, `error`, `helper` | Text inputs |
| `Select` | `components/ui/Select.tsx` | `options`, `placeholder` | Dropdowns |
| `Checkbox` | `components/ui/Checkbox.tsx` | `label`, `checked` | Toggles |
| `Modal` | `components/ui/Modal.tsx` | `open`, `onClose`, `title` | Dialogs |
| `Drawer` | `components/ui/Drawer.tsx` | `open`, `side`, `onClose` | Side panels |
| `Toast` | `components/ui/Toast.tsx` | `message`, `type` | Notifications |
| `Badge` | `components/ui/Badge.tsx` | `variant`, `color` | Status pills |
| `Card` | `components/ui/Card.tsx` | `title`, `actions` | Content cards |
| `Table` | `components/ui/Table.tsx` | `columns`, `data`, `sortable` | Data tables |
| `Tabs` | `components/ui/Tabs.tsx` | `tabs`, `active`, `onChange` | Tab navigation |
| `Tooltip` | `components/ui/Tooltip.tsx` | `content`, `position` | Hover info |
| `Skeleton` | `components/ui/Skeleton.tsx` | `width`, `height` | Loading states |
| `EmptyState` | `components/ui/EmptyState.tsx` | `icon`, `title`, `action` | No data states |
| `ErrorState` | `components/ui/ErrorState.tsx` | `error`, `onRetry` | Error states |
| `ConfirmDialog` | `components/ui/ConfirmDialog.tsx` | `title`, `message`, `onConfirm` | Confirmations |
| `ProgressBar` | `components/ui/ProgressBar.tsx` | `value`, `max`, `color` | Progress |
| `Spinner` | `components/ui/Spinner.tsx` | `size` | Loading spinner |
| `Avatar` | `components/ui/Avatar.tsx` | `src`, `name`, `size` | User avatars |
| `DropdownMenu` | `components/ui/DropdownMenu.tsx` | `items`, `trigger` | Context menus |

### 14.2 Design Tokens

```typescript
// colors.ts
export const colors = {
  severity: {
    critical: '#DC2626', // red-600
    high: '#EA580C',     // orange-600
    medium: '#CA8A04',   // yellow-600
    low: '#16A34A',      // green-600
  },
  status: {
    open: '#6B7280',     // gray-500
    inProgress: '#2563EB', // blue-600
    resolved: '#16A34A', // green-600
    accepted: '#9333EA', // purple-600
  },
  ui: {
    primary: '#2563EB',  // blue-600
    secondary: '#6B7280', // gray-500
    success: '#16A34A',  // green-600
    warning: '#CA8A04',  // yellow-600
    error: '#DC2626',    // red-600
  },
};

// spacing.ts
export const spacing = {
  xs: '0.25rem',  // 4px
  sm: '0.5rem',   // 8px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
};
```

---

## 15. Document References

| Doc | Purpose |
|-----|---------|
| `00_overview.md` | Product summary, vision, tiers |
| `01_product_context.md` | Personas, stories, JTBD |
| `02_functional_spec.md` | Features, behaviors |
| `03_technical_spec.md` | Architecture, stack, APIs |
| `04_data_models.md` | Schema definitions, mappings |
| **`05_ui_screens.md`** | **This document** — UI specifications |
| `06_user_flows.md` | Step-by-step user journeys |
| `07_admin_console.md` | Admin app specification |
| `08_rules.md` | Code constraints for Claude Code |
| `09_implementation_plan.md` | Phased build order |

---

*Last updated: 2025-01-23*
*Author: ThreatDiviner Product Team*
