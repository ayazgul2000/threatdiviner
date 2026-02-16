/**
 * Compliance Framework Definitions
 * Maps CWE IDs and finding categories to compliance controls
 */

export interface ComplianceControl {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  description: string;
  controls: ComplianceControl[];
  cweMappings: Map<string, string[]>; // CWE ID -> Control IDs
  categoryMappings: Map<string, string[]>; // Category -> Control IDs
}

// SOC 2 Type II Controls
export const SOC2_CONTROLS: ComplianceControl[] = [
  { id: 'CC1.1', name: 'Security Awareness', description: 'Organization demonstrates commitment to integrity and ethical values', category: 'Security' },
  { id: 'CC3.1', name: 'Risk Assessment', description: 'Organization identifies and assesses risks to entity objectives', category: 'Security' },
  { id: 'CC5.1', name: 'Control Activities', description: 'Control activities to mitigate risks to acceptable levels', category: 'Security' },
  { id: 'CC6.1', name: 'Logical Access', description: 'Logical access controls to protect information assets', category: 'Security' },
  { id: 'CC6.6', name: 'System Boundaries', description: 'System boundaries are protected against threats', category: 'Security' },
  { id: 'CC6.7', name: 'Data Transmission', description: 'Data transmission is restricted to authorized parties', category: 'Security' },
  { id: 'CC7.1', name: 'System Monitoring', description: 'System changes are monitored and evaluated', category: 'Security' },
  { id: 'CC7.2', name: 'Anomaly Detection', description: 'Security events are identified and responded to', category: 'Security' },
  { id: 'CC7.3', name: 'Incident Response', description: 'Incidents are identified, analyzed, and resolved', category: 'Security' },
  { id: 'CC8.1', name: 'Change Management', description: 'Changes to infrastructure and software are authorized', category: 'Security' },
];

// PCI DSS 4.0 Requirements
export const PCIDSS_CONTROLS: ComplianceControl[] = [
  { id: 'PCI-1', name: 'Network Controls', description: 'Install and maintain network security controls', category: 'Network' },
  { id: 'PCI-2', name: 'Secure Configurations', description: 'Apply secure configurations to all system components', category: 'Configuration' },
  { id: 'PCI-3', name: 'Account Data Protection', description: 'Protect stored account data', category: 'Data Protection' },
  { id: 'PCI-4', name: 'Cryptography', description: 'Protect cardholder data with strong cryptography', category: 'Cryptography' },
  { id: 'PCI-5', name: 'Malware Protection', description: 'Protect all systems from malware', category: 'Malware' },
  { id: 'PCI-6', name: 'Secure Development', description: 'Develop and maintain secure systems and software', category: 'Development' },
  { id: 'PCI-7', name: 'Access Control', description: 'Restrict access to cardholder data', category: 'Access Control' },
  { id: 'PCI-8', name: 'User Identification', description: 'Identify users and authenticate access', category: 'Authentication' },
  { id: 'PCI-9', name: 'Physical Security', description: 'Restrict physical access to cardholder data', category: 'Physical' },
  { id: 'PCI-10', name: 'Logging & Monitoring', description: 'Log and monitor access to systems', category: 'Logging' },
  { id: 'PCI-11', name: 'Security Testing', description: 'Test security of systems and networks regularly', category: 'Testing' },
  { id: 'PCI-12', name: 'Security Policies', description: 'Support information security with policies', category: 'Policy' },
];

// HIPAA Security Rule Controls
export const HIPAA_CONTROLS: ComplianceControl[] = [
  { id: 'HIPAA-164.308(a)(1)', name: 'Security Management', description: 'Implement policies to prevent and detect violations', category: 'Administrative' },
  { id: 'HIPAA-164.308(a)(3)', name: 'Workforce Security', description: 'Ensure appropriate access to ePHI', category: 'Administrative' },
  { id: 'HIPAA-164.308(a)(4)', name: 'Access Management', description: 'Implement access authorization policies', category: 'Administrative' },
  { id: 'HIPAA-164.308(a)(5)', name: 'Security Awareness', description: 'Implement security awareness and training', category: 'Administrative' },
  { id: 'HIPAA-164.310(a)(1)', name: 'Facility Access', description: 'Limit physical access to facilities', category: 'Physical' },
  { id: 'HIPAA-164.310(d)(1)', name: 'Device Security', description: 'Implement policies for workstation security', category: 'Physical' },
  { id: 'HIPAA-164.312(a)(1)', name: 'Access Control', description: 'Implement technical access controls', category: 'Technical' },
  { id: 'HIPAA-164.312(b)', name: 'Audit Controls', description: 'Implement audit controls', category: 'Technical' },
  { id: 'HIPAA-164.312(c)(1)', name: 'Integrity Controls', description: 'Implement mechanisms to corroborate ePHI integrity', category: 'Technical' },
  { id: 'HIPAA-164.312(d)', name: 'Authentication', description: 'Implement person or entity authentication', category: 'Technical' },
  { id: 'HIPAA-164.312(e)(1)', name: 'Transmission Security', description: 'Implement transmission security measures', category: 'Technical' },
];

