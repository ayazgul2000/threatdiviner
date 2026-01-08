const API_URL = 'http://localhost:3001';
const TARGET_URL = 'http://127.0.0.1:3500';

async function run() {
  // Login
  console.log('Logging in...');
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

  const cookie = loginRes.headers.get('set-cookie').split(';')[0];
  console.log('Login OK');

  // Create target
  console.log('Creating Juice Shop target...');
  const targetRes = await fetch(API_URL + '/pentest/targets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      name: 'Juice Shop',
      url: TARGET_URL,
      type: 'web_application',
      description: 'OWASP Juice Shop'
    })
  });

  let targetId;
  if (!targetRes.ok) {
    // Check if exists
    const listRes = await fetch(API_URL + '/pentest/targets', { headers: { 'Cookie': cookie } });
    const targets = await listRes.json();
    const existing = targets.find(t => t.url === TARGET_URL);
    if (existing) {
      targetId = existing.id;
      console.log('Target exists:', targetId);
    } else {
      console.log('Failed:', await targetRes.text());
      return;
    }
  } else {
    const target = await targetRes.json();
    targetId = target.id;
    console.log('Created:', targetId);
  }

  // Start katana-only scan
  console.log('Starting Katana scan...');
  const scanRes = await fetch(API_URL + '/pentest/scans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      targetId: targetId,
      scanners: ['katana']
    })
  });

  if (!scanRes.ok) {
    console.log('Scan failed:', await scanRes.text());
    return;
  }

  const scan = await scanRes.json();
  console.log('Scan started:', scan.id);
  console.log('Polling every 3 seconds...\n');

  // Poll
  const startTime = Date.now();
  let lastStatus = '';

  while (Date.now() - startTime < 300000) {
    const statusRes = await fetch(API_URL + '/pentest/scans/' + scan.id, {
      headers: { 'Cookie': cookie }
    });

    const data = await statusRes.json();
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (data.status !== lastStatus || elapsed % 10 === 0) {
      console.log(`[${elapsed}s] Status: ${data.status} | Findings: ${data.findings?.length || 0}`);

      if (data.discoveredUrls && data.discoveredUrls.length > 0) {
        console.log(`       URLs discovered: ${data.discoveredUrls.length}`);
      }

      lastStatus = data.status;
    }

    if (['completed', 'failed', 'cancelled'].includes(data.status)) {
      console.log('\n=== RESULT ===');
      console.log('Status:', data.status);
      console.log('Duration:', elapsed, 'seconds');

      if (data.discoveredUrls) {
        console.log('URLs discovered:', data.discoveredUrls.length);
        console.log('\nSample URLs:');
        data.discoveredUrls.slice(0, 20).forEach(u => console.log('  ' + u));
      }
      return;
    }

    await new Promise(r => setTimeout(r, 3000));
  }
}

run().catch(console.error);
