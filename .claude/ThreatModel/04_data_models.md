# 04 — Data Models

> ⚠️ **All "Sample" sections in this document are ILLUSTRATIVE ONLY.**
> Never hardcode these examples. Data enters via admin UI or feed sync only. See `08_rules.md §10`.

## 1. Draw.io XML Schema

### 1.1 Document Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="2025-01-23T10:00:00.000Z" agent="Mozilla/5.0" version="22.1.0">
  <diagram id="diagram-id" name="Page-1">
    <mxGraphModel dx="1024" dy="768" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <!-- All diagram elements are children of cell "1" -->
        <mxCell id="node-1" value="API Server" style="..." vertex="1" parent="1">
          <mxGeometry x="100" y="200" width="120" height="60" as="geometry" />
        </mxCell>
        <mxCell id="edge-1" value="HTTPS" style="..." edge="1" parent="1" source="node-1" target="node-2">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

### 1.2 mxCell Attributes

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `id` | String | Unique identifier | `"node-abc123"` |
| `value` | String | Display label (can contain HTML) | `"API Server"` |
| `style` | String | Semicolon-separated style properties | `"shape=mxgraph.aws4.ec2;fillColor=#ED7100;"` |
| `vertex` | "1" | Present if element is a node | `vertex="1"` |
| `edge` | "1" | Present if element is a connector | `edge="1"` |
| `parent` | String | ID of parent cell (for grouping/boundaries) | `"1"` or `"boundary-1"` |
| `source` | String | ID of source node (edges only) | `"node-1"` |
| `target` | String | ID of target node (edges only) | `"node-2"` |
| `connectable` | "0"/"1" | Whether connections can attach | `"1"` |
| `collapsed` | "0"/"1" | Whether group is collapsed | `"0"` |

### 1.3 mxGeometry Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `x` | Number | X position (from parent origin) |
| `y` | Number | Y position (from parent origin) |
| `width` | Number | Element width |
| `height` | Number | Element height |
| `relative` | "1" | For edges: positions are relative |
| `as` | "geometry" | Identifies this as geometry data |

### 1.4 Style String Format

```
style="key1=value1;key2=value2;..."
```

**Common Style Properties:**

| Property | Description | Example Values |
|----------|-------------|----------------|
| `shape` | Shape identifier | `mxgraph.aws4.ec2`, `rectangle`, `ellipse` |
| `fillColor` | Background color | `#ED7100`, `none` |
| `strokeColor` | Border color | `#000000` |
| `fontColor` | Text color | `#333333` |
| `fontSize` | Text size | `12` |
| `rounded` | Rounded corners | `0`, `1` |
| `dashed` | Dashed border | `0`, `1` |
| `swimlane` | Is a swimlane/boundary | `1` |
| `startArrow` | Arrow at start | `none`, `classic`, `block` |
| `endArrow` | Arrow at end | `none`, `classic`, `block` |
| `edgeStyle` | Edge routing | `orthogonalEdgeStyle`, `elbowEdgeStyle` |

### 1.5 Shape Style Patterns

| Shape Type | Style Pattern |
|------------|---------------|
| AWS EC2 | `shape=mxgraph.aws4.ec2` |
| AWS RDS | `shape=mxgraph.aws4.rds` |
| AWS S3 | `shape=mxgraph.aws4.s3` |
| AWS Lambda | `shape=mxgraph.aws4.lambda` |
| AWS API Gateway | `shape=mxgraph.aws4.api_gateway` |
| Azure VM | `shape=mxgraph.azure.virtual_machine` |
| Azure SQL | `shape=mxgraph.azure.sql_database` |
| GCP Compute | `shape=mxgraph.gcp.compute_engine` |
| Generic Rectangle | `rounded=0;whiteSpace=wrap;html=1` |
| Swimlane/Boundary | `swimlane;horizontal=0;startSize=20` |
| User Actor | `shape=umlActor` |
| Database Cylinder | `shape=cylinder3` |

### 1.6 Custom Data Storage

Draw.io supports custom data via `<object>` wrapper or `data-*` attributes in style:

```xml
<object label="API Server" id="node-1" 
        data-technology="web-server" 
        data-internet="true"
        data-authentication="token">
  <mxCell style="..." vertex="1" parent="1">
    <mxGeometry ... />
  </mxCell>
</object>
```

We use this pattern to persist Threagile properties directly in the diagram XML.

---

## 2. Internal Graph Model

### 2.1 Core Interfaces

```typescript
/**
 * Root container for a threat model's diagram data
 */
interface ThreatModelGraph {
  metadata: GraphMetadata;
  assets: TechnicalAsset[];
  boundaries: TrustBoundary[];
  links: CommunicationLink[];
  dataAssets: DataAsset[];
}

interface GraphMetadata {
  id: string;                    // UUID
  threatModelId: string;         // Parent threat model
  versionNumber: number;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;             // User ID
}
```

### 2.2 Technical Asset

```typescript
interface TechnicalAsset {
  // Identifiers
  id: string;                    // Internal UUID
  externalId: string;            // Draw.io mxCell ID
  
  // Basic Info
  name: string;
  description?: string;
  tags: string[];
  
  // Threagile Properties
  technology: TechnologyEnum;
  machine: MachineType;
  internetFacing: boolean;
  encryption: EncryptionType;
  authentication: AuthenticationType;
  authorization: AuthorizationType;
  multiTenant: boolean;
  redundant: boolean;
  customDeveloped: boolean;
  outOfScope: boolean;
  
  // Data Classification
  dataAssetsProcessed: string[];  // DataAsset IDs
  dataAssetsStored: string[];     // DataAsset IDs
  
  // Visual Properties
  position: Position;
  size: Size;
  drawioStyle: string;            // Original style string
  
  // Hierarchy
  parentBoundaryId?: string;      // TrustBoundary ID if inside one
  
  // Metadata
  properties: Record<string, any>; // Custom properties
}

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}
```

### 2.3 Trust Boundary

```typescript
interface TrustBoundary {
  // Identifiers
  id: string;
  externalId: string;
  
  // Basic Info
  name: string;
  description?: string;
  
  // Threagile Properties
  boundaryType: BoundaryType;
  
  // Visual Properties
  position: Position;
  size: Size;
  color?: string;
  
  // Hierarchy
  parentBoundaryId?: string;
  technicalAssetsInside: string[];  // Asset IDs
  childBoundaries: string[];        // Nested boundary IDs
}
```

### 2.4 Communication Link

```typescript
interface CommunicationLink {
  // Identifiers
  id: string;
  externalId: string;
  
  // Connection
  sourceAssetId: string;
  targetAssetId: string;
  
  // Basic Info
  title?: string;
  description?: string;
  
  // Threagile Properties
  protocol: ProtocolType;
  authentication: AuthenticationType;
  authorization: AuthorizationType;
  encryption: LinkEncryption;
  vpn: boolean;
  ipFiltered: boolean;
  readonly: boolean;
  
  // Data Flow
  dataAssetsSent: string[];
  dataAssetsReceived: string[];
  
  // Visual Properties
  drawioStyle: string;
  waypoints?: Position[];
}
```

### 2.5 Data Asset

```typescript
interface DataAsset {
  id: string;
  name: string;
  description?: string;
  
  // Classification
  usage: DataUsage;
  quantity: DataQuantity;
  confidentiality: DataConfidentiality;
  integrity: DataIntegrity;
  availability: DataAvailability;
  
  justificationCia?: string;
}
```

### 2.6 Enums

