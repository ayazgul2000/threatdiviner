// apps/api/src/threat-modeling/templates/diagram-format.templates.ts
// Enterprise Threat Model Diagram Format Specification for ThreatDiviner

/**
 * DIAGRAM FORMAT SPECIFICATION
 * ============================
 * 
 * The threat model diagram should visually represent:
 * 1. Components (color-coded by type)
 * 2. Trust Boundaries (dashed rectangles grouping components)
 * 3. Data Flows (arrows with labels)
 * 4. Threat Actors (stick figures or icons at edges)
 * 5. Security Controls (shield icons on flows)
 * 6. Diagram ID Labels (unique IDs for each element)
 * 
 * DIAGRAM-TO-TABLE MAPPING
 * ========================
 * Every visual element has a Diagram ID that maps to the threat table:
 * - D-APGW01 → API Gateway component
 * - D-AUTH01 → Authorizer component
 * - D-DB01 → Database component
 * - etc.
 * 
 * The diagram includes a "Diagram ID Mapping" legend showing all IDs.
 */

/**
 * Component color scheme by category
 */
export const COMPONENT_COLORS = {
  // Compute & Processing (Green shades)
  PROCESS: { bg: '#48BB78', border: '#2F855A', text: '#FFFFFF' },
  API: { bg: '#4299E1', border: '#2B6CB0', text: '#FFFFFF' },
  FUNCTION: { bg: '#68D391', border: '#38A169', text: '#000000' },
  CONTAINER: { bg: '#4FD1C5', border: '#319795', text: '#000000' },
  
  // Data Stores (Purple shades)
  DATABASE: { bg: '#9F7AEA', border: '#6B46C1', text: '#FFFFFF' },
  STORAGE: { bg: '#B794F4', border: '#805AD5', text: '#000000' },
  CACHE: { bg: '#D6BCFA', border: '#9F7AEA', text: '#000000' },
  DATA_WAREHOUSE: { bg: '#00D4FF', border: '#0099CC', text: '#000000' },
  
  // Identity & Security (Orange/Red shades)
  AUTH: { bg: '#ED8936', border: '#C05621', text: '#FFFFFF' },
  IAM: { bg: '#F6AD55', border: '#DD6B20', text: '#000000' },
  SECRETS: { bg: '#FC8181', border: '#C53030', text: '#000000' },
  ENCRYPTION: { bg: '#FEB2B2', border: '#E53E3E', text: '#000000' },
  
  // Networking (Blue/Teal shades)
  NETWORK: { bg: '#4FD1C5', border: '#319795', text: '#000000' },
  CDN: { bg: '#63B3ED', border: '#3182CE', text: '#000000' },
  GATEWAY: { bg: '#4299E1', border: '#2B6CB0', text: '#FFFFFF' },
  LOAD_BALANCER: { bg: '#38B2AC', border: '#2C7A7B', text: '#FFFFFF' },
  
  // Messaging (Yellow/Teal shades)
  QUEUE: { bg: '#81E6D9', border: '#38B2AC', text: '#000000' },
  NOTIFICATION: { bg: '#38B2AC', border: '#2C7A7B', text: '#FFFFFF' },
  EVENT_BUS: { bg: '#F6E05E', border: '#D69E2E', text: '#000000' },
  STREAM: { bg: '#FBD38D', border: '#D69E2E', text: '#000000' },
  
  // External (Gray shades)
  EXTERNAL_ENTITY: { bg: '#A0AEC0', border: '#718096', text: '#000000' },
  USER: { bg: '#CBD5E0', border: '#A0AEC0', text: '#000000' },
  THIRD_PARTY: { bg: '#E2E8F0', border: '#CBD5E0', text: '#000000' },
  
  // Security Controls (shown on data flows)
  ENCRYPTION_CONTROL: { bg: '#68D391', border: '#38A169', text: '#000000', icon: '🔒' },
  AUTH_CONTROL: { bg: '#F6AD55', border: '#DD6B20', text: '#000000', icon: '🔑' },
};

/**
 * Trust Boundary styles
 */
