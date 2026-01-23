# 02 — Functional Specification

## 1. Diagram Editor

### 1.1 Canvas Overview

| Component | Behavior |
|-----------|----------|
| **Canvas area** | Infinite scrollable grid; default zoom 100%; grid snap enabled (toggleable) |
| **Shape palette** | Left sidebar; collapsible categories (AWS, Azure, GCP, Generic, Trust Boundaries); search filter |
| **Property panel** | Right sidebar; shows selected element properties; form inputs per field |
| **Toolbar** | Top bar: Save, Undo, Redo, Zoom controls, Fit to screen, Toggle grid, Run Analysis, Export |
| **Risk panel** | Right sidebar tab; shows risks for selected element or all risks; severity badges |
| **Minimap** | Bottom-right corner; shows full diagram thumbnail; click to navigate |

### 1.2 Canvas Interactions

| Action | Trigger | Behavior |
|--------|---------|----------|
| Add shape | Drag from palette to canvas | Creates node at drop position; opens property panel |
| Select | Click element | Blue border highlight; property panel populates |
| Multi-select | Shift+click or drag box | Multiple elements selected; bulk actions available |
| Move | Drag selected element(s) | Snaps to grid if enabled; updates connections |
| Resize | Drag corner handles | Maintains aspect ratio for icons; free resize for boundaries |
| Delete | Delete key or toolbar button | Removes element + connected edges; confirmation for nodes with data |
| Connect | Drag from edge handle to target | Creates data flow arrow; prompts for flow properties |
| Pan | Middle-mouse drag or Space+drag | Scrolls canvas viewport |
| Zoom | Scroll wheel or toolbar +/- | 25% to 400% range; zoom to cursor position |
| Undo | Ctrl+Z | Reverts last action; 50 levels |
| Redo | Ctrl+Y | Reapplies undone action |
| Copy/Paste | Ctrl+C / Ctrl+V | Duplicates elements with offset; generates new IDs |
| Group | Ctrl+G | Groups selected elements; moves as unit |
| Ungroup | Ctrl+Shift+G | Breaks group into individual elements |

### 1.3 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save diagram |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+C` | Copy |
| `Ctrl+V` | Paste |
| `Ctrl+A` | Select all |
| `Delete` | Delete selected |
| `Ctrl+G` | Group |
| `Ctrl+Shift+G` | Ungroup |
| `Ctrl+F` | Search shapes |
| `Ctrl+Enter` | Run analysis |
| `+` / `-` | Zoom in/out |
| `Ctrl+0` | Fit to screen |
| `Space+drag` | Pan canvas |
| `Escape` | Deselect / close panel |

---

## 2. Shape Library

### 2.1 Shape Categories

| Category | Description | Example Shapes |
|----------|-------------|----------------|
| **AWS** | Amazon Web Services icons | EC2, RDS, S3, Lambda, API Gateway, ALB, CloudFront, WAF, Cognito, SQS, SNS, DynamoDB, ElastiCache, ECS, EKS, Fargate, Secrets Manager, KMS, Route53, VPC, Subnet |
| **Azure** | Microsoft Azure icons | VM, SQL Database, Blob Storage, Functions, App Service, API Management, Front Door, Application Gateway, Key Vault, Service Bus, Event Hub, AKS, Container Instances, Active Directory |
| **GCP** | Google Cloud Platform icons | Compute Engine, Cloud SQL, Cloud Storage, Cloud Functions, Cloud Run, Apigee, Cloud CDN, Cloud Armor, Secret Manager, Pub/Sub, GKE, Cloud IAM |
| **Generic** | Cloud-agnostic components | Web Server, Application Server, Database, Cache, Queue, API, Load Balancer, CDN, WAF, Firewall, DNS, Storage, Container, Serverless Function |
| **Actors** | Users and external systems | User (person), Admin User, External System, Third-party API, Mobile App, Browser, IoT Device, Batch Job |
| **Trust Boundaries** | Security zones | Internet, DMZ, Public Subnet, Private Subnet, VPC, Container Boundary, Kubernetes Cluster, Data Center, Cloud Region |
| **Data Stores** | Specialized storage | Relational DB, NoSQL DB, Object Storage, File System, Data Lake, Data Warehouse, Secrets Store, Certificate Store |
| **Security** | Security components | WAF, Firewall, IDS/IPS, SIEM, Identity Provider, MFA, HSM, Encryption Service, Certificate Authority |

### 2.2 Shape Properties (Common)

Every shape has these base properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | UUID | Auto | Unique identifier |
| `name` | String | Yes | Display label |
| `description` | Text | No | Detailed description |
| `technology` | Enum | Yes | Threagile technology type (mapped from shape) |
| `tags` | String[] | No | Custom tags for filtering |

### 2.3 Shape-to-Technology Mapping (Sample)

| Draw.io Style | Threagile Technology | Machine Type |
|---------------|---------------------|--------------|
| `mxgraph.aws4.ec2` | `web-server` | `virtual` |
| `mxgraph.aws4.lambda` | `function` | `serverless` |
| `mxgraph.aws4.rds` | `database` | `virtual` |
| `mxgraph.aws4.s3` | `file-server` | `serverless` |
| `mxgraph.aws4.api_gateway` | `api-gateway` | `serverless` |
| `mxgraph.aws4.cognito` | `identity-provider` | `serverless` |
| `mxgraph.aws4.sqs` | `message-queue` | `serverless` |
| `mxgraph.aws4.elasticache` | `cache` | `virtual` |
| `mxgraph.aws4.ecs` | `container-platform` | `container` |
| `mxgraph.aws4.waf` | `waf` | `serverless` |
| `mxgraph.azure.vm` | `web-server` | `virtual` |
| `mxgraph.azure.sql_database` | `database` | `virtual` |
| `mxgraph.azure.blob_storage` | `file-server` | `serverless` |
| `mxgraph.gcp.compute_engine` | `web-server` | `virtual` |
| `mxgraph.gcp.cloud_sql` | `database` | `virtual` |
| `generic-server` | `web-server` | `virtual` |
| `generic-database` | `database` | `virtual` |
| `generic-browser` | `browser` | `client` |
| `generic-mobile` | `mobile-app` | `client` |

