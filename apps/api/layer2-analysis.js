// Analyze a single type for Layer 2 subtype breakdown
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const TYPE = process.argv[2]; // pass type name as arg
if (!TYPE) { console.log('Usage: node layer2-analysis.js <type>'); process.exit(1); }

const prisma = new PrismaClient();
const bridgePath = path.join(__dirname, 'src', 'vulndb', 'bridge');

async function main() {
  const registry = JSON.parse(fs.readFileSync(path.join(bridgePath, 'icon-registry.json'), 'utf8'));
  const overrides = JSON.parse(fs.readFileSync(path.join(bridgePath, 'icon-type-overrides.json'), 'utf8'));
  const layer1 = JSON.parse(fs.readFileSync(path.join(bridgePath, 'layer1-category-defaults.json'), 'utf8'));

  const l1 = layer1[TYPE];
  if (!l1) { console.log(`No Layer 1 entry for "${TYPE}"`); return; }

  // Get icons for this type
  const icons = [];
  for (const [name, data] of Object.entries(registry)) {
    if (name.startsWith('_')) continue;
    const ov = overrides[name];
    if (ov === 'skip') continue;
    const types = ov ? [ov] : (data.types || []);
    if (types.includes(TYPE)) {
      icons.push({ name, classes: data.classes || [], modules: data.modules || [] });
    }
  }

  // Get CWE pool
  const cweSet = new Set();
  const cweDetails = new Map();

  if (l1.cwe699Subcategories && l1.cwe699Subcategories.length > 0) {
    const members = await prisma.cweCategoryMember.findMany({
      where: { categoryId: { in: l1.cwe699Subcategories } },
      select: { cweId: true, categoryId: true }
    });
    for (const m of members) {
      cweSet.add(m.cweId);
      if (!cweDetails.has(m.cweId)) cweDetails.set(m.cweId, { sources: [] });
      cweDetails.get(m.cweId).sources.push(m.categoryId);
    }
  }

  if (l1.technologyKeywords && l1.technologyKeywords.length > 0) {
    for (const kw of l1.technologyKeywords) {
      const techCwes = await prisma.$queryRaw`
        SELECT id FROM cwes
        WHERE applicable_platforms::jsonb -> 'technologies' @> ${JSON.stringify([{ name: kw }])}::jsonb
      `;
      for (const c of techCwes) {
        cweSet.add(c.id);
        if (!cweDetails.has(c.id)) cweDetails.set(c.id, { sources: [] });
        cweDetails.get(c.id).sources.push(`tech:${kw}`);
      }
    }
  }

  // Get CWE names
  const cweIds = [...cweSet];
  const cwes = await prisma.cwe.findMany({
    where: { id: { in: cweIds } },
    select: { id: true, name: true }
  });
  const cweNameMap = new Map(cwes.map(c => [c.id, c.name]));

  console.log(`\n=== ${TYPE} ===`);
  console.log(`L1 sources: ${JSON.stringify(l1)}`);
  console.log(`Icons: ${icons.length}`);
  console.log(`CWE pool: ${cweSet.size}\n`);

  console.log('--- ICONS ---');
  icons.sort((a, b) => a.name.localeCompare(b.name));
  icons.forEach(i => console.log(`  ${i.name} [${i.classes.join(', ')}] (${i.modules.join(', ')})`));

  console.log('\n--- CWE POOL ---');
  const sortedCwes = [...cweSet].sort((a, b) => {
    const na = parseInt(a.replace('CWE-', ''));
    const nb = parseInt(b.replace('CWE-', ''));
    return na - nb;
  });
  sortedCwes.forEach(id => {
    const name = cweNameMap.get(id) || '?';
    const src = cweDetails.get(id).sources.join(', ');
    console.log(`  ${id}: ${name} [from: ${src}]`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
