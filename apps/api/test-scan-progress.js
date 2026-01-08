/**
 * Quick test to verify scan progress is emitted
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { io } = require('socket.io-client');

const API_URL = 'http://localhost:3001';
const TENANT_ID = '11111111-1111-1111-1111-111111111111';

async function main() {
  console.log('=== Scan Progress Test ===\n');

  // Get existing target
  const target = await prisma.penTestTarget.findFirst({
    where: { tenantId: TENANT_ID },
    orderBy: { createdAt: 'desc' },
  });

  if (!target) {
    console.log('No target found. Please create a target first through the UI.');
    return;
  }

  console.log('Found target:', target.name, '-', target.url);

  // Create a new scan
  const scan = await prisma.penTestScan.create({
    data: {
      targetId: target.id,
      tenantId: TENANT_ID,
      scanners: ['nuclei'],
      scanPhase: 'discovery',
      status: 'pending',
      config: {
        rateLimitPreset: 'high',
        timeout: 120000,
      },
    },
  });

  console.log('Created scan:', scan.id);

  // Connect to WebSocket and listen for progress
  const socket = io(`${API_URL}/scans`, {
    transports: ['websocket'],
  });

  let progressReceived = false;

  socket.on('connect', () => {
    console.log('WebSocket connected');
    socket.emit('subscribe', { scanId: scan.id });
  });

  socket.on('scanner:start', (data) => {
    console.log('Scanner started:', data);
  });

  socket.on('scanner:progress', (data) => {
    console.log('Progress received:', data);
    progressReceived = true;
  });

  socket.on('scanner:log', (data) => {
    console.log(`[${data.stream}] ${data.scanner}: ${data.line.substring(0, 80)}...`);
  });

  socket.on('scan:complete', (data) => {
    console.log('Scan complete:', data);
    console.log('\nProgress test result:', progressReceived ? '✅ PASSED' : '❌ FAILED - No progress events received');
    socket.disconnect();
    process.exit(progressReceived ? 0 : 1);
  });

  // Now trigger the scan via the queue
  // We need to import the queue service somehow
  // Instead, let's just update the scan status to trigger the processor

  // Actually the processor watches the queue, not the database
  // Let's manually trigger by calling the internal scan endpoint

  console.log('\nNote: Please trigger the scan from the UI to test progress');
  console.log('Or use curl to call the scan endpoint with proper auth');
  console.log('\nWaiting for events... (Ctrl+C to exit)');
}

main().catch(console.error).finally(() => {
  // Keep process alive to receive events
  // prisma.$disconnect();
});
