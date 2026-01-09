// apps/api/src/threat-modeling/templates/stride.templates.ts
// Comprehensive STRIDE threat pattern library

export interface ThreatTemplate {
  id: string;
  category: 'SPOOFING' | 'TAMPERING' | 'REPUDIATION' | 'INFORMATION_DISCLOSURE' | 'DENIAL_OF_SERVICE' | 'ELEVATION_OF_PRIVILEGE';
  title: string;
  description: string;
  componentTypes: string[];
  vulnerability: string;
  attackVector: string;
  threatActors: string[];
  skillsRequired: 'Low' | 'Medium' | 'High';
  complexity: 'Low' | 'Medium' | 'High';
  likelihood: 'Low' | 'Medium' | 'High';
  impact: 'Low' | 'Medium' | 'High' | 'Critical';
  mitigations: string[];
  cweIds: string[];
  attackTechniqueIds: string[];
  capecIds: string[];
  complianceControls: { framework: string; controlId: string }[];
}

export const STRIDE_TEMPLATES: ThreatTemplate[] = [
  // SPOOFING
  {
    id: 'SPOOF-001',
    category: 'SPOOFING',
    title: 'User identity spoofing via credential theft',
    description: 'An attacker could steal user credentials through phishing or credential stuffing',
    componentTypes: ['web_app', 'api', 'auth_service', 'login'],
    vulnerability: 'Weak or compromised credentials; lack of MFA',
    attackVector: 'Phishing, credential stuffing, password spraying',
    threatActors: ['Cybercriminal', 'Script Kiddie'],
    skillsRequired: 'Medium',
    complexity: 'Medium',
    likelihood: 'High',
    impact: 'High',
    mitigations: ['Implement MFA', 'Enforce strong passwords', 'Account lockout', 'Monitor login attempts'],
    cweIds: ['CWE-287', 'CWE-306'],
    attackTechniqueIds: ['T1078', 'T1110'],
    capecIds: ['CAPEC-151', 'CAPEC-560'],
    complianceControls: [{ framework: 'pci_dss', controlId: '8.3' }, { framework: 'soc2', controlId: 'CC6.1' }],
  },
  {
    id: 'SPOOF-002',
    category: 'SPOOFING',
    title: 'Service impersonation via certificate theft',
    description: 'An attacker could forge TLS certificates to impersonate trusted services',
    componentTypes: ['api', 'service', 'microservice'],
    vulnerability: 'Weak certificate management',
    attackVector: 'Man-in-the-middle, certificate theft',
    threatActors: ['Cybercriminal', 'Nation-State'],
    skillsRequired: 'High',
    complexity: 'High',
    likelihood: 'Medium',
    impact: 'Critical',
    mitigations: ['Implement mTLS', 'Certificate pinning', 'Use HSM for keys'],
    cweIds: ['CWE-295', 'CWE-297'],
    attackTechniqueIds: ['T1557'],
    capecIds: ['CAPEC-94'],
    complianceControls: [{ framework: 'pci_dss', controlId: '4.1' }],
  },
  // TAMPERING
  {
    id: 'TAMP-001',
    category: 'TAMPERING',
    title: 'SQL injection attack',
    description: 'An attacker could inject malicious SQL to manipulate database',
    componentTypes: ['web_app', 'api', 'database'],
    vulnerability: 'Unparameterized queries',
    attackVector: 'Form inputs, URL parameters',
    threatActors: ['Cybercriminal', 'Script Kiddie'],
    skillsRequired: 'Low',
    complexity: 'Low',
    likelihood: 'High',
    impact: 'Critical',
    mitigations: ['Parameterized queries', 'Input validation', 'WAF', 'Least privilege DB accounts'],
    cweIds: ['CWE-89'],
    attackTechniqueIds: ['T1190'],
    capecIds: ['CAPEC-66'],
    complianceControls: [{ framework: 'owasp', controlId: 'A03:2021' }, { framework: 'pci_dss', controlId: '6.5.1' }],
  },
  {
    id: 'TAMP-002',
    category: 'TAMPERING',
    title: 'Cross-site scripting (XSS)',
    description: 'An attacker could inject malicious scripts into web pages',
    componentTypes: ['web_app', 'frontend'],
    vulnerability: 'Unsanitized user input',
    attackVector: 'Stored XSS, Reflected XSS, DOM XSS',
    threatActors: ['Cybercriminal'],
    skillsRequired: 'Low',
    complexity: 'Low',
    likelihood: 'High',
    impact: 'High',
    mitigations: ['Output encoding', 'CSP headers', 'Input sanitization'],
    cweIds: ['CWE-79'],
    attackTechniqueIds: ['T1189'],
    capecIds: ['CAPEC-86'],
    complianceControls: [{ framework: 'owasp', controlId: 'A03:2021' }],
  },
  // REPUDIATION
  {
    id: 'REPUD-001',
    category: 'REPUDIATION',
    title: 'Insufficient audit logging',
    description: 'Users could deny actions due to lack of audit evidence',
    componentTypes: ['all', 'web_app', 'api'],
    vulnerability: 'Missing audit trails',
    attackVector: 'Action denial',
    threatActors: ['Malicious Insider'],
    skillsRequired: 'Low',
    complexity: 'Low',
    likelihood: 'Medium',
    impact: 'Medium',
    mitigations: ['Comprehensive logging', 'Immutable log storage', 'SIEM integration'],
    cweIds: ['CWE-778'],
    attackTechniqueIds: ['T1070'],
    capecIds: ['CAPEC-93'],
    complianceControls: [{ framework: 'pci_dss', controlId: '10.2' }, { framework: 'soc2', controlId: 'CC7.2' }],
  },
  // INFORMATION DISCLOSURE
  {
    id: 'INFO-001',
    category: 'INFORMATION_DISCLOSURE',
    title: 'Sensitive data exposure in transit',
    description: 'Data could be intercepted during transmission',
    componentTypes: ['api', 'web_app', 'data_flow'],
    vulnerability: 'Unencrypted communication',
    attackVector: 'Network sniffing, MITM',
    threatActors: ['Cybercriminal', 'Nation-State'],
    skillsRequired: 'Medium',
    complexity: 'Medium',
    likelihood: 'Medium',
    impact: 'Critical',
    mitigations: ['Enforce TLS 1.2+', 'HSTS headers', 'Strong cipher suites'],
    cweIds: ['CWE-311', 'CWE-319'],
    attackTechniqueIds: ['T1040', 'T1557'],
    capecIds: ['CAPEC-157'],
    complianceControls: [{ framework: 'pci_dss', controlId: '4.1' }, { framework: 'gdpr', controlId: 'Article 32' }],
  },
  {
    id: 'INFO-002',
    category: 'INFORMATION_DISCLOSURE',
    title: 'Sensitive data at rest exposure',
    description: 'Stored data could be accessed without authorization',
    componentTypes: ['database', 'file_storage', 'backup'],
    vulnerability: 'Unencrypted storage',
    attackVector: 'Database compromise, backup theft',
    threatActors: ['Cybercriminal', 'Insider'],
    skillsRequired: 'Medium',
    complexity: 'Medium',
    likelihood: 'Medium',
    impact: 'Critical',
    mitigations: ['AES-256 encryption', 'HSM key management', 'Backup encryption'],
    cweIds: ['CWE-311', 'CWE-312'],
    attackTechniqueIds: ['T1530'],
    capecIds: ['CAPEC-37'],
    complianceControls: [{ framework: 'pci_dss', controlId: '3.4' }, { framework: 'hipaa', controlId: '164.312(a)' }],
  },
  // DENIAL OF SERVICE
  {
    id: 'DOS-001',
    category: 'DENIAL_OF_SERVICE',
    title: 'API rate limit exhaustion',
    description: 'Attacker could overwhelm API with requests',
    componentTypes: ['api', 'web_app', 'gateway'],
    vulnerability: 'Insufficient rate limiting',
    attackVector: 'Request flooding',
    threatActors: ['Cybercriminal'],
    skillsRequired: 'Low',
    complexity: 'Low',
    likelihood: 'High',
    impact: 'High',
    mitigations: ['Rate limiting', 'API gateway throttling', 'CDN/WAF'],
    cweIds: ['CWE-400'],
    attackTechniqueIds: ['T1498', 'T1499'],
    capecIds: ['CAPEC-125'],
    complianceControls: [],
  },
  // ELEVATION OF PRIVILEGE
  {
    id: 'ELEVPRIV-001',
    category: 'ELEVATION_OF_PRIVILEGE',
    title: 'Insecure direct object reference (IDOR)',
    description: 'Attacker could access unauthorized resources by manipulating IDs',
    componentTypes: ['api', 'web_app'],
    vulnerability: 'Missing authorization checks',
    attackVector: 'URL/parameter manipulation',
    threatActors: ['Cybercriminal', 'Malicious User'],
    skillsRequired: 'Low',
    complexity: 'Low',
    likelihood: 'High',
    impact: 'High',
    mitigations: ['Authorization on every request', 'Use GUIDs', 'Row-level security'],
    cweIds: ['CWE-639', 'CWE-284'],
    attackTechniqueIds: ['T1078'],
    capecIds: ['CAPEC-114'],
    complianceControls: [{ framework: 'owasp', controlId: 'A01:2021' }],
  },
  {
    id: 'ELEVPRIV-002',
    category: 'ELEVATION_OF_PRIVILEGE',
    title: 'Privilege escalation via role manipulation',
    description: 'Attacker could modify their role to gain elevated access',
    componentTypes: ['auth_service', 'api'],
    vulnerability: 'Insufficient role validation',
    attackVector: 'Token manipulation, parameter tampering',
    threatActors: ['Malicious User'],
    skillsRequired: 'Medium',
    complexity: 'Medium',
    likelihood: 'Medium',
    impact: 'Critical',
    mitigations: ['Server-side role validation', 'Signed JWTs', 'RBAC'],
    cweIds: ['CWE-269'],
    attackTechniqueIds: ['T1078.003'],
    capecIds: ['CAPEC-122'],
    complianceControls: [{ framework: 'soc2', controlId: 'CC6.1' }],
  },
];

export const getTemplatesForComponentType = (componentType: string): ThreatTemplate[] => {
  const normalized = componentType.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return STRIDE_TEMPLATES.filter((t) => t.componentTypes.includes('all') || t.componentTypes.some((ct) => normalized.includes(ct)));
};

export const getTemplatesByCategory = (category: string): ThreatTemplate[] => {
  return STRIDE_TEMPLATES.filter((t) => t.category === category.toUpperCase());
};
