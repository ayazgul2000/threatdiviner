import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CweMapping {
  frameworkId: string;
  controlId: string;
  controlName: string;
  controlDescription?: string;
}

@Injectable()
export class CweMappingSyncService {
  private readonly logger = new Logger(CweMappingSyncService.name);

  // CWE to Compliance Control mappings
  // Based on industry-standard mappings from NIST, OWASP, PCI-DSS, etc.
  private readonly MAPPINGS: Record<string, CweMapping[]> = {
    'CWE-89': [ // SQL Injection
      { frameworkId: 'owasp', controlId: 'A03:2021', controlName: 'Injection' },
      { frameworkId: 'pci-dss', controlId: '6.5.1', controlName: 'Injection Flaws' },
      { frameworkId: 'soc2', controlId: 'CC6.1', controlName: 'Security Software and Configuration' },
      { frameworkId: 'nist', controlId: 'SI-10', controlName: 'Information Input Validation' },
      { frameworkId: 'iso27001', controlId: 'A.14.2.5', controlName: 'Secure System Engineering Principles' },
      { frameworkId: 'hipaa', controlId: '164.312(a)(1)', controlName: 'Access Control' },
      { frameworkId: 'cis', controlId: '16.11', controlName: 'Application Software Security' },
    ],
    'CWE-79': [ // XSS
      { frameworkId: 'owasp', controlId: 'A03:2021', controlName: 'Injection' },
      { frameworkId: 'pci-dss', controlId: '6.5.7', controlName: 'Cross-site Scripting (XSS)' },
      { frameworkId: 'soc2', controlId: 'CC6.1', controlName: 'Security Software and Configuration' },
      { frameworkId: 'nist', controlId: 'SI-10', controlName: 'Information Input Validation' },
      { frameworkId: 'iso27001', controlId: 'A.14.2.5', controlName: 'Secure System Engineering Principles' },
    ],
    'CWE-78': [ // OS Command Injection
      { frameworkId: 'owasp', controlId: 'A03:2021', controlName: 'Injection' },
      { frameworkId: 'pci-dss', controlId: '6.5.1', controlName: 'Injection Flaws' },
      { frameworkId: 'nist', controlId: 'SI-10', controlName: 'Information Input Validation' },
      { frameworkId: 'cis', controlId: '16.11', controlName: 'Application Software Security' },
    ],
    'CWE-22': [ // Path Traversal
      { frameworkId: 'owasp', controlId: 'A01:2021', controlName: 'Broken Access Control' },
      { frameworkId: 'pci-dss', controlId: '6.5.8', controlName: 'Improper Access Control' },
      { frameworkId: 'nist', controlId: 'AC-3', controlName: 'Access Enforcement' },
      { frameworkId: 'soc2', controlId: 'CC6.1', controlName: 'Security Software and Configuration' },
    ],
    'CWE-287': [ // Improper Authentication
      { frameworkId: 'owasp', controlId: 'A07:2021', controlName: 'Identification and Authentication Failures' },
      { frameworkId: 'pci-dss', controlId: '8.2', controlName: 'User Authentication Management' },
      { frameworkId: 'soc2', controlId: 'CC6.1', controlName: 'Security Software and Configuration' },
      { frameworkId: 'nist', controlId: 'IA-2', controlName: 'Identification and Authentication' },
      { frameworkId: 'hipaa', controlId: '164.312(d)', controlName: 'Person or Entity Authentication' },
      { frameworkId: 'iso27001', controlId: 'A.9.2.1', controlName: 'User Registration and De-registration' },
    ],
    'CWE-798': [ // Hardcoded Credentials
      { frameworkId: 'owasp', controlId: 'A07:2021', controlName: 'Identification and Authentication Failures' },
      { frameworkId: 'pci-dss', controlId: '6.5.3', controlName: 'Insecure Cryptographic Storage' },
      { frameworkId: 'soc2', controlId: 'CC6.7', controlName: 'Transmission Security' },
      { frameworkId: 'nist', controlId: 'IA-5', controlName: 'Authenticator Management' },
      { frameworkId: 'cis', controlId: '16.5', controlName: 'Encode Authentication Credentials' },
    ],
    'CWE-502': [ // Deserialization
      { frameworkId: 'owasp', controlId: 'A08:2021', controlName: 'Software and Data Integrity Failures' },
      { frameworkId: 'pci-dss', controlId: '6.5.1', controlName: 'Injection Flaws' },
      { frameworkId: 'nist', controlId: 'SI-10', controlName: 'Information Input Validation' },
    ],
    'CWE-918': [ // SSRF
      { frameworkId: 'owasp', controlId: 'A10:2021', controlName: 'Server-Side Request Forgery' },
      { frameworkId: 'pci-dss', controlId: '6.5.9', controlName: 'Improper Input Validation' },
      { frameworkId: 'nist', controlId: 'SC-7', controlName: 'Boundary Protection' },
    ],
    'CWE-200': [ // Information Exposure
      { frameworkId: 'owasp', controlId: 'A01:2021', controlName: 'Broken Access Control' },
      { frameworkId: 'pci-dss', controlId: '6.5.6', controlName: 'Information Leakage' },
      { frameworkId: 'hipaa', controlId: '164.312(a)(1)', controlName: 'Access Control' },
      { frameworkId: 'gdpr', controlId: 'Art.32', controlName: 'Security of Processing' },
    ],
    'CWE-327': [ // Weak Cryptography
      { frameworkId: 'owasp', controlId: 'A02:2021', controlName: 'Cryptographic Failures' },
      { frameworkId: 'pci-dss', controlId: '4.1', controlName: 'Strong Cryptography' },
      { frameworkId: 'hipaa', controlId: '164.312(a)(2)(iv)', controlName: 'Encryption and Decryption' },
      { frameworkId: 'nist', controlId: 'SC-13', controlName: 'Cryptographic Protection' },
      { frameworkId: 'gdpr', controlId: 'Art.32', controlName: 'Security of Processing' },
    ],
    'CWE-311': [ // Missing Encryption
      { frameworkId: 'owasp', controlId: 'A02:2021', controlName: 'Cryptographic Failures' },
      { frameworkId: 'pci-dss', controlId: '3.4', controlName: 'Render PAN Unreadable' },
      { frameworkId: 'hipaa', controlId: '164.312(e)(2)(ii)', controlName: 'Encryption' },
      { frameworkId: 'nist', controlId: 'SC-28', controlName: 'Protection of Information at Rest' },
      { frameworkId: 'gdpr', controlId: 'Art.32', controlName: 'Security of Processing' },
    ],
    'CWE-352': [ // CSRF
      { frameworkId: 'owasp', controlId: 'A01:2021', controlName: 'Broken Access Control' },
      { frameworkId: 'pci-dss', controlId: '6.5.9', controlName: 'Cross-Site Request Forgery' },
      { frameworkId: 'nist', controlId: 'SC-23', controlName: 'Session Authenticity' },
    ],
    'CWE-434': [ // Unrestricted File Upload
      { frameworkId: 'owasp', controlId: 'A04:2021', controlName: 'Insecure Design' },
      { frameworkId: 'pci-dss', controlId: '6.5.8', controlName: 'Improper Access Control' },
      { frameworkId: 'nist', controlId: 'SI-10', controlName: 'Information Input Validation' },
    ],
    'CWE-611': [ // XXE
      { frameworkId: 'owasp', controlId: 'A05:2021', controlName: 'Security Misconfiguration' },
      { frameworkId: 'pci-dss', controlId: '6.5.1', controlName: 'Injection Flaws' },
      { frameworkId: 'nist', controlId: 'SI-10', controlName: 'Information Input Validation' },
    ],
    'CWE-732': [ // Insecure Permissions
      { frameworkId: 'owasp', controlId: 'A01:2021', controlName: 'Broken Access Control' },
      { frameworkId: 'pci-dss', controlId: '7.1', controlName: 'Limit Access' },
      { frameworkId: 'nist', controlId: 'AC-6', controlName: 'Least Privilege' },
      { frameworkId: 'cis', controlId: '6.1', controlName: 'Access Control Configuration' },
    ],
    'CWE-522': [ // Insufficiently Protected Credentials
      { frameworkId: 'owasp', controlId: 'A07:2021', controlName: 'Identification and Authentication Failures' },
      { frameworkId: 'pci-dss', controlId: '8.2.1', controlName: 'Strong Credential Storage' },
      { frameworkId: 'nist', controlId: 'IA-5', controlName: 'Authenticator Management' },
      { frameworkId: 'hipaa', controlId: '164.308(a)(5)(ii)(D)', controlName: 'Password Management' },
    ],
    'CWE-306': [ // Missing Authentication
      { frameworkId: 'owasp', controlId: 'A07:2021', controlName: 'Identification and Authentication Failures' },
      { frameworkId: 'pci-dss', controlId: '8.1', controlName: 'User Identification' },
      { frameworkId: 'nist', controlId: 'IA-2', controlName: 'Identification and Authentication' },
    ],
    'CWE-862': [ // Missing Authorization
      { frameworkId: 'owasp', controlId: 'A01:2021', controlName: 'Broken Access Control' },
      { frameworkId: 'pci-dss', controlId: '7.1', controlName: 'Limit Access' },
      { frameworkId: 'nist', controlId: 'AC-3', controlName: 'Access Enforcement' },
    ],
    'CWE-863': [ // Incorrect Authorization
      { frameworkId: 'owasp', controlId: 'A01:2021', controlName: 'Broken Access Control' },
      { frameworkId: 'pci-dss', controlId: '7.1', controlName: 'Limit Access' },
      { frameworkId: 'nist', controlId: 'AC-3', controlName: 'Access Enforcement' },
    ],
    'CWE-1035': [ // Vulnerable Components
      { frameworkId: 'owasp', controlId: 'A06:2021', controlName: 'Vulnerable and Outdated Components' },
      { frameworkId: 'pci-dss', controlId: '6.2', controlName: 'Vendor Security Patches' },
      { frameworkId: 'nist', controlId: 'RA-5', controlName: 'Vulnerability Scanning' },
      { frameworkId: 'cis', controlId: '7.1', controlName: 'Software Inventory' },
    ],
    'CWE-532': [ // Log Exposure
      { frameworkId: 'owasp', controlId: 'A09:2021', controlName: 'Security Logging and Monitoring Failures' },
      { frameworkId: 'pci-dss', controlId: '10.5', controlName: 'Secure Audit Trails' },
      { frameworkId: 'nist', controlId: 'AU-9', controlName: 'Protection of Audit Information' },
    ],
    'CWE-778': [ // Insufficient Logging
      { frameworkId: 'owasp', controlId: 'A09:2021', controlName: 'Security Logging and Monitoring Failures' },
      { frameworkId: 'pci-dss', controlId: '10.1', controlName: 'Audit Trails' },
      { frameworkId: 'nist', controlId: 'AU-2', controlName: 'Audit Events' },
      { frameworkId: 'hipaa', controlId: '164.312(b)', controlName: 'Audit Controls' },
    ],
    // Additional CWEs with extended framework mappings
    'CWE-20': [ // Improper Input Validation
      { frameworkId: 'owasp', controlId: 'A03:2021', controlName: 'Injection' },
      { frameworkId: 'pci-dss', controlId: '6.5.1', controlName: 'Injection Flaws' },
      { frameworkId: 'nist', controlId: 'SI-10', controlName: 'Information Input Validation' },
      { frameworkId: 'nist-csf', controlId: 'PR.DS-5', controlName: 'Protections Against Data Leaks' },
      { frameworkId: 'asvs', controlId: 'V5.1', controlName: 'Input Validation Requirements' },
      { frameworkId: 'fedramp', controlId: 'SI-10', controlName: 'Information Input Validation' },
    ],
    'CWE-94': [ // Code Injection
      { frameworkId: 'owasp', controlId: 'A03:2021', controlName: 'Injection' },
      { frameworkId: 'pci-dss', controlId: '6.5.1', controlName: 'Injection Flaws' },
      { frameworkId: 'nist', controlId: 'SI-10', controlName: 'Information Input Validation' },
      { frameworkId: 'nist-csf', controlId: 'PR.DS-5', controlName: 'Protections Against Data Leaks' },
      { frameworkId: 'asvs', controlId: 'V5.2', controlName: 'Sanitization and Sandboxing' },
    ],
    'CWE-119': [ // Buffer Overflow
      { frameworkId: 'owasp', controlId: 'A03:2021', controlName: 'Injection' },
      { frameworkId: 'nist', controlId: 'SI-16', controlName: 'Memory Protection' },
      { frameworkId: 'nist-csf', controlId: 'PR.DS-5', controlName: 'Protections Against Data Leaks' },
      { frameworkId: 'cis', controlId: '16.1', controlName: 'Secure Software Development Lifecycle' },
    ],
    'CWE-125': [ // Out-of-bounds Read
      { frameworkId: 'nist', controlId: 'SI-16', controlName: 'Memory Protection' },
      { frameworkId: 'cis', controlId: '16.1', controlName: 'Secure Software Development Lifecycle' },
      { frameworkId: 'asvs', controlId: 'V5.4', controlName: 'Memory and String' },
    ],
    'CWE-190': [ // Integer Overflow
      { frameworkId: 'nist', controlId: 'SI-16', controlName: 'Memory Protection' },
      { frameworkId: 'asvs', controlId: 'V5.4', controlName: 'Memory and String' },
    ],
    'CWE-269': [ // Improper Privilege Management
      { frameworkId: 'owasp', controlId: 'A01:2021', controlName: 'Broken Access Control' },
      { frameworkId: 'nist', controlId: 'AC-6', controlName: 'Least Privilege' },
      { frameworkId: 'nist-csf', controlId: 'PR.AC-4', controlName: 'Access Permissions' },
      { frameworkId: 'fedramp', controlId: 'AC-6', controlName: 'Least Privilege' },
      { frameworkId: 'asvs', controlId: 'V4.1', controlName: 'General Access Control Design' },
    ],
    'CWE-285': [ // Improper Authorization
      { frameworkId: 'owasp', controlId: 'A01:2021', controlName: 'Broken Access Control' },
      { frameworkId: 'pci-dss', controlId: '7.1', controlName: 'Limit Access' },
      { frameworkId: 'nist', controlId: 'AC-3', controlName: 'Access Enforcement' },
      { frameworkId: 'asvs', controlId: 'V4.2', controlName: 'Operation Level Access Control' },
    ],
    'CWE-295': [ // Improper Certificate Validation
      { frameworkId: 'owasp', controlId: 'A02:2021', controlName: 'Cryptographic Failures' },
      { frameworkId: 'pci-dss', controlId: '4.1', controlName: 'Strong Cryptography' },
      { frameworkId: 'nist', controlId: 'SC-17', controlName: 'PKI Certificates' },
      { frameworkId: 'asvs', controlId: 'V9.2', controlName: 'Server Communications Security' },
    ],
    'CWE-319': [ // Cleartext Transmission
      { frameworkId: 'owasp', controlId: 'A02:2021', controlName: 'Cryptographic Failures' },
      { frameworkId: 'pci-dss', controlId: '4.1', controlName: 'Strong Cryptography' },
      { frameworkId: 'hipaa', controlId: '164.312(e)(1)', controlName: 'Transmission Security' },
      { frameworkId: 'nist', controlId: 'SC-8', controlName: 'Transmission Confidentiality' },
      { frameworkId: 'nist-csf', controlId: 'PR.DS-2', controlName: 'Data in Transit Protected' },
      { frameworkId: 'gdpr', controlId: 'Art.32', controlName: 'Security of Processing' },
      { frameworkId: 'asvs', controlId: 'V9.1', controlName: 'Client Communication Security' },
    ],
    'CWE-326': [ // Inadequate Encryption Strength
      { frameworkId: 'owasp', controlId: 'A02:2021', controlName: 'Cryptographic Failures' },
      { frameworkId: 'pci-dss', controlId: '4.1', controlName: 'Strong Cryptography' },
      { frameworkId: 'nist', controlId: 'SC-13', controlName: 'Cryptographic Protection' },
      { frameworkId: 'fedramp', controlId: 'SC-13', controlName: 'Cryptographic Protection' },
      { frameworkId: 'asvs', controlId: 'V6.2', controlName: 'Algorithms' },
    ],
    'CWE-384': [ // Session Fixation
      { frameworkId: 'owasp', controlId: 'A07:2021', controlName: 'Identification and Authentication Failures' },
      { frameworkId: 'nist', controlId: 'SC-23', controlName: 'Session Authenticity' },
      { frameworkId: 'asvs', controlId: 'V3.2', controlName: 'Session Binding' },
    ],
    'CWE-400': [ // Resource Exhaustion
      { frameworkId: 'owasp', controlId: 'A05:2021', controlName: 'Security Misconfiguration' },
      { frameworkId: 'nist', controlId: 'SC-5', controlName: 'Denial of Service Protection' },
      { frameworkId: 'nist-csf', controlId: 'DE.AE-1', controlName: 'Adverse Events Detection' },
      { frameworkId: 'asvs', controlId: 'V11.1', controlName: 'Business Logic Security' },
    ],
    'CWE-416': [ // Use After Free
      { frameworkId: 'nist', controlId: 'SI-16', controlName: 'Memory Protection' },
      { frameworkId: 'cis', controlId: '16.1', controlName: 'Secure Software Development Lifecycle' },
    ],
    'CWE-426': [ // Untrusted Search Path
      { frameworkId: 'nist', controlId: 'CM-7', controlName: 'Least Functionality' },
      { frameworkId: 'cis', controlId: '2.6', controlName: 'Disable Unnecessary Services' },
    ],
    'CWE-427': [ // Uncontrolled Search Path Element
      { frameworkId: 'nist', controlId: 'CM-7', controlName: 'Least Functionality' },
      { frameworkId: 'cis', controlId: '2.6', controlName: 'Disable Unnecessary Services' },
    ],
    'CWE-476': [ // NULL Pointer Dereference
      { frameworkId: 'nist', controlId: 'SI-16', controlName: 'Memory Protection' },
      { frameworkId: 'asvs', controlId: 'V5.4', controlName: 'Memory and String' },
    ],
    'CWE-601': [ // Open Redirect
      { frameworkId: 'owasp', controlId: 'A01:2021', controlName: 'Broken Access Control' },
      { frameworkId: 'nist', controlId: 'SI-10', controlName: 'Information Input Validation' },
      { frameworkId: 'asvs', controlId: 'V5.1', controlName: 'Input Validation Requirements' },
    ],
    'CWE-613': [ // Insufficient Session Expiration
      { frameworkId: 'owasp', controlId: 'A07:2021', controlName: 'Identification and Authentication Failures' },
      { frameworkId: 'pci-dss', controlId: '8.1.8', controlName: 'Session Timeout' },
      { frameworkId: 'nist', controlId: 'AC-12', controlName: 'Session Termination' },
      { frameworkId: 'asvs', controlId: 'V3.3', controlName: 'Session Logout and Timeout' },
    ],
    'CWE-640': [ // Weak Password Recovery
      { frameworkId: 'owasp', controlId: 'A07:2021', controlName: 'Identification and Authentication Failures' },
      { frameworkId: 'nist', controlId: 'IA-5', controlName: 'Authenticator Management' },
      { frameworkId: 'asvs', controlId: 'V2.5', controlName: 'Credential Recovery Requirements' },
    ],
    'CWE-668': [ // Exposure to Wrong Sphere
      { frameworkId: 'owasp', controlId: 'A01:2021', controlName: 'Broken Access Control' },
      { frameworkId: 'nist', controlId: 'AC-3', controlName: 'Access Enforcement' },
      { frameworkId: 'nist-csf', controlId: 'PR.AC-4', controlName: 'Access Permissions' },
    ],
    'CWE-706': [ // Use of Incorrectly-Resolved Name
      { frameworkId: 'nist', controlId: 'SC-20', controlName: 'Secure Name/Address Resolution' },
      { frameworkId: 'fedramp', controlId: 'SC-20', controlName: 'Secure Name/Address Resolution' },
    ],
    'CWE-749': [ // Exposed Dangerous Method
      { frameworkId: 'owasp', controlId: 'A04:2021', controlName: 'Insecure Design' },
      { frameworkId: 'nist', controlId: 'CM-7', controlName: 'Least Functionality' },
      { frameworkId: 'asvs', controlId: 'V4.1', controlName: 'General Access Control Design' },
    ],
    'CWE-770': [ // Allocation Without Limits
      { frameworkId: 'nist', controlId: 'SC-5', controlName: 'Denial of Service Protection' },
      { frameworkId: 'asvs', controlId: 'V11.1', controlName: 'Business Logic Security' },
    ],
    'CWE-787': [ // Out-of-bounds Write
      { frameworkId: 'nist', controlId: 'SI-16', controlName: 'Memory Protection' },
      { frameworkId: 'cis', controlId: '16.1', controlName: 'Secure Software Development Lifecycle' },
      { frameworkId: 'asvs', controlId: 'V5.4', controlName: 'Memory and String' },
    ],
    'CWE-829': [ // Inclusion of Untrusted Functionality
      { frameworkId: 'owasp', controlId: 'A06:2021', controlName: 'Vulnerable and Outdated Components' },
      { frameworkId: 'nist', controlId: 'SA-12', controlName: 'Supply Chain Protection' },
      { frameworkId: 'nist-csf', controlId: 'ID.SC-4', controlName: 'Supplier and Partner Assessment' },
    ],
    'CWE-915': [ // Improperly Controlled Modification
      { frameworkId: 'owasp', controlId: 'A08:2021', controlName: 'Software and Data Integrity Failures' },
      { frameworkId: 'nist', controlId: 'SI-7', controlName: 'Software and Information Integrity' },
      { frameworkId: 'nist-csf', controlId: 'PR.DS-6', controlName: 'Integrity Checking' },
    ],
    'CWE-942': [ // Permissive CORS
      { frameworkId: 'owasp', controlId: 'A05:2021', controlName: 'Security Misconfiguration' },
      { frameworkId: 'nist', controlId: 'AC-4', controlName: 'Information Flow Enforcement' },
      { frameworkId: 'asvs', controlId: 'V14.5', controlName: 'HTTP Security Headers' },
    ],
    'CWE-1021': [ // Improper Restriction of Rendered UI Layers (Clickjacking)
      { frameworkId: 'owasp', controlId: 'A05:2021', controlName: 'Security Misconfiguration' },
      { frameworkId: 'asvs', controlId: 'V14.4', controlName: 'HTTP Security Headers' },
    ],
  };

