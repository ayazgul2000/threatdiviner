const r = require('./src/vulndb/bridge/icon-registry.json');
const l = require('./src/vulndb/bridge/layer1-category-defaults.json');
const results = [];
for (const [k, v] of Object.entries(r)) {
  const mapped = v.types.filter(t => l[t]);
  if (mapped.length >= 2) {
    results.push({ icon: k, types: mapped });
  }
}
console.log(`${results.length} icons with 2+ mapped types:`);
results.slice(0, 10).forEach(r => console.log(`  ${r.icon} => ${r.types.join(', ')}`));