```typescript
// Technology Types (Threagile compatible)
type TechnologyEnum = 
  | 'web-server'
  | 'web-application'
  | 'application-server'
  | 'database'
  | 'file-server'
  | 'cache'
  | 'message-queue'
  | 'stream-processing'
  | 'service-mesh'
  | 'api-gateway'
  | 'load-balancer'
  | 'reverse-proxy'
  | 'waf'
  | 'cdn'
  | 'identity-provider'
  | 'identity-store'
  | 'vault'
  | 'hsm'
  | 'container-platform'
  | 'batch-processing'
  | 'function'
  | 'erp'
  | 'cms'
  | 'browser'
  | 'desktop-app'
  | 'mobile-app'
  | 'iot-device'
  | 'cli'
  | 'library'
  | 'unknown';

type MachineType = 
  | 'physical'
  | 'virtual'
  | 'container'
  | 'serverless';

type EncryptionType = 
  | 'none'
  | 'transparent'
  | 'data-with-symmetric-shared-key'
  | 'data-with-asymmetric-shared-key'
  | 'data-with-enduser-individual-key';

type AuthenticationType = 
  | 'none'
  | 'credentials'
  | 'session-id'
  | 'token'
  | 'client-certificate'
  | 'two-factor'
  | 'externalized';

type AuthorizationType = 
  | 'none'
  | 'technical-user'
  | 'enduser-identity-propagation';

type BoundaryType = 
  | 'network-cloud-provider'
  | 'network-cloud-security-group'
  | 'network-on-prem'
  | 'network-dedicated-hoster'
  | 'network-virtual-lan'
  | 'network-policy-namespace'
  | 'execution-environment';

type ProtocolType = 
  | 'http'
  | 'https'
  | 'ws'
  | 'wss'
  | 'grpc'
  | 'grpcs'
  | 'tcp'
  | 'tcp-encrypted'
  | 'udp'
  | 'jdbc'
  | 'jdbc-encrypted'
  | 'odbc'
  | 'odbc-encrypted'
  | 'sql'
  | 'sql-encrypted'
  | 'ldap'
  | 'ldaps'
  | 'smtp'
  | 'smtps'
  | 'pop3'
  | 'pop3s'
  | 'imap'
  | 'imaps'
  | 'ftp'
  | 'ftps'
  | 'sftp'
  | 'ssh'
  | 'nfs'
  | 'smb'
  | 'iiop'
  | 'jrmp'
  | 'in-process-library-call'
  | 'local-file-access'
  | 'container-spawning';

type LinkEncryption = 'none' | 'tls';

type DataUsage = 'business' | 'devops';
type DataQuantity = 'very-few' | 'few' | 'many' | 'very-many';
type DataConfidentiality = 'public' | 'internal' | 'restricted' | 'confidential' | 'strictly-confidential';
type DataIntegrity = 'archive' | 'operational' | 'important' | 'critical' | 'mission-critical';
type DataAvailability = 'archive' | 'operational' | 'important' | 'critical' | 'mission-critical';
```

---

## 3. Threagile YAML Schema

### 3.1 Complete YAML Structure

```yaml
threagile_version: 1.0.0

title: "{threatModel.name}"
date: "{YYYY-MM-DD}"

author:
  name: "{user.name}"
  homepage: "{organization.website}"

management_summary_comment: "{threatModel.description}"

business_criticality: "{important|critical|mission-critical}"

business_overview:
  description: "{optional business context}"
  images: []

technical_overview:
  description: "{optional technical context}"
  images: []

questions: {}

abuse_cases: {}

security_requirements: {}

# ===================
# DATA ASSETS
# ===================
data_assets:
  "{dataAsset.id}":
    id: "{dataAsset.id}"
    description: "{dataAsset.description}"
    usage: "{business|devops}"
    tags: []
    origin: "{optional origin}"
    owner: "{optional owner}"
    quantity: "{very-few|few|many|very-many}"
    confidentiality: "{public|internal|restricted|confidential|strictly-confidential}"
    integrity: "{archive|operational|important|critical|mission-critical}"
    availability: "{archive|operational|important|critical|mission-critical}"
    justification_cia_rating: "{dataAsset.justificationCia}"

# ===================
# TECHNICAL ASSETS
# ===================
technical_assets:
  "{asset.id}":
    id: "{asset.id}"
    description: "{asset.description}"
    type: "{external-entity|process|datastore}"
    usage: "{business|devops}"
    used_as_client_by_human: false
    out_of_scope: "{asset.outOfScope}"
    justification_out_of_scope: ""
    size: "{system|service|application|component}"
    technology: "{asset.technology}"
    tags: ["{asset.tags}"]
    internet: "{asset.internetFacing}"
    machine: "{asset.machine}"
    encryption: "{asset.encryption}"
    owner: ""
    confidentiality: "{highest of data assets}"
    integrity: "{highest of data assets}"
    availability: "{highest of data assets}"
    justification_cia_rating: ""
    multi_tenant: "{asset.multiTenant}"
    redundant: "{asset.redundant}"
    custom_developed_parts: "{asset.customDeveloped}"
    data_assets_processed:
      - "{dataAssetId}"
    data_assets_stored:
      - "{dataAssetId}"
    data_formats_accepted: []
    communication_links:
      "{link.id}":
        target: "{link.targetAssetId}"
        description: "{link.description}"
        protocol: "{link.protocol}"
        authentication: "{link.authentication}"
        authorization: "{link.authorization}"
        tags: []
        vpn: "{link.vpn}"
        ip_filtered: "{link.ipFiltered}"
        readonly: "{link.readonly}"
        usage: "business"
        data_assets_sent:
          - "{dataAssetId}"
        data_assets_received:
          - "{dataAssetId}"

# ===================
# TRUST BOUNDARIES
# ===================
trust_boundaries:
  "{boundary.id}":
    id: "{boundary.id}"
    description: "{boundary.description}"
    type: "{boundary.boundaryType}"
    tags: []
    technical_assets_inside:
      - "{assetId}"
    trust_boundaries_nested: []

# ===================
# SHARED RUNTIMES (optional)
# ===================
shared_runtimes: {}

# ===================
# INDIVIDUAL RISK CATEGORIES (optional)
# ===================
individual_risk_categories: {}

# ===================
# RISK TRACKING (optional)
# ===================
risk_tracking: {}

# ===================
# DIAGRAM TWEAKS (optional)
# ===================
diagram_tweak_nodesep: 2
diagram_tweak_ranksep: 2
diagram_tweak_edge_layout: "spline"
```

### 3.2 Required vs Optional Fields

| Section | Field | Required | Default |
|---------|-------|----------|---------|
| Root | `threagile_version` | Yes | "1.0.0" |
| Root | `title` | Yes | - |
| Root | `business_criticality` | Yes | "important" |
| data_assets | `id` | Yes | - |
| data_assets | `confidentiality` | Yes | "confidential" |
| data_assets | `integrity` | Yes | "important" |
| data_assets | `availability` | Yes | "important" |
| technical_assets | `id` | Yes | - |
| technical_assets | `technology` | Yes | - |
| technical_assets | `machine` | Yes | "virtual" |
| technical_assets | `internet` | Yes | false |
| communication_links | `target` | Yes | - |
| communication_links | `protocol` | Yes | "https" |
| communication_links | `authentication` | Yes | "none" |
| trust_boundaries | `id` | Yes | - |
| trust_boundaries | `type` | Yes | - |
| trust_boundaries | `technical_assets_inside` | Yes | [] |

### 3.3 Validation Rules

```typescript
interface YamlValidationRules {
  // Asset validation
  assetIdMustBeUnique: boolean;
  assetMustHaveTechnology: boolean;
  internetFacingMustBeBool: boolean;
  
  // Link validation
  linkTargetMustExist: boolean;
  linkSourceMustBeAsset: boolean;
  protocolMustBeValid: boolean;
  
  // Boundary validation
  boundaryAssetsMustExist: boolean;
  noCircularBoundaryNesting: boolean;
  
  // Data asset validation
  dataAssetIdMustBeUnique: boolean;
  referencedDataAssetsMustExist: boolean;
}
```

---

## 4. Shape Mapping Configuration

### 4.1 Database Schema

```sql
CREATE TABLE admin.shape_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Matching
  drawio_style VARCHAR(255) NOT NULL,        -- e.g., "mxgraph.aws4.ec2"
  style_pattern VARCHAR(255),                 -- Regex pattern for fuzzy matching
  
  -- Threagile Mapping
  threagile_technology VARCHAR(100) NOT NULL,
  machine_type VARCHAR(50) DEFAULT 'virtual',
  
  -- Default Properties
  default_properties JSONB DEFAULT '{
    "internetFacing": false,
    "encryption": "none",
    "authentication": "none",
    "multiTenant": false
  }',
  
  -- Display
  display_name VARCHAR(255),
  category VARCHAR(100),                      -- AWS, Azure, GCP, Generic
  icon_url VARCHAR(500),
  
  -- Workflow
  status VARCHAR(50) DEFAULT 'pending',       -- pending, approved, live
  ai_suggested BOOLEAN DEFAULT FALSE,
  ai_confidence DECIMAL(3,2),
  approved_by UUID REFERENCES platform.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(drawio_style)
);

CREATE INDEX idx_shape_mappings_style ON admin.shape_mappings(drawio_style);
CREATE INDEX idx_shape_mappings_status ON admin.shape_mappings(status);
```

### 4.2 JSON Configuration Format

```typescript
interface ShapeMappingConfig {
  id: string;
  drawioStyle: string;
  stylePattern?: string;
  
  threagile: {
    technology: TechnologyEnum;
    machine: MachineType;
  };
  
  defaults: {
    internetFacing: boolean;
    encryption: EncryptionType;
    authentication: AuthenticationType;
    authorization: AuthorizationType;
    multiTenant: boolean;
    customDeveloped: boolean;
  };
  
  display: {
    name: string;
    category: 'aws' | 'azure' | 'gcp' | 'generic' | 'actor' | 'boundary';
    iconUrl?: string;
  };
  
  metadata: {
    status: 'pending' | 'approved' | 'live';
    aiSuggested: boolean;
    aiConfidence?: number;
  };
}
```