// GDPR Articles
export const GDPR_CONTROLS: ComplianceControl[] = [
  { id: 'GDPR-5', name: 'Data Principles', description: 'Principles relating to processing of personal data', category: 'Principles' },
  { id: 'GDPR-25', name: 'Privacy by Design', description: 'Data protection by design and default', category: 'Design' },
  { id: 'GDPR-30', name: 'Records of Processing', description: 'Maintain records of processing activities', category: 'Documentation' },
  { id: 'GDPR-32', name: 'Security of Processing', description: 'Implement appropriate security measures', category: 'Security' },
  { id: 'GDPR-33', name: 'Breach Notification', description: 'Notification of data breach to authority', category: 'Incident Response' },
  { id: 'GDPR-34', name: 'Subject Notification', description: 'Communication of breach to data subject', category: 'Incident Response' },
  { id: 'GDPR-35', name: 'Impact Assessment', description: 'Data protection impact assessment', category: 'Risk' },
];

// OWASP Top 10 2021 Controls (FREE TIER)
export const OWASP2021_CONTROLS: ComplianceControl[] = [
  { id: 'A01:2021', name: 'Broken Access Control', description: 'Failures related to access control enforcement', category: 'Access Control' },
  { id: 'A02:2021', name: 'Cryptographic Failures', description: 'Failures related to cryptography or lack thereof', category: 'Cryptography' },
  { id: 'A03:2021', name: 'Injection', description: 'SQL, NoSQL, OS, LDAP injection vulnerabilities', category: 'Injection' },
  { id: 'A04:2021', name: 'Insecure Design', description: 'Design flaws in architecture and threat modeling', category: 'Design' },
  { id: 'A05:2021', name: 'Security Misconfiguration', description: 'Missing or incorrect security hardening', category: 'Configuration' },
  { id: 'A06:2021', name: 'Vulnerable Components', description: 'Using components with known vulnerabilities', category: 'Dependencies' },
  { id: 'A07:2021', name: 'Auth Failures', description: 'Identification and authentication failures', category: 'Authentication' },
  { id: 'A08:2021', name: 'Software Integrity', description: 'Software and data integrity failures', category: 'Integrity' },
  { id: 'A09:2021', name: 'Logging Failures', description: 'Security logging and monitoring failures', category: 'Logging' },
  { id: 'A10:2021', name: 'SSRF', description: 'Server-Side Request Forgery', category: 'Network' },
];