**Note:** Full mapping (~200 shapes) maintained in DB `admin.shape_mappings` table. Data entered via admin UI or feed sync — never hardcoded.

---

## 3. Technical Asset Properties

### 3.1 Property Panel Fields

When a technical asset (non-boundary) is selected:

| Field | Type | Options/Validation | Threagile Mapping |
|-------|------|-------------------|-------------------|
| **Name** | Text input | Required, max 100 chars | `title` |
| **Description** | Textarea | Optional, max 500 chars | `description` |
| **Technology** | Dropdown | Auto-populated from shape; editable | `technology` |
| **Machine Type** | Dropdown | Physical, Virtual, Container, Serverless | `machine` |
| **Internet Facing** | Toggle | Yes/No | `internet` |
| **Data Assets Processed** | Multi-select chips | PII, Credentials, Financial, Health, Confidential, Public | `data_assets_processed` |
| **Data Assets Stored** | Multi-select chips | Same as above | `data_assets_stored` |
| **Encryption at Rest** | Dropdown | None, Transparent, Data-with-symmetric, Data-with-asymmetric | `encryption` |
| **Authentication** | Dropdown | None, Credentials, Session-ID, Token, Certificate, Two-factor, Externalized | `authentication` |
| **Authorization** | Dropdown | None, Technical-user, Enduser-identity-propagation | `authorization` |
| **Multi-tenant** | Toggle | Yes/No | `multi_tenant` |
| **Redundant** | Toggle | Yes/No | `redundant` |
| **Custom Developed** | Toggle | Yes/No | `custom_developed_parts` |
| **Out of Scope** | Toggle | Yes/No (excludes from analysis) | `out_of_scope` |
| **Tags** | Text chips | Freeform tags | `tags` |

### 3.2 Default Values

When shape is dropped, defaults are applied based on shape type:

| Shape Category | Default Technology | Default Machine | Default Internet |
|----------------|-------------------|-----------------|------------------|
| AWS Lambda | `function` | `serverless` | No |
| AWS RDS | `database` | `virtual` | No |
| AWS S3 | `file-server` | `serverless` | No |
| AWS API Gateway | `api-gateway` | `serverless` | Yes |
| AWS CloudFront | `cdn` | `serverless` | Yes |
| Generic Browser | `browser` | `client` | Yes |
| Generic Database | `database` | `virtual` | No |

---

## 4. Trust Boundaries

### 4.1 Boundary Behavior

| Behavior | Description |
|----------|-------------|
| **Drawing** | Click "Trust Boundary" in palette → drag rectangle on canvas → name the boundary |
| **Nesting** | Assets dragged into boundary become children; boundary owns them for Threagile |
| **Hierarchy** | Boundaries can nest (VPC contains Public Subnet contains EC2) |
| **Visual** | Dashed border with colored background (configurable); label at top |
| **Resize** | Drag edges to resize; auto-expands when asset dragged near edge |
| **Collapse** | Double-click to collapse/expand contents |

### 4.2 Boundary Properties

| Field | Type | Description |
|-------|------|-------------|
| **Name** | Text | Required boundary name |
| **Type** | Dropdown | Network-cloud, Network-on-prem, Network-dedicated-hoster, Execution-environment |
| **Description** | Textarea | Optional description |
| **Color** | Color picker | Background tint color |
| **Technical Assets Inside** | Auto-populated | List of contained assets (read-only) |

### 4.3 Predefined Boundary Templates

| Template | Type | Default Color |
|----------|------|---------------|
| Internet | `network-cloud` | Red tint |
| DMZ | `network-cloud` | Orange tint |
| Public Subnet | `network-cloud` | Yellow tint |
| Private Subnet | `network-cloud` | Green tint |
| VPC | `network-cloud` | Blue tint |
| Kubernetes Cluster | `execution-environment` | Purple tint |
| On-Premise DC | `network-on-prem` | Gray tint |

---

## 5. Communication Links (Data Flows)

### 5.1 Creating Links

| Action | Behavior |
|--------|----------|
| **Draw link** | Hover over source asset → drag from edge handle → drop on target asset |
| **Link modal** | Opens automatically after drawing; prompts for flow properties |
| **Bidirectional** | Toggle to create two-way flow (creates two links internally) |
| **Link labels** | Display on canvas: protocol + auth summary (e.g., "HTTPS / Token") |

### 5.2 Link Properties

