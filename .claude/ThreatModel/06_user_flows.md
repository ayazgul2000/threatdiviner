# 06 — User Flows

## Implementation Protocol

**CRITICAL: For every flow below, Claude Code must:**

1. **Implement** all steps with proper state transitions and error handling
2. **Test** each flow end-to-end with happy path + all error branches
3. **Checkpoint** — Output: (a) flow diagram/screenshot, (b) test results, (c) error paths verified
4. **Await Approval** — Do NOT proceed to next flow until explicit approval received

---

## 1. New Model from Scratch

### 1.1 Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Dashboard  │────▶│ Create Modal│────▶│   Editor    │────▶│ Run Analysis│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       │                   ▼                   ▼                   ▼
       │            [Validation Error]  [Save Error]       [Analysis Error]
       │                   │                   │                   │
       │                   ▼                   ▼                   ▼
       │             Show error,         Retry/Backup        Show error,
       │             keep modal open     to localStorage      offer retry
       │
       ▼
  [API Error] ──▶ Show error state with retry
```

### 1.2 Step-by-Step

| Step | User Action | System Response | State Change | Error Handling |
|------|-------------|-----------------|--------------|----------------|
| 1 | Click "+ New Model" on Dashboard | Open CreateModelDialog | `dialog: open` | - |
| 2 | Enter model name "Production API" | Validate: required, max 255 | `name: valid` | Show inline error if invalid |
| 3 | (Optional) Enter description | No validation | `description: set` | - |
| 4 | (Optional) Select template | Load template preview | `template: selected` | Toast if template load fails |
| 5 | Click "Create" | POST /api/threat-models | `dialog: submitting` | Toast error, keep dialog open |
| 6 | - | Response: model created | Redirect to /editor/{id} | - |
| 7 | Editor loads | GET /api/threat-models/{id}/diagram | `editor: loading` | Error state with retry |
| 8 | - | Canvas renders (blank or template) | `editor: ready` | - |
| 9 | Drag shape from palette | Ghost preview follows cursor | `dragging: true` | - |
| 10 | Drop on canvas | Create node at position | `assets: [new]` | Snap to valid position |
| 11 | Property panel opens | Load defaults from shape mapping | `panel: editing` | Use fallback defaults |
| 12 | Configure properties | Validate each field on blur | `asset: dirty` | Show field errors |
| 13 | Click "Apply" | Update asset in graph | `asset: saved` | Highlight invalid fields |
| 14 | Repeat 9-13 for more assets | - | - | - |
| 15 | Draw connection between nodes | Show connector preview | `connecting: true` | Cancel on invalid target |
| 16 | Connection created | Link property modal opens | `links: [new]` | - |
| 17 | Configure link properties | Validate fields | `link: dirty` | Show field errors |
| 18 | Click "Save" (Ctrl+S) | PUT /api/threat-models/{id}/diagram | `saving: true` | Retry 3x, local backup |
| 19 | - | Response: version created | `saved: true`, toast "Saved" | - |
| 20 | Click "Run Analysis" | Check for validation gaps | `validating: true` | - |
| 21a | (If gaps) | Show GapFillDialog | `gaps: [list]` | - |
| 21b | Fill required fields | Validate, update assets | `gaps: resolved` | Block until resolved |
| 22 | Analysis starts | POST /api/threat-models/{id}/analyze | `analysis: queued` | Toast error if queue fails |
| 23 | - | Progress modal with WebSocket updates | `analysis: running` | Timeout after 120s |
| 24 | - | Response: analysis complete | `analysis: complete` | Show error details |
| 25 | Risks populate in panel | Load risks from analysis run | `risks: loaded` | Empty state if no risks |
| 26 | AI triage runs (background) | Batch triage via Claude API | `risks: triaging` | Skip if AI fails, manual triage available |
| 27 | Risks updated with triage | Severity adjustments applied | `risks: triaged` | - |

### 1.3 Preconditions

- User is authenticated
- User has valid license for Threat Modeling product
- User is on Dashboard page

### 1.4 Postconditions

- New threat model exists in database
- Diagram version saved
- Analysis run completed
- Risks identified and triaged

### 1.5 Error Scenarios

| Error | Trigger | Response | Recovery |
|-------|---------|----------|----------|
| `E1-001` | Network failure on create | Toast "Failed to create model" | Retry button in dialog |
| `E1-002` | Name already exists | Inline error "Name already taken" | User changes name |
| `E1-003` | Editor fails to load | Error state with retry | Click retry or go back |
| `E1-004` | Shape drag outside canvas | Shape snaps back | User drags again |
| `E1-005` | Save fails - network | Toast + local backup | Retry or restore from backup |
| `E1-006` | Save fails - locked | Toast "Locked by [user]" | Wait or force save |
| `E1-007` | Analysis timeout | Toast "Timed out" + retry | Simplify model or retry |
| `E1-008` | Threagile crash | Toast "Analysis failed" | View logs, retry |
| `E1-009` | AI triage fails | Risks shown without triage | Manual triage available |

### 1.6 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `T1-001` | Happy path | Complete all steps | Model created, risks shown |
| `T1-002` | Cancel create | Click X on dialog | Dialog closes, no model |
| `T1-003` | Invalid name | Enter 300 chars | Error shown, submit blocked |
| `T1-004` | Create from template | Select template, create | Template diagram loaded |
| `T1-005` | Save before assets | Click save with empty canvas | Save succeeds (empty diagram) |
| `T1-006` | Run analysis without assets | Click Run Analysis | Error "Add at least one asset" |
| `T1-007` | Network fail during save | Disconnect during save | Local backup, retry shown |
| `T1-008` | Refresh with unsaved changes | F5 with dirty state | Confirmation dialog |

---

## 2. New Model from Repository Import

### 2.1 Flow Diagram

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Dashboard│───▶│  Import  │───▶│  Connect │───▶│   Scan   │───▶│  Review  │
│          │    │  Dialog  │    │   Repo   │    │   Repo   │    │ & Create │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │               │               │               │
                     ▼               ▼               ▼               ▼
               [Source Select]  [OAuth Flow]   [Scan Progress]  [Gap Fill]
                                    │               │               │
                                    ▼               ▼               ▼
                              [OAuth Error]   [Scan Error]    [Validation]
```

### 2.2 Step-by-Step

