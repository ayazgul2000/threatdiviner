// Add final 7 large types: application, container, elasticsearch, governance, monitor, user, mobile
const fs = require('fs');
const registry = require('./src/vulndb/bridge/icon-registry.json');
const overrides = require('./src/vulndb/bridge/icon-type-overrides.json');
const l1config = require('./src/vulndb/bridge/layer1-category-defaults.json');

function getIcons(t) {
  const icons = [];
  for (const [icon, entry] of Object.entries(registry)) {
    const o = overrides[icon];
    if (o === 'skip') continue;
    if (o && o !== t) continue;
    if (o === t) { icons.push(icon); continue; }
    if (entry.types.some(x => x === t)) icons.push(icon);
  }
  return icons.sort();
}

function verify(entries, t) {
  const assigned = new Set(), dupes = [];
  for (const [k, v] of Object.entries(entries)) {
    if (k.startsWith('_')) continue;
    for (const i of v.icons) { if (assigned.has(i)) dupes.push(i); assigned.add(i); }
  }
  const expected = getIcons(t);
  const unassigned = expected.filter(i => !assigned.has(i));
  const pass = assigned.size === expected.length && !dupes.length && !unassigned.length;
  console.log(`${t}: ${assigned.size}/${expected.length} dupes:${dupes.length} unassigned:${unassigned.length} ${pass ? 'PASS ✓' : 'FAIL ✗'}`);
  if (unassigned.length) console.log(`  Unassigned: ${unassigned.join(', ')}`);
  if (dupes.length) console.log(`  Dupes: ${dupes.join(', ')}`);
  return pass;
}

const layer2 = JSON.parse(fs.readFileSync('./src/vulndb/bridge/layer2-subcategory-exclusions.json', 'utf8'));

// === APPLICATION (16 icons, 110 CWEs) ===
const appEntries = {
  "_comment_application": "=== APPLICATION (16 icons, 110 CWEs from CWE-1228+CWE-137+CWE-355+CWE-1215+Tech:WebServer) — Alibaba/Azure/IBM | Exclusions: J2EE(6): CWE-6,7,245,382,383,594 | PHP(1): CWE-98 ===",
  "app-api-code": { "category": "application", "icons": ["api-gateway", "code-pipeline", "node-js-performance-platform", "performance-testing-service"], "excludeCwes": [] },
  "app-communication": { "category": "application", "icons": ["cloud-call-center", "direct-mail", "message-notification-service"], "excludeCwes": ["CWE-6", "CWE-7", "CWE-245", "CWE-382", "CWE-383", "CWE-594"] },
  "app-ai-analytics": { "category": "application", "icons": ["bee-bot", "open-search", "smart-conversation-analysis"], "excludeCwes": ["CWE-6", "CWE-7", "CWE-98", "CWE-245", "CWE-382", "CWE-383", "CWE-594"] },
  "app-platform": { "category": "application", "icons": ["azure-center-for-sap", "blockchain-as-a-service", "log-service", "microservices-application", "rd-cloud", "yida"], "excludeCwes": [] }
};

// === CONTAINER (15 icons, 52 CWEs) ===
const contEntries = {
  "_comment_container": "=== CONTAINER (15 icons, 52 CWEs from CWE-557+CWE-265+CWE-399+CWE-452) | Exclusions: Chroot(1): CWE-243 | JavaClone(1): CWE-580 ===",
  "container-runtime": { "category": "container", "icons": ["containerd", "crio", "docker", "firecracker", "gvisor", "lxc", "rkt"], "excludeCwes": [] },
  "container-k8s": { "category": "container", "icons": ["aks-istio", "arc-kubernetes", "hdi-aks-cluster", "k3s", "kubernetes-fleet-manager"], "excludeCwes": ["CWE-580"] },
  "container-services": { "category": "container", "icons": ["container-apps-environments", "ibm-containers", "worker-container-app"], "excludeCwes": ["CWE-243", "CWE-580"] }
};

// === ELASTICSEARCH (14 icons, 39 CWEs) ===
const elasticEntries = {
  "_comment_elasticsearch": "=== ELASTICSEARCH (14 icons, 39 CWEs from CWE-137+CWE-19) — Elastic Stack | Exclusions: LDAP(1): CWE-90 | Web(2): CWE-472,601 ===",
  "elastic-core": { "category": "elasticsearch", "icons": ["elasticsearch", "sql", "stack"], "excludeCwes": ["CWE-90"] },
  "elastic-ingest": { "category": "elasticsearch", "icons": ["beats", "logstash", "logstash-pipeline"], "excludeCwes": ["CWE-90", "CWE-472", "CWE-601"] },
  "elastic-ui": { "category": "elasticsearch", "icons": ["kibana", "map-services", "maps"], "excludeCwes": ["CWE-90"] },
  "elastic-features": { "category": "elasticsearch", "icons": ["alerting", "machine-learning", "monitoring", "searchable-snapshots", "security-settings"], "excludeCwes": ["CWE-90"] }
};