| Field | Type | Options | Threagile Mapping |
|-------|------|---------|-------------------|
| **Title** | Text | Auto-generated or custom | `title` |
| **Description** | Textarea | Optional | `description` |
| **Protocol** | Dropdown | HTTP, HTTPS, WS, WSS, gRPC, TCP, UDP, JDBC, ODBC, SQL, LDAP, SMTP, SSH, SFTP, Custom | `protocol` |
| **Authentication** | Dropdown | None, Credentials, Session-ID, Token, Certificate, Two-factor, Externalized | `authentication` |
| **Authorization** | Dropdown | None, Technical-user, Enduser-identity-propagation | `authorization` |
| **Encryption** | Dropdown | None, TLS | `encryption` |
| **VPN** | Toggle | Yes/No | `vpn` |
| **IP Filtered** | Toggle | Yes/No | `ip_filtered` |
| **Readonly** | Toggle | Yes/No (data direction) | `readonly` |
| **Data Assets Sent** | Multi-select | From source asset's data assets | `data_assets_sent` |
| **Data Assets Received** | Multi-select | From target asset's data assets | `data_assets_received` |

### 5.3 Link Visual Styles

| Protocol | Line Style | Color |
|----------|-----------|-------|
| HTTPS | Solid | Green |
| HTTP | Dashed | Red |
| gRPC | Solid thick | Blue |
| TCP/UDP | Dotted | Gray |
| Database (JDBC/SQL) | Double line | Purple |

---

## 6. Diagram Creation Methods

### 6.1 Manual Drawing

**Flow:**
1. User clicks "New Threat Model"
2. Empty canvas with shape palette displayed
3. User drags shapes, draws boundaries, connects flows
4. User fills property panel for each element
5. User clicks "Save" → diagram persisted
6. User clicks "Run Analysis" → Threagile executed

### 6.2 Repo Auto-Discovery

**Supported Sources:**

| File Type | Parser | Extracted Elements |
|-----------|--------|-------------------|
| `*.tf` (Terraform) | HCL parser | AWS/Azure/GCP resources, VPCs, subnets, security groups |
| `docker-compose.yml` | YAML parser | Services, networks, volumes, depends_on relationships |
| `*.yaml` (K8s) | YAML parser | Deployments, Services, Ingresses, ConfigMaps, Secrets |
| `serverless.yml` | YAML parser | Functions, API Gateway, DynamoDB, S3 triggers |
| `cloudformation.yaml` | YAML parser | AWS resources and relationships |
| `openapi.yaml` / `swagger.json` | OpenAPI parser | API endpoints, auth schemes |
| `package.json` | JSON parser | Service name, dependencies hinting tech stack |
| `application.yml` | YAML parser | Database URLs, service endpoints, queue configs |

**Flow:**
1. User clicks "Import from Repo"
2. User connects GitHub/GitLab/Bitbucket (OAuth) or provides repo URL
3. System clones/fetches repo
4. System detects file types, runs relevant parsers
5. Parsers extract nodes + edges → unified graph
6. Graph rendered as diagram with auto-layout (Dagre algorithm)
7. User reviews, adjusts positions, fills missing properties
8. User saves and runs analysis

**Parser Output Schema:**
```typescript
interface DiscoveredGraph {
  nodes: {
    id: string;
    name: string;
    type: string; // terraform-aws-ec2, k8s-deployment, etc.
    inferredTechnology: string;
    properties: Record<string, any>;
    source: { file: string; line: number };
  }[];
  edges: {
    sourceId: string;
    targetId: string;
    type: string; // depends_on, network, api_call
    inferredProtocol: string;
  }[];
  boundaries: {
    id: string;
    name: string;
    type: string;
    containedNodeIds: string[];
  }[];
}
```

### 6.3 Document Upload + AI Extraction

**Supported Formats:** PDF, DOCX, TXT, Markdown, Confluence export (HTML)

**Flow:**
1. User clicks "Import from Document"
2. User uploads file(s)
3. System extracts text (pdf-parse, mammoth, etc.)
4. Text sent to Claude with extraction prompt
5. Claude returns structured JSON (nodes, edges, boundaries)
6. System renders diagram from JSON
7. User reviews, corrects, enhances
8. User saves and runs analysis

**AI Extraction Prompt:**
```
You are extracting system architecture components from a document.

Document text:
{document_text}

Extract and return JSON:
{
  "nodes": [
    { "name": "...", "type": "server|database|api|queue|storage|cache|cdn|waf|user|external", "description": "..." }
  ],
  "edges": [
    { "from": "node_name", "to": "node_name", "protocol": "HTTPS|HTTP|gRPC|TCP|SQL|...", "description": "..." }
  ],
  "boundaries": [
    { "name": "...", "type": "vpc|subnet|cluster|dmz|internet", "contains": ["node_name", ...] }
  ]
}

Only extract components explicitly mentioned. Do not invent components.
If uncertain about a detail, omit it rather than guess.
```

### 6.4 AI Chat Builder

**Flow:**
1. User clicks "Build with AI"
2. Chat drawer opens on right side
3. User describes system: "I have a React app hosted on Vercel calling a Node.js API on AWS ECS, with PostgreSQL on RDS and Redis for caching"
4. AI parses intent → generates diagram incrementally
5. Diagram updates in real-time as AI responds
6. User can continue: "Add an S3 bucket for file uploads" → diagram updates
7. User can correct: "The API should be in a private subnet" → diagram updates
8. User clicks "Done" → exits chat mode, continues manual editing

**AI Chat Prompt:**
```
You are helping build a threat model diagram. 

Current diagram state:
{current_diagram_json}

User message: {user_message}

Respond with:
1. Brief acknowledgment
2. JSON delta to apply:
{
  "addNodes": [...],
  "removeNodes": [...],
  "updateNodes": [...],
  "addEdges": [...],
  "removeEdges": [...],
  "addBoundaries": [...],
  "updateBoundaries": [...]
}

Keep responses concise. Apply changes incrementally.
```

### 6.5 Wizard Questionnaire