| Step | User Action | System Response | State Change | Error Handling |
|------|-------------|-----------------|--------------|----------------|
| 1 | Click "Import" on Dashboard | Open ImportDialog | `dialog: open` | - |
| 2 | Select "From Repository" | Show RepoConnector | `source: repo` | - |
| 3 | Select provider (GitHub) | Check existing OAuth token | `provider: github` | - |
| 4a | (If not connected) Click "Connect" | Redirect to GitHub OAuth | `oauth: pending` | - |
| 4b | Complete OAuth flow | Callback with code, exchange for token | `oauth: success` | Toast "Connection failed" |
| 5 | Enter repository URL | Validate URL format | `repoUrl: valid` | Inline error if invalid |
| 6 | Select branch | Load branches from API | `branch: selected` | Toast if API fails |
| 7 | Select file types to scan | Toggle checkboxes | `fileTypes: [...]` | - |
| 8 | Click "Scan Repository" | POST /api/import/repo/scan | `scan: started` | Toast error if fails |
| 9 | - | Progress updates via WebSocket | `scan: progress 0-100%` | - |
| 10 | - | Files discovered incrementally | `discovered: [components]` | - |
| 11 | - | Scan complete | `scan: complete` | Error state with details |
| 12 | Review discovered components | Render preview diagram | `review: active` | - |
| 13 | Toggle components on/off | Update preview | `components: filtered` | - |
| 14 | Click items needing review | Open gap-fill modal | `gaps: filling` | - |
| 15 | Fill required properties | Validate inputs | `gaps: resolved` | Block until resolved |
| 16 | Click "Create Model" | POST /api/threat-models with components | `creating: true` | Toast error, stay on review |
| 17 | - | Model created with diagram | Redirect to /editor/{id} | - |

### 2.3 Preconditions

- User is authenticated
- User has Pro or Enterprise license (repo import)
- Repository is accessible (public or user has access)

### 2.4 Postconditions

- OAuth token stored (if new connection)
- Threat model created with discovered components
- Diagram includes auto-laid-out assets and connections
- User in editor with imported diagram

### 2.5 Supported Parsers

| File Type | Patterns | What's Extracted |
|-----------|----------|------------------|
| Terraform | `*.tf` | aws_*, azurerm_*, google_* resources, VPCs, subnets, security groups |
| Kubernetes | `*.yaml` in k8s/, manifests/ | Deployments, Services, Ingresses, ConfigMaps, Secrets |
| Docker Compose | `docker-compose*.yml` | Services, networks, volumes, dependencies |
| CloudFormation | `template.yaml`, `*.cfn.yaml` | AWS resources, outputs, parameters |
| Serverless | `serverless.yml` | Functions, API Gateway, triggers |
| OpenAPI | `openapi.yaml`, `swagger.json` | Endpoints, auth schemes, servers |
| Pulumi | `Pulumi.yaml`, `index.ts` | Resources (limited support) |

### 2.6 Error Scenarios

| Error | Trigger | Response | Recovery |
|-------|---------|----------|----------|
| `E2-001` | OAuth denied | Toast "Authorization denied" | Retry OAuth |
| `E2-002` | OAuth expired | Prompt to reconnect | Re-run OAuth flow |
| `E2-003` | Repo not found | Toast "Repository not found" | Check URL, permissions |
| `E2-004` | No IaC files found | "No infrastructure files found" message | Manual creation or different repo |
| `E2-005` | Scan timeout | Toast "Scan timed out" | Reduce scope, retry |
| `E2-006` | Parse error | Show failed files, continue with rest | Manual review of failures |
| `E2-007` | Too many components (>200) | Warning, suggest splitting | User can proceed or reduce |

### 2.7 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `T2-001` | Happy path GitHub | Connect, scan, create | Model with discovered infra |
| `T2-002` | OAuth cancel | Start OAuth, click cancel | Returns to connect screen |
| `T2-003` | Private repo access | Scan private repo | Components discovered |
| `T2-004` | No IaC in repo | Scan repo without Terraform/K8s | "No files found" message |
| `T2-005` | Mixed file types | Repo with TF + K8s | Both parsed, merged |
| `T2-006` | Scan timeout | Large repo, slow network | Timeout message, retry available |
| `T2-007` | Exclude component | Uncheck during review | Component not in final model |
| `T2-008` | Fill all gaps | Complete gap-fill | Create enabled |

---

## 3. New Model from Document Upload

### 3.1 Flow Diagram

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Dashboard│───▶│  Import  │───▶│  Upload  │───▶│    AI    │───▶│  Review  │
│          │    │  Dialog  │    │   File   │    │ Extract  │    │ & Create │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │               │               │               │
                     ▼               ▼               ▼               ▼
               [Source Select]  [File Valid?]  [AI Processing]  [Corrections]
                                    │               │
                                    ▼               ▼
                              [Invalid File]   [AI Error]
```

### 3.2 Step-by-Step

| Step | User Action | System Response | State Change | Error Handling |
|------|-------------|-----------------|--------------|----------------|
| 1 | Click "Import" on Dashboard | Open ImportDialog | `dialog: open` | - |
| 2 | Select "From Document" | Show file upload zone | `source: document` | - |
| 3 | Drag/drop or select file | Validate file type and size | `file: validating` | Error if invalid |
| 4 | - | Upload file to server | `file: uploading` | Retry on failure |
| 5 | - | Extract text from document | `file: processing` | Error if extraction fails |
| 6 | - | Send to Claude for extraction | `ai: processing` | Timeout after 60s |
| 7 | - | AI returns identified components | `ai: complete` | Fallback to manual if AI fails |
| 8 | Review extracted components | Render preview diagram | `review: active` | - |
| 9 | Correct/adjust components | Edit in preview | `components: modified` | - |
| 10 | Fill missing properties | Gap-fill prompts | `gaps: resolved` | - |
| 11 | Click "Create Model" | POST /api/threat-models | `creating: true` | - |
| 12 | - | Model created | Redirect to /editor/{id} | - |

### 3.3 Supported Document Types

| Type | Extension | Max Size | Processing |
|------|-----------|----------|------------|
| PDF | `.pdf` | 20MB | PyPDF2 extraction → Claude |
| Word | `.docx` | 10MB | python-docx extraction → Claude |
| Markdown | `.md` | 5MB | Direct text → Claude |
| Plain Text | `.txt` | 5MB | Direct text → Claude |
| HTML | `.html` | 5MB | BeautifulSoup extraction → Claude |

### 3.4 AI Extraction Prompt

```
Analyze this architecture document and extract:

