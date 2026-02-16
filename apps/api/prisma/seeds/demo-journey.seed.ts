import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Fixed UUIDs for predictable references
const IDS = {
  // Tenant & Users
  tenant: '11111111-1111-1111-1111-111111111111',
  adminUser: '22222222-2222-2222-2222-222222222222',
  devUser: '22222222-2222-2222-2222-222222222223',

  // SCM Connection
  githubConnection: '33333333-3333-3333-3333-333333333333',

  // Project
  project: 'clproject00securefintech001',

  // Repositories
  repoBackend: '55555555-5555-5555-5555-555555555551',
  repoFrontend: '55555555-5555-5555-5555-555555555552',
  repoInfra: '55555555-5555-5555-5555-555555555553',

  // Threat Model
  threatModel: '66666666-6666-6666-6666-666666666666',

  // Environments
  envDev: '77777777-7777-7777-7777-777777777771',
  envStaging: '77777777-7777-7777-7777-777777777772',
  envProd: '77777777-7777-7777-7777-777777777773',

  // Scans (chronological)
  scanOct1: '88888888-8888-8888-8888-888888888801',
  scanOct15: '88888888-8888-8888-8888-888888888802',
  scanNov1: '88888888-8888-8888-8888-888888888803',
  scanNov15: '88888888-8888-8888-8888-888888888804',
  scanDec1: '88888888-8888-8888-8888-888888888805',
  scanDec15: '88888888-8888-8888-8888-888888888806',

  // Alert Rules
  alertCritical: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',

  // Pipeline Gates
  gateDev: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
  gateStaging: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
  gateProd: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',

  // Findings (the 8 initial + 1 new CVE)
  finding1: 'dddddddd-dddd-dddd-dddd-dddddddddd01',
  finding2: 'dddddddd-dddd-dddd-dddd-dddddddddd02',
  finding3: 'dddddddd-dddd-dddd-dddd-dddddddddd03',
  finding4: 'dddddddd-dddd-dddd-dddd-dddddddddd04',
  finding5: 'dddddddd-dddd-dddd-dddd-dddddddddd05',
  finding6: 'dddddddd-dddd-dddd-dddd-dddddddddd06',
  finding7: 'dddddddd-dddd-dddd-dddd-dddddddddd07',
  finding8: 'dddddddd-dddd-dddd-dddd-dddddddddd08',
  findingNewCVE: 'dddddddd-dddd-dddd-dddd-dddddddddd09',

  // Baselines
  baseline1: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01',

  // Deployments
  deployDev: 'ffffffff-ffff-ffff-ffff-ffffffffffff01',
  deployStaging: 'ffffffff-ffff-ffff-ffff-ffffffffffff02',
  deployProd: 'ffffffff-ffff-ffff-ffff-ffffffffffff03',

  // Threat Model Components
  compApiGateway: 'comp-api-gateway-001',
  compPaymentService: 'comp-payment-service-001',
  compCardVault: 'comp-card-vault-001',
  compMerchantDb: 'comp-merchant-db-001',
  compWebhookQueue: 'comp-webhook-queue-001',
};

// Dates for the 3-month timeline
const DATES = {
  oct1: new Date('2024-10-01T09:00:00Z'),
  oct5: new Date('2024-10-05T14:00:00Z'),
  oct10: new Date('2024-10-10T10:00:00Z'),
  oct15: new Date('2024-10-15T11:00:00Z'),
  nov1: new Date('2024-11-01T09:00:00Z'),
  nov10: new Date('2024-11-10T15:00:00Z'),
  nov15: new Date('2024-11-15T10:00:00Z'),
  nov20: new Date('2024-11-20T14:00:00Z'),
  dec1: new Date('2024-12-01T09:00:00Z'),
  dec5: new Date('2024-12-05T11:00:00Z'),
  dec10: new Date('2024-12-10T16:00:00Z'),
  dec15: new Date('2024-12-15T08:30:00Z'),
  now: new Date(),
};

