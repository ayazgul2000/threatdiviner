const registry = require('./src/vulndb/bridge/icon-registry.json');
const layer1 = require('./src/vulndb/bridge/layer1-category-defaults.json');

// Count icons per unmapped type
const typeCounts = {};
for (const [icon, entry] of Object.entries(registry)) {
  for (const t of entry.types) {
    if (!layer1[t]) {
      if (!typeCounts[t]) typeCounts[t] = 0;
      typeCounts[t]++;
    }
  }
}

// Sort by count descending
const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
console.log('Unmapped types by icon count:');
sorted.forEach(([t, c]) => console.log(`  ${t}: ${c} icons`));
console.log(`\nTotal: ${sorted.length} unmapped types covering ${new Set(Object.entries(registry).filter(([_, e]) => e.types.every(t => !layer1[t])).map(([k]) => k)).size} exclusively-unmapped icons`);