1. Technical components (servers, databases, services, etc.)
2. Trust boundaries (networks, VPCs, zones)
3. Data flows between components
4. Technologies used (infer from context)
5. Authentication/encryption mechanisms mentioned

Return as JSON:
{
  "assets": [{ "name": "...", "technology": "...", "description": "..." }],
  "boundaries": [{ "name": "...", "type": "...", "contains": ["..."] }],
  "links": [{ "source": "...", "target": "...", "protocol": "...", "description": "..." }],
  "dataAssets": [{ "name": "...", "classification": "..." }]
}
```

### 3.5 Error Scenarios

| Error | Trigger | Response | Recovery |
|-------|---------|----------|----------|
| `E3-001` | Invalid file type | Toast "Unsupported file type" | Select valid file |
| `E3-002` | File too large | Toast "File exceeds 20MB limit" | Compress or split file |
| `E3-003` | Upload failed | Toast "Upload failed" | Retry upload |
| `E3-004` | Text extraction failed | Toast "Could not read document" | Try different format |
| `E3-005` | AI extraction timeout | Toast "Processing timed out" | Retry or manual creation |
| `E3-006` | AI returned no components | "No architecture found" message | Manual creation |
| `E3-007` | AI hallucination | Incorrect components | User corrections in review |

### 3.6 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `T3-001` | Happy path PDF | Upload arch doc, create | Components extracted |
| `T3-002` | Invalid file type | Upload .exe | Error message |
| `T3-003` | Large file | Upload 25MB PDF | Size error |
| `T3-004` | Empty document | Upload blank PDF | "No content found" |
| `T3-005` | Non-architecture doc | Upload random text | "No architecture found" |
| `T3-006` | Word document | Upload .docx | Components extracted |
| `T3-007` | Correct AI errors | Edit extracted name | Correction saved |
| `T3-008` | Cancel upload | Click X during upload | Upload cancelled |

---

## 4. New Model from AI Chat

### 4.1 Flow Diagram

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Dashboard│───▶│  Editor  │───▶│ AI Chat  │───▶│  Iterate │
│          │    │ (empty)  │    │  Drawer  │    │ & Refine │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │               │               │
                     │               ▼               │
                     │         [User Message]        │
                     │               │               │
                     │               ▼               │
                     │         [AI Streams]         │
                     │               │               │
                     │               ▼               │
                     ◀───────[Diagram Updates]◀──────┘
```

### 4.2 Step-by-Step

| Step | User Action | System Response | State Change | Error Handling |
|------|-------------|-----------------|--------------|----------------|
| 1 | Click "+ New Model" | Create blank model | Redirect to editor | - |
| 2 | Click "Build with AI" button | Open AIChatDrawer | `chat: open` | - |
| 3 | Type description: "React app on Vercel with Node API on AWS" | Enable send button | `input: valid` | - |
| 4 | Click Send (or Enter) | POST /api/ai/chat with context | `chat: sending` | - |
| 5 | - | Claude streams response | `chat: streaming` | Timeout after 60s |
| 6 | - | Parse JSON deltas from response | `diagram: updating` | Skip invalid deltas |
| 7 | - | Add nodes to canvas incrementally | `assets: [new, ...]` | - |
| 8 | - | Stream completes | `chat: idle` | - |
| 9 | Review diagram | View added components | - | - |
| 10 | Type follow-up: "Add Redis cache" | - | `input: valid` | - |
| 11 | Send | Include current diagram state in context | `chat: sending` | - |
| 12 | - | AI adds Redis, connects to API | `assets: updated` | - |
| 13 | Repeat 10-12 as needed | - | - | - |
| 14 | Click "Save" | Save diagram state | `saved: true` | - |
| 15 | Close chat drawer | Chat persisted for session | `chat: closed` | - |

### 4.3 AI Chat Protocol

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "React app on Vercel with Node API on AWS" }
  ],
  "currentDiagram": {
    "assets": [],
    "boundaries": [],
    "links": []
  }
}
```

**Streaming Response:**
```json
{ "type": "text", "content": "I'll create a diagram with..." }
{ "type": "delta", "action": "addNode", "node": { "name": "Browser", "technology": "browser" } }
{ "type": "delta", "action": "addNode", "node": { "name": "Vercel", "technology": "cdn" } }
{ "type": "delta", "action": "addLink", "link": { "source": "Browser", "target": "Vercel" } }
{ "type": "text", "content": "I've added the frontend components..." }
```

### 4.4 Error Scenarios

| Error | Trigger | Response | Recovery |
|-------|---------|----------|----------|
| `E4-001` | AI timeout | Toast "Request timed out" | Retry button |
| `E4-002` | AI error | Toast "AI unavailable" | Manual editing |
| `E4-003` | Invalid delta | Log error, skip delta | Continue with valid deltas |
| `E4-004` | Rate limited | Toast "Too many requests" | Wait and retry |
| `E4-005` | Context too large | Toast "Diagram too complex for AI" | Manual editing |

### 4.5 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `T4-001` | Happy path | Describe system, AI builds | Diagram populated |
| `T4-002` | Follow-up message | Add component via chat | Component added |
| `T4-003` | Modify existing | "Change API to Lambda" | API replaced with Lambda |
| `T4-004` | Remove component | "Remove the cache" | Cache node removed |
| `T4-005` | AI timeout | Slow response | Timeout message, retry |
| `T4-006` | Empty message | Send with no text | Button disabled |
| `T4-007` | Close mid-stream | Close drawer during response | Stream cancelled |
| `T4-008` | Multi-turn context | 5 messages back and forth | Context preserved |

---

## 5. New Model from Wizard

### 5.1 Flow Diagram

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Dashboard│───▶│  Wizard  │───▶│ Question │───▶│ Question │───▶│  Review  │
│          │    │  Start   │    │    1     │    │   2..N   │    │ & Create │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │               │               │               │
                     ▼               ▼               ▼               ▼
               [Load Questions]  [Apply Triggers]  [Build Diagram]  [Create]
                     │
                     ▼
               [Load Error]
```

### 5.2 Step-by-Step

