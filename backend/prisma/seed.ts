import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma';

import { seedAdminUser } from './seeds/admin-user.seed';

import { seedAttributes } from './seeds/attributes.seed';

import { seedBrands } from './seeds/brands.seed';

import { seedCategories } from './seeds/categories.seed';

import { seedPermissions } from './seeds/permissions.seed';

import { seedProducts } from './seeds/products.seed';

import { seedRbac } from './seeds/rbac.seed';

import { seedRoles } from './seeds/roles.seed';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for database seeding.');
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

async function main(): Promise<void> {
  await seedPermissions(prisma);
  await seedRoles(prisma);

  await seedRbac(prisma);

  await seedAdminUser(prisma);
  await seedCategories(prisma);
  await seedBrands(prisma);
  await seedAttributes(prisma);
  await seedProducts(prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();

    console.log('Seed completed successfully.');
  })
  .catch(async (error: unknown) => {
    console.error('Seed failed:', error);

    await prisma.$disconnect();

    process.exit(1);
  });
