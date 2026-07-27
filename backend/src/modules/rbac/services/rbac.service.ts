import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { ProtectedSystemRoles } from '../constants/rbac.constants';

import { AssignUserRoleDto } from '../dto/assign-user-role.dto';

import { CreatePermissionDto } from '../dto/create-permission.dto';

import { CreateRoleDto } from '../dto/create-role.dto';

import { QueryPermissionDto } from '../dto/query-permission.dto';

import { QueryRoleDto } from '../dto/query-role.dto';

import { SyncRolePermissionsDto } from '../dto/sync-role-permissions.dto';

import { UpdatePermissionDto } from '../dto/update-permission.dto';

import { UpdateRoleDto } from '../dto/update-role.dto';

type CountRow = {
  count: number | bigint;
};

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  permissionCount: number | bigint;
  userCount: number | bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type PermissionRow = {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  roleCount: number | bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type UserAccessRow = {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: string;
  roleId: string | null;
  roleName: string | null;
  roleDescription: string | null;
};

type MatrixRoleRow = {
  roleId: string;
  roleName: string;
  permissionId: string | null;
  permissionName: string | null;
};

@Injectable()
export class RbacService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 500;

  constructor(private readonly prisma: PrismaService) {}

  async findRoles(query: QueryRoleDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildRoleWhere(query, 'r');

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<RoleRow[]>(
        Prisma.sql`
            SELECT
              r."id",
              r."name",
              r."description",
              (
                SELECT COUNT(*)::int
                FROM "RolePermission" rp
                INNER JOIN "Permission" p
                  ON p."id" = rp."permissionId"
                WHERE
                  rp."roleId" = r."id"
                  AND p."deleted_at" IS NULL
              ) AS "permissionCount",
              (
                SELECT COUNT(*)::int
                FROM "User" u
                WHERE
                  u."roleId" = r."id"
                  AND u."deleted_at" IS NULL
              ) AS "userCount",
              r."createdAt",
              r."updatedAt",
              r."deleted_at" AS "deletedAt"
            FROM "Role" r
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolveRoleSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              r."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "Role" r
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapRole(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findRole(roleId: string) {
    const role = await this.findRoleRow(roleId, true);

    const permissions = await this.findRolePermissions(roleId, true);

    return {
      ...this.mapRole(role),
      permissions: permissions.map((permission) =>
        this.mapPermission(permission),
      ),
    };
  }

  async createRole(dto: CreateRoleDto, actorId?: string) {
    const roleName = this.normalizeRoleName(dto.name);

    await this.assertRoleNameUnique(roleName);

    const roleId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Role" (
          "id",
          "name",
          "description",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${roleId},
          ${roleName},
          ${dto.description ?? null},
          NOW(),
          NOW()
        )
      `,
    );

    return {
      role: await this.findRole(roleId),
      audit: {
        actorId: actorId ?? null,
        action: 'rbac.role_created',
      },
    };
  }

  async updateRole(roleId: string, dto: UpdateRoleDto, actorId?: string) {
    const role = await this.findRoleRow(roleId, true);

    if (
      this.isProtectedRoleName(role.name) &&
      dto.name !== undefined &&
      this.normalizeRoleName(dto.name) !== role.name
    ) {
      throw new BadRequestException('نام نقش‌های سیستمی قابل تغییر نیست.');
    }

    if (dto.name !== undefined) {
      const nextName = this.normalizeRoleName(dto.name);

      await this.assertRoleNameUnique(nextName, roleId);
    }

    const assignments = this.buildRoleAssignments(dto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی نقش ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Role"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = NOW()
        WHERE
          "id" = ${roleId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      role: await this.findRole(roleId),
      audit: {
        actorId: actorId ?? null,
        action: 'rbac.role_updated',
      },
    };
  }

  async deleteRole(roleId: string, actorId?: string) {
    const role = await this.findRoleRow(roleId, true);

    if (this.isProtectedRoleName(role.name)) {
      throw new BadRequestException('نقش سیستمی قابل حذف نیست.');
    }

    const usersCount = await this.countRoleUsers(roleId);

    if (usersCount > 0) {
      throw new BadRequestException(
        'این نقش به کاربران فعال اختصاص داده شده و قابل حذف نیست.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Role"
        SET
          "deleted_at" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${roleId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      success: true,
      message: 'نقش با موفقیت حذف شد.',
      audit: {
        actorId: actorId ?? null,
        action: 'rbac.role_deleted',
      },
    };
  }

  async restoreRole(roleId: string, actorId?: string) {
    await this.findRoleRow(roleId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Role"
        SET
          "deleted_at" = NULL,
          "updatedAt" = NOW()
        WHERE "id" = ${roleId}
      `,
    );

    return {
      role: await this.findRole(roleId),
      audit: {
        actorId: actorId ?? null,
        action: 'rbac.role_restored',
      },
    };
  }

  async findPermissions(query: QueryPermissionDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildPermissionWhere(query, 'p');

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<PermissionRow[]>(
        Prisma.sql`
            SELECT
              p."id",
              p."name",
              p."description",
              SPLIT_PART(p."name", ':', 1) AS "resource",
              CASE
                WHEN POSITION(':' IN p."name") > 0
                  THEN SPLIT_PART(p."name", ':', 2)
                ELSE ''
              END AS "action",
              (
                SELECT COUNT(*)::int
                FROM "RolePermission" rp
                INNER JOIN "Role" r
                  ON r."id" = rp."roleId"
                WHERE
                  rp."permissionId" = p."id"
                  AND r."deleted_at" IS NULL
              ) AS "roleCount",
              p."createdAt",
              p."updatedAt",
              p."deleted_at" AS "deletedAt"
            FROM "Permission" p
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolvePermissionSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              p."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "Permission" p
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapPermission(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findPermission(permissionId: string) {
    const permission = await this.findPermissionRow(permissionId, true);

    const roles = await this.findPermissionRoles(permissionId);

    return {
      ...this.mapPermission(permission),
      roles,
    };
  }

  async createPermission(dto: CreatePermissionDto, actorId?: string) {
    const permissionName = this.normalizePermissionName(dto.name);

    await this.assertPermissionNameUnique(permissionName);

    const permissionId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Permission" (
          "id",
          "name",
          "description",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${permissionId},
          ${permissionName},
          ${dto.description ?? null},
          NOW(),
          NOW()
        )
      `,
    );

    return {
      permission: await this.findPermission(permissionId),
      audit: {
        actorId: actorId ?? null,
        action: 'rbac.permission_created',
      },
    };
  }

  async updatePermission(
    permissionId: string,
    dto: UpdatePermissionDto,
    actorId?: string,
  ) {
    await this.findPermissionRow(permissionId, true);

    if (dto.name !== undefined) {
      await this.assertPermissionNameUnique(
        this.normalizePermissionName(dto.name),
        permissionId,
      );
    }

    const assignments = this.buildPermissionAssignments(dto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی مجوز ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Permission"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = NOW()
        WHERE
          "id" = ${permissionId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      permission: await this.findPermission(permissionId),
      audit: {
        actorId: actorId ?? null,
        action: 'rbac.permission_updated',
      },
    };
  }

  async deletePermission(permissionId: string, actorId?: string) {
    const usageCount = await this.countPermissionRoles(permissionId);

    if (usageCount > 0) {
      throw new BadRequestException(
        'این مجوز به نقش‌ها اختصاص داده شده و قابل حذف نیست.',
      );
    }

    await this.findPermissionRow(permissionId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Permission"
        SET
          "deleted_at" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${permissionId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      success: true,
      message: 'مجوز با موفقیت حذف شد.',
      audit: {
        actorId: actorId ?? null,
        action: 'rbac.permission_deleted',
      },
    };
  }

  async restorePermission(permissionId: string, actorId?: string) {
    await this.findPermissionRow(permissionId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Permission"
        SET
          "deleted_at" = NULL,
          "updatedAt" = NOW()
        WHERE "id" = ${permissionId}
      `,
    );

    return {
      permission: await this.findPermission(permissionId),
      audit: {
        actorId: actorId ?? null,
        action: 'rbac.permission_restored',
      },
    };
  }

  async syncRolePermissions(
    roleId: string,
    dto: SyncRolePermissionsDto,
    actorId?: string,
  ) {
    const role = await this.findRoleRow(roleId, false);

    const permissionIds = await this.resolvePermissionIds(
      dto.permissionIds ?? [],
      dto.permissionNames ?? [],
    );

    if (permissionIds.length === 0) {
      throw new BadRequestException(
        'هیچ مجوز معتبری برای همگام‌سازی ارسال نشده است.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.mode === 'replace') {
        await tx.$executeRaw(
          Prisma.sql`
              DELETE FROM "RolePermission"
              WHERE "roleId" = ${roleId}
            `,
        );
      }

      if (dto.mode === 'remove') {
        await tx.$executeRaw(
          Prisma.sql`
              DELETE FROM "RolePermission"
              WHERE
                "roleId" = ${roleId}
                AND "permissionId" IN (${Prisma.join(permissionIds)})
            `,
        );

        return;
      }

      for (const permissionId of permissionIds) {
        await tx.$executeRaw(
          Prisma.sql`
              INSERT INTO "RolePermission" (
                "roleId",
                "permissionId"
              )
              VALUES (
                ${roleId},
                ${permissionId}
              )
              ON CONFLICT ("roleId", "permissionId") DO NOTHING
            `,
        );
      }
    });

    return {
      role: await this.findRole(roleId),
      audit: {
        actorId: actorId ?? null,
        action: `rbac.role_permissions_${dto.mode}`,
        roleName: role.name,
        reason: dto.reason ?? null,
      },
    };
  }

  async getRolePermissions(roleId: string) {
    await this.findRoleRow(roleId, true);

    const permissions = await this.findRolePermissions(roleId, true);

    return {
      data: permissions.map((permission) => this.mapPermission(permission)),
      meta: {
        roleId,
        total: permissions.length,
      },
    };
  }

  async assignUserRole(
    userId: string,
    dto: AssignUserRoleDto,
    actorId?: string,
  ) {
    const roleId = await this.resolveRoleId(dto.roleId, dto.roleName);

    await this.assertUserExists(userId);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          "roleId" = ${roleId},
          "updatedAt" = NOW()
        WHERE
          "id" = ${userId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      access: await this.getUserAccess(userId),
      audit: {
        actorId: actorId ?? null,
        action: 'rbac.user_role_assigned',
        reason: dto.reason ?? null,
      },
    };
  }

  async revokeUserRole(userId: string, actorId?: string) {
    await this.assertUserExists(userId);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          "roleId" = NULL,
          "updatedAt" = NOW()
        WHERE
          "id" = ${userId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      access: await this.getUserAccess(userId),
      audit: {
        actorId: actorId ?? null,
        action: 'rbac.user_role_revoked',
      },
    };
  }

  async getUserAccess(userId: string) {
    const user = await this.findUserAccessRow(userId);

    const permissions = user.roleId
      ? await this.findRolePermissions(user.roleId, false)
      : [];

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`.trim(),
        status: user.status,
      },
      role: {
        id: user.roleId,
        name: user.roleName,
        description: user.roleDescription,
      },
      permissions: permissions.map((permission) => permission.name),
      permissionObjects: permissions.map((permission) =>
        this.mapPermission(permission),
      ),
    };
  }

  async roleHasPermission(roleId: string, permissionName: string) {
    const role = await this.findRoleRow(roleId, true);

    const permissions = await this.findRolePermissions(roleId, false);

    const normalizedPermission = this.normalizePermissionName(permissionName);

    const directMatch = permissions.some(
      (permission) => permission.name.toLowerCase() === normalizedPermission,
    );

    const effectiveMatch = permissions.some((permission) =>
      this.permissionMatches(permission.name, normalizedPermission),
    );

    return {
      roleId,
      roleName: role.name,
      permissionName: normalizedPermission,
      directMatch,
      effectiveMatch,
    };
  }

  async getPermissionMatrix() {
    const rows = await this.prisma.$queryRaw<MatrixRoleRow[]>(
      Prisma.sql`
          SELECT
            r."id" AS "roleId",
            r."name" AS "roleName",
            p."id" AS "permissionId",
            p."name" AS "permissionName"
          FROM "Role" r
          LEFT JOIN "RolePermission" rp
            ON rp."roleId" = r."id"
          LEFT JOIN "Permission" p
            ON p."id" = rp."permissionId"
            AND p."deleted_at" IS NULL
          WHERE r."deleted_at" IS NULL
          ORDER BY
            r."name" ASC,
            p."name" ASC
        `,
    );

    const roleMap = new Map<
      string,
      {
        roleId: string;
        roleName: string;
        permissions: string[];
      }
    >();

    for (const row of rows) {
      if (!roleMap.has(row.roleId)) {
        roleMap.set(row.roleId, {
          roleId: row.roleId,
          roleName: row.roleName,
          permissions: [],
        });
      }

      if (row.permissionName) {
        roleMap.get(row.roleId)?.permissions.push(row.permissionName);
      }
    }

    return {
      data: Array.from(roleMap.values()),
      meta: {
        roleCount: roleMap.size,
      },
    };
  }

  private async findRoleRow(
    roleId: string,
    includeDeleted: boolean,
  ): Promise<RoleRow> {
    const where: Prisma.Sql[] = [Prisma.sql`r."id" = ${roleId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`r."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<RoleRow[]>(
      Prisma.sql`
          SELECT
            r."id",
            r."name",
            r."description",
            (
              SELECT COUNT(*)::int
              FROM "RolePermission" rp
              INNER JOIN "Permission" p
                ON p."id" = rp."permissionId"
              WHERE
                rp."roleId" = r."id"
                AND p."deleted_at" IS NULL
            ) AS "permissionCount",
            (
              SELECT COUNT(*)::int
              FROM "User" u
              WHERE
                u."roleId" = r."id"
                AND u."deleted_at" IS NULL
            ) AS "userCount",
            r."createdAt",
            r."updatedAt",
            r."deleted_at" AS "deletedAt"
          FROM "Role" r
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const role = rows[0];

    if (!role) {
      throw new NotFoundException('نقش موردنظر یافت نشد.');
    }

    return role;
  }

  private async findPermissionRow(
    permissionId: string,
    includeDeleted: boolean,
  ): Promise<PermissionRow> {
    const where: Prisma.Sql[] = [Prisma.sql`p."id" = ${permissionId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`p."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<PermissionRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."name",
            p."description",
            SPLIT_PART(p."name", ':', 1) AS "resource",
            CASE
              WHEN POSITION(':' IN p."name") > 0
                THEN SPLIT_PART(p."name", ':', 2)
              ELSE ''
            END AS "action",
            (
              SELECT COUNT(*)::int
              FROM "RolePermission" rp
              INNER JOIN "Role" r
                ON r."id" = rp."roleId"
              WHERE
                rp."permissionId" = p."id"
                AND r."deleted_at" IS NULL
            ) AS "roleCount",
            p."createdAt",
            p."updatedAt",
            p."deleted_at" AS "deletedAt"
          FROM "Permission" p
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const permission = rows[0];

    if (!permission) {
      throw new NotFoundException('مجوز موردنظر یافت نشد.');
    }

    return permission;
  }

  private async findRolePermissions(
    roleId: string,
    includeDeleted: boolean,
  ): Promise<PermissionRow[]> {
    const where: Prisma.Sql[] = [Prisma.sql`rp."roleId" = ${roleId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`p."deleted_at" IS NULL`);
    }

    return this.prisma.$queryRaw<PermissionRow[]>(
      Prisma.sql`
        SELECT
          p."id",
          p."name",
          p."description",
          SPLIT_PART(p."name", ':', 1) AS "resource",
          CASE
            WHEN POSITION(':' IN p."name") > 0
              THEN SPLIT_PART(p."name", ':', 2)
            ELSE ''
          END AS "action",
          (
            SELECT COUNT(*)::int
            FROM "RolePermission" rp2
            INNER JOIN "Role" r
              ON r."id" = rp2."roleId"
            WHERE
              rp2."permissionId" = p."id"
              AND r."deleted_at" IS NULL
          ) AS "roleCount",
          p."createdAt",
          p."updatedAt",
          p."deleted_at" AS "deletedAt"
        FROM "RolePermission" rp
        INNER JOIN "Permission" p
          ON p."id" = rp."permissionId"
        WHERE ${Prisma.join(where, ' AND ')}
        ORDER BY p."name" ASC
      `,
    );
  }

  private async findPermissionRoles(permissionId: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        description: string | null;
      }>
    >(
      Prisma.sql`
          SELECT
            r."id",
            r."name",
            r."description"
          FROM "RolePermission" rp
          INNER JOIN "Role" r
            ON r."id" = rp."roleId"
          WHERE
            rp."permissionId" = ${permissionId}
            AND r."deleted_at" IS NULL
          ORDER BY r."name" ASC
        `,
    );

    return rows;
  }

  private async findUserAccessRow(userId: string): Promise<UserAccessRow> {
    const rows = await this.prisma.$queryRaw<UserAccessRow[]>(
      Prisma.sql`
          SELECT
            u."id",
            u."email",
            u."phone",
            u."firstName",
            u."lastName",
            u."status"::text AS "status",
            u."roleId",
            r."name" AS "roleName",
            r."description" AS "roleDescription"
          FROM "User" u
          LEFT JOIN "Role" r
            ON r."id" = u."roleId"
          WHERE
            u."id" = ${userId}
            AND u."deleted_at" IS NULL
          LIMIT 1
        `,
    );

    const user = rows[0];

    if (!user) {
      throw new NotFoundException('کاربر موردنظر یافت نشد.');
    }

    return user;
  }

  private buildRoleWhere(query: QueryRoleDto, alias: string): Prisma.Sql[] {
    const table = Prisma.raw(alias);

    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`${table}."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          ${table}."name" ILIKE ${`%${query.q}%`}
          OR ${table}."description" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.name) {
      where.push(Prisma.sql`${table}."name" ILIKE ${`%${query.name}%`}`);
    }

    if (query.hasUsers === true) {
      where.push(
        Prisma.sql`EXISTS (
          SELECT 1
          FROM "User" u
          WHERE
            u."roleId" = ${table}."id"
            AND u."deleted_at" IS NULL
        )`,
      );
    }

    if (query.hasUsers === false) {
      where.push(
        Prisma.sql`NOT EXISTS (
          SELECT 1
          FROM "User" u
          WHERE
            u."roleId" = ${table}."id"
            AND u."deleted_at" IS NULL
        )`,
      );
    }

    if (query.hasPermissions === true) {
      where.push(
        Prisma.sql`EXISTS (
          SELECT 1
          FROM "RolePermission" rp
          WHERE rp."roleId" = ${table}."id"
        )`,
      );
    }

    if (query.hasPermissions === false) {
      where.push(
        Prisma.sql`NOT EXISTS (
          SELECT 1
          FROM "RolePermission" rp
          WHERE rp."roleId" = ${table}."id"
        )`,
      );
    }

    if (query.createdFrom) {
      where.push(
        Prisma.sql`${table}."createdAt" >= ${new Date(query.createdFrom)}`,
      );
    }

    if (query.createdTo) {
      where.push(
        Prisma.sql`${table}."createdAt" <= ${new Date(query.createdTo)}`,
      );
    }

    return where;
  }

  private buildPermissionWhere(
    query: QueryPermissionDto,
    alias: string,
  ): Prisma.Sql[] {
    const table = Prisma.raw(alias);

    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`${table}."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          ${table}."name" ILIKE ${`%${query.q}%`}
          OR ${table}."description" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.name) {
      where.push(Prisma.sql`${table}."name" ILIKE ${`%${query.name}%`}`);
    }

    if (query.resource) {
      where.push(
        Prisma.sql`SPLIT_PART(${table}."name", ':', 1) ILIKE ${`%${query.resource}%`}`,
      );
    }

    if (query.hasRoles === true) {
      where.push(
        Prisma.sql`EXISTS (
          SELECT 1
          FROM "RolePermission" rp
          WHERE rp."permissionId" = ${table}."id"
        )`,
      );
    }

    if (query.hasRoles === false) {
      where.push(
        Prisma.sql`NOT EXISTS (
          SELECT 1
          FROM "RolePermission" rp
          WHERE rp."permissionId" = ${table}."id"
        )`,
      );
    }

    if (query.createdFrom) {
      where.push(
        Prisma.sql`${table}."createdAt" >= ${new Date(query.createdFrom)}`,
      );
    }

    if (query.createdTo) {
      where.push(
        Prisma.sql`${table}."createdAt" <= ${new Date(query.createdTo)}`,
      );
    }

    return where;
  }

  private buildRoleAssignments(dto: UpdateRoleDto): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.name !== undefined) {
      assignments.push(
        Prisma.sql`"name" = ${this.normalizeRoleName(dto.name)}`,
      );
    }

    if (dto.description !== undefined) {
      assignments.push(Prisma.sql`"description" = ${dto.description}`);
    }

    return assignments;
  }

  private buildPermissionAssignments(dto: UpdatePermissionDto): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.name !== undefined) {
      assignments.push(
        Prisma.sql`"name" = ${this.normalizePermissionName(dto.name)}`,
      );
    }

    if (dto.description !== undefined) {
      assignments.push(Prisma.sql`"description" = ${dto.description}`);
    }

    return assignments;
  }

  private async resolvePermissionIds(
    permissionIds: string[],
    permissionNames: string[],
  ): Promise<string[]> {
    const ids = Array.from(
      new Set(permissionIds.filter((id) => id.trim().length > 0)),
    );

    const names = Array.from(
      new Set(
        permissionNames.map((name) => this.normalizePermissionName(name)),
      ),
    );

    const resolvedIds = new Set<string>();

    if (ids.length > 0) {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
        }>
      >(
        Prisma.sql`
            SELECT "id"
            FROM "Permission"
            WHERE
              "id" IN (${Prisma.join(ids)})
              AND "deleted_at" IS NULL
          `,
      );

      if (rows.length !== ids.length) {
        throw new BadRequestException('برخی شناسه‌های مجوز معتبر نیستند.');
      }

      for (const row of rows) {
        resolvedIds.add(row.id);
      }
    }

    if (names.length > 0) {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
        }>
      >(
        Prisma.sql`
            SELECT "id"
            FROM "Permission"
            WHERE
              LOWER("name") IN (${Prisma.join(
                names.map((name) => name.toLowerCase()),
              )})
              AND "deleted_at" IS NULL
          `,
      );

      if (rows.length !== names.length) {
        throw new BadRequestException('برخی نام‌های مجوز معتبر نیستند.');
      }

      for (const row of rows) {
        resolvedIds.add(row.id);
      }
    }

    return Array.from(resolvedIds);
  }

  private async resolveRoleId(
    roleId?: string,
    roleName?: string,
  ): Promise<string> {
    if (!roleId && !roleName) {
      throw new BadRequestException(
        'برای اختصاص نقش باید roleId یا roleName ارسال شود.',
      );
    }

    const where = roleId
      ? Prisma.sql`"id" = ${roleId}`
      : Prisma.sql`LOWER("name") = LOWER(${this.normalizeRoleName(roleName ?? '')})`;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
      }>
    >(
      Prisma.sql`
          SELECT "id"
          FROM "Role"
          WHERE
            ${where}
            AND "deleted_at" IS NULL
          LIMIT 1
        `,
    );

    const resolvedRoleId = rows[0]?.id;

    if (!resolvedRoleId) {
      throw new BadRequestException('نقش انتخاب‌شده معتبر نیست.');
    }

    return resolvedRoleId;
  }

  private async assertRoleNameUnique(
    name: string,
    exceptRoleId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [Prisma.sql`LOWER("name") = LOWER(${name})`];

    if (exceptRoleId) {
      where.push(Prisma.sql`"id" <> ${exceptRoleId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "Role"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('نام نقش تکراری است.');
    }
  }

  private async assertPermissionNameUnique(
    name: string,
    exceptPermissionId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [Prisma.sql`LOWER("name") = LOWER(${name})`];

    if (exceptPermissionId) {
      where.push(Prisma.sql`"id" <> ${exceptPermissionId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "Permission"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('نام مجوز تکراری است.');
    }
  }

  private async assertUserExists(userId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "User"
          WHERE
            "id" = ${userId}
            AND "deleted_at" IS NULL
            AND "status"::text <> 'DELETED'
        `,
    );

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException('کاربر انتخاب‌شده معتبر نیست.');
    }
  }

  private async countRoleUsers(roleId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "User"
          WHERE
            "roleId" = ${roleId}
            AND "deleted_at" IS NULL
        `,
    );

    return this.toNumber(rows[0]?.count);
  }

  private async countPermissionRoles(permissionId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "RolePermission"
          WHERE "permissionId" = ${permissionId}
        `,
    );

    return this.toNumber(rows[0]?.count);
  }

  private mapRole(row: RoleRow) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isSystem: this.isProtectedRoleName(row.name),
      permissionCount: this.toNumber(row.permissionCount),
      userCount: this.toNumber(row.userCount),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }

  private mapPermission(row: PermissionRow) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      resource: row.resource,
      action: row.action,
      roleCount: this.toNumber(row.roleCount),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }

  private resolveRoleSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`r."updatedAt"`;
    }

    if (sortBy === 'name') {
      return Prisma.sql`r."name"`;
    }

    if (sortBy === 'userCount') {
      return Prisma.sql`"userCount"`;
    }

    if (sortBy === 'permissionCount') {
      return Prisma.sql`"permissionCount"`;
    }

    return Prisma.sql`r."createdAt"`;
  }

  private resolvePermissionSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`p."updatedAt"`;
    }

    if (sortBy === 'name') {
      return Prisma.sql`p."name"`;
    }

    if (sortBy === 'roleCount') {
      return Prisma.sql`"roleCount"`;
    }

    return Prisma.sql`p."createdAt"`;
  }

  private resolveSortDirection(sortDirection?: string): Prisma.Sql {
    return sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  }

  private normalizeRoleName(value: string): string {
    return value.trim().toUpperCase().replace(/\s+/g, '_');
  }

  private normalizePermissionName(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '');
  }

  private isProtectedRoleName(roleName: string): boolean {
    return (ProtectedSystemRoles as readonly string[]).includes(
      roleName.toUpperCase(),
    );
  }

  private permissionMatches(
    ownedPermission: string,
    requiredPermission: string,
  ): boolean {
    const owned = ownedPermission.toLowerCase();

    const required = requiredPermission.toLowerCase();

    if (owned === '*' || owned === 'admin:*') {
      return true;
    }

    if (owned === required) {
      return true;
    }

    if (owned.endsWith(':*')) {
      const prefix = owned.slice(0, -1);

      return required.startsWith(prefix);
    }

    return false;
  }

  private normalizePage(page?: number): number {
    if (!page || page < 1) {
      return this.defaultPage;
    }

    return page;
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || limit < 1) {
      return this.defaultLimit;
    }

    return Math.min(limit, this.maxLimit);
  }

  private toNumber(value: unknown): number {
    if (value === undefined || value === null) {
      return 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    return Number(value);
  }
}
