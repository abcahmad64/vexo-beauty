import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';
import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { AdminQueryUserDto } from '../dto/admin-query-user.dto';
import { AdminUpdateUserStatusDto } from '../dto/admin-update-user-status.dto';
import { AdminUpdateUserDto } from '../dto/admin-update-user.dto';

type CountRow = {
  readonly count: number | bigint;
};

export type AdminUserRow = {
  readonly id: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly avatarUrl: string | null;
  readonly status: string;
  readonly roleId: string | null;
  readonly roleName: string | null;
  readonly roleDescription: string | null;
  readonly orderCount: number | bigint;
  readonly completedOrderCount: number | bigint;
  readonly cancelledOrderCount: number | bigint;
  readonly totalSpent: Prisma.Decimal | number | string | null;
  readonly paymentCount: number | bigint;
  readonly addressCount: number | bigint;
  readonly reviewCount: number | bigint;
  readonly unreadNotificationCount: number | bigint;
  readonly sessionCount: number | bigint;
  readonly lastOrderAt: Date | null;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
};

@Injectable()
export class AdminUserService {
  private readonly defaultPage = 1;
  private readonly defaultLimit = 20;
  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminQueryUserDto) {
    const page = this.normalizePage(query.page);
    const limit = this.normalizeLimit(query.limit);
    const skip = (page - 1) * limit;
    const where = this.buildUserWhere(query, 'u');

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AdminUserRow[]>(
        Prisma.sql`
          SELECT
            u."id",
            u."email",
            u."phone",
            u."firstName",
            u."lastName",
            u."avatarUrl",
            u."status"::text AS "status",
            u."roleId",
            r."name" AS "roleName",
            r."description" AS "roleDescription",
            COALESCE(stats."orderCount", 0)::int AS "orderCount",
            COALESCE(stats."completedOrderCount", 0)::int AS "completedOrderCount",
            COALESCE(stats."cancelledOrderCount", 0)::int AS "cancelledOrderCount",
            COALESCE(stats."totalSpent", 0)::numeric AS "totalSpent",
            COALESCE(stats."paymentCount", 0)::int AS "paymentCount",
            COALESCE(stats."addressCount", 0)::int AS "addressCount",
            COALESCE(stats."reviewCount", 0)::int AS "reviewCount",
            COALESCE(stats."unreadNotificationCount", 0)::int AS "unreadNotificationCount",
            COALESCE(stats."sessionCount", 0)::int AS "sessionCount",
            stats."lastOrderAt",
            stats."lastLoginAt",
            u."createdAt",
            u."updatedAt",
            u."deleted_at" AS "deletedAt"
          FROM "User" u
          LEFT JOIN "Role" r
            ON r."id" = u."roleId"
          LEFT JOIN LATERAL (
            SELECT
              (
                SELECT COUNT(*)::int
                FROM "Order" o
                WHERE
                  o."userId" = u."id"
                  AND o."deleted_at" IS NULL
              ) AS "orderCount",
              (
                SELECT COUNT(*)::int
                FROM "Order" o
                WHERE
                  o."userId" = u."id"
                  AND o."deleted_at" IS NULL
                  AND o."status"::text = 'DELIVERED'
              ) AS "completedOrderCount",
              (
                SELECT COUNT(*)::int
                FROM "Order" o
                WHERE
                  o."userId" = u."id"
                  AND o."deleted_at" IS NULL
                  AND o."status"::text = 'CANCELLED'
              ) AS "cancelledOrderCount",
              (
                SELECT COALESCE(SUM(o."totalAmount"), 0)::numeric
                FROM "Order" o
                WHERE
                  o."userId" = u."id"
                  AND o."deleted_at" IS NULL
                  AND o."paymentStatus"::text IN ('COMPLETED', 'PARTIAL_REFUNDED')
              ) AS "totalSpent",
              (
                SELECT COUNT(*)::int
                FROM "Payment" p
                WHERE
                  p."userId" = u."id"
                  AND p."deleted_at" IS NULL
              ) AS "paymentCount",
              (
                SELECT COUNT(*)::int
                FROM "Address" a
                WHERE
                  a."userId" = u."id"
                  AND a."deleted_at" IS NULL
              ) AS "addressCount",
              (
                SELECT COUNT(*)::int
                FROM "ProductReview" pr
                WHERE
                  pr."userId" = u."id"
              ) AS "reviewCount",
              (
                SELECT COUNT(*)::int
                FROM "Notification" n
                WHERE
                  n."userId" = u."id"
                  AND n."deleted_at" IS NULL
                  AND n."isActive" = TRUE
                  AND n."isRead" = FALSE
              ) AS "unreadNotificationCount",
              (
                SELECT COUNT(*)::int
                FROM "UserSession" s
                WHERE
                  s."userId" = u."id"
                  AND s."deleted_at" IS NULL
              ) AS "sessionCount",
              (
                SELECT MAX(o."createdAt")
                FROM "Order" o
                WHERE
                  o."userId" = u."id"
                  AND o."deleted_at" IS NULL
              ) AS "lastOrderAt",
              (
                SELECT MAX(s."createdAt")
                FROM "UserSession" s
                WHERE
                  s."userId" = u."id"
                  AND s."deleted_at" IS NULL
              ) AS "lastLoginAt"
          ) stats ON TRUE
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            ${this.resolveSortColumn(query.sortBy)}
            ${this.resolveSortDirection(query.sortDirection)},
            u."id" DESC
          LIMIT ${limit}
          OFFSET ${skip}
        `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "User" u
          LEFT JOIN "Role" r
            ON r."id" = u."roleId"
          LEFT JOIN LATERAL (
            SELECT
              (
                SELECT COUNT(*)::int
                FROM "Order" o
                WHERE
                  o."userId" = u."id"
                  AND o."deleted_at" IS NULL
              ) AS "orderCount",
              (
                SELECT COUNT(*)::int
                FROM "Payment" p
                WHERE
                  p."userId" = u."id"
                  AND p."deleted_at" IS NULL
              ) AS "paymentCount",
              (
                SELECT MAX(s."createdAt")
                FROM "UserSession" s
                WHERE
                  s."userId" = u."id"
                  AND s."deleted_at" IS NULL
              ) AS "lastLoginAt"
          ) stats ON TRUE
          WHERE ${Prisma.join(where, ' AND ')}
        `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapUser(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string) {
    const row = await this.findUserRow(userId, true);

    return this.mapUser(row);
  }

  async update(userId: string, dto: AdminUpdateUserDto, actorId?: string) {
    await this.findUserRow(userId, true);

    if (dto.email !== undefined && dto.email !== null) {
      await this.assertEmailUnique(dto.email, userId);
    }

    if (dto.phone !== undefined && dto.phone !== null) {
      await this.assertPhoneUnique(dto.phone, userId);
    }

    if (dto.roleId !== undefined && dto.roleId !== null) {
      await this.assertRoleExists(dto.roleId);
    }

    const assignments = this.buildUpdateAssignments(dto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی کاربر ارسال نشده است.',
      );
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = ${now}
        WHERE
          "id" = ${userId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      user: await this.findOne(userId),
      updatedAt: now.toISOString(),
      updatedAtFa: formatPersianDateTime(now),
      audit: {
        actorId: actorId ?? null,
        action: 'user.admin_updated',
      },
    };
  }

  async updateStatus(
    userId: string,
    dto: AdminUpdateUserStatusDto,
    actorId?: string,
  ) {
    await this.findUserRow(userId, true);

    const now = new Date();
    const deletedAtSql =
      dto.status === 'DELETED' ? Prisma.sql`${now}` : Prisma.sql`NULL`;

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          "status" = ${dto.status}::"UserStatus",
          "deleted_at" = ${deletedAtSql},
          "updatedAt" = ${now}
        WHERE "id" = ${userId}
      `,
    );

    return {
      user: await this.findOne(userId),
      updatedAt: now.toISOString(),
      updatedAtFa: formatPersianDateTime(now),
      audit: {
        actorId: actorId ?? null,
        action: 'user.status_updated',
        reason: dto.reason ?? null,
      },
    };
  }

  async delete(userId: string, actorId?: string) {
    await this.findUserRow(userId, true);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          "status" = 'DELETED'::"UserStatus",
          "deleted_at" = ${now},
          "updatedAt" = ${now}
        WHERE
          "id" = ${userId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      success: true,
      message: 'کاربر با موفقیت حذف شد.',
      deletedAt: now.toISOString(),
      deletedAtFa: formatPersianDateTime(now),
      audit: {
        actorId: actorId ?? null,
        action: 'user.admin_deleted',
      },
    };
  }

  async restore(userId: string, actorId?: string) {
    await this.findUserRow(userId, true);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          "status" = 'ACTIVE'::"UserStatus",
          "deleted_at" = NULL,
          "updatedAt" = ${now}
        WHERE "id" = ${userId}
      `,
    );

    return {
      user: await this.findOne(userId),
      restoredAt: now.toISOString(),
      restoredAtFa: formatPersianDateTime(now),
      audit: {
        actorId: actorId ?? null,
        action: 'user.admin_restored',
      },
    };
  }

  async revokeSessions(userId: string, actorId?: string) {
    await this.findUserRow(userId, true);

    const now = new Date();

    const [deletedTokens, updatedSessions] = await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({
        where: {
          userId,
        },
      }),
      this.prisma.userSession.updateMany({
        where: {
          userId,
          deletedAt: null,
        },
        data: {
          deletedAt: now,
        },
      }),
    ]);

    return {
      success: true,
      revokedCount: updatedSessions.count,
      revokedRefreshTokens: deletedTokens.count,
      revokedSessions: updatedSessions.count,
      revokedAt: now.toISOString(),
      revokedAtFa: formatPersianDateTime(now),
      audit: {
        actorId: actorId ?? null,
        action: 'user.sessions_revoked',
      },
    };
  }

  async findUserRow(
    userId: string,
    includeDeleted: boolean,
  ): Promise<AdminUserRow> {
    const where: Prisma.Sql[] = [Prisma.sql`u."id" = ${userId}`];

    if (!includeDeleted) {
      where.push(
        Prisma.sql`u."deleted_at" IS NULL`,
        Prisma.sql`u."status"::text <> 'DELETED'`,
      );
    }

    const rows = await this.prisma.$queryRaw<AdminUserRow[]>(
      Prisma.sql`
        SELECT
          u."id",
          u."email",
          u."phone",
          u."firstName",
          u."lastName",
          u."avatarUrl",
          u."status"::text AS "status",
          u."roleId",
          r."name" AS "roleName",
          r."description" AS "roleDescription",
          COALESCE(stats."orderCount", 0)::int AS "orderCount",
          COALESCE(stats."completedOrderCount", 0)::int AS "completedOrderCount",
          COALESCE(stats."cancelledOrderCount", 0)::int AS "cancelledOrderCount",
          COALESCE(stats."totalSpent", 0)::numeric AS "totalSpent",
          COALESCE(stats."paymentCount", 0)::int AS "paymentCount",
          COALESCE(stats."addressCount", 0)::int AS "addressCount",
          COALESCE(stats."reviewCount", 0)::int AS "reviewCount",
          COALESCE(stats."unreadNotificationCount", 0)::int AS "unreadNotificationCount",
          COALESCE(stats."sessionCount", 0)::int AS "sessionCount",
          stats."lastOrderAt",
          stats."lastLoginAt",
          u."createdAt",
          u."updatedAt",
          u."deleted_at" AS "deletedAt"
        FROM "User" u
        LEFT JOIN "Role" r
          ON r."id" = u."roleId"
        LEFT JOIN LATERAL (
          SELECT
            (
              SELECT COUNT(*)::int
              FROM "Order" o
              WHERE
                o."userId" = u."id"
                AND o."deleted_at" IS NULL
            ) AS "orderCount",
            (
              SELECT COUNT(*)::int
              FROM "Order" o
              WHERE
                o."userId" = u."id"
                AND o."deleted_at" IS NULL
                AND o."status"::text = 'DELIVERED'
            ) AS "completedOrderCount",
            (
              SELECT COUNT(*)::int
              FROM "Order" o
              WHERE
                o."userId" = u."id"
                AND o."deleted_at" IS NULL
                AND o."status"::text = 'CANCELLED'
            ) AS "cancelledOrderCount",
            (
              SELECT COALESCE(SUM(o."totalAmount"), 0)::numeric
              FROM "Order" o
              WHERE
                o."userId" = u."id"
                AND o."deleted_at" IS NULL
                AND o."paymentStatus"::text IN ('COMPLETED', 'PARTIAL_REFUNDED')
            ) AS "totalSpent",
            (
              SELECT COUNT(*)::int
              FROM "Payment" p
              WHERE
                p."userId" = u."id"
                AND p."deleted_at" IS NULL
            ) AS "paymentCount",
            (
              SELECT COUNT(*)::int
              FROM "Address" a
              WHERE
                a."userId" = u."id"
                AND a."deleted_at" IS NULL
            ) AS "addressCount",
            (
              SELECT COUNT(*)::int
              FROM "ProductReview" pr
              WHERE
                pr."userId" = u."id"
            ) AS "reviewCount",
            (
              SELECT COUNT(*)::int
              FROM "Notification" n
              WHERE
                n."userId" = u."id"
                AND n."deleted_at" IS NULL
                AND n."isActive" = TRUE
                AND n."isRead" = FALSE
            ) AS "unreadNotificationCount",
            (
              SELECT COUNT(*)::int
              FROM "UserSession" s
              WHERE
                s."userId" = u."id"
                AND s."deleted_at" IS NULL
            ) AS "sessionCount",
            (
              SELECT MAX(o."createdAt")
              FROM "Order" o
              WHERE
                o."userId" = u."id"
                AND o."deleted_at" IS NULL
            ) AS "lastOrderAt",
            (
              SELECT MAX(s."createdAt")
              FROM "UserSession" s
              WHERE
                s."userId" = u."id"
                AND s."deleted_at" IS NULL
            ) AS "lastLoginAt"
        ) stats ON TRUE
        WHERE ${Prisma.join(where, ' AND ')}
        LIMIT 1
      `,
    );

    const user = rows[0];

    if (!user) {
      throw new NotFoundException('کاربر موردنظر یافت نشد.');
    }

    return user;
  }

  mapUser(row: AdminUserRow) {
    const firstName = this.normalizeNullableString(row.firstName);
    const lastName = this.normalizeNullableString(row.lastName);

    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      firstName,
      lastName,
      fullName: `${firstName ?? ''} ${lastName ?? ''}`.trim(),
      avatarUrl: row.avatarUrl,
      status: row.status,
      role:
        row.roleId || row.roleName || row.roleDescription
          ? {
              id: row.roleId,
              name: row.roleName,
              description: row.roleDescription,
            }
          : null,
      stats: {
        orderCount: this.toNumber(row.orderCount),
        completedOrderCount: this.toNumber(row.completedOrderCount),
        cancelledOrderCount: this.toNumber(row.cancelledOrderCount),
        totalSpent: this.toDecimalString(row.totalSpent ?? 0),
        paymentCount: this.toNumber(row.paymentCount),
        addressCount: this.toNumber(row.addressCount),
        reviewCount: this.toNumber(row.reviewCount),
        unreadNotificationCount: this.toNumber(row.unreadNotificationCount),
        sessionCount: this.toNumber(row.sessionCount),
        lastOrderAt: row.lastOrderAt ? row.lastOrderAt.toISOString() : null,
        lastOrderAtFa: formatPersianDateTime(row.lastOrderAt),
        lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
        lastLoginAtFa: formatPersianDateTime(row.lastLoginAt),
      },
      createdAt: row.createdAt.toISOString(),
      createdAtFa: formatPersianDateTime(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: formatPersianDateTime(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: formatPersianDateTime(row.deletedAt),
    };
  }

  private buildUserWhere(
    query: AdminQueryUserDto,
    alias: string,
  ): Prisma.Sql[] {
    const table = Prisma.raw(alias);
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(
        Prisma.sql`${table}."deleted_at" IS NULL`,
        Prisma.sql`${table}."status"::text <> 'DELETED'`,
      );
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          ${table}."email" ILIKE ${`%${query.q}%`}
          OR ${table}."phone" ILIKE ${`%${query.q}%`}
          OR ${table}."firstName" ILIKE ${`%${query.q}%`}
          OR ${table}."lastName" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.email) {
      where.push(Prisma.sql`${table}."email" ILIKE ${`%${query.email}%`}`);
    }

    if (query.phone) {
      where.push(Prisma.sql`${table}."phone" ILIKE ${`%${query.phone}%`}`);
    }

    if (query.roleId) {
      where.push(Prisma.sql`${table}."roleId" = ${query.roleId}`);
    }

    if (query.roleName) {
      where.push(Prisma.sql`r."name" ILIKE ${`%${query.roleName}%`}`);
    }

    if (query.status) {
      where.push(Prisma.sql`${table}."status"::text = ${query.status}`);
    }

    if (query.hasOrders === true) {
      where.push(Prisma.sql`COALESCE(stats."orderCount", 0) > 0`);
    }

    if (query.hasOrders === false) {
      where.push(Prisma.sql`COALESCE(stats."orderCount", 0) = 0`);
    }

    if (query.hasPayments === true) {
      where.push(Prisma.sql`COALESCE(stats."paymentCount", 0) > 0`);
    }

    if (query.hasPayments === false) {
      where.push(Prisma.sql`COALESCE(stats."paymentCount", 0) = 0`);
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

    if (query.lastLoginFrom) {
      where.push(
        Prisma.sql`stats."lastLoginAt" >= ${new Date(query.lastLoginFrom)}`,
      );
    }

    if (query.lastLoginTo) {
      where.push(
        Prisma.sql`stats."lastLoginAt" <= ${new Date(query.lastLoginTo)}`,
      );
    }

    return where;
  }

  private buildUpdateAssignments(dto: AdminUpdateUserDto): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.email !== undefined) {
      const email =
        typeof dto.email === 'string' ? dto.email.toLowerCase() : dto.email;

      assignments.push(Prisma.sql`"email" = ${email}`);
    }

    if (dto.phone !== undefined) {
      assignments.push(Prisma.sql`"phone" = ${dto.phone}`);
    }

    if (dto.firstName !== undefined) {
      assignments.push(Prisma.sql`"firstName" = ${dto.firstName}`);
    }

    if (dto.lastName !== undefined) {
      assignments.push(Prisma.sql`"lastName" = ${dto.lastName}`);
    }

    if (dto.avatarUrl !== undefined) {
      assignments.push(Prisma.sql`"avatarUrl" = ${dto.avatarUrl}`);
    }

    if (dto.roleId !== undefined) {
      assignments.push(Prisma.sql`"roleId" = ${dto.roleId}`);
    }

    return assignments;
  }

  private async assertEmailUnique(
    email: string,
    exceptUserId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [Prisma.sql`LOWER("email") = LOWER(${email})`];

    if (exceptUserId) {
      where.push(Prisma.sql`"id" <> ${exceptUserId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
        SELECT COUNT(*)::int AS "count"
        FROM "User"
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('ایمیل کاربر تکراری است.');
    }
  }

  private async assertPhoneUnique(
    phone: string,
    exceptUserId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [Prisma.sql`"phone" = ${phone}`];

    if (exceptUserId) {
      where.push(Prisma.sql`"id" <> ${exceptUserId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
        SELECT COUNT(*)::int AS "count"
        FROM "User"
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('شماره موبایل کاربر تکراری است.');
    }
  }

  private async assertRoleExists(roleId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
        SELECT COUNT(*)::int AS "count"
        FROM "Role"
        WHERE
          "id" = ${roleId}
          AND "deleted_at" IS NULL
      `,
    );

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException('نقش انتخاب‌شده معتبر نیست.');
    }
  }

  private resolveSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`u."updatedAt"`;
    }

    if (sortBy === 'email') {
      return Prisma.sql`u."email"`;
    }

    if (sortBy === 'firstName') {
      return Prisma.sql`u."firstName"`;
    }

    if (sortBy === 'lastName') {
      return Prisma.sql`u."lastName"`;
    }

    if (sortBy === 'status') {
      return Prisma.sql`u."status"`;
    }

    if (sortBy === 'orderCount') {
      return Prisma.sql`stats."orderCount"`;
    }

    if (sortBy === 'totalSpent') {
      return Prisma.sql`stats."totalSpent"`;
    }

    if (sortBy === 'lastOrderAt') {
      return Prisma.sql`stats."lastOrderAt"`;
    }

    if (sortBy === 'lastLoginAt') {
      return Prisma.sql`stats."lastLoginAt"`;
    }

    return Prisma.sql`u."createdAt"`;
  }

  private resolveSortDirection(sortDirection?: string): Prisma.Sql {
    return sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
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

  toNumber(value: unknown): number {
    if (value === undefined || value === null) {
      return 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    return Number(value);
  }

  private normalizeNullableString(value: string | null): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private toDecimalString(value: Prisma.Decimal | number | string): string {
    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    return new Prisma.Decimal(value).toFixed(2);
  }
}