  constructor(private readonly prisma: PrismaService) {}

  async sync(): Promise<{ processed: number }> {
    await this.updateSyncStatus('cwe-mapping', 'syncing');
    let processed = 0;

    try {
      for (const [cweId, mappings] of Object.entries(this.MAPPINGS)) {
        for (const mapping of mappings) {
          try {
            await this.prisma.cweComplianceMapping.upsert({
              where: {
                cweId_frameworkId_controlId: {
                  cweId,
                  frameworkId: mapping.frameworkId,
                  controlId: mapping.controlId,
                },
              },
              create: {
                cweId,
                frameworkId: mapping.frameworkId,
                controlId: mapping.controlId,
                controlName: mapping.controlName,
                controlDescription: mapping.controlDescription,
              },
              update: {
                controlName: mapping.controlName,
                controlDescription: mapping.controlDescription,
              },
            });
            processed++;
          } catch (error) {
            // CWE might not exist yet - skip
            this.logger.debug(`Skipping mapping for ${cweId}: CWE not in database`);
          }
        }
      }

      await this.updateSyncStatus('cwe-mapping', 'success', processed);
      this.logger.log(`CWE mapping sync complete: ${processed} mappings`);
      return { processed };
    } catch (error) {
      await this.updateSyncStatus('cwe-mapping', 'failed', processed, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getMappingsForCwe(cweId: string): Promise<CweMapping[]> {
    return this.MAPPINGS[cweId] || [];
  }

  private async updateSyncStatus(
    source: string,
    status: string,
    recordCount?: number,
    errorMessage?: string,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.dataSyncStatus.upsert({
      where: { id: source },
      create: {
        id: source,
        status,
        recordCount: recordCount || 0,
        errorMessage,
        lastSyncAt: now,
        lastSuccessAt: status === 'success' ? now : undefined,
      },
      update: {
        status,
        recordCount: recordCount || undefined,
        errorMessage,
        lastSyncAt: now,
        lastSuccessAt: status === 'success' ? now : undefined,
      },
    });
  }
}