// CWE Top 25 2023 (FREE TIER)
export const CWE_TOP25_CONTROLS: ComplianceControl[] = [
  { id: 'CWE-787', name: 'Out-of-bounds Write', description: 'Software writes data past allocated memory', category: 'Memory Safety' },
  { id: 'CWE-79', name: 'XSS', description: 'Improper neutralization of input during web page generation', category: 'Injection' },
  { id: 'CWE-89', name: 'SQL Injection', description: 'Improper neutralization of SQL commands', category: 'Injection' },
  { id: 'CWE-416', name: 'Use After Free', description: 'Referencing memory after it has been freed', category: 'Memory Safety' },
  { id: 'CWE-78', name: 'OS Command Injection', description: 'Improper neutralization of OS commands', category: 'Injection' },
  { id: 'CWE-20', name: 'Improper Input Validation', description: 'Failure to validate or incorrectly validate input', category: 'Validation' },
  { id: 'CWE-125', name: 'Out-of-bounds Read', description: 'Software reads data past allocated memory', category: 'Memory Safety' },
  { id: 'CWE-22', name: 'Path Traversal', description: 'Improper limitation of pathname to restricted directory', category: 'Access Control' },
  { id: 'CWE-352', name: 'CSRF', description: 'Cross-Site Request Forgery', category: 'Session' },
  { id: 'CWE-434', name: 'Dangerous File Upload', description: 'Unrestricted upload of dangerous file types', category: 'File Handling' },
  { id: 'CWE-862', name: 'Missing Authorization', description: 'Missing authorization checks', category: 'Access Control' },
  { id: 'CWE-476', name: 'NULL Pointer Dereference', description: 'Null pointer dereference causing crash', category: 'Memory Safety' },
  { id: 'CWE-287', name: 'Improper Authentication', description: 'Failure to properly authenticate users', category: 'Authentication' },
  { id: 'CWE-190', name: 'Integer Overflow', description: 'Integer overflow or wraparound', category: 'Memory Safety' },
  { id: 'CWE-502', name: 'Deserialization', description: 'Deserialization of untrusted data', category: 'Injection' },
  { id: 'CWE-77', name: 'Command Injection', description: 'Improper neutralization of command elements', category: 'Injection' },
  { id: 'CWE-119', name: 'Buffer Overflow', description: 'Improper restriction of operations in memory bounds', category: 'Memory Safety' },
  { id: 'CWE-798', name: 'Hardcoded Credentials', description: 'Use of hardcoded credentials', category: 'Secrets' },
  { id: 'CWE-918', name: 'SSRF', description: 'Server-Side Request Forgery', category: 'Network' },
  { id: 'CWE-306', name: 'Missing Authentication', description: 'Missing authentication for critical function', category: 'Authentication' },
  { id: 'CWE-362', name: 'Race Condition', description: 'Concurrent execution with shared resource', category: 'Concurrency' },
  { id: 'CWE-269', name: 'Improper Privilege Management', description: 'Improper privilege management', category: 'Access Control' },
  { id: 'CWE-94', name: 'Code Injection', description: 'Improper control of code generation', category: 'Injection' },
  { id: 'CWE-863', name: 'Incorrect Authorization', description: 'Incorrect authorization checks', category: 'Access Control' },
  { id: 'CWE-276', name: 'Incorrect Default Permissions', description: 'Incorrect default permissions', category: 'Configuration' },
];

// Essential Eight 2023 (FREE TIER - Australian Cyber Security Centre)
export const ESSENTIAL_EIGHT_CONTROLS: ComplianceControl[] = [
  { id: 'E8-1', name: 'Application Control', description: 'Control execution of applications', category: 'Application' },
  { id: 'E8-2', name: 'Patch Applications', description: 'Patch applications within 48 hours of release', category: 'Patching' },
  { id: 'E8-3', name: 'Configure MS Office Macros', description: 'Configure Microsoft Office macro settings', category: 'Configuration' },
  { id: 'E8-4', name: 'User App Hardening', description: 'Configure user application hardening', category: 'Configuration' },
  { id: 'E8-5', name: 'Restrict Admin Privileges', description: 'Restrict administrative privileges', category: 'Access Control' },
  { id: 'E8-6', name: 'Patch Operating Systems', description: 'Patch operating systems within 48 hours', category: 'Patching' },
  { id: 'E8-7', name: 'Multi-Factor Auth', description: 'Multi-factor authentication for all users', category: 'Authentication' },
  { id: 'E8-8', name: 'Regular Backups', description: 'Regular backups of important data', category: 'Recovery' },
];

// ISO 27001:2022 Controls
export const ISO27001_CONTROLS: ComplianceControl[] = [
  { id: 'A.5', name: 'Organizational Controls', description: 'Policies for information security', category: 'Organizational' },
  { id: 'A.6', name: 'People Controls', description: 'Human resource security', category: 'People' },
  { id: 'A.7', name: 'Physical Controls', description: 'Physical and environmental security', category: 'Physical' },
  { id: 'A.8.1', name: 'User Devices', description: 'User endpoint device security', category: 'Technical' },
  { id: 'A.8.2', name: 'Privileged Access', description: 'Privileged access rights management', category: 'Technical' },
  { id: 'A.8.3', name: 'Access Restriction', description: 'Information access restriction', category: 'Technical' },
  { id: 'A.8.4', name: 'Source Code', description: 'Access to source code', category: 'Technical' },
  { id: 'A.8.5', name: 'Secure Authentication', description: 'Secure authentication mechanisms', category: 'Technical' },
  { id: 'A.8.8', name: 'Vulnerability Management', description: 'Management of technical vulnerabilities', category: 'Technical' },
  { id: 'A.8.9', name: 'Configuration Management', description: 'Configuration management', category: 'Technical' },
  { id: 'A.8.12', name: 'Data Leakage Prevention', description: 'Prevention of data leakage', category: 'Technical' },
  { id: 'A.8.16', name: 'Monitoring Activities', description: 'Networks, systems and applications monitoring', category: 'Technical' },
  { id: 'A.8.24', name: 'Use of Cryptography', description: 'Policy on the use of cryptography', category: 'Technical' },
  { id: 'A.8.25', name: 'Secure Development', description: 'Secure development lifecycle', category: 'Technical' },
  { id: 'A.8.26', name: 'Security Requirements', description: 'Application security requirements', category: 'Technical' },
  { id: 'A.8.28', name: 'Secure Coding', description: 'Secure coding principles', category: 'Technical' },
];