### 4.3 Sample Mappings

```json
[
  {
    "drawioStyle": "mxgraph.aws4.ec2",
    "threagile": { "technology": "web-server", "machine": "virtual" },
    "defaults": { "internetFacing": false, "encryption": "none", "authentication": "none" },
    "display": { "name": "AWS EC2", "category": "aws" }
  },
  {
    "drawioStyle": "mxgraph.aws4.lambda",
    "threagile": { "technology": "function", "machine": "serverless" },
    "defaults": { "internetFacing": false, "encryption": "transparent", "authentication": "token" },
    "display": { "name": "AWS Lambda", "category": "aws" }
  },
  {
    "drawioStyle": "mxgraph.aws4.rds",
    "threagile": { "technology": "database", "machine": "virtual" },
    "defaults": { "internetFacing": false, "encryption": "transparent", "authentication": "credentials" },
    "display": { "name": "AWS RDS", "category": "aws" }
  },
  {
    "drawioStyle": "mxgraph.aws4.s3",
    "threagile": { "technology": "file-server", "machine": "serverless" },
    "defaults": { "internetFacing": false, "encryption": "none", "authentication": "none" },
    "display": { "name": "AWS S3", "category": "aws" }
  },
  {
    "drawioStyle": "mxgraph.aws4.api_gateway",
    "threagile": { "technology": "api-gateway", "machine": "serverless" },
    "defaults": { "internetFacing": true, "encryption": "transparent", "authentication": "token" },
    "display": { "name": "AWS API Gateway", "category": "aws" }
  },
  {
    "drawioStyle": "mxgraph.aws4.cognito",
    "threagile": { "technology": "identity-provider", "machine": "serverless" },
    "defaults": { "internetFacing": true, "encryption": "transparent", "authentication": "externalized" },
    "display": { "name": "AWS Cognito", "category": "aws" }
  },
  {
    "drawioStyle": "mxgraph.aws4.elasticache",
    "threagile": { "technology": "cache", "machine": "virtual" },
    "defaults": { "internetFacing": false, "encryption": "none", "authentication": "none" },
    "display": { "name": "AWS ElastiCache", "category": "aws" }
  },
  {
    "drawioStyle": "mxgraph.aws4.sqs",
    "threagile": { "technology": "message-queue", "machine": "serverless" },
    "defaults": { "internetFacing": false, "encryption": "transparent", "authentication": "token" },
    "display": { "name": "AWS SQS", "category": "aws" }
  },
  {
    "drawioStyle": "mxgraph.aws4.ecs",
    "threagile": { "technology": "container-platform", "machine": "container" },
    "defaults": { "internetFacing": false, "encryption": "none", "authentication": "none" },
    "display": { "name": "AWS ECS", "category": "aws" }
  },
  {
    "drawioStyle": "mxgraph.aws4.waf",
    "threagile": { "technology": "waf", "machine": "serverless" },
    "defaults": { "internetFacing": true, "encryption": "transparent", "authentication": "none" },
    "display": { "name": "AWS WAF", "category": "aws" }
  },
  {
    "drawioStyle": "mxgraph.azure.virtual_machine",
    "threagile": { "technology": "web-server", "machine": "virtual" },
    "defaults": { "internetFacing": false, "encryption": "none", "authentication": "none" },
    "display": { "name": "Azure VM", "category": "azure" }
  },
  {
    "drawioStyle": "mxgraph.azure.sql_database",
    "threagile": { "technology": "database", "machine": "virtual" },
    "defaults": { "internetFacing": false, "encryption": "transparent", "authentication": "credentials" },
    "display": { "name": "Azure SQL", "category": "azure" }
  },
  {
    "drawioStyle": "mxgraph.gcp.compute_engine",
    "threagile": { "technology": "web-server", "machine": "virtual" },
    "defaults": { "internetFacing": false, "encryption": "none", "authentication": "none" },
    "display": { "name": "GCP Compute", "category": "gcp" }
  },
  {
    "drawioStyle": "swimlane",
    "threagile": { "technology": "unknown", "machine": "virtual" },
    "defaults": {},
    "display": { "name": "Trust Boundary", "category": "boundary" }
  }
]
```

### 4.4 Mapping Lookup Algorithm

```typescript
function findMapping(style: string): ShapeMappingConfig | null {
  // 1. Exact match
  const exact = mappings.find(m => style.includes(m.drawioStyle));
  if (exact) return exact;
  
  // 2. Pattern match
  const pattern = mappings.find(m => m.stylePattern && new RegExp(m.stylePattern).test(style));
  if (pattern) return pattern;
  
  // 3. Return null (will prompt user to classify)
  return null;
}
```

---

## 5. Canonical Risk Mapping

### 5.1 Database Schema

```sql
CREATE TABLE admin.canonical_risk_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Canonical Identity
  canonical_id VARCHAR(100) NOT NULL UNIQUE,
  canonical_title VARCHAR(500) NOT NULL,
  canonical_description TEXT,
  
  -- Severity
  default_severity VARCHAR(50) NOT NULL,       -- critical, high, medium, low
  
  -- External References
  cwe_id INT,
  cwe_name VARCHAR(500),
  capec_ids INT[] DEFAULT '{}',
  attack_techniques TEXT[] DEFAULT '{}',        -- MITRE ATT&CK IDs
  
  -- Source Mappings
  sources JSONB NOT NULL DEFAULT '[]',
  /*
    [
      { "type": "threagile", "id": "missing-authentication", "title": "..." },
      { "type": "cis", "id": "CIS-AWS-2.1.5", "title": "..." },
      { "type": "cwe", "id": "CWE-306", "title": "..." },
      { "type": "prowler", "id": "s3_bucket_public_access", "title": "..." }
    ]
  */
  
  -- Workflow
  status VARCHAR(50) DEFAULT 'pending',
  ai_generated BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES platform.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by source
CREATE INDEX idx_canonical_risk_sources ON admin.canonical_risk_mappings USING GIN (sources);
```

### 5.2 TypeScript Interface

```typescript
interface CanonicalRiskMapping {
  id: string;
  canonicalId: string;            // e.g., "public-storage-exposure"
  canonicalTitle: string;
  canonicalDescription?: string;
  
  defaultSeverity: Severity;
  
  // External References
  cweId?: number;
  cweName?: string;
  capecIds: number[];
  attackTechniques: string[];     // e.g., ["T1530", "T1537"]
  
  // Source Mappings
  sources: RiskSource[];
  
  // Workflow
  status: 'pending' | 'approved' | 'live';
  aiGenerated: boolean;
}

interface RiskSource {
  type: 'threagile' | 'cis' | 'cwe' | 'prowler' | 'trivy' | 'semgrep' | 'custom';
  id: string;
  title: string;
  originalSeverity?: Severity;
}
```

### 5.3 Sample Canonical Mappings