| Step | User Action | System Response | State Change | Error Handling |
|------|-------------|-----------------|--------------|----------------|
| 1 | Click "Guided Setup" | Load wizard questions from DB | `wizard: loading` | Error state with retry |
| 2 | - | Render first question | `question: 1` | - |
| 3 | Select option (e.g., "Web App") | Apply triggers, update preview | `answers: {q1: "web-app"}` | - |
| 4 | Click "Next" | Load next question | `question: 2` | - |
| 5 | Select cloud provider | Apply triggers (add boundary) | `preview: updated` | - |
| 6 | Click "Next" | Evaluate conditions for Q3 | `question: 3` | Skip if conditions not met |
| 7 | Repeat 3-6 for all questions | - | - | - |
| 8 | Reach final question | Show "Review" button | `question: final` | - |
| 9 | Click "Review" | Show full preview diagram | `review: active` | - |
| 10 | (Optional) Go back to adjust | Navigate to previous questions | `question: N` | Preserve all answers |
| 11 | Click "Create Model" | POST /api/threat-models with wizard output | `creating: true` | Error toast |
| 12 | - | Model created with generated diagram | Redirect to /editor/{id} | - |

### 5.3 Question Flow Example

```
Q1: App Type? 
    → "Web App" → adds Browser node, sets appType=web-app
    
Q2: Cloud Provider?
    → "AWS" → adds AWS Cloud boundary, VPC boundary
    
Q3: Compute Type? (condition: cloudProvider=aws|azure|gcp)
    → "ECS" → adds ECS Service node inside VPC
    
Q4: Database? 
    → "RDS" → adds RDS node, Private Subnet boundary, link from ECS to RDS
    
Q5: Authentication?
    → "Cognito" → adds Cognito node, links to Browser and ECS
    
Q6: Internet Facing?
    → "Yes" → sets internetFacing=true on ECS, adds ALB
    
Q7: CDN/WAF?
    → "Both" → adds CloudFront, WAF nodes
    
Q8: Data Classification?
    → "PII, Credentials" → creates data assets, sets classification
```

### 5.4 Error Scenarios

| Error | Trigger | Response | Recovery |
|-------|---------|----------|----------|
| `E5-001` | Questions fail to load | Error state | Retry button |
| `E5-002` | Invalid trigger config | Skip trigger, log error | Continue with partial |
| `E5-003` | Preview render fails | Show error in preview pane | Continue, fix in editor |
| `E5-004` | Create fails | Toast error | Stay on review, retry |

### 5.5 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `T5-001` | Happy path | Answer all, create | Model with full diagram |
| `T5-002` | Skip optional | Leave optional blank | Create succeeds |
| `T5-003` | Back navigation | Go back, change answer | Preview updates |
| `T5-004` | Conditional skip | Select "on-prem", skip cloud Q | Cloud questions hidden |
| `T5-005` | Cancel wizard | Click X | Confirmation, discard |
| `T5-006` | Resume wizard | Close and reopen | Progress restored |
| `T5-007` | Multi-select | Select multiple auth methods | All applied |
| `T5-008` | Questions from DB | Load fresh | Dynamic, not hardcoded |

---

## 6. Edit Existing Model

### 6.1 Flow Diagram

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Dashboard│───▶│  Editor  │───▶│ Acquire  │───▶│   Edit   │───▶│   Save   │
│          │    │   Load   │    │   Lock   │    │ Diagram  │    │ & Close  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │               │               │               │
                     ▼               ▼               ▼               ▼
               [Load Error]    [Lock Failed]   [Auto-save]    [Release Lock]
                                    │
                                    ▼
                              [View-Only Mode]
```

### 6.2 Step-by-Step

| Step | User Action | System Response | State Change | Error Handling |
|------|-------------|-----------------|--------------|----------------|
| 1 | Click model card on Dashboard | Navigate to /editor/{id} | `route: editor` | - |
| 2 | - | GET /api/threat-models/{id}/diagram | `editor: loading` | Error state |
| 3 | - | Render canvas with existing diagram | `editor: ready` | Recovery dialog if corrupt |
| 4 | - | POST /api/threat-models/{id}/lock | `lock: acquiring` | - |
| 5a | (If lock acquired) | Set lock.acquired = true | `lock: owned` | - |
| 5b | (If locked by other) | Show "Locked by [user]" banner | `lock: view-only` | View-only mode |
| 6 | Make first edit | Mark diagram dirty | `dirty: true` | - |
| 7 | - | Start auto-save timer (60s) | `autoSave: scheduled` | - |
| 8 | Continue editing | Update graph state | - | - |
| 9 | (Every 60s) | PUT /api/threat-models/{id}/diagram | `autoSave: saving` | Local backup on fail |
| 10 | Click "Save" (manual) | PUT with versionName | `saving: true` | Retry 3x |
| 11 | - | Response: version created | `saved: true` | - |
| 12 | Navigate away or close tab | Release lock | `lock: releasing` | - |
| 13 | (If tab closed without save) | Prompt "Unsaved changes" | - | Confirm discard |
| 14 | (On timeout 5min idle) | Release lock automatically | `lock: expired` | Toast notification |

### 6.3 Lock Behavior

| Scenario | Behavior |
|----------|----------|
| User A opens model | Lock acquired by A |
| User B opens same model | B sees "Locked by A", view-only |
| A saves and closes | Lock released |
| B refreshes | B can acquire lock |
| A is idle 5min | Lock released |
| A tries to save after lock expired | Conflict dialog, save-as-copy option |

### 6.4 Error Scenarios

| Error | Trigger | Response | Recovery |
|-------|---------|----------|----------|
| `E6-001` | Model not found | Error page | Go to dashboard |
| `E6-002` | Model deleted while editing | Toast "Model deleted" | Go to dashboard |
| `E6-003` | Lock stolen (admin) | Toast "Lock released" | Save-as-copy |
| `E6-004` | Auto-save fails | Local backup, continue | Manual save |
| `E6-005` | Version conflict | Conflict dialog | Merge or overwrite |

### 6.5 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `T6-001` | Happy path | Open, edit, save, close | Changes saved |
| `T6-002` | View-only mode | Open locked model | Edit disabled, view works |
| `T6-003` | Lock timeout | Idle 5+ minutes | Lock released, toast |
| `T6-004` | Concurrent edit attempt | User B tries to edit | View-only for B |
| `T6-005` | Auto-save triggers | Wait 60s after edit | Save happens silently |
| `T6-006` | Close with unsaved | Close tab while dirty | Confirmation dialog |
| `T6-007` | Save-as-copy | After lock expired | New version created |
| `T6-008` | Force release (admin) | Admin releases lock | Original user notified |

---

## 7. Run Threat Analysis

### 7.1 Flow Diagram

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Editor  │───▶│  Validate│───▶│  Queue   │───▶│   Run    │───▶│ Load     │
│          │    │   Gaps   │    │   Job    │    │ Threagile│    │ Risks    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │               │               │               │
                     ▼               ▼               ▼               ▼
               [Show GapFill]  [Queue Error]   [Timeout]      [AI Triage]
                     │                             │               │
                     ▼                             ▼               ▼
               [Fill & Retry]              [Retry/Manual]    [Load Risks]
```

