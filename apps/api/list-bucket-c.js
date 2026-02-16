const registry = require('./src/vulndb/bridge/icon-registry.json');
const layer1 = require('./src/vulndb/bridge/layer1-category-defaults.json');

// Bucket A aliases (types that will be mapped to existing)
const bucketA = new Set([
  'server', 'virtualization', 'runtime', 'baremetal', 'infra',
  'monitor', 'alerting',
  'connectivity', 'routing', 'nfv',
  'deployment',
  'containerservices', 'controlplane', 'clusterconfig', 'podconfig', 'packaging', 'orchestration',
  'chat', 'communication',
  'enterprisesearch', 'elasticsearch',
  'migrate', 'migration',
  'filesharing',
  'mlops', 'recommendation',
  'apiproxies',
  'cli', 'desktop',
  'frontend',
  'automation'
]);

// Bucket B new entries
const bucketB = new Set([
  'application', 'applications', 'appservices',
  'management', 'managementgovernance',
  'governance',
  'data',
  'media',
  'cdn',
  'os',
  'user', 'organization',
  'payment', 'billing', 'cost',
  'device',
  'framework',
  'language'
]);

// Find all unmapped types not in A or B = Bucket C
const unmappedTypes = new Set();
for (const entry of Object.values(registry)) {
  for (const t of entry.types) {
    if (!layer1[t] && !bucketA.has(t) && !bucketB.has(t)) {
      unmappedTypes.add(t);
    }
  }
}

// For each Bucket C type, list all icons
const sorted = Array.from(unmappedTypes).sort();
for (const type of sorted) {
  const icons = [];
  for (const [icon, entry] of Object.entries(registry)) {
    if (entry.types.includes(type)) {
      // Check if this icon has ANY mapped type (from layer1, bucketA, or bucketB)
      const hasMapped = entry.types.some(t => layer1[t] || bucketA.has(t) || bucketB.has(t));
      icons.push({ name: icon, otherTypes: entry.types.filter(t => t !== type), hasMapped });
    }
  }
  console.log(`\n${type} (${icons.length} icons):`);
  icons.forEach(i => {
    const mapped = i.hasMapped ? '' : ' [ONLY TYPE]';
    const others = i.otherTypes.length > 0 ? ` (also: ${i.otherTypes.join(', ')})` : '';
    console.log(`  ${i.name}${others}${mapped}`);
  });
}
