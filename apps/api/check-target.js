const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Update testpen target rate limit to 150
  const updated = await prisma.penTestTarget.update({
    where: { id: '7396a3f9-02bf-42d9-8645-f734c009cb32' },
    data: { rateLimitRps: 150 }
  });

  console.log('Updated testpen rate limit to:', updated.rateLimitRps);

  await prisma.$disconnect();
}

main();