### 7.2 Step-by-Step

| Step | User Action | System Response | State Change | Error Handling |
|------|-------------|-----------------|--------------|----------------|
| 1 | Click "Run Analysis" | Check for validation gaps | `validating: true` | - |
| 2a | (If gaps exist) | Show GapFillDialog with required fields | `gaps: [list]` | - |
| 2b | Fill required fields | Validate inputs | `gaps: resolving` | Block submit if invalid |
| 2c | Click "Continue" | Update assets with filled values | `gaps: resolved` | - |
| 3 | (If no gaps) | Save current diagram state | `saving: true` | Error toast |
| 4 | - | POST /api/threat-models/{id}/analyze | `analysis: queued` | Error toast, retry |
| 5 | - | Open progress modal | `modal: open` | - |
| 6 | - | WebSocket: progress updates | `progress: 0-100%` | Timeout after 120s |
| 7 | - | Generate Threagile YAML | `progress: 10%` | Error if generation fails |
| 8 | - | Execute Threagile Docker | `progress: 30%` | Threagile error handling |
| 9 | - | Parse Threagile results | `progress: 60%` | Parse error handling |
| 10 | - | Map and deduplicate risks | `progress: 80%` | - |
| 11 | - | Queue AI triage batch | `progress: 90%` | Skip if AI unavailable |
| 12 | - | Analysis complete | `analysis: complete` | - |
| 13 | - | Close modal, load risks | `risks: loading` | - |
| 14 | - | Risks populated in panel | `risks: loaded` | Empty state if no risks |
| 15 | - | AI triage completes (async) | `risks: triaged` | Manual triage available |

### 7.3 Gap Detection Rules

| Field | Required When | Message |
|-------|---------------|---------|
| `technology` | Always | "Technology type is required" |
| `authentication` | `internetFacing = true` | "Internet-facing assets require authentication" |
| `dataAssetsStored` | `technology = 'database'` | "Database should specify stored data" |
| `protocol` | Always (on links) | "Protocol is required for connections" |
| `boundaryType` | Always (on boundaries) | "Boundary type is required" |

### 7.4 Progress Stages

| Stage | Progress | Description | Duration |
|-------|----------|-------------|----------|
| Validating | 0-5% | Check diagram completeness | < 1s |
| Generating YAML | 5-20% | Convert diagram to Threagile format | < 5s |
| Running Engine | 20-60% | Execute Threagile container | 10-90s |
| Processing Results | 60-80% | Parse JSON, map to canonical risks | < 5s |
| AI Triage | 80-95% | Claude analysis of each risk | 5-30s |
| Finalizing | 95-100% | Save risks, update UI | < 2s |

### 7.5 Error Scenarios

| Error | Trigger | Response | Recovery |
|-------|---------|----------|----------|
| `E7-001` | Empty diagram | Button disabled | Add assets first |
| `E7-002` | Gaps not filled | Block analysis | Fill required fields |
| `E7-003` | Save before analysis fails | Toast error | Retry save |
| `E7-004` | Queue full | Toast "System busy" | Retry in 30s |
| `E7-005` | Threagile timeout (120s) | Toast "Analysis timed out" | Simplify model, retry |
| `E7-006` | Threagile crash | Toast with error details | View logs, retry |
| `E7-007` | Invalid YAML generated | Toast "Generation error" | Manual fix |
| `E7-008` | AI triage fails | Risks shown without triage | Manual triage |

### 7.6 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `T7-001` | Happy path | Run analysis on valid diagram | Risks populated |
| `T7-002` | With gaps | Run with missing tech | Gap dialog shown |
| `T7-003` | Fill gaps then run | Complete gaps, continue | Analysis proceeds |
| `T7-004` | Cancel analysis | Click cancel during run | Job cancelled |
| `T7-005` | Threagile timeout | Very large diagram | Timeout error, retry |
| `T7-006` | No risks found | Simple, secure diagram | "No risks" message |
| `T7-007` | Many risks (50+) | Complex diagram | All risks loaded |
| `T7-008` | AI triage timeout | Slow Claude response | Risks without triage |

---

## 8. Review and Triage Risks

### 8.1 Flow Diagram

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Risk    │───▶│  Filter  │───▶│  Select  │───▶│  Triage  │
│  Panel   │    │  & Sort  │    │   Risk   │    │  Action  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                      │               │
                                      ▼               ▼
                               [Highlight Asset]  [Update Status]
                                                      │
                                                      ▼
                                              [Create Ticket]
