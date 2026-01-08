// Test Nuclei scan via API - bypassing auth for timing test
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== NUCLEI API TIMING TEST ===\n');

  // Get target
  const target = await prisma.penTestTarget.findFirst({
    where: { url: { contains: '127.0.0.1:3500' } }
  });

  if (!target) {
    console.log('No target found');
    return;
  }

  console.log(`Target: ${target.name} (${target.url})`);
  console.log(`Target ID: ${target.id}`);

  // Create scan record
  const scan = await prisma.penTestScan.create({
    data: {
      tenantId: target.tenantId,
      targetId: target.id,
      scanners: ['nuclei'],
      status: 'queued',
      config: {
        scanMode: 'discovery',
        targetUrls: [target.url]
      }
    }
  });

  console.log(`\nCreated scan: ${scan.id}`);
  console.log(`Status: ${scan.status}`);
  console.log(`Scanners: ${scan.scanners.join(', ')}`);

  // Now trigger the scan processor directly via HTTP
  const startTime = Date.now();
  console.log(`\nStarting scan at ${new Date().toISOString()}...`);

  // Update scan to running
  await prisma.penTestScan.update({
    where: { id: scan.id },
    data: { status: 'running', startedAt: new Date() }
  });

  console.log('\nScan created and queued. Check API logs for scan progress.');
  console.log('Scan ID:', scan.id);
  console.log('\nYou can monitor with:');
  console.log(`  curl http://localhost:3001/pentest/scans/${scan.id}`);

  await prisma.$disconnect();
}

main().catch(console.error);