```json
[
  {
    "canonicalId": "public-storage-exposure",
    "canonicalTitle": "Public Cloud Storage Exposure",
    "canonicalDescription": "Cloud storage bucket or blob is publicly accessible, potentially exposing sensitive data",
    "defaultSeverity": "high",
    "cweId": 732,
    "cweName": "Incorrect Permission Assignment for Critical Resource",
    "capecIds": [1, 122],
    "attackTechniques": ["T1530"],
    "sources": [
      { "type": "threagile", "id": "missing-access-restriction", "title": "Missing Access Restriction" },
      { "type": "cis", "id": "CIS-AWS-2.1.5", "title": "Ensure S3 bucket is not publicly accessible" },
      { "type": "cis", "id": "CIS-Azure-3.7", "title": "Ensure storage account public access is disabled" },
      { "type": "prowler", "id": "s3_bucket_public_access", "title": "S3 Bucket Public Access" },
      { "type": "trivy", "id": "AVD-AWS-0086", "title": "S3 bucket has public access enabled" }
    ]
  },
  {
    "canonicalId": "unencrypted-data-transmission",
    "canonicalTitle": "Unencrypted Data Transmission",
    "canonicalDescription": "Data is transmitted over unencrypted channels, vulnerable to interception",
    "defaultSeverity": "high",
    "cweId": 319,
    "cweName": "Cleartext Transmission of Sensitive Information",
    "capecIds": [157, 158],
    "attackTechniques": ["T1040", "T1557"],
    "sources": [
      { "type": "threagile", "id": "unencrypted-communication", "title": "Unencrypted Communication" },
      { "type": "cis", "id": "CIS-AWS-2.2.1", "title": "Ensure ELB uses TLS" },
      { "type": "cwe", "id": "CWE-319", "title": "Cleartext Transmission" }
    ]
  },
  {
    "canonicalId": "missing-authentication",
    "canonicalTitle": "Missing Authentication",
    "canonicalDescription": "Resource or endpoint lacks authentication, allowing unauthorized access",
    "defaultSeverity": "critical",
    "cweId": 306,
    "cweName": "Missing Authentication for Critical Function",
    "capecIds": [12, 36],
    "attackTechniques": ["T1078", "T1190"],
    "sources": [
      { "type": "threagile", "id": "missing-authentication", "title": "Missing Authentication" },
      { "type": "threagile", "id": "missing-authentication-second-factor", "title": "Missing Second Factor" },
      { "type": "cwe", "id": "CWE-306", "title": "Missing Authentication" }
    ]
  },
  {
    "canonicalId": "sql-injection",
    "canonicalTitle": "SQL Injection Vulnerability",
    "canonicalDescription": "Application is vulnerable to SQL injection attacks",
    "defaultSeverity": "critical",
    "cweId": 89,
    "cweName": "SQL Injection",
    "capecIds": [66, 108],
    "attackTechniques": ["T1190"],
    "sources": [
      { "type": "threagile", "id": "sql-injection", "title": "SQL Injection" },
      { "type": "cwe", "id": "CWE-89", "title": "SQL Injection" },
      { "type": "semgrep", "id": "sql-injection", "title": "SQL Injection" }
    ]
  },
  {
    "canonicalId": "unencrypted-storage",
    "canonicalTitle": "Unencrypted Data at Rest",
    "canonicalDescription": "Sensitive data stored without encryption",
    "defaultSeverity": "medium",
    "cweId": 311,
    "cweName": "Missing Encryption of Sensitive Data",
    "capecIds": [37],
    "attackTechniques": ["T1005", "T1530"],
    "sources": [
      { "type": "threagile", "id": "unencrypted-asset", "title": "Unencrypted Asset" },
      { "type": "cis", "id": "CIS-AWS-2.1.1", "title": "Ensure S3 bucket encryption is enabled" },
      { "type": "prowler", "id": "s3_bucket_default_encryption", "title": "S3 Default Encryption" }
    ]
  }
]
```

### 5.4 Deduplication Algorithm

```typescript
interface DeduplicationResult {
  canonicalRisk: CanonicalRiskMapping;
  matchedSources: RiskSource[];
  aggregatedSeverity: Severity;
}

function deduplicateRisks(threagileRisks: ThreagileRisk[]): DeduplicationResult[] {
  const results: Map<string, DeduplicationResult> = new Map();
  
  for (const risk of threagileRisks) {
    // Find canonical mapping for this Threagile risk
    const canonical = findCanonicalBySource('threagile', risk.category);
    
    if (canonical) {
      const existing = results.get(canonical.canonicalId);
      
      if (existing) {
        // Merge: add source, take highest severity
        existing.matchedSources.push({
          type: 'threagile',
          id: risk.category,
          title: risk.title,
          originalSeverity: risk.severity
        });
        existing.aggregatedSeverity = higherSeverity(existing.aggregatedSeverity, risk.severity);
      } else {
        // New canonical risk
        results.set(canonical.canonicalId, {
          canonicalRisk: canonical,
          matchedSources: [{
            type: 'threagile',
            id: risk.category,
            title: risk.title,
            originalSeverity: risk.severity
          }],
          aggregatedSeverity: risk.severity
        });
      }
    } else {
      // No canonical mapping - create standalone risk
      results.set(risk.id, {
        canonicalRisk: createStandaloneCanonical(risk),
        matchedSources: [{ type: 'threagile', id: risk.category, title: risk.title }],
        aggregatedSeverity: risk.severity
      });
    }
  }
  
  return Array.from(results.values());
}

function findCanonicalBySource(type: string, sourceId: string): CanonicalRiskMapping | null {
  return canonicalMappings.find(m => 
    m.sources.some(s => s.type === type && s.id === sourceId)
  );
}
```

---

## 6. Compliance Control Schema

### 6.1 Database Schema

```sql
-- Framework definitions
CREATE TABLE admin.compliance_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,           -- iso27001, nist-800-53, vpdss
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50),
  description TEXT,
  source_url VARCHAR(500),
  control_count INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'live',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual controls
CREATE TABLE admin.compliance_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_code VARCHAR(50) NOT NULL REFERENCES admin.compliance_frameworks(code),
  
  -- Control Identity
  control_id VARCHAR(100) NOT NULL,           -- A.5.1.1, AC-1, etc.
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Hierarchy
  parent_control_id VARCHAR(100),
  level INT DEFAULT 1,                        -- 1 = category, 2 = control, 3 = sub-control
  
  -- Metadata
  guidance TEXT,
  implementation_notes TEXT,
  
  status VARCHAR(50) DEFAULT 'live',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(framework_code, control_id)
);

-- Risk to Control mappings
CREATE TABLE admin.risk_control_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_risk_id VARCHAR(100) NOT NULL,
  framework_code VARCHAR(50) NOT NULL,
  control_id VARCHAR(100) NOT NULL,
  
  -- Mapping strength
  relevance VARCHAR(50) DEFAULT 'primary',    -- primary, secondary, related
  
  -- Workflow
  status VARCHAR(50) DEFAULT 'pending',
  ai_suggested BOOLEAN DEFAULT FALSE,
  ai_confidence DECIMAL(3,2),
  approved_by UUID REFERENCES platform.users(id),
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(canonical_risk_id, framework_code, control_id)
);

CREATE INDEX idx_risk_control_canonical ON admin.risk_control_mappings(canonical_risk_id);
CREATE INDEX idx_risk_control_framework ON admin.risk_control_mappings(framework_code);
```

### 6.2 TypeScript Interfaces

```typescript
interface ComplianceFramework {
  id: string;
  code: string;                    // iso27001, nist-800-53, vpdss
  name: string;
  version?: string;
  description?: string;
  sourceUrl?: string;
  controlCount: number;
}

interface ComplianceControl {
  id: string;
  frameworkCode: string;
  controlId: string;               // A.5.1.1, AC-1, VPDSS-5.3
  title: string;
  description?: string;
  parentControlId?: string;
  level: number;
  guidance?: string;
  implementationNotes?: string;
}

interface RiskControlMapping {
  canonicalRiskId: string;
  frameworkCode: string;
  controlId: string;
  relevance: 'primary' | 'secondary' | 'related';
}

// Runtime gap calculation
interface ComplianceGap {
  framework: ComplianceFramework;
  control: ComplianceControl;
  status: 'gap' | 'partial' | 'satisfied';
  relatedRisks: Risk[];
  remediationStatus: 'pending' | 'in_progress' | 'complete';
}

interface ComplianceReport {
  threatModelId: string;
  framework: ComplianceFramework;
  totalControls: number;
  satisfiedControls: number;
  partialControls: number;
  gapControls: number;
  compliancePercentage: number;
  gaps: ComplianceGap[];
  generatedAt: Date;
}
```

### 6.3 Sample Framework Data

```json
{
  "frameworks": [
    {
      "code": "iso27001",
      "name": "ISO/IEC 27001:2022",
      "version": "2022",
      "controlCount": 93
    },
    {
      "code": "nist-800-53",
      "name": "NIST SP 800-53 Rev 5",
      "version": "Rev 5",
      "controlCount": 1007
    },
    {
      "code": "vpdss",
      "name": "Victorian Protective Data Security Standards",
      "version": "2.0",
      "controlCount": 18
    },
    {
      "code": "ism",
      "name": "Australian Information Security Manual",
      "version": "March 2024",
      "controlCount": 879
    },
    {
      "code": "apra-cps-234",
      "name": "APRA CPS 234 Information Security",
      "version": "2019",
      "controlCount": 36
    },
    {
      "code": "pci-dss",
      "name": "PCI DSS",
      "version": "4.0",
      "controlCount": 250
    }
  ]
}
```

### 6.4 Sample Control Mappings

