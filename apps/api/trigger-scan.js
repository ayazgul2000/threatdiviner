// Trigger scan execution directly (bypassing API auth)
const { PrismaClient } = require('@prisma/client');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const prisma = new PrismaClient();

const NUCLEI_PATH = 'C:/dev/nuclei/nuclei.exe';

// Discovery templates
const DISCOVERY_TEMPLATES = [
  'http/technologies',
  'http/exposed-panels',
  'http/misconfiguration',
];

async function runNuclei(targetUrl, workDir) {
  const targetsFile = path.join(workDir, 'targets.txt');
  const outputFile = path.join(workDir, 'results.json');

  fs.writeFileSync(targetsFile, targetUrl.replace(/localhost/gi, '127.0.0.1'));

  const args = [
    '-l', targetsFile,
    '-json-export', outputFile,
    '-silent', '-no-color',
    '-rate-limit', '150',
    '-bulk-size', '50',
    '-concurrency', '50',
  ];

  for (const t of DISCOVERY_TEMPLATES) {
    args.push('-t', t);
  }
  args.push('-timeout', '300');

  console.log('Running Nuclei...');

  return new Promise((resolve, reject) => {
    const nuclei = spawn(NUCLEI_PATH, args, { cwd: workDir });

    nuclei.on('close', async (code) => {
      if (fs.existsSync(outputFile)) {
        const content = fs.readFileSync(outputFile, 'utf-8').trim();
        let findings = [];
        if (content.startsWith('[')) {
          findings = JSON.parse(content);
        } else if (content) {
          findings = content.split('\n').filter(Boolean).map(l => JSON.parse(l));
        }
        resolve({ code, findings });
      } else {
        resolve({ code, findings: [] });
      }
    });

    nuclei.on('error', reject);
  });
}

async function main() {
  const scanId = process.argv[2] || '3725da67-376c-4ef3-9255-9731ae502ec5';

  console.log('=== TRIGGERING SCAN EXECUTION ===\n');
  console.log('Scan ID:', scanId);

  // Get scan
  const scan = await prisma.penTestScan.findFirst({
    where: { id: scanId },
    include: { target: true }
  });

  if (!scan) {
    console.log('Scan not found');
    return;
  }

  console.log('Target:', scan.target.name, '-', scan.target.url);
  console.log('Scanners:', scan.scanners.join(', '));
  console.log('Status:', scan.status);

  // Update to running
  await prisma.penTestScan.update({
    where: { id: scanId },
    data: { status: 'running', startedAt: new Date() }
  });
  console.log('\nStatus updated to: running');

  // Create work dir
  const workDir = path.join(os.tmpdir(), `pentest-${scanId}`);
  fs.mkdirSync(workDir, { recursive: true });

  const startTime = Date.now();

  // Run nuclei
  const { code, findings } = await runNuclei(scan.target.url, workDir);

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`\nNuclei completed in ${duration}s with ${findings.length} findings`);

  // Save findings to DB
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  for (const f of findings) {
    const severity = f.info?.severity?.toLowerCase() || 'info';
    if (severity in severityCounts) severityCounts[severity]++;

    await prisma.penTestFinding.create({
      data: {
        scanId,
        tenantId: scan.tenantId,
        scanner: 'nuclei',
        ruleId: f['template-id'] || 'unknown',
        severity,
        confidence: 'medium',
        title: f.info?.name || 'Unknown',
        description: f.info?.description || `Template: ${f['template-id']}`,
        url: f.matched || scan.target.url,
        cweIds: f.info?.classification?.['cwe-id'] || [],
        cveIds: f.info?.classification?.['cve-id'] || [],
        owaspIds: [],
        references: f.info?.reference || [],
        fingerprint: `nuclei-${f['template-id']}-${f.host}`,
        metadata: { host: f.host, type: f.type }
      }
    });
  }

  // Update scan to completed
  await prisma.penTestScan.update({
    where: { id: scanId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      duration,
      findingsCount: findings.length,
      severityCounts
    }
  });

  console.log('\nScan completed!');
  console.log('Findings by severity:', severityCounts);
  console.log('\nView at: http://localhost:3000/dashboard/targets/' + scan.targetId + '/scans/' + scanId);

  // Cleanup
  fs.rmSync(workDir, { recursive: true, force: true });

  await prisma.$disconnect();
}

main().catch(console.error);