**Flow:**
1. User clicks "Guided Setup"
2. Wizard modal opens with step-by-step questions
3. Each answer triggers next relevant question (decision tree)
4. Answers accumulate → diagram built progressively
5. Preview shown at each step
6. User completes wizard → full diagram rendered
7. User can edit manually after

**Wizard Question Schema:**
```typescript
interface WizardQuestion {
  id: string;
  text: string;
  helpText?: string;
  type: 'single-select' | 'multi-select' | 'text' | 'toggle';
  options?: { value: string; label: string; icon?: string }[];
  triggers: {
    [answerValue: string]: {
      nextQuestionId?: string;
      addNodes?: NodeTemplate[];
      addBoundaries?: BoundaryTemplate[];
      setProperties?: Record<string, any>;
    };
  };
  mapsTo?: {
    nodeProperty?: string;
    boundaryProperty?: string;
    globalProperty?: string;
  };
}
```

**Sample Wizard Flow:**

| Step | Question | Options | Result |
|------|----------|---------|--------|
| 1 | What type of application? | Web App, Mobile Backend, API Service, Data Pipeline | Sets template baseline |
| 2 | What cloud provider? | AWS, Azure, GCP, Multi-cloud, On-prem | Adds cloud boundary |
| 3 | What compute runs your app? | EC2, ECS, Lambda, EKS, VMs | Adds compute nodes |
| 4 | Do you have a database? | Yes (SQL), Yes (NoSQL), No | Adds DB node if yes |
| 5 | How do users authenticate? | Username/password, OAuth/SSO, API Keys, None | Sets auth properties |
| 6 | Is it internet-facing? | Yes, No (internal only) | Sets internet flag |
| 7 | Do you use a CDN? | Yes, No | Adds CloudFront/CDN node |
| 8 | Do you have a WAF? | Yes, No | Adds WAF node |
| 9 | What data do you process? | PII, Financial, Health, Credentials, Public only | Sets data assets |
| 10 | Review | (Preview diagram) | Final confirmation |

---

## 7. Template Library

### 7.1 Available Templates

| Template | Description | Included Components |
|----------|-------------|---------------------|
| **3-Tier Web App** | Classic web architecture | Browser → CloudFront → ALB → EC2 (web) → EC2 (app) → RDS; VPC with public/private subnets |
| **Serverless API** | AWS serverless stack | Browser → API Gateway → Lambda → DynamoDB; Cognito for auth; S3 for static assets |
| **Microservices** | Container-based microservices | Browser → ALB → ECS Services (3) → RDS + ElastiCache; Service mesh connections |
| **Data Pipeline** | ETL/Analytics architecture | S3 (raw) → Lambda (transform) → S3 (processed) → Redshift; Glue, Athena |
| **Mobile Backend** | Mobile app with backend | Mobile App → API Gateway → Lambda/ECS → RDS + S3; Push notifications (SNS) |
| **SaaS Multi-tenant** | B2B SaaS application | Browser → CloudFront → ALB → ECS → RDS (multi-tenant); Cognito; per-tenant S3 |
| **Event-Driven** | Async processing | Producer → SQS/SNS → Lambda/ECS consumers → DynamoDB; Dead-letter queue |
| **Kubernetes** | K8s-native deployment | Ingress → Services → Deployments → Pods; ConfigMaps, Secrets, PVCs |

### 7.2 Template Customization

- User selects template → diagram pre-populated
- User can add/remove/modify any component
- User fills in specifics (names, data assets, auth details)
- Template is starting point, not constraint

---

## 8. Schema Translation (Draw.io → Threagile)

### 8.1 Translation Pipeline

```
[Draw.io XML] 
    → [xml2js parse] 
    → [Internal Graph Model] 
    → [Gap-Fill UI] 
    → [Validation] 
    → [Threagile YAML emit]
```

### 8.2 Internal Graph Model

```typescript
interface ThreatModelGraph {
  metadata: {
    id: string;
    name: string;
    version: string;
    createdAt: Date;
    updatedAt: Date;
  };
  assets: TechnicalAsset[];
  boundaries: TrustBoundary[];
  links: CommunicationLink[];
  dataAssets: DataAsset[];
}

interface TechnicalAsset {
  id: string;
  name: string;
  description: string;
  technology: ThreagileEnum;
  machine: 'physical' | 'virtual' | 'container' | 'serverless';
  internet: boolean;
  encryption: EncryptionEnum;
  authentication: AuthEnum;
  authorization: AuthzEnum;
  multiTenant: boolean;
  redundant: boolean;
  customDeveloped: boolean;
  dataAssetsProcessed: string[];
  dataAssetsStored: string[];
  position: { x: number; y: number };
  size: { width: number; height: number };
  parentBoundaryId?: string;
  drawioStyle: string; // Original Draw.io style for mapping
}

interface TrustBoundary {
  id: string;
  name: string;
  description: string;
  type: BoundaryTypeEnum;
  technicalAssetsInside: string[];
  childBoundaries: string[];
}

interface CommunicationLink {
  id: string;
  sourceId: string;
  targetId: string;
  title: string;
  description: string;
  protocol: ProtocolEnum;
  authentication: AuthEnum;
  authorization: AuthzEnum;
  encryption: 'none' | 'tls';
  vpn: boolean;
  ipFiltered: boolean;
  readonly: boolean;
  dataAssetsSent: string[];
  dataAssetsReceived: string[];
}
```

### 8.3 Gap-Fill UI

When required fields are missing after import:

| Missing Field | UI Prompt |
|---------------|-----------|
| Technology (unknown shape) | Modal: "What type of component is [name]?" + dropdown |
| Authentication (link) | Inline: "How does [source] authenticate to [target]?" |
| Data Assets | Inline: "What data does [name] process?" + multi-select |
| Encryption | Inline: "Is data encrypted at rest?" + toggle |

Gap-fill appears as:
- Yellow warning badges on elements with missing required fields
- "Complete Setup" panel listing all gaps
- Cannot run analysis until critical gaps resolved

### 8.4 Threagile YAML Output

```yaml
threagile_version: 1.0.0
title: {model.name}
author:
  name: {user.name}
business_criticality: important

data_assets:
  {foreach dataAsset}:
    id: {dataAsset.id}
    title: {dataAsset.name}
    usage: {dataAsset.usage}
    quantity: {dataAsset.quantity}
    confidentiality: {dataAsset.confidentiality}
    integrity: {dataAsset.integrity}
    availability: {dataAsset.availability}

technical_assets:
  {foreach asset}:
    id: {asset.id}
    title: {asset.name}
    description: {asset.description}
    technology: {asset.technology}
    machine: {asset.machine}
    internet: {asset.internet}
    encryption: {asset.encryption}
    data_assets_processed: [{asset.dataAssetsProcessed}]
    data_assets_stored: [{asset.dataAssetsStored}]
    communication_links:
      {foreach link where link.sourceId == asset.id}:
        target: {link.targetId}
        title: {link.title}
        protocol: {link.protocol}
        authentication: {link.authentication}
        authorization: {link.authorization}

trust_boundaries:
  {foreach boundary}:
    id: {boundary.id}
    title: {boundary.name}
    type: {boundary.type}
    technical_assets_inside: [{boundary.technicalAssetsInside}]
```

---

## 9. Threat Engine

### 9.1 Threagile Execution

**Execution Flow:**
1. Generate YAML from internal graph model
2. Write YAML to temp file
3. Execute Docker: `docker run --rm -v /tmp:/app/work threagile/threagile -model /app/work/model.yaml -output /app/work/output`
4. Wait for completion (timeout: 120 seconds)
5. Parse output files: `risks.json`, `technical-assets.json`, `report.pdf`
6. Map risks to canonical IDs
7. Run AI triage on risks
8. Store results in DB
9. Notify frontend via WebSocket

**Docker Command:**
```bash
docker run --rm \
  -v ${TEMP_DIR}:/app/work \
  threagile/threagile:latest \
  -model /app/work/model.yaml \
  -output /app/work/output \
  -skip-risk-rules ${DISABLED_RULES} \
  -custom-risk-rules /app/work/custom-rules/
```

### 9.2 Custom Risk Rules

Custom rules can be added via:
1. YAML rule definitions (simple pattern matching)
2. Go plugins (complex logic) — Enterprise tier only

**YAML Rule Example:**
```yaml
id: custom-public-database
title: Database directly exposed to internet
severity: critical
exploitation_likelihood: likely
exploitation_impact: high
function: architecture
stride: information-disclosure
detection_logic: |
  For each technical asset where:
    - technology in [database, nosql]
    - internet == true
  Generate risk.
action: "Move database to private subnet behind API layer"
mitigation: "Use VPC, security groups, and application-layer access"
cwe: 284
```

### 9.3 Risk Output Schema

```typescript
interface ThreagileRisk {
  id: string;
  title: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  exploitationLikelihood: string;
  exploitationImpact: string;
  mostRelevantAsset: string;
  mostRelevantTrustBoundary?: string;
  mostRelevantCommunicationLink?: string;
  dataBreachProbability: string;
  dataBreachTechnicalAssets: string[];
  action: string;
  mitigation: string;
  cwe: number;
  stride: string;
  function: string;
  riskStatus: 'unchecked' | 'mitigated' | 'accepted' | 'in-progress' | 'false-positive';
}
```

---

## 10. Canonical Risk Deduplication

### 10.1 Problem

Multiple sources identify the same risk differently:
- CIS AWS 2.1.5: "S3 bucket is public"
- CWE-732: "Incorrect permission assignment"
- Threagile: `missing-access-restriction`
- Prowler: `s3_bucket_public_access`

User sees 4 findings for 1 issue.

### 10.2 Solution

Maintain mapping table that groups equivalent risks:

```typescript
interface CanonicalRiskMapping {
  canonicalId: string;        // e.g., "public-storage-exposure"
  canonicalTitle: string;     // e.g., "Public Cloud Storage Exposure"
  sources: {
    type: 'cis' | 'cwe' | 'threagile' | 'prowler' | 'custom';
    id: string;               // e.g., "CIS-2.1.5", "CWE-732"
    title: string;
  }[];
  defaultSeverity: Severity;
  cweId?: number;
  capecIds?: number[];
  attackPatterns?: string[];  // ATT&CK IDs
  complianceMappings: {
    framework: string;
    controlIds: string[];
  }[];
}
```

### 10.3 Deduplication Logic

```
1. Threagile outputs risks
2. For each risk:
   a. Look up canonical mapping by threagile rule ID
   b. If found → use canonical ID, merge sources
   c. If not found → create as standalone risk
3. Return deduplicated risk list with source traceability
```

### 10.4 UI Presentation

| View | Content |
|------|---------|
| Risk card (collapsed) | Canonical title, severity, affected asset |
| Risk card (expanded) | All contributing sources listed, compliance controls, CWE/CAPEC links |
| Source badge | "CIS", "CWE", "Threagile" chips showing which sources identified this |

---

## 11. AI Triage Layer

### 11.1 Purpose

