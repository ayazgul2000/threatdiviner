import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create test tenants
  const acmeCorp = await prisma.tenant.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Acme Corporation',
      slug: 'acme-corp',
      plan: 'professional',
    },
  });

  const betaInc = await prisma.tenant.upsert({
    where: { slug: 'beta-inc' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Beta Inc',
      slug: 'beta-inc',
      plan: 'starter',
    },
  });

  console.log('Created tenants:', { acmeCorp: acmeCorp.slug, betaInc: betaInc.slug });

  // Hash passwords with bcrypt
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const devPasswordHash = await bcrypt.hash('dev123', 10);

  // Create users for Acme Corp
  const acmeAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: acmeCorp.id,
        email: 'admin@acme.com',
      },
    },
    update: {
      passwordHash: adminPasswordHash,
    },
    create: {
      id: '550e8400-e29b-41d4-a716-446655440011',
      tenantId: acmeCorp.id,
      email: 'admin@acme.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
    },
  });

  const acmeMember = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: acmeCorp.id,
        email: 'dev@acme.com',
      },
    },
    update: {
      passwordHash: devPasswordHash,
    },
    create: {
      id: '550e8400-e29b-41d4-a716-446655440012',
      tenantId: acmeCorp.id,
      email: 'dev@acme.com',
      passwordHash: devPasswordHash,
      role: 'member',
    },
  });

  // Create users for Beta Inc
  const betaAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: betaInc.id,
        email: 'admin@beta.io',
      },
    },
    update: {
      passwordHash: adminPasswordHash,
    },
    create: {
      id: '550e8400-e29b-41d4-a716-446655440021',
      tenantId: betaInc.id,
      email: 'admin@beta.io',
      passwordHash: adminPasswordHash,
      role: 'admin',
    },
  });

  const betaMember = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: betaInc.id,
        email: 'dev@beta.io',
      },
    },
    update: {
      passwordHash: devPasswordHash,
    },
    create: {
      id: '550e8400-e29b-41d4-a716-446655440022',
      tenantId: betaInc.id,
      email: 'dev@beta.io',
      passwordHash: devPasswordHash,
      role: 'member',
    },
  });

  console.log('Created users:', {
    acmeAdmin: acmeAdmin.email,
    acmeMember: acmeMember.email,
    betaAdmin: betaAdmin.email,
    betaMember: betaMember.email,
  });

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
