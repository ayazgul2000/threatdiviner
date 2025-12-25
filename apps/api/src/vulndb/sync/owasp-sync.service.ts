import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface OwaspCategory {
  id: string;
  year: number;
  rank: number;
  name: string;
  description: string;
  cweIds: string[];
  preventionTips: string[];
  exampleScenarios: string[];
  references: string[];
}

@Injectable()
export class OwaspSyncService {
  private readonly logger = new Logger(OwaspSyncService.name);

  // OWASP Top 10 2021 data
  private readonly OWASP_2021: OwaspCategory[] = [
    {
      id: 'A01:2021',
      year: 2021,
      rank: 1,
      name: 'Broken Access Control',
      description: 'Access control enforces policy such that users cannot act outside of their intended permissions. Failures typically lead to unauthorized information disclosure, modification, or destruction of all data or performing a business function outside the user\'s limits.',
      cweIds: ['CWE-200', 'CWE-201', 'CWE-352', 'CWE-566', 'CWE-639', 'CWE-862', 'CWE-863', 'CWE-284', 'CWE-285', 'CWE-22'],
      preventionTips: [
        'Deny access by default except for public resources',
        'Implement access control mechanisms once and reuse throughout the application',
        'Model access controls should enforce record ownership',
        'Disable directory listing and remove sensitive files from web roots',
        'Log access control failures and alert admins when appropriate',
        'Rate limit API and controller access',
        'Invalidate session tokens on logout',
      ],
      exampleScenarios: [
        'The application uses unverified data in a SQL call accessing account information: pstmt.setString(1, request.getParameter("acct")); This allows an attacker to modify the acct parameter to send whatever account number they want.',
        'An attacker forces browsing to target URLs requiring authentication: /admin/users',
        'An API is configured to allow access without proper authentication checks',
      ],
      references: ['https://owasp.org/Top10/A01_2021-Broken_Access_Control/'],
    },
    {
      id: 'A02:2021',
      year: 2021,
      rank: 2,
      name: 'Cryptographic Failures',
      description: 'The first thing is to determine the protection needs of data in transit and at rest. Passwords, credit card numbers, health records, personal information, and business secrets require extra protection.',
      cweIds: ['CWE-259', 'CWE-327', 'CWE-331', 'CWE-321', 'CWE-322', 'CWE-323', 'CWE-324', 'CWE-325', 'CWE-326', 'CWE-328'],
      preventionTips: [
        'Classify data processed, stored, or transmitted by an application',
        'Identify which data is sensitive according to privacy laws, regulatory requirements, or business needs',
        'Apply controls per the classification',
        'Don\'t store sensitive data unnecessarily',
        'Encrypt all sensitive data at rest',
        'Use up-to-date and strong algorithms and keys',
        'Disable caching for responses containing sensitive data',
      ],
      exampleScenarios: [
        'An application encrypts credit card numbers in a database using automatic database encryption. However, this data is automatically decrypted when retrieved, allowing a SQL injection flaw to retrieve credit card numbers in clear text.',
        'A site uses HTTPS but has HTTP downgrade attack vulnerabilities',
        'Passwords are stored using unsalted or simple hashes',
      ],
      references: ['https://owasp.org/Top10/A02_2021-Cryptographic_Failures/'],
    },
    {
      id: 'A03:2021',
      year: 2021,
      rank: 3,
      name: 'Injection',
      description: 'An application is vulnerable to attack when user-supplied data is not validated, filtered, or sanitized by the application, dynamic queries or non-parameterized calls without context-aware escaping are used directly in the interpreter.',
      cweIds: ['CWE-79', 'CWE-89', 'CWE-78', 'CWE-73', 'CWE-77', 'CWE-917', 'CWE-94', 'CWE-1336', 'CWE-564', 'CWE-643'],
      preventionTips: [
        'Use a safe API that avoids the use of the interpreter entirely, provides a parameterized interface, or migrates to ORM',
        'Use positive server-side input validation',
        'Escape special characters for residual dynamic queries',
        'Use LIMIT and other SQL controls to prevent mass disclosure',
        'Use stored procedures',
      ],
      exampleScenarios: [
        'An application uses untrusted data in the construction of a vulnerable SQL call: query = "SELECT * FROM accounts WHERE custID=\'" + request.getParameter("id") + "\'"',
        'An application is vulnerable to OS command injection',
        'Template injection leads to remote code execution',
      ],
      references: ['https://owasp.org/Top10/A03_2021-Injection/'],
    },
    {
      id: 'A04:2021',
      year: 2021,
      rank: 4,
      name: 'Insecure Design',
      description: 'Insecure design is a broad category representing different weaknesses, expressed as "missing or ineffective control design." This is not the source of all other Top 10 risk categories.',
      cweIds: ['CWE-209', 'CWE-256', 'CWE-501', 'CWE-522', 'CWE-798', 'CWE-434', 'CWE-829', 'CWE-841', 'CWE-494', 'CWE-502'],
      preventionTips: [
        'Establish and use a secure development lifecycle with AppSec professionals',
        'Establish a library of secure design patterns or paved road components',
        'Use threat modeling for critical authentication, access control, business logic, and key flows',
        'Integrate security language and controls into user stories',
        'Write unit and integration tests to validate critical flows are resistant to threat models',
      ],
      exampleScenarios: [
        'A credential recovery workflow might include "questions and answers," which is prohibited by NIST 800-63b',
        'A cinema allows group booking discounts requiring a deposit. Attackers could book all seats and then not pay',
        'A retail chain allows posting reviews but does not validate purchases',
      ],
      references: ['https://owasp.org/Top10/A04_2021-Insecure_Design/'],
    },
    {
      id: 'A05:2021',
      year: 2021,
      rank: 5,
      name: 'Security Misconfiguration',
      description: 'The application might be vulnerable if it is missing appropriate security hardening across any part of the application stack or improperly configured permissions on cloud services.',
      cweIds: ['CWE-16', 'CWE-611', 'CWE-614', 'CWE-756', 'CWE-776', 'CWE-942', 'CWE-1004', 'CWE-1032', 'CWE-1174'],
      preventionTips: [
        'A repeatable hardening process makes deploying another locked-down environment fast and easy',
        'Use a minimal platform without unnecessary features, components, documentation, and samples',
        'Review and update configurations appropriate to all security notes, updates, and patches',
        'Use segmented architecture providing effective and secure separation',
        'Send security directives to clients (e.g., Security Headers)',
        'Automate verification of configurations in all environments',
      ],
      exampleScenarios: [
        'The application server comes with sample applications not removed from the production server',
        'Directory listing is not disabled on the server',
        'Stack traces with overly informative error messages are returned to users',
        'Cloud service default permissions are overly permissive to the internet',
      ],
      references: ['https://owasp.org/Top10/A05_2021-Security_Misconfiguration/'],
    },
    {
      id: 'A06:2021',
      year: 2021,
      rank: 6,
      name: 'Vulnerable and Outdated Components',
      description: 'You are likely vulnerable if you do not know the versions of all components you use, the software is vulnerable/unsupported/out of date, you do not scan for vulnerabilities regularly.',
      cweIds: ['CWE-1035', 'CWE-1104', 'CWE-937'],
      preventionTips: [
        'Remove unused dependencies, unnecessary features, components, files, and documentation',
        'Continuously inventory versions of client-side and server-side components and dependencies',
        'Only obtain components from official sources over secure links',
        'Monitor for libraries and components that are unmaintained or do not create security patches',
        'Ensure an ongoing plan for monitoring, triaging, and applying updates',
      ],
      exampleScenarios: [
        'Components typically run with the same privileges as the application, so flaws can result in serious impact',
        'Components with known vulnerabilities undermine application defenses',
        'Using components with CVEs allows exploitation',
      ],
      references: ['https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/'],
    },
    {
      id: 'A07:2021',
      year: 2021,
      rank: 7,
      name: 'Identification and Authentication Failures',
      description: 'Confirmation of the user\'s identity, authentication, and session management is critical to protect against authentication-related attacks.',
      cweIds: ['CWE-255', 'CWE-259', 'CWE-287', 'CWE-288', 'CWE-290', 'CWE-294', 'CWE-295', 'CWE-297', 'CWE-300', 'CWE-302', 'CWE-304', 'CWE-306', 'CWE-307', 'CWE-384', 'CWE-521', 'CWE-613', 'CWE-620', 'CWE-640', 'CWE-798', 'CWE-940', 'CWE-1216'],
      preventionTips: [
        'Implement multi-factor authentication to prevent credential stuffing, brute force, and stolen credential reuse',
        'Do not ship with default credentials, particularly for admin users',
        'Implement weak password checks',
        'Align password length, complexity, and rotation policies with NIST 800-63b guidelines',
        'Harden against account enumeration attacks',
        'Limit or increasingly delay failed login attempts',
        'Use a server-side, secure, built-in session manager',
      ],
      exampleScenarios: [
        'Credential stuffing attacks using lists of known passwords',
        'Brute force attacks against applications with weak passwords',
        'Session ID remains the same after authentication',
        'Session IDs exposed in the URL',
      ],
      references: ['https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/'],
    },
    {
      id: 'A08:2021',
      year: 2021,
      rank: 8,
      name: 'Software and Data Integrity Failures',
      description: 'Software and data integrity failures relate to code and infrastructure that does not protect against integrity violations. An example of this is where an application relies upon plugins, libraries, or modules from untrusted sources.',
      cweIds: ['CWE-345', 'CWE-353', 'CWE-426', 'CWE-494', 'CWE-502', 'CWE-565', 'CWE-784', 'CWE-829', 'CWE-830', 'CWE-915'],
      preventionTips: [
        'Use digital signatures or similar mechanisms to verify the software or data is from the expected source',
        'Ensure libraries and dependencies are consuming trusted repositories',
        'Use a software supply chain security tool to verify components don\'t contain known vulnerabilities',
        'Ensure there is a review process for code and configuration changes',
        'Ensure your CI/CD pipeline has proper segregation, configuration, and access control',
        'Do not send unsigned or unencrypted serialized data to untrusted clients',
      ],
      exampleScenarios: [
        'Update without verification: Auto-update functionality without verifying the update source',
        'SolarWinds malicious update: Attackers could update the build process to include malware',
        'Insecure deserialization: JSON objects sent from browser are deserialized on the server without validation',
      ],
      references: ['https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/'],
    },
    {
      id: 'A09:2021',
      year: 2021,
      rank: 9,
      name: 'Security Logging and Monitoring Failures',
      description: 'This category is to help detect, escalate, and respond to active breaches. Without logging and monitoring, breaches cannot be detected.',
      cweIds: ['CWE-117', 'CWE-223', 'CWE-532', 'CWE-778'],
      preventionTips: [
        'Ensure all login, access control, and server-side input validation failures can be logged',
        'Ensure logs are generated in a format easily consumed by log management solutions',
        'Ensure high-value transactions have an audit trail with integrity controls',
        'Establish effective monitoring and alerting',
        'Establish an incident response and recovery plan',
      ],
      exampleScenarios: [
        'A children\'s health plan provider\'s breach went undetected for 7 years due to lack of monitoring',
        'A major airline had a breach disclosed after more than 400,000 customer records were stolen',
        'Login failures were not logged, allowing attackers to brute force credentials undetected',
      ],
      references: ['https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/'],
    },
    {
      id: 'A10:2021',
      year: 2021,
      rank: 10,
      name: 'Server-Side Request Forgery (SSRF)',
      description: 'SSRF flaws occur whenever a web application is fetching a remote resource without validating the user-supplied URL. It allows an attacker to coerce the application to send a crafted request to an unexpected destination.',
      cweIds: ['CWE-918'],
      preventionTips: [
        'Segment remote resource access functionality in separate networks',
        'Enforce "deny by default" firewall policies',
        'Sanitize and validate all client-supplied input data',
        'Enforce URL schema, port, and destination with a positive allow list',
        'Do not send raw responses to clients',
        'Disable HTTP redirections',
      ],
      exampleScenarios: [
        'Port scan internal servers',
        'Sensitive data exposure via internal services',
        'Read metadata storage of cloud services',
        'Compromise internal services using protocol smuggling',
      ],
      references: ['https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/'],
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  async sync(): Promise<{ processed: number }> {
    await this.updateSyncStatus('owasp', 'syncing');
    let processed = 0;

    try {
      for (const category of this.OWASP_2021) {
        await this.prisma.owaspTop10.upsert({
          where: { id: category.id },
          create: {
            id: category.id,
            year: category.year,
            rank: category.rank,
            name: category.name,
            description: category.description,
            cweIds: category.cweIds,
            preventionTips: category.preventionTips,
            exampleScenarios: category.exampleScenarios,
            references: category.references,
          },
          update: {
            year: category.year,
            rank: category.rank,
            name: category.name,
            description: category.description,
            cweIds: category.cweIds,
            preventionTips: category.preventionTips,
            exampleScenarios: category.exampleScenarios,
            references: category.references,
          },
        });
        processed++;
      }

      await this.updateSyncStatus('owasp', 'success', processed);
      this.logger.log(`OWASP Top 10 sync complete: ${processed} categories`);
      return { processed };
    } catch (error) {
      await this.updateSyncStatus('owasp', 'failed', processed, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async getOwaspForCwe(cweId: string): Promise<string | null> {
    for (const category of this.OWASP_2021) {
      if (category.cweIds.includes(cweId)) {
        return category.id;
      }
    }
    return null;
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
