const { PrismaClient } = require('@prisma/client');
const yaml = require('js-yaml');
const p = new PrismaClient();

async function main() {
  const { YamlGeneratorService } = require('./dist/threat-modeling/services/yaml-generator.service');
  const svc = new YamlGeneratorService(p);
  const yamlStr = await svc.generateYaml('550e8400-e29b-41d4-a716-446655440500', '550e8400-e29b-41d4-a716-446655440001');

  // Show just trust_boundaries section
  const parsed = yaml.load(yamlStr);
  console.log('=== TRUST BOUNDARIES ===');
  console.log(yaml.dump({ trust_boundaries: parsed.trust_boundaries }, { indent: 2 }));
  console.log('=== TAGS AVAILABLE ===');
  console.log(parsed.tags_available);
  console.log('\n=== TECHNICAL ASSETS (names + technology) ===');
  for (const [k, v] of Object.entries(parsed.technical_assets)) {
    console.log(k, '- technology:', v.technology, '- type:', v.type);
  }
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