export const TRUST_BOUNDARY_STYLES = {
  CLOUD_ACCOUNT: { stroke: '#3182CE', strokeDasharray: '10,5', fill: 'rgba(66,153,225,0.05)' },
  VPC: { stroke: '#319795', strokeDasharray: '8,4', fill: 'rgba(56,178,172,0.05)' },
  SUBNET: { stroke: '#805AD5', strokeDasharray: '6,3', fill: 'rgba(159,122,234,0.05)' },
  SECURITY_GROUP: { stroke: '#E53E3E', strokeDasharray: '4,2', fill: 'rgba(229,62,62,0.05)' },
  EXTERNAL: { stroke: '#718096', strokeDasharray: '5,5', fill: 'rgba(113,128,150,0.05)' },
};

/**
 * Threat Actor icons and positions
 */
export const THREAT_ACTORS = {
  EXTERNAL_ATTACKER: {
    label: 'External Attacker',
    subtypes: ['Cybercriminal', 'Nation-State', 'Hacktivist', 'Script Kiddie'],
    position: 'top-left',
    icon: '👤',
  },
  MALICIOUS_INSIDER: {
    label: 'Malicious Insider',
    subtypes: ['Developer', 'Employee', 'Contractor', 'Administrator'],
    position: 'top-right',
    icon: '👤',
  },
  COMPROMISED_PARTNER: {
    label: 'Compromised Partner',
    subtypes: ['Vendor', 'API Consumer', 'Data Provider'],
    position: 'bottom-left',
    icon: '🏢',
  },
};

/**
 * Data Flow line styles
 */
export const DATA_FLOW_STYLES = {
  ENCRYPTED: { stroke: '#38A169', strokeWidth: 2, markerEnd: 'arrow-green' },
  UNENCRYPTED: { stroke: '#E53E3E', strokeWidth: 2, markerEnd: 'arrow-red', strokeDasharray: '5,3' },
  AUTHENTICATED: { stroke: '#3182CE', strokeWidth: 2, markerEnd: 'arrow-blue' },
  INTERNAL: { stroke: '#718096', strokeWidth: 1.5, markerEnd: 'arrow-gray' },
  CROSS_BOUNDARY: { stroke: '#D69E2E', strokeWidth: 2.5, markerEnd: 'arrow-yellow' },
};

/**
 * Diagram ID prefix conventions
 */
export const DIAGRAM_ID_PREFIXES: Record<string, string> = {
  // Users and External
  USER: 'U',
  EXTERNAL: 'EXT',
  THIRD_PARTY: 'TP',
  
  // Compute
  API_GATEWAY: 'APGW',
  APPLICATION: 'APP',
  LAMBDA: 'LMB',
  FUNCTION: 'FN',
  CONTAINER: 'CTR',
  SERVICE: 'SVC',
  
  // Auth
  AUTHORIZER: 'AUTH',
  IDENTITY_PROVIDER: 'IDP',
  IAM: 'IAM',
  
  // Storage
  DATABASE: 'DB',
  OBJECT_STORAGE: 'S3',
  CACHE: 'CACHE',
  DATA_WAREHOUSE: 'DW',
  
  // Messaging
  QUEUE: 'Q',
  NOTIFICATION: 'NOTIF',
  STREAM: 'STR',
  EVENT_BUS: 'EVT',
  
  // Security
  SECRETS: 'SEC',
  ENCRYPTION: 'KMS',
  WAF: 'WAF',
  
  // Network
  VPC: 'VPC',
  CDN: 'CDN',
  LOAD_BALANCER: 'LB',
  
  // Data Flows
  DATA_FLOW: 'DF',
  
  // Trust Boundaries
  TRUST_BOUNDARY: 'TB',
};

/**
 * Generate a diagram ID for a component
 */
export function generateDiagramId(type: string, index: number): string {
  const prefix = DIAGRAM_ID_PREFIXES[type.toUpperCase()] || 'CMP';
  return `D-${prefix}${String(index).padStart(2, '0')}`;
}

/**
 * Threat table columns that map to diagram elements
 */
