import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma';

import { seedAdminUser } from './seeds/admin-user.seed';
import { seedPermissions } from './seeds/permissions.seed';
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
  console.log('Starting system seed...');

  await seedPermissions(prisma);
  await seedRoles(prisma);
  await seedRbac(prisma);
  await seedAdminUser(prisma);

  console.log('System seed completed successfully.');
}

main()
  .catch((error: unknown) => {
    console.error('System seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