async function seedDemoJourney() {
  console.log('\n===============================================');
  console.log('  SECUREFINTECH DEMO JOURNEY SEED');
  console.log('===============================================\n');

  // ========================================
  // 1. TENANT & USERS
  // ========================================
  console.log('1. Creating Tenant & Users...');

  await prisma.tenant.upsert({
    where: { slug: 'securefintech' },
    update: {
      name: 'SecureFintech Ltd',
      plan: 'enterprise',
      maxUsers: 50,
      maxRepositories: 200,
      aiTriageEnabled: true,
    },
    create: {
      id: IDS.tenant,
      name: 'SecureFintech Ltd',
      slug: 'securefintech',
      plan: 'enterprise',
      maxUsers: 50,
      maxRepositories: 200,
      aiTriageEnabled: true,
    },
  });

  const passwordHash = await bcrypt.hash('Demo123!', 10);

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: IDS.tenant, email: 'sarah.chen@securefintech.io' } },
    update: { passwordHash, name: 'Sarah Chen', role: 'admin' },
    create: {
      id: IDS.adminUser,
      email: 'sarah.chen@securefintech.io',
      passwordHash,
      name: 'Sarah Chen',
      role: 'admin',
      status: 'active',
      tenantId: IDS.tenant,
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: IDS.tenant, email: 'mike.ross@securefintech.io' } },
    update: { passwordHash, name: 'Mike Ross', role: 'member' },
    create: {
      id: IDS.devUser,
      email: 'mike.ross@securefintech.io',
      passwordHash,
      name: 'Mike Ross',
      role: 'member',
      status: 'active',
      tenantId: IDS.tenant,
    },
  });

  console.log('   ✓ Tenant: SecureFintech Ltd');
  console.log('   ✓ Admin: sarah.chen@securefintech.io / Demo123!');
  console.log('   ✓ Developer: mike.ross@securefintech.io / Demo123!\n');

  // ========================================
  // 2. SCM CONNECTION (GitHub)
  // ========================================
  console.log('2. Creating GitHub Connection...');

  await prisma.scmConnection.upsert({
    where: { tenantId_provider_externalId: { tenantId: IDS.tenant, provider: 'github', externalId: 'securefintech' } },
    update: { isActive: true },
    create: {
      id: IDS.githubConnection,
      tenantId: IDS.tenant,
      provider: 'github',
      authMethod: 'oauth',
      accessToken: 'encrypted_github_token_xxx',
      externalId: 'securefintech',
      externalName: 'SecureFintech',
      scope: ['repo', 'read:org', 'write:packages'],
      isActive: true,
    },
  });

  console.log('   ✓ GitHub connection: SecureFintech (connected)\n');

  // ========================================
  // 3. PROJECT
  // ========================================
  console.log('3. Creating Project...');

  await prisma.project.upsert({
    where: { tenantId_name: { tenantId: IDS.tenant, name: 'Payment Gateway' } },
    update: {},
    create: {
      id: IDS.project,
      tenantId: IDS.tenant,
      name: 'Payment Gateway',
      description: 'Core payment processing API and infrastructure for SecureFintech',
      status: 'ACTIVE',
    },
  });

  console.log('   ✓ Project: Payment Gateway\n');

  // ========================================
  // 4. REPOSITORIES
  // ========================================
  console.log('4. Creating Repositories...');

  const repos = [
    {
      id: IDS.repoBackend,
      name: 'payment-api',
      fullName: 'securefintech/payment-api',
      cloneUrl: 'https://github.com/securefintech/payment-api.git',
      htmlUrl: 'https://github.com/securefintech/payment-api',
      language: 'TypeScript',
      defaultBranch: 'main',
    },
    {
      id: IDS.repoFrontend,
      name: 'merchant-portal',
      fullName: 'securefintech/merchant-portal',
      cloneUrl: 'https://github.com/securefintech/merchant-portal.git',
      htmlUrl: 'https://github.com/securefintech/merchant-portal',
      language: 'TypeScript',
      defaultBranch: 'main',
    },
    {
      id: IDS.repoInfra,
      name: 'infrastructure',
      fullName: 'securefintech/infrastructure',
      cloneUrl: 'https://github.com/securefintech/infrastructure.git',
      htmlUrl: 'https://github.com/securefintech/infrastructure',
      language: 'HCL',
      defaultBranch: 'main',
    },
  ];

  for (const repo of repos) {
    await prisma.repository.upsert({
      where: { tenantId_fullName: { tenantId: IDS.tenant, fullName: repo.fullName } },
      update: {},
      create: {
        ...repo,
        tenantId: IDS.tenant,
        projectId: IDS.project,
        connectionId: IDS.githubConnection,
        isPrivate: true,
        isActive: true,
        lastScanAt: DATES.dec15,
      },
    });
    console.log(`   ✓ Repository: ${repo.name}`);
  }
  console.log('');

  // ========================================
  // 5. ENVIRONMENTS
  // ========================================
  console.log('5. Creating Environments...');

  const environments = [
    { id: IDS.envDev, name: 'Development', type: 'kubernetes' },
    { id: IDS.envStaging, name: 'Staging', type: 'kubernetes' },
    { id: IDS.envProd, name: 'Production', type: 'kubernetes' },
  ];

  for (const env of environments) {
    await prisma.environment.upsert({
      where: { tenantId_name: { tenantId: IDS.tenant, name: env.name } },
      update: {},
      create: {
        ...env,
        tenantId: IDS.tenant,
        projectId: IDS.project,
        description: `${env.name} environment for Payment Gateway`,
        isActive: true,
      },
    });
    console.log(`   ✓ Environment: ${env.name}`);
  }
  console.log('');

  // ========================================
  // 6. THREAT MODEL
  // ========================================
  console.log('6. Creating Threat Model with STRIDE Analysis...');

  await prisma.threatModel.upsert({
    where: { id: IDS.threatModel },
    update: {},
    create: {
      id: IDS.threatModel,
      tenantId: IDS.tenant,
      projectId: IDS.project,
      name: 'Payment Gateway API - STRIDE Analysis',
      description: 'Comprehensive threat model for payment processing flow',
      status: 'completed',
      methodology: 'stride',
      createdBy: IDS.adminUser,
      completedAt: DATES.oct15,
    },
  });

  // Threat Model Components
  const components = [
    { id: IDS.compApiGateway, name: 'API Gateway', type: 'process', criticality: 'high', technology: 'Kong/NGINX' },
    { id: IDS.compPaymentService, name: 'Payment Service', type: 'process', criticality: 'critical', technology: 'Node.js/NestJS' },
    { id: IDS.compCardVault, name: 'Card Vault', type: 'datastore', criticality: 'critical', technology: 'HashiCorp Vault' },
    { id: IDS.compMerchantDb, name: 'Merchant Database', type: 'datastore', criticality: 'high', technology: 'PostgreSQL' },
    { id: IDS.compWebhookQueue, name: 'Webhook Queue', type: 'process', criticality: 'medium', technology: 'Redis/Bull' },
  ];

  for (const comp of components) {
    await prisma.threatModelComponent.upsert({
      where: { id: comp.id },
      update: {},
      create: {
        ...comp,
        threatModelId: IDS.threatModel,
        positionX: Math.random() * 500,
        positionY: Math.random() * 400,
      },
    });
  }

  // STRIDE Threats (12 total - 2 per category)
  const threats = [
    // Spoofing (S)
    { id: 'threat-s1', title: 'API Key Theft', category: 'spoofing', strideCategory: 'spoofing', likelihood: 'high', impact: 'high', status: 'mitigated' },
    { id: 'threat-s2', title: 'Session Hijacking', category: 'spoofing', strideCategory: 'spoofing', likelihood: 'medium', impact: 'high', status: 'mitigated' },
    // Tampering (T)
    { id: 'threat-t1', title: 'Payment Amount Manipulation', category: 'tampering', strideCategory: 'tampering', likelihood: 'medium', impact: 'very_high', status: 'mitigated' },
    { id: 'threat-t2', title: 'Card Data Modification', category: 'tampering', strideCategory: 'tampering', likelihood: 'low', impact: 'very_high', status: 'mitigated' },
    // Repudiation (R)
    { id: 'threat-r1', title: 'Transaction Denial', category: 'repudiation', strideCategory: 'repudiation', likelihood: 'medium', impact: 'medium', status: 'mitigated' },
    { id: 'threat-r2', title: 'Audit Log Tampering', category: 'repudiation', strideCategory: 'repudiation', likelihood: 'low', impact: 'high', status: 'mitigated' },
    // Information Disclosure (I)
    { id: 'threat-i1', title: 'Card Number Exposure', category: 'information_disclosure', strideCategory: 'information_disclosure', likelihood: 'medium', impact: 'very_high', status: 'mitigated' },
    { id: 'threat-i2', title: 'API Response Leakage', category: 'information_disclosure', strideCategory: 'information_disclosure', likelihood: 'high', impact: 'medium', status: 'identified' }, // ONE OPEN!
    // Denial of Service (D)
    { id: 'threat-d1', title: 'API Rate Limit Bypass', category: 'denial_of_service', strideCategory: 'denial_of_service', likelihood: 'high', impact: 'medium', status: 'mitigated' },
    { id: 'threat-d2', title: 'Database Overload', category: 'denial_of_service', strideCategory: 'denial_of_service', likelihood: 'medium', impact: 'high', status: 'mitigated' },
    // Elevation of Privilege (E)
    { id: 'threat-e1', title: 'Role Escalation', category: 'elevation_of_privilege', strideCategory: 'elevation_of_privilege', likelihood: 'low', impact: 'very_high', status: 'mitigated' },
    { id: 'threat-e2', title: 'Admin Access via SQL Injection', category: 'elevation_of_privilege', strideCategory: 'elevation_of_privilege', likelihood: 'low', impact: 'very_high', status: 'mitigated' },
  ];

  for (const threat of threats) {
    await prisma.threat.upsert({
      where: { id: threat.id },
      update: {},
      create: {
        ...threat,
        threatModelId: IDS.threatModel,
        description: `STRIDE Threat: ${threat.title} - Category: ${threat.strideCategory?.toUpperCase()}`,
        riskScore: threat.likelihood === 'very_high' ? 9.0 : threat.likelihood === 'high' ? 7.0 : threat.likelihood === 'medium' ? 5.0 : 3.0,
      },
    });
  }

  console.log('   ✓ Threat Model: Payment Gateway API - STRIDE Analysis');
  console.log('   ✓ 5 Components defined');
  console.log('   ✓ 12 Threats (11 mitigated, 1 open)\n');

  // ========================================
  // 7. SCANS (Chronological)
  // ========================================
  console.log('7. Creating Scans...');

  const scans = [
    { id: IDS.scanOct1, commitSha: 'a1b2c3d', status: 'completed', startedAt: DATES.oct10, triggeredBy: 'manual' },
    { id: IDS.scanOct15, commitSha: 'e4f5g6h', status: 'completed', startedAt: DATES.oct15, triggeredBy: 'push' },
    { id: IDS.scanNov1, commitSha: 'i7j8k9l', status: 'completed', startedAt: DATES.nov1, triggeredBy: 'push' },
    { id: IDS.scanNov15, commitSha: 'm0n1o2p', status: 'completed', startedAt: DATES.nov15, triggeredBy: 'push' },
    { id: IDS.scanDec1, commitSha: 'q3r4s5t', status: 'completed', startedAt: DATES.dec1, triggeredBy: 'push' },
    { id: IDS.scanDec15, commitSha: 'u6v7w8x', status: 'completed', startedAt: DATES.dec15, triggeredBy: 'scheduled' },
  ];

  for (const scan of scans) {
    await prisma.scan.upsert({
      where: { id: scan.id },
      update: {},
      create: {
        ...scan,
        tenantId: IDS.tenant,
        repositoryId: IDS.repoBackend,
        projectId: IDS.project,
        branch: 'main',
        completedAt: new Date(scan.startedAt.getTime() + 5 * 60 * 1000),
        duration: 300,
      },
    });
    console.log(`   ✓ Scan: ${scan.commitSha} (${scan.startedAt.toISOString().split('T')[0]})`);
  }
  console.log('');

  // ========================================
  // 8. FINDINGS
  // ========================================
  console.log('8. Creating Findings...');

  const findings = [
    // Initial 8 findings from October (6 resolved, 1 accepted, 1 open/baselined)
    {
      id: IDS.finding1,
      scanId: IDS.scanOct1,
      title: 'SQL Injection in User Query',
      description: 'User input directly concatenated in SQL query without parameterization',
      severity: 'critical',
      status: 'fixed',
      scanner: 'semgrep',
      ruleId: 'cwe-89',
      filePath: 'src/users/users.repository.ts',
      startLine: 45,
      remediation: 'Use parameterized queries with Prisma ORM',
      cweId: 'CWE-89',
    },
    {
      id: IDS.finding2,
      scanId: IDS.scanOct1,
      title: 'Hardcoded AWS Credentials',
      description: 'AWS access key found in source code',
      severity: 'critical',
      status: 'fixed',
      scanner: 'gitleaks',
      ruleId: 'aws-access-key',
      filePath: 'src/config/aws.ts',
      startLine: 12,
      remediation: 'Use environment variables or AWS Secrets Manager',
    },
    {
      id: IDS.finding3,
      scanId: IDS.scanOct1,
      title: 'Vulnerable lodash 4.17.15',
      description: 'lodash 4.17.15 has prototype pollution vulnerability CVE-2020-8203',
      severity: 'high',
      status: 'fixed',
      scanner: 'trivy',
      ruleId: 'CVE-2020-8203',
      filePath: 'package.json',
      startLine: 1,
      remediation: 'Upgrade lodash to 4.17.21 or later',
      cveId: 'CVE-2020-8203',
    },
    {
      id: IDS.finding4,
      scanId: IDS.scanOct1,
      title: 'XSS in Error Messages',
      description: 'User input reflected in error messages without sanitization',
      severity: 'high',
      status: 'fixed',
      scanner: 'semgrep',
      ruleId: 'cwe-79',
      filePath: 'src/common/filters/http-exception.filter.ts',
      startLine: 23,
      remediation: 'Sanitize all user input in error responses',
      cweId: 'CWE-79',
    },
    {
      id: IDS.finding5,
      scanId: IDS.scanOct1,
      title: 'Insecure Cookie Configuration',
      description: 'Session cookies missing Secure and HttpOnly flags',
      severity: 'high',
      status: 'fixed',
      scanner: 'semgrep',
      ruleId: 'cwe-614',
      filePath: 'src/auth/auth.service.ts',
      startLine: 89,
      remediation: 'Add Secure, HttpOnly, and SameSite flags to cookies',
      cweId: 'CWE-614',
    },
    {
      id: IDS.finding6,
      scanId: IDS.scanOct1,
      title: 'Missing Rate Limiting',
      description: 'Authentication endpoint lacks rate limiting',
      severity: 'medium',
      status: 'fixed',
      scanner: 'semgrep',
      ruleId: 'cwe-307',
      filePath: 'src/auth/auth.controller.ts',
      startLine: 34,
      remediation: 'Implement rate limiting using @nestjs/throttler',
      cweId: 'CWE-307',
    },
    {
      id: IDS.finding7,
      scanId: IDS.scanOct1,
      title: 'Verbose Error Messages',
      description: 'Stack traces exposed in production error responses',
      severity: 'medium',
      status: 'accepted', // Baselined as accepted risk
      scanner: 'semgrep',
      ruleId: 'cwe-209',
      filePath: 'src/main.ts',
      startLine: 56,
      remediation: 'Disable verbose errors in production',
      dismissReason: 'Only enabled in non-production environments, verified by env check',
      cweId: 'CWE-209',
    },
    {
      id: IDS.finding8,
      scanId: IDS.scanOct1,
      title: 'Weak Password Policy',
      description: 'Password validation allows simple passwords',
      severity: 'low',
      status: 'fixed',
      scanner: 'semgrep',
      ruleId: 'cwe-521',
      filePath: 'src/users/dto/create-user.dto.ts',
      startLine: 12,
      remediation: 'Enforce minimum 12 characters with complexity requirements',
      cweId: 'CWE-521',
    },
    // NEW finding from December (the incident!)
    {
      id: IDS.findingNewCVE,
      scanId: IDS.scanDec15,
      title: 'CRITICAL: New CVE in lodash (CVE-2024-XXXX)',
      description: 'Remote code execution vulnerability in lodash.set() function',
      severity: 'critical',
      status: 'open',
      scanner: 'trivy',
      ruleId: 'CVE-2024-XXXX',
      filePath: 'package.json',
      startLine: 1,
      remediation: 'Upgrade lodash to 4.17.22 immediately',
      cveId: 'CVE-2024-XXXX',
    },
  ];

  for (const finding of findings) {
    await prisma.finding.upsert({
      where: { id: finding.id },
      update: {},
      create: {
        ...finding,
        tenantId: IDS.tenant,
        repositoryId: IDS.repoBackend,
        projectId: IDS.project,
        firstSeenAt: finding.id === IDS.findingNewCVE ? DATES.dec15 : DATES.oct10,
      },
    });
  }

  console.log('   ✓ 8 Initial findings (6 fixed, 1 accepted, 1 baselined)');
  console.log('   ✓ 1 NEW Critical CVE (detected Dec 15 - SLA: 72 hours)\n');

  // ========================================
  // 9. BASELINES
  // ========================================
  console.log('9. Creating Baselines...');

  await prisma.findingBaseline.upsert({
    where: { tenantId_repositoryId_fingerprint: { tenantId: IDS.tenant, repositoryId: IDS.repoBackend, fingerprint: 'cwe-209-main-ts-56' } },
    update: {},
    create: {
      id: IDS.baseline1,
      tenantId: IDS.tenant,
      repositoryId: IDS.repoBackend,
      fingerprint: 'cwe-209-main-ts-56',
      reason: 'Verbose error messages only shown in development environment',
      baselinedBy: IDS.adminUser,
    },
  });

  console.log('   ✓ 1 Baseline for accepted risk\n');

  // ========================================
  // 10. PIPELINE GATES
  // ========================================
  console.log('10. Creating Pipeline Gates...');

  const gates = [
    { id: IDS.gateDev, stage: 'deploy-dev', blockSeverity: 'none', repositoryId: IDS.repoBackend },
    { id: IDS.gateStaging, stage: 'deploy-staging', blockSeverity: 'critical', repositoryId: IDS.repoBackend },
    { id: IDS.gateProd, stage: 'deploy-prod', blockSeverity: 'high', repositoryId: IDS.repoBackend },
  ];

  for (const gate of gates) {
    await prisma.pipelineGate.upsert({
      where: { tenantId_repositoryId_stage: { tenantId: IDS.tenant, repositoryId: gate.repositoryId, stage: gate.stage } },
      update: {},
      create: {
        ...gate,
        tenantId: IDS.tenant,
        projectId: IDS.project,
        enabled: true,
        notifyOnFailure: true,
      },
    });
    console.log(`   ✓ Gate: ${gate.stage} (blocks: ${gate.blockSeverity})`);
  }
  console.log('');

  // ========================================
  // 11. DEPLOYMENTS
  // ========================================
  console.log('11. Creating Deployments...');

  const deployments = [
    { id: IDS.deployDev, environmentId: IDS.envDev, name: 'payment-api', version: 'v1.0.0', createdAt: DATES.oct15 },
    { id: IDS.deployStaging, environmentId: IDS.envStaging, name: 'payment-api', version: 'v1.1.0', createdAt: DATES.nov20 },
    { id: IDS.deployProd, environmentId: IDS.envProd, name: 'payment-api', version: 'v1.1.0', createdAt: DATES.dec5 },
  ];

  for (const deploy of deployments) {
    await prisma.deployment.upsert({
      where: { id: deploy.id },
      update: {},
      create: {
        ...deploy,
        tenantId: IDS.tenant,
        repositoryId: IDS.repoBackend,
        status: 'running',
        replicas: deploy.environmentId === IDS.envProd ? 3 : 1,
      },
    });
    console.log(`   ✓ Deployment: ${deploy.version} to ${deploy.environmentId === IDS.envProd ? 'Production' : deploy.environmentId === IDS.envStaging ? 'Staging' : 'Development'}`);
  }
  console.log('');

  // ========================================
  // 12. ALERT RULES
  // ========================================
  console.log('12. Creating Alert Rules...');

  await prisma.alertRule.upsert({
    where: { id: IDS.alertCritical },
    update: {},
    create: {
      id: IDS.alertCritical,
      tenantId: IDS.tenant,
      name: 'Critical Vulnerability Alert',
      description: 'Alert when new CRITICAL vulnerability is detected',
      enabled: true,
      eventTypes: ['finding.created'],
      severities: ['critical'],
      notifySlack: true,
      notifyEmail: true,
      createJiraIssue: false,
      lastTriggeredAt: DATES.dec15,
      triggerCount: 1,
    },
  });

  console.log('   ✓ Alert: Critical Vulnerability Alert (email + Slack)\n');

  // ========================================
  // 13. ALERT HISTORY (The incident!)
  // ========================================
  console.log('13. Creating Alert History...');

  await prisma.alertHistory.upsert({
    where: { id: 'alert-hist-dec15-001' },
    update: {},
    create: {
      id: 'alert-hist-dec15-001',
      ruleId: IDS.alertCritical,
      tenantId: IDS.tenant,
      matchedEvents: 1,
      sampleEvents: [{
        type: 'finding.created',
        findingId: IDS.findingNewCVE,
        title: 'CRITICAL: New CVE in lodash (CVE-2024-XXXX)',
        severity: 'critical',
        repository: 'payment-api',
      }],
      triggeredAt: DATES.dec15,
    },
  });

  console.log('   ✓ Alert triggered on Dec 15 for new CVE\n');

  // ========================================
  // 14. AUDIT LOGS
  // ========================================
  console.log('14. Creating Audit Log Trail...');

  const auditEvents = [
    { action: 'project.create', resource: 'project', resourceId: IDS.project, createdAt: DATES.oct5 },
    { action: 'threat_model.create', resource: 'threat_model', resourceId: IDS.threatModel, createdAt: DATES.oct10 },
    { action: 'threat_model.complete', resource: 'threat_model', resourceId: IDS.threatModel, createdAt: DATES.oct15 },
    { action: 'scan.complete', resource: 'scan', resourceId: IDS.scanOct1, createdAt: DATES.oct10 },
    { action: 'finding.status_change', resource: 'finding', resourceId: IDS.finding2, details: { newStatus: 'fixed' }, createdAt: DATES.oct15 },
    { action: 'deployment.create', resource: 'deployment', resourceId: IDS.deployDev, createdAt: DATES.oct15 },
    { action: 'finding.status_change', resource: 'finding', resourceId: IDS.finding1, details: { newStatus: 'fixed' }, createdAt: DATES.nov1 },
    { action: 'finding.baseline', resource: 'finding', resourceId: IDS.finding7, details: { reason: 'Accepted risk' }, createdAt: DATES.nov15 },
    { action: 'deployment.create', resource: 'deployment', resourceId: IDS.deployStaging, createdAt: DATES.nov20 },
    { action: 'deployment.create', resource: 'deployment', resourceId: IDS.deployProd, createdAt: DATES.dec5 },
    { action: 'finding.create', resource: 'finding', resourceId: IDS.findingNewCVE, createdAt: DATES.dec15 },
    { action: 'alert.trigger', resource: 'alert_rule', resourceId: IDS.alertCritical, details: { findingId: IDS.findingNewCVE }, createdAt: DATES.dec15 },
  ];

  for (const event of auditEvents) {
    await prisma.auditLog.create({
      data: {
        tenantId: IDS.tenant,
        userId: IDS.adminUser,
        userEmail: 'sarah.chen@securefintech.io',
        ...event,
      },
    });
  }

  console.log('   ✓ 12 Audit events logged\n');

  // ========================================
  // SUMMARY
  // ========================================
  console.log('===============================================');
  console.log('  DEMO JOURNEY SEED COMPLETE!');
  console.log('===============================================');
  console.log('');
  console.log('LOGIN CREDENTIALS:');
  console.log('  Email:    sarah.chen@securefintech.io');
  console.log('  Password: Demo123!');
  console.log('  Tenant:   securefintech');
  console.log('');
  console.log('TIMELINE:');
  console.log('  October:  Threat model created, 8 vulnerabilities found');
  console.log('  November: 6 fixed, 1 accepted/baselined, deployed to staging');
  console.log('  December: Production deployment, NEW CRITICAL CVE detected!');
  console.log('');
  console.log('WALKTHROUGH:');
  console.log('  1. Dashboard    → See overview with 1 CRITICAL finding');
  console.log('  2. Findings     → See full history (8 initial + 1 new)');
  console.log('  3. Threat Model → See STRIDE analysis with 12 threats');
  console.log('  4. Environments → See Dev → Staging → Prod progression');
  console.log('  5. Alerts       → See notification sent');
  console.log('===============================================\n');
}

seedDemoJourney()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