// CWE to Control Mappings
export const CWE_CONTROL_MAPPINGS: Record<string, { soc2: string[]; pci: string[]; hipaa: string[]; gdpr: string[]; iso27001: string[] }> = {
  // Injection vulnerabilities
  'CWE-89': { soc2: ['CC6.1', 'CC6.6'], pci: ['PCI-6'], hipaa: ['HIPAA-164.312(a)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.28'] },
  'CWE-78': { soc2: ['CC6.1', 'CC6.6'], pci: ['PCI-6'], hipaa: ['HIPAA-164.312(a)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.28'] },
  'CWE-77': { soc2: ['CC6.1', 'CC6.6'], pci: ['PCI-6'], hipaa: ['HIPAA-164.312(a)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.28'] },

  // XSS vulnerabilities
  'CWE-79': { soc2: ['CC6.1', 'CC6.6'], pci: ['PCI-6'], hipaa: ['HIPAA-164.312(c)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.28'] },

  // Authentication issues
  'CWE-287': { soc2: ['CC6.1'], pci: ['PCI-8'], hipaa: ['HIPAA-164.312(d)'], gdpr: ['GDPR-32'], iso27001: ['A.8.5'] },
  'CWE-798': { soc2: ['CC6.1'], pci: ['PCI-8'], hipaa: ['HIPAA-164.312(d)'], gdpr: ['GDPR-32'], iso27001: ['A.8.5'] },
  'CWE-259': { soc2: ['CC6.1'], pci: ['PCI-8'], hipaa: ['HIPAA-164.312(d)'], gdpr: ['GDPR-32'], iso27001: ['A.8.5'] },

  // Cryptography issues
  'CWE-327': { soc2: ['CC6.7'], pci: ['PCI-4'], hipaa: ['HIPAA-164.312(e)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.24'] },
  'CWE-328': { soc2: ['CC6.7'], pci: ['PCI-4'], hipaa: ['HIPAA-164.312(e)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.24'] },
  'CWE-326': { soc2: ['CC6.7'], pci: ['PCI-4'], hipaa: ['HIPAA-164.312(e)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.24'] },

  // Access control
  'CWE-284': { soc2: ['CC6.1'], pci: ['PCI-7'], hipaa: ['HIPAA-164.312(a)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.3'] },
  'CWE-862': { soc2: ['CC6.1'], pci: ['PCI-7'], hipaa: ['HIPAA-164.312(a)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.3'] },
  'CWE-863': { soc2: ['CC6.1'], pci: ['PCI-7'], hipaa: ['HIPAA-164.312(a)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.3'] },

  // Data exposure
  'CWE-200': { soc2: ['CC6.7'], pci: ['PCI-3'], hipaa: ['HIPAA-164.312(c)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.12'] },
  'CWE-532': { soc2: ['CC6.7', 'CC7.1'], pci: ['PCI-3', 'PCI-10'], hipaa: ['HIPAA-164.312(b)'], gdpr: ['GDPR-32'], iso27001: ['A.8.12'] },

  // Path traversal
  'CWE-22': { soc2: ['CC6.1', 'CC6.6'], pci: ['PCI-6'], hipaa: ['HIPAA-164.312(a)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.28'] },

  // Deserialization
  'CWE-502': { soc2: ['CC6.6'], pci: ['PCI-6'], hipaa: ['HIPAA-164.312(c)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.28'] },

  // SSRF
  'CWE-918': { soc2: ['CC6.6'], pci: ['PCI-1', 'PCI-6'], hipaa: ['HIPAA-164.312(a)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.28'] },

  // XXE
  'CWE-611': { soc2: ['CC6.6'], pci: ['PCI-6'], hipaa: ['HIPAA-164.312(c)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.28'] },
};

