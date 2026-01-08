/**
 * Test Full API Flow with Correct Auth
 */

const API_URL = 'http://localhost:3001';

async function test() {
  // Login with correct credentials
  console.log('1. Logging in...');
  const loginRes = await fetch(API_URL + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantSlug: 'acme-corp',
      email: 'admin@acme.com',
      password: 'admin123'
    })
  });

  if (!loginRes.ok) {
    console.log('Login failed:', await loginRes.text());
    return;
  }

  const cookies = loginRes.headers.get('set-cookie');
  const cookie = cookies.split(';')[0];
  console.log('   Login OK');

  // Create target
  console.log('2. Creating target...');
  const targetRes = await fetch(API_URL + '/pentest/targets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    },
    body: JSON.stringify({
      name: 'VulnWeb API Test',
      url: 'http://testphp.vulnweb.com',
      type: 'web_application',
      description: 'Acunetix test site'
    })
  });

  if (!targetRes.ok) {
    // Maybe already exists, try to list
    const listRes = await fetch(API_URL + '/pentest/targets', {
      headers: { 'Cookie': cookie }
    });
    const targets = await listRes.json();
    const existing = targets.find(t => t.url === 'http://testphp.vulnweb.com');
    if (existing) {
      console.log('   Target exists:', existing.id);
      await runScan(existing.id, cookie);
      return;
    }
    console.log('   Create failed:', await targetRes.text());
    return;
  }

  const target = await targetRes.json();
  console.log('   Created:', target.id);

  await runScan(target.id, cookie);
}

async function runScan(targetId, cookie) {
  // Start quick scan (Katana → Nuclei)
  console.log('3. Starting quick scan...');
  const scanRes = await fetch(API_URL + '/pentest/scans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    },
    body: JSON.stringify({
      targetId: targetId,
      scanners: ['katana', 'nuclei']
    })
  });

  if (!scanRes.ok) {
    console.log('   Scan failed:', await scanRes.text());
    return;
  }

  const scan = await scanRes.json();
  console.log('   Scan started:', scan.id);

  // Poll for completion
  console.log('4. Polling for completion...');
  const startTime = Date.now();
  let lastStatus = '';

  while (Date.now() - startTime < 300000) { // 5 min timeout
    const statusRes = await fetch(API_URL + '/pentest/scans/' + scan.id, {
      headers: { 'Cookie': cookie }
    });

    const scanData = await statusRes.json();

    if (scanData.status !== lastStatus) {
      console.log('   Status:', scanData.status, '| Findings:', scanData.findings?.length || 0);
      lastStatus = scanData.status;
    }

    if (['completed', 'failed', 'cancelled'].includes(scanData.status)) {
      console.log('\n=== RESULT ===');
      console.log('Status:', scanData.status);
      console.log('Duration:', Math.round((Date.now() - startTime) / 1000), 'seconds');
      console.log('Findings:', scanData.findings?.length || 0);

      if (scanData.status === 'completed') {
        console.log('\n✓ API SCAN TEST PASSED');
      } else {
        console.log('\n✗ Scan ended with status:', scanData.status);
      }
      return;
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('Timeout waiting for scan');
}

test().catch(console.error);
