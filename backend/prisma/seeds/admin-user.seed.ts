import { randomUUID } from 'node:crypto';

import * as bcrypt from 'bcrypt';

import { Prisma, PrismaClient } from '../../src/generated/prisma';

export async function seedAdminUser(prisma: PrismaClient): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@vexo-beauty.local';

  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';

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
