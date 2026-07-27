import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import * as bcrypt from 'bcrypt';

import { Prisma, UserStatus } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { AdminResetPasswordDto } from '../dto/admin-reset-password.dto';

import { ChangePasswordDto } from '../dto/change-password.dto';

import { CreateUserDto } from '../dto/create-user.dto';

import { QueryUserDto } from '../dto/query-user.dto';

import { UpdateProfileDto } from '../dto/update-profile.dto';

import { UpdateUserStatusDto } from '../dto/update-user-status.dto';

import { UpdateUserDto } from '../dto/update-user.dto';

import { UserEventPublisher } from '../events/user.event.publisher';

type CountRow = {
  count: number | bigint;
};

type UserRow = {
  id: string;
  email: string;
  phone: string | null;
  password: string | null;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  status: UserStatus;
  role_id: string | null;
  role_name: string | null;
  permissions: string[] | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

type UserSummaryRow = {
  addresses_count: number | bigint;
  orders_count: number | bigint;
  reviews_count: number | bigint;
  payments_count: number | bigint;
  notifications_count: number | bigint;
};

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: UserEventPublisher,
  ) {}

  async create(dto: CreateUserDto, actorId?: string) {
    const email = this.normalizeEmail(dto.email);

    await this.assertEmailUnique(email);

    if (dto.phone) {
      await this.assertPhoneUnique(dto.phone);
    }

    if (dto.roleId) {
      await this.assertRoleExists(dto.roleId);
    }

    const userId = randomUUID();

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const now = new Date();

    await this.prisma.$executeRaw(
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
          "updatedAt"
        )
        VALUES (
          ${userId},
          ${email},
          ${dto.phone ?? null},
          ${passwordHash},
          ${dto.firstName},
          ${dto.lastName},
          ${dto.avatarUrl ?? null},
          ${dto.status ?? UserStatus.ACTIVE}::"UserStatus",
          ${dto.roleId ?? null},
          ${now},
          ${now}
        )
      `,
    );

    this.eventPublisher.publishCreated({
      userId,
      email,
      actorId,
      occurredAt: now,
    });

    return this.findOneForAdmin(userId);
  }

  async findAll(query: QueryUserDto) {
    const { page, limit, skip } = this.buildPagination(query);

    const whereSql = this.buildUserWhereSql(query);

    const [users, countRows] = await Promise.all([
      this.prisma.$queryRaw<UserRow[]>(
        Prisma.sql`
            SELECT
              u."id",
              u."email",
              u."phone",
              NULL::text AS password,
              u."firstName" AS first_name,
              u."lastName" AS last_name,
              u."avatarUrl" AS avatar_url,
              u."status",
              u."roleId" AS role_id,
              r."name" AS role_name,
              COALESCE(
                ARRAY_REMOVE(
                  ARRAY_AGG(DISTINCT p."name"),
                  NULL
                ),
                ARRAY[]::text[]
              ) AS permissions,
              u."createdAt" AS created_at,
              u."updatedAt" AS updated_at,
              u."deleted_at" AS deleted_at
            FROM "User" u
            LEFT JOIN "Role" r
              ON r."id" = u."roleId"
              AND r."deleted_at" IS NULL
            LEFT JOIN "RolePermission" rp
              ON rp."roleId" = r."id"
            LEFT JOIN "Permission" p
              ON p."id" = rp."permissionId"
              AND p."deleted_at" IS NULL
            ${whereSql}
            GROUP BY
              u."id",
              u."email",
              u."phone",
              u."firstName",
              u."lastName",
              u."avatarUrl",
              u."status",
              u."roleId",
              r."name",
              u."createdAt",
              u."updatedAt",
              u."deleted_at"
            ORDER BY u."createdAt" DESC, u."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),

      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(DISTINCT u."id")::int AS count
            FROM "User" u
            LEFT JOIN "Role" r
              ON r."id" = u."roleId"
              AND r."deleted_at" IS NULL
            ${whereSql}
          `,
      ),
    ]);

    return this.buildPaginatedResult(
      users.map((user) => this.mapUser(user)),
      this.toNumber(countRows[0]?.count),
      page,
      limit,
    );
  }

  async findProfile(userId: string) {
    const user = await this.findUserRow(userId, false, false);

    return this.mapUser(user);
  }

  async findOneForAdmin(userId: string, includeDeleted = false) {
    const user = await this.findUserRow(userId, includeDeleted, false);

    const summary = await this.getUserSummary(user.id);

    return {
      ...this.mapUser(user),
      summary,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto, actorId?: string) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی پروفایل ارسال نشده است.',
      );
    }

    await this.findUserRow(userId, false, false);

    const updates: Prisma.Sql[] = [];

    if (dto.firstName !== undefined) {
      updates.push(Prisma.sql`"firstName" = ${dto.firstName}`);
    }

    if (dto.lastName !== undefined) {
      updates.push(Prisma.sql`"lastName" = ${dto.lastName}`);
    }

    await this.updateUserColumns(userId, updates);

    this.eventPublisher.publishProfileUpdated({
      userId,
      changedFields: Object.keys(dto),
      actorId: actorId ?? userId,
      occurredAt: new Date(),
    });

    return this.findProfile(userId);
  }

  async updateUser(userId: string, dto: UpdateUserDto, actorId?: string) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی کاربر ارسال نشده است.',
      );
    }

    const current = await this.findUserRow(userId, false, false);

    const normalizedEmail =
      dto.email === undefined
        ? undefined
        : dto.email === null
          ? null
          : this.normalizeEmail(dto.email);

    if (normalizedEmail === null) {
      throw new BadRequestException('ایمیل نمی‌تواند خالی باشد.');
    }

    if (normalizedEmail !== undefined && normalizedEmail !== current.email) {
      await this.assertEmailUnique(normalizedEmail, userId);
    }

    if (dto.phone !== undefined && dto.phone !== null) {
      await this.assertPhoneUnique(dto.phone, userId);
    }

    if (dto.roleId !== undefined && dto.roleId !== null) {
      await this.assertRoleExists(dto.roleId);
    }

    const updates: Prisma.Sql[] = [];

    if (normalizedEmail !== undefined) {
      updates.push(Prisma.sql`"email" = ${normalizedEmail}`);
    }

    if (dto.firstName !== undefined) {
      updates.push(Prisma.sql`"firstName" = ${dto.firstName}`);
    }

    if (dto.lastName !== undefined) {
      updates.push(Prisma.sql`"lastName" = ${dto.lastName}`);
    }

    if (dto.phone !== undefined) {
      updates.push(Prisma.sql`"phone" = ${dto.phone}`);
    }

    if (dto.avatarUrl !== undefined) {
      updates.push(Prisma.sql`"avatarUrl" = ${dto.avatarUrl}`);
    }

    if (dto.roleId !== undefined) {
      updates.push(Prisma.sql`"roleId" = ${dto.roleId}`);
    }

    await this.updateUserColumns(userId, updates);

    this.eventPublisher.publishUpdated({
      userId,
      changedFields: Object.keys(dto),
      actorId,
      occurredAt: new Date(),
    });

    return this.findOneForAdmin(userId);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    actorId?: string,
  ) {
    const user = await this.findUserRow(userId, false, true);

    if (!user.password) {
      throw new BadRequestException('برای این کاربر رمز عبور ثبت نشده است.');
    }

    const matches = await bcrypt.compare(dto.currentPassword, user.password);

    if (!matches) {
      throw new UnauthorizedException('رمز عبور فعلی صحیح نیست.');
    }

    const samePassword = await bcrypt.compare(dto.newPassword, user.password);

    if (samePassword) {
      throw new BadRequestException(
        'رمز عبور جدید باید با رمز عبور فعلی متفاوت باشد.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          "password" = ${passwordHash},
          "updatedAt" = ${now}
        WHERE "id" = ${userId}
          AND "deleted_at" IS NULL
          AND "status"::text <> 'DELETED'
      `,
    );

    const revoked = await this.revokeUserSessionsInternal(userId);

    this.eventPublisher.publishPasswordChanged({
      userId,
      actorId: actorId ?? userId,
      occurredAt: new Date(),
    });

    this.eventPublisher.publishSessionsRevoked({
      userId,
      revokedRefreshTokens: revoked.revokedRefreshTokens,
      revokedSessions: revoked.revokedSessions,
      actorId: actorId ?? userId,
      occurredAt: new Date(),
    });

    return {
      success: true,
      message: 'رمز عبور با موفقیت تغییر کرد.',
      changedAt: now.toISOString(),
      changedAtFa: formatPersianDateTime(now),
    };
  }

  async adminResetPassword(
    userId: string,
    dto: AdminResetPasswordDto,
    actorId?: string,
  ) {
    await this.findUserRow(userId, false, false);

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          "password" = ${passwordHash},
          "updatedAt" = ${now}
        WHERE "id" = ${userId}
          AND "deleted_at" IS NULL
          AND "status"::text <> 'DELETED'
      `,
    );

    if (dto.revokeSessions !== false) {
      const revoked = await this.revokeUserSessionsInternal(userId);

      this.eventPublisher.publishSessionsRevoked({
        userId,
        revokedRefreshTokens: revoked.revokedRefreshTokens,
        revokedSessions: revoked.revokedSessions,
        actorId,
        occurredAt: new Date(),
      });
    }

    this.eventPublisher.publishPasswordReset({
      userId,
      revokedSessions: dto.revokeSessions !== false,
      actorId,
      occurredAt: new Date(),
    });

    return {
      success: true,
      message: 'رمز عبور کاربر با موفقیت بازنشانی شد.',
      resetAt: now.toISOString(),
      resetAtFa: formatPersianDateTime(now),
    };
  }

  async updateStatus(
    userId: string,
    dto: UpdateUserStatusDto,
    actorId?: string,
  ) {
    const current = await this.findUserRow(userId, true, false);

    if (current.status === dto.status && !current.deleted_at) {
      return this.findOneForAdmin(userId);
    }

    if (dto.status === UserStatus.DELETED) {
      return this.remove(userId, actorId);
    }

    const deletedAtSql =
      dto.status === UserStatus.ACTIVE
        ? Prisma.sql`, "deleted_at" = NULL`
        : Prisma.empty;

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          "status" = ${dto.status}::"UserStatus",
          "updatedAt" = ${now}
          ${deletedAtSql}
        WHERE "id" = ${userId}
      `,
    );

    if (dto.status !== UserStatus.ACTIVE) {
      const revoked = await this.revokeUserSessionsInternal(userId);

      this.eventPublisher.publishSessionsRevoked({
        userId,
        revokedRefreshTokens: revoked.revokedRefreshTokens,
        revokedSessions: revoked.revokedSessions,
        actorId,
        occurredAt: new Date(),
      });
    }

    this.eventPublisher.publishStatusChanged({
      userId,
      previousStatus: current.status,
      currentStatus: dto.status,
      reason: dto.reason,
      actorId,
      occurredAt: new Date(),
    });

    return this.findOneForAdmin(userId);
  }

  async remove(userId: string, actorId?: string) {
    await this.findUserRow(userId, true, false);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          "status" = ${UserStatus.DELETED}::"UserStatus",
          "deleted_at" = ${now},
          "updatedAt" = ${now}
        WHERE "id" = ${userId}
      `,
    );

    const revoked = await this.revokeUserSessionsInternal(userId);

    this.eventPublisher.publishSoftDeleted({
      userId,
      actorId,
      occurredAt: new Date(),
    });

    this.eventPublisher.publishSessionsRevoked({
      userId,
      revokedRefreshTokens: revoked.revokedRefreshTokens,
      revokedSessions: revoked.revokedSessions,
      actorId,
      occurredAt: new Date(),
    });

    return {
      success: true,
      message: 'کاربر با موفقیت حذف شد.',
      deletedAt: now.toISOString(),
      deletedAtFa: formatPersianDateTime(now),
    };
  }

  async restore(userId: string, actorId?: string) {
    const current = await this.findUserRow(userId, true, false);

    if (!current.deleted_at && current.status !== UserStatus.DELETED) {
      return this.findOneForAdmin(userId);
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          "status" = ${UserStatus.ACTIVE}::"UserStatus",
          "deleted_at" = NULL,
          "updatedAt" = ${now}
        WHERE "id" = ${userId}
      `,
    );

    this.eventPublisher.publishRestored({
      userId,
      actorId,
      occurredAt: new Date(),
    });

    return this.findOneForAdmin(userId);
  }

  async revokeSessions(userId: string, actorId?: string) {
    await this.findUserRow(userId, true, false);

    const revoked = await this.revokeUserSessionsInternal(userId);

    this.eventPublisher.publishSessionsRevoked({
      userId,
      revokedRefreshTokens: revoked.revokedRefreshTokens,
      revokedSessions: revoked.revokedSessions,
      actorId,
      occurredAt: new Date(),
    });

    return revoked;
  }

  async getUserSummary(userId: string) {
    const rows = await this.prisma.$queryRaw<UserSummaryRow[]>(
      Prisma.sql`
          SELECT
            (
              SELECT COUNT(*)::int
              FROM "Address" a
              WHERE a."userId" = ${userId}
                AND a."deleted_at" IS NULL
            ) AS addresses_count,
            (
              SELECT COUNT(*)::int
              FROM "Order" o
              WHERE o."userId" = ${userId}
                AND o."deleted_at" IS NULL
            ) AS orders_count,
            (
              SELECT COUNT(*)::int
              FROM "ProductReview" pr
              WHERE pr."userId" = ${userId}
            ) AS reviews_count,
            (
              SELECT COUNT(*)::int
              FROM "Payment" p
              WHERE p."userId" = ${userId}
                AND p."deleted_at" IS NULL
            ) AS payments_count,
            (
              SELECT COUNT(*)::int
              FROM "Notification" n
              WHERE n."userId" = ${userId}
                AND n."deleted_at" IS NULL
            ) AS notifications_count
        `,
    );

    const row = rows[0];

    return {
      addressesCount: this.toNumber(row?.addresses_count),
      ordersCount: this.toNumber(row?.orders_count),
      reviewsCount: this.toNumber(row?.reviews_count),
      paymentsCount: this.toNumber(row?.payments_count),
      notificationsCount: this.toNumber(row?.notifications_count),
    };
  }

  private async findUserRow(
    userId: string,
    includeDeleted: boolean,
    includePassword: boolean,
  ): Promise<UserRow> {
    const deletedCondition = includeDeleted
      ? Prisma.empty
      : Prisma.sql`
            AND u."deleted_at" IS NULL
            AND u."status"::text <> 'DELETED'
          `;

    const rows = await this.prisma.$queryRaw<UserRow[]>(
      Prisma.sql`
          SELECT
            u."id",
            u."email",
            u."phone",
            ${
              includePassword
                ? Prisma.sql`u."password"`
                : Prisma.sql`NULL::text AS "password"`
            },
            u."firstName" AS first_name,
            u."lastName" AS last_name,
            u."avatarUrl" AS avatar_url,
            u."status",
            u."roleId" AS role_id,
            r."name" AS role_name,
            COALESCE(
              ARRAY_REMOVE(
                ARRAY_AGG(DISTINCT p."name"),
                NULL
              ),
              ARRAY[]::text[]
            ) AS permissions,
            u."createdAt" AS created_at,
            u."updatedAt" AS updated_at,
            u."deleted_at" AS deleted_at
          FROM "User" u
          LEFT JOIN "Role" r
            ON r."id" = u."roleId"
            AND r."deleted_at" IS NULL
          LEFT JOIN "RolePermission" rp
            ON rp."roleId" = r."id"
          LEFT JOIN "Permission" p
            ON p."id" = rp."permissionId"
            AND p."deleted_at" IS NULL
          WHERE u."id" = ${userId}
          ${deletedCondition}
          GROUP BY
            u."id",
            u."email",
            u."phone",
            u."password",
            u."firstName",
            u."lastName",
            u."avatarUrl",
            u."status",
            u."roleId",
            r."name",
            u."createdAt",
            u."updatedAt",
            u."deleted_at"
          LIMIT 1
        `,
    );

    if (!rows[0]) {
      throw new NotFoundException('کاربر موردنظر یافت نشد.');
    }

    return rows[0];
  }

  private async updateUserColumns(userId: string, updates: Prisma.Sql[]) {
    if (updates.length === 0) {
      throw new BadRequestException(
        'هیچ فیلد معتبری برای به‌روزرسانی ارسال نشده است.',
      );
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          ${Prisma.join(updates, ', ')},
          "updatedAt" = ${now}
        WHERE "id" = ${userId}
          AND "deleted_at" IS NULL
          AND "status"::text <> 'DELETED'
      `,
    );
  }

  private buildUserWhereSql(query: QueryUserDto): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];

    if (query.includeDeleted !== true) {
      conditions.push(
        Prisma.sql`u."deleted_at" IS NULL`,
        Prisma.sql`u."status"::text <> 'DELETED'`,
      );
    }

    if (query.q) {
      conditions.push(
        Prisma.sql`
          (
            u."email" ILIKE ${`%${query.q}%`}
            OR u."phone" ILIKE ${`%${query.q}%`}
            OR u."firstName" ILIKE ${`%${query.q}%`}
            OR u."lastName" ILIKE ${`%${query.q}%`}
            OR r."name" ILIKE ${`%${query.q}%`}
          )
        `,
      );
    }

    if (query.email) {
      conditions.push(Prisma.sql`u."email" ILIKE ${`%${query.email}%`}`);
    }

    if (query.phone) {
      conditions.push(Prisma.sql`u."phone" ILIKE ${`%${query.phone}%`}`);
    }

    if (query.status) {
      conditions.push(Prisma.sql`u."status" = ${query.status}::"UserStatus"`);
    }

    if (query.roleId) {
      conditions.push(Prisma.sql`u."roleId" = ${query.roleId}`);
    }

    if (query.roleName) {
      conditions.push(Prisma.sql`r."name" ILIKE ${`%${query.roleName}%`}`);
    }

    if (query.createdFrom) {
      conditions.push(
        Prisma.sql`u."createdAt" >= ${this.parseDate(query.createdFrom)}`,
      );
    }

    if (query.createdTo) {
      conditions.push(
        Prisma.sql`u."createdAt" <= ${this.parseDate(query.createdTo)}`,
      );
    }

    if (conditions.length === 0) {
      return Prisma.empty;
    }

    return Prisma.sql`
      WHERE ${Prisma.join(conditions, ' AND ')}
    `;
  }

  private async assertEmailUnique(email: string, excludeUserId?: string) {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "User"
          WHERE LOWER("email") = LOWER(${email})
            ${
              excludeUserId
                ? Prisma.sql`AND "id" <> ${excludeUserId}`
                : Prisma.empty
            }
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('ایمیل کاربر تکراری است.');
    }
  }

  private async assertPhoneUnique(phone: string, excludeUserId?: string) {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "User"
          WHERE "phone" = ${phone}
            ${
              excludeUserId
                ? Prisma.sql`AND "id" <> ${excludeUserId}`
                : Prisma.empty
            }
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('شماره موبایل کاربر تکراری است.');
    }
  }

  private async assertRoleExists(roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!role) {
      throw new BadRequestException('نقش انتخاب‌شده معتبر نیست.');
    }
  }

  private async revokeUserSessionsInternal(userId: string) {
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
          deletedAt: new Date(),
        },
      }),
    ]);

    return {
      success: true,
      revokedRefreshTokens: deletedTokens.count,
      revokedSessions: updatedSessions.count,
    };
  }

  private mapUser(user: UserRow) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.first_name,
      lastName: user.last_name,
      fullName: `${user.first_name} ${user.last_name}`.trim(),
      avatarUrl: user.avatar_url,
      status: user.status,
      roleId: user.role_id,
      roleName: user.role_name,
      role:
        user.role_id || user.role_name
          ? {
              id: user.role_id,
              name: user.role_name,
            }
          : null,
      permissions: user.permissions ?? [],
      createdAt: user.created_at.toISOString(),
      createdAtFa: formatPersianDateTime(user.created_at),
      updatedAt: user.updated_at.toISOString(),
      updatedAtFa: formatPersianDateTime(user.updated_at),
      deletedAt: user.deleted_at ? user.deleted_at.toISOString() : null,
      deletedAtFa: user.deleted_at
        ? formatPersianDateTime(user.deleted_at)
        : null,
    };
  }

  private buildPagination(query: QueryUserDto) {
    const page = Math.max(1, Number(query.page ?? 1));

    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));

    const skip = (page - 1) * limit;

    return {
      page,
      limit,
      skip,
    };
  }

  private buildPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ) {
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private parseDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('مقدار تاریخ معتبر نیست.');
    }

    return date;
  }

  private toNumber(value: number | bigint | null | undefined): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    return value;
  }
}
