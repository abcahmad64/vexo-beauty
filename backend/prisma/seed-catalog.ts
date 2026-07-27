import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma';

import { seedAttributes } from './seeds/attributes.seed';
import { seedBrands } from './seeds/brands.seed';
import { seedCategories } from './seeds/categories.seed';
import { seedProducts } from './seeds/products.seed';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for catalog seeding.');
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

async function main(): Promise<void> {
  console.log('Starting catalog seed...');

  await seedCategories(prisma);
  await seedBrands(prisma);
  await seedAttributes(prisma);
  await seedProducts(prisma);

  console.log('Catalog seed completed successfully.');
}

main()
  .catch((error: unknown) => {
    console.error('Catalog seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