- Adjust severity based on business context
- Flag likely false positives
- Generate human-readable explanations
- Suggest prioritized remediation

### 11.2 Triage Input

```typescript
interface TriageInput {
  risk: CanonicalRisk;
  asset: TechnicalAsset;
  diagramContext: {
    assetCount: number;
    internetFacingAssets: string[];
    dataAssets: DataAsset[];
    trustBoundaries: string[];
  };
  organizationContext?: {
    industry: string;
    complianceFrameworks: string[];
    previousRiskDecisions: RiskDecision[];
  };
}
```

### 11.3 Triage Prompt

```
You are a security risk analyst triaging threat model findings.

Risk: {risk.title}
Severity (from tool): {risk.severity}
Affected Asset: {asset.name} ({asset.technology})
Asset Properties:
- Internet facing: {asset.internet}
- Data processed: {asset.dataAssetsProcessed}
- Authentication: {asset.authentication}

Context:
- Total assets in model: {context.assetCount}
- Internet-facing assets: {context.internetFacingAssets}
- Compliance frameworks: {context.complianceFrameworks}

Provide:
1. adjusted_severity: critical|high|medium|low (with reasoning)
2. false_positive_likelihood: high|medium|low (with reasoning)
3. explanation: 2-3 sentence plain-English description of the risk
4. business_impact: What could happen if exploited
5. remediation_priority: 1-10 score
6. remediation_summary: 1-2 sentence fix guidance

Respond in JSON format.
```

### 11.4 Triage Output

```typescript
interface TriageOutput {
  adjustedSeverity: Severity;
  severityReasoning: string;
  falsePositiveLikelihood: 'high' | 'medium' | 'low';
  falsePositiveReasoning: string;
  explanation: string;
  businessImpact: string;
  remediationPriority: number;
  remediationSummary: string;
}
```

---

## 12. Compliance Engine

### 12.1 Framework Registry

| Framework | Full Name | Control Count |
|-----------|-----------|---------------|
| `iso27001` | ISO/IEC 27001:2022 | 93 controls |
| `nist-800-53` | NIST SP 800-53 Rev 5 | 1000+ controls |
| `nist-csf` | NIST Cybersecurity Framework | 108 subcategories |
| `pci-dss` | PCI DSS v4.0 | 250+ requirements |
| `soc2` | SOC 2 Type II | 64 criteria |
| `vpdss` | Victorian Protective Data Security Standards | 18 standards |
| `ism` | Australian ISM | 800+ controls |
| `apra-cps-234` | APRA CPS 234 | 36 requirements |
| `hipaa` | HIPAA Security Rule | 54 specifications |

### 12.2 Risk-to-Control Mapping

```typescript
interface ComplianceMapping {
  canonicalRiskId: string;
  framework: string;
  controls: {
    id: string;           // e.g., "A.14.1.2"
    title: string;        // e.g., "Securing application services"
    description: string;
    requirement: string;  // What must be done
  }[];
}
```

**Example Mapping:**
```json
{
  "canonicalRiskId": "unencrypted-communication",
  "framework": "iso27001",
  "controls": [
    {
      "id": "A.14.1.2",
      "title": "Securing application services on public networks",
      "requirement": "Information involved in application services passing over public networks shall be protected"
    },
    {
      "id": "A.14.1.3", 
      "title": "Protecting application services transactions",
      "requirement": "Information in transactions shall be protected against incomplete transmission and misrouting"
    }
  ]
}
```

### 12.3 Compliance Gap Calculation

```
For selected frameworks:
1. Get all required controls
2. For each identified risk:
   a. Look up mapped controls
   b. Mark controls as "gap" (risk exists, control not satisfied)
3. Calculate gap percentage per framework
4. Generate gap report
```

### 12.4 Framework Selection UI

- Checkboxes for each framework
- "Select All" / "Clear All"
- Saved as threat model metadata
- Filters risk view to show only relevant compliance mappings
- Saved per-organization as default

---

## 13. Remediation System

### 13.1 Playbook Schema

```typescript
interface RemediationPlaybook {
  canonicalRiskId: string;
  title: string;
  description: string;
  steps: {
    order: number;
    title: string;
    description: string;
    effort: 'low' | 'medium' | 'high';
    role: 'developer' | 'devops' | 'security' | 'architect';
  }[];
  iacSnippets: {
    provider: 'terraform' | 'cloudformation' | 'pulumi' | 'kubernetes';
    code: string;
    description: string;
  }[];
  references: {
    title: string;
    url: string;
  }[];
  complianceControls: string[];  // Controls this remediation satisfies
}
```

### 13.2 Example Playbook

```json
{
  "canonicalRiskId": "unencrypted-communication",
  "title": "Enable TLS for Communication",
  "steps": [
    {
      "order": 1,
      "title": "Obtain TLS certificate",
      "description": "Use ACM (AWS), Let's Encrypt, or internal CA to provision certificate",
      "effort": "low",
      "role": "devops"
    },
    {
      "order": 2,
      "title": "Configure load balancer for HTTPS",
      "description": "Update ALB/NLB listener to use HTTPS with certificate",
      "effort": "low",
      "role": "devops"
    },
    {
      "order": 3,
      "title": "Redirect HTTP to HTTPS",
      "description": "Add redirect rule for HTTP (port 80) to HTTPS (port 443)",
      "effort": "low",
      "role": "devops"
    },
    {
      "order": 4,
      "title": "Update application URLs",
      "description": "Ensure all internal URLs use https:// scheme",
      "effort": "medium",
      "role": "developer"
    }
  ],
  "iacSnippets": [
    {
      "provider": "terraform",
      "description": "ALB HTTPS listener",
      "code": "resource \"aws_lb_listener\" \"https\" {\n  load_balancer_arn = aws_lb.main.arn\n  port              = 443\n  protocol          = \"HTTPS\"\n  ssl_policy        = \"ELBSecurityPolicy-TLS-1-2-2017-01\"\n  certificate_arn   = aws_acm_certificate.main.arn\n  default_action {\n    type             = \"forward\"\n    target_group_arn = aws_lb_target_group.main.arn\n  }\n}"
    }
  ],
  "references": [
    { "title": "AWS ALB HTTPS Setup", "url": "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-https-listener.html" }
  ]
}
```

