// apps/api/src/threat-modeling/templates/pasta.templates.ts
// PASTA (Process for Attack Simulation and Threat Analysis) methodology templates

export interface PastaStage {
  id: number;
  name: string;
  description: string;
  activities: string[];
  outputs: string[];
}

export interface PastaAttackTree {
  id: string;
  goal: string;
  description: string;
  attackNodes: AttackNode[];
  mitigations: string[];
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface AttackNode {
  id: string;
  name: string;
  operator: 'AND' | 'OR';
  children?: AttackNode[];
  technique?: string;
  probability?: number;
  cost?: string;
  skill?: string;
}

// PASTA 7-Stage Process
export const PASTA_STAGES: PastaStage[] = [
  {
    id: 1,
    name: 'Define Business Objectives',
    description: 'Identify business objectives and security requirements',
    activities: [
      'Identify critical business processes',
      'Define compliance requirements',
      'Determine acceptable risk levels',
      'Document business impact of security incidents',
      'Identify key stakeholders',
    ],
    outputs: [
      'Business context document',
      'Compliance requirements matrix',
      'Risk tolerance statement',
      'Stakeholder map',
    ],
  },
  {
    id: 2,
    name: 'Define Technical Scope',
    description: 'Document technical environment and application architecture',
    activities: [
      'Create system architecture diagrams',
      'Identify all components and dependencies',
      'Document data flows',
      'List all entry points',
      'Identify trust boundaries',
    ],
    outputs: [
      'Architecture diagrams',
      'Component inventory',
      'Data flow diagrams',
      'Trust boundary documentation',
    ],
  },
  {
    id: 3,
    name: 'Application Decomposition',
    description: 'Break down application into components and identify assets',
    activities: [
      'Decompose application into functional units',
      'Identify sensitive data stores',
      'Map user roles and permissions',
      'Document APIs and interfaces',
      'List third-party integrations',
    ],
    outputs: [
      'Component breakdown',
      'Asset inventory',
      'Role matrix',
      'API documentation',
      'Integration map',
    ],
  },
  {
    id: 4,
    name: 'Threat Analysis',
    description: 'Identify threats relevant to the application',
    activities: [
      'Research applicable threat intelligence',
      'Identify threat actors and motivations',
      'Map threats to STRIDE categories',
      'Review industry-specific threats',
      'Consider insider threats',
    ],
    outputs: [
      'Threat catalog',
      'Threat actor profiles',
      'STRIDE threat mapping',
      'Industry threat landscape',
    ],
  },
  {
    id: 5,
    name: 'Vulnerability Analysis',
    description: 'Identify vulnerabilities that could be exploited',
    activities: [
      'Review CVE databases for components',
      'Analyze code for security issues',
      'Review configurations for weaknesses',
      'Test for common vulnerabilities',
      'Assess authentication mechanisms',
    ],
    outputs: [
      'Vulnerability report',
      'CVE mapping',
      'Security testing results',
      'Configuration review findings',
    ],
  },
  {
    id: 6,
    name: 'Attack Modeling',
    description: 'Model how attacks could exploit vulnerabilities',
    activities: [
      'Create attack trees for key threats',
      'Map attack paths to kill chain',
      'Simulate attack scenarios',
      'Correlate threats with vulnerabilities',
      'Identify attack surface',
    ],
    outputs: [
      'Attack trees',
      'Kill chain mapping',
      'Attack scenarios',
      'Attack surface analysis',
    ],
  },
  {
    id: 7,
    name: 'Risk and Impact Analysis',
    description: 'Assess risk and determine countermeasures',
    activities: [
      'Calculate risk scores (likelihood × impact)',
      'Prioritize risks by business impact',
      'Define countermeasures and controls',
      'Create remediation roadmap',
      'Define residual risk acceptance criteria',
    ],
    outputs: [
      'Risk register',
      'Prioritized risk list',
      'Control recommendations',
      'Remediation plan',
      'Residual risk statement',
    ],
  },
];

// Attack tree templates for common scenarios
export const PASTA_ATTACK_TREES: PastaAttackTree[] = [
  {
    id: 'AT-001',
    goal: 'Steal user credentials',
    description: 'Attack tree for credential theft scenarios',
    riskLevel: 'Critical',
    attackNodes: [
      {
        id: 'root',
        name: 'Obtain User Credentials',
        operator: 'OR',
        children: [
          {
            id: 'phishing',
            name: 'Phishing Attack',
            operator: 'AND',
            technique: 'T1566',
            probability: 0.7,
            skill: 'Low',
            children: [
              { id: 'phish-1', name: 'Create convincing email', operator: 'AND' },
              { id: 'phish-2', name: 'User clicks link', operator: 'AND' },
              { id: 'phish-3', name: 'User enters credentials', operator: 'AND' },
            ],
          },
          {
            id: 'bruteforce',
            name: 'Brute Force Attack',
            operator: 'AND',
            technique: 'T1110',
            probability: 0.3,
            skill: 'Low',
            children: [
              { id: 'bf-1', name: 'Obtain username list', operator: 'AND' },
              { id: 'bf-2', name: 'Run password spray', operator: 'AND' },
            ],
          },
          {
            id: 'mitm',
            name: 'Man-in-the-Middle',
            operator: 'AND',
            technique: 'T1557',
            probability: 0.2,
            skill: 'High',
            children: [
              { id: 'mitm-1', name: 'Position on network', operator: 'AND' },
              { id: 'mitm-2', name: 'Intercept traffic', operator: 'AND' },
            ],
          },
        ],
      },
    ],
    mitigations: [
      'Implement MFA for all users',
      'Deploy email filtering and anti-phishing',
      'Implement account lockout policies',
      'Use HSTS and certificate pinning',
      'Conduct security awareness training',
    ],
  },
  {
    id: 'AT-002',
    goal: 'Exfiltrate sensitive data',
    description: 'Attack tree for data exfiltration scenarios',
    riskLevel: 'Critical',
    attackNodes: [
      {
        id: 'root',
        name: 'Exfiltrate Data',
        operator: 'OR',
        children: [
          {
            id: 'sqli',
            name: 'SQL Injection',
            operator: 'AND',
            technique: 'T1190',
            probability: 0.5,
            skill: 'Medium',
            children: [
              { id: 'sqli-1', name: 'Find injection point', operator: 'AND' },
              { id: 'sqli-2', name: 'Extract database schema', operator: 'AND' },
              { id: 'sqli-3', name: 'Dump sensitive tables', operator: 'AND' },
            ],
          },
          {
            id: 'insider',
            name: 'Insider Threat',
            operator: 'AND',
            technique: 'T1213',
            probability: 0.3,
            skill: 'Low',
            children: [
              { id: 'ins-1', name: 'Legitimate access to data', operator: 'AND' },
              { id: 'ins-2', name: 'Copy data to external storage', operator: 'AND' },
            ],
          },
          {
            id: 'api',
            name: 'API Exploitation',
            operator: 'AND',
            technique: 'T1106',
            probability: 0.4,
            skill: 'Medium',
            children: [
              { id: 'api-1', name: 'Discover API endpoints', operator: 'AND' },
              { id: 'api-2', name: 'Bypass authorization', operator: 'AND' },
              { id: 'api-3', name: 'Extract data via API', operator: 'AND' },
            ],
          },
        ],
      },
    ],
    mitigations: [
      'Implement parameterized queries',
      'Deploy DLP solutions',
      'Enable comprehensive logging',
      'Implement API rate limiting and auth',
      'Conduct regular access reviews',
    ],
  },
  {
    id: 'AT-003',
    goal: 'Gain administrative access',
    description: 'Attack tree for privilege escalation',
    riskLevel: 'Critical',
    attackNodes: [
      {
        id: 'root',
        name: 'Achieve Admin Access',
        operator: 'OR',
        children: [
          {
            id: 'cred-theft',
            name: 'Steal Admin Credentials',
            operator: 'AND',
            technique: 'T1078',
            probability: 0.4,
            skill: 'Medium',
          },
          {
            id: 'privesc',
            name: 'Privilege Escalation',
            operator: 'AND',
            technique: 'T1068',
            probability: 0.3,
            skill: 'High',
            children: [
              { id: 'pe-1', name: 'Initial foothold', operator: 'AND' },
              { id: 'pe-2', name: 'Find escalation vector', operator: 'OR' },
              { id: 'pe-3', name: 'Execute privilege escalation', operator: 'AND' },
            ],
          },
          {
            id: 'default-creds',
            name: 'Default Credentials',
            operator: 'AND',
            technique: 'T1078.001',
            probability: 0.2,
            skill: 'Low',
          },
        ],
      },
    ],
    mitigations: [
      'Implement PAM solution',
      'Remove default credentials',
      'Apply least privilege principle',
      'Enable MFA for admin accounts',
      'Regular vulnerability scanning',
    ],
  },
  {
    id: 'AT-004',
    goal: 'Deploy ransomware',
    description: 'Attack tree for ransomware deployment',
    riskLevel: 'Critical',
    attackNodes: [
      {
        id: 'root',
        name: 'Deploy Ransomware',
        operator: 'AND',
        children: [
          {
            id: 'initial',
            name: 'Initial Access',
            operator: 'OR',
            children: [
              { id: 'init-1', name: 'Phishing email', operator: 'AND', technique: 'T1566' },
              { id: 'init-2', name: 'Exploit public service', operator: 'AND', technique: 'T1190' },
              { id: 'init-3', name: 'Compromised credentials', operator: 'AND', technique: 'T1078' },
            ],
          },
          {
            id: 'persist',
            name: 'Establish Persistence',
            operator: 'OR',
            technique: 'T1053',
            children: [
              { id: 'per-1', name: 'Scheduled task', operator: 'AND' },
              { id: 'per-2', name: 'Registry modification', operator: 'AND' },
            ],
          },
          {
            id: 'lateral',
            name: 'Lateral Movement',
            operator: 'OR',
            technique: 'T1021',
          },
          {
            id: 'encrypt',
            name: 'Encrypt Files',
            operator: 'AND',
            technique: 'T1486',
          },
        ],
      },
    ],
    mitigations: [
      'Implement EDR solution',
      'Network segmentation',
      'Regular backups (offline)',
      'Email security gateway',
      'User security training',
      'Patch management',
    ],
  },
];

export const getPastaStage = (stageNumber: number): PastaStage | undefined => {
  return PASTA_STAGES.find((s) => s.id === stageNumber);
};

export const getAttackTree = (id: string): PastaAttackTree | undefined => {
  return PASTA_ATTACK_TREES.find((at) => at.id === id);
};

export const getAttackTreesByRisk = (riskLevel: string): PastaAttackTree[] => {
  return PASTA_ATTACK_TREES.filter((at) => at.riskLevel === riskLevel);
};