```json
{
  "mappings": [
    {
      "canonicalRiskId": "unencrypted-data-transmission",
      "controls": [
        { "framework": "iso27001", "controlId": "A.8.24", "title": "Use of cryptography" },
        { "framework": "iso27001", "controlId": "A.5.14", "title": "Information transfer" },
        { "framework": "nist-800-53", "controlId": "SC-8", "title": "Transmission Confidentiality and Integrity" },
        { "framework": "nist-800-53", "controlId": "SC-13", "title": "Cryptographic Protection" },
        { "framework": "vpdss", "controlId": "VPDSS-12", "title": "ICT Security" },
        { "framework": "pci-dss", "controlId": "4.1", "title": "Strong cryptography during transmission" }
      ]
    },
    {
      "canonicalRiskId": "missing-authentication",
      "controls": [
        { "framework": "iso27001", "controlId": "A.8.5", "title": "Secure authentication" },
        { "framework": "iso27001", "controlId": "A.5.17", "title": "Authentication information" },
        { "framework": "nist-800-53", "controlId": "IA-2", "title": "Identification and Authentication" },
        { "framework": "nist-800-53", "controlId": "AC-3", "title": "Access Enforcement" },
        { "framework": "vpdss", "controlId": "VPDSS-9", "title": "Access Security" },
        { "framework": "apra-cps-234", "controlId": "23", "title": "Authentication mechanisms" }
      ]
    },
    {
      "canonicalRiskId": "public-storage-exposure",
      "controls": [
        { "framework": "iso27001", "controlId": "A.8.3", "title": "Information access restriction" },
        { "framework": "nist-800-53", "controlId": "AC-3", "title": "Access Enforcement" },
        { "framework": "nist-800-53", "controlId": "AC-6", "title": "Least Privilege" },
        { "framework": "pci-dss", "controlId": "7.1", "title": "Limit access to system components" }
      ]
    }
  ]
}
```

---

## 7. Remediation Playbook Schema

### 7.1 Database Schema

```sql
CREATE TABLE admin.remediation_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_risk_id VARCHAR(100) NOT NULL UNIQUE,
  
  -- Content
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Steps (ordered array)
  steps JSONB NOT NULL DEFAULT '[]',
  /*
    [
      {
        "order": 1,
        "title": "Step title",
        "description": "Detailed instructions",
        "effort": "low|medium|high",
        "role": "developer|devops|security|architect",
        "estimatedMinutes": 30
      }
    ]
  */
  
  -- IaC Snippets
  iac_snippets JSONB DEFAULT '{}',
  /*
    {
      "terraform": "resource \"...\" { ... }",
      "cloudformation": "Resources:\n  ...",
      "kubernetes": "apiVersion: ...",
      "pulumi": "const resource = new aws.s3.Bucket(...)"
    }
  */
  
  -- References
  references JSONB DEFAULT '[]',
  /*
    [
      { "title": "AWS Documentation", "url": "https://..." },
      { "title": "CIS Benchmark", "url": "https://..." }
    ]
  */
  
  -- Related Controls
  satisfies_controls JSONB DEFAULT '[]',
  /*
    [
      { "framework": "iso27001", "controlId": "A.8.24" },
      { "framework": "nist-800-53", "controlId": "SC-8" }
    ]
  */
  
  -- Metadata
  total_effort VARCHAR(50),                   -- Calculated: low, medium, high, very-high
  estimated_hours DECIMAL(4,1),
  
  -- Workflow
  status VARCHAR(50) DEFAULT 'pending',
  ai_generated BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES platform.users(id),
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.2 TypeScript Interface

```typescript
interface RemediationPlaybook {
  id: string;
  canonicalRiskId: string;
  
  title: string;
  description?: string;
  
  steps: PlaybookStep[];
  iacSnippets: IacSnippets;
  references: Reference[];
  satisfiesControls: ControlReference[];
  
  totalEffort: 'low' | 'medium' | 'high' | 'very-high';
  estimatedHours?: number;
  
  status: 'pending' | 'approved' | 'live';
  aiGenerated: boolean;
}

interface PlaybookStep {
  order: number;
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  role: 'developer' | 'devops' | 'security' | 'architect';
  estimatedMinutes?: number;
  
  // Optional: verification
  verificationSteps?: string[];
  automatable?: boolean;
}

interface IacSnippets {
  terraform?: string;
  cloudformation?: string;
  kubernetes?: string;
  pulumi?: string;
  ansible?: string;
  arm?: string;                    // Azure Resource Manager
}

interface Reference {
  title: string;
  url: string;
  type?: 'documentation' | 'benchmark' | 'blog' | 'video';
}

