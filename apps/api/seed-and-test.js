const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const tenantId = '550e8400-e29b-41d4-a716-446655440001';
  const userId = '550e8400-e29b-41d4-a716-446655440011';

  // Check existing threat models
  const tms = await p.threatModel.findMany({
    where: { tenantId },
    include: { components: true, dataFlows: true },
    take: 5
  });

  console.log('=== EXISTING THREAT MODELS ===');
  for (const tm of tms) {
    console.log(tm.id, '-', tm.name, '| components:', tm.components.length, '| flows:', tm.dataFlows.length, '| status:', tm.analysisStatus);
  }

  // Find one with components, or pick the first one
  let target = tms.find(t => t.components.length > 0) || tms[0];

  if (!target) {
    console.log('\nNo threat models found. Creating one...');
    target = await p.threatModel.create({
      data: {
        tenantId,
        name: 'E-Commerce Platform',
        description: 'Online shopping platform threat model',
        status: 'draft',
        createdBy: userId,
      },
      include: { components: true, dataFlows: true },
    });
    console.log('Created:', target.id, '-', target.name);
  }

  console.log('\n=== TARGET:', target.name, '===');

  // If no components, seed them
  if (target.components.length === 0) {
    console.log('Seeding components and data flows...');

    const webApp = await p.threatModelComponent.create({
      data: {
        threatModelId: target.id,
        name: 'Web Application',
        description: 'Customer-facing web application',
        type: 'process',
        technology: 'nodejs',
        criticality: 'high',
        positionX: 100,
        positionY: 100,
      }
    });

    const apiGw = await p.threatModelComponent.create({
      data: {
        threatModelId: target.id,
        name: 'API Gateway',
        description: 'REST API gateway',
        type: 'process',
        technology: 'nginx',
        criticality: 'high',
        positionX: 300,
        positionY: 100,
      }
    });

    const db = await p.threatModelComponent.create({
      data: {
        threatModelId: target.id,
        name: 'PostgreSQL Database',
        description: 'Primary data store',
        type: 'datastore',
        technology: 'postgresql',
        criticality: 'critical',
        positionX: 500,
        positionY: 100,
      }
    });

    const extUser = await p.threatModelComponent.create({
      data: {
        threatModelId: target.id,
        name: 'End User',
        description: 'External customer',
        type: 'external_entity',
        criticality: 'low',
        positionX: -100,
        positionY: 100,
      }
    });

    const cache = await p.threatModelComponent.create({
      data: {
        threatModelId: target.id,
        name: 'Redis Cache',
        description: 'Session and data cache',
        type: 'datastore',
        technology: 'redis',
        criticality: 'medium',
        positionX: 500,
        positionY: 300,
      }
    });

    // Data flows
    await p.threatModelDataFlow.create({
      data: { threatModelId: target.id, sourceId: extUser.id, targetId: webApp.id, label: 'HTTPS Requests', protocol: 'https' }
    });
    await p.threatModelDataFlow.create({
      data: { threatModelId: target.id, sourceId: webApp.id, targetId: apiGw.id, label: 'API Calls', protocol: 'https' }
    });
    await p.threatModelDataFlow.create({
      data: { threatModelId: target.id, sourceId: apiGw.id, targetId: db.id, label: 'SQL Queries', protocol: 'tcp' }
    });
    await p.threatModelDataFlow.create({
      data: { threatModelId: target.id, sourceId: apiGw.id, targetId: cache.id, label: 'Cache Read/Write', protocol: 'tcp' }
    });

    console.log('Seeded: 5 components, 4 data flows');

    // Reload
    target = await p.threatModel.findFirst({
      where: { id: target.id },
      include: { components: true, dataFlows: { include: { source: true, target: true } } },
    });
  }

  console.log('Components:', target.components.map(c => c.name).join(', '));
  console.log('Data Flows:', target.dataFlows.length);

  // Now generate YAML and run analysis via the API
  console.log('\n=== THREAT MODEL ID:', target.id, '===');
  console.log('Use this ID to call the analysis endpoint.');

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
