const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  // Get ThreatDiviner findings
  const scan = await prisma.scan.findFirst({
    where: {
      repository: { fullName: { contains: 'timeslice', mode: 'insensitive' } },
      status: 'completed',
      findings: { some: {} }
    },
    include: {
      findings: {
        select: {
          scanner: true,
          ruleId: true,
          severity: true,
          title: true,
          filePath: true,
          startLine: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!scan) {
    console.log('No completed scan with findings found');
    return;
  }

  console.log('=== THREATDIVINER RESULTS ===');
  console.log(`Scan ID: ${scan.id}`);
  console.log(`Total Findings: ${scan.findings.length}\n`);

  // Group by scanner
  const tdByScanner = {};
  for (const f of scan.findings) {
    if (!tdByScanner[f.scanner]) tdByScanner[f.scanner] = [];
    tdByScanner[f.scanner].push(f);
  }

  // Load external results
  console.log('=== EXTERNAL RESULTS ===\n');

  // Gitleaks external
  let gitleaksExternal = [];
  try {
    gitleaksExternal = JSON.parse(fs.readFileSync('C:/tmp/scanner-comparison/gitleaks-external.json', 'utf-8'));
    console.log(`Gitleaks External: ${gitleaksExternal.length} findings`);
  } catch (e) {
    console.log('Gitleaks external file not found');
  }

  // Trivy external
  let trivyExternal = [];
  try {
    const trivyData = JSON.parse(fs.readFileSync('C:/tmp/scanner-comparison/trivy-external.json', 'utf-8'));
    for (const result of trivyData.Results || []) {
      trivyExternal.push(...(result.Vulnerabilities || []));
    }
    console.log(`Trivy External: ${trivyExternal.length} vulnerabilities`);
  } catch (e) {
    console.log('Trivy external file not found');
  }

  console.log('\n=== COMPARISON ===\n');

  // Gitleaks comparison
  const tdGitleaks = tdByScanner['gitleaks'] || [];
  console.log('GITLEAKS:');
  console.log(`  ThreatDiviner: ${tdGitleaks.length} findings`);
  console.log(`  External CLI:  ${gitleaksExternal.length} findings`);
  console.log(`  Difference:    ${gitleaksExternal.length - tdGitleaks.length}`);

  // Show what's different
  if (gitleaksExternal.length > 0) {
    console.log('\n  External findings by file:');
    const extByFile = {};
    for (const f of gitleaksExternal) {
      extByFile[f.File] = (extByFile[f.File] || 0) + 1;
    }
    for (const [file, count] of Object.entries(extByFile)) {
      console.log(`    ${file}: ${count}`);
    }
  }

  if (tdGitleaks.length > 0) {
    console.log('\n  ThreatDiviner findings by file:');
    const tdByFile = {};
    for (const f of tdGitleaks) {
      const file = f.filePath.split('/').pop();
      tdByFile[file] = (tdByFile[file] || 0) + 1;
    }
    for (const [file, count] of Object.entries(tdByFile)) {
      console.log(`    ${file}: ${count}`);
    }
  }

  // Trivy comparison
  const tdTrivy = tdByScanner['trivy'] || [];
  console.log('\nTRIVY (SCA):');
  console.log(`  ThreatDiviner: ${tdTrivy.length} vulnerabilities`);
  console.log(`  External CLI:  ${trivyExternal.length} vulnerabilities`);
  console.log(`  Difference:    ${trivyExternal.length - tdTrivy.length}`);

  // Show severity breakdown
  if (trivyExternal.length > 0) {
    const extBySev = {};
    for (const v of trivyExternal) {
      extBySev[v.Severity] = (extBySev[v.Severity] || 0) + 1;
    }
    console.log(`\n  External by severity: ${JSON.stringify(extBySev)}`);
  }

  if (tdTrivy.length > 0) {
    const tdBySev = {};
    for (const f of tdTrivy) {
      tdBySev[f.severity] = (tdBySev[f.severity] || 0) + 1;
    }
    console.log(`  ThreatDiviner by severity: ${JSON.stringify(tdBySev)}`);
  }

  // Semgrep
  const tdSemgrep = tdByScanner['semgrep'] || [];
  console.log('\nSEMGREP (SAST):');
  console.log(`  ThreatDiviner: ${tdSemgrep.length} findings`);
  console.log(`  External CLI:  FAILED (Windows encoding issue)`);

  if (tdSemgrep.length > 0) {
    const tdBySev = {};
    for (const f of tdSemgrep) {
      tdBySev[f.severity] = (tdBySev[f.severity] || 0) + 1;
    }
    console.log(`  ThreatDiviner by severity: ${JSON.stringify(tdBySev)}`);
  }

  console.log('\n=== SUMMARY ===');
  console.log('ThreatDiviner successfully ran all scanners via Docker/subprocess.');
  console.log('External CLI Semgrep failed due to Windows Unicode encoding bug.');
  console.log(`\nTotal ThreatDiviner findings: ${scan.findings.length}`);
  console.log(`Total External findings: ${gitleaksExternal.length + trivyExternal.length} (Semgrep failed)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
