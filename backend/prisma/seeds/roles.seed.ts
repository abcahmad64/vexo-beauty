import { PrismaClient } from '../../src/generated/prisma';

type RoleDefinition = {
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly string[];
  readonly includeAllPermissions?: boolean;
};

const roleDefinitions = [
  {
    name: 'SUPER_ADMIN',
    description: 'مدیر کل سیستم',
    includeAllPermissions: true,
    permissions: [],
  },
  {
    name: 'ADMIN',
    description: 'مدیر فروشگاه',
    permissions: [
      'users:read',
      'products:*',
      'orders:*',
      'payments:*',
      'refunds:*',
      'shipments:*',
      'invoices:*',
      'notifications:*',
      'analytics:*',
      'reports:*',
      'search:*',
      'catalog:*',
      'queue:*',
      'scheduler:*',
      'audit:*',
      'audits:*',
      'activity:*',
    ],
  },
  {
    name: 'CUSTOMER',
    description: 'مشتری فروشگاه',
    permissions: ['products:read', 'catalog:read'],
  },
] satisfies readonly RoleDefinition[];

export async function seedRoles(prisma: PrismaClient): Promise<void> {
  for (const roleDefinition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: {
        name: roleDefinition.name,
      },
      update: {
        description: roleDefinition.description,
        deletedAt: null,
      },
      create: {
        name: roleDefinition.name,
        description: roleDefinition.description,
      },
    });

    const permissions =
      roleDefinition.includeAllPermissions === true
        ? await prisma.permission.findMany({
            where: {
              deletedAt: null,
            },
            select: {
              id: true,
            },
          })
        : await prisma.permission.findMany({
            where: {
              name: {
                in: roleDefinition.permissions,
              },
              deletedAt: null,
            },
            select: {
              id: true,
            },
          });

    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
}
