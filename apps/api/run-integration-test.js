/**
 * Integration test that runs a full scan and monitors via WebSocket
 */

const { PrismaClient } = require('@prisma/client');
const { io } = require('socket.io-client');

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001';
const TENANT_ID = '11111111-1111-1111-1111-111111111111';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runIntegrationTest() {
  console.log('========================================');
  console.log('  Integration Test - Scan + Progress');
  console.log('========================================\n');

  const results = {
    targetCreated: false,
    scanStarted: false,
    progressReceived: false,
    scanCompleted: false,
    findingsCreated: false,
    cancelWorks: false,
  };

  try {
    // 1. Get or create target
    console.log('[1/6] Finding or creating target...');
    let target = await prisma.penTestTarget.findFirst({
      where: { tenantId: TENANT_ID, name: 'integration-test' },
    });

    if (!target) {
      target = await prisma.penTestTarget.create({
        data: {
          tenantId: TENANT_ID,
          name: 'integration-test',
          url: 'http://127.0.0.1:3500',
          description: 'Integration test target',
          environment: 'development',
        },
      });
      console.log('   Created target:', target.id);
    } else {
      console.log('   Found existing target:', target.id);
    }
    results.targetCreated = true;

    // 2. Create scan
    console.log('[2/6] Creating scan...');
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

    // 3. Connect WebSocket
    console.log('[3/6] Connecting WebSocket...');
    const socket = io(`${API_URL}/scans`, {
      transports: ['websocket'],
      reconnection: false,
    });

    let progressEvents = [];
    let logEvents = [];
    let scanComplete = false;

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        console.log('   WebSocket connected');
        socket.emit('subscribe', { scanId: scan.id });
        resolve();
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Set up event handlers
    socket.on('scanner:start', (data) => {
      console.log('   [EVENT] Scanner started:', data.scanner);
      results.scanStarted = true;
    });

    socket.on('scanner:progress', (data) => {
      progressEvents.push(data);
      if (!results.progressReceived) {
        console.log('   [EVENT] First progress:', data.percent + '%');
        results.progressReceived = true;
      }
    });

    socket.on('scanner:log', (data) => {
      logEvents.push(data);
    });

    socket.on('scan:complete', (data) => {
      console.log('   [EVENT] Scan complete:', data.status, '-', data.totalFindings, 'findings');
      scanComplete = true;
      results.scanCompleted = true;
    });

    // 4. Queue the scan job
    console.log('[4/6] Queueing scan job...');
    // Import Queue from bullmq
    const { Queue } = require('bullmq');
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

    // 5. Wait for completion
    console.log('[5/6] Waiting for scan completion...');
    const startTime = Date.now();
    const maxWait = 120000; // 2 minutes

    while (!scanComplete && Date.now() - startTime < maxWait) {
      await sleep(1000);
      // Check DB status as backup
      const currentScan = await prisma.penTestScan.findUnique({
        where: { id: scan.id },
      });
      if (currentScan.status === 'completed' || currentScan.status === 'failed' || currentScan.status === 'cancelled') {
        console.log('   DB status:', currentScan.status);
        scanComplete = true;
        results.scanCompleted = true;
        break;
      }
    }

    // 6. Check findings
    console.log('[6/6] Checking findings...');
    const findings = await prisma.penTestFinding.count({
      where: { scanId: scan.id },
    });
    console.log('   Findings count:', findings);
    results.findingsCreated = findings > 0;

    // Disconnect
    socket.disconnect();
    await targetScanQueue.close();

    // Summary
    console.log('\n========================================');
    console.log('  Test Results');
    console.log('========================================');
    console.log(`Target created/found:  ${results.targetCreated ? '✅' : '❌'}`);
    console.log(`Scan started:          ${results.scanStarted ? '✅' : '❌'}`);
    console.log(`Progress received:     ${results.progressReceived ? '✅' : '❌'}`);
    console.log(`Scan completed:        ${results.scanCompleted ? '✅' : '❌'}`);
    console.log(`Findings created:      ${results.findingsCreated ? '✅' : '❌'}`);
    console.log('');
    console.log(`Progress events: ${progressEvents.length}`);
    console.log(`Log events: ${logEvents.length}`);
    console.log('========================================\n');

    const passed = Object.values(results).every(v => v);
    return passed;

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

runIntegrationTest().then(passed => {
  process.exit(passed ? 0 : 1);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
