const http = require('http');

async function fetch(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:3001${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
  });
}

async function login() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email: 'admin@acme.com', password: 'admin123', tenantSlug: 'acme-corp' });
    const req = http.request('http://localhost:3001/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length }
    }, (res) => {
      const cookies = res.headers['set-cookie'] || [];
      const tokenCookie = cookies.find(c => c.startsWith('accessToken='));
      const token = tokenCookie ? tokenCookie.split('=')[1].split(';')[0] : null;
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(token));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  const token = await login();
  console.log('Token obtained.\n');

  // Test stats
  const stats = await fetch('/vulndb/bridge/stats', token);
  console.log('=== STATS ===');
  console.log(`Total icons: ${stats.totalIcons}`);
  console.log(`Multi-type icons: ${stats.multiTypeIcons}`);
  console.log(`Mapped icons: ${stats.mappedIcons} / ${stats.totalIcons} (${(100 * stats.mappedIcons / stats.totalIcons).toFixed(1)}%)`);
  console.log(`Unmapped icons: ${stats.unmappedIcons}`);
  console.log(`Mapped types: ${stats.mappedTypes.length} / ${stats.uniqueTypes.length}`);
  console.log(`Unmapped types (${stats.unmappedTypes.length}): ${stats.unmappedTypes.join(', ')}`);

  // Test multi-type icon
  console.log('\n=== MULTI-TYPE: api-gateway (api + devops + mobile + network) ===');
  const gw = await fetch('/vulndb/bridge/resolve/api-gateway', token);
  console.log(`Categories: ${gw.categories.join(', ')}`);
  console.log(`Total CWEs (union): ${gw.count}`);
  console.log(`Layer 1 by type:`, gw.layers.layer1ByType);

  // Test single-type with Layer 2+3
  console.log('\n=== SINGLE-TYPE + LAYER 2+3: mongodb ===');
  const mongo = await fetch('/vulndb/bridge/resolve/mongodb', token);
  console.log(`Categories: ${mongo.categories.join(', ')}`);
  console.log(`Subcategory: ${mongo.subcategory}`);
  console.log(`Total CWEs: ${mongo.count}`);
  console.log(`Layer 1: ${mongo.layers.layer1Count}, L2 excluded: ${mongo.layers.layer2Excluded.length}, L3 excluded: ${mongo.layers.layer3Excluded.length}, L3 added: ${mongo.layers.layer3Added.length}`);

  // Test app-services (compute + containers + mobile + web)
  console.log('\n=== MULTI-TYPE: app-services (compute + containers + mobile + web) ===');
  const app = await fetch('/vulndb/bridge/resolve/app-services', token);
  console.log(`Categories: ${app.categories.join(', ')}`);
  console.log(`Total CWEs (union): ${app.count}`);
  console.log(`Layer 1 by type:`, app.layers.layer1ByType);

  // Test unknown icon
  console.log('\n=== UNKNOWN ICON: foobar ===');
  const unknown = await fetch('/vulndb/bridge/resolve/foobar', token);
  console.log(`Categories: ${unknown.categories.length}`);
  console.log(`CWEs: ${unknown.count}`);
}

run().catch(console.error);
