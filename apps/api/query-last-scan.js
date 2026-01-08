const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get the most recent repo scan with all details
  const scan = await prisma.scan.findFirst({
    where: { repositoryId: 'dc74b41f-1fe3-4477-be7e-24e43d4204d9' },
    orderBy: { createdAt: 'desc' },
    include: {
      findings: true,
      scannerResults: true
    }
  });

  console.log('=== LAST REPO SCAN DETAILS ===');
  console.log('ID:', scan.id);
  console.log('Status:', scan.status);
  console.log('Error:', scan.error || 'none');
  console.log('Scanners:', scan.scanners);
  console.log('Findings:', scan.findings.length);

  console.log('\n=== SCANNER RESULTS ===');
  for (const result of scan.scannerResults) {
    console.log('\n--- ' + result.scanner + ' ---');
    console.log('Status:', result.status);
    console.log('Error:', result.error || 'none');
    console.log('Duration:', result.duration, 'ms');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
