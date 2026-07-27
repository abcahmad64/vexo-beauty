import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminCouponNoteDto } from '../dto/admin-coupon-note.dto';

import { AdminCreateCouponDto } from '../dto/admin-create-coupon.dto';

import { AdminQueryCouponUsageDto } from '../dto/admin-query-coupon-usage.dto';

import { AdminQueryCouponDto } from '../dto/admin-query-coupon.dto';

import { AdminUpdateCouponDto } from '../dto/admin-update-coupon.dto';

import { AdminUpdateCouponStatusDto } from '../dto/admin-update-coupon-status.dto';

import { AdminValidateCouponDto } from '../dto/admin-validate-coupon.dto';

type CountRow = {
  count: number | bigint;
};

type SumRow = {
  count: number | bigint;
  revenueAmount: unknown;
  discountAmount: unknown;
};

export type AdminCouponRow = {
  id: string;
  code: string;
  type: string;
  value: unknown;
  description: string | null;
  usageLimit: number | null;
  usedCount: number;
  status: string;
  startDate: Date;
  endDate: Date | null;
  minAmount: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  usageCount: number | bigint;
  uniqueUserCount: number | bigint;
  orderCount: number | bigint;
  revenueAmount: unknown;
  lastUsedAt: Date | null;
};

type CouponUsageRow = {
  id: string;
  couponId: string;
  couponCode: string;
  couponType: string;
  userId: string;
  userEmail: string | null;
  userPhone: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  orderId: string;
  orderNumber: string | null;
  orderTotalAmount: unknown;
  orderStatus: string | null;
  paymentStatus: string | null;
  usedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type EventRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  userId: string | null;
  data: unknown;
  timestamp: Date;
  createdAt: Date;
};