```

### 8.2 Step-by-Step

| Step | User Action | System Response | State Change | Error Handling |
|------|-------------|-----------------|--------------|----------------|
| 1 | View Risk Panel | Risks grouped by severity | `panel: loaded` | Empty state if no risks |
| 2 | Click filter dropdown | Show filter options | `filter: open` | - |
| 3 | Select "Critical only" | Filter risk list | `filter: {severity: ['critical']}` | - |
| 4 | Click risk card | Highlight affected asset on canvas | `selected: risk-id` | - |
| 5 | Click "Expand" | Show full risk details | `expanded: true` | - |
| 6 | Review description, remediation | - | - | - |
| 7 | Click "Triage" dropdown | Show status options | `triage: open` | - |
| 8a | Select "Accept" | Show justification input | `status: accepting` | - |
| 8b | Enter justification | Validate not empty | `justification: valid` | Error if empty |
| 8c | Confirm | PUT /api/risks/{id}/triage | `status: accepted` | Toast error |
| 9 | - | Risk de-emphasized in list | `risk: updated` | - |
| 10 | Click "View Attack Path" | Open AttackPathModal | `modal: attack-path` | - |
| 11 | Review path visualization | - | - | - |
| 12 | Click "Create Ticket" | Open ticket creation dialog | `modal: ticket` | - |

### 8.3 Triage Actions

| Action | New Status | Justification Required | Effect |
|--------|------------|----------------------|--------|
| Acknowledge | `in-progress` | No | Marks as being worked on |
| Mark Mitigated | `mitigated` | No | Treated but not verified |
| Mark Resolved | `resolved` | No | Fully addressed |
| Accept Risk | `accepted` | Yes | Business acceptance |
| False Positive | `false-positive` | Yes | Excluded from counts |
| Reopen | `open` | No | Reset to original state |

### 8.4 Filter Options

| Filter | Options |
|--------|---------|
| Severity | Critical, High, Medium, Low |
| Status | Open, In Progress, Mitigated, Resolved, Accepted, False Positive |
| Framework | ISO 27001, NIST 800-53, PCI-DSS, etc. |
| Asset | List of assets in diagram |
| CWE | CWE IDs present in risks |

### 8.5 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `T8-001` | View all risks | Open risk panel | Risks grouped by severity |
| `T8-002` | Filter by severity | Select "High" | Only high risks shown |
| `T8-003` | Click risk | Click card | Asset highlighted |
| `T8-004` | Accept risk | Triage → Accept → Justify | Status updated |
| `T8-005` | Accept without justification | Try to confirm empty | Error shown |
| `T8-006` | Resolve risk | Triage → Resolve | Status updated |
| `T8-007` | Reopen resolved | Triage → Reopen | Status back to open |
| `T8-008` | Bulk triage | Select multiple, triage | All updated |
| `T8-009` | View attack path | Click "Attack Path" | Modal with path |
| `T8-010` | Search risks | Type "SQL" | Matching risks shown |

---

## 9. Generate Compliance Report

### 9.1 Flow Diagram

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Editor   │───▶│Compliance│───▶│  Select  │───▶│  View    │───▶│ Download │
│          │    │   Tab    │    │Frameworks│    │  Gaps    │    │  Report  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │               │
                                                      ▼               ▼
                                                [View Control]  [PDF/Excel]
```

### 9.2 Step-by-Step

| Step | User Action | System Response | State Change | Error Handling |
|------|-------------|-----------------|--------------|----------------|
| 1 | Click "Compliance" tab | Load compliance view | `tab: compliance` | Error state |
| 2 | Check frameworks | Load framework stats | `frameworks: [iso, nist]` | - |
| 3 | - | Calculate gaps from risks | `stats: calculated` | - |
| 4 | View compliance cards | Show % compliant per framework | - | - |
| 5 | Click "View Details" on card | Expand control list | `expanded: true` | - |
| 6 | Click gap item | Show control details modal | `modal: control` | - |
| 7 | View related risks | Risks listed in modal | - | - |
| 8 | Click "View Remediation" | Open remediation panel | `panel: remediation` | - |
| 9 | Click "Export Report" | Open report dialog | `dialog: report` | - |
| 10 | Select format (PDF) | - | `format: pdf` | - |
| 11 | Select sections | Toggle checkboxes | `sections: [...]` | - |
| 12 | Click "Download" | POST /api/reports/generate | `generating: true` | Error toast |
| 13 | - | Generate PDF | `progress: 0-100%` | - |
| 14 | - | Download starts | `download: started` | Retry if fails |

### 9.3 Report Sections

| Section | PDF | Excel | Content |
|---------|-----|-------|---------|
| Executive Summary | ✓ | Summary sheet | Risk counts, compliance %, top 5 |
| Architecture Diagram | ✓ | - | PNG export of diagram |
| Risk Inventory | ✓ | Risks sheet | All risks with details |
| Compliance Gaps | ✓ | Compliance sheet | Controls by framework |
| Remediation Roadmap | ✓ | Remediations sheet | Prioritized fixes |
| Full Risk Details | ✓ | - | Extended descriptions |
| Appendix | ✓ | - | Data assets, tech details |

### 9.4 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `T9-001` | View compliance | Open tab | Stats calculated |
| `T9-002` | No frameworks selected | Open with none | Prompt to select |
| `T9-003` | 100% compliant | No gaps | "Fully Compliant" badge |
| `T9-004` | View control details | Click gap | Modal with control info |
| `T9-005` | Download PDF | Select PDF, download | PDF downloaded |
| `T9-006` | Download Excel | Select Excel, download | Excel downloaded |
| `T9-007` | Large report | 100+ risks | Generates in < 30s |
| `T9-008` | Cancel generation | Click cancel | Generation stopped |

---

## 10. Export Tickets to Jira/ServiceNow/ADO

### 10.1 Flow Diagram

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Risk    │───▶│  Select  │───▶│  Choose  │───▶│Configure │───▶│  Create  │
│  Panel   │    │  Risks   │    │  System  │    │  Fields  │    │ Tickets  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                      │               │               │
                                      ▼               ▼               ▼
                               [Auth Required]  [Validation]    [API Call]
                                      │                             │
                                      ▼                             ▼
                                [OAuth Flow]                  [Success/Error]
```

### 10.2 Step-by-Step

| Step | User Action | System Response | State Change | Error Handling |
|------|-------------|-----------------|--------------|----------------|
| 1 | Select risk(s) | Enable "Create Ticket" button | `selected: [ids]` | - |
| 2 | Click "Create Ticket" | Open TicketDialog | `dialog: open` | - |
| 3 | Select system (Jira) | Check existing connection | `system: jira` | - |
| 4a | (If not connected) | Prompt to configure | `auth: required` | - |
| 4b | Configure connection | OAuth or API key | `auth: configured` | Auth error handling |
| 5 | Select project | Load projects from API | `project: selected` | Toast if API fails |
| 6 | (Optional) Set assignee | Search users | `assignee: set` | - |
| 7 | (Optional) Set priority | Select from mapped values | `priority: set` | - |
| 8 | Click "Create" | POST to ticket adapter | `creating: true` | - |
| 9 | - | Create ticket(s) in external system | - | Per-ticket error handling |
| 10 | - | Store ticket link in remediation | `remediation: linked` | - |
| 11 | - | Show success with ticket links | `dialog: success` | - |
| 12 | Click ticket link | Open in new tab | - | - |

### 10.3 Ticket Payload Mapping

| Risk Field | Jira | ServiceNow | ADO |
|------------|------|------------|-----|
| title | summary | short_description | System.Title |
| description | description | description | System.Description |
| severity | priority (mapped) | priority (1-4) | Microsoft.VSTS.Common.Priority |
| cweId | customfield_10100 | u_cwe_id | Custom.CWE |
| remediation | description append | work_notes | System.Description append |
| link to model | customfield_10101 | u_threat_model | Custom.ThreatModelUrl |

### 10.4 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `T10-001` | Single ticket | Select 1 risk, create | Ticket created |
| `T10-002` | Bulk tickets | Select 5 risks, create | 5 tickets created |
| `T10-003` | Jira OAuth | Connect to Jira | OAuth completes |
| `T10-004` | ServiceNow API key | Configure credentials | Connection saved |
| `T10-005` | Create fails | API error | Error shown per ticket |
| `T10-006` | Partial success | 3/5 succeed | Show success + failures |
| `T10-007` | Click ticket link | After creation | Opens Jira in new tab |
| `T10-008` | Duplicate ticket | Same risk again | Warning "Already exists" |

---

## 11. CI/CD Validation Flow

### 11.1 Flow Diagram

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│    PR    │───▶│ Webhook  │───▶│  Queue   │───▶│ Analysis │───▶│   Post   │
│  Opened  │    │ Received │    │   Job    │    │   Run    │    │ Results  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │                               │               │
                     ▼                               ▼               ▼
               [Validate Secret]              [Pass/Fail Check]  [PR Comment]
                     │                               │               │
                     ▼                               ▼               ▼
               [401 if invalid]              [Block Merge?]   [SARIF Upload]
```

