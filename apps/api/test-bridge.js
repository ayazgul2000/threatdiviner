const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const users = await p.user.findMany({
    select: { email: true, tenant: { select: { slug: true } } }
  });
  console.log('Users:', JSON.stringify(users, null, 2));
  await p.$disconnect();
}

run().catch(e => { console.error(e); p.$disconnect(); });
