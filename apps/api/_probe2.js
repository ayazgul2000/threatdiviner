const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  try {
    // Get columns for all cwe tables
    for (const tbl of ['cwe_category_members', 'cwe_categories', 'cwe_views', 'cwes']) {
      const cols = await p.$queryRawUnsafe(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
        tbl
      );
      console.log(`\n=== ${tbl} columns ===`);
      console.log(JSON.stringify(cols));
    }

    // Sample data from cwe_category_members
    const sample = await p.$queryRawUnsafe("SELECT * FROM cwe_category_members LIMIT 3");
    console.log('\n=== cwe_category_members sample ===');
    console.log(JSON.stringify(sample));

    // Sample data from cwe_categories
    const catSample = await p.$queryRawUnsafe("SELECT * FROM cwe_categories LIMIT 3");
    console.log('\n=== cwe_categories sample ===');
    console.log(JSON.stringify(catSample));

    // Count distinct categories
    const catCount = await p.$queryRawUnsafe("SELECT COUNT(DISTINCT category_id)::int as cnt FROM cwe_category_members");
    console.log('\n=== distinct category count ===');
    console.log(JSON.stringify(catCount));

    // Check for technology-related tables or columns
    const allTables = await p.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND (tablename LIKE '%tech%' OR tablename LIKE '%shape%' OR tablename LIKE '%canonical%') ORDER BY tablename");
    console.log('\n=== technology/shape/canonical tables ===');
    console.log(JSON.stringify(allTables));

    // Check canonical_risks or similar
    try {
      const crCols = await p.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'canonical_risks' ORDER BY ordinal_position");
      console.log('\n=== canonical_risks columns ===');
      console.log(JSON.stringify(crCols));
    } catch(e) { console.log('no canonical_risks table'); }

    // Check shape_definitions
    try {
      const sdCols = await p.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'shape_definitions' ORDER BY ordinal_position");
      console.log('\n=== shape_definitions columns ===');
      console.log(JSON.stringify(sdCols));
    } catch(e) { console.log('no shape_definitions table'); }

    // Look for technology in any table
    const techSearch = await p.$queryRawUnsafe("SELECT table_name, column_name FROM information_schema.columns WHERE column_name LIKE '%technolog%' AND table_schema = 'public' ORDER BY table_name");
    console.log('\n=== columns with technology in name ===');
    console.log(JSON.stringify(techSearch));

  } finally {
    await p.$disconnect();
  }
}
main();
