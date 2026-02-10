const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  try {
    // Check threat_model_components columns
    const cols = await p.$queryRawUnsafe(
      "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'threat_model_components' ORDER BY ordinal_position"
    );
    console.log('=== threat_model_components columns ===');
    for (const c of cols) {
      console.log(`  ${c.column_name}: ${c.data_type} (${c.udt_name})`);
    }

    // Check if technology is an enum
    const enumVals = await p.$queryRawUnsafe(
      "SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname LIKE '%technolog%' OR t.typname LIKE '%TechnicalAssetTechnology%' ORDER BY e.enumsortorder"
    );
    console.log('\n=== technology enum values ===');
    console.log(JSON.stringify(enumVals));

    // Check all enum types
    const allEnums = await p.$queryRawUnsafe(
      "SELECT t.typname, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as vals FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid GROUP BY t.typname ORDER BY t.typname"
    );
    console.log('\n=== all enums ===');
    for (const e of allEnums) {
      if (e.typname.toLowerCase().includes('tech') || e.vals.toLowerCase().includes('server') || e.vals.toLowerCase().includes('database')) {
        console.log(`  ${e.typname}: ${e.vals}`);
      }
    }

    // Just show all enums
    console.log('\n=== all enum type names ===');
    for (const e of allEnums) {
      console.log(`  ${e.typname}: ${e.vals.substring(0, 120)}`);
    }

  } finally {
    await p.$disconnect();
  }
}
main();
