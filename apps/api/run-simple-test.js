/**
 * Simple integration test - directly queues a job and monitors DB
 */

const { PrismaClient } = require('@prisma/client');
const { Queue } = require('bullmq');

const prisma = new PrismaClient();
const TENANT_ID = '11111111-1111-1111-1111-111111111111';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('========================================');
  console.log('  Simple Integration Test');
  console.log('========================================\n');

  try {
    // 1. Get or create target
    console.log('[1/4] Finding or creating target...');
    let target = await prisma.penTestTarget.findFirst({
      where: { tenantId: TENANT_ID, name: 'simple-test' },
    });

    if (!target) {
      target = await prisma.penTestTarget.create({
        data: {
          tenantId: TENANT_ID,
          name: 'simple-test',
          url: 'http://127.0.0.1:3500',
          description: 'Simple test target',
        },
      });
      console.log('   Created target:', target.id);
    } else {
      console.log('   Found existing target:', target.id);
    }

    // 2. Create scan
    console.log('[2/4] Creating scan...');
    const scan = await prisma.penTestScan.create({
      data: {
        targetId: target.id,
        tenantId: TENANT_ID,
        scanners: ['nuclei'],
        scanPhase: 'discovery',
        status: 'queued',
        config: {
          rateLimitPreset: 'high',
          timeout: 120000,
        },
      },
    });
    console.log('   Created scan:', scan.id);

    // 3. Queue the scan job
    console.log('[3/4] Queueing scan job...');
    const targetScanQueue = new Queue('target-scan-jobs', {
      connection: { host: 'localhost', port: 6379 },
    });

    await targetScanQueue.add('process-target-scan', {
      scanId: scan.id,
      tenantId: TENANT_ID,
      targetId: target.id,
      targetUrl: target.url,
      targetName: target.name,
      scanners: ['nuclei'],
      scanPhase: 'discovery',
      config: {
        rateLimitPreset: 'high',
        timeout: 120000,
      },
    }, {
      jobId: `target-scan-${scan.id}`,
    });
    console.log('   Job queued');

    // 4. Wait for completion (poll DB)
    console.log('[4/4] Waiting for scan completion...');
    const startTime = Date.now();
    const maxWait = 120000; // 2 minutes
    let lastStatus = '';

    while (Date.now() - startTime < maxWait) {
      const currentScan = await prisma.penTestScan.findUnique({
        where: { id: scan.id },
      });

      if (currentScan.status !== lastStatus) {
        console.log(`   Status: ${currentScan.status}`);
        lastStatus = currentScan.status;
      }

      if (currentScan.status === 'completed' || currentScan.status === 'failed' || currentScan.status === 'cancelled') {
        // Get findings
        const findings = await prisma.penTestFinding.count({
          where: { scanId: scan.id },
        });

        console.log('\n========================================');
        console.log('  Test Results');
        console.log('========================================');
        console.log(`Status:    ${currentScan.status}`);
        console.log(`Duration:  ${currentScan.duration}s`);
        console.log(`Findings:  ${findings}`);
        console.log('========================================\n');

        await targetScanQueue.close();
        return currentScan.status === 'completed';
      }

      await sleep(2000);
    }

    console.log('❌ Timeout waiting for scan');
    await targetScanQueue.close();
    return false;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

runTest().then(passed => {
  console.log(passed ? '✅ TEST PASSED' : '❌ TEST FAILED');
  process.exit(passed ? 0 : 1);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