@Injectable()
export class AdminCouponService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminQueryCouponDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildCouponWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AdminCouponRow[]>(
        Prisma.sql`
            ${this.couponSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolveCouponSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              c."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Coupon" c
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapCoupon(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(couponId: string, includeDeleted = true) {
    const coupon = await this.findCouponRow(couponId, includeDeleted);

    const [notes, usages] = await Promise.all([
      this.findCouponNotes(couponId, 20),
      this.findCouponUsageRows({
        couponId,
        page: 1,
        limit: 10,
      }),
    ]);

    return {
      ...this.mapCoupon(coupon),
      notes: notes.map((note) => this.mapNote(note)),
      recentUsages: usages.rows.map((usage) => this.mapUsage(usage)),
    };
  }

  async findByCode(code: string, includeDeleted = true) {
    const rows = await this.prisma.$queryRaw<AdminCouponRow[]>(
      Prisma.sql`
          ${this.couponSelectSql()}
          WHERE
            LOWER(c."code") = LOWER(${this.normalizeCode(code)})
            ${includeDeleted ? Prisma.empty : Prisma.sql`AND c."deleted_at" IS NULL`}
          LIMIT 1
        `,
    );

    const coupon = rows[0];

    if (!coupon) {
      throw new NotFoundException('کد تخفیف موردنظر یافت نشد.');
    }

    return this.mapCoupon(coupon);
  }

  async create(dto: AdminCreateCouponDto, actorId?: string) {
    this.assertDateRange(dto.startDate, dto.endDate ?? null);

    this.assertCouponValue(dto.type, dto.value);

    const code = this.normalizeCode(dto.code);

    await this.assertCodeUnique(code);

    const couponId = randomUUID();

    const status = dto.status ?? 'ACTIVE';

    const isActive = dto.isActive ?? status === 'ACTIVE';

    const now = new Date();

    const startDate = dto.startDate ? new Date(dto.startDate) : now;

    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Coupon" (
          "id",
          "code",
          "type",
          "value",
          "description",
          "usageLimit",
          "usedCount",
          "status",
          "startDate",
          "endDate",
          "minAmount",
          "isActive",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${couponId},
          ${code},
          ${dto.type}::"CouponType",
          ${this.resolveCouponValue(dto.type, dto.value)},
          ${dto.description ?? null},
          ${dto.usageLimit ?? null},
          0,
          ${status}::"CouponStatus",
          ${startDate},
          ${endDate},
          ${dto.minAmount ? this.toDecimal(dto.minAmount) : new Prisma.Decimal(0)},
          ${isActive},
          ${now},
          ${now}
        )
      `,
    );

    await this.createSystemEvent(
      'coupon.admin_created',
      'کد تخفیف توسط ادمین ایجاد شد.',
      couponId,
      actorId,
      {
        code,
        type: dto.type,
        status,
      },
    );

    return {
      coupon: await this.findOne(couponId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'coupon.admin_created',
      },
    };
  }

  async update(couponId: string, dto: AdminUpdateCouponDto, actorId?: string) {
    const current = await this.findCouponRow(couponId, false);

    const nextType = dto.type ?? current.type;

    const nextValue =
      dto.value !== undefined ? dto.value : this.toDecimalString(current.value);

    this.assertCouponValue(nextType, nextValue);

    this.assertDateRange(
      dto.startDate ?? current.startDate.toISOString(),
      dto.clearEndDate === true
        ? null
        : (dto.endDate ??
            (current.endDate ? current.endDate.toISOString() : null)),
    );

    if (
      dto.code !== undefined &&
      this.normalizeCode(dto.code) !== current.code
    ) {
      await this.assertCodeUnique(this.normalizeCode(dto.code), couponId);
    }

    const assignments = this.buildUpdateAssignments(dto, current);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی کد تخفیف ارسال نشده است.',
      );
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Coupon"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = ${now}
        WHERE
          "id" = ${couponId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'coupon.admin_updated',
      'کد تخفیف توسط ادمین به‌روزرسانی شد.',
      couponId,
      actorId,
      {
        changedFields: Object.keys(dto),
      },
    );

    return {
      coupon: await this.findOne(couponId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'coupon.admin_updated',
      },
    };
  }

  async updateStatus(
    couponId: string,
    dto: AdminUpdateCouponStatusDto,
    actorId?: string,
  ) {
    await this.findCouponRow(couponId, false);

    const isActive = dto.status === 'ACTIVE';

    const now = new Date();

    const endDateSql =
      dto.status === 'EXPIRED'
        ? Prisma.sql`COALESCE("endDate", ${now})`
        : Prisma.sql`"endDate"`;

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Coupon"
        SET
          "status" = ${dto.status}::"CouponStatus",
          "isActive" = ${isActive},
          "endDate" = ${endDateSql},
          "updatedAt" = ${now}
        WHERE
          "id" = ${couponId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'coupon.status.updated',
      'وضعیت کد تخفیف توسط ادمین تغییر کرد.',
      couponId,
      actorId,
      {
        status: dto.status,
        reason: dto.reason ?? null,
      },
    );

    return {
      coupon: await this.findOne(couponId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'coupon.status_updated',
        status: dto.status,
        reason: dto.reason ?? null,
      },
    };
  }

  async activate(couponId: string, actorId?: string) {
    return this.updateStatus(
      couponId,
      {
        status: 'ACTIVE',
      },
      actorId,
    );
  }

  async deactivate(couponId: string, actorId?: string) {
    return this.updateStatus(
      couponId,
      {
        status: 'INACTIVE',
      },
      actorId,
    );
  }

  async expire(couponId: string, actorId?: string) {
    return this.updateStatus(
      couponId,
      {
        status: 'EXPIRED',
      },
      actorId,
    );
  }

  async delete(couponId: string, actorId?: string) {
    await this.findCouponRow(couponId, false);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Coupon"
        SET
          "deleted_at" = ${now},
          "isActive" = FALSE,
          "status" = 'INACTIVE'::"CouponStatus",
          "updatedAt" = ${now}
        WHERE
          "id" = ${couponId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'coupon.admin_deleted',
      'کد تخفیف توسط ادمین حذف نرم شد.',
      couponId,
      actorId,
      {},
    );

    return {
      success: true,
      message: 'کد تخفیف با موفقیت حذف شد.',
      audit: {
        actorId: actorId ?? null,
        action: 'coupon.admin_deleted',
      },
    };
  }

  async restore(couponId: string, actorId?: string) {
    await this.findCouponRow(couponId, true);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Coupon"
        SET
          "deleted_at" = NULL,
          "updatedAt" = ${now}
        WHERE "id" = ${couponId}
      `,
    );

    await this.createSystemEvent(
      'coupon.admin_restored',
      'کد تخفیف حذف‌شده توسط ادمین بازگردانی شد.',
      couponId,
      actorId,
      {},
    );

    return {
      coupon: await this.findOne(couponId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'coupon.admin_restored',
      },
    };
  }

  async validatePreview(dto: AdminValidateCouponDto) {
    const coupon = await this.findCouponByCodeRow(dto.code, false);

    const subtotal = this.toDecimal(dto.subtotal);

    const shippingAmount = this.toDecimal(dto.shippingAmount ?? '0');

    const validation = await this.validateCouponRules(
      coupon,
      subtotal,
      dto.userId,
    );

    if (!validation.valid) {
      return validation;
    }

    const calculation = this.calculateDiscount(
      coupon,
      subtotal,
      shippingAmount,
    );

    return {
      valid: true,
      coupon: this.mapCoupon(coupon),
      calculation,
    };
  }

  async getDashboard(query: AdminQueryCouponDto) {
    const now = new Date();

    const where = this.buildCouponWhere({
      ...query,
      includeDeleted: false,
    });

    const [
      totalRows,
      activeRows,
      inactiveRows,
      expiredRows,
      exhaustedRows,
      scheduledRows,
    ] = await Promise.all([
      this.aggregateCoupons(where),
      this.aggregateCoupons([
        ...where,
        Prisma.sql`c."status"::text = 'ACTIVE'`,
        Prisma.sql`c."isActive" = TRUE`,
        Prisma.sql`c."startDate" <= ${now}`,
        Prisma.sql`(c."endDate" IS NULL OR c."endDate" >= ${now})`,
      ]),
      this.aggregateCoupons([
        ...where,
        Prisma.sql`c."status"::text = 'INACTIVE'`,
      ]),
      this.aggregateCoupons([
        ...where,
        Prisma.sql`(
            c."status"::text = 'EXPIRED'
            OR (
              c."endDate" IS NOT NULL
              AND c."endDate" < ${now}
            )
          )`,
      ]),
      this.aggregateCoupons([
        ...where,
        Prisma.sql`c."usageLimit" IS NOT NULL`,
        Prisma.sql`c."usedCount" >= c."usageLimit"`,
      ]),
      this.aggregateCoupons([...where, Prisma.sql`c."startDate" > ${now}`]),
    ]);

    return {
      total: this.mapAggregate(totalRows[0]),
      active: this.mapAggregate(activeRows[0]),
      inactive: this.mapAggregate(inactiveRows[0]),
      expired: this.mapAggregate(expiredRows[0]),
      exhausted: this.mapAggregate(exhaustedRows[0]),
      scheduled: this.mapAggregate(scheduledRows[0]),
    };
  }

  async getUsages(query: AdminQueryCouponUsageDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const result = await this.findCouponUsageRows({
      ...query,
      page,
      limit,
    });

    return {
      data: result.rows.map((row) => this.mapUsage(row)),
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async getCouponUsages(couponId: string, query: AdminQueryCouponUsageDto) {
    await this.findCouponRow(couponId, true);

    return this.getUsages({
      ...query,
      couponId,
    });
  }

  async getNotes(couponId: string, limit = 50) {
    await this.findCouponRow(couponId, true);

    const notes = await this.findCouponNotes(couponId, limit);

    return {
      data: notes.map((note) => this.mapNote(note)),
      meta: {
        couponId,
        total: notes.length,
      },
    };
  }

  async createNote(
    couponId: string,
    dto: AdminCouponNoteDto,
    actorId?: string,
  ) {
    await this.findCouponRow(couponId, true);

    const noteId = await this.createSystemEvent(
      'coupon.note.created',
      'یادداشت مدیریتی برای کد تخفیف ثبت شد.',
      couponId,
      actorId,
      {
        note: dto.note,
        isImportant: dto.isImportant ?? false,
        visibility: dto.visibility ?? 'admin',
      },
    );

    return {
      success: true,
      noteId,
      message: 'یادداشت کد تخفیف با موفقیت ثبت شد.',
    };
  }

  async findForExport(query: AdminQueryCouponDto) {
    const where = this.buildCouponWhere(query);

    const rows = await this.prisma.$queryRaw<AdminCouponRow[]>(
      Prisma.sql`
          ${this.couponSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            c."createdAt" DESC,
            c."id" DESC
          LIMIT 5000
        `,
    );

    return rows.map((row) => this.mapCoupon(row));
  }

  async findCouponRow(
    couponId: string,
    includeDeleted: boolean,
  ): Promise<AdminCouponRow> {
    const where: Prisma.Sql[] = [Prisma.sql`c."id" = ${couponId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`c."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AdminCouponRow[]>(
      Prisma.sql`
          ${this.couponSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const coupon = rows[0];

    if (!coupon) {
      throw new NotFoundException('کد تخفیف موردنظر یافت نشد.');
    }

    return coupon;
  }

  private async findCouponByCodeRow(
    code: string,
    includeDeleted: boolean,
  ): Promise<AdminCouponRow> {
    const where: Prisma.Sql[] = [
      Prisma.sql`LOWER(c."code") = LOWER(${this.normalizeCode(code)})`,
    ];

    if (!includeDeleted) {
      where.push(Prisma.sql`c."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AdminCouponRow[]>(
      Prisma.sql`
          ${this.couponSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const coupon = rows[0];

    if (!coupon) {
      throw new NotFoundException('کد تخفیف موردنظر یافت نشد.');
    }

    return coupon;
  }

  private couponSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        c."id",
        c."code",
        c."type"::text AS "type",
        c."value",
        c."description",
        c."usageLimit",
        c."usedCount",
        c."status"::text AS "status",
        c."startDate",
        c."endDate",
        c."minAmount",
        c."isActive",
        c."createdAt",
        c."updatedAt",
        c."deleted_at" AS "deletedAt",

        COALESCE(stats."usageCount", 0)::int AS "usageCount",
        COALESCE(stats."uniqueUserCount", 0)::int AS "uniqueUserCount",
        COALESCE(stats."orderCount", 0)::int AS "orderCount",
        COALESCE(stats."revenueAmount", 0)::numeric AS "revenueAmount",
        stats."lastUsedAt"
      FROM "Coupon" c
      LEFT JOIN LATERAL (
        SELECT
          COUNT(cu."id")::int AS "usageCount",
          COUNT(DISTINCT cu."userId")::int AS "uniqueUserCount",
          COUNT(DISTINCT cu."orderId")::int AS "orderCount",
          COALESCE(SUM(o."totalAmount"), 0)::numeric AS "revenueAmount",
          MAX(cu."usedAt") AS "lastUsedAt"
        FROM "CouponUsage" cu
        LEFT JOIN "Order" o
          ON o."id" = cu."orderId"
          AND o."deleted_at" IS NULL
        WHERE cu."couponId" = c."id"
      ) stats ON TRUE
    `;
  }

  private buildCouponWhere(query: AdminQueryCouponDto): Prisma.Sql[] {
    const now = new Date();

    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`c."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          c."id" ILIKE ${`%${query.q}%`}
          OR c."code" ILIKE ${`%${query.q}%`}
          OR c."description" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.couponId) {
      where.push(Prisma.sql`c."id" = ${query.couponId}`);
    }

    if (query.code) {
      where.push(Prisma.sql`c."code" ILIKE ${`%${query.code}%`}`);
    }

    if (query.type) {
      where.push(Prisma.sql`c."type"::text = ${query.type}`);
    }

    if (query.status) {
      where.push(Prisma.sql`c."status"::text = ${query.status}`);
    }

    if (query.isActive !== undefined) {
      where.push(Prisma.sql`c."isActive" = ${query.isActive}`);
    }

    if (query.expired === true) {
      where.push(
        Prisma.sql`(
          c."status"::text = 'EXPIRED'
          OR (
            c."endDate" IS NOT NULL
            AND c."endDate" < ${now}
          )
        )`,
      );
    }

    if (query.expired === false) {
      where.push(
        Prisma.sql`(
          c."status"::text <> 'EXPIRED'
          AND (
            c."endDate" IS NULL
            OR c."endDate" >= ${now}
          )
        )`,
      );
    }

    if (query.scheduled === true) {
      where.push(Prisma.sql`c."startDate" > ${now}`);
    }

    if (query.scheduled === false) {
      where.push(Prisma.sql`c."startDate" <= ${now}`);
    }

    if (query.exhausted === true) {
      where.push(Prisma.sql`c."usageLimit" IS NOT NULL`);
      where.push(Prisma.sql`c."usedCount" >= c."usageLimit"`);
    }

    if (query.exhausted === false) {
      where.push(
        Prisma.sql`(
          c."usageLimit" IS NULL
          OR c."usedCount" < c."usageLimit"
        )`,
      );
    }

    if (query.hasUsageLimit === true) {
      where.push(Prisma.sql`c."usageLimit" IS NOT NULL`);
    }

    if (query.hasUsageLimit === false) {
      where.push(Prisma.sql`c."usageLimit" IS NULL`);
    }

    if (query.valueMin) {
      where.push(Prisma.sql`c."value" >= ${this.toDecimal(query.valueMin)}`);
    }

    if (query.valueMax) {
      where.push(Prisma.sql`c."value" <= ${this.toDecimal(query.valueMax)}`);
    }

    if (query.minAmountMin) {
      where.push(
        Prisma.sql`c."minAmount" >= ${this.toDecimal(query.minAmountMin)}`,
      );
    }

    if (query.minAmountMax) {
      where.push(
        Prisma.sql`c."minAmount" <= ${this.toDecimal(query.minAmountMax)}`,
      );
    }

    if (query.startFrom) {
      where.push(Prisma.sql`c."startDate" >= ${new Date(query.startFrom)}`);
    }

    if (query.startTo) {
      where.push(Prisma.sql`c."startDate" <= ${new Date(query.startTo)}`);
    }

    if (query.endFrom) {
      where.push(Prisma.sql`c."endDate" >= ${new Date(query.endFrom)}`);
    }

    if (query.endTo) {
      where.push(Prisma.sql`c."endDate" <= ${new Date(query.endTo)}`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`c."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`c."createdAt" <= ${new Date(query.createdTo)}`);
    }

    return where;
  }

  private buildUpdateAssignments(
    dto: AdminUpdateCouponDto,
    current: AdminCouponRow,
  ): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.code !== undefined) {
      assignments.push(Prisma.sql`"code" = ${this.normalizeCode(dto.code)}`);
    }

    if (dto.type !== undefined) {
      assignments.push(Prisma.sql`"type" = ${dto.type}::"CouponType"`);
    }

    if (dto.type !== undefined || dto.value !== undefined) {
      const type = dto.type ?? current.type;

      assignments.push(
        Prisma.sql`"value" = ${this.resolveCouponValue(type, dto.value ?? this.toDecimalString(current.value))}`,
      );
    }

    if (dto.description !== undefined) {
      assignments.push(Prisma.sql`"description" = ${dto.description}`);
    }

    if (dto.minAmount !== undefined) {
      assignments.push(
        Prisma.sql`"minAmount" = ${this.toDecimal(dto.minAmount)}`,
      );
    }

    if (dto.usageLimit !== undefined) {
      assignments.push(Prisma.sql`"usageLimit" = ${dto.usageLimit}`);
    }

    if (dto.startDate !== undefined) {
      assignments.push(Prisma.sql`"startDate" = ${new Date(dto.startDate)}`);
    }

    if (dto.clearEndDate === true) {
      assignments.push(Prisma.sql`"endDate" = NULL`);
    } else if (dto.endDate !== undefined) {
      assignments.push(Prisma.sql`"endDate" = ${new Date(dto.endDate)}`);
    }

    if (dto.isActive !== undefined) {
      assignments.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    if (dto.status !== undefined) {
      assignments.push(Prisma.sql`"status" = ${dto.status}::"CouponStatus"`);
    }

    return assignments;
  }

  private async findCouponUsageRows(query: AdminQueryCouponUsageDto): Promise<{
    rows: CouponUsageRow[];
    total: number;
  }> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildUsageWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<CouponUsageRow[]>(
        Prisma.sql`
            SELECT
              cu."id",
              cu."couponId",
              c."code" AS "couponCode",
              c."type"::text AS "couponType",
              cu."userId",
              u."email" AS "userEmail",
              u."phone" AS "userPhone",
              u."firstName" AS "userFirstName",
              u."lastName" AS "userLastName",
              cu."orderId",
              o."orderNumber",
              o."totalAmount" AS "orderTotalAmount",
              o."status"::text AS "orderStatus",
              o."paymentStatus"::text AS "paymentStatus",
              cu."usedAt",
              cu."createdAt",
              cu."updatedAt"
            FROM "CouponUsage" cu
            INNER JOIN "Coupon" c
              ON c."id" = cu."couponId"
            LEFT JOIN "User" u
              ON u."id" = cu."userId"
            LEFT JOIN "Order" o
              ON o."id" = cu."orderId"
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              cu."usedAt" DESC,
              cu."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "CouponUsage" cu
            INNER JOIN "Coupon" c
              ON c."id" = cu."couponId"
            LEFT JOIN "User" u
              ON u."id" = cu."userId"
            LEFT JOIN "Order" o
              ON o."id" = cu."orderId"
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    return {
      rows,
      total: this.toNumber(countRows[0]?.count),
    };
  }

  private buildUsageWhere(query: AdminQueryCouponUsageDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.couponId) {
      where.push(Prisma.sql`cu."couponId" = ${query.couponId}`);
    }

    if (query.code) {
      where.push(Prisma.sql`c."code" ILIKE ${`%${query.code}%`}`);
    }

    if (query.orderId) {
      where.push(Prisma.sql`cu."orderId" = ${query.orderId}`);
    }

    if (query.userId) {
      where.push(Prisma.sql`cu."userId" = ${query.userId}`);
    }

    if (query.email) {
      where.push(Prisma.sql`u."email" ILIKE ${`%${query.email}%`}`);
    }

    if (query.usedFrom) {
      where.push(Prisma.sql`cu."usedAt" >= ${new Date(query.usedFrom)}`);
    }

    if (query.usedTo) {
      where.push(Prisma.sql`cu."usedAt" <= ${new Date(query.usedTo)}`);
    }

    return where;
  }

  private async validateCouponRules(
    coupon: AdminCouponRow,
    subtotal: Prisma.Decimal,
    userId?: string,
  ): Promise<
    | {
        valid: true;
      }
    | {
        valid: false;
        reason: string;
        message: string;
      }
  > {
    const now = new Date();

    if (coupon.deletedAt) {
      return {
        valid: false,
        reason: 'DELETED',
        message: 'کد تخفیف حذف شده است.',
      };
    }

    if (!coupon.isActive || coupon.status !== 'ACTIVE') {
      return {
        valid: false,
        reason: 'INACTIVE',
        message: 'کد تخفیف فعال نیست.',
      };
    }

    if (coupon.startDate.getTime() > now.getTime()) {
      return {
        valid: false,
        reason: 'NOT_STARTED',
        message: 'زمان استفاده از این کد تخفیف هنوز شروع نشده است.',
      };
    }

    if (coupon.endDate && coupon.endDate.getTime() < now.getTime()) {
      return {
        valid: false,
        reason: 'EXPIRED',
        message: 'کد تخفیف منقضی شده است.',
      };
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return {
        valid: false,
        reason: 'USAGE_LIMIT_REACHED',
        message: 'ظرفیت استفاده از این کد تخفیف تکمیل شده است.',
      };
    }

    if (
      coupon.minAmount !== null &&
      subtotal.lessThan(this.toDecimal(this.toDecimalString(coupon.minAmount)))
    ) {
      return {
        valid: false,
        reason: 'MIN_AMOUNT_NOT_REACHED',
        message: 'مبلغ سفارش کمتر از حداقل مبلغ مجاز برای این کد تخفیف است.',
      };
    }

    if (userId) {
      const rows = await this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "CouponUsage"
            WHERE
              "couponId" = ${coupon.id}
              AND "userId" = ${userId}
          `,
      );

      if (this.toNumber(rows[0]?.count) > 0) {
        return {
          valid: false,
          reason: 'ALREADY_USED',
          message: 'این کاربر قبلاً از این کد تخفیف استفاده کرده است.',
        };
      }
    }

    return {
      valid: true,
    };
  }

  private calculateDiscount(
    coupon: AdminCouponRow,
    subtotal: Prisma.Decimal,
    shippingAmount: Prisma.Decimal,
  ) {
    if (coupon.type === 'PERCENTAGE') {
      const discountAmount = subtotal
        .mul(this.toDecimalString(coupon.value))
        .div(100);

      const finalAmount = Prisma.Decimal.max(
        subtotal.minus(discountAmount).plus(shippingAmount),
        0,
      );

      return {
        discountAmount: discountAmount.toFixed(2),
        shippingDiscountAmount: '0.00',
        finalAmount: finalAmount.toFixed(2),
      };
    }

    if (coupon.type === 'FIXED_AMOUNT') {
      const value = this.toDecimal(this.toDecimalString(coupon.value));

      const discountAmount = Prisma.Decimal.min(value, subtotal);

      const finalAmount = Prisma.Decimal.max(
        subtotal.minus(discountAmount).plus(shippingAmount),
        0,
      );

      return {
        discountAmount: discountAmount.toFixed(2),
        shippingDiscountAmount: '0.00',
        finalAmount: finalAmount.toFixed(2),
      };
    }

    const finalAmount = Prisma.Decimal.max(subtotal, 0);

    return {
      discountAmount: '0.00',
      shippingDiscountAmount: shippingAmount.toFixed(2),
      finalAmount: finalAmount.toFixed(2),
    };
  }

  private aggregateCoupons(where: Prisma.Sql[]): Promise<SumRow[]> {
    return this.prisma.$queryRaw<SumRow[]>(
      Prisma.sql`
        SELECT
          COUNT(c."id")::int AS "count",
          COALESCE(SUM(stats."revenueAmount"), 0)::numeric AS "revenueAmount",
          COALESCE(SUM(
            CASE
              WHEN c."type"::text = 'PERCENTAGE'
                THEN stats."revenueAmount" * c."value" / 100
              WHEN c."type"::text = 'FIXED_AMOUNT'
                THEN c."value" * stats."usageCount"
              ELSE 0
            END
          ), 0)::numeric AS "discountAmount"
        FROM "Coupon" c
        LEFT JOIN LATERAL (
          SELECT
            COUNT(cu."id")::int AS "usageCount",
            COALESCE(SUM(o."totalAmount"), 0)::numeric AS "revenueAmount"
          FROM "CouponUsage" cu
          LEFT JOIN "Order" o
            ON o."id" = cu."orderId"
            AND o."deleted_at" IS NULL
          WHERE cu."couponId" = c."id"
        ) stats ON TRUE
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private findCouponNotes(
    couponId: string,
    limit: number,
  ): Promise<EventRow[]> {
    return this.prisma.$queryRaw<EventRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "name",
          "description",
          "category",
          "userId",
          "data",
          "timestamp",
          "createdAt"
        FROM "Event"
        WHERE
          "deleted_at" IS NULL
          AND "name" = 'coupon.note.created'
          AND "data" #>> '{couponId}' = ${couponId}
        ORDER BY
          "timestamp" DESC,
          "createdAt" DESC
        LIMIT ${Math.min(Math.max(limit, 1), 200)}
      `,
    );
  }

  private async createSystemEvent(
    name: string,
    description: string,
    couponId: string,
    actorId: string | undefined,
    data: Record<string, unknown>,
  ): Promise<string> {
    const eventId = randomUUID();

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Event" (
          "id",
          "name",
          "description",
          "category",
          "timestamp",
          "userId",
          "data",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${eventId},
          ${name},
          ${description},
          'coupon',
          ${now},
          ${actorId ?? null},
          ${JSON.stringify({
            couponId,
            ...data,
            occurredAt: now.toISOString(),
            occurredAtFa: formatPersianDateTime(now),
          })}::jsonb,
          ${now},
          ${now}
        )
      `,
    );

    return eventId;
  }

  private async assertCodeUnique(
    code: string,
    exceptCouponId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [Prisma.sql`LOWER("code") = LOWER(${code})`];

    if (exceptCouponId) {
      where.push(Prisma.sql`"id" <> ${exceptCouponId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Coupon"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('کد تخفیف تکراری است.');
    }
  }

  private assertCouponValue(type: string, value?: string | null): void {
    if (type === 'FREE_SHIPPING') {
      return;
    }

    if (!value) {
      throw new BadRequestException('مقدار کد تخفیف الزامی است.');
    }

    const decimal = this.toDecimal(value);

    if (decimal.lessThanOrEqualTo(0)) {
      throw new BadRequestException('مقدار کد تخفیف باید بزرگ‌تر از صفر باشد.');
    }

    if (type === 'PERCENTAGE' && decimal.greaterThan(100)) {
      throw new BadRequestException('درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.');
    }
  }

  private resolveCouponValue(
    type: string,
    value?: string | null,
  ): Prisma.Decimal {
    if (type === 'FREE_SHIPPING') {
      return new Prisma.Decimal(0);
    }

    if (!value) {
      throw new BadRequestException('مقدار کد تخفیف الزامی است.');
    }

    return this.toDecimal(value);
  }

  private assertDateRange(startDate?: string, endDate?: string | null): void {
    if (!startDate || !endDate) {
      return;
    }

    const start = new Date(startDate);

    const end = new Date(endDate);

    if (start.getTime() > end.getTime()) {
      throw new BadRequestException(
        'تاریخ شروع کد تخفیف نمی‌تواند بعد از تاریخ پایان باشد.',
      );
    }
  }

  private mapCoupon(row: AdminCouponRow) {
    const now = new Date();

    const isExpired =
      row.status === 'EXPIRED' ||
      (row.endDate !== null && row.endDate.getTime() < now.getTime());

    const isScheduled = row.startDate.getTime() > now.getTime();

    const isExhausted =
      row.usageLimit !== null && row.usedCount >= row.usageLimit;

    return {
      id: row.id,
      code: row.code,
      type: row.type,
      value: this.toDecimalString(row.value),
      description: row.description,
      minAmount: this.toDecimalString(row.minAmount ?? 0),
      usageLimit: row.usageLimit,
      usedCount: row.usedCount,
      remainingUsage:
        row.usageLimit === null
          ? null
          : Math.max(row.usageLimit - row.usedCount, 0),
      status: row.status,
      isActive: row.isActive,
      flags: {
        isExpired,
        isScheduled,
        isExhausted,
        isCurrentlyUsable:
          row.isActive &&
          row.status === 'ACTIVE' &&
          !isExpired &&
          !isScheduled &&
          !isExhausted,
      },
      stats: {
        usageCount: this.toNumber(row.usageCount),
        uniqueUserCount: this.toNumber(row.uniqueUserCount),
        orderCount: this.toNumber(row.orderCount),
        revenueAmount: this.toDecimalString(row.revenueAmount),
        lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
        lastUsedAtFa: this.toPersianDateTimeString(row.lastUsedAt),
      },
      startDate: row.startDate.toISOString(),
      startDateFa: this.toPersianDateTimeString(row.startDate),
      endDate: row.endDate ? row.endDate.toISOString() : null,
      endDateFa: this.toPersianDateTimeString(row.endDate),
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.toPersianDateTimeString(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.toPersianDateTimeString(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: this.toPersianDateTimeString(row.deletedAt),
    };
  }

  private mapUsage(row: CouponUsageRow) {
    return {
      id: row.id,
      coupon: {
        id: row.couponId,
        code: row.couponCode,
        type: row.couponType,
      },
      customer: {
        id: row.userId,
        email: row.userEmail,
        phone: row.userPhone,
        firstName: row.userFirstName,
        lastName: row.userLastName,
        fullName: `${row.userFirstName ?? ''} ${row.userLastName ?? ''}`.trim(),
      },
      order: {
        id: row.orderId,
        orderNumber: row.orderNumber,
        totalAmount: this.toDecimalString(row.orderTotalAmount ?? 0),
        status: row.orderStatus,
        paymentStatus: row.paymentStatus,
      },
      usedAt: row.usedAt.toISOString(),
      usedAtFa: this.toPersianDateTimeString(row.usedAt),
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.toPersianDateTimeString(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.toPersianDateTimeString(row.updatedAt),
    };
  }

  private mapNote(row: EventRow) {
    const data = this.toRecord(row.data);

    return {
      id: row.id,
      note: data.note ?? null,
      isImportant: data.isImportant ?? false,
      visibility: data.visibility ?? 'admin',
      actorId: row.userId,
      createdAt: row.timestamp.toISOString(),
      createdAtFa: this.toPersianDateTimeString(row.timestamp),
    };
  }

  private toPersianDateTimeString(value: Date | null): string | null {
    return formatPersianDateTime(value);
  }

  private mapAggregate(row?: SumRow) {
    return {
      count: this.toNumber(row?.count),
      revenueAmount: this.toDecimalString(row?.revenueAmount ?? 0),
      discountAmount: this.toDecimalString(row?.discountAmount ?? 0),
    };
  }

  private resolveCouponSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`c."updatedAt"`;
    }

    if (sortBy === 'code') {
      return Prisma.sql`c."code"`;
    }

    if (sortBy === 'type') {
      return Prisma.sql`c."type"`;
    }

    if (sortBy === 'value') {
      return Prisma.sql`c."value"`;
    }

    if (sortBy === 'status') {
      return Prisma.sql`c."status"`;
    }

    if (sortBy === 'usedCount') {
      return Prisma.sql`c."usedCount"`;
    }

    if (sortBy === 'usageLimit') {
      return Prisma.sql`c."usageLimit"`;
    }

    if (sortBy === 'startDate') {
      return Prisma.sql`c."startDate"`;
    }

    if (sortBy === 'endDate') {
      return Prisma.sql`c."endDate"`;
    }

    if (sortBy === 'usageCount') {
      return Prisma.sql`stats."usageCount"`;
    }

    if (sortBy === 'revenueAmount') {
      return Prisma.sql`stats."revenueAmount"`;
    }

    return Prisma.sql`c."createdAt"`;
  }

  private resolveSortDirection(sortDirection?: string): Prisma.Sql {
    return sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase().replace(/\s+/g, '');
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

  private toDecimal(value: string): Prisma.Decimal {
    try {
      return new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException('مقدار عددی معتبر نیست.');
    }
  }

  private toDecimalString(value: unknown): string {
    if (value === undefined || value === null) {
      return '0.00';
    }

    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return new Prisma.Decimal(value).toFixed(2);
    }

    if (typeof value === 'bigint') {
      return new Prisma.Decimal(value.toString()).toFixed(2);
    }

    throw new TypeError('Unsupported decimal value.');
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

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
