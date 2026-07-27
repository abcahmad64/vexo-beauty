import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import {
  InvoiceStatus,
  PaymentStatus,
  Prisma,
} from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { CancelInvoiceDto } from '../dto/cancel-invoice.dto';

import { CreateInvoiceDto } from '../dto/create-invoice.dto';

import { IssueInvoiceDto } from '../dto/issue-invoice.dto';

import { QueryInvoiceDto } from '../dto/query-invoice.dto';

import { UpdateInvoiceDto } from '../dto/update-invoice.dto';

import { InvoiceEventPublisher } from '../events/invoice.event.publisher';

type CountRow = {
  count: number;
};

type OrderContextRow = {
  id: string;
  orderNumber: string;
  userId: string;
  status: string;
  paymentStatus: PaymentStatus;
  totalAmount: Prisma.Decimal;
  currency: string;
  deletedAt: Date | null;
};

type PaymentContextRow = {
  id: string;
  orderId: string;
  userId: string;
  amount: Prisma.Decimal;
  currency: string;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  transactionId: string | null;
  paidAt: Date | null;
  deletedAt: Date | null;
};

type InvoiceRow = {
  id: string;
  orderId: string;
  paymentId: string;
  invoiceNumber: string;
  issuedAt: Date;
  dueDate: Date | null;
  amount: Prisma.Decimal;
  currency: string;
  status: InvoiceStatus;
  pdfUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  orderNumber: string | null;
  userId: string | null;
  orderStatus: string | null;
  orderPaymentStatus: PaymentStatus | null;
  paymentStatus: PaymentStatus | null;
  paymentMethod: string | null;
  transactionId: string | null;
  paidAt: Date | null;
};

type InvoiceResponse = {
  id: string;
  orderId: string;
  paymentId: string;
  invoiceNumber: string;
  issuedAt: Date;
  issuedAtFa: string | null;
  dueDate: Date | null;
  dueDateFa: string | null;
  amount: string;
  currency: string;
  status: InvoiceStatus;
  pdfUrl: string | null;
  createdAt: Date;
  createdAtFa: string | null;
  updatedAt: Date;
  updatedAtFa: string | null;
  deletedAt: Date | null;
  deletedAtFa: string | null;
  order: {
    id: string;
    orderNumber: string | null;
    userId: string | null;
    status: string | null;
    paymentStatus: PaymentStatus | null;
  };
  payment: {
    id: string;
    status: PaymentStatus | null;
    method: string | null;
    transactionId: string | null;
    paidAt: Date | null;
    paidAtFa: string | null;
  };
};