### 11.2 Step-by-Step

| Step | Trigger | System Response | State Change | Error Handling |
|------|---------|-----------------|--------------|----------------|
| 1 | PR opened in GitHub | Webhook POST to /api/webhooks/github | `webhook: received` | 401 if invalid |
| 2 | - | Validate X-Hub-Signature-256 | `auth: valid` | Log and ignore if invalid |
| 3 | - | Extract PR details, find threat model | `model: found` | 404 comment if not linked |
| 4 | - | Queue analysis job | `job: queued` | Error comment if queue fails |
| 5 | - | Post "Analysis in progress" status | `status: pending` | - |
| 6 | - | Run Threagile analysis | `analysis: running` | - |
| 7 | - | Analysis complete, evaluate risks | `analysis: complete` | Error status if fails |
| 8 | - | Check fail-on thresholds | `check: evaluating` | - |
| 9a | (If thresholds exceeded) | Set status: failure | `status: failure` | - |
| 9b | (If within thresholds) | Set status: success | `status: success` | - |
| 10 | - | Post PR comment with summary | `comment: posted` | Log if comment fails |
| 11 | - | Upload SARIF (if enabled) | `sarif: uploaded` | Log if upload fails |
| 12 | - | Complete | - | - |

### 11.3 CI/CD Configuration

```yaml
# .github/workflows/threat-model.yml
name: Threat Model Check
on:
  pull_request:
    branches: [main]
    
jobs:
  threat-model:
    runs-on: ubuntu-latest
    steps:
      - uses: threatdiviner/threat-model-action@v1
        with:
          api-key: ${{ secrets.TD_API_KEY }}
          model-id: ${{ vars.THREAT_MODEL_ID }}
          fail-on: critical,high
          post-comment: true
          upload-sarif: true
```

### 11.4 PR Comment Format

```markdown
## 🔒 Threat Model Analysis

**Model:** Production API Architecture  
**Analysis:** Completed in 45s

### Risk Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 2 | ❌ Blocking |
| 🟠 High | 3 | ❌ Blocking |
| 🟡 Medium | 8 | ⚠️ Warning |
| 🟢 Low | 5 | ✅ Allowed |

### New Risks in This PR

- **Missing Authentication** - API endpoint lacks auth
- **Unencrypted Storage** - S3 bucket without encryption

### Action Required

This PR introduces **2 critical** and **3 high** severity risks which exceed the configured threshold.

[View Full Report](https://app.threatdiviner.com/models/xxx/analysis/yyy) | [Configure Thresholds](https://app.threatdiviner.com/models/xxx/settings/cicd)
```

### 11.5 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `T11-001` | Happy path - pass | PR with no new risks | Status: success |
| `T11-002` | Happy path - fail | PR with critical risk | Status: failure |
| `T11-003` | Invalid webhook secret | Tampered request | 401 response |
| `T11-004` | Model not found | Invalid model ID | Error comment posted |
| `T11-005` | Analysis timeout | Slow analysis | Error status |
| `T11-006` | SARIF upload | Enabled in config | SARIF in Security tab |
| `T11-007` | No PR comment | Disabled in config | No comment posted |
| `T11-008` | Ignore risk | Risk in ignore list | Risk not counted |

---

## 12. Collaborate with Team

### 12.1 Flow Diagram

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Owner   │───▶│  Create  │───▶│  Share   │───▶│ Recipient│
│          │    │  Share   │    │  Link    │    │  Opens   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │                               │
                     ▼                               ▼
               [Set Permission]              [Permission Check]
                     │                               │
                     ▼                               ▼
               [View/Comment/Edit]           [View/Comment/Edit]
