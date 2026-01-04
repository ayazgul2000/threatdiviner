/**
 * Mock Scan Results Fixtures
 * Used for testing scan execution flow
 */

export const mockSastResults = {
  scanner: 'semgrep',
  scanType: 'SAST',
  findings: [
    {
      ruleId: 'javascript.lang.security.audit.xss.direct-html-write',
      severity: 'HIGH',
      message: 'Detected direct HTML write which may lead to XSS',
      filePath: 'src/components/UserProfile.tsx',
      lineStart: 42,
      lineEnd: 42,
      codeSnippet: 'element.innerHTML = userInput;',
      cwe: ['CWE-79'],
      references: [
        'https://owasp.org/www-community/attacks/xss/',
      ],
    },
    {
      ruleId: 'javascript.lang.security.audit.sqli.string-concat-query',
      severity: 'CRITICAL',
      message: 'SQL query built with string concatenation',
      filePath: 'src/services/user.service.ts',
      lineStart: 156,
      lineEnd: 158,
      codeSnippet: 'const query = `SELECT * FROM users WHERE id = ${userId}`;',
      cwe: ['CWE-89'],
      references: [
        'https://owasp.org/www-community/attacks/SQL_Injection',
      ],
    },
  ],
  metadata: {
    totalFiles: 245,
    filesScanned: 198,
    rulesApplied: 1247,
    scanDuration: 12500,
  },
};

export const mockScaResults = {
  scanner: 'npm-audit',
  scanType: 'SCA',
  findings: [
    {
      packageName: 'lodash',
      installedVersion: '4.17.15',
      vulnerableVersions: '<4.17.21',
      severity: 'HIGH',
      cve: 'CVE-2021-23337',
      title: 'Prototype Pollution in lodash',
      description: 'Lodash versions prior to 4.17.21 are vulnerable to Command Injection via the template function.',
      fixedVersion: '4.17.21',
      references: [
        'https://nvd.nist.gov/vuln/detail/CVE-2021-23337',
      ],
    },
    {
      packageName: 'axios',
      installedVersion: '0.21.1',
      vulnerableVersions: '<0.21.2',
      severity: 'MEDIUM',
      cve: 'CVE-2021-3749',
      title: 'Server-Side Request Forgery in axios',
      description: 'axios before 0.21.2 allows Server-Side Request Forgery.',
      fixedVersion: '0.21.2',
      references: [
        'https://nvd.nist.gov/vuln/detail/CVE-2021-3749',
      ],
    },
  ],
  metadata: {
    totalPackages: 847,
    directDependencies: 45,
    transitDependencies: 802,
    scanDuration: 3200,
  },
};

export const mockSecretsResults = {
  scanner: 'gitleaks',
  scanType: 'SECRETS',
  findings: [
    {
      ruleId: 'aws-access-key-id',
      severity: 'CRITICAL',
      message: 'AWS Access Key ID detected',
      filePath: 'config/production.env.example',
      lineStart: 12,
      lineEnd: 12,
      secret: 'AKIA***************',
      entropy: 4.2,
    },
    {
      ruleId: 'generic-api-key',
      severity: 'HIGH',
      message: 'Generic API key detected',
      filePath: 'src/config/api.ts',
      lineStart: 8,
      lineEnd: 8,
      secret: 'api_key=abc***...***xyz',
      entropy: 3.8,
    },
  ],
  metadata: {
    totalFiles: 312,
    filesScanned: 312,
    commitsScanned: 0,
    scanDuration: 1800,
  },
};

export const mockIacResults = {
  scanner: 'trivy',
  scanType: 'IAC',
  findings: [
    {
      ruleId: 'AVD-AWS-0057',
      severity: 'HIGH',
      message: 'S3 bucket has public access enabled',
      filePath: 'terraform/s3.tf',
      lineStart: 15,
      lineEnd: 18,
      resource: 'aws_s3_bucket.public_assets',
      remediation: 'Set block_public_acls = true and block_public_policy = true',
    },
    {
      ruleId: 'AVD-AWS-0086',
      severity: 'MEDIUM',
      message: 'RDS instance is not encrypted',
      filePath: 'terraform/rds.tf',
      lineStart: 8,
      lineEnd: 12,
      resource: 'aws_db_instance.main',
      remediation: 'Set storage_encrypted = true',
    },
  ],
  metadata: {
    totalFiles: 24,
    filesScanned: 24,
    resourcesAnalyzed: 156,
    scanDuration: 2100,
  },
};

export const mockCompleteScanResult = {
  scanId: 'scan-integration-test-001',
  repositoryId: 'repo-001',
  branch: 'main',
  commit: 'abc123def456',
  status: 'completed',
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  results: {
    sast: mockSastResults,
    sca: mockScaResults,
    secrets: mockSecretsResults,
    iac: mockIacResults,
  },
  summary: {
    critical: 2,
    high: 4,
    medium: 2,
    low: 0,
    info: 0,
    total: 8,
  },
};

export const mockScanProgress = {
  pending: {
    status: 'pending',
    progress: 0,
    message: 'Scan queued',
  },
  cloning: {
    status: 'running',
    progress: 10,
    message: 'Cloning repository...',
  },
  scanning: {
    status: 'running',
    progress: 50,
    message: 'Running security scanners...',
  },
  processing: {
    status: 'running',
    progress: 80,
    message: 'Processing results...',
  },
  completed: {
    status: 'completed',
    progress: 100,
    message: 'Scan completed',
  },
  failed: {
    status: 'failed',
    progress: 0,
    message: 'Scan failed: Repository not accessible',
  },
};