interface ControlReference {
  framework: string;
  controlId: string;
}
```

### 7.3 Sample Playbooks

```json
[
  {
    "canonicalRiskId": "unencrypted-data-transmission",
    "title": "Enable TLS/HTTPS for Data Transmission",
    "description": "Implement transport layer encryption to protect data in transit",
    "steps": [
      {
        "order": 1,
        "title": "Obtain TLS certificate",
        "description": "Provision a TLS certificate using AWS Certificate Manager (ACM), Let's Encrypt, or your internal CA. For production, use certificates with at least 2048-bit RSA or 256-bit ECC keys.",
        "effort": "low",
        "role": "devops",
        "estimatedMinutes": 15,
        "automatable": true
      },
      {
        "order": 2,
        "title": "Configure load balancer for HTTPS",
        "description": "Update ALB/NLB listener to terminate TLS. Use TLS 1.2 or higher. Disable deprecated protocols (SSLv3, TLS 1.0, TLS 1.1).",
        "effort": "low",
        "role": "devops",
        "estimatedMinutes": 20,
        "automatable": true
      },
      {
        "order": 3,
        "title": "Redirect HTTP to HTTPS",
        "description": "Add a redirect rule for HTTP (port 80) to HTTPS (port 443) with 301 permanent redirect.",
        "effort": "low",
        "role": "devops",
        "estimatedMinutes": 10,
        "automatable": true
      },
      {
        "order": 4,
        "title": "Update application configuration",
        "description": "Ensure all internal service URLs use https:// scheme. Update environment variables, config files, and hardcoded URLs.",
        "effort": "medium",
        "role": "developer",
        "estimatedMinutes": 60
      },
      {
        "order": 5,
        "title": "Enable HSTS",
        "description": "Add Strict-Transport-Security header with appropriate max-age (recommend 31536000 seconds).",
        "effort": "low",
        "role": "devops",
        "estimatedMinutes": 10,
        "automatable": true
      }
    ],
    "iacSnippets": {
      "terraform": "resource \"aws_lb_listener\" \"https\" {\n  load_balancer_arn = aws_lb.main.arn\n  port              = 443\n  protocol          = \"HTTPS\"\n  ssl_policy        = \"ELBSecurityPolicy-TLS13-1-2-2021-06\"\n  certificate_arn   = aws_acm_certificate.main.arn\n\n  default_action {\n    type             = \"forward\"\n    target_group_arn = aws_lb_target_group.main.arn\n  }\n}\n\nresource \"aws_lb_listener\" \"http_redirect\" {\n  load_balancer_arn = aws_lb.main.arn\n  port              = 80\n  protocol          = \"HTTP\"\n\n  default_action {\n    type = \"redirect\"\n    redirect {\n      port        = \"443\"\n      protocol    = \"HTTPS\"\n      status_code = \"HTTP_301\"\n    }\n  }\n}",
      "cloudformation": "HttpsListener:\n  Type: AWS::ElasticLoadBalancingV2::Listener\n  Properties:\n    LoadBalancerArn: !Ref ApplicationLoadBalancer\n    Port: 443\n    Protocol: HTTPS\n    SslPolicy: ELBSecurityPolicy-TLS13-1-2-2021-06\n    Certificates:\n      - CertificateArn: !Ref Certificate\n    DefaultActions:\n      - Type: forward\n        TargetGroupArn: !Ref TargetGroup\n\nHttpRedirectListener:\n  Type: AWS::ElasticLoadBalancingV2::Listener\n  Properties:\n    LoadBalancerArn: !Ref ApplicationLoadBalancer\n    Port: 80\n    Protocol: HTTP\n    DefaultActions:\n      - Type: redirect\n        RedirectConfig:\n          Protocol: HTTPS\n          Port: '443'\n          StatusCode: HTTP_301",
      "kubernetes": "apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: app-ingress\n  annotations:\n    nginx.ingress.kubernetes.io/ssl-redirect: \"true\"\n    nginx.ingress.kubernetes.io/force-ssl-redirect: \"true\"\nspec:\n  tls:\n  - hosts:\n    - app.example.com\n    secretName: app-tls-secret\n  rules:\n  - host: app.example.com\n    http:\n      paths:\n      - path: /\n        pathType: Prefix\n        backend:\n          service:\n            name: app-service\n            port:\n              number: 80"
    },
    "references": [
      { "title": "AWS ALB HTTPS Listener", "url": "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-https-listener.html", "type": "documentation" },
      { "title": "Mozilla SSL Configuration Generator", "url": "https://ssl-config.mozilla.org/", "type": "documentation" },
      { "title": "OWASP TLS Cheat Sheet", "url": "https://cheatsheetseries.owasp.org/cheatsheets/TLS_Cheat_Sheet.html", "type": "documentation" }
    ],
    "satisfiesControls": [
      { "framework": "iso27001", "controlId": "A.8.24" },
      { "framework": "nist-800-53", "controlId": "SC-8" },
      { "framework": "pci-dss", "controlId": "4.1" }
    ],
    "totalEffort": "low",
    "estimatedHours": 2
  },
  {
    "canonicalRiskId": "public-storage-exposure",
    "title": "Restrict Public Access to Cloud Storage",
    "description": "Configure storage bucket to block public access and implement least-privilege permissions",
    "steps": [
      {
        "order": 1,
        "title": "Enable Block Public Access",
        "description": "Enable all four S3 Block Public Access settings at the bucket level: BlockPublicAcls, IgnorePublicAcls, BlockPublicPolicy, RestrictPublicBuckets",
        "effort": "low",
        "role": "devops",
        "estimatedMinutes": 10,
        "automatable": true
      },
      {
        "order": 2,
        "title": "Review and update bucket policy",
        "description": "Remove any Principal: '*' statements. Use specific IAM roles/users. Add condition keys for additional restrictions (VPC endpoint, source IP, MFA).",
        "effort": "medium",
        "role": "security",
        "estimatedMinutes": 45
      },
      {
        "order": 3,
        "title": "Audit existing ACLs",
        "description": "Review bucket and object ACLs. Remove public-read, public-read-write grants. Consider disabling ACLs entirely (bucket owner enforced).",
        "effort": "low",
        "role": "devops",
        "estimatedMinutes": 20
      },
      {
        "order": 4,
        "title": "Enable access logging",
        "description": "Enable S3 server access logging or CloudTrail data events to monitor bucket access patterns.",
        "effort": "low",
        "role": "devops",
        "estimatedMinutes": 15,
        "automatable": true
      },
      {
        "order": 5,
        "title": "Update application access patterns",
        "description": "If public access was intentional, implement alternatives: CloudFront with OAI/OAC, pre-signed URLs, or API-mediated access.",
        "effort": "high",
        "role": "developer",
        "estimatedMinutes": 240
      }
    ],
    "iacSnippets": {
      "terraform": "resource \"aws_s3_bucket_public_access_block\" \"main\" {\n  bucket = aws_s3_bucket.main.id\n\n  block_public_acls       = true\n  block_public_policy     = true\n  ignore_public_acls      = true\n  restrict_public_buckets = true\n}\n\nresource \"aws_s3_bucket_ownership_controls\" \"main\" {\n  bucket = aws_s3_bucket.main.id\n  rule {\n    object_ownership = \"BucketOwnerEnforced\"\n  }\n}",
      "cloudformation": "S3BucketPublicAccessBlock:\n  Type: AWS::S3::BucketPublicAccessBlock\n  Properties:\n    Bucket: !Ref S3Bucket\n    BlockPublicAcls: true\n    BlockPublicPolicy: true\n    IgnorePublicAcls: true\n    RestrictPublicBuckets: true"
    },
    "references": [
      { "title": "AWS S3 Block Public Access", "url": "https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html", "type": "documentation" },
      { "title": "CIS AWS Benchmark - S3", "url": "https://www.cisecurity.org/benchmark/amazon_web_services", "type": "benchmark" }
    ],
    "satisfiesControls": [
      { "framework": "iso27001", "controlId": "A.8.3" },
      { "framework": "nist-800-53", "controlId": "AC-3" },
      { "framework": "nist-800-53", "controlId": "AC-6" },
      { "framework": "cis-aws", "controlId": "2.1.5" }
    ],
    "totalEffort": "medium",
    "estimatedHours": 5.5
  }
]
```

---

## 8. Wizard Questionnaire Schema

### 8.1 Database Schema

```sql
CREATE TABLE admin.wizard_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  question_id VARCHAR(100) NOT NULL UNIQUE,
  
  -- Content
  question_text TEXT NOT NULL,
  help_text TEXT,
  
  -- Type
  question_type VARCHAR(50) NOT NULL,         -- single-select, multi-select, text, toggle
  
  -- Options (for select types)
  options JSONB,
  /*
    [
      { "value": "aws", "label": "Amazon Web Services", "icon": "aws-icon" },
      { "value": "azure", "label": "Microsoft Azure", "icon": "azure-icon" }
    ]
  */
  
  -- Triggers (what happens based on answer)
  triggers JSONB NOT NULL,
  /*
    {
      "aws": {
        "nextQuestionId": "q_aws_compute",
        "addBoundaries": [{ "name": "AWS Cloud", "type": "network-cloud-provider" }],
        "setGlobalProperty": { "cloudProvider": "aws" }
      }
    }
  */
  
  -- Maps To (direct property mapping)
  maps_to JSONB,
  /*
    {
      "nodeProperty": "technology",
      "boundaryProperty": "type",
      "globalProperty": "cloudProvider"
    }
  */
  
  -- Flow Control
  order_index INT NOT NULL,
  is_entry_point BOOLEAN DEFAULT FALSE,
  is_terminal BOOLEAN DEFAULT FALSE,
  
  -- Conditions (when to show this question)
  conditions JSONB,
  /*
    {
      "cloudProvider": "aws",
      "hasDatabase": true
    }
  */
  
  -- Workflow
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wizard_order ON admin.wizard_questions(order_index);
CREATE INDEX idx_wizard_entry ON admin.wizard_questions(is_entry_point) WHERE is_entry_point = TRUE;
```

### 8.2 TypeScript Interface

```typescript
interface WizardQuestion {
  id: string;
  questionId: string;
  
  questionText: string;
  helpText?: string;
  
  questionType: 'single-select' | 'multi-select' | 'text' | 'toggle' | 'number';
  
  options?: QuestionOption[];
  
  triggers: Record<string, QuestionTrigger>;
  
  mapsTo?: PropertyMapping;
  
  orderIndex: number;
  isEntryPoint: boolean;
  isTerminal: boolean;
  
  conditions?: Record<string, any>;
}

interface QuestionOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
  disabled?: boolean;
}

interface QuestionTrigger {
  nextQuestionId?: string;
  addNodes?: NodeTemplate[];
  addBoundaries?: BoundaryTemplate[];
  addLinks?: LinkTemplate[];
  setGlobalProperty?: Record<string, any>;
  setNodeProperty?: Record<string, any>;
  skipToQuestionId?: string;
}

interface NodeTemplate {
  name: string;
  technology: TechnologyEnum;
  machine: MachineType;
  defaults: Partial<TechnicalAsset>;
  placementHint?: 'inside-boundary' | 'outside-boundary';
  boundaryRef?: string;
}

interface BoundaryTemplate {
  name: string;
  type: BoundaryType;
  ref?: string;                    // Reference ID for later use
}

interface LinkTemplate {
  sourceRef: string;
  targetRef: string;
  protocol: ProtocolType;
  defaults: Partial<CommunicationLink>;
}

