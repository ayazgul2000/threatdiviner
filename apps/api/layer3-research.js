// Layer 3 research: Check applicablePlatforms.languages values and map to icons
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();
const bp = path.join(__dirname, 'src', 'vulndb', 'bridge');

async function main() {
  const step = process.argv[2] || 'languages';

  if (step === 'languages') {
    // Step 1: Get all distinct language values from applicablePlatforms
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT lang->>'name' as name, lang->>'prevalence' as prevalence
      FROM cwes, jsonb_array_elements(applicable_platforms::jsonb -> 'languages') as lang
      WHERE applicable_platforms::jsonb -> 'languages' IS NOT NULL
      ORDER BY name
    `;
    console.log('=== Distinct language values in applicablePlatforms.languages ===');
    console.log('Count:', rows.length);
    rows.forEach(r => console.log('  ' + r.name + ' (' + r.prevalence + ')'));
  }

  if (step === 'lang-counts') {
    // Step 2: Count CWEs per language
    const rows = await prisma.$queryRaw`
      SELECT lang->>'name' as name, COUNT(DISTINCT c.id) as cwe_count
      FROM cwes c, jsonb_array_elements(c.applicable_platforms::jsonb -> 'languages') as lang
      WHERE c.applicable_platforms::jsonb -> 'languages' IS NOT NULL
      GROUP BY lang->>'name'
      ORDER BY cwe_count DESC
    `;
    console.log('=== CWE count per language ===');
    rows.forEach(r => console.log('  ' + r.name + ': ' + r.cwe_count + ' CWEs'));
  }

  if (step === 'lang-cwes') {
    // Step 3: Get CWEs for specific languages that map to icons
    const langs = ['Java', 'Python', 'PHP', 'JavaScript', 'C', 'C++', 'C#', 'Go', 'Ruby', 'Rust', 'SQL'];
    for (const lang of langs) {
      const rows = await prisma.$queryRaw`
        SELECT c.id
        FROM cwes c, jsonb_array_elements(c.applicable_platforms::jsonb -> 'languages') as l
        WHERE l->>'name' = ${lang}
        ORDER BY c.id
      `;
      const ids = rows.map(r => r.id);
      console.log(lang + ': ' + ids.length + ' CWEs');
      console.log('  [' + ids.join(', ') + ']');
      console.log('');
    }
  }

  if (step === 'effective-pool') {
    // Step 4: For each candidate icon, show its current effective CWE pool
    const l1 = JSON.parse(fs.readFileSync(path.join(bp, 'layer1-category-defaults.json')));
    const l2 = JSON.parse(fs.readFileSync(path.join(bp, 'layer2-subcategory-exclusions.json')));

    const icons = [
      { name: 'redis', type: 'inmemory', sub: 'inmemory-all' },
      { name: 'elasticsearch', type: 'elasticsearch', sub: 'elastic-core' },
      { name: 'nginx', type: 'network', sub: 'load-balancer' },
      { name: 'apache', type: 'network', sub: 'web-server' },
      { name: 'tomcat', type: 'network', sub: 'web-server' },
      { name: 'nodejs', type: 'language', sub: 'lang-webjs' },
      { name: 'python', type: 'language', sub: 'lang-scripting' },
      { name: 'java', type: 'language', sub: 'lang-jvm' },
      { name: 'php', type: 'language', sub: 'lang-scripting' },
      { name: 'kafka', type: 'queue', sub: 'queue-all' },
      { name: 'rabbitmq', type: 'queue', sub: 'queue-all' },
      { name: 'oracle', type: 'database', sub: 'sql-database' },
      { name: 'neo4j', type: 'database', sub: 'graph-database' },
      { name: 'mysql', type: 'database', sub: 'sql-database' },
      { name: 'mariadb', type: 'database', sub: 'sql-database' },
      { name: 'dynamodb', type: 'database', sub: 'kv-store' },
      { name: 'docker', type: 'container', sub: 'container-runtime' },
      { name: 'vault', type: 'security', sub: 'encryption-kms' },
    ];

    for (const icon of icons) {
      const cfg = l1[icon.type];
      if (!cfg) { console.log(icon.name + ': NO L1 CONFIG'); continue; }
      const pool = new Set();
      if (cfg.cwe699Subcategories && cfg.cwe699Subcategories.length) {
        const m = await prisma.cweCategoryMember.findMany({
          where: { categoryId: { in: cfg.cwe699Subcategories } },
          select: { cweId: true }
        });
        m.forEach(x => pool.add(x.cweId));
      }
      if (cfg.technologyKeywords && cfg.technologyKeywords.length) {
        for (const kw of cfg.technologyKeywords) {
          const r = await prisma.$queryRaw`
            SELECT id FROM cwes WHERE applicable_platforms::jsonb -> 'technologies' @> ${JSON.stringify([{ name: kw }])}::jsonb
          `;
          r.forEach(x => pool.add(x.id));
        }
      }
      const excl = l2[icon.sub]?.excludeCwes || [];
      const effective = [...pool].filter(x => !excl.includes(x)).sort();
      console.log(icon.name + ' (' + icon.type + '/' + icon.sub + '): ' + effective.length + ' effective CWEs');
      console.log('  ' + effective.join(', '));
      console.log('');
    }
  }

  if (step === 'lang-diff') {
    // Step 5: For language icons, show what applicablePlatforms.languages would ADD
    const l1 = JSON.parse(fs.readFileSync(path.join(bp, 'layer1-category-defaults.json')));
    const l2 = JSON.parse(fs.readFileSync(path.join(bp, 'layer2-subcategory-exclusions.json')));

    const langMap = [
      { icon: 'java', lang: 'Java', type: 'language', sub: 'lang-jvm' },
      { icon: 'python', lang: 'Python', type: 'language', sub: 'lang-scripting' },
      { icon: 'php', lang: 'PHP', type: 'language', sub: 'lang-scripting' },
      { icon: 'nodejs', lang: 'JavaScript', type: 'language', sub: 'lang-webjs' },
    ];

    for (const entry of langMap) {
      // Get current pool
      const cfg = l1[entry.type];
      const pool = new Set();
      if (cfg.cwe699Subcategories && cfg.cwe699Subcategories.length) {
        const m = await prisma.cweCategoryMember.findMany({
          where: { categoryId: { in: cfg.cwe699Subcategories } },
          select: { cweId: true }
        });
        m.forEach(x => pool.add(x.cweId));
      }
      const excl = l2[entry.sub]?.excludeCwes || [];
      const effective = new Set([...pool].filter(x => !excl.includes(x)));

      // Get language-specific CWEs
      const langCwes = await prisma.$queryRaw`
        SELECT c.id, c.name FROM cwes c, jsonb_array_elements(c.applicable_platforms::jsonb -> 'languages') as l
        WHERE l->>'name' = ${entry.lang}
        ORDER BY c.id
      `;

      const newCwes = langCwes.filter(c => !effective.has(c.id));
      const alreadyIn = langCwes.filter(c => effective.has(c.id));

      console.log('=== ' + entry.icon + ' (lang: ' + entry.lang + ') ===');
      console.log('Current pool: ' + effective.size + ' CWEs');
      console.log('Language CWEs: ' + langCwes.length + ' total, ' + alreadyIn.length + ' already in pool, ' + newCwes.length + ' NEW');
      console.log('');
      console.log('NEW CWEs to add:');
      newCwes.forEach(c => console.log('  ' + c.id + ': ' + c.name));
      console.log('');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
