const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get the scan with 219 findings
  const scan = await prisma.scan.findUnique({
    where: { id: '100833a3-2db4-4768-a8fd-8ac9599e231f' },
    include: {
      findings: true,
      scannerResults: true
    }
  });

  console.log('=== SCAN WITH FINDINGS (100833a3) ===');
  console.log('Status:', scan.status);
  console.log('Scanners:', scan.scanners);
  console.log('Findings:', scan.findings.length);

  console.log('\n=== SCANNER RESULTS ===');
  for (const result of scan.scannerResults) {
    console.log('\n--- ' + result.scanner + ' ---');
    console.log('Status:', result.status);
    console.log('Error:', result.error || 'none');
    console.log('Findings:', result.findingsCount);
    console.log('Duration:', result.duration, 'ms');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
