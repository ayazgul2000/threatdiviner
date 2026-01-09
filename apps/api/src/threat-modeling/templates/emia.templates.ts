// apps/api/src/threat-modeling/templates/emia.templates.ts
// EMIA (Enterprise Methodology for Information Assurance) threat model templates
// Based on the enterprise threat modeling format shown in the EMIA Solution Conceptual Threat Model

export interface EmiaComponent {
  diagramId: string;
  name: string;
  type: 'PROCESS' | 'DATA_STORE' | 'EXTERNAL_ENTITY' | 'TRUST_BOUNDARY' | 'SECURITY_CONTROL';
  technology?: string;
  awsAccount?: string;
  criticality: 'Low' | 'Medium' | 'High' | 'Critical';
  dataClassification?: string;
  description?: string;
}

export interface EmiaDataFlow {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  dataType: string;
  protocol?: string;
  encrypted: boolean;
  authenticated: boolean;
  crossesTrustBoundary: boolean;
}

export interface EmiaThreat {
  diagramId: string;
  componentSystem: string;
  threatCategory: string; // STRIDE category
  threatDescription: string;
  vulnerability: string;
  attackVector: string;
  threatActor: string;
  skillsRequired: 'Low' | 'Medium' | 'High';
  complexity: 'Low' | 'Medium' | 'High';
  likelihoodPreControl: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
  impactCIA: string; // e.g., "C:High, I:High, A:Medium"
  existingControls: string;
  riskAfterExistingControls: 'Low' | 'Medium' | 'High' | 'Critical';
  gapRecommendation: string;
  finalRiskAfterRecommendations: 'Low' | 'Medium' | 'High' | 'Critical';
  comments?: string;
  commentedBy?: string;
  jiraCard?: string;
  cweIds: string[];
  attackTechniqueIds: string[];
  status: 'Identified' | 'In Progress' | 'Mitigated' | 'Accepted' | 'Transferred';
}

// EMIA Excel column headers for threat analysis worksheet
export const EMIA_THREAT_COLUMNS = [
  'Diagram ID',
  'Component/System',
  'Threat Category',
  'Threat Description',
  'Vulnerability',
  'Attack Vector',
  'Threat Actor',
  'Skills Required',
  'Complexity',
  'Likelihood (Pre-Control)',
  'Impact (CIA)',
  'Existing Controls',
  'Risk After Existing Controls',
  'Gap/Additional Control Recommended',
  'Final Risk After Recommendations',
  'Comments',
  'Commented By',
  'Jira Card',
  'CWE IDs',
  'ATT&CK Techniques',
  'Status',
];

// Standard EMIA component types based on the diagram
export const EMIA_COMPONENT_TYPES = {
  API_GATEWAY: { color: '#4299E1', prefix: 'APGW' },
  LAMBDA: { color: '#48BB78', prefix: 'LMB' },
  COGNITO: { color: '#ED8936', prefix: 'COG' },
  S3: { color: '#9F7AEA', prefix: 'S3' },
  DYNAMODB: { color: '#F56565', prefix: 'DDB' },
  SNS: { color: '#38B2AC', prefix: 'SNS' },
  SQS: { color: '#FC8181', prefix: 'SQS' },
  CLOUDFRONT: { color: '#667EEA', prefix: 'CF' },
  ROUTE53: { color: '#667EEA', prefix: 'R53' },
  SECRETS_MANAGER: { color: '#D53F8C', prefix: 'SEC' },
  KMS: { color: '#DD6B20', prefix: 'KMS' },
  IAM: { color: '#ED64A6', prefix: 'IAM' },
  VPC: { color: '#319795', prefix: 'VPC' },
  SNOWFLAKE: { color: '#00D4FF', prefix: 'SNOW' },
  FIVETRAN: { color: '#00B4D8', prefix: 'FVT' },
  DBT: { color: '#FF694F', prefix: 'DBT' },
  TABLEAU: { color: '#E97627', prefix: 'TBL' },
  EVENTBRIDGE: { color: '#FF9900', prefix: 'EVB' },
  EXTERNAL_ENTITY: { color: '#718096', prefix: 'EXT' },
  USER: { color: '#A0AEC0', prefix: 'U' },
  DATA_PROVIDER: { color: '#805AD5', prefix: 'PRV' },
};

// Standard threat actors for EMIA models
export const EMIA_THREAT_ACTORS = [
  'External Attacker',
  'Cybercriminal',
  'Nation-State',
  'Malicious Insider',
  'Developer',
  'Employee',
  'Contractor',
  'Competitor',
  'Script Kiddie',
  'Hacktivist',
];

