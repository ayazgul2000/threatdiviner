const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const projects = await p.project.findMany({
    where: { tenantId: '550e8400-e29b-41d4-a716-446655440001' }
  });
  console.log('Projects:', JSON.stringify(projects, null, 2));

  const repos = await p.repository.findMany({
    where: { tenantId: '550e8400-e29b-41d4-a716-446655440001' },
    select: { id: true, fullName: true, projectId: true }
  });
  console.log('\nRepositories:', JSON.stringify(repos, null, 2));

  await p.$disconnect();
}

main();
