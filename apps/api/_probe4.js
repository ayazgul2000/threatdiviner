const d = require('./src/vulndb/bridge/layer1-category-defaults.json');

// Check if there are distinct top-level keys that have technologyKeywords
const entriesWithTech = [];
const entriesWithoutTech = [];
const allTechKeywords = new Set();

for (const [key, val] of Object.entries(d)) {
  if (key.startsWith('_')) continue;
  if (val.technologyKeywords && val.technologyKeywords.length > 0) {
    entriesWithTech.push(key);
    for (const tk of val.technologyKeywords) {
      allTechKeywords.add(tk);
    }
  } else {
    entriesWithoutTech.push(key);
  }
}

console.log('Entries WITH technologyKeywords:', entriesWithTech.length);
console.log('Entries WITHOUT technologyKeywords:', entriesWithoutTech.length);
console.log('Unique technologyKeywords:', [...allTechKeywords].sort());

// Group entries by their technologyKeywords combination
const byTech = {};
for (const [key, val] of Object.entries(d)) {
  if (key.startsWith('_')) continue;
  const tk = val.technologyKeywords ? val.technologyKeywords.sort().join(',') : '(none)';
  if (!byTech[tk]) byTech[tk] = [];
  byTech[tk].push(key);
}
console.log('\nEntries grouped by technologyKeywords:');
for (const [tk, keys] of Object.entries(byTech)) {
  console.log(`  "${tk}": ${keys.length} entries`);
}

// Also check what the top-level keys look like (these ARE the technology names)
console.log('\n=== Top-level keys (first 20) ===');
const nonMetaKeys = Object.keys(d).filter(k => !k.startsWith('_')).sort();
console.log(nonMetaKeys.slice(0, 20));
console.log('Total non-meta keys:', nonMetaKeys.length);

// These ARE the technology types - 132 of them
// The "16 technology names" might refer to something else... let me check threagile_type values
// or shape-related concepts
