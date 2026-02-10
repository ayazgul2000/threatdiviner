const { PrismaClient } = require('@prisma/client');
const d = require('./src/vulndb/bridge/layer1-category-defaults.json');

async function main() {
  const p = new PrismaClient();
  try {
    // Get all distinct technology values from threat_model_components
    const techs = await p.$queryRawUnsafe("SELECT DISTINCT technology FROM threat_model_components WHERE technology IS NOT NULL ORDER BY technology");
    console.log('=== Technologies from threat_model_components ===');
    console.log(JSON.stringify(techs));

    // Check shape_mappings table
    const smCols = await p.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'shape_mappings' ORDER BY ordinal_position");
    console.log('\n=== shape_mappings columns ===');
    console.log(JSON.stringify(smCols));

    const smSample = await p.$queryRawUnsafe("SELECT * FROM shape_mappings LIMIT 5");
    console.log('\n=== shape_mappings sample ===');
    console.log(JSON.stringify(smSample).substring(0, 2000));

    // Count shape_mappings
    const smCount = await p.$queryRawUnsafe("SELECT COUNT(*)::int as cnt FROM shape_mappings");
    console.log('\n=== shape_mappings count ===');
    console.log(JSON.stringify(smCount));

    // Get distinct technology from shape_mappings if it has that column
    try {
      const smTechs = await p.$queryRawUnsafe("SELECT DISTINCT technology FROM shape_mappings WHERE technology IS NOT NULL ORDER BY technology");
      console.log('\n=== Technologies from shape_mappings ===');
      console.log(JSON.stringify(smTechs));
    } catch(e) {
      console.log('\nNo technology column in shape_mappings');
    }

    // Collect all technologyKeywords from layer1
    const allTechKeywords = new Set();
    for (const [key, val] of Object.entries(d)) {
      if (key.startsWith('_')) continue;
      if (val.technologyKeywords) {
        for (const tk of val.technologyKeywords) {
          allTechKeywords.add(tk);
        }
      }
    }
    console.log('\n=== All technologyKeywords from Layer 1 ===');
    console.log([...allTechKeywords].sort());
    console.log('Count:', allTechKeywords.size);

  } finally {
    await p.$disconnect();
  }
}
main();
