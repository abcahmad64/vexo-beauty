import { randomUUID } from 'node:crypto';

import * as bcrypt from 'bcrypt';

import { Prisma, PrismaClient } from '../../src/generated/prisma';

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for admin user seeding.`);
  }

  return value;
}

export async function seedAdminUser(prisma: PrismaClient): Promise<void> {
  const email = getRequiredEnvironmentVariable('SEED_ADMIN_EMAIL');
  const password = getRequiredEnvironmentVariable('SEED_ADMIN_PASSWORD');

  if (password.length < 14) {
    throw new Error(
      'SEED_ADMIN_PASSWORD must contain at least 14 characters.',
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const role = await prisma.role.findUnique({
    where: {
      name: 'SUPER_ADMIN',
    },
    select: {
      id: true,
    },
  });

  if (!role) {
    throw new Error('SUPER_ADMIN role was not found.');
  }

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO "User" (
        "id",
        "email",
        "phone",
        "password",
        "firstName",
        "lastName",
        "avatarUrl",
        "status",
        "roleId",
        "createdAt",
        "updatedAt",
        "deleted_at"
      )
      VALUES (
        ${randomUUID()},
        ${email},
        NULL,
        ${passwordHash},
        ${'مدیر'},
        ${'سیستم'},
        NULL,
        'ACTIVE'::"UserStatus",
        ${role.id},
        NOW(),
        NOW(),
        NULL
      )
      ON CONFLICT ("email")
      DO UPDATE SET
        "password" = EXCLUDED."password",
        "firstName" = EXCLUDED."firstName",
        "lastName" = EXCLUDED."lastName",
        "status" = 'ACTIVE'::"UserStatus",
        "roleId" = EXCLUDED."roleId",
        "deleted_at" = NULL,
        "updatedAt" = NOW()
    `,
  );
}