// Category to Control Mappings (for findings without CWE)
export const CATEGORY_CONTROL_MAPPINGS: Record<string, { soc2: string[]; pci: string[]; hipaa: string[]; gdpr: string[]; iso27001: string[] }> = {
  injection: { soc2: ['CC6.1', 'CC6.6'], pci: ['PCI-6'], hipaa: ['HIPAA-164.312(a)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.28'] },
  xss: { soc2: ['CC6.1', 'CC6.6'], pci: ['PCI-6'], hipaa: ['HIPAA-164.312(c)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.28'] },
  authentication: { soc2: ['CC6.1'], pci: ['PCI-8'], hipaa: ['HIPAA-164.312(d)'], gdpr: ['GDPR-32'], iso27001: ['A.8.5'] },
  authorization: { soc2: ['CC6.1'], pci: ['PCI-7'], hipaa: ['HIPAA-164.312(a)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.3'] },
  cryptography: { soc2: ['CC6.7'], pci: ['PCI-4'], hipaa: ['HIPAA-164.312(e)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.24'] },
  secrets: { soc2: ['CC6.1', 'CC6.7'], pci: ['PCI-3', 'PCI-8'], hipaa: ['HIPAA-164.312(d)'], gdpr: ['GDPR-32'], iso27001: ['A.8.5'] },
  configuration: { soc2: ['CC8.1'], pci: ['PCI-2'], hipaa: ['HIPAA-164.308(a)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.9'] },
  logging: { soc2: ['CC7.1', 'CC7.2'], pci: ['PCI-10'], hipaa: ['HIPAA-164.312(b)'], gdpr: ['GDPR-32'], iso27001: ['A.8.16'] },
  dependency: { soc2: ['CC6.6', 'CC7.1'], pci: ['PCI-5', 'PCI-6'], hipaa: ['HIPAA-164.308(a)(1)'], gdpr: ['GDPR-32'], iso27001: ['A.8.8'] },
};

export function getControlsForCWE(cweId: string, framework: string): string[] {
  const mappings = CWE_CONTROL_MAPPINGS[cweId];
  if (!mappings) return [];

  switch (framework.toLowerCase()) {
    case 'soc2': return mappings.soc2;
    case 'pci': case 'pci-dss': return mappings.pci;
    case 'hipaa': return mappings.hipaa;
    case 'gdpr': return mappings.gdpr;
    case 'iso27001': return mappings.iso27001;
    default: return [];
  }
}

export function getControlsForCategory(category: string, framework: string): string[] {
  const normalizedCategory = category.toLowerCase().replace(/[^a-z]/g, '');
  const mappings = CATEGORY_CONTROL_MAPPINGS[normalizedCategory];
  if (!mappings) return [];

  switch (framework.toLowerCase()) {
    case 'soc2': return mappings.soc2;
    case 'pci': case 'pci-dss': return mappings.pci;
    case 'hipaa': return mappings.hipaa;
    case 'gdpr': return mappings.gdpr;
    case 'iso27001': return mappings.iso27001;
    default: return [];
  }
}

export function getAllFrameworks() {
  return [
    // Free Tier Frameworks
    { id: 'owasp-2021', name: 'OWASP Top 10', version: '2021', tier: 'free', controls: OWASP2021_CONTROLS },
    { id: 'cwe-top-25', name: 'CWE Top 25', version: '2023', tier: 'free', controls: CWE_TOP25_CONTROLS },
    { id: 'essential-eight', name: 'Essential Eight', version: '2023', tier: 'free', controls: ESSENTIAL_EIGHT_CONTROLS },
    // Growth Tier Frameworks
    { id: 'soc2', name: 'SOC 2 Type II', version: '2017', tier: 'growth', controls: SOC2_CONTROLS },
    { id: 'pci', name: 'PCI DSS', version: '4.0', tier: 'growth', controls: PCIDSS_CONTROLS },
    { id: 'iso27001', name: 'ISO 27001', version: '2022', tier: 'growth', controls: ISO27001_CONTROLS },
    // Scale Tier Frameworks
    { id: 'hipaa', name: 'HIPAA Security Rule', version: '2013', tier: 'scale', controls: HIPAA_CONTROLS },
    { id: 'gdpr', name: 'GDPR', version: '2018', tier: 'scale', controls: GDPR_CONTROLS },
  ];
}
