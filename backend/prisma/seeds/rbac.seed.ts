import { randomUUID } from 'crypto';

import { Prisma, PrismaClient } from '../../src/generated/prisma';

import {
  DefaultPermissionDefinitions,
  SystemRoles,
} from '../../src/modules/rbac/constants/rbac.constants';

const SystemRoleDescriptions: Record<string, string> = {
  [SystemRoles.SUPER_ADMIN]: 'مدیرکل سیستم با دسترسی کامل و غیرقابل حذف',
  [SystemRoles.ADMIN]: 'مدیر فروشگاه با دسترسی مدیریتی کامل',
  [SystemRoles.CUSTOMER]: 'مشتری فروشگاه بدون دسترسی مدیریتی',
};

export async function seedRbac(prisma: PrismaClient): Promise<void> {
  await seedSystemRoles(prisma);
  await seedDefaultPermissions(prisma);
  await attachAllPermissionsToRole(prisma, SystemRoles.SUPER_ADMIN);
  await attachAllPermissionsToRole(prisma, SystemRoles.ADMIN);
}

async function seedSystemRoles(prisma: PrismaClient): Promise<void> {
  const roles = [
    SystemRoles.SUPER_ADMIN,
    SystemRoles.ADMIN,
    SystemRoles.CUSTOMER,
  ];

  for (const roleName of roles) {
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Role" (
          "id",
          "name",
          "description",
          "createdAt",
          "updatedAt",
          "deleted_at"
        )
        VALUES (
          ${randomUUID()},
          ${roleName},
          ${SystemRoleDescriptions[roleName]},
          NOW(),
          NOW(),
          NULL
        )
        ON CONFLICT ("name")
        DO UPDATE SET
          "description" = EXCLUDED."description",
          "updatedAt" = NOW(),
          "deleted_at" = NULL
      `,
    );
  }
}

async function seedDefaultPermissions(prisma: PrismaClient): Promise<void> {
  const uniquePermissions = uniqueByName(DefaultPermissionDefinitions);

  for (const permission of uniquePermissions) {
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Permission" (
          "id",
          "name",
          "description",
          "createdAt",
          "updatedAt",
          "deleted_at"
        )
        VALUES (
          ${randomUUID()},
          ${permission.name},
          ${permission.description},
          NOW(),
          NOW(),
          NULL
        )
        ON CONFLICT ("name")
        DO UPDATE SET
          "description" = EXCLUDED."description",
          "updatedAt" = NOW(),
          "deleted_at" = NULL
      `,
    );
  }
}

async function attachAllPermissionsToRole(
  prisma: PrismaClient,
  roleName: string,
): Promise<void> {
  const roleRows = await prisma.$queryRaw<
    Array<{
      id: string;
    }>
  >(
    Prisma.sql`
        SELECT "id"
        FROM "Role"
        WHERE
          "name" = ${roleName}
          AND "deleted_at" IS NULL
        LIMIT 1
      `,
  );

  const roleId = roleRows[0]?.id;

  if (!roleId) {
    throw new Error(`Role not found: ${roleName}`);
  }

  const permissionRows = await prisma.$queryRaw<
    Array<{
      id: string;
    }>
  >(
    Prisma.sql`
        SELECT "id"
        FROM "Permission"
        WHERE "deleted_at" IS NULL
      `,
  );

  for (const permission of permissionRows) {
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "RolePermission" (
          "roleId",
          "permissionId"
        )
        VALUES (
          ${roleId},
          ${permission.id}
        )
        ON CONFLICT (
          "roleId",
          "permissionId"
        )
        DO NOTHING
      `,
    );
  }
}

function uniqueByName<
  T extends {
    readonly name: string;
  },
>(items: readonly T[]): T[] {
  const map = new Map<string, T>();

  for (const item of items) {
    map.set(item.name, item);
  }

  return Array.from(map.values());
}
