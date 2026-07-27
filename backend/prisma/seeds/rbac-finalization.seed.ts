import { PrismaClient } from '../../src/generated/prisma';

import { seedRbac } from './rbac.seed';

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    await seedRbac(prisma);

    console.log('RBAC permissions and system roles finalized successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('RBAC finalization seed failed:', error);

  process.exit(1);
});
