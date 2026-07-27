import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminCreateReportSnapshotDto } from '../dto/admin-create-report-snapshot.dto';

import { AdminQueryReportSnapshotDto } from '../dto/admin-query-report-snapshot.dto';

import { AdminReportNoteDto } from '../dto/admin-report-note.dto';

import {
  AdminReportRequestDto,
  AdminReportType,
} from '../dto/admin-report-request.dto';

type CountRow = {
  count: number | bigint;
};

type MetricRow = {
  count: number | bigint;
  amount: unknown;
};

type ReportRow = Record<string, unknown>;

type SnapshotRow = {
  id: string;
  reportType: string;
  title: string;
  filtersJson: unknown;
  resultJson: unknown;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
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
export class AdminReportService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async generateReport(dto: AdminReportRequestDto) {
    this.assertDateRange(dto);

    if (dto.reportType === 'OVERVIEW') {
      return this.generateOverviewReport(dto);
    }

    if (dto.reportType === 'SALES') {
      return this.generateSalesReport(dto);
    }

    if (dto.reportType === 'ORDERS') {
      return this.generateOrdersReport(dto);
    }

    if (dto.reportType === 'PAYMENTS') {
      return this.generatePaymentsReport(dto);
    }

    if (dto.reportType === 'CUSTOMERS') {
      return this.generateCustomersReport(dto);
    }

    if (dto.reportType === 'PRODUCTS') {
      return this.generateProductsReport(dto);
    }

    if (dto.reportType === 'COUPONS') {
      return this.generateCouponsReport(dto);
    }

    return this.generateSupportReport(dto);
  }

  async getDashboard() {
    const [
      todayOrders,
      monthOrders,
      paidRevenue,
      newCustomers,
      openSupport,
      exports,
      snapshots,
    ] = await Promise.all([
      this.prisma.$queryRaw<MetricRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count",
              COALESCE(SUM("totalAmount"), 0)::numeric AS "amount"
            FROM "Order"
            WHERE
              "deleted_at" IS NULL
              AND "createdAt" >= DATE_TRUNC('day', NOW())
          `,
      ),
      this.prisma.$queryRaw<MetricRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count",
              COALESCE(SUM("totalAmount"), 0)::numeric AS "amount"
            FROM "Order"
            WHERE
              "deleted_at" IS NULL
              AND "createdAt" >= DATE_TRUNC('month', NOW())
          `,
      ),
      this.prisma.$queryRaw<MetricRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count",
              COALESCE(SUM("amount"), 0)::numeric AS "amount"
            FROM "Payment"
            WHERE
              "deleted_at" IS NULL
              AND "paymentStatus"::text = 'COMPLETED'
              AND "createdAt" >= DATE_TRUNC('month', NOW())
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "User"
            WHERE
              "deleted_at" IS NULL
              AND "createdAt" >= DATE_TRUNC('month', NOW())
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "SupportTicket"
            WHERE
              "deleted_at" IS NULL
              AND "status" IN ('OPEN', 'PENDING')
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "AdminReportExportLog"
            WHERE "createdAt" >= DATE_TRUNC('month', NOW())
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "AdminReportSnapshot"
            WHERE "deleted_at" IS NULL
          `,
      ),
    ]);

    return {
      today: {
        orders: this.toNumber(todayOrders[0]?.count),
        revenue: this.toDecimalString(todayOrders[0]?.amount),
      },
      currentMonth: {
        orders: this.toNumber(monthOrders[0]?.count),
        grossRevenue: this.toDecimalString(monthOrders[0]?.amount),
        paidRevenue: this.toDecimalString(paidRevenue[0]?.amount),
        successfulPayments: this.toNumber(paidRevenue[0]?.count),
        newCustomers: this.toNumber(newCustomers[0]?.count),
      },
      support: {
        openOrPendingTickets: this.toNumber(openSupport[0]?.count),
      },
      reports: {
        exportsThisMonth: this.toNumber(exports[0]?.count),
        snapshots: this.toNumber(snapshots[0]?.count),
      },
    };
  }

  async createSnapshot(dto: AdminCreateReportSnapshotDto, actorId?: string) {
    const result = await this.generateReport(dto.report);

    const snapshotId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "AdminReportSnapshot" (
          "id",
          "reportType",
          "title",
          "filtersJson",
          "resultJson",
          "createdById",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${snapshotId},
          ${dto.report.reportType},
          ${dto.title},
          ${JSON.stringify(dto.report)}::jsonb,
          ${JSON.stringify(result)}::jsonb,
          ${actorId ?? null},
          NOW(),
          NOW()
        )
      `,
    );

    await this.createSystemEvent(
      'report.snapshot.created',
      'اسنپ‌شات گزارش مدیریتی ایجاد شد.',
      snapshotId,
      actorId,
      {
        snapshotId,
        reportType: dto.report.reportType,
        title: dto.title,
        description: dto.description ?? null,
      },
    );

    return {
      snapshot: await this.findSnapshot(snapshotId, true),
    };
  }

  async findSnapshots(query: AdminQueryReportSnapshotDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildSnapshotWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<SnapshotRow[]>(
        Prisma.sql`
            ${this.snapshotSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              s."createdAt" DESC,
              s."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "AdminReportSnapshot" s
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapSnapshot(row, false)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findSnapshot(snapshotId: string, includeDeleted = true) {
    const snapshot = await this.findSnapshotRow(snapshotId, includeDeleted);

    const notes = await this.findNotes(snapshotId, 30);

    return {
      ...this.mapSnapshot(snapshot, true),
      notes: notes.map((note) => this.mapNote(note)),
    };
  }

  async deleteSnapshot(snapshotId: string, actorId?: string) {
    await this.findSnapshotRow(snapshotId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AdminReportSnapshot"
        SET
          "deleted_at" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${snapshotId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'report.snapshot.deleted',
      'اسنپ‌شات گزارش مدیریتی حذف نرم شد.',
      snapshotId,
      actorId,
      {
        snapshotId,
      },
    );

    return {
      success: true,
      message: 'اسنپ‌شات گزارش با موفقیت حذف شد.',
    };
  }

  async restoreSnapshot(snapshotId: string, actorId?: string) {
    await this.findSnapshotRow(snapshotId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AdminReportSnapshot"
        SET
          "deleted_at" = NULL,
          "updatedAt" = NOW()
        WHERE "id" = ${snapshotId}
      `,
    );

    await this.createSystemEvent(
      'report.snapshot.restored',
      'اسنپ‌شات گزارش مدیریتی بازگردانی شد.',
      snapshotId,
      actorId,
      {
        snapshotId,
      },
    );

    return {
      snapshot: await this.findSnapshot(snapshotId, true),
    };
  }

  async createNote(
    snapshotId: string,
    dto: AdminReportNoteDto,
    actorId?: string,
  ) {
    await this.findSnapshotRow(snapshotId, true);

    const noteId = await this.createSystemEvent(
      'report.snapshot.note.created',
      'یادداشت مدیریتی برای گزارش ثبت شد.',
      snapshotId,
      actorId,
      {
        snapshotId,
        note: dto.note,
        isImportant: dto.isImportant ?? false,
        visibility: dto.visibility ?? 'admin',
      },
    );

    return {
      success: true,
      noteId,
      message: 'یادداشت گزارش با موفقیت ثبت شد.',
    };
  }

  async logExport(
    reportType: AdminReportType,
    format: 'csv' | 'json',
    filters: Record<string, unknown>,
    actorId?: string,
  ) {
    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "AdminReportExportLog" (
          "id",
          "reportType",
          "format",
          "filtersJson",
          "exportedById",
          "createdAt"
        )
        VALUES (
          ${randomUUID()},
          ${reportType},
          ${format},
          ${JSON.stringify(filters)}::jsonb,
          ${actorId ?? null},
          NOW()
        )
      `,
    );
  }

  private async generateOverviewReport(dto: AdminReportRequestDto) {
    const orderWhere = this.buildDateWhere('o', dto);

    const paymentWhere = this.buildDateWhere('p', dto);

    const userWhere = this.buildDateWhere('u', dto);

    const [orderRows, paymentRows, customerRows, statusRows] =
      await Promise.all([
        this.prisma.$queryRaw<MetricRow[]>(
          Prisma.sql`
            SELECT
              COUNT(*)::int AS "count",
              COALESCE(SUM(o."totalAmount"), 0)::numeric AS "amount"
            FROM "Order" o
            WHERE ${Prisma.join(orderWhere, ' AND ')}
          `,
        ),
        this.prisma.$queryRaw<MetricRow[]>(
          Prisma.sql`
            SELECT
              COUNT(*)::int AS "count",
              COALESCE(SUM(p."amount"), 0)::numeric AS "amount"
            FROM "Payment" p
            WHERE
              ${Prisma.join(paymentWhere, ' AND ')}
              AND p."paymentStatus"::text = 'COMPLETED'
          `,
        ),
        this.prisma.$queryRaw<CountRow[]>(
          Prisma.sql`
            SELECT COUNT(*)::int AS "count"
            FROM "User" u
            WHERE ${Prisma.join(userWhere, ' AND ')}
          `,
        ),
        this.prisma.$queryRaw<ReportRow[]>(
          Prisma.sql`
            SELECT
              o."status"::text AS "status",
              COUNT(*)::int AS "count",
              COALESCE(SUM(o."totalAmount"), 0)::numeric AS "amount"
            FROM "Order" o
            WHERE ${Prisma.join(orderWhere, ' AND ')}
            GROUP BY o."status"::text
            ORDER BY "count" DESC
          `,
        ),
      ]);

    return {
      reportType: dto.reportType,
      filters: this.mapFilters(dto),
      summary: {
        orders: this.toNumber(orderRows[0]?.count),
        grossRevenue: this.toDecimalString(orderRows[0]?.amount),
        successfulPayments: this.toNumber(paymentRows[0]?.count),
        paidRevenue: this.toDecimalString(paymentRows[0]?.amount),
        newCustomers: this.toNumber(customerRows[0]?.count),
      },
      breakdowns: {
        ordersByStatus: statusRows.map((row) => this.mapGenericRow(row)),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private async generateSalesReport(dto: AdminReportRequestDto) {
    const where = this.buildDateWhere('o', dto);

    const rows = await this.prisma.$queryRaw<ReportRow[]>(
      Prisma.sql`
          SELECT
            DATE_TRUNC(${dto.groupBy ?? 'day'}, o."createdAt") AS "period",
            COUNT(*)::int AS "orderCount",
            COALESCE(SUM(o."totalAmount"), 0)::numeric AS "grossRevenue",
            COALESCE(AVG(o."totalAmount"), 0)::numeric AS "averageOrderValue"
          FROM "Order" o
          WHERE ${Prisma.join(where, ' AND ')}
          GROUP BY DATE_TRUNC(${dto.groupBy ?? 'day'}, o."createdAt")
          ORDER BY "period" ASC
        `,
    );

    return {
      reportType: dto.reportType,
      filters: this.mapFilters(dto),
      rows: rows.map((row) => this.mapGenericRow(row)),
      generatedAt: new Date().toISOString(),
    };
  }

  private async generateOrdersReport(dto: AdminReportRequestDto) {
    const where = this.buildDateWhere('o', dto);

    const [byStatus, byPaymentStatus, byCurrency] = await Promise.all([
      this.prisma.$queryRaw<ReportRow[]>(
        Prisma.sql`
            SELECT
              o."status"::text AS "status",
              COUNT(*)::int AS "count",
              COALESCE(SUM(o."totalAmount"), 0)::numeric AS "amount"
            FROM "Order" o
            WHERE ${Prisma.join(where, ' AND ')}
            GROUP BY o."status"::text
            ORDER BY "count" DESC
          `,
      ),
      this.prisma.$queryRaw<ReportRow[]>(
        Prisma.sql`
            SELECT
              o."paymentStatus"::text AS "paymentStatus",
              COUNT(*)::int AS "count",
              COALESCE(SUM(o."totalAmount"), 0)::numeric AS "amount"
            FROM "Order" o
            WHERE ${Prisma.join(where, ' AND ')}
            GROUP BY o."paymentStatus"::text
            ORDER BY "count" DESC
          `,
      ),
      this.prisma.$queryRaw<ReportRow[]>(
        Prisma.sql`
            SELECT
              o."currency",
              COUNT(*)::int AS "count",
              COALESCE(SUM(o."totalAmount"), 0)::numeric AS "amount"
            FROM "Order" o
            WHERE ${Prisma.join(where, ' AND ')}
            GROUP BY o."currency"
            ORDER BY "amount" DESC
          `,
      ),
    ]);

    return {
      reportType: dto.reportType,
      filters: this.mapFilters(dto),
      breakdowns: {
        byStatus: byStatus.map((row) => this.mapGenericRow(row)),
        byPaymentStatus: byPaymentStatus.map((row) => this.mapGenericRow(row)),
        byCurrency: byCurrency.map((row) => this.mapGenericRow(row)),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private async generatePaymentsReport(dto: AdminReportRequestDto) {
    const where = this.buildDateWhere('p', dto);

    const [byStatus, byMethod] = await Promise.all([
      this.prisma.$queryRaw<ReportRow[]>(
        Prisma.sql`
            SELECT
              p."paymentStatus"::text AS "paymentStatus",
              COUNT(*)::int AS "count",
              COALESCE(SUM(p."amount"), 0)::numeric AS "amount"
            FROM "Payment" p
            WHERE ${Prisma.join(where, ' AND ')}
            GROUP BY p."paymentStatus"::text
            ORDER BY "amount" DESC
          `,
      ),
      this.prisma.$queryRaw<ReportRow[]>(
        Prisma.sql`
            SELECT
              p."paymentMethod"::text AS "paymentMethod",
              COUNT(*)::int AS "count",
              COALESCE(SUM(p."amount"), 0)::numeric AS "amount"
            FROM "Payment" p
            WHERE ${Prisma.join(where, ' AND ')}
            GROUP BY p."paymentMethod"::text
            ORDER BY "amount" DESC
          `,
      ),
    ]);

    return {
      reportType: dto.reportType,
      filters: this.mapFilters(dto),
      breakdowns: {
        byStatus: byStatus.map((row) => this.mapGenericRow(row)),
        byMethod: byMethod.map((row) => this.mapGenericRow(row)),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private async generateCustomersReport(dto: AdminReportRequestDto) {
    const where = this.buildDateWhere('u', dto);

    const rows = await this.prisma.$queryRaw<ReportRow[]>(
      Prisma.sql`
          SELECT
            DATE_TRUNC(${dto.groupBy ?? 'day'}, u."createdAt") AS "period",
            COUNT(*)::int AS "newCustomers"
          FROM "User" u
          WHERE ${Prisma.join(where, ' AND ')}
          GROUP BY DATE_TRUNC(${dto.groupBy ?? 'day'}, u."createdAt")
          ORDER BY "period" ASC
        `,
    );

    return {
      reportType: dto.reportType,
      filters: this.mapFilters(dto),
      rows: rows.map((row) => this.mapGenericRow(row)),
      generatedAt: new Date().toISOString(),
    };
  }

  private async generateProductsReport(dto: AdminReportRequestDto) {
    const where = this.buildDateWhere('o', dto);

    const rows = await this.prisma.$queryRaw<ReportRow[]>(
      Prisma.sql`
          SELECT
            oi."productId",
            p."name" AS "productName",
            p."sku" AS "productSku",
            SUM(oi."quantity")::int AS "quantitySold",
            COUNT(DISTINCT o."id")::int AS "orderCount"
          FROM "OrderItem" oi
          INNER JOIN "Order" o
            ON o."id" = oi."orderId"
          LEFT JOIN "Product" p
            ON p."id" = oi."productId"
          WHERE ${Prisma.join(where, ' AND ')}
          GROUP BY
            oi."productId",
            p."name",
            p."sku"
          ORDER BY "quantitySold" DESC
          LIMIT 100
        `,
    );

    return {
      reportType: dto.reportType,
      filters: this.mapFilters(dto),
      rows: rows.map((row) => this.mapGenericRow(row)),
      generatedAt: new Date().toISOString(),
    };
  }

  private async generateCouponsReport(dto: AdminReportRequestDto) {
    const where = this.buildDateWhere('cu', {
      ...dto,
      dateColumn: 'usedAt',
    });

    const rows = await this.prisma.$queryRaw<ReportRow[]>(
      Prisma.sql`
          SELECT
            c."id" AS "couponId",
            c."code",
            c."type"::text AS "type",
            COUNT(cu."id")::int AS "usageCount",
            COUNT(DISTINCT cu."userId")::int AS "uniqueUsers",
            COUNT(DISTINCT cu."orderId")::int AS "orderCount",
            COALESCE(SUM(o."totalAmount"), 0)::numeric AS "revenueAmount"
          FROM "CouponUsage" cu
          INNER JOIN "Coupon" c
            ON c."id" = cu."couponId"
          LEFT JOIN "Order" o
            ON o."id" = cu."orderId"
          WHERE ${Prisma.join(where, ' AND ')}
          GROUP BY
            c."id",
            c."code",
            c."type"::text
          ORDER BY "usageCount" DESC
          LIMIT 100
        `,
    );

    return {
      reportType: dto.reportType,
      filters: this.mapFilters(dto),
      rows: rows.map((row) => this.mapGenericRow(row)),
      generatedAt: new Date().toISOString(),
    };
  }

  private async generateSupportReport(dto: AdminReportRequestDto) {
    const ticketWhere = this.buildDateWhere('t', dto);

    const chatWhere = this.buildDateWhere('c', dto);

    const [ticketStatusRows, ticketPriorityRows, chatStatusRows] =
      await Promise.all([
        this.prisma.$queryRaw<ReportRow[]>(
          Prisma.sql`
            SELECT
              t."status",
              COUNT(*)::int AS "count"
            FROM "SupportTicket" t
            WHERE ${Prisma.join(ticketWhere, ' AND ')}
            GROUP BY t."status"
            ORDER BY "count" DESC
          `,
        ),
        this.prisma.$queryRaw<ReportRow[]>(
          Prisma.sql`
            SELECT
              t."priority",
              COUNT(*)::int AS "count"
            FROM "SupportTicket" t
            WHERE ${Prisma.join(ticketWhere, ' AND ')}
            GROUP BY t."priority"
            ORDER BY "count" DESC
          `,
        ),
        this.prisma.$queryRaw<ReportRow[]>(
          Prisma.sql`
            SELECT
              c."status",
              COUNT(*)::int AS "count",
              COALESCE(SUM(c."unreadByAdmin"), 0)::int AS "unreadByAdmin"
            FROM "SupportChatConversation" c
            WHERE ${Prisma.join(chatWhere, ' AND ')}
            GROUP BY c."status"
            ORDER BY "count" DESC
          `,
        ),
      ]);

    return {
      reportType: dto.reportType,
      filters: this.mapFilters(dto),
      breakdowns: {
        ticketsByStatus: ticketStatusRows.map((row) => this.mapGenericRow(row)),
        ticketsByPriority: ticketPriorityRows.map((row) =>
          this.mapGenericRow(row),
        ),
        chatsByStatus: chatStatusRows.map((row) => this.mapGenericRow(row)),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private snapshotSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        s."id",
        s."reportType",
        s."title",
        s."filtersJson",
        s."resultJson",
        s."createdById",
        s."createdAt",
        s."updatedAt",
        s."deleted_at" AS "deletedAt"
      FROM "AdminReportSnapshot" s
    `;
  }

  private buildSnapshotWhere(query: AdminQueryReportSnapshotDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`s."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          s."title" ILIKE ${`%${query.q}%`}
          OR s."reportType" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.reportType) {
      where.push(Prisma.sql`s."reportType" = ${query.reportType}`);
    }

    if (query.createdById) {
      where.push(Prisma.sql`s."createdById" = ${query.createdById}`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`s."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`s."createdAt" <= ${new Date(query.createdTo)}`);
    }

    return where;
  }

  private async findSnapshotRow(
    snapshotId: string,
    includeDeleted: boolean,
  ): Promise<SnapshotRow> {
    const where: Prisma.Sql[] = [Prisma.sql`s."id" = ${snapshotId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`s."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<SnapshotRow[]>(
      Prisma.sql`
          ${this.snapshotSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const snapshot = rows[0];

    if (!snapshot) {
      throw new NotFoundException('اسنپ‌شات گزارش موردنظر یافت نشد.');
    }

    return snapshot;
  }

  private buildDateWhere(
    alias: string,
    dto: AdminReportRequestDto & {
      dateColumn?: string;
    },
  ): Prisma.Sql[] {
    const dateColumn = dto.dateColumn ?? 'createdAt';

    const where: Prisma.Sql[] = [
      Prisma.sql`${Prisma.raw(alias)}."deleted_at" IS NULL`,
    ];

    if (dto.dateFrom) {
      where.push(
        Prisma.sql`${Prisma.raw(alias)}.${Prisma.raw(`"${dateColumn}"`)} >= ${new Date(dto.dateFrom)}`,
      );
    }

    if (dto.dateTo) {
      where.push(
        Prisma.sql`${Prisma.raw(alias)}.${Prisma.raw(`"${dateColumn}"`)} <= ${new Date(dto.dateTo)}`,
      );
    }

    if (dto.currency) {
      where.push(Prisma.sql`${Prisma.raw(alias)}."currency" = ${dto.currency}`);
    }

    return where;
  }

  private findNotes(snapshotId: string, limit: number): Promise<EventRow[]> {
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
          AND "name" = 'report.snapshot.note.created'
          AND "data" #>> '{snapshotId}' = ${snapshotId}
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
    entityId: string,
    actorId: string | undefined,
    data: Record<string, unknown>,
  ): Promise<string> {
    const eventId = randomUUID();

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
          'report',
          NOW(),
          ${actorId ?? null},
          ${JSON.stringify({
            entityId,
            ...data,
          })}::jsonb,
          NOW(),
          NOW()
        )
      `,
    );

    return eventId;
  }

  private mapSnapshot(row: SnapshotRow, includeResult: boolean) {
    return {
      id: row.id,
      reportType: row.reportType,
      title: row.title,
      filters: row.filtersJson,
      result: includeResult ? row.resultJson : undefined,
      createdById: row.createdById,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
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
    };
  }

  private mapGenericRow(row: ReportRow): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      if (value instanceof Date) {
        mapped[key] = value.toISOString();
        continue;
      }

      if (typeof value === 'bigint') {
        mapped[key] = Number(value);
        continue;
      }

      if (value instanceof Prisma.Decimal) {
        mapped[key] = value.toFixed(2);
        continue;
      }

      mapped[key] = value;
    }

    return mapped;
  }

  private mapFilters(dto: AdminReportRequestDto) {
    return {
      dateFrom: dto.dateFrom ?? null,
      dateTo: dto.dateTo ?? null,
      groupBy: dto.groupBy ?? 'day',
      currency: dto.currency ?? null,
    };
  }

  private assertDateRange(dto: AdminReportRequestDto): void {
    if (
      dto.dateFrom &&
      dto.dateTo &&
      new Date(dto.dateFrom).getTime() > new Date(dto.dateTo).getTime()
    ) {
      throw new BadRequestException(
        'تاریخ شروع گزارش نمی‌تواند بعد از تاریخ پایان باشد.',
      );
    }
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

    switch (typeof value) {
      case 'number':
        return value;
      case 'bigint':
      case 'string':
      case 'boolean':
        return Number(value);
      default:
        return 0;
    }
  }

  private toDecimalString(value: unknown): string {
    if (value === undefined || value === null) {
      return '0.00';
    }

    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    switch (typeof value) {
      case 'string':
      case 'number':
      case 'bigint':
        return new Prisma.Decimal(String(value)).toFixed(2);
      default:
        return '0.00';
    }
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