interface PropertyMapping {
  nodeProperty?: string;
  boundaryProperty?: string;
  globalProperty?: string;
  linkProperty?: string;
}
```

### 8.3 Sample Wizard Flow

```json
{
  "questions": [
    {
      "questionId": "q_app_type",
      "questionText": "What type of application are you building?",
      "helpText": "This helps us set up the right architecture template",
      "questionType": "single-select",
      "options": [
        { "value": "web-app", "label": "Web Application", "icon": "globe", "description": "Browser-based application" },
        { "value": "api-service", "label": "API Service", "icon": "server", "description": "Backend API or microservice" },
        { "value": "mobile-backend", "label": "Mobile Backend", "icon": "smartphone", "description": "Backend for mobile apps" },
        { "value": "data-pipeline", "label": "Data Pipeline", "icon": "database", "description": "ETL or data processing" }
      ],
      "triggers": {
        "web-app": {
          "nextQuestionId": "q_cloud_provider",
          "addNodes": [
            { "name": "Browser", "technology": "browser", "machine": "client", "ref": "client" }
          ],
          "setGlobalProperty": { "appType": "web-app" }
        },
        "api-service": {
          "nextQuestionId": "q_cloud_provider",
          "setGlobalProperty": { "appType": "api-service" }
        },
        "mobile-backend": {
          "nextQuestionId": "q_cloud_provider",
          "addNodes": [
            { "name": "Mobile App", "technology": "mobile-app", "machine": "client", "ref": "client" }
          ],
          "setGlobalProperty": { "appType": "mobile-backend" }
        }
      },
      "orderIndex": 1,
      "isEntryPoint": true
    },
    {
      "questionId": "q_cloud_provider",
      "questionText": "Which cloud provider hosts your infrastructure?",
      "questionType": "single-select",
      "options": [
        { "value": "aws", "label": "Amazon Web Services", "icon": "aws" },
        { "value": "azure", "label": "Microsoft Azure", "icon": "azure" },
        { "value": "gcp", "label": "Google Cloud Platform", "icon": "gcp" },
        { "value": "multi", "label": "Multi-cloud", "icon": "cloud" },
        { "value": "on-prem", "label": "On-premises", "icon": "server" }
      ],
      "triggers": {
        "aws": {
          "nextQuestionId": "q_compute_type",
          "addBoundaries": [
            { "name": "AWS Cloud", "type": "network-cloud-provider", "ref": "cloud" },
            { "name": "VPC", "type": "network-cloud-security-group", "ref": "vpc" }
          ],
          "setGlobalProperty": { "cloudProvider": "aws" }
        },
        "azure": {
          "nextQuestionId": "q_compute_type",
          "addBoundaries": [
            { "name": "Azure Cloud", "type": "network-cloud-provider", "ref": "cloud" },
            { "name": "Virtual Network", "type": "network-cloud-security-group", "ref": "vpc" }
          ],
          "setGlobalProperty": { "cloudProvider": "azure" }
        }
      },
      "orderIndex": 2
    },
    {
      "questionId": "q_compute_type",
      "questionText": "What compute platform runs your application?",
      "questionType": "single-select",
      "options": [
        { "value": "ec2", "label": "EC2 / Virtual Machines", "description": "Traditional server instances" },
        { "value": "ecs", "label": "ECS / Container Service", "description": "Docker containers" },
        { "value": "eks", "label": "EKS / Kubernetes", "description": "Kubernetes orchestration" },
        { "value": "lambda", "label": "Lambda / Serverless", "description": "Function-as-a-Service" },
        { "value": "app-service", "label": "App Service / PaaS", "description": "Platform-as-a-Service" }
      ],
      "triggers": {
        "ec2": {
          "nextQuestionId": "q_database",
          "addNodes": [
            { "name": "Application Server", "technology": "web-server", "machine": "virtual", "ref": "app-server", "placementHint": "inside-boundary", "boundaryRef": "vpc" }
          ]
        },
        "ecs": {
          "nextQuestionId": "q_database",
          "addNodes": [
            { "name": "ECS Service", "technology": "container-platform", "machine": "container", "ref": "app-server", "placementHint": "inside-boundary", "boundaryRef": "vpc" }
          ]
        },
        "lambda": {
          "nextQuestionId": "q_api_gateway",
          "addNodes": [
            { "name": "Lambda Function", "technology": "function", "machine": "serverless", "ref": "app-server", "placementHint": "inside-boundary", "boundaryRef": "vpc" }
          ]
        }
      },
      "orderIndex": 3,
      "conditions": { "cloudProvider": ["aws", "azure", "gcp"] }
    },
    {
      "questionId": "q_database",
      "questionText": "Do you use a database?",
      "questionType": "single-select",
      "options": [
        { "value": "rds", "label": "Yes - Relational (RDS/SQL)", "description": "PostgreSQL, MySQL, etc." },
        { "value": "dynamodb", "label": "Yes - NoSQL (DynamoDB/Cosmos)", "description": "Key-value or document store" },
        { "value": "both", "label": "Yes - Both", "description": "Relational and NoSQL" },
        { "value": "none", "label": "No database", "description": "Stateless or external data" }
      ],
      "triggers": {
        "rds": {
          "nextQuestionId": "q_authentication",
          "addBoundaries": [
            { "name": "Private Subnet", "type": "network-cloud-security-group", "ref": "private-subnet" }
          ],
          "addNodes": [
            { "name": "Database", "technology": "database", "machine": "virtual", "ref": "database", "placementHint": "inside-boundary", "boundaryRef": "private-subnet", "defaults": { "internetFacing": false, "encryption": "transparent" } }
          ],
          "addLinks": [
            { "sourceRef": "app-server", "targetRef": "database", "protocol": "jdbc-encrypted", "defaults": { "authentication": "credentials" } }
          ]
        },
        "none": {
          "nextQuestionId": "q_authentication"
        }
      },
      "orderIndex": 4
    },
    {
      "questionId": "q_authentication",
      "questionText": "How do users authenticate?",
      "questionType": "multi-select",
      "helpText": "Select all that apply",
      "options": [
        { "value": "username-password", "label": "Username/Password" },
        { "value": "oauth", "label": "OAuth/SSO (Google, GitHub, etc.)" },
        { "value": "cognito", "label": "AWS Cognito / Azure AD B2C" },
        { "value": "api-key", "label": "API Keys" },
        { "value": "mfa", "label": "Multi-factor Authentication" },
        { "value": "none", "label": "No authentication (public)" }
      ],
      "triggers": {
        "cognito": {
          "addNodes": [
            { "name": "Cognito", "technology": "identity-provider", "machine": "serverless", "ref": "idp", "defaults": { "internetFacing": true } }
          ],
          "addLinks": [
            { "sourceRef": "client", "targetRef": "idp", "protocol": "https", "defaults": { "authentication": "credentials" } },
            { "sourceRef": "app-server", "targetRef": "idp", "protocol": "https", "defaults": { "authentication": "token" } }
          ]
        },
        "mfa": {
          "setNodeProperty": { "ref": "idp", "authentication": "two-factor" }
        }
      },
      "mapsTo": { "globalProperty": "authMethods" },
      "orderIndex": 5
    },
    {
      "questionId": "q_internet_facing",
      "questionText": "Is your application directly accessible from the internet?",
      "questionType": "toggle",
      "helpText": "Select yes if users access via public URL",
      "triggers": {
        "true": {
          "nextQuestionId": "q_cdn_waf",
          "setNodeProperty": { "ref": "app-server", "internetFacing": true },
          "addNodes": [
            { "name": "Load Balancer", "technology": "load-balancer", "machine": "serverless", "ref": "alb", "defaults": { "internetFacing": true } }
          ],
          "addLinks": [
            { "sourceRef": "client", "targetRef": "alb", "protocol": "https" },
            { "sourceRef": "alb", "targetRef": "app-server", "protocol": "https" }
          ]
        },
        "false": {
          "nextQuestionId": "q_data_sensitivity"
        }
      },
      "orderIndex": 6
    },
    {
      "questionId": "q_cdn_waf",
      "questionText": "Do you use a CDN or WAF?",
      "questionType": "multi-select",
      "options": [
        { "value": "cdn", "label": "CDN (CloudFront, Cloudflare)", "description": "Content delivery network" },
        { "value": "waf", "label": "WAF (Web Application Firewall)", "description": "Layer 7 protection" },
        { "value": "none", "label": "Neither" }
      ],
      "triggers": {
        "cdn": {
          "addNodes": [
            { "name": "CloudFront", "technology": "cdn", "machine": "serverless", "ref": "cdn", "defaults": { "internetFacing": true } }
          ]
        },
        "waf": {
          "addNodes": [
            { "name": "WAF", "technology": "waf", "machine": "serverless", "ref": "waf", "defaults": { "internetFacing": true } }
          ]
        }
      },
      "orderIndex": 7,
      "conditions": { "internetFacing": true }
    },
    {
      "questionId": "q_data_sensitivity",
      "questionText": "What type of data does your application process?",
      "questionType": "multi-select",
      "options": [
        { "value": "pii", "label": "Personal Identifiable Information (PII)" },
        { "value": "financial", "label": "Financial data" },
        { "value": "health", "label": "Health records (PHI)" },
        { "value": "credentials", "label": "Credentials / Secrets" },
        { "value": "public", "label": "Public data only" }
      ],
      "mapsTo": { "globalProperty": "dataClassification" },
      "orderIndex": 8,
      "isTerminal": true
    }
  ]
}
```

---

## 9. Ticket Adapter Schema

### 9.1 Generic Ticket Payload

```typescript
interface GenericTicketPayload {
  // Identifiers
  externalSystem: 'jira' | 'servicenow' | 'ado' | 'linear' | 'asana';
  threatModelId: string;
  riskId: string;
  
  // Content
  title: string;
  description: string;
  
  // Classification
  type: 'security-task' | 'bug' | 'story' | 'incident';
  priority: 'critical' | 'high' | 'medium' | 'low';
  severity: 'critical' | 'high' | 'medium' | 'low';
  
  // Assignment
  projectKey: string;
  assignee?: string;
  labels: string[];
  
  // Metadata
  customFields?: Record<string, any>;
  
