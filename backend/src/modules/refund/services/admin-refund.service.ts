import { Injectable, NotFoundException } from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminRefundNoteDto } from '../dto/admin-refund-note.dto';

import { AdminQueryRefundDto } from '../dto/admin-query-refund.dto';

type CountRow = {
  count: number | bigint;
};

type SumRow = {
  totalAmount: Prisma.Decimal | number | string | null;
  count: number | bigint;
};

export type AdminRefundRow = {
  id: string;
  paymentId: string;
  amount: Prisma.Decimal | number | string;
  reason: string | null;
  status: string;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  paymentAmount: Prisma.Decimal | number | string | null;
  currency: string | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  transactionId: string | null;
  gateway: string | null;
  receiptUrl: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;

  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  orderPaymentStatus: string | null;
  orderTotalAmount: Prisma.Decimal | number | string | null;

  userId: string | null;
  userEmail: string | null;
  userPhone: string | null;
  userFirstName: string | null;
  userLastName: string | null;

  completedRefundAmountForPayment: Prisma.Decimal | number | string | null;
  openRefundAmountForPayment: Prisma.Decimal | number | string | null;
  refundCountForPayment: number | bigint;
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

type TimelineRow = {
  source: string;
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  amount: Prisma.Decimal | number | string | null;
  currency: string | null;
  occurredAt: Date;
};

@Injectable()
export class AdminRefundService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminQueryRefundDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildRefundWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AdminRefundRow[]>(
        Prisma.sql`
            SELECT
              r."id",
              r."paymentId",
              r."amount",
              r."reason",
              r."status"::text AS "status",
              r."processedAt",
              r."createdAt",
              r."updatedAt",
              r."deleted_at" AS "deletedAt",

              p."amount" AS "paymentAmount",
              p."currency",
              p."paymentStatus"::text AS "paymentStatus",
              p."paymentMethod"::text AS "paymentMethod",
              p."transactionId",
              p."gateway",
              p."receiptUrl",
              p."paidAt",
              p."refundedAt",

              o."id" AS "orderId",
              o."orderNumber",
              o."status"::text AS "orderStatus",
              o."paymentStatus"::text AS "orderPaymentStatus",
              o."totalAmount" AS "orderTotalAmount",

              u."id" AS "userId",
              u."email" AS "userEmail",
              u."phone" AS "userPhone",
              u."firstName" AS "userFirstName",
              u."lastName" AS "userLastName",

              COALESCE(stats."completedRefundAmountForPayment", 0)::numeric
                AS "completedRefundAmountForPayment",
              COALESCE(stats."openRefundAmountForPayment", 0)::numeric
                AS "openRefundAmountForPayment",
              COALESCE(stats."refundCountForPayment", 0)::int
                AS "refundCountForPayment"
            FROM "Refund" r
            INNER JOIN "Payment" p
              ON p."id" = r."paymentId"
            LEFT JOIN "Order" o
              ON o."id" = p."orderId"
            LEFT JOIN "User" u
              ON u."id" = p."userId"
            LEFT JOIN LATERAL (
              SELECT
                COALESCE(SUM(rr."amount") FILTER (
                  WHERE rr."status"::text = 'COMPLETED'
                    AND rr."deleted_at" IS NULL
                ), 0) AS "completedRefundAmountForPayment",
                COALESCE(SUM(rr."amount") FILTER (
                  WHERE rr."status"::text IN ('PENDING', 'PROCESSING')
                    AND rr."deleted_at" IS NULL
                ), 0) AS "openRefundAmountForPayment",
                COUNT(rr."id") FILTER (
                  WHERE rr."deleted_at" IS NULL
                ) AS "refundCountForPayment"
              FROM "Refund" rr
              WHERE rr."paymentId" = p."id"
            ) stats ON TRUE
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolveSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              r."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Refund" r
            INNER JOIN "Payment" p
              ON p."id" = r."paymentId"
            LEFT JOIN "Order" o
              ON o."id" = p."orderId"
            LEFT JOIN "User" u
              ON u."id" = p."userId"
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapRefund(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(refundId: string, includeDeleted = true) {
    const refund = await this.findRefundRow(refundId, includeDeleted);

    const [notes, timeline] = await Promise.all([
      this.findRefundNotes(refundId, 20),
      this.findRefundTimeline(refundId, 50),
    ]);

    return {
      ...this.mapRefund(refund),
      notes: notes.map((note) => this.mapNote(note)),
      timeline: timeline.map((row) => this.mapTimeline(row)),
    };
  }

  async getDashboard(query: AdminQueryRefundDto) {
    const where = this.buildRefundWhere({
      ...query,
      includeDeleted: false,
    });

    const [totalRows, pendingRows, processingRows, completedRows, failedRows] =
      await Promise.all([
        this.aggregateRefunds(where),
        this.aggregateRefunds([
          ...where,
          Prisma.sql`r."status"::text = 'PENDING'`,
        ]),
        this.aggregateRefunds([
          ...where,
          Prisma.sql`r."status"::text = 'PROCESSING'`,
        ]),
        this.aggregateRefunds([
          ...where,
          Prisma.sql`r."status"::text = 'COMPLETED'`,
        ]),
        this.aggregateRefunds([
          ...where,
          Prisma.sql`r."status"::text = 'FAILED'`,
        ]),
      ]);

    return {
      total: this.mapAggregate(totalRows[0]),
      pending: this.mapAggregate(pendingRows[0]),
      processing: this.mapAggregate(processingRows[0]),
      completed: this.mapAggregate(completedRows[0]),
      failed: this.mapAggregate(failedRows[0]),
    };
  }

  async getTimeline(refundId: string, limit = 100) {
    await this.findRefundRow(refundId, true);

    const safeLimit = Math.min(Math.max(limit, 1), 300);

    const rows = await this.findRefundTimeline(refundId, safeLimit);

    return {
      data: rows.map((row) => this.mapTimeline(row)),
      meta: {
        refundId,
        total: rows.length,
      },
    };
  }

  async getNotes(refundId: string, limit = 50) {
    await this.findRefundRow(refundId, true);

    const notes = await this.findRefundNotes(refundId, limit);

    return {
      data: notes.map((note) => this.mapNote(note)),
      meta: {
        refundId,
        total: notes.length,
      },
    };
  }

  async createNote(
    refundId: string,
    dto: AdminRefundNoteDto,
    actorId?: string,
  ) {
    await this.findRefundRow(refundId, true);

    const noteId = await this.createSystemEvent(
      'refund.note.created',
      'یادداشت مدیریتی برای بازگشت وجه ثبت شد.',
      refundId,
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
      message: 'یادداشت بازگشت وجه با موفقیت ثبت شد.',
    };
  }

  async restore(refundId: string, actorId?: string) {
    await this.findRefundRow(refundId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Refund"
        SET
          "deleted_at" = NULL,
          "updatedAt" = NOW()
        WHERE "id" = ${refundId}
      `,
    );

    await this.createSystemEvent(
      'refund.admin_restored',
      'بازگشت وجه حذف‌شده توسط ادمین بازگردانی شد.',
      refundId,
      actorId,
      {},
    );

    return {
      refund: await this.findOne(refundId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'refund.admin_restored',
      },
    };
  }

  async findForExport(query: AdminQueryRefundDto) {
    const where = this.buildRefundWhere(query);

    const rows = await this.prisma.$queryRaw<AdminRefundRow[]>(
      Prisma.sql`
          SELECT
            r."id",
            r."paymentId",
            r."amount",
            r."reason",
            r."status"::text AS "status",
            r."processedAt",
            r."createdAt",
            r."updatedAt",
            r."deleted_at" AS "deletedAt",

            p."amount" AS "paymentAmount",
            p."currency",
            p."paymentStatus"::text AS "paymentStatus",
            p."paymentMethod"::text AS "paymentMethod",
            p."transactionId",
            p."gateway",
            p."receiptUrl",
            p."paidAt",
            p."refundedAt",

            o."id" AS "orderId",
            o."orderNumber",
            o."status"::text AS "orderStatus",
            o."paymentStatus"::text AS "orderPaymentStatus",
            o."totalAmount" AS "orderTotalAmount",

            u."id" AS "userId",
            u."email" AS "userEmail",
            u."phone" AS "userPhone",
            u."firstName" AS "userFirstName",
            u."lastName" AS "userLastName",

            0::numeric AS "completedRefundAmountForPayment",
            0::numeric AS "openRefundAmountForPayment",
            0::int AS "refundCountForPayment"
          FROM "Refund" r
          INNER JOIN "Payment" p
            ON p."id" = r."paymentId"
          LEFT JOIN "Order" o
            ON o."id" = p."orderId"
          LEFT JOIN "User" u
            ON u."id" = p."userId"
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            r."createdAt" DESC,
            r."id" DESC
          LIMIT 5000
        `,
    );

    return rows.map((row) => this.mapRefund(row));
  }

  private async findRefundRow(
    refundId: string,
    includeDeleted: boolean,
  ): Promise<AdminRefundRow> {
    const where: Prisma.Sql[] = [Prisma.sql`r."id" = ${refundId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`r."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AdminRefundRow[]>(
      Prisma.sql`
          SELECT
            r."id",
            r."paymentId",
            r."amount",
            r."reason",
            r."status"::text AS "status",
            r."processedAt",
            r."createdAt",
            r."updatedAt",
            r."deleted_at" AS "deletedAt",

            p."amount" AS "paymentAmount",
            p."currency",
            p."paymentStatus"::text AS "paymentStatus",
            p."paymentMethod"::text AS "paymentMethod",
            p."transactionId",
            p."gateway",
            p."receiptUrl",
            p."paidAt",
            p."refundedAt",

            o."id" AS "orderId",
            o."orderNumber",
            o."status"::text AS "orderStatus",
            o."paymentStatus"::text AS "orderPaymentStatus",
            o."totalAmount" AS "orderTotalAmount",

            u."id" AS "userId",
            u."email" AS "userEmail",
            u."phone" AS "userPhone",
            u."firstName" AS "userFirstName",
            u."lastName" AS "userLastName",

            COALESCE(stats."completedRefundAmountForPayment", 0)::numeric
              AS "completedRefundAmountForPayment",
            COALESCE(stats."openRefundAmountForPayment", 0)::numeric
              AS "openRefundAmountForPayment",
            COALESCE(stats."refundCountForPayment", 0)::int
              AS "refundCountForPayment"
          FROM "Refund" r
          INNER JOIN "Payment" p
            ON p."id" = r."paymentId"
          LEFT JOIN "Order" o
            ON o."id" = p."orderId"
          LEFT JOIN "User" u
            ON u."id" = p."userId"
          LEFT JOIN LATERAL (
            SELECT
              COALESCE(SUM(rr."amount") FILTER (
                WHERE rr."status"::text = 'COMPLETED'
                  AND rr."deleted_at" IS NULL
              ), 0) AS "completedRefundAmountForPayment",
              COALESCE(SUM(rr."amount") FILTER (
                WHERE rr."status"::text IN ('PENDING', 'PROCESSING')
                  AND rr."deleted_at" IS NULL
              ), 0) AS "openRefundAmountForPayment",
              COUNT(rr."id") FILTER (
                WHERE rr."deleted_at" IS NULL
              ) AS "refundCountForPayment"
            FROM "Refund" rr
            WHERE rr."paymentId" = p."id"
          ) stats ON TRUE
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const refund = rows[0];

    if (!refund) {
      throw new NotFoundException('بازگشت وجه موردنظر یافت نشد.');
    }

    return refund;
  }

  private findRefundNotes(
    refundId: string,
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
          AND "name" = 'refund.note.created'
          AND "data" #>> '{refundId}' = ${refundId}
        ORDER BY
          "timestamp" DESC,
          "createdAt" DESC
        LIMIT ${Math.min(Math.max(limit, 1), 200)}
      `,
    );
  }

  private findRefundTimeline(
    refundId: string,
    limit: number,
  ): Promise<TimelineRow[]> {
    return this.prisma.$queryRaw<TimelineRow[]>(
      Prisma.sql`
        SELECT *
        FROM (
          SELECT
            'refund'::text AS "source",
            r."id" AS "id",
            'بازگشت وجه'::text AS "title",
            r."reason" AS "description",
            r."status"::text AS "status",
            r."amount" AS "amount",
            p."currency" AS "currency",
            r."createdAt" AS "occurredAt"
          FROM "Refund" r
          INNER JOIN "Payment" p
            ON p."id" = r."paymentId"
          WHERE r."id" = ${refundId}

          UNION ALL

          SELECT
            'payment'::text AS "source",
            p."id" AS "id",
            'پرداخت مرتبط با بازگشت وجه'::text AS "title",
            p."paymentMethod"::text AS "description",
            p."paymentStatus"::text AS "status",
            p."amount" AS "amount",
            p."currency" AS "currency",
            p."createdAt" AS "occurredAt"
          FROM "Refund" r
          INNER JOIN "Payment" p
            ON p."id" = r."paymentId"
          WHERE r."id" = ${refundId}

          UNION ALL

          SELECT
            'event'::text AS "source",
            e."id" AS "id",
            e."name" AS "title",
            e."description" AS "description",
            e."category" AS "status",
            NULL::numeric AS "amount",
            NULL::text AS "currency",
            e."timestamp" AS "occurredAt"
          FROM "Event" e
          WHERE
            e."deleted_at" IS NULL
            AND e."data" #>> '{refundId}' = ${refundId}
        ) timeline
        ORDER BY
          timeline."occurredAt" DESC,
          timeline."id" DESC
        LIMIT ${limit}
      `,
    );
  }

  private buildRefundWhere(query: AdminQueryRefundDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`r."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          r."id" ILIKE ${`%${query.q}%`}
          OR r."reason" ILIKE ${`%${query.q}%`}
          OR r."paymentId" ILIKE ${`%${query.q}%`}
          OR p."transactionId" ILIKE ${`%${query.q}%`}
          OR o."orderNumber" ILIKE ${`%${query.q}%`}
          OR u."email" ILIKE ${`%${query.q}%`}
          OR u."phone" ILIKE ${`%${query.q}%`}
          OR u."firstName" ILIKE ${`%${query.q}%`}
          OR u."lastName" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.refundId) {
      where.push(Prisma.sql`r."id" = ${query.refundId}`);
    }

    if (query.paymentId) {
      where.push(Prisma.sql`r."paymentId" = ${query.paymentId}`);
    }

    if (query.orderId) {
      where.push(Prisma.sql`p."orderId" = ${query.orderId}`);
    }

    if (query.userId) {
      where.push(Prisma.sql`p."userId" = ${query.userId}`);
    }

    if (query.email) {
      where.push(Prisma.sql`u."email" ILIKE ${`%${query.email}%`}`);
    }

    if (query.orderNumber) {
      where.push(Prisma.sql`o."orderNumber" ILIKE ${`%${query.orderNumber}%`}`);
    }

    if (query.transactionId) {
      where.push(
        Prisma.sql`p."transactionId" ILIKE ${`%${query.transactionId}%`}`,
      );
    }

    if (query.status) {
      where.push(Prisma.sql`r."status"::text = ${query.status}`);
    }

    if (query.paymentStatus) {
      where.push(Prisma.sql`p."paymentStatus"::text = ${query.paymentStatus}`);
    }

    if (query.currency) {
      where.push(Prisma.sql`p."currency" = ${query.currency}`);
    }

    if (query.amountMin) {
      where.push(Prisma.sql`r."amount" >= ${this.toDecimal(query.amountMin)}`);
    }

    if (query.amountMax) {
      where.push(Prisma.sql`r."amount" <= ${this.toDecimal(query.amountMax)}`);
    }

    if (query.processedOnly === true) {
      where.push(Prisma.sql`r."processedAt" IS NOT NULL`);
    }

    if (query.pendingOnly === true) {
      where.push(Prisma.sql`r."status"::text IN ('PENDING', 'PROCESSING')`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`r."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`r."createdAt" <= ${new Date(query.createdTo)}`);
    }

    if (query.processedFrom) {
      where.push(
        Prisma.sql`r."processedAt" >= ${new Date(query.processedFrom)}`,
      );
    }

    if (query.processedTo) {
      where.push(Prisma.sql`r."processedAt" <= ${new Date(query.processedTo)}`);
    }

    return where;
  }

  private aggregateRefunds(where: Prisma.Sql[]): Promise<SumRow[]> {
    return this.prisma.$queryRaw<SumRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "count",
          COALESCE(SUM(r."amount"), 0)::numeric AS "totalAmount"
        FROM "Refund" r
        INNER JOIN "Payment" p
          ON p."id" = r."paymentId"
        LEFT JOIN "Order" o
          ON o."id" = p."orderId"
        LEFT JOIN "User" u
          ON u."id" = p."userId"
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private async createSystemEvent(
    name: string,
    description: string,
    refundId: string,
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
          'refund',
          NOW(),
          ${actorId ?? null},
          ${JSON.stringify({
            refundId,
            ...data,
          })}::jsonb,
          NOW(),
          NOW()
        )
      `,
    );

    return eventId;
  }

  private mapRefund(row: AdminRefundRow) {
    return {
      id: row.id,
      paymentId: row.paymentId,
      amount: this.toDecimalString(row.amount),
      reason: row.reason,
      status: row.status,
      processedAt: row.processedAt ? row.processedAt.toISOString() : null,
      payment: {
        id: row.paymentId,
        amount:
          row.paymentAmount === null
            ? null
            : this.toDecimalString(row.paymentAmount),
        currency: row.currency,
        status: row.paymentStatus,
        method: row.paymentMethod,
        transactionId: row.transactionId,
        gateway: row.gateway,
        receiptUrl: row.receiptUrl,
        paidAt: row.paidAt ? row.paidAt.toISOString() : null,
        refundedAt: row.refundedAt ? row.refundedAt.toISOString() : null,
      },
      order: {
        id: row.orderId,
        orderNumber: row.orderNumber,
        status: row.orderStatus,
        paymentStatus: row.orderPaymentStatus,
        totalAmount:
          row.orderTotalAmount === null
            ? null
            : this.toDecimalString(row.orderTotalAmount),
      },
      customer: {
        id: row.userId,
        email: row.userEmail,
        phone: row.userPhone,
        firstName: row.userFirstName,
        lastName: row.userLastName,
        fullName: `${row.userFirstName ?? ''} ${row.userLastName ?? ''}`.trim(),
      },
      paymentRefundSummary: {
        completedRefundAmount: this.toDecimalString(
          row.completedRefundAmountForPayment ?? 0,
        ),
        openRefundAmount: this.toDecimalString(
          row.openRefundAmountForPayment ?? 0,
        ),
        refundCount: this.toNumber(row.refundCountForPayment),
      },
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

  private mapTimeline(row: TimelineRow) {
    return {
      source: row.source,
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      amount: row.amount === null ? null : this.toDecimalString(row.amount),
      currency: row.currency,
      occurredAt: row.occurredAt.toISOString(),
    };
  }

  private mapAggregate(row?: SumRow) {
    return {
      count: this.toNumber(row?.count),
      totalAmount: this.toDecimalString(row?.totalAmount ?? 0),
    };
  }

  private resolveSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`r."updatedAt"`;
    }

    if (sortBy === 'processedAt') {
      return Prisma.sql`r."processedAt"`;
    }

    if (sortBy === 'amount') {
      return Prisma.sql`r."amount"`;
    }

    if (sortBy === 'status') {
      return Prisma.sql`r."status"`;
    }

    if (sortBy === 'paymentStatus') {
      return Prisma.sql`p."paymentStatus"`;
    }

    if (sortBy === 'orderNumber') {
      return Prisma.sql`o."orderNumber"`;
    }

    if (sortBy === 'userEmail') {
      return Prisma.sql`u."email"`;
    }

    return Prisma.sql`r."createdAt"`;
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

  private toDecimal(value: string): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }

  private toDecimalString(value: Prisma.Decimal | number | string): string {
    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    return new Prisma.Decimal(value).toFixed(2);
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