### 13.3 Ticket Export

**Adapter Interface:**
```typescript
interface TicketAdapter {
  name: string;  // jira, servicenow, ado
  createTicket(risk: Risk, playbook: Playbook, config: AdapterConfig): Promise<TicketResult>;
  updateTicket(ticketId: string, update: TicketUpdate): Promise<void>;
  getTicketStatus(ticketId: string): Promise<TicketStatus>;
}
```

**Jira Payload Example:**
```json
{
  "fields": {
    "project": { "key": "SEC" },
    "summary": "[Threat Model] Unencrypted communication: API to Database",
    "description": "Risk identified in threat model: {model.name}\n\nAffected asset: {asset.name}\nSeverity: {risk.severity}\n\nRemediation:\n{playbook.steps}\n\nCompliance impact: {controls}",
    "issuetype": { "name": "Security Task" },
    "priority": { "name": "{risk.severity}" },
    "labels": ["threat-model", "security", "{framework}"]
  }
}
```

### 13.4 Remediation Status Tracking

| Status | Description |
|--------|-------------|
| `open` | Risk identified, no action taken |
| `in-progress` | Ticket created or work started |
| `mitigated` | Fix implemented, pending verification |
| `resolved` | Fix verified, risk closed |
| `accepted` | Risk accepted with justification |
| `false-positive` | Marked as not a real risk |

---

## 14. Attack Path Visualization

### 14.1 Graph Traversal

When user clicks a risk:

1. Identify entry point (internet-facing asset or attacker starting position)
2. Identify target (asset with the risk)
3. Find shortest path through communication links
4. Tag each hop with relevant ATT&CK tactic

### 14.2 ATT&CK Mapping

| Hop Type | ATT&CK Tactic |
|----------|---------------|
| Initial access to internet-facing asset | Initial Access (TA0001) |
| Move through unauth'd link | Lateral Movement (TA0008) |
| Access database | Collection (TA0009) |
| Exfiltrate data | Exfiltration (TA0010) |
| Escalate privileges | Privilege Escalation (TA0004) |

### 14.3 UI Interaction

| Action | Result |
|--------|--------|
| Click risk in risk panel | Attack path highlighted on diagram; path steps numbered |
| Hover numbered step | Tooltip shows ATT&CK tactic + technique |
| Click "View Details" | Modal opens with full attack narrative |
| Click asset in path | Navigates to asset, shows its risks |

### 14.4 Attack Narrative Modal

```
Attack Path: SQL Injection leading to data breach

1. [Initial Access] Attacker accesses public API Gateway (api.example.com)
   - Technique: T1190 Exploit Public-Facing Application

2. [Execution] Malicious input passed to Backend API (ECS)
   - Technique: T1059 Command and Scripting Interpreter

3. [Collection] SQL Injection reaches Database (RDS)
   - Technique: T1005 Data from Local System
   - CWE-89: SQL Injection

4. [Exfiltration] Sensitive data extracted via same channel
   - Technique: T1041 Exfiltration Over C2 Channel
   - Data at risk: PII, Credentials

Impact: Full database compromise, potential breach of {X} records
```

---

## 15. Reports

### 15.1 PDF Executive Summary

**Sections:**
1. Cover page (title, date, author, classification)
2. Executive summary (1 page: risk counts by severity, top 5 risks, compliance summary)
3. Architecture diagram (exported PNG)
4. Risk inventory (table: ID, title, severity, asset, status)
5. Compliance gap summary (per framework: % complete, critical gaps)
6. Remediation roadmap (prioritized list with effort estimates)
7. Appendix: Full risk details

### 15.2 Excel Risk Register

**Sheets:**
1. **Summary** — Risk counts, charts
2. **Risks** — Full risk list with all fields
3. **Assets** — Technical assets inventory
4. **Compliance** — Control gap matrix
5. **Remediations** — Playbook steps per risk

### 15.3 JSON Export

Full model export for API/integration:
```json
{
  "metadata": { "id": "...", "name": "...", "version": "...", "exportedAt": "..." },
  "assets": [...],
  "boundaries": [...],
  "links": [...],
  "risks": [...],
  "compliance": { "frameworks": [...], "gaps": [...] },
  "remediations": [...]
}
```

### 15.4 SARIF Export

For GitHub Security tab / IDE integration:
```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [{
    "tool": { "driver": { "name": "ThreatDiviner Threat Model", "version": "1.0" } },
    "results": [
      {
        "ruleId": "{canonicalRiskId}",
        "level": "{severity}",
        "message": { "text": "{risk.explanation}" },
        "locations": [{ "physicalLocation": { "artifactLocation": { "uri": "{asset.name}" } } }]
      }
    ]
  }]
}
```

---

## 16. Version Control

### 16.1 Versioning Behavior

