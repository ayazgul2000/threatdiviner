const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find timeslice repository
  const repos = await prisma.repository.findMany({
    where: { fullName: { contains: 'timeslice', mode: 'insensitive' } },
    select: {
      id: true,
      fullName: true,
      scans: {
        select: {
          id: true,
          status: true,
          branch: true,
          createdAt: true,
          findings: {
            select: {
              id: true,
              scanner: true,
              severity: true,
              title: true,
              ruleId: true,
              filePath: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  });

  if (repos.length === 0) {
    console.log('No timeslice repository found');
    return;
  }

  for (const repo of repos) {
    console.log(`\n=== Repository: ${repo.fullName} ===`);
    console.log(`ID: ${repo.id}`);
    console.log(`Scans: ${repo.scans.length}`);

    for (const scan of repo.scans) {
      console.log(`\n--- Scan ${scan.id} (${scan.status}) ---`);
      console.log(`Branch: ${scan.branch}`);
      console.log(`Date: ${scan.createdAt}`);
      console.log(`Findings: ${scan.findings.length}`);

      // Group findings by scanner
      const byScanner = {};
      for (const f of scan.findings) {
        if (!byScanner[f.scanner]) byScanner[f.scanner] = [];
        byScanner[f.scanner].push(f);
      }

      for (const [scanner, findings] of Object.entries(byScanner)) {
        console.log(`  ${scanner}: ${findings.length} findings`);
        const bySeverity = {};
        for (const f of findings) {
          bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
        }
        console.log(`    Severity: ${JSON.stringify(bySeverity)}`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