// === GOVERNANCE (14 icons, 38 CWEs) ===
const govEntries = {
  "_comment_governance": "=== GOVERNANCE (14 icons, 38 CWEs from CWE-265+CWE-1211+CWE-1212) — OCI governance | Exclusions: Chroot(1): CWE-243 | CAPTCHA(1): CWE-804 ===",
  "govern-identity": { "category": "governance", "icons": ["groups", "groups-white", "ocid", "ocid-white"], "excludeCwes": ["CWE-243", "CWE-804"] },
  "govern-policy": { "category": "governance", "icons": ["compartments", "compartments-white", "policies", "policies-white", "tagging", "tagging-white"], "excludeCwes": ["CWE-243", "CWE-804"] },
  "govern-audit": { "category": "governance", "icons": ["audit", "audit-white", "logging", "logging-white"], "excludeCwes": ["CWE-243", "CWE-804"] }
};

// === MONITOR (12 icons, 23 CWEs) ===
const monEntries = {
  "_comment_monitor": "=== MONITOR (12 icons, 23 CWEs from CWE-1210+CWE-199) — Azure Monitor | No exclusions (small homogeneous pool) ===",
  "monitor-logging": { "category": "monitor", "icons": ["activity-log", "log-analytics-workspaces", "logs"], "excludeCwes": [] },
  "monitor-metrics": { "category": "monitor", "icons": ["auto-scale", "diagnostics-settings", "metrics", "monitor"], "excludeCwes": [] },
  "monitor-apm": { "category": "monitor", "icons": ["application-insights", "azure-workbooks", "change-analysis"], "excludeCwes": [] },
  "monitor-specialized": { "category": "monitor", "icons": ["azure-monitors-for-sap-solutions", "network-watcher"], "excludeCwes": [] }
};

// === USER (12 icons, 40 CWEs) ===
const userEntries = {
  "_comment_user": "=== USER (12 icons, 40 CWEs from CWE-1211+CWE-1212+CWE-255) | Exclusions: CAPTCHA(1): CWE-804 | URLScheme(1): CWE-939 ===",
  "user-devices": { "category": "user", "icons": ["browser", "device", "physical-entity", "sensor"], "excludeCwes": ["CWE-804"] },
  "user-accounts": { "category": "user", "icons": ["twousericon", "user", "userhealthicon", "usericon", "userprivacy", "userresource"], "excludeCwes": ["CWE-804", "CWE-939"] },
  "user-clients": { "category": "user", "icons": ["integrated-digital-experiences", "openstackclient"], "excludeCwes": ["CWE-804"] }
};

// === MOBILE (17 icons, 27 CWEs) ===
const mobileEntries = {
  "_comment_mobile": "=== MOBILE (17 icons, 27 CWEs from CWE-355+CWE-1211+CWE-1217) | Exclusions: CAPTCHA(1): CWE-804 | Session(2): CWE-384,613 ===",
  "mobile-platform": { "category": "mobile", "icons": ["amplify", "app-service-mobile", "app-services", "mobile", "mobile-client", "mobile-engagement"], "excludeCwes": [] },
  "mobile-api": { "category": "mobile", "icons": ["api-gateway", "api-gateway-endpoint", "appsync", "power-platform"], "excludeCwes": [] },
  "mobile-testing": { "category": "mobile", "icons": ["device-farm", "notification-hubs", "pinpoint"], "excludeCwes": ["CWE-804"] },
  "mobile-field": { "category": "mobile", "icons": ["mergin", "offline-capabilities", "qfield", "smash"], "excludeCwes": ["CWE-384", "CWE-613", "CWE-804"] }
};

// Verify all 7
verify(appEntries, 'application');
verify(contEntries, 'container');
verify(elasticEntries, 'elasticsearch');
verify(govEntries, 'governance');
verify(monEntries, 'monitor');
verify(userEntries, 'user');
verify(mobileEntries, 'mobile');

// Write all
Object.assign(layer2, appEntries, contEntries, elasticEntries, govEntries, monEntries, userEntries, mobileEntries);
fs.writeFileSync('./src/vulndb/bridge/layer2-subcategory-exclusions.json', JSON.stringify(layer2, null, 2) + '\n');
console.log('\nAll 7 written to file.');

// Final count
const final = JSON.parse(fs.readFileSync('./src/vulndb/bridge/layer2-subcategory-exclusions.json', 'utf8'));
const cats = new Set();
let totalEntries = 0, totalIcons = 0;
for (const [k, v] of Object.entries(final)) {
  if (k.startsWith('_')) continue;
  cats.add(v.category);
  totalEntries++;
  totalIcons += v.icons.length;
}
console.log(`\n=== FINAL TOTALS ===`);
console.log(`${totalEntries} subtypes across ${cats.size} categories, ${totalIcons} total icon assignments`);

// Check remaining
const remaining = [];
for (const [type] of Object.entries(l1config)) {
  if (type.startsWith('_')) continue;
  if (cats.has(type)) continue;
  const icons = getIcons(type);
  if (icons.length > 0) remaining.push({ type, count: icons.length });
}
remaining.sort((a, b) => b.count - a.count);
console.log(`\n${remaining.length} remaining types with icons:`);
for (const r of remaining) console.log(`  ${r.type}: ${r.count} icons`);