export const THREAT_TABLE_COLUMNS = [
  'Diagram ID',                      // Links to visual element
  'Component/System',                // Name of the component
  'Threat Category',                 // STRIDE category
  'Threat Description',              // What could happen
  'Vulnerability',                   // Weakness being exploited
  'Attack Vector',                   // How attack is performed
  'Threat Actor',                    // Who would attack
  'Skills Required',                 // Low/Medium/High
  'Complexity',                      // Low/Medium/High
  'Likelihood (Pre-Control)',        // Before mitigations
  'Impact (CIA)',                    // Confidentiality/Integrity/Availability
  'Existing Controls',               // Current mitigations
  'Risk After Existing Controls',    // Residual risk
  'Gap/Additional Control Recommended', // What else is needed
  'Final Risk After Recommendations',   // Target risk
  'Comments',                        // Notes
  'Commented By',                    // Reviewer
  'Jira Card',                       // Tracking ticket
  'CWE IDs',                         // Weakness enumeration
  'ATT&CK Techniques',               // MITRE ATT&CK
  'Status',                          // Identified/Mitigated/Accepted
];

/**
 * Risk level color coding for reports
 */
export const RISK_COLORS = {
  critical: { bg: '#C53030', text: '#FFFFFF' },
  high: { bg: '#DD6B20', text: '#FFFFFF' },
  medium: { bg: '#D69E2E', text: '#000000' },
  low: { bg: '#38A169', text: '#FFFFFF' },
};

/**
 * Status color coding
 */
export const STATUS_COLORS = {
  identified: { bg: '#E53E3E', text: '#FFFFFF' },
  'in progress': { bg: '#ED8936', text: '#FFFFFF' },
  mitigated: { bg: '#38A169', text: '#FFFFFF' },
  accepted: { bg: '#3182CE', text: '#FFFFFF' },
  transferred: { bg: '#805AD5', text: '#FFFFFF' },
};

/**
 * Example diagram mapping legend format
 * This appears as a box in the corner of the diagram
 */
export const DIAGRAM_MAPPING_LEGEND_EXAMPLE = `
Diagram ID Mapping:
D-U01: Users/Client Applications
D-APGW01: API Gateway
D-AUTH01: Authorizer (Lambda)
D-APP01: Application Server
D-DB01: Primary Database
D-S301: Object Storage
D-Q01: Message Queue
D-NOTIF01: Notification Service
D-SEC01: Secrets Manager
D-IDP01: Identity Provider
D-EXT01: Third-Party Integration
D-TB01: Trust Boundary (Internal)
D-TB02: Trust Boundary (External)
`;

/**
 * Security annotations that appear on data flows
 */
export const FLOW_ANNOTATIONS = {
  ENCRYPTED: '🔒 Encrypted (TLS 1.3)',
  AUTHENTICATED: '🔑 Authenticated',
  SIGNED: '✍️ Signed',
  RATE_LIMITED: '⏱️ Rate Limited',
  LOGGED: '📝 Logged',
  UNPROTECTED: '⚠️ Unprotected',
};

/**
 * Threat annotations that appear near components
 */
export const THREAT_ANNOTATIONS = {
  SQL_INJECTION: 'SQL Injection',
  XSS: 'Cross-Site Scripting',
  AUTH_BYPASS: 'Authentication Bypass',
  PRIVILEGE_ESCALATION: 'Privilege Escalation',
  DATA_EXPOSURE: 'Data Exposure',
  DOS: 'Denial of Service',
  CREDENTIAL_THEFT: 'Credential Theft',
  MAN_IN_MIDDLE: 'Man-in-the-Middle',
  INSIDER_THREAT: 'Insider Threat',
};

/**
 * Interface for diagram component
 */
export interface DiagramComponent {
  diagramId: string;
  name: string;
  type: string;
  technology?: string;
  trustBoundary?: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  dataClassification?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/**
 * Interface for data flow
 */
export interface DiagramDataFlow {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  protocol?: string;
  encrypted: boolean;
  authenticated: boolean;
  crossesTrustBoundary: boolean;
  annotations: string[];
}

/**
 * Interface for trust boundary
 */
export interface DiagramTrustBoundary {
  id: string;
  name: string;
  type: string;
  componentIds: string[];
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/**
 * Interface for complete diagram
 */
export interface ThreatModelDiagram {
  title: string;
  version: string;
  components: DiagramComponent[];
  dataFlows: DiagramDataFlow[];
  trustBoundaries: DiagramTrustBoundary[];
  threatActors: string[];
  legend: { diagramId: string; description: string }[];
}
