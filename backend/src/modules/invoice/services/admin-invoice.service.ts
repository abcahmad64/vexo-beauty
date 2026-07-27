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

import { AdminAttachInvoicePdfDto } from '../dto/admin-attach-invoice-pdf.dto';

import { AdminCreateInvoiceDto } from '../dto/admin-create-invoice.dto';

import { AdminInvoiceNoteDto } from '../dto/admin-invoice-note.dto';

import { AdminQueryInvoiceDto } from '../dto/admin-query-invoice.dto';

import { AdminUpdateInvoiceDto } from '../dto/admin-update-invoice.dto';

import { AdminUpdateInvoiceStatusDto } from '../dto/admin-update-invoice-status.dto';

type CountRow = {
  count: number | bigint;
};

type SumRow = {
  count: number | bigint;
  totalAmount: unknown;
};

type PaymentContextRow = {
  paymentId: string;
  orderId: string;
  userId: string;
  paymentAmount: unknown;
  currency: string;
  paymentStatus: string;
  paymentMethod: string;
  transactionId: string | null;
  paidAt: Date | null;
  orderNumber: string;
  orderStatus: string;
  orderPaymentStatus: string;
  orderTotalAmount: unknown;
  userEmail: string | null;
  userPhone: string | null;
  userFirstName: string | null;
  userLastName: string | null;
};

export type AdminInvoiceRow = {
  id: string;
  orderId: string;
  paymentId: string;
  invoiceNumber: string;
  issuedAt: Date;
  dueDate: Date | null;
  amount: unknown;
  currency: string;
  status: string;
  pdfUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  orderNumber: string | null;
  orderStatus: string | null;
  orderPaymentStatus: string | null;
  orderTotalAmount: unknown;

  paymentAmount: unknown;
  paymentStatus: string | null;
  paymentMethod: string | null;
  transactionId: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;

  userId: string | null;
  userEmail: string | null;
  userPhone: string | null;
  userFirstName: string | null;
  userLastName: string | null;

  itemCount: number | bigint;
  totalQuantity: number | bigint;
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
  amount: unknown;
  currency: string | null;
  occurredAt: Date;
};