```

### 12.2 Step-by-Step

| Step | User Action | System Response | State Change | Error Handling |
|------|-------------|-----------------|--------------|----------------|
| 1 | Click "Share" in settings | Open ShareDialog | `dialog: open` | - |
| 2 | Select permission level | Set view/comment/edit | `permission: selected` | - |
| 3 | (Optional) Set expiry | Set expiration date | `expiry: set` | - |
| 4 | Click "Create Link" | POST /api/shares | `link: creating` | Error toast |
| 5 | - | Generate unique token | `link: created` | - |
| 6 | Copy link | Copy to clipboard | `copied: true` | - |
| 7 | Share link with recipient | (external) | - | - |
| 8 | Recipient clicks link | Validate token | `token: validating` | 404 if invalid |
| 9a | (If view permission) | Load model read-only | `mode: view` | - |
| 9b | (If comment permission) | Load model + comments | `mode: comment` | - |
| 9c | (If edit permission) | Try acquire lock | `mode: edit` | View-only if locked |
| 10 | Recipient views/edits | Normal editor behavior | - | - |
| 11 | Owner revokes link | DELETE /api/shares/{id} | `link: revoked` | - |
| 12 | Recipient tries link | 404 error | - | "Link no longer valid" |

### 12.3 Permission Levels

| Permission | View Diagram | Add Comments | Edit Diagram | Run Analysis | Export |
|------------|--------------|--------------|--------------|--------------|--------|
| View | ✓ | ✗ | ✗ | ✗ | ✓ |
| Comment | ✓ | ✓ | ✗ | ✗ | ✓ |
| Edit | ✓ | ✓ | ✓ | ✓ | ✓ |

### 12.4 Comment System

| Step | User Action | System Response |
|------|-------------|-----------------|
| 1 | Right-click asset | Show context menu with "Add Comment" |
| 2 | Click "Add Comment" | Open comment input |
| 3 | Type comment, @mention | Autocomplete usernames |
| 4 | Submit | POST /api/comments |
| 5 | - | Comment badge on asset |
| 6 | Mentioned user | Email notification |
| 7 | Reply to comment | Thread expands |
| 8 | Resolve comment | Mark as resolved |

### 12.5 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `T12-001` | Create view link | Share with view | Link works, read-only |
| `T12-002` | Create edit link | Share with edit | Link works, can edit |
| `T12-003` | Expired link | Access after expiry | 404 error |
| `T12-004` | Revoke link | Owner revokes | Recipient gets 404 |
| `T12-005` | Add comment | Right-click, comment | Comment saved |
| `T12-006` | Reply to comment | Click reply | Thread works |
| `T12-007` | Resolve comment | Click resolve | Comment grayed |
| `T12-008` | @mention notification | Mention user | Email sent |

---

## 13. Error Recovery Flows

### 13.1 Network Failure During Save

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│   Save   │───▶│  Network │───▶│  Local   │───▶│  Retry   │
│  Trigger │    │   Error  │    │  Backup  │    │  Button  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                      │               │
                                      ▼               ▼
                               [localStorage]   [Retry Save]
                                      │               │
                                      ▼               ▼
                               [Restore Option] [Success/Fail]
```

**Recovery Steps:**

1. Save attempt fails (network error)
2. System stores diagram state in localStorage with timestamp
3. Toast: "Save failed. Your work is backed up locally."
4. Show retry button
5. User clicks retry (or auto-retry after connection restored)
6. If retry succeeds: clear backup, show "Saved"
7. If user closes tab: prompt "You have unsaved changes backed up locally"
8. On next load: detect backup, offer "Restore from backup?"

### 13.2 Threagile Analysis Failure

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Analysis │───▶│ Threagile│───▶│  Error   │───▶│  Manual  │
│  Start   │    │  Crash   │    │ Details  │    │  Retry   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                      │
                                      ▼
                               [View Logs]
                                      │
                                      ▼
                               [Simplify Model]
```

**Recovery Steps:**

1. Threagile container crashes or times out
2. System captures error output
3. Toast: "Analysis failed: [error summary]"
4. Show "View Details" and "Retry" buttons
5. View Details: modal with full error log
6. Common causes displayed: model too large, invalid YAML, resource limits
7. Suggestions: "Try simplifying your model or removing complex components"
8. User can edit model and retry

### 13.3 Lock Conflict Resolution

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Open    │───▶│   Lock   │───▶│  View    │───▶│  Wait or │
│  Model   │    │  Failed  │    │  Only    │    │   Copy   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │                               │
                     ▼                               ▼
               [Locked by X]                  [Save as Copy]
                     │
                     ▼
               [Contact X]
```

**Recovery Steps:**

1. User opens model already locked by another user
2. Banner: "This model is being edited by [user]. You can view but not edit."
3. Options shown:
   - "Wait for lock to be released" (auto-refresh every 30s)
   - "Save as Copy" (creates duplicate model)
   - "Contact [user]" (shows email/Slack)
4. If original user releases lock: toast "Lock released, you can now edit"
5. If lock times out (5min): auto-acquire lock

### 13.4 AI Service Unavailable

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ AI Chat  │───▶│   API    │───▶│  Fallback│───▶│  Manual  │
│  Request │    │  Error   │    │  Message │    │  Mode    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

**Recovery Steps:**

1. Claude API returns error or times out
2. Toast: "AI assistant temporarily unavailable"
3. Chat drawer shows: "I'm having trouble responding right now. You can continue building your diagram manually."
4. Retry button available
5. All manual editing features remain functional
6. If during AI triage: risks shown without triage output, manual triage available

### 13.5 Browser Crash / Tab Close Recovery

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│   Edit   │───▶│   Crash  │───▶│   Load   │───▶│  Restore │
│  Model   │    │          │    │  Editor  │    │  Prompt  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                      │
                                      ▼
                               [Check localStorage]
                                      │
                                      ▼
                               [Backup Found]
                                      │
                               ┌──────┴──────┐
                               ▼             ▼
                           [Restore]    [Discard]
```

**Recovery Steps:**

1. User has unsaved changes
2. Browser crashes or tab is force-closed
3. Auto-save backup exists in localStorage
4. User reopens editor
5. System detects backup newer than server version
6. Dialog: "We found unsaved changes from [timestamp]. Would you like to restore them?"
7. "Restore" → load from backup, mark dirty
8. "Discard" → clear backup, load server version

### 13.6 Test Scenarios

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| `T13-001` | Network fail save | Disconnect, save | Local backup, retry shown |
| `T13-002` | Restore backup | Reload after backup | Restore prompt shown |
| `T13-003` | Threagile crash | Invalid model | Error details shown |
| `T13-004` | Threagile timeout | Large model | Timeout message |
| `T13-005` | Lock conflict | Two users open | Second sees view-only |
| `T13-006` | Lock timeout | User A idle 5min | Lock released |
| `T13-007` | AI unavailable | Claude down | Manual mode works |
| `T13-008` | Tab close dirty | Close with changes | Confirmation dialog |
| `T13-009` | Browser crash recovery | Kill process, reopen | Backup restore offered |

---

## 14. Document References

| Doc | Purpose |
|-----|---------|
| `00_overview.md` | Product summary, vision, tiers |
| `01_product_context.md` | Personas, stories, JTBD |
| `02_functional_spec.md` | Features, behaviors |
| `03_technical_spec.md` | Architecture, stack, APIs |
| `04_data_models.md` | Schema definitions, mappings |
| `05_ui_screens.md` | UI specifications |
| **`06_user_flows.md`** | **This document** — user journeys |
| `07_admin_console.md` | Admin app specification |
| `08_rules.md` | Code constraints for Claude Code |
| `09_implementation_plan.md` | Phased build order |

---

*Last updated: 2025-01-23*
*Author: ThreatDiviner Product Team*
