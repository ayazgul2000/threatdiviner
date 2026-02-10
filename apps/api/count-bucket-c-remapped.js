const registry = require('./src/vulndb/bridge/icon-registry.json');
const layer1 = require('./src/vulndb/bridge/layer1-category-defaults.json');

// Proposed remapping of all Bucket C types
const remapping = {
  // Move to Bucket A (alias to existing type)
  'infrastructure': 'network',
  'beats': 'monitoring',
  'operations': 'monitoring',
  'agent': 'monitoring',
  'aggregator': 'logging',
  'develop': 'devtools',
  'intune': 'security',
  'sharedservices': 'security',
  'applicationlifecycle': 'devops',
  'workloadprovisioning': 'compute',
  'ecosystem': 'containers',
  'quality': 'monitoring',
  'enduser': 'client',
  'chaos': 'devops',
  'optimization': 'monitoring',
  'engagement': 'messaging',
  'enablement': 'management',   // Bucket B type
  'azureecosystem': 'management',
  'azurestack': 'management',
  'grow': 'mobile',
  'hybridmulticloud': 'network',
  'multiregion': 'network',
  'satellite': 'network',
  'robotics': 'iot',
  'business': 'workflow',
  'crm': 'web',
  'social': 'web',
  'ar': 'client',
  'mixedreality': 'client',
  'game': 'compute',
  'quantum': 'compute',
  'place': 'compute',
  'proxmox': 'compute',
  'groupware': 'storage',
  'geocoding': 'api',
  'javascript': 'web',
  'newicons': 'security',  // mostly Azure security/management icons

  // Truly unmappable - null means skip
  'general': null,
  'other': null,
  'others': null,
  'flowchart': null,
  'blank': null,
  'menu': null,
  'format': null,
  'base': null,
  'extentions': null,
  'group': null,
  'ogc': null,
  'java': null,
  'python': null,
  'cplusplus': null,
  'saas': null,
};

// Count impact
let remappedIcons = 0;
let stillUnmapped = 0;
let remappedTypes = 0;
let skippedTypes = 0;

for (const [type, target] of Object.entries(remapping)) {
  let count = 0;
  for (const entry of Object.values(registry)) {
    if (entry.types.includes(type)) {
      // Only count if this icon has NO other mapped type
      const hasOtherMapped = entry.types.some(t => t !== type && (layer1[t] || (remapping[t] && remapping[t] !== null)));
      if (!hasOtherMapped) count++;
    }
  }

  if (target) {
    remappedTypes++;
    remappedIcons += count;
    if (count > 0) console.log(`  ${type} -> ${target}: ${count} exclusively-unmapped icons gained`);
  } else {
    skippedTypes++;
    stillUnmapped += count;
    if (count > 0) console.log(`  ${type} -> SKIP: ${count} icons stay unmapped`);
  }
}

console.log(`\nRemapped: ${remappedTypes} types`);
console.log(`Skipped: ${skippedTypes} types`);
console.log(`New icons gained: ${remappedIcons}`);
console.log(`Still unmapped: ${stillUnmapped}`);