@Injectable()
export class AdminInvoiceService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminQueryInvoiceDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildInvoiceWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AdminInvoiceRow[]>(
        Prisma.sql`
            ${this.invoiceSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolveSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              i."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Invoice" i
            INNER JOIN "Order" o
              ON o."id" = i."orderId"
            INNER JOIN "Payment" p
              ON p."id" = i."paymentId"
            LEFT JOIN "User" u
              ON u."id" = p."userId"
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapInvoice(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(invoiceId: string, includeDeleted = true) {
    const invoice = await this.findInvoiceRow(invoiceId, includeDeleted);

    const [notes, timeline] = await Promise.all([
      this.findInvoiceNotes(invoiceId, 20),
      this.findInvoiceTimeline(invoiceId, 80),
    ]);

    return {
      ...this.mapInvoice(invoice),
      notes: notes.map((note) => this.mapNote(note)),
      timeline: timeline.map((row) => this.mapTimeline(row)),
    };
  }

  async create(dto: AdminCreateInvoiceDto, actorId?: string) {
    const context = await this.resolvePaymentContext(
      dto.paymentId,
      dto.orderId,
    );

    await this.assertInvoiceUniqueness(context.orderId, context.paymentId);

    const invoiceNumber =
      dto.invoiceNumber ?? (await this.generateUniqueInvoiceNumber());

    await this.assertInvoiceNumberUnique(invoiceNumber);

    const invoiceId = randomUUID();

    const amount = dto.amount
      ? this.toDecimal(dto.amount)
      : this.toDecimal(this.toDecimalString(context.paymentAmount));

    const status =
      dto.status ?? this.resolveInitialStatus(context.paymentStatus);

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Invoice" (
          "id",
          "orderId",
          "paymentId",
          "invoiceNumber",
          "issuedAt",
          "dueDate",
          "amount",
          "currency",
          "status",
          "pdfUrl",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${invoiceId},
          ${context.orderId},
          ${context.paymentId},
          ${invoiceNumber},
          ${dto.issuedAt ? new Date(dto.issuedAt) : new Date()},
          ${dto.dueDate ? new Date(dto.dueDate) : null},
          ${amount},
          ${dto.currency ?? context.currency},
          ${status}::"InvoiceStatus",
          ${dto.pdfUrl ?? null},
          NOW(),
          NOW()
        )
      `,
    );

    await this.createSystemEvent(
      'invoice.admin_created',
      'فاکتور توسط ادمین ایجاد شد.',
      invoiceId,
      actorId,
      {
        orderId: context.orderId,
        paymentId: context.paymentId,
        invoiceNumber,
      },
    );

    return {
      invoice: await this.findOne(invoiceId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'invoice.admin_created',
      },
    };
  }

  async update(
    invoiceId: string,
    dto: AdminUpdateInvoiceDto,
    actorId?: string,
  ) {
    const current = await this.findInvoiceRow(invoiceId, false);

    if (current.status === 'CANCELLED') {
      throw new BadRequestException('فاکتور لغوشده قابل ویرایش نیست.');
    }

    if (
      dto.invoiceNumber !== undefined &&
      dto.invoiceNumber !== current.invoiceNumber
    ) {
      await this.assertInvoiceNumberUnique(dto.invoiceNumber, invoiceId);
    }

    const assignments = this.buildUpdateAssignments(dto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی فاکتور ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Invoice"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = NOW()
        WHERE
          "id" = ${invoiceId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'invoice.admin_updated',
      'اطلاعات فاکتور توسط ادمین به‌روزرسانی شد.',
      invoiceId,
      actorId,
      {
        changedFields: Object.keys(dto),
      },
    );

    return {
      invoice: await this.findOne(invoiceId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'invoice.admin_updated',
      },
    };
  }

  async updateStatus(
    invoiceId: string,
    dto: AdminUpdateInvoiceStatusDto,
    actorId?: string,
  ) {
    const current = await this.findInvoiceRow(invoiceId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Invoice"
        SET
          "status" = ${dto.status}::"InvoiceStatus",
          "updatedAt" = NOW()
        WHERE
          "id" = ${invoiceId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'invoice.status.updated',
      'وضعیت فاکتور توسط ادمین تغییر کرد.',
      invoiceId,
      actorId,
      {
        previousStatus: current.status,
        currentStatus: dto.status,
        reason: dto.reason ?? null,
      },
    );

    return {
      invoice: await this.findOne(invoiceId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'invoice.status_updated',
        previousStatus: current.status,
        currentStatus: dto.status,
        reason: dto.reason ?? null,
      },
    };
  }

  async issue(invoiceId: string, actorId?: string) {
    const current = await this.findInvoiceRow(invoiceId, false);

    if (current.status === 'CANCELLED') {
      throw new BadRequestException('فاکتور لغوشده قابل صدور نیست.');
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Invoice"
        SET
          "issuedAt" = NOW(),
          "status" = CASE
            WHEN "status"::text = 'PENDING' THEN 'PAID'::"InvoiceStatus"
            ELSE "status"
          END,
          "updatedAt" = NOW()
        WHERE
          "id" = ${invoiceId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'invoice.issued',
      'فاکتور توسط ادمین صادر شد.',
      invoiceId,
      actorId,
      {},
    );

    return {
      invoice: await this.findOne(invoiceId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'invoice.issued',
      },
    };
  }

  async cancel(invoiceId: string, reason?: string, actorId?: string) {
    const current = await this.findInvoiceRow(invoiceId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Invoice"
        SET
          "status" = 'CANCELLED'::"InvoiceStatus",
          "updatedAt" = NOW()
        WHERE
          "id" = ${invoiceId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'invoice.cancelled',
      'فاکتور توسط ادمین لغو شد.',
      invoiceId,
      actorId,
      {
        previousStatus: current.status,
        reason: reason ?? null,
      },
    );

    return {
      invoice: await this.findOne(invoiceId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'invoice.cancelled',
        reason: reason ?? null,
      },
    };
  }

  async attachPdf(
    invoiceId: string,
    dto: AdminAttachInvoicePdfDto,
    actorId?: string,
  ) {
    await this.findInvoiceRow(invoiceId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Invoice"
        SET
          "pdfUrl" = ${dto.pdfUrl},
          "updatedAt" = NOW()
        WHERE
          "id" = ${invoiceId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'invoice.pdf.attached',
      'فایل PDF فاکتور توسط ادمین ثبت شد.',
      invoiceId,
      actorId,
      {
        pdfUrl: dto.pdfUrl,
      },
    );

    return {
      invoice: await this.findOne(invoiceId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'invoice.pdf_attached',
      },
    };
  }

  async delete(invoiceId: string, actorId?: string) {
    await this.findInvoiceRow(invoiceId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Invoice"
        SET
          "deleted_at" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${invoiceId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'invoice.admin_deleted',
      'فاکتور توسط ادمین حذف نرم شد.',
      invoiceId,
      actorId,
      {},
    );

    return {
      success: true,
      message: 'فاکتور با موفقیت حذف شد.',
      audit: {
        actorId: actorId ?? null,
        action: 'invoice.admin_deleted',
      },
    };
  }

  async restore(invoiceId: string, actorId?: string) {
    await this.findInvoiceRow(invoiceId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Invoice"
        SET
          "deleted_at" = NULL,
          "updatedAt" = NOW()
        WHERE "id" = ${invoiceId}
      `,
    );

    await this.createSystemEvent(
      'invoice.admin_restored',
      'فاکتور حذف‌شده توسط ادمین بازگردانی شد.',
      invoiceId,
      actorId,
      {},
    );

    return {
      invoice: await this.findOne(invoiceId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'invoice.admin_restored',
      },
    };
  }

  async getDashboard(query: AdminQueryInvoiceDto) {
    const where = this.buildInvoiceWhere({
      ...query,
      includeDeleted: false,
    });

    const [
      totalRows,
      paidRows,
      pendingRows,
      overdueRows,
      cancelledRows,
      noPdfRows,
    ] = await Promise.all([
      this.aggregate(where),
      this.aggregate([...where, Prisma.sql`i."status"::text = 'PAID'`]),
      this.aggregate([...where, Prisma.sql`i."status"::text = 'PENDING'`]),
      this.aggregate([
        ...where,
        Prisma.sql`(
            i."status"::text = 'OVERDUE'
            OR (
              i."status"::text = 'PENDING'
              AND i."dueDate" IS NOT NULL
              AND i."dueDate" < NOW()
            )
          )`,
      ]),
      this.aggregate([...where, Prisma.sql`i."status"::text = 'CANCELLED'`]),
      this.aggregate([...where, Prisma.sql`i."pdfUrl" IS NULL`]),
    ]);

    return {
      total: this.mapAggregate(totalRows[0]),
      paid: this.mapAggregate(paidRows[0]),
      pending: this.mapAggregate(pendingRows[0]),
      overdue: this.mapAggregate(overdueRows[0]),
      cancelled: this.mapAggregate(cancelledRows[0]),
      noPdf: this.mapAggregate(noPdfRows[0]),
    };
  }

  async getNotes(invoiceId: string, limit = 50) {
    await this.findInvoiceRow(invoiceId, true);

    const notes = await this.findInvoiceNotes(invoiceId, limit);

    return {
      data: notes.map((note) => this.mapNote(note)),
      meta: {
        invoiceId,
        total: notes.length,
      },
    };
  }

  async createNote(
    invoiceId: string,
    dto: AdminInvoiceNoteDto,
    actorId?: string,
  ) {
    await this.findInvoiceRow(invoiceId, true);

    const noteId = await this.createSystemEvent(
      'invoice.note.created',
      'یادداشت مدیریتی برای فاکتور ثبت شد.',
      invoiceId,
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
      message: 'یادداشت فاکتور با موفقیت ثبت شد.',
    };
  }

  async deleteNote(invoiceId: string, noteId: string, actorId?: string) {
    await this.findInvoiceRow(invoiceId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Event"
        SET
          "deleted_at" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${noteId}
          AND "name" = 'invoice.note.created'
          AND "data" #>> '{invoiceId}' = ${invoiceId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      success: true,
      message: 'یادداشت فاکتور با موفقیت حذف شد.',
      audit: {
        actorId: actorId ?? null,
        action: 'invoice.note_deleted',
      },
    };
  }

  async getTimeline(invoiceId: string, limit = 100) {
    await this.findInvoiceRow(invoiceId, true);

    const safeLimit = Math.min(Math.max(limit, 1), 300);

    const rows = await this.findInvoiceTimeline(invoiceId, safeLimit);

    return {
      data: rows.map((row) => this.mapTimeline(row)),
      meta: {
        invoiceId,
        total: rows.length,
      },
    };
  }

  async findForExport(query: AdminQueryInvoiceDto) {
    const where = this.buildInvoiceWhere(query);

    const rows = await this.prisma.$queryRaw<AdminInvoiceRow[]>(
      Prisma.sql`
          ${this.invoiceSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            i."createdAt" DESC,
            i."id" DESC
          LIMIT 5000
        `,
    );

    return rows.map((row) => this.mapInvoice(row));
  }

  async findInvoiceRow(
    invoiceId: string,
    includeDeleted: boolean,
  ): Promise<AdminInvoiceRow> {
    const where: Prisma.Sql[] = [Prisma.sql`i."id" = ${invoiceId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`i."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AdminInvoiceRow[]>(
      Prisma.sql`
          ${this.invoiceSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const invoice = rows[0];

    if (!invoice) {
      throw new NotFoundException('فاکتور موردنظر یافت نشد.');
    }

    return invoice;
  }

  private invoiceSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        i."id",
        i."orderId",
        i."paymentId",
        i."invoiceNumber",
        i."issuedAt",
        i."dueDate",
        i."amount",
        i."currency",
        i."status"::text AS "status",
        i."pdfUrl",
        i."createdAt",
        i."updatedAt",
        i."deleted_at" AS "deletedAt",

        o."orderNumber",
        o."status"::text AS "orderStatus",
        o."paymentStatus"::text AS "orderPaymentStatus",
        o."totalAmount" AS "orderTotalAmount",

        p."amount" AS "paymentAmount",
        p."paymentStatus"::text AS "paymentStatus",
        p."paymentMethod"::text AS "paymentMethod",
        p."transactionId",
        p."paidAt",
        p."refundedAt",

        u."id" AS "userId",
        u."email" AS "userEmail",
        u."phone" AS "userPhone",
        u."firstName" AS "userFirstName",
        u."lastName" AS "userLastName",

        COALESCE(stats."itemCount", 0)::int AS "itemCount",
        COALESCE(stats."totalQuantity", 0)::int AS "totalQuantity"
      FROM "Invoice" i
      INNER JOIN "Order" o
        ON o."id" = i."orderId"
      INNER JOIN "Payment" p
        ON p."id" = i."paymentId"
      LEFT JOIN "User" u
        ON u."id" = p."userId"
      LEFT JOIN LATERAL (
        SELECT
          COUNT(oi."id")::int AS "itemCount",
          COALESCE(SUM(oi."quantity"), 0)::int AS "totalQuantity"
        FROM "OrderItem" oi
        WHERE oi."orderId" = o."id"
      ) stats ON TRUE
    `;
  }

  private buildInvoiceWhere(query: AdminQueryInvoiceDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`i."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          i."id" ILIKE ${`%${query.q}%`}
          OR i."invoiceNumber" ILIKE ${`%${query.q}%`}
          OR i."orderId" ILIKE ${`%${query.q}%`}
          OR i."paymentId" ILIKE ${`%${query.q}%`}
          OR o."orderNumber" ILIKE ${`%${query.q}%`}
          OR p."transactionId" ILIKE ${`%${query.q}%`}
          OR u."email" ILIKE ${`%${query.q}%`}
          OR u."phone" ILIKE ${`%${query.q}%`}
          OR u."firstName" ILIKE ${`%${query.q}%`}
          OR u."lastName" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.invoiceId) {
      where.push(Prisma.sql`i."id" = ${query.invoiceId}`);
    }

    if (query.invoiceNumber) {
      where.push(
        Prisma.sql`i."invoiceNumber" ILIKE ${`%${query.invoiceNumber}%`}`,
      );
    }

    if (query.orderId) {
      where.push(Prisma.sql`i."orderId" = ${query.orderId}`);
    }

    if (query.paymentId) {
      where.push(Prisma.sql`i."paymentId" = ${query.paymentId}`);
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
      where.push(Prisma.sql`i."status"::text = ${query.status}`);
    }

    if (query.paymentStatus) {
      where.push(Prisma.sql`p."paymentStatus"::text = ${query.paymentStatus}`);
    }

    if (query.currency) {
      where.push(Prisma.sql`i."currency" = ${query.currency}`);
    }

    if (query.amountMin) {
      where.push(Prisma.sql`i."amount" >= ${this.toDecimal(query.amountMin)}`);
    }

    if (query.amountMax) {
      where.push(Prisma.sql`i."amount" <= ${this.toDecimal(query.amountMax)}`);
    }

    if (query.hasPdf === true) {
      where.push(Prisma.sql`i."pdfUrl" IS NOT NULL`);
    }

    if (query.hasPdf === false) {
      where.push(Prisma.sql`i."pdfUrl" IS NULL`);
    }

    if (query.overdueOnly === true) {
      where.push(
        Prisma.sql`(
          i."status"::text = 'OVERDUE'
          OR (
            i."status"::text = 'PENDING'
            AND i."dueDate" IS NOT NULL
            AND i."dueDate" < NOW()
          )
        )`,
      );
    }

    if (query.issuedFrom) {
      where.push(Prisma.sql`i."issuedAt" >= ${new Date(query.issuedFrom)}`);
    }

    if (query.issuedTo) {
      where.push(Prisma.sql`i."issuedAt" <= ${new Date(query.issuedTo)}`);
    }

    if (query.dueFrom) {
      where.push(Prisma.sql`i."dueDate" >= ${new Date(query.dueFrom)}`);
    }

    if (query.dueTo) {
      where.push(Prisma.sql`i."dueDate" <= ${new Date(query.dueTo)}`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`i."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`i."createdAt" <= ${new Date(query.createdTo)}`);
    }

    return where;
  }

  private buildUpdateAssignments(dto: AdminUpdateInvoiceDto): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.invoiceNumber !== undefined) {
      assignments.push(Prisma.sql`"invoiceNumber" = ${dto.invoiceNumber}`);
    }

    if (dto.amount !== undefined) {
      assignments.push(Prisma.sql`"amount" = ${this.toDecimal(dto.amount)}`);
    }

    if (dto.currency !== undefined) {
      assignments.push(Prisma.sql`"currency" = ${dto.currency}`);
    }

    if (dto.issuedAt !== undefined) {
      assignments.push(Prisma.sql`"issuedAt" = ${new Date(dto.issuedAt)}`);
    }

    if (dto.dueDate !== undefined) {
      assignments.push(Prisma.sql`"dueDate" = ${new Date(dto.dueDate)}`);
    }

    if (dto.pdfUrl !== undefined) {
      assignments.push(Prisma.sql`"pdfUrl" = ${dto.pdfUrl}`);
    }

    return assignments;
  }

  private async resolvePaymentContext(
    paymentId?: string,
    orderId?: string,
  ): Promise<PaymentContextRow> {
    if (!paymentId && !orderId) {
      throw new BadRequestException(
        'برای ایجاد فاکتور باید paymentId یا orderId ارسال شود.',
      );
    }

    const where = paymentId
      ? Prisma.sql`p."id" = ${paymentId}`
      : Prisma.sql`p."orderId" = ${orderId}`;

    const rows = await this.prisma.$queryRaw<PaymentContextRow[]>(
      Prisma.sql`
          SELECT
            p."id" AS "paymentId",
            p."orderId",
            p."userId",
            p."amount" AS "paymentAmount",
            p."currency",
            p."paymentStatus"::text AS "paymentStatus",
            p."paymentMethod"::text AS "paymentMethod",
            p."transactionId",
            p."paidAt",
            o."orderNumber",
            o."status"::text AS "orderStatus",
            o."paymentStatus"::text AS "orderPaymentStatus",
            o."totalAmount" AS "orderTotalAmount",
            u."email" AS "userEmail",
            u."phone" AS "userPhone",
            u."firstName" AS "userFirstName",
            u."lastName" AS "userLastName"
          FROM "Payment" p
          INNER JOIN "Order" o
            ON o."id" = p."orderId"
          LEFT JOIN "User" u
            ON u."id" = p."userId"
          WHERE
            ${where}
            AND p."deleted_at" IS NULL
            AND o."deleted_at" IS NULL
          ORDER BY
            CASE
              WHEN p."paymentStatus"::text = 'COMPLETED' THEN 1
              ELSE 2
            END ASC,
            p."createdAt" DESC
          LIMIT 1
        `,
    );

    const context = rows[0];

    if (!context) {
      throw new NotFoundException(
        'پرداخت یا سفارش معتبر برای ایجاد فاکتور یافت نشد.',
      );
    }

    return context;
  }

  private async assertInvoiceUniqueness(
    orderId: string,
    paymentId: string,
  ): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Invoice"
          WHERE
            (
              "orderId" = ${orderId}
              OR "paymentId" = ${paymentId}
            )
            AND "deleted_at" IS NULL
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException(
        'برای این سفارش یا پرداخت قبلاً فاکتور ثبت شده است.',
      );
    }
  }

  private async assertInvoiceNumberUnique(
    invoiceNumber: string,
    exceptInvoiceId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [
      Prisma.sql`LOWER("invoiceNumber") = LOWER(${invoiceNumber})`,
    ];

    if (exceptInvoiceId) {
      where.push(Prisma.sql`"id" <> ${exceptInvoiceId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Invoice"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('شماره فاکتور تکراری است.');
    }
  }

  private async generateUniqueInvoiceNumber(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const now = new Date();

      const year = now.getFullYear();

      const month = String(now.getMonth() + 1).padStart(2, '0');

      const day = String(now.getDate()).padStart(2, '0');

      const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();

      const invoiceNumber = `INV-${year}${month}${day}-${suffix}`;

      const rows = await this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Invoice"
            WHERE "invoiceNumber" = ${invoiceNumber}
          `,
      );

      if (this.toNumber(rows[0]?.count) === 0) {
        return invoiceNumber;
      }
    }

    throw new BadRequestException('امکان تولید شماره فاکتور یکتا وجود ندارد.');
  }

  private resolveInitialStatus(paymentStatus: string): string {
    if (paymentStatus === 'COMPLETED') {
      return 'PAID';
    }

    if (paymentStatus === 'FAILED' || paymentStatus === 'REFUNDED') {
      return 'CANCELLED';
    }

    return 'PENDING';
  }

  private aggregate(where: Prisma.Sql[]): Promise<SumRow[]> {
    return this.prisma.$queryRaw<SumRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "count",
          COALESCE(SUM(i."amount"), 0)::numeric AS "totalAmount"
        FROM "Invoice" i
        INNER JOIN "Order" o
          ON o."id" = i."orderId"
        INNER JOIN "Payment" p
          ON p."id" = i."paymentId"
        LEFT JOIN "User" u
          ON u."id" = p."userId"
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private findInvoiceNotes(
    invoiceId: string,
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
          AND "name" = 'invoice.note.created'
          AND "data" #>> '{invoiceId}' = ${invoiceId}
        ORDER BY
          "timestamp" DESC,
          "createdAt" DESC
        LIMIT ${Math.min(Math.max(limit, 1), 200)}
      `,
    );
  }

  private findInvoiceTimeline(
    invoiceId: string,
    limit: number,
  ): Promise<TimelineRow[]> {
    return this.prisma.$queryRaw<TimelineRow[]>(
      Prisma.sql`
        SELECT *
        FROM (
          SELECT
            'invoice'::text AS "source",
            i."id" AS "id",
            CONCAT('فاکتور ', i."invoiceNumber") AS "title",
            i."pdfUrl" AS "description",
            i."status"::text AS "status",
            i."amount" AS "amount",
            i."currency" AS "currency",
            i."createdAt" AS "occurredAt"
          FROM "Invoice" i
          WHERE i."id" = ${invoiceId}

          UNION ALL

          SELECT
            'payment'::text AS "source",
            p."id" AS "id",
            'پرداخت مرتبط با فاکتور'::text AS "title",
            p."paymentMethod"::text AS "description",
            p."paymentStatus"::text AS "status",
            p."amount" AS "amount",
            p."currency" AS "currency",
            p."createdAt" AS "occurredAt"
          FROM "Invoice" i
          INNER JOIN "Payment" p
            ON p."id" = i."paymentId"
          WHERE
            i."id" = ${invoiceId}
            AND p."deleted_at" IS NULL

          UNION ALL

          SELECT
            'order'::text AS "source",
            o."id" AS "id",
            CONCAT('سفارش ', o."orderNumber") AS "title",
            o."notes" AS "description",
            o."status"::text AS "status",
            o."totalAmount" AS "amount",
            o."currency" AS "currency",
            o."createdAt" AS "occurredAt"
          FROM "Invoice" i
          INNER JOIN "Order" o
            ON o."id" = i."orderId"
          WHERE
            i."id" = ${invoiceId}
            AND o."deleted_at" IS NULL

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
            AND e."data" #>> '{invoiceId}' = ${invoiceId}
        ) timeline
        ORDER BY
          timeline."occurredAt" DESC,
          timeline."id" DESC
        LIMIT ${limit}
      `,
    );
  }

  private async createSystemEvent(
    name: string,
    description: string,
    invoiceId: string,
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
          'invoice',
          NOW(),
          ${actorId ?? null},
          ${JSON.stringify({
            invoiceId,
            ...data,
          })}::jsonb,
          NOW(),
          NOW()
        )
      `,
    );

    return eventId;
  }

  private toIsoString(value: Date | null): string | null {
    return value ? value.toISOString() : null;
  }

  private toPersianDateTimeString(value: Date | null): string | null {
    return formatPersianDateTime(value);
  }

  private mapInvoice(row: AdminInvoiceRow) {
    return {
      id: row.id,
      orderId: row.orderId,
      paymentId: row.paymentId,
      invoiceNumber: row.invoiceNumber,
      issuedAt: this.toIsoString(row.issuedAt),
      issuedAtFa: this.toPersianDateTimeString(row.issuedAt),
      dueDate: this.toIsoString(row.dueDate),
      dueDateFa: this.toPersianDateTimeString(row.dueDate),
      amount: this.toDecimalString(row.amount),
      currency: row.currency,
      status: row.status,
      pdfUrl: row.pdfUrl,
      hasPdf: row.pdfUrl !== null,
      order: {
        id: row.orderId,
        orderNumber: row.orderNumber,
        status: row.orderStatus,
        paymentStatus: row.orderPaymentStatus,
        totalAmount: this.toDecimalString(row.orderTotalAmount),
      },
      payment: {
        id: row.paymentId,
        amount: this.toDecimalString(row.paymentAmount),
        status: row.paymentStatus,
        method: row.paymentMethod,
        transactionId: row.transactionId,
        paidAt: this.toIsoString(row.paidAt),
        paidAtFa: this.toPersianDateTimeString(row.paidAt),
        refundedAt: this.toIsoString(row.refundedAt),
        refundedAtFa: this.toPersianDateTimeString(row.refundedAt),
      },
      customer: {
        id: row.userId,
        email: row.userEmail,
        phone: row.userPhone,
        firstName: row.userFirstName,
        lastName: row.userLastName,
        fullName: `${row.userFirstName ?? ''} ${row.userLastName ?? ''}`.trim(),
      },
      itemsSummary: {
        itemCount: this.toNumber(row.itemCount),
        totalQuantity: this.toNumber(row.totalQuantity),
      },
      createdAt: this.toIsoString(row.createdAt),
      createdAtFa: this.toPersianDateTimeString(row.createdAt),
      updatedAt: this.toIsoString(row.updatedAt),
      updatedAtFa: this.toPersianDateTimeString(row.updatedAt),
      deletedAt: this.toIsoString(row.deletedAt),
      deletedAtFa: this.toPersianDateTimeString(row.deletedAt),
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
      createdAt: this.toIsoString(row.timestamp),
      createdAtFa: this.toPersianDateTimeString(row.timestamp),
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
      occurredAt: this.toIsoString(row.occurredAt),
      occurredAtFa: this.toPersianDateTimeString(row.occurredAt),
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
      return Prisma.sql`i."updatedAt"`;
    }

    if (sortBy === 'issuedAt') {
      return Prisma.sql`i."issuedAt"`;
    }

    if (sortBy === 'dueDate') {
      return Prisma.sql`i."dueDate"`;
    }

    if (sortBy === 'invoiceNumber') {
      return Prisma.sql`i."invoiceNumber"`;
    }

    if (sortBy === 'amount') {
      return Prisma.sql`i."amount"`;
    }

    if (sortBy === 'status') {
      return Prisma.sql`i."status"`;
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

    return Prisma.sql`i."createdAt"`;
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
    try {
      return new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException('مقدار عددی مبلغ معتبر نیست.');
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
