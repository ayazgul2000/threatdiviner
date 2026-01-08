/**
 * Test Quick Scan Flow: Katana → Nuclei → SSLyze
 * Validates scanner output and data flow between scanners
 */

const http = require('http');

const API_BASE = 'http://localhost:3001';
const TEST_TARGET_URL = 'http://testphp.vulnweb.com';
const TENANT_ID = '11111111-1111-1111-1111-111111111111';

// Helper to make HTTP requests
function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Poll for scan completion
async function waitForScan(scanId, maxWait = 300000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const res = await request('GET', `/pentest/scans/${scanId}`);
    if (res.status !== 200) {
      console.log('Error fetching scan:', res.data);
      break;
    }

    const scan = res.data;
    console.log(`  Status: ${scan.status} | Findings: ${scan.findings?.length || 0}`);

    if (['completed', 'failed', 'cancelled'].includes(scan.status)) {
      return scan;
    }

    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('Scan timed out');
}

async function main() {
  console.log('=== Quick Scan Test ===\n');

  // Step 1: Create or find test target
  console.log('1. Finding/creating test target...');
  let target;

  const targetsRes = await request('GET', '/pentest/targets');
  if (targetsRes.status === 200) {
    target = targetsRes.data.find(t => t.url === TEST_TARGET_URL);
  }

  if (!target) {
    const createRes = await request('POST', '/pentest/targets', {
      name: 'Test Target - Vulnweb',
      url: TEST_TARGET_URL,
      type: 'WEB_APP',
      description: 'Acunetix test site for scanner validation',
    });

    if (createRes.status !== 201) {
      console.log('Failed to create target:', createRes.data);
      return;
    }
    target = createRes.data;
    console.log(`  Created target: ${target.id}`);
  } else {
    console.log(`  Found existing target: ${target.id}`);
  }

  // Step 2: Start quick scan
  console.log('\n2. Starting quick scan...');
  const startTime = Date.now();

  const scanRes = await request('POST', `/pentest/targets/${target.id}/scan`, {
    scanMode: 'quick',
  });

  if (scanRes.status !== 201 && scanRes.status !== 200) {
    console.log('Failed to start scan:', scanRes.data);
    return;
  }

  const scanId = scanRes.data.id || scanRes.data.scanId;
  console.log(`  Scan started: ${scanId}`);

  // Step 3: Wait for completion
  console.log('\n3. Waiting for scan completion...');
  const finalScan = await waitForScan(scanId);

  const duration = Date.now() - startTime;
  console.log(`\n=== Results ===`);
  console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
  console.log(`Status: ${finalScan.status}`);
  console.log(`Total Findings: ${finalScan.findings?.length || 0}`);

  // Step 4: Analyze scanner results
  if (finalScan.scannerResults) {
    console.log('\nScanner Results:');
    for (const [scanner, result] of Object.entries(finalScan.scannerResults)) {
      console.log(`  ${scanner}: ${result.findingsCount || 0} findings, ${result.duration || 0}ms`);
    }
  }

  // Step 5: Check for discovered URLs (from Katana)
  if (finalScan.discoveredUrls) {
    console.log(`\nDiscovered URLs: ${finalScan.discoveredUrls.length}`);
    console.log('Sample URLs:');
    finalScan.discoveredUrls.slice(0, 5).forEach(url => console.log(`  - ${url}`));
  }

  // Step 6: Validate data flow
  console.log('\n=== Validation ===');
  const issues = [];

  if (!finalScan.discoveredUrls || finalScan.discoveredUrls.length === 0) {
    issues.push('Katana did not discover any URLs');
  }

  if (finalScan.status !== 'completed') {
    issues.push(`Scan did not complete successfully (status: ${finalScan.status})`);
  }

  if (issues.length === 0) {
    console.log('✓ All validations passed');
  } else {
    console.log('✗ Issues found:');
    issues.forEach(i => console.log(`  - ${i}`));
  }
}

main().catch(console.error);