  // Remediation
  playbook?: RemediationPlaybook;
  complianceControls?: ControlReference[];
}
```

### 9.2 Adapter Configuration

```typescript
interface TicketAdapterConfig {
  // Connection
  baseUrl: string;
  authType: 'basic' | 'oauth' | 'api-key' | 'pat';
  credentials: {
    username?: string;
    password?: string;
    apiKey?: string;
    token?: string;
    clientId?: string;
    clientSecret?: string;
  };
  
  // Field Mappings
  fieldMappings: {
    title: string;                 // e.g., "summary" for Jira
    description: string;           // e.g., "description"
    priority: Record<string, string>;
    type: Record<string, string>;
    labels: string;
    assignee: string;
    customFields: Record<string, string>;
  };
  
  // Defaults
  defaults: {
    projectKey: string;
    issueType: string;
    labels: string[];
  };
}
```

### 9.3 Jira Adapter Config

```json
{
  "baseUrl": "https://company.atlassian.net",
  "authType": "basic",
  "fieldMappings": {
    "title": "summary",
    "description": "description",
    "priority": {
      "critical": "Highest",
      "high": "High",
      "medium": "Medium",
      "low": "Low"
    },
    "type": {
      "security-task": "Task",
      "bug": "Bug",
      "incident": "Incident"
    },
    "labels": "labels",
    "assignee": "assignee.accountId",
    "customFields": {
      "cweId": "customfield_10100",
      "threatModelLink": "customfield_10101"
    }
  },
  "defaults": {
    "projectKey": "SEC",
    "issueType": "Task",
    "labels": ["threat-model", "security"]
  }
}
```

### 9.4 ServiceNow Adapter Config

```json
{
  "baseUrl": "https://company.service-now.com",
  "authType": "oauth",
  "fieldMappings": {
    "title": "short_description",
    "description": "description",
    "priority": {
      "critical": "1",
      "high": "2",
      "medium": "3",
      "low": "4"
    },
    "type": {
      "security-task": "security_incident",
      "incident": "incident"
    },
    "assignee": "assigned_to"
  },
  "defaults": {
    "category": "Security",
    "subcategory": "Vulnerability"
  }
}
```

---

## 10. Report Template Schema

### 10.1 PDF Report Structure

```typescript
interface PdfReportTemplate {
  sections: PdfSection[];
  styles: {
    primaryColor: string;
    fontFamily: string;
    logoUrl?: string;
  };
  pageSettings: {
    size: 'A4' | 'Letter';
    orientation: 'portrait' | 'landscape';
    margins: { top: number; bottom: number; left: number; right: number };
  };
}

interface PdfSection {
  id: string;
  type: 'cover' | 'toc' | 'summary' | 'diagram' | 'risk-table' | 'compliance' | 'remediation' | 'appendix';
  title: string;
  enabled: boolean;
  pageBreakBefore: boolean;
  content?: PdfContent;
}

interface PdfContent {
  // Varies by section type
  summaryMetrics?: string[];       // For summary: ["total_risks", "critical_count", ...]
  tableColumns?: string[];         // For tables: ["title", "severity", "status", ...]
  diagramOptions?: {
    includeRiskOverlay: boolean;
    maxWidth: number;
    maxHeight: number;
  };
}
```

### 10.2 Excel Report Structure

```typescript
interface ExcelReportTemplate {
  sheets: ExcelSheet[];
  styles: {
    headerColor: string;
    criticalColor: string;
    highColor: string;
    mediumColor: string;
    lowColor: string;
  };
}

interface ExcelSheet {
  name: string;
  type: 'summary' | 'risks' | 'assets' | 'compliance' | 'remediations';
  columns: ExcelColumn[];
  filters: boolean;
  freezeHeader: boolean;
}

interface ExcelColumn {
  header: string;
  field: string;                   // JSON path to data
  width: number;
  format?: 'text' | 'number' | 'date' | 'link';
}
```

### 10.3 Sample Excel Template

```json
{
  "sheets": [
    {
      "name": "Summary",
      "type": "summary",
      "columns": [
        { "header": "Metric", "field": "metric", "width": 30 },
        { "header": "Value", "field": "value", "width": 20 }
      ]
    },
    {
      "name": "Risks",
      "type": "risks",
      "columns": [
        { "header": "ID", "field": "id", "width": 15 },
        { "header": "Title", "field": "title", "width": 50 },
        { "header": "Severity", "field": "severity", "width": 12 },
        { "header": "Status", "field": "status", "width": 15 },
        { "header": "Affected Asset", "field": "affectedAsset.name", "width": 25 },
        { "header": "CWE", "field": "cweId", "width": 10 },
        { "header": "Compliance", "field": "complianceMappings", "width": 30 },
        { "header": "Remediation", "field": "remediation.status", "width": 15 }
      ],
      "filters": true,
      "freezeHeader": true
    },
    {
      "name": "Assets",
      "type": "assets",
      "columns": [
        { "header": "Name", "field": "name", "width": 30 },
        { "header": "Technology", "field": "technology", "width": 20 },
        { "header": "Internet Facing", "field": "internetFacing", "width": 15 },
        { "header": "Authentication", "field": "authentication", "width": 15 },
        { "header": "Encryption", "field": "encryption", "width": 15 },
        { "header": "Data Processed", "field": "dataAssetsProcessed", "width": 30 },
        { "header": "Risk Count", "field": "riskCount", "width": 12 }
      ],
      "filters": true,
      "freezeHeader": true
    },
    {
      "name": "Compliance",
      "type": "compliance",
      "columns": [
        { "header": "Framework", "field": "framework", "width": 20 },
        { "header": "Control ID", "field": "controlId", "width": 15 },
        { "header": "Control Title", "field": "controlTitle", "width": 40 },
        { "header": "Status", "field": "status", "width": 15 },
        { "header": "Related Risks", "field": "relatedRisks", "width": 30 }
      ],
      "filters": true,
      "freezeHeader": true
    }
  ]
}
```

### 10.4 JSON Export Schema

```typescript
interface ThreatModelExport {
  // Metadata
  exportVersion: string;
  exportedAt: string;
  threatModelId: string;
  threatModelName: string;
  
  // Diagram Data
  assets: TechnicalAsset[];
  boundaries: TrustBoundary[];
  links: CommunicationLink[];
  dataAssets: DataAsset[];
  
  // Analysis Results
  analysisRun: {
    id: string;
    completedAt: string;
    engineVersion: string;
  };
  risks: Risk[];
  
  // Compliance
  selectedFrameworks: string[];
  complianceGaps: ComplianceGap[];
  
  // Remediations
  remediations: Remediation[];
  
  // Statistics
  stats: {
    totalAssets: number;
    totalLinks: number;
    totalRisks: number;
    risksBySeverity: Record<Severity, number>;
    risksByStatus: Record<RiskStatus, number>;
    complianceByFramework: Record<string, number>;
  };
}
```

### 10.5 SARIF Export Mapping

```typescript
interface SarifMapping {
  // Risk → SARIF Result
  riskToResult: {
    id: 'risk.id',
    ruleId: 'risk.canonicalRiskId || risk.threagileRiskId',
    level: {
      critical: 'error',
      high: 'error',
      medium: 'warning',
      low: 'note'
    },
    message: 'risk.title + risk.description',
    locations: [{
      physicalLocation: {
        artifactLocation: {
          uri: 'risk.affectedAsset.name'
        }
      }
    }],
    properties: {
      severity: 'risk.severity',
      cwe: 'risk.cweId',
      compliance: 'risk.complianceMappings'
    }
  };
  
  // Risk Category → SARIF Rule
  categoryToRule: {
    id: 'canonicalRiskId',
    name: 'canonicalTitle',
    shortDescription: 'canonicalTitle',
    fullDescription: 'canonicalDescription',
    help: {
      text: 'remediation.steps',
      markdown: 'formatted remediation'
    },
    properties: {
      cwe: 'cweId',
      security_severity: 'numeric severity'
    }
  };
}
```

---

## 11. Document References

| Doc | Purpose |
|-----|---------|
| `00_overview.md` | Product summary, vision, tiers |
| `01_product_context.md` | Personas, stories, JTBD |
| `02_functional_spec.md` | Features, behaviors |
| `03_technical_spec.md` | Architecture, stack, APIs |
| **`04_data_models.md`** | **This document** — schemas, mappings |
| `05_ui_screens.md` | Screen-by-screen UI spec |
| `06_user_flows.md` | Step-by-step user journeys |
| `07_admin_console.md` | Admin app specification |
| `08_rules.md` | Code constraints for Claude Code |
| `09_implementation_plan.md` | Phased build order |

---

*Last updated: 2025-01-23*
*Author: ThreatDiviner Product Team*
