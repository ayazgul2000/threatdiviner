/**
 * Test script for ZAP Singleton Container
 * Tests the new singleton container approach that keeps ZAP warm between scans
 */

const API_URL = 'http://localhost:3001';
const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const TEST_TARGET_URL = 'http://127.0.0.1:3500'; // Juice Shop
const TEST_TARGET_NAME = 'test-zap-singleton';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiCall(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': TENANT_ID,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, options);
  const text = await response.text();

  try {
    return { status: response.status, data: JSON.parse(text), ok: response.ok };
  } catch {
    return { status: response.status, data: text, ok: response.ok };
  }
}

async function getOrCreateTarget() {
  console.log('Getting or creating test target...');

  const listResult = await apiCall('GET', '/pentest/targets');
  if (!listResult.ok) {
    console.log('Failed to list targets:', listResult.data);
    return null;
  }

  let target = listResult.data.find(t => t.name === TEST_TARGET_NAME);
  if (target) {
    console.log('Found existing target:', target.id);
    return target;
  }

  const createResult = await apiCall('POST', '/pentest/targets', {
    name: TEST_TARGET_NAME,
    url: TEST_TARGET_URL,
    description: 'ZAP singleton test target',
  });

  if (createResult.ok) {
    console.log('Created target:', createResult.data.id);
    return createResult.data;
  }

  console.log('Failed to create target:', createResult.data);
  return null;
}

async function startZapScan(targetId) {
  console.log('\nStarting ZAP scan...');

  const result = await apiCall('POST', '/pentest/scans', {
    targetId,
    scanners: ['zap'],
    config: {
      rateLimitPreset: 'medium',
      timeout: 300000,
      dastScanMode: 'baseline', // Quick baseline scan
    },
  });

  if (result.ok) {
    console.log('Scan started:', result.data.id);
    return result.data;
  }

  console.log('Failed to start scan:', result.data);
  return null;
}

async function waitForScan(scanId, maxSeconds = 300) {
  console.log('Waiting for scan to complete...');

  let lastStatus = '';

  for (let i = 0; i < maxSeconds; i++) {
    const result = await apiCall('GET', `/pentest/scans/${scanId}`);

    if (!result.ok) {
      console.log('Failed to get scan status');
      return null;
    }

    const scan = result.data;

    if (scan.status !== lastStatus) {
      console.log(`  Status: ${scan.status}`);
      lastStatus = scan.status;
    }

    if (scan.status === 'completed') {
      return scan;
    }

    if (scan.status === 'failed') {
      console.log('  Error:', scan.errorMessage);
      return null;
    }

    await sleep(1000);
  }

  console.log('Timeout waiting for scan');
  return null;
}

async function checkDockerContainer() {
  const { execSync } = require('child_process');

  console.log('\nChecking Docker container status...');

  try {
    const result = execSync('docker ps --filter "name=zap-threatdiviner" --format "{{.Names}}: {{.Status}}"', {
      encoding: 'utf-8',
      timeout: 10000,
    });

    if (result.trim()) {
      console.log('  Container:', result.trim());
      return true;
    } else {
      console.log('  No zap-threatdiviner container found');
      return false;
    }
  } catch (e) {
    console.log('  Docker check failed:', e.message);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('  ZAP Singleton Container Test');
  console.log('========================================\n');

  // 1. Get or create target
  const target = await getOrCreateTarget();
  if (!target) {
    process.exit(1);
  }

  // 2. Start first ZAP scan
  console.log('\n--- Test 1: First ZAP Scan (cold start) ---');
  const start1 = Date.now();
  const scan1 = await startZapScan(target.id);
  if (!scan1) {
    process.exit(1);
  }

  const result1 = await waitForScan(scan1.id);
  const duration1 = (Date.now() - start1) / 1000;

  if (result1) {
    console.log(`\nFirst scan completed in ${duration1.toFixed(1)}s`);
    console.log(`  Findings: ${result1.findingsCount || 0}`);
  } else {
    console.log('\nFirst scan failed');
    await checkDockerContainer();
    process.exit(1);
  }

  // Check if container is still running
  await checkDockerContainer();

  // 3. Start second ZAP scan (should reuse warm container)
  console.log('\n--- Test 2: Second ZAP Scan (warm container) ---');
  const start2 = Date.now();
  const scan2 = await startZapScan(target.id);
  if (!scan2) {
    process.exit(1);
  }

  const result2 = await waitForScan(scan2.id);
  const duration2 = (Date.now() - start2) / 1000;

  if (result2) {
    console.log(`\nSecond scan completed in ${duration2.toFixed(1)}s`);
    console.log(`  Findings: ${result2.findingsCount || 0}`);

    // Compare durations
    const improvement = ((duration1 - duration2) / duration1 * 100).toFixed(0);
    console.log(`\n  Warm start improvement: ${improvement}% faster`);
  } else {
    console.log('\nSecond scan failed');
    await checkDockerContainer();
    process.exit(1);
  }

  // Final container check
  await checkDockerContainer();

  console.log('\n========================================');
  console.log('  Test Complete');
  console.log('========================================');
  console.log('Container stays warm for next scan');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