type InvoiceListResponse = {
  data: InvoiceResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

/** Customer-facing invoice contract; excludes storage and transaction internals. */
export type CustomerInvoiceResponse = {
  id: string;
  orderId: string;
  paymentId: string;
  invoiceNumber: string;
  issuedAt: Date;
  issuedAtFa: string | null;
  dueDate: Date | null;
  dueDateFa: string | null;
  amount: string;
  currency: string;
  status: InvoiceStatus;
  createdAt: Date;
  createdAtFa: string | null;
  updatedAt: Date;
  updatedAtFa: string | null;
  order: {
    id: string;
    orderNumber: string | null;
    status: string | null;
    paymentStatus: PaymentStatus | null;
  };
  payment: {
    id: string;
    status: PaymentStatus | null;
    method: string | null;
    paidAt: Date | null;
    paidAtFa: string | null;
  };
};

type CustomerInvoiceListResponse = {
  data: CustomerInvoiceResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type InvoiceMutationOptions = {
  actorId?: string;
};

@Injectable()
export class InvoiceService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: InvoiceEventPublisher,
  ) {}

  async createInvoice(
    dto: CreateInvoiceDto,
    options: InvoiceMutationOptions = {},
  ): Promise<InvoiceResponse> {
    const order = await this.findOrderContext(dto.orderId);

    const payment = dto.paymentId
      ? await this.findPaymentContext(dto.paymentId)
      : await this.findBestPaymentForOrder(dto.orderId);

    if (payment.orderId !== order.id) {
      throw new BadRequestException('پرداخت متعلق به سفارش انتخاب‌شده نیست.');
    }

    if (payment.userId !== order.userId) {
      throw new BadRequestException('مالک پرداخت با مالک سفارش یکسان نیست.');
    }

    await this.assertInvoiceDoesNotExistForOrder(order.id);

    await this.assertInvoiceDoesNotExistForPayment(payment.id);

    const amount = dto.amount
      ? new Prisma.Decimal(dto.amount)
      : payment.amount.greaterThan(0)
        ? payment.amount
        : order.totalAmount;

    const currency = dto.currency ?? payment.currency ?? order.currency;

    const status =
      dto.status ?? this.resolveInitialStatus(payment.paymentStatus);

    const issuedAt = this.parseOptionalDate(dto.issuedAt) ?? new Date();

    const dueDate = this.parseOptionalDate(dto.dueDate) ?? null;

    const invoiceNumber =
      dto.invoiceNumber ?? (await this.generateUniqueInvoiceNumber());

    const invoiceId = randomUUID();

    const rows = await this.prisma.$queryRaw<InvoiceRow[]>(
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
            ${order.id},
            ${payment.id},
            ${invoiceNumber},
            ${issuedAt},
            ${dueDate},
            ${amount},
            ${currency},
            ${status}::"InvoiceStatus",
            ${dto.pdfUrl ?? null},
            NOW(),
            NOW()
          )
          RETURNING
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
            "updatedAt",
            "deleted_at" AS "deletedAt",
            NULL::text AS "orderNumber",
            NULL::text AS "userId",
            NULL::text AS "orderStatus",
            NULL::"PaymentStatus" AS "orderPaymentStatus",
            NULL::"PaymentStatus" AS "paymentStatus",
            NULL::text AS "paymentMethod",
            NULL::text AS "transactionId",
            NULL::timestamp AS "paidAt"
        `,
    );

    const invoice = await this.findInvoiceById(this.requireInvoice(rows).id, {
      includeDeleted: false,
    });

    this.events.publishInvoiceCreated({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      orderId: invoice.orderId,
      paymentId: invoice.paymentId,
      userId: order.userId,
      orderNumber: order.orderNumber,
      amount: this.toDecimalString(invoice.amount),
      currency: invoice.currency,
      status: invoice.status,
      actorId: options.actorId,
      notifyCustomer: dto.notifyCustomer !== false,
      occurredAt: new Date(),
    });

    return this.mapInvoice(invoice);
  }

  async findAllForAdmin(query: QueryInvoiceDto): Promise<InvoiceListResponse> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const offset = (page - 1) * limit;

    const where = this.buildAdminWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<InvoiceRow[]>(
        Prisma.sql`
            ${this.invoiceSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              i."createdAt" DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Invoice" i
            LEFT JOIN "Order" o
              ON o."id" = i."orderId"
            LEFT JOIN "Payment" p
              ON p."id" = i."paymentId"
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = countRows[0]?.count ?? 0;

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

  async findAllForUser(
    userId: string,
    query: QueryInvoiceDto,
  ): Promise<CustomerInvoiceListResponse> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const offset = (page - 1) * limit;

    const where = this.buildUserWhere(userId, query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<InvoiceRow[]>(
        Prisma.sql`
            ${this.invoiceSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              i."createdAt" DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Invoice" i
            LEFT JOIN "Order" o
              ON o."id" = i."orderId"
            LEFT JOIN "Payment" p
              ON p."id" = i."paymentId"
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = countRows[0]?.count ?? 0;

    return {
      data: rows.map((row) => this.mapCustomerInvoice(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneForAdmin(
    invoiceId: string,
    includeDeleted = false,
  ): Promise<InvoiceResponse> {
    const invoice = await this.findInvoiceById(invoiceId, {
      includeDeleted,
    });

    return this.mapInvoice(invoice);
  }

  async findOneForUser(
    userId: string,
    invoiceId: string,
  ): Promise<CustomerInvoiceResponse> {
    const invoice = await this.findInvoiceById(invoiceId, {
      includeDeleted: false,
    });

    if (invoice.userId !== userId) {
      throw new NotFoundException('فاکتور پیدا نشد.');
    }

    return this.mapCustomerInvoice(invoice);
  }

  async findByInvoiceNumberForUser(
    userId: string,
    invoiceNumber: string,
  ): Promise<CustomerInvoiceResponse> {
    const invoice = await this.findInvoiceByNumber(invoiceNumber, {
      includeDeleted: false,
    });

    if (invoice.userId !== userId) {
      throw new NotFoundException('فاکتور پیدا نشد.');
    }

    return this.mapCustomerInvoice(invoice);
  }

  async updateInvoice(
    invoiceId: string,
    dto: UpdateInvoiceDto,
    options: InvoiceMutationOptions = {},
  ): Promise<InvoiceResponse> {
    const current = await this.findInvoiceById(invoiceId, {
      includeDeleted: false,
    });

    this.assertInvoiceCanBeUpdated(current);

    const nextAmount = dto.amount
      ? new Prisma.Decimal(dto.amount)
      : current.amount;

    const nextCurrency = dto.currency ?? current.currency;

    const nextStatus = dto.status ?? current.status;

    const nextIssuedAt =
      this.parseOptionalDate(dto.issuedAt) ?? current.issuedAt;

    const nextDueDate = this.parseOptionalDate(dto.dueDate) ?? current.dueDate;

    const nextPdfUrl = dto.pdfUrl ?? current.pdfUrl;

    const rows = await this.prisma.$queryRaw<InvoiceRow[]>(
      Prisma.sql`
          UPDATE "Invoice"
          SET
            "amount" = ${nextAmount},
            "currency" = ${nextCurrency},
            "status" = ${nextStatus}::"InvoiceStatus",
            "issuedAt" = ${nextIssuedAt},
            "dueDate" = ${nextDueDate},
            "pdfUrl" = ${nextPdfUrl},
            "updatedAt" = NOW()
          WHERE
            "id" = ${invoiceId}
            AND "deleted_at" IS NULL
          RETURNING
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
            "updatedAt",
            "deleted_at" AS "deletedAt",
            NULL::text AS "orderNumber",
            NULL::text AS "userId",
            NULL::text AS "orderStatus",
            NULL::"PaymentStatus" AS "orderPaymentStatus",
            NULL::"PaymentStatus" AS "paymentStatus",
            NULL::text AS "paymentMethod",
            NULL::text AS "transactionId",
            NULL::timestamp AS "paidAt"
        `,
    );

    const updated = await this.findInvoiceById(this.requireInvoice(rows).id, {
      includeDeleted: false,
    });

    this.events.publishInvoiceUpdated({
      invoiceId: updated.id,
      invoiceNumber: updated.invoiceNumber,
      orderId: updated.orderId,
      paymentId: updated.paymentId,
      userId: updated.userId ?? '',
      amount: this.toDecimalString(updated.amount),
      currency: updated.currency,
      previousStatus: current.status,
      currentStatus: updated.status,
      previousPdfUrl: current.pdfUrl,
      currentPdfUrl: updated.pdfUrl,
      previousDueDate: current.dueDate,
      currentDueDate: updated.dueDate,
      actorId: options.actorId,
      notifyCustomer: dto.notifyCustomer === true,
      occurredAt: new Date(),
    });

    return this.mapInvoice(updated);
  }

  async issueInvoice(
    invoiceId: string,
    dto: IssueInvoiceDto,
    options: InvoiceMutationOptions = {},
  ): Promise<InvoiceResponse> {
    const current = await this.findInvoiceById(invoiceId, {
      includeDeleted: false,
    });

    this.assertInvoiceCanBeIssued(current);

    const issuedAt = this.parseOptionalDate(dto.issuedAt) ?? new Date();

    const dueDate = this.parseOptionalDate(dto.dueDate) ?? current.dueDate;

    const rows = await this.prisma.$queryRaw<InvoiceRow[]>(
      Prisma.sql`
          UPDATE "Invoice"
          SET
            "status" = ${InvoiceStatus.PAID}::"InvoiceStatus",
            "issuedAt" = ${issuedAt},
            "dueDate" = ${dueDate},
            "pdfUrl" = ${dto.pdfUrl ?? current.pdfUrl},
            "updatedAt" = NOW()
          WHERE
            "id" = ${invoiceId}
            AND "deleted_at" IS NULL
          RETURNING
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
            "updatedAt",
            "deleted_at" AS "deletedAt",
            NULL::text AS "orderNumber",
            NULL::text AS "userId",
            NULL::text AS "orderStatus",
            NULL::"PaymentStatus" AS "orderPaymentStatus",
            NULL::"PaymentStatus" AS "paymentStatus",
            NULL::text AS "paymentMethod",
            NULL::text AS "transactionId",
            NULL::timestamp AS "paidAt"
        `,
    );

    const updated = await this.findInvoiceById(this.requireInvoice(rows).id, {
      includeDeleted: false,
    });

    this.events.publishInvoiceIssued({
      invoiceId: updated.id,
      invoiceNumber: updated.invoiceNumber,
      orderId: updated.orderId,
      paymentId: updated.paymentId,
      userId: updated.userId ?? '',
      amount: this.toDecimalString(updated.amount),
      currency: updated.currency,
      previousStatus: current.status,
      currentStatus: updated.status,
      issuedAt: updated.issuedAt,
      pdfUrl: updated.pdfUrl,
      actorId: options.actorId,
      notifyCustomer: dto.notifyCustomer !== false,
      occurredAt: new Date(),
    });

    return this.mapInvoice(updated);
  }

  async cancelInvoice(
    invoiceId: string,
    dto: CancelInvoiceDto,
    options: InvoiceMutationOptions = {},
  ): Promise<InvoiceResponse> {
    const current = await this.findInvoiceById(invoiceId, {
      includeDeleted: false,
    });

    if (current.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('فاکتور قبلاً لغو شده است.');
    }

    const rows = await this.prisma.$queryRaw<InvoiceRow[]>(
      Prisma.sql`
          UPDATE "Invoice"
          SET
            "status" = ${InvoiceStatus.CANCELLED}::"InvoiceStatus",
            "updatedAt" = NOW()
          WHERE
            "id" = ${invoiceId}
            AND "deleted_at" IS NULL
          RETURNING
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
            "updatedAt",
            "deleted_at" AS "deletedAt",
            NULL::text AS "orderNumber",
            NULL::text AS "userId",
            NULL::text AS "orderStatus",
            NULL::"PaymentStatus" AS "orderPaymentStatus",
            NULL::"PaymentStatus" AS "paymentStatus",
            NULL::text AS "paymentMethod",
            NULL::text AS "transactionId",
            NULL::timestamp AS "paidAt"
        `,
    );

    const updated = await this.findInvoiceById(this.requireInvoice(rows).id, {
      includeDeleted: false,
    });

    this.events.publishInvoiceCancelled({
      invoiceId: updated.id,
      invoiceNumber: updated.invoiceNumber,
      orderId: updated.orderId,
      paymentId: updated.paymentId,
      userId: updated.userId ?? '',
      amount: this.toDecimalString(updated.amount),
      currency: updated.currency,
      previousStatus: current.status,
      currentStatus: InvoiceStatus.CANCELLED,
      reason: dto.reason ?? null,
      actorId: options.actorId,
      notifyCustomer: dto.notifyCustomer !== false,
      occurredAt: new Date(),
    });

    return this.mapInvoice(updated);
  }

  async deleteInvoice(
    invoiceId: string,
    options: InvoiceMutationOptions = {},
  ): Promise<{
    success: true;
  }> {
    const current = await this.findInvoiceById(invoiceId, {
      includeDeleted: false,
    });

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

    this.events.publishInvoiceDeleted({
      invoiceId: current.id,
      invoiceNumber: current.invoiceNumber,
      orderId: current.orderId,
      paymentId: current.paymentId,
      userId: current.userId ?? '',
      amount: this.toDecimalString(current.amount),
      currency: current.currency,
      status: current.status,
      actorId: options.actorId,
      occurredAt: new Date(),
    });

    return {
      success: true,
    };
  }

  private async findOrderContext(orderId: string): Promise<OrderContextRow> {
    const rows = await this.prisma.$queryRaw<OrderContextRow[]>(
      Prisma.sql`
          SELECT
            o."id",
            o."orderNumber",
            o."userId",
            o."status",
            o."paymentStatus",
            o."totalAmount",
            o."currency",
            o."deleted_at" AS "deletedAt"
          FROM "Order" o
          WHERE
            o."id" = ${orderId}
            AND o."deleted_at" IS NULL
          LIMIT 1
        `,
    );

    const order = rows[0];

    if (!order) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }

    return order;
  }

  private async findPaymentContext(
    paymentId: string,
  ): Promise<PaymentContextRow> {
    const rows = await this.prisma.$queryRaw<PaymentContextRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."orderId",
            p."userId",
            p."amount",
            p."currency",
            p."paymentStatus",
            p."paymentMethod"::text AS "paymentMethod",
            p."transactionId",
            p."paidAt",
            p."deleted_at" AS "deletedAt"
          FROM "Payment" p
          WHERE
            p."id" = ${paymentId}
            AND p."deleted_at" IS NULL
          LIMIT 1
        `,
    );

    const payment = rows[0];

    if (!payment) {
      throw new NotFoundException('پرداخت پیدا نشد.');
    }

    return payment;
  }

  private async findBestPaymentForOrder(
    orderId: string,
  ): Promise<PaymentContextRow> {
    const rows = await this.prisma.$queryRaw<PaymentContextRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."orderId",
            p."userId",
            p."amount",
            p."currency",
            p."paymentStatus",
            p."paymentMethod"::text AS "paymentMethod",
            p."transactionId",
            p."paidAt",
            p."deleted_at" AS "deletedAt"
          FROM "Payment" p
          WHERE
            p."orderId" = ${orderId}
            AND p."deleted_at" IS NULL
          ORDER BY
            CASE
              WHEN p."paymentStatus" = 'COMPLETED'::"PaymentStatus" THEN 0
              ELSE 1
            END,
            p."createdAt" DESC
          LIMIT 1
        `,
    );

    const payment = rows[0];

    if (!payment) {
      throw new NotFoundException('هیچ پرداختی برای این سفارش پیدا نشد.');
    }

    return payment;
  }

  private async assertInvoiceDoesNotExistForOrder(
    orderId: string,
  ): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Invoice" i
          WHERE
            i."orderId" = ${orderId}
            AND i."deleted_at" IS NULL
        `,
    );

    if ((rows[0]?.count ?? 0) > 0) {
      throw new BadRequestException('برای این سفارش قبلاً فاکتور ثبت شده است.');
    }
  }

  private async assertInvoiceDoesNotExistForPayment(
    paymentId: string,
  ): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Invoice" i
          WHERE
            i."paymentId" = ${paymentId}
            AND i."deleted_at" IS NULL
        `,
    );

    if ((rows[0]?.count ?? 0) > 0) {
      throw new BadRequestException(
        'برای این پرداخت قبلاً فاکتور ثبت شده است.',
      );
    }
  }

  private async findInvoiceById(
    invoiceId: string,
    options: {
      includeDeleted: boolean;
    },
  ): Promise<InvoiceRow> {
    const deletedCondition = options.includeDeleted
      ? Prisma.sql`TRUE`
      : Prisma.sql`i."deleted_at" IS NULL`;

    const rows = await this.prisma.$queryRaw<InvoiceRow[]>(
      Prisma.sql`
          ${this.invoiceSelectSql()}
          WHERE
            i."id" = ${invoiceId}
            AND ${deletedCondition}
          LIMIT 1
        `,
    );

    return this.requireInvoice(rows);
  }

  private async findInvoiceByNumber(
    invoiceNumber: string,
    options: {
      includeDeleted: boolean;
    },
  ): Promise<InvoiceRow> {
    const deletedCondition = options.includeDeleted
      ? Prisma.sql`TRUE`
      : Prisma.sql`i."deleted_at" IS NULL`;

    const rows = await this.prisma.$queryRaw<InvoiceRow[]>(
      Prisma.sql`
          ${this.invoiceSelectSql()}
          WHERE
            i."invoiceNumber" = ${invoiceNumber}
            AND ${deletedCondition}
          LIMIT 1
        `,
    );

    return this.requireInvoice(rows);
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
        i."status",
        i."pdfUrl",
        i."createdAt",
        i."updatedAt",
        i."deleted_at" AS "deletedAt",
        o."orderNumber" AS "orderNumber",
        o."userId" AS "userId",
        o."status"::text AS "orderStatus",
        o."paymentStatus" AS "orderPaymentStatus",
        p."paymentStatus" AS "paymentStatus",
        p."paymentMethod"::text AS "paymentMethod",
        p."transactionId" AS "transactionId",
        p."paidAt" AS "paidAt"
      FROM "Invoice" i
      LEFT JOIN "Order" o
        ON o."id" = i."orderId"
      LEFT JOIN "Payment" p
        ON p."id" = i."paymentId"
    `;
  }

  private buildAdminWhere(query: QueryInvoiceDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (query.includeDeleted) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(Prisma.sql`i."deleted_at" IS NULL`);
    }

    this.pushSharedFilters(where, query);

    if (query.userId) {
      where.push(Prisma.sql`o."userId" = ${query.userId}`);
    }

    return where;
  }

  private buildUserWhere(userId: string, query: QueryInvoiceDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [
      Prisma.sql`i."deleted_at" IS NULL`,
      Prisma.sql`o."deleted_at" IS NULL`,
      Prisma.sql`o."userId" = ${userId}`,
    ];

    this.pushSharedFilters(where, query);

    return where;
  }

  private pushSharedFilters(where: Prisma.Sql[], query: QueryInvoiceDto): void {
    if (query.orderId) {
      where.push(Prisma.sql`i."orderId" = ${query.orderId}`);
    }

    if (query.paymentId) {
      where.push(Prisma.sql`i."paymentId" = ${query.paymentId}`);
    }

    if (query.invoiceNumber) {
      where.push(
        Prisma.sql`i."invoiceNumber" ILIKE ${`%${query.invoiceNumber}%`}`,
      );
    }

    if (query.status) {
      where.push(Prisma.sql`i."status" = ${query.status}::"InvoiceStatus"`);
    }

    if (query.currency) {
      where.push(Prisma.sql`i."currency" = ${query.currency}`);
    }

    if (query.issuedFrom) {
      where.push(Prisma.sql`i."issuedAt" >= ${new Date(query.issuedFrom)}`);
    }

    if (query.issuedTo) {
      where.push(Prisma.sql`i."issuedAt" <= ${new Date(query.issuedTo)}`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`i."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`i."createdAt" <= ${new Date(query.createdTo)}`);
    }
  }

  private resolveInitialStatus(paymentStatus: PaymentStatus): InvoiceStatus {
    if (paymentStatus === PaymentStatus.COMPLETED) {
      return InvoiceStatus.PAID;
    }

    if (paymentStatus === PaymentStatus.FAILED) {
      return InvoiceStatus.CANCELLED;
    }

    return InvoiceStatus.PENDING;
  }

  private assertInvoiceCanBeUpdated(invoice: InvoiceRow): void {
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('فاکتور لغوشده قابل ویرایش نیست.');
    }
  }

  private assertInvoiceCanBeIssued(invoice: InvoiceRow): void {
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('فاکتور لغوشده قابل صدور نیست.');
    }
  }

  private async generateUniqueInvoiceNumber(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const date = new Date();

      const year = date.getFullYear();

      const month = String(date.getMonth() + 1).padStart(2, '0');

      const day = String(date.getDate()).padStart(2, '0');

      const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();

      const invoiceNumber = `INV-${year}${month}${day}-${suffix}`;

      const rows = await this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Invoice" i
            WHERE
              i."invoiceNumber" = ${invoiceNumber}
          `,
      );

      if ((rows[0]?.count ?? 0) === 0) {
        return invoiceNumber;
      }
    }

    throw new BadRequestException('امکان تولید شماره فاکتور یکتا وجود ندارد.');
  }

  private parseOptionalDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('تاریخ واردشده معتبر نیست.');
    }

    return date;
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

  private toDecimalString(
    value: Prisma.Decimal | number | string | null,
  ): string {
    if (value === null) {
      return '0.00';
    }

    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    return new Prisma.Decimal(value).toFixed(2);
  }

  private requireInvoice(rows: InvoiceRow[]): InvoiceRow {
    const invoice = rows[0];

    if (!invoice) {
      throw new NotFoundException('فاکتور پیدا نشد.');
    }

    return invoice;
  }

  private toPersianDateTimeString(value: Date | null): string | null {
    return formatPersianDateTime(value);
  }

  private mapCustomerInvoice(row: InvoiceRow): CustomerInvoiceResponse {
    return {
      id: row.id,
      orderId: row.orderId,
      paymentId: row.paymentId,
      invoiceNumber: row.invoiceNumber,
      issuedAt: row.issuedAt,
      issuedAtFa: this.toPersianDateTimeString(row.issuedAt),
      dueDate: row.dueDate,
      dueDateFa: this.toPersianDateTimeString(row.dueDate),
      amount: this.toDecimalString(row.amount),
      currency: row.currency,
      status: row.status,
      createdAt: row.createdAt,
      createdAtFa: this.toPersianDateTimeString(row.createdAt),
      updatedAt: row.updatedAt,
      updatedAtFa: this.toPersianDateTimeString(row.updatedAt),
      order: {
        id: row.orderId,
        orderNumber: row.orderNumber,
        status: row.orderStatus,
        paymentStatus: row.orderPaymentStatus,
      },
      payment: {
        id: row.paymentId,
        status: row.paymentStatus,
        method: row.paymentMethod,
        paidAt: row.paidAt,
        paidAtFa: this.toPersianDateTimeString(row.paidAt),
      },
    };
  }

  private mapInvoice(row: InvoiceRow): InvoiceResponse {
    return {
      id: row.id,
      orderId: row.orderId,
      paymentId: row.paymentId,
      invoiceNumber: row.invoiceNumber,
      issuedAt: row.issuedAt,
      issuedAtFa: this.toPersianDateTimeString(row.issuedAt),
      dueDate: row.dueDate,
      dueDateFa: this.toPersianDateTimeString(row.dueDate),
      amount: this.toDecimalString(row.amount),
      currency: row.currency,
      status: row.status,
      pdfUrl: row.pdfUrl,
      createdAt: row.createdAt,
      createdAtFa: this.toPersianDateTimeString(row.createdAt),
      updatedAt: row.updatedAt,
      updatedAtFa: this.toPersianDateTimeString(row.updatedAt),
      deletedAt: row.deletedAt,
      deletedAtFa: this.toPersianDateTimeString(row.deletedAt),
      order: {
        id: row.orderId,
        orderNumber: row.orderNumber,
        userId: row.userId,
        status: row.orderStatus,
        paymentStatus: row.orderPaymentStatus,
      },
      payment: {
        id: row.paymentId,
        status: row.paymentStatus,
        method: row.paymentMethod,
        transactionId: row.transactionId,
        paidAt: row.paidAt,
        paidAtFa: this.toPersianDateTimeString(row.paidAt),
      },
    };
  }
}