| Trigger | Action |
|---------|--------|
| User clicks Save | Create new version snapshot |
| Auto-save (every 60s if changes) | Create auto-save version (pruned after 24h) |
| Before analysis run | Create pre-analysis snapshot |
| Manual "Create Version" | Named version with description |

### 16.2 Version Storage

```typescript
interface DiagramVersion {
  id: string;
  threatModelId: string;
  version: number;
  name?: string;              // User-provided name
  description?: string;
  diagramXml: string;         // Full Draw.io XML
  graphJson: string;          // Internal graph model
  createdAt: Date;
  createdBy: string;
  isAutoSave: boolean;
  analysisResults?: string;   // Risk snapshot at this version
}
```

### 16.3 Diff View

Compare two versions showing:
- Nodes added (green highlight)
- Nodes removed (red highlight)
- Nodes modified (yellow highlight)
- Links added/removed
- Risks added/removed/changed severity

### 16.4 Rollback

1. User selects version from history
2. Preview shown in read-only view
3. User clicks "Restore this version"
4. Confirmation modal
5. Current state saved as new version (backup)
6. Selected version becomes current state

---

## 17. CI/CD Integration

### 17.1 Webhook Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/webhook/github` | POST | GitHub push/PR events |
| `/api/webhook/gitlab` | POST | GitLab push/MR events |
| `/api/webhook/ado` | POST | Azure DevOps push/PR events |
| `/api/webhook/generic` | POST | Generic webhook with API key |

### 17.2 GitHub Action

```yaml
name: Threat Model Validation
on:
  pull_request:
    branches: [main]

jobs:
  threat-model:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Threat Model Analysis
        uses: threatdiviner/threat-model-action@v1
        with:
          api-key: ${{ secrets.TD_API_KEY }}
          model-id: ${{ vars.THREAT_MODEL_ID }}
          fail-on: critical,high  # Block PR if these severities found
          
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: threat-model-results.sarif
```

### 17.3 PR Comment Format

```markdown
## 🛡️ Threat Model Analysis

**Model:** Production API Architecture
**Risks Found:** 3 critical, 5 high, 12 medium

### Critical Risks (blocking)
| Risk | Asset | Action |
|------|-------|--------|
| Unencrypted PII transmission | User API → Database | Enable TLS |
| Missing authentication | Admin API | Add JWT validation |
| Public S3 bucket | Asset Storage | Restrict bucket policy |

### Summary
❌ **PR blocked** — resolve critical risks before merging.

[View full report](https://app.threatdiviner.com/models/xxx/analysis/yyy)
```

### 17.4 Block Threshold Configuration

```typescript
interface CICDConfig {
  threatModelId: string;
  enabled: boolean;
  failOn: Severity[];           // e.g., ['critical', 'high']
  ignoreRiskIds: string[];      // Accepted/false-positive risks
  notifyOnNewRisks: boolean;
  postPRComment: boolean;
  uploadSarif: boolean;
}
```

---

## 18. Collaboration

### 18.1 Share Links

| Permission | Capabilities |
|------------|--------------|
| **View** | See diagram, risks, reports; no edits |
| **Comment** | View + add comments/annotations |
| **Edit** | Full editing (with lock acquisition) |

**Link format:** `https://app.threatdiviner.com/share/{shareToken}`

### 18.2 Comments

- Comment on diagram elements (assets, links, boundaries)
- Comment on risks
- Thread replies
- @mention team members
- Resolve/unresolve comments

### 18.3 Lock-Based Editing

| State | Behavior |
|-------|----------|
| Unlocked | First editor to make change acquires lock |
| Locked | Other users see "Editing: {user}" banner; view-only mode |
| Lock timeout | 5 minutes inactivity releases lock |
| Manual release | Editor clicks "Done editing" |
| Force release | Admin can force-release stuck locks |

### 18.4 Role Permissions

| Role | View | Comment | Edit | Run Analysis | Export | Admin |
|------|------|---------|------|--------------|--------|-------|
| Viewer | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Commenter | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Editor | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 19. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Empty diagram (no assets) | Block analysis; prompt "Add at least one component" |
| Unknown shape dropped | Render with "?" badge; prompt user to classify; default to `generic-component` |
| Invalid XML import | Show parse error; offer to open in recovery mode (partial import) |
| Threagile timeout (>120s) | Cancel job; notify user; suggest simplifying model |
| Threagile crash | Capture stderr; show generic error; log for debugging |
| AI triage failure | Skip triage; show untriaged risks with flag; allow manual retry |
| Concurrent edit conflict | Lock prevents; if lock expires mid-edit, prompt save-as-copy |
| Large diagram (>200 nodes) | Warn performance may degrade; suggest splitting into sub-models |
| Missing shape mapping | Add to unmapped queue; use default; notify admin |
| Network failure during save | Auto-retry 3x; local storage backup; prompt user |
| Session timeout | Preserve unsaved changes in localStorage; restore on re-login |

---

## 20. Document References

| Doc | Purpose |
|-----|---------|
| `00_overview.md` | Product summary, vision, tiers |
| `01_product_context.md` | Personas, stories, JTBD |
| **`02_functional_spec.md`** | **This document** — features, behaviors |
| `03_technical_spec.md` | Architecture, stack, APIs |
| `04_data_models.md` | Schema definitions, mappings |
| `05_ui_screens.md` | Screen-by-screen UI spec |
| `06_user_flows.md` | Step-by-step user journeys |
| `07_admin_console.md` | Admin app specification |
| `08_rules.md` | Code constraints for Claude Code |
| `09_implementation_plan.md` | Phased build order |

---

*Last updated: 2025-01-23*
*Author: ThreatDiviner Product Team*