// Standard security controls for AWS-based systems
export const EMIA_SECURITY_CONTROLS = {
  DATA_IN_TRANSIT: [
    'TLS 1.2/1.3 encryption',
    'Certificate pinning',
    'mTLS between services',
    'API Gateway HTTPS enforcement',
  ],
  DATA_AT_REST: [
    'KMS encryption (AES-256)',
    'S3 server-side encryption',
    'DynamoDB encryption',
    'Snowflake encryption',
  ],
  AUTHENTICATION: [
    'Cognito User Pools',
    'OAuth 2.0 / OIDC',
    'API key validation',
    'JWT token verification',
    'MFA enforcement',
  ],
  AUTHORIZATION: [
    'IAM policies',
    'Resource-based policies',
    'Cognito groups',
    'Lambda authorizers',
    'Row-level security',
  ],
  LOGGING_MONITORING: [
    'CloudTrail enabled',
    'CloudWatch Logs',
    'X-Ray tracing',
    'GuardDuty',
    'Security Hub',
  ],
  NETWORK_SECURITY: [
    'VPC isolation',
    'Security groups',
    'NACLs',
    'WAF rules',
    'Private subnets',
  ],
};

// Generate diagram ID based on component type
export function generateDiagramId(componentType: string, index: number): string {
  const typeConfig = EMIA_COMPONENT_TYPES[componentType as keyof typeof EMIA_COMPONENT_TYPES];
  const prefix = typeConfig?.prefix || 'CMP';
  return `D-${prefix}${String(index).padStart(2, '0')}`;
}

// Map STRIDE category to EMIA threat description patterns
export const STRIDE_TO_EMIA_PATTERNS: Record<string, { description: string; vulnerability: string; attackVector: string }[]> = {
  SPOOFING: [
    {
      description: 'Identity spoofing through stolen credentials',
      vulnerability: 'Weak authentication mechanisms',
      attackVector: 'Credential theft, phishing, session hijacking',
    },
    {
      description: 'Service impersonation via certificate compromise',
      vulnerability: 'Insufficient certificate validation',
      attackVector: 'Man-in-the-middle, DNS spoofing',
    },
  ],
  TAMPERING: [
    {
      description: 'Data modification in transit',
      vulnerability: 'Unencrypted or weakly encrypted communication',
      attackVector: 'Network interception, packet modification',
    },
    {
      description: 'Unauthorized data modification at rest',
      vulnerability: 'Insufficient access controls on data stores',
      attackVector: 'Privilege escalation, SQL injection',
    },
  ],
  REPUDIATION: [
    {
      description: 'Action denial due to insufficient logging',
      vulnerability: 'Missing or incomplete audit trails',
      attackVector: 'Log tampering, audit bypass',
    },
  ],
  INFORMATION_DISCLOSURE: [
    {
      description: 'Sensitive data exposure in transit',
      vulnerability: 'Unencrypted data transmission',
      attackVector: 'Network sniffing, man-in-the-middle',
    },
    {
      description: 'Data breach through unauthorized access',
      vulnerability: 'Overly permissive access controls',
      attackVector: 'Privilege escalation, IDOR',
    },
  ],
  DENIAL_OF_SERVICE: [
    {
      description: 'Service disruption through resource exhaustion',
      vulnerability: 'Missing rate limiting or throttling',
      attackVector: 'Request flooding, DDoS',
    },
  ],
  ELEVATION_OF_PRIVILEGE: [
    {
      description: 'Unauthorized access to privileged functions',
      vulnerability: 'Insufficient authorization checks',
      attackVector: 'Token manipulation, role escalation',
    },
  ],
};

// Calculate risk level based on likelihood and impact
export function calculateRiskLevel(
  likelihood: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High',
  impactLevel: 'Low' | 'Medium' | 'High' | 'Critical',
): 'Low' | 'Medium' | 'High' | 'Critical' {
  const likelihoodScore = { 'Very Low': 1, 'Low': 2, 'Medium': 3, 'High': 4, 'Very High': 5 };
  const impactScore = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };

  const score = likelihoodScore[likelihood] * impactScore[impactLevel];

  if (score >= 16) return 'Critical';
  if (score >= 9) return 'High';
  if (score >= 4) return 'Medium';
  return 'Low';
}

// Parse CIA impact string (e.g., "C:High, I:High, A:Medium")
export function parseImpactCIA(impactString: string): { c: string; i: string; a: string } {
  const parts = impactString.split(',').map(p => p.trim());
  const result = { c: 'Medium', i: 'Medium', a: 'Medium' };

  for (const part of parts) {
    const [key, value] = part.split(':').map(s => s.trim());
    if (key === 'C') result.c = value;
    if (key === 'I') result.i = value;
    if (key === 'A') result.a = value;
  }

  return result;
}

// Format CIA impact for display
export function formatImpactCIA(c: string, i: string, a: string): string {
  return `C:${c}, I:${i}, A:${a}`;
}

// Get highest impact from CIA ratings
export function getHighestImpact(impactCIA: string): 'Low' | 'Medium' | 'High' | 'Critical' {
  const { c, i, a } = parseImpactCIA(impactCIA);
  const levels = [c, i, a];

  if (levels.includes('Critical')) return 'Critical';
  if (levels.includes('High')) return 'High';
  if (levels.includes('Medium')) return 'Medium';
  return 'Low';
}
