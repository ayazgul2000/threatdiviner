/**
 * Test Scan Flow with Authentication
 * Tests Katana → Nuclei → SSLyze flow
 */

const API_URL = 'http://localhost:3001';
const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const TEST_TARGET_URL = 'http://testphp.vulnweb.com';

let authCookies = '';

async function login() {
  console.log('Logging in...');
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant: 'dev-tenant',
      email: 'admin@threatdiviner.local',
      password: 'admin123',
    }),
  });

  if (!res.ok) {
    // Try creating the user if login fails
    console.log('Login failed, trying with test credentials...');
    return false;
  }

  // Get cookies from response
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    authCookies = setCookie.split(';')[0];
  }

  console.log('Login successful');
  return true;
}

async function apiCall(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': TENANT_ID,
      'Cookie': authCookies,
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

async function createTestTarget() {
  console.log('\n=== Creating Test Target ===');

  // Check if target exists
  const listRes = await apiCall('GET', '/pentest/targets');
  if (listRes.ok) {
    const existing = listRes.data.find(t => t.url === TEST_TARGET_URL);
    if (existing) {
      console.log('Target already exists:', existing.id);
      return existing;
    }
  }

  const createRes = await apiCall('POST', '/pentest/targets', {
    name: 'VulnWeb Test',
    url: TEST_TARGET_URL,
    type: 'WEB_APP',
    description: 'Acunetix vulnerable test site',
  });

  if (createRes.ok) {
    console.log('Created target:', createRes.data.id);
    return createRes.data;
  } else {
    console.log('Failed to create target:', createRes.data);
    return null;
  }
}

async function runQuickScan(targetId) {
  console.log('\n=== Running Quick Scan ===');
  console.log('Target:', targetId);
  console.log('Scanners: Katana → Nuclei → SSLyze');

  const startTime = Date.now();

  const scanRes = await apiCall('POST', `/pentest/targets/${targetId}/scan`, {
    scanMode: 'quick',
  });

  if (!scanRes.ok) {
    console.log('Failed to start scan:', scanRes.data);
    return null;
  }

  const scanId = scanRes.data.id;
  console.log('Scan started:', scanId);

  // Poll for completion
  let attempts = 0;
  const maxAttempts = 120;

  while (attempts < maxAttempts) {
    const statusRes = await apiCall('GET', `/pentest/scans/${scanId}`);

    if (!statusRes.ok) {
      console.log('Failed to get status');
      break;
    }

    const scan = statusRes.data;

    if (attempts % 5 === 0) {
      console.log(`  Status: ${scan.status} | Elapsed: ${Math.floor((Date.now() - startTime) / 1000)}s`);
    }

    if (scan.status === 'completed') {
      console.log('\n✓ Scan completed!');
      return scan;
    }

    if (scan.status === 'failed') {
      console.log('\n✗ Scan failed:', scan.errorMessage);
      return scan;
    }

    await new Promise(r => setTimeout(r, 2000));
    attempts++;
  }

  console.log('Scan timed out');
  return null;
}

function analyzeScanResults(scan) {
  console.log('\n=== Scan Results ===');
  console.log(`Status: ${scan.status}`);
  console.log(`Duration: ${scan.duration || 'N/A'}`);
  console.log(`Total Findings: ${scan.findingsCount || scan.findings?.length || 0}`);

  if (scan.scannerResults) {
    console.log('\nScanner Results:');
    for (const [name, result] of Object.entries(scan.scannerResults)) {
      console.log(`  ${name}: ${result.findingsCount || 0} findings`);
    }
  }

  // Check discovered URLs (from Katana)
  if (scan.discoveredUrls) {
    console.log(`\nDiscovered URLs: ${scan.discoveredUrls.length}`);
    if (scan.discoveredUrls.length > 0) {
      console.log('Sample:');
      scan.discoveredUrls.slice(0, 5).forEach(u => console.log(`  - ${u}`));
    }
  }

  // Validation
  console.log('\n=== Validation ===');
  const issues = [];

  if (!scan.discoveredUrls || scan.discoveredUrls.length === 0) {
    issues.push('Katana did not discover URLs');
  }

  if (scan.status !== 'completed') {
    issues.push(`Scan status is ${scan.status}, not completed`);
  }

  if (issues.length === 0) {
    console.log('✓ All checks passed!');
  } else {
    console.log('✗ Issues:');
    issues.forEach(i => console.log(`  - ${i}`));
  }
}

async function main() {
  console.log('========================================');
  console.log('  Quick Scan Flow Test');
  console.log('  Katana → Nuclei → SSLyze');
  console.log('========================================');

  // Try without auth first (using x-tenant-id)
  const target = await createTestTarget();

  if (!target) {
    // If auth required, try to login
    const loggedIn = await login();
    if (!loggedIn) {
      console.log('\nAuth required but login failed. Skipping auth tests.');
      console.log('Running CLI-only tests instead...');
      await testKatanaCli();
      return;
    }

    // Retry with auth
    const target2 = await createTestTarget();
    if (!target2) {
      console.log('Still failed to create target');
      return;
    }
    const scan = await runQuickScan(target2.id);
    if (scan) analyzeScanResults(scan);
    return;
  }

  const scan = await runQuickScan(target.id);
  if (scan) analyzeScanResults(scan);
}

async function testKatanaCli() {
  console.log('\n=== CLI-Only Katana Test ===');
  const { execSync } = require('child_process');

  try {
    const katanaPath = 'C:/Users/ayazg/go/bin/katana.exe';
    const result = execSync(`${katanaPath} -u ${TEST_TARGET_URL} -d 2 -silent -nc`, {
      encoding: 'utf-8',
      timeout: 60000,
    });

    const urls = result.trim().split('\n').filter(l => l.startsWith('http'));
    console.log(`Katana discovered ${urls.length} URLs`);
    console.log('Sample:');
    urls.slice(0, 10).forEach(u => console.log(`  ${u}`));

    // Extract params
    const urlsWithParams = urls.filter(u => u.includes('?'));
    console.log(`\nURLs with parameters: ${urlsWithParams.length}`);
    urlsWithParams.slice(0, 5).forEach(u => console.log(`  ${u}`));

    console.log('\n✓ Katana CLI test passed');
  } catch (err) {
    console.log('Katana CLI test failed:', err.message);
  }
}

main().catch(console.error);
