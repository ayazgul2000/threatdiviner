// Count unique Threagile technology output types from the mapping
const threagileTypes = new Set([
  'web-server', 'database', 'file-server', 'function', 'gateway',
  'reverse-proxy', 'message-queue', 'container-platform', 'web-application',
  'application-server', 'browser', 'load-balancer', 'vault', 'waf',
  'web-service-rest', 'ldap-server', 'mail-server', 'unknown-technology'
]);
console.log('Unique Threagile technology types:', threagileTypes.size);
console.log([...threagileTypes].sort());

// But the user said "16 technology names" -- this seems to refer to shape_mappings threagile_type
// or maybe the distinct technology values from threat_model_components
// Let me check the layer1 file technologyKeywords more carefully

const d = require('./src/vulndb/bridge/layer1-category-defaults.json');

// The user says "16 technology names" -- maybe they mean the 132 top-level keys are the "technologies"?
// Or maybe there's something I'm missing. Let me just check if there's a separate technology config

const fs = require('fs');
const path = require('path');
const bridgeDir = './src/vulndb/bridge/';
const files = fs.readdirSync(bridgeDir);
console.log('\nFiles in bridge dir:', files);
