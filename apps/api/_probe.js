const { PrismaClient } = require('@prisma/client');
const d = require('./src/vulndb/bridge/layer1-category-defaults.json');

const keys = Object.keys(d);
console.log('Total keys:', keys.length);
console.log('Keys starting with _:', keys.filter(k => k.startsWith('_')));
const nonMeta = Object.entries(d).filter(([k]) => !k.startsWith('_'));
console.log('Non-meta entries:', nonMeta.length);
if (nonMeta.length > 0) {
  console.log('First entry key:', nonMeta[0][0]);
  console.log('First entry value:', JSON.stringify(nonMeta[0][1], null, 2).substring(0, 2000));
}

async function main() {
  const p = new PrismaClient();
  try {
    const tables = await p.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE tablename LIKE 'cwe%' ORDER BY tablename");
    console.log('\nCWE tables in DB:', JSON.stringify(tables));

    const catMembers = await p.$queryRawUnsafe("SELECT \"categoryId\", COUNT(*)::int as cnt FROM cwe_category_members GROUP BY \"categoryId\" ORDER BY \"categoryId\" LIMIT 5");
    console.log('\nSample category members:', JSON.stringify(catMembers));

    try {
      const cats = await p.$queryRawUnsafe("SELECT * FROM cwe_categories LIMIT 3");
      console.log('\ncwe_categories sample:', JSON.stringify(cats));
    } catch (e) {
      console.log('\ncwe_categories query error:', e.message.substring(0, 200));
    }

    try {
      const views = await p.$queryRawUnsafe("SELECT * FROM cwe_views LIMIT 3");
      console.log('\ncwe_views sample:', JSON.stringify(views));
    } catch(e) {
      console.log('\ncwe_views error:', e.message.substring(0, 200));
    }

    const cols = await p.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'cwe_category_members' ORDER BY ordinal_position");
    console.log('\ncwe_category_members columns:', JSON.stringify(cols));

    try {
      const cols2 = await p.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'cwe_categories' ORDER BY ordinal_position");
      console.log('\ncwe_categories columns:', JSON.stringify(cols2));
    } catch(e) {}

    // Check for technology-related tables/data
    try {
      const techTables = await p.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE tablename LIKE '%technolog%' ORDER BY tablename");
      console.log('\nTechnology tables:', JSON.stringify(techTables));
    } catch(e) {}

  } finally {
    await p.$disconnect();
  }
}
main();
