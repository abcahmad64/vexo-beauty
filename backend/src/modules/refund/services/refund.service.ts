import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { CreateRefundDto } from '../dto/create-refund.dto';

import { ProcessRefundDto } from '../dto/process-refund.dto';

import { QueryRefundDto } from '../dto/query-refund.dto';

import { UpdateRefundDto } from '../dto/update-refund.dto';

import { RefundEventPublisher } from '../events/refund.event.publisher';

type PrismaTx = Prisma.TransactionClient;

type CountRow = {
  count: number;
};

type SumRow = {
  total: Prisma.Decimal | null;
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
  refundedAt: Date | null;
  deletedAt: Date | null;
  orderNumber: string | null;
  orderStatus: OrderStatus | null;
  orderPaymentStatus: PaymentStatus | null;
};

type RefundRow = {
  id: string;
  paymentId: string;
  amount: Prisma.Decimal;
  reason: string | null;
  status: RefundStatus;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  orderId: string | null;
  userId: string | null;
  paymentAmount: Prisma.Decimal | null;
  currency: string | null;
  paymentStatus: PaymentStatus | null;
  paymentMethod: string | null;
  transactionId: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  orderNumber: string | null;
  orderStatus: OrderStatus | null;
  orderPaymentStatus: PaymentStatus | null;
};

type RefundResponse = {
  id: string;
  paymentId: string;
  amount: string;
  reason: string | null;
  status: RefundStatus;
  processedAt: Date | null;
  processedAtFa: string | null;
  createdAt: Date;
  createdAtFa: string | null;
  updatedAt: Date;
  updatedAtFa: string | null;
  deletedAt: Date | null;
  deletedAtFa: string | null;
  payment: {
    id: string;
    amount: string | null;
    currency: string | null;
    status: PaymentStatus | null;
    method: string | null;
    transactionId: string | null;
    paidAt: Date | null;
    paidAtFa: string | null;
    refundedAt: Date | null;
    refundedAtFa: string | null;
  };
  order: {
    id: string | null;
    orderNumber: string | null;
    userId: string | null;
    status: OrderStatus | null;
    paymentStatus: PaymentStatus | null;
  };
};

type RefundListResponse = {
  data: RefundResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

/** Customer-facing refund contract; excludes ownership and transaction internals. */
export type CustomerRefundResponse = {
  id: string;
  paymentId: string;
  amount: string;
  reason: string | null;
  status: RefundStatus;
  processedAt: Date | null;
  processedAtFa: string | null;
  createdAt: Date;
  createdAtFa: string | null;
  updatedAt: Date;
  updatedAtFa: string | null;
  payment: {
    id: string;
    amount: string | null;
    currency: string | null;
    status: PaymentStatus | null;
    method: string | null;
    paidAt: Date | null;
    paidAtFa: string | null;
    refundedAt: Date | null;
    refundedAtFa: string | null;
  };
  order: {
    id: string | null;
    orderNumber: string | null;
    status: OrderStatus | null;
    paymentStatus: PaymentStatus | null;
  };
};

type CustomerRefundListResponse = {
  data: CustomerRefundResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type RefundMutationOptions = {
  actorId?: string;
};

@Injectable()
export class RefundService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: RefundEventPublisher,
  ) {}

  async createRefund(
    dto: CreateRefundDto,
    options: RefundMutationOptions = {},
  ): Promise<RefundResponse> {
    const payment = await this.findPaymentContext(dto.paymentId);

    this.assertPaymentCanBeRefunded(payment);

    const alreadyRefunded = await this.getCompletedOrProcessingRefundAmount(
      payment.id,
    );

    const remaining = payment.amount.minus(alreadyRefunded);

    if (remaining.lessThan(0) || remaining.equals(0)) {
      throw new BadRequestException(
        'مبلغ قابل بازگشت برای این پرداخت باقی نمانده است.',
      );
    }

    const amount = dto.amount ? new Prisma.Decimal(dto.amount) : remaining;

    if (amount.lessThan(0) || amount.equals(0)) {
      throw new BadRequestException('مبلغ بازگشت وجه باید بیشتر از صفر باشد.');
    }

    if (amount.greaterThan(remaining)) {
      throw new BadRequestException(
        'مبلغ بازگشت وجه از مانده قابل بازگشت پرداخت بیشتر است.',
      );
    }

    const status = dto.status ?? RefundStatus.PENDING;

    const processedAt =
      status === RefundStatus.COMPLETED || status === RefundStatus.FAILED
        ? new Date()
        : null;

    const refundId = randomUUID();

    const created = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<RefundRow[]>(
        Prisma.sql`
                INSERT INTO "Refund" (
                  "id",
                  "paymentId",
                  "amount",
                  "reason",
                  "status",
                  "processedAt",
                  "createdAt",
                  "updatedAt"
                )
                VALUES (
                  ${refundId},
                  ${payment.id},
                  ${amount},
                  ${dto.reason ?? null},
                  ${status}::"RefundStatus",
                  ${processedAt},
                  NOW(),
                  NOW()
                )
                RETURNING
                  "id",
                  "paymentId",
                  "amount",
                  "reason",
                  "status",
                  "processedAt",
                  "createdAt",
                  "updatedAt",
                  "deleted_at" AS "deletedAt",
                  NULL::text AS "orderId",
                  NULL::text AS "userId",
                  NULL::numeric AS "paymentAmount",
                  NULL::text AS "currency",
                  NULL::"PaymentStatus" AS "paymentStatus",
                  NULL::text AS "paymentMethod",
                  NULL::text AS "transactionId",
                  NULL::timestamp AS "paidAt",
                  NULL::timestamp AS "refundedAt",
                  NULL::text AS "orderNumber",
                  NULL::"OrderStatus" AS "orderStatus",
                  NULL::"PaymentStatus" AS "orderPaymentStatus"
              `,
      );

      const refund = this.requireRefund(rows);

      if (status === RefundStatus.COMPLETED) {
        await this.syncPaymentAndOrderRefundState(tx, payment.id);
      }

      return refund;
    });

    const refund = await this.findRefundById(created.id, {
      includeDeleted: false,
    });

    this.events.publishRefundCreated({
      refundId: refund.id,
      paymentId: refund.paymentId,
      orderId: refund.orderId ?? '',
      userId: refund.userId ?? '',
      amount: this.toDecimalString(refund.amount),
      currency: refund.currency ?? '',
      status: refund.status,
      reason: refund.reason,
      orderNumber: refund.orderNumber,
      actorId: options.actorId,
      notifyCustomer: dto.notifyCustomer !== false,
      occurredAt: new Date(),
    });

    if (refund.status === RefundStatus.PROCESSING) {
      this.events.publishRefundProcessing({
        refundId: refund.id,
        paymentId: refund.paymentId,
        orderId: refund.orderId ?? '',
        userId: refund.userId ?? '',
        amount: this.toDecimalString(refund.amount),
        currency: refund.currency ?? '',
        previousStatus: RefundStatus.PENDING,
        currentStatus: RefundStatus.PROCESSING,
        actorId: options.actorId,
        notifyCustomer: dto.notifyCustomer !== false,
        occurredAt: new Date(),
      });
    }

    if (refund.status === RefundStatus.COMPLETED) {
      this.events.publishRefundCompleted({
        refundId: refund.id,
        paymentId: refund.paymentId,
        orderId: refund.orderId ?? '',
        userId: refund.userId ?? '',
        amount: this.toDecimalString(refund.amount),
        currency: refund.currency ?? '',
        previousStatus: RefundStatus.PENDING,
        currentStatus: RefundStatus.COMPLETED,
        processedAt: refund.processedAt ?? new Date(),
        paymentStatus: refund.paymentStatus ?? PaymentStatus.PARTIAL_REFUNDED,
        orderNumber: refund.orderNumber,
        actorId: options.actorId,
        notifyCustomer: dto.notifyCustomer !== false,
        occurredAt: new Date(),
      });
    }

    if (refund.status === RefundStatus.FAILED) {
      this.events.publishRefundFailed({
        refundId: refund.id,
        paymentId: refund.paymentId,
        orderId: refund.orderId ?? '',
        userId: refund.userId ?? '',
        amount: this.toDecimalString(refund.amount),
        currency: refund.currency ?? '',
        previousStatus: RefundStatus.PENDING,
        currentStatus: RefundStatus.FAILED,
        reason: refund.reason,
        actorId: options.actorId,
        notifyCustomer: dto.notifyCustomer !== false,
        occurredAt: new Date(),
      });
    }

    return this.mapRefund(refund);
  }

  async findAllForAdmin(query: QueryRefundDto): Promise<RefundListResponse> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const offset = (page - 1) * limit;

    const where = this.buildAdminWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<RefundRow[]>(
        Prisma.sql`
            ${this.refundSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              r."createdAt" DESC,
              r."id" DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Refund" r
            LEFT JOIN "Payment" p
              ON p."id" = r."paymentId"
            LEFT JOIN "Order" o
              ON o."id" = p."orderId"
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = countRows[0]?.count ?? 0;

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

  async findAllForUser(
    userId: string,
    query: QueryRefundDto,
  ): Promise<CustomerRefundListResponse> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const offset = (page - 1) * limit;

    const where = this.buildUserWhere(userId, query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<RefundRow[]>(
        Prisma.sql`
            ${this.refundSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              r."createdAt" DESC,
              r."id" DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Refund" r
            LEFT JOIN "Payment" p
              ON p."id" = r."paymentId"
            LEFT JOIN "Order" o
              ON o."id" = p."orderId"
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = countRows[0]?.count ?? 0;

    return {
      data: rows.map((row) => this.mapCustomerRefund(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneForAdmin(
    refundId: string,
    includeDeleted = false,
  ): Promise<RefundResponse> {
    const refund = await this.findRefundById(refundId, {
      includeDeleted,
    });

    return this.mapRefund(refund);
  }

  async findOneForUser(
    userId: string,
    refundId: string,
  ): Promise<CustomerRefundResponse> {
    const refund = await this.findRefundById(refundId, {
      includeDeleted: false,
    });

    if (refund.userId !== userId) {
      throw new NotFoundException('درخواست بازگشت وجه پیدا نشد.');
    }

    return this.mapCustomerRefund(refund);
  }

  async updateRefund(
    refundId: string,
    dto: UpdateRefundDto,
    options: RefundMutationOptions = {},
  ): Promise<RefundResponse> {
    const current = await this.findRefundById(refundId, {
      includeDeleted: false,
    });

    this.assertRefundCanBeUpdated(current);

    const nextAmount = dto.amount
      ? new Prisma.Decimal(dto.amount)
      : current.amount;

    if (nextAmount.lessThan(0) || nextAmount.equals(0)) {
      throw new BadRequestException('مبلغ بازگشت وجه باید بیشتر از صفر باشد.');
    }

    await this.assertRefundAmountIsValidForPayment(
      current.paymentId,
      current.id,
      nextAmount,
    );

    const nextStatus = dto.status ?? current.status;

    const nextReason = dto.reason ?? current.reason;

    const nextProcessedAt = this.resolveProcessedAt(
      nextStatus,
      dto.processedAt,
      current.processedAt,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<RefundRow[]>(
        Prisma.sql`
                UPDATE "Refund"
                SET
                  "amount" = ${nextAmount},
                  "reason" = ${nextReason},
                  "status" = ${nextStatus}::"RefundStatus",
                  "processedAt" = ${nextProcessedAt},
                  "updatedAt" = NOW()
                WHERE
                  "id" = ${refundId}
                  AND "deleted_at" IS NULL
                RETURNING
                  "id",
                  "paymentId",
                  "amount",
                  "reason",
                  "status",
                  "processedAt",
                  "createdAt",
                  "updatedAt",
                  "deleted_at" AS "deletedAt",
                  NULL::text AS "orderId",
                  NULL::text AS "userId",
                  NULL::numeric AS "paymentAmount",
                  NULL::text AS "currency",
                  NULL::"PaymentStatus" AS "paymentStatus",
                  NULL::text AS "paymentMethod",
                  NULL::text AS "transactionId",
                  NULL::timestamp AS "paidAt",
                  NULL::timestamp AS "refundedAt",
                  NULL::text AS "orderNumber",
                  NULL::"OrderStatus" AS "orderStatus",
                  NULL::"PaymentStatus" AS "orderPaymentStatus"
              `,
      );

      const refund = this.requireRefund(rows);

      if (refund.status === RefundStatus.COMPLETED) {
        await this.syncPaymentAndOrderRefundState(tx, refund.paymentId);
      }

      return refund;
    });

    const refund = await this.findRefundById(updated.id, {
      includeDeleted: false,
    });

    this.events.publishRefundUpdated({
      refundId: refund.id,
      paymentId: refund.paymentId,
      orderId: refund.orderId ?? '',
      userId: refund.userId ?? '',
      amount: this.toDecimalString(refund.amount),
      currency: refund.currency ?? '',
      previousStatus: current.status,
      currentStatus: refund.status,
      previousAmount: this.toDecimalString(current.amount),
      currentAmount: this.toDecimalString(refund.amount),
      previousReason: current.reason,
      currentReason: refund.reason,
      actorId: options.actorId,
      notifyCustomer: dto.notifyCustomer === true,
      occurredAt: new Date(),
    });

    return this.mapRefund(refund);
  }

  async processRefund(
    refundId: string,
    dto: ProcessRefundDto,
    options: RefundMutationOptions = {},
  ): Promise<RefundResponse> {
    const current = await this.findRefundById(refundId, {
      includeDeleted: false,
    });

    this.assertRefundCanBeProcessed(current, dto.status);

    const nextStatus = dto.status as RefundStatus;

    const nextReason = dto.reason ?? current.reason;

    const processedAt = this.resolveProcessedAt(
      nextStatus,
      dto.processedAt,
      current.processedAt,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<RefundRow[]>(
        Prisma.sql`
                UPDATE "Refund"
                SET
                  "status" = ${nextStatus}::"RefundStatus",
                  "reason" = ${nextReason},
                  "processedAt" = ${processedAt},
                  "updatedAt" = NOW()
                WHERE
                  "id" = ${refundId}
                  AND "deleted_at" IS NULL
                RETURNING
                  "id",
                  "paymentId",
                  "amount",
                  "reason",
                  "status",
                  "processedAt",
                  "createdAt",
                  "updatedAt",
                  "deleted_at" AS "deletedAt",
                  NULL::text AS "orderId",
                  NULL::text AS "userId",
                  NULL::numeric AS "paymentAmount",
                  NULL::text AS "currency",
                  NULL::"PaymentStatus" AS "paymentStatus",
                  NULL::text AS "paymentMethod",
                  NULL::text AS "transactionId",
                  NULL::timestamp AS "paidAt",
                  NULL::timestamp AS "refundedAt",
                  NULL::text AS "orderNumber",
                  NULL::"OrderStatus" AS "orderStatus",
                  NULL::"PaymentStatus" AS "orderPaymentStatus"
              `,
      );

      const refund = this.requireRefund(rows);

      if (refund.status === RefundStatus.COMPLETED) {
        await this.syncPaymentAndOrderRefundState(tx, refund.paymentId);
      }

      return refund;
    });

    const refund = await this.findRefundById(updated.id, {
      includeDeleted: false,
    });

    if (refund.status === RefundStatus.PROCESSING) {
      this.events.publishRefundProcessing({
        refundId: refund.id,
        paymentId: refund.paymentId,
        orderId: refund.orderId ?? '',
        userId: refund.userId ?? '',
        amount: this.toDecimalString(refund.amount),
        currency: refund.currency ?? '',
        previousStatus: current.status,
        currentStatus: RefundStatus.PROCESSING,
        actorId: options.actorId,
        notifyCustomer: dto.notifyCustomer !== false,
        occurredAt: new Date(),
      });
    }

    if (refund.status === RefundStatus.COMPLETED) {
      this.events.publishRefundCompleted({
        refundId: refund.id,
        paymentId: refund.paymentId,
        orderId: refund.orderId ?? '',
        userId: refund.userId ?? '',
        amount: this.toDecimalString(refund.amount),
        currency: refund.currency ?? '',
        previousStatus: current.status,
        currentStatus: RefundStatus.COMPLETED,
        processedAt: refund.processedAt ?? new Date(),
        paymentStatus: refund.paymentStatus ?? PaymentStatus.PARTIAL_REFUNDED,
        orderNumber: refund.orderNumber,
        actorId: options.actorId,
        notifyCustomer: dto.notifyCustomer !== false,
        occurredAt: new Date(),
      });
    }

    if (refund.status === RefundStatus.FAILED) {
      this.events.publishRefundFailed({
        refundId: refund.id,
        paymentId: refund.paymentId,
        orderId: refund.orderId ?? '',
        userId: refund.userId ?? '',
        amount: this.toDecimalString(refund.amount),
        currency: refund.currency ?? '',
        previousStatus: current.status,
        currentStatus: RefundStatus.FAILED,
        reason: refund.reason,
        actorId: options.actorId,
        notifyCustomer: dto.notifyCustomer !== false,
        occurredAt: new Date(),
      });
    }

    return this.mapRefund(refund);
  }

  async completeRefund(
    refundId: string,
    dto: Partial<ProcessRefundDto> = {},
    options: RefundMutationOptions = {},
  ): Promise<RefundResponse> {
    return this.processRefund(
      refundId,
      {
        status: RefundStatus.COMPLETED,
        reason: dto.reason,
        processedAt: dto.processedAt,
        notifyCustomer: dto.notifyCustomer,
      },
      options,
    );
  }

  async failRefund(
    refundId: string,
    dto: Partial<ProcessRefundDto> = {},
    options: RefundMutationOptions = {},
  ): Promise<RefundResponse> {
    return this.processRefund(
      refundId,
      {
        status: RefundStatus.FAILED,
        reason: dto.reason,
        processedAt: dto.processedAt,
        notifyCustomer: dto.notifyCustomer,
      },
      options,
    );
  }

  async deleteRefund(
    refundId: string,
    options: RefundMutationOptions = {},
  ): Promise<{
    success: true;
  }> {
    const current = await this.findRefundById(refundId, {
      includeDeleted: false,
    });

    if (current.status === RefundStatus.COMPLETED) {
      throw new BadRequestException('بازگشت وجه تکمیل‌شده قابل حذف نیست.');
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Refund"
        SET
          "deleted_at" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${refundId}
          AND "deleted_at" IS NULL
      `,
    );

    this.events.publishRefundDeleted({
      refundId: current.id,
      paymentId: current.paymentId,
      orderId: current.orderId ?? '',
      userId: current.userId ?? '',
      amount: this.toDecimalString(current.amount),
      currency: current.currency ?? '',
      status: current.status,
      actorId: options.actorId,
      occurredAt: new Date(),
    });

    return {
      success: true,
    };
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
            p."refundedAt",
            p."deleted_at" AS "deletedAt",
            o."orderNumber" AS "orderNumber",
            o."status" AS "orderStatus",
            o."paymentStatus" AS "orderPaymentStatus"
          FROM "Payment" p
          LEFT JOIN "Order" o
            ON o."id" = p."orderId"
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

  private async getCompletedOrProcessingRefundAmount(
    paymentId: string,
  ): Promise<Prisma.Decimal> {
    const rows = await this.prisma.$queryRaw<SumRow[]>(
      Prisma.sql`
          SELECT
            COALESCE(SUM(r."amount"), 0)::numeric AS "total"
          FROM "Refund" r
          WHERE
            r."paymentId" = ${paymentId}
            AND r."deleted_at" IS NULL
            AND r."status" IN (
              'PROCESSING'::"RefundStatus",
              'COMPLETED'::"RefundStatus"
            )
        `,
    );

    return new Prisma.Decimal(rows[0]?.total ?? 0);
  }

  private async assertRefundAmountIsValidForPayment(
    paymentId: string,
    refundId: string,
    nextAmount: Prisma.Decimal,
  ): Promise<void> {
    const payment = await this.findPaymentContext(paymentId);

    const rows = await this.prisma.$queryRaw<SumRow[]>(
      Prisma.sql`
          SELECT
            COALESCE(SUM(r."amount"), 0)::numeric AS "total"
          FROM "Refund" r
          WHERE
            r."paymentId" = ${paymentId}
            AND r."id" <> ${refundId}
            AND r."deleted_at" IS NULL
            AND r."status" IN (
              'PROCESSING'::"RefundStatus",
              'COMPLETED'::"RefundStatus"
            )
        `,
    );

    const reserved = new Prisma.Decimal(rows[0]?.total ?? 0);

    const total = reserved.plus(nextAmount);

    if (total.greaterThan(payment.amount)) {
      throw new BadRequestException(
        'مجموع مبلغ بازگشت وجه از مبلغ پرداخت بیشتر است.',
      );
    }
  }

  private async findRefundById(
    refundId: string,
    options: {
      includeDeleted: boolean;
    },
  ): Promise<RefundRow> {
    const deletedCondition = options.includeDeleted
      ? Prisma.sql`TRUE`
      : Prisma.sql`r."deleted_at" IS NULL`;

    const rows = await this.prisma.$queryRaw<RefundRow[]>(
      Prisma.sql`
          ${this.refundSelectSql()}
          WHERE
            r."id" = ${refundId}
            AND ${deletedCondition}
          LIMIT 1
        `,
    );

    return this.requireRefund(rows);
  }

  private refundSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        r."id",
        r."paymentId",
        r."amount",
        r."reason",
        r."status",
        r."processedAt",
        r."createdAt",
        r."updatedAt",
        r."deleted_at" AS "deletedAt",
        p."orderId" AS "orderId",
        p."userId" AS "userId",
        p."amount" AS "paymentAmount",
        p."currency" AS "currency",
        p."paymentStatus" AS "paymentStatus",
        p."paymentMethod"::text AS "paymentMethod",
        p."transactionId" AS "transactionId",
        p."paidAt" AS "paidAt",
        p."refundedAt" AS "refundedAt",
        o."orderNumber" AS "orderNumber",
        o."status" AS "orderStatus",
        o."paymentStatus" AS "orderPaymentStatus"
      FROM "Refund" r
      LEFT JOIN "Payment" p
        ON p."id" = r."paymentId"
      LEFT JOIN "Order" o
        ON o."id" = p."orderId"
    `;
  }

  private buildAdminWhere(query: QueryRefundDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [
      query.includeDeleted
        ? Prisma.sql`TRUE`
        : Prisma.sql`r."deleted_at" IS NULL`,
    ];

    this.pushSharedFilters(where, query);

    if (query.userId) {
      where.push(Prisma.sql`p."userId" = ${query.userId}`);
    }

    return where;
  }

  private buildUserWhere(userId: string, query: QueryRefundDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [
      Prisma.sql`r."deleted_at" IS NULL`,
      Prisma.sql`p."deleted_at" IS NULL`,
      Prisma.sql`p."userId" = ${userId}`,
    ];

    this.pushSharedFilters(where, query);

    return where;
  }

  private pushSharedFilters(where: Prisma.Sql[], query: QueryRefundDto): void {
    if (query.paymentId) {
      where.push(Prisma.sql`r."paymentId" = ${query.paymentId}`);
    }

    if (query.orderId) {
      where.push(Prisma.sql`p."orderId" = ${query.orderId}`);
    }

    if (query.orderNumber) {
      where.push(Prisma.sql`o."orderNumber" ILIKE ${`%${query.orderNumber}%`}`);
    }

    if (query.status) {
      where.push(Prisma.sql`r."status" = ${query.status}::"RefundStatus"`);
    }

    if (query.currency) {
      where.push(Prisma.sql`p."currency" = ${query.currency}`);
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
  }

  private async syncPaymentAndOrderRefundState(
    tx: PrismaTx,
    paymentId: string,
  ): Promise<void> {
    const paymentRows = await tx.$queryRaw<PaymentContextRow[]>(
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
            p."refundedAt",
            p."deleted_at" AS "deletedAt",
            o."orderNumber" AS "orderNumber",
            o."status" AS "orderStatus",
            o."paymentStatus" AS "orderPaymentStatus"
          FROM "Payment" p
          LEFT JOIN "Order" o
            ON o."id" = p."orderId"
          WHERE
            p."id" = ${paymentId}
            AND p."deleted_at" IS NULL
          LIMIT 1
          FOR UPDATE OF p
        `,
    );

    const payment = paymentRows[0];

    if (!payment) {
      throw new NotFoundException('پرداخت پیدا نشد.');
    }

    const refundRows = await tx.$queryRaw<SumRow[]>(
      Prisma.sql`
          SELECT
            COALESCE(SUM(r."amount"), 0)::numeric AS "total"
          FROM "Refund" r
          WHERE
            r."paymentId" = ${paymentId}
            AND r."deleted_at" IS NULL
            AND r."status" = 'COMPLETED'::"RefundStatus"
        `,
    );

    const completedRefundAmount = new Prisma.Decimal(refundRows[0]?.total ?? 0);

    const nextPaymentStatus = completedRefundAmount.greaterThanOrEqualTo(
      payment.amount,
    )
      ? PaymentStatus.REFUNDED
      : PaymentStatus.PARTIAL_REFUNDED;

    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "Payment"
        SET
          "paymentStatus" = ${nextPaymentStatus}::"PaymentStatus",
          "refundedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${payment.id}
          AND "deleted_at" IS NULL
      `,
    );

    const nextOrderStatus =
      nextPaymentStatus === PaymentStatus.REFUNDED
        ? OrderStatus.REFUNDED
        : payment.orderStatus;

    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "Order"
        SET
          "paymentStatus" = ${nextPaymentStatus}::"PaymentStatus",
          "status" = ${nextOrderStatus}::"OrderStatus",
          "updatedAt" = NOW()
        WHERE
          "id" = ${payment.orderId}
          AND "deleted_at" IS NULL
      `,
    );
  }

  private assertPaymentCanBeRefunded(payment: PaymentContextRow): void {
    if (payment.paymentStatus === PaymentStatus.REFUNDED) {
      throw new BadRequestException(
        'این پرداخت قبلاً به‌صورت کامل بازگشت داده شده است.',
      );
    }

    if (
      payment.paymentStatus !== PaymentStatus.COMPLETED &&
      payment.paymentStatus !== PaymentStatus.PARTIAL_REFUNDED
    ) {
      throw new BadRequestException(
        'فقط پرداخت‌های موفق قابل بازگشت وجه هستند.',
      );
    }
  }

  private assertRefundCanBeUpdated(refund: RefundRow): void {
    if (refund.status === RefundStatus.COMPLETED) {
      throw new BadRequestException('بازگشت وجه تکمیل‌شده قابل ویرایش نیست.');
    }
  }

  private assertRefundCanBeProcessed(
    refund: RefundRow,
    nextStatus: RefundStatus,
  ): void {
    if (refund.status === nextStatus) {
      return;
    }

    if (refund.status === RefundStatus.COMPLETED) {
      throw new BadRequestException(
        'بازگشت وجه تکمیل‌شده قابل تغییر وضعیت نیست.',
      );
    }

    if (refund.status === RefundStatus.FAILED) {
      throw new BadRequestException('بازگشت وجه ناموفق قابل تغییر وضعیت نیست.');
    }

    if (refund.status === RefundStatus.PENDING) {
      const allowed: RefundStatus[] = [
        RefundStatus.PROCESSING,
        RefundStatus.COMPLETED,
        RefundStatus.FAILED,
      ];

      if (allowed.includes(nextStatus)) {
        return;
      }
    }

    if (refund.status === RefundStatus.PROCESSING) {
      const allowed: RefundStatus[] = [
        RefundStatus.COMPLETED,
        RefundStatus.FAILED,
      ];

      if (allowed.includes(nextStatus)) {
        return;
      }
    }

    throw new BadRequestException(
      `تغییر وضعیت بازگشت وجه از ${refund.status} به ${nextStatus} مجاز نیست.`,
    );
  }

  private resolveProcessedAt(
    status: RefundStatus,
    value?: string,
    current?: Date | null,
  ): Date | null {
    if (value) {
      return this.parseDate(value);
    }

    if (status === RefundStatus.COMPLETED || status === RefundStatus.FAILED) {
      return current ?? new Date();
    }

    return current ?? null;
  }

  private parseDate(value: string): Date {
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

  private toPersianDateTimeString(value: Date | null): string | null {
    return formatPersianDateTime(value);
  }

  private requireRefund(rows: RefundRow[]): RefundRow {
    const refund = rows[0];

    if (!refund) {
      throw new NotFoundException('درخواست بازگشت وجه پیدا نشد.');
    }

    return refund;
  }

  private mapCustomerRefund(row: RefundRow): CustomerRefundResponse {
    return {
      id: row.id,
      paymentId: row.paymentId,
      amount: this.toDecimalString(row.amount),
      reason: row.reason,
      status: row.status,
      processedAt: row.processedAt,
      processedAtFa: this.toPersianDateTimeString(row.processedAt),
      createdAt: row.createdAt,
      createdAtFa: this.toPersianDateTimeString(row.createdAt),
      updatedAt: row.updatedAt,
      updatedAtFa: this.toPersianDateTimeString(row.updatedAt),
      payment: {
        id: row.paymentId,
        amount: row.paymentAmount
          ? this.toDecimalString(row.paymentAmount)
          : null,
        currency: row.currency,
        status: row.paymentStatus,
        method: row.paymentMethod,
        paidAt: row.paidAt,
        paidAtFa: this.toPersianDateTimeString(row.paidAt),
        refundedAt: row.refundedAt,
        refundedAtFa: this.toPersianDateTimeString(row.refundedAt),
      },
      order: {
        id: row.orderId,
        orderNumber: row.orderNumber,
        status: row.orderStatus,
        paymentStatus: row.orderPaymentStatus,
      },
    };
  }

  private mapRefund(row: RefundRow): RefundResponse {
    return {
      id: row.id,
      paymentId: row.paymentId,
      amount: this.toDecimalString(row.amount),
      reason: row.reason,
      status: row.status,
      processedAt: row.processedAt,
      processedAtFa: this.toPersianDateTimeString(row.processedAt),
      createdAt: row.createdAt,
      createdAtFa: this.toPersianDateTimeString(row.createdAt),
      updatedAt: row.updatedAt,
      updatedAtFa: this.toPersianDateTimeString(row.updatedAt),
      deletedAt: row.deletedAt,
      deletedAtFa: this.toPersianDateTimeString(row.deletedAt),
      payment: {
        id: row.paymentId,
        amount: row.paymentAmount
          ? this.toDecimalString(row.paymentAmount)
          : null,
        currency: row.currency,
        status: row.paymentStatus,
        method: row.paymentMethod,
        transactionId: row.transactionId,
        paidAt: row.paidAt,
        paidAtFa: this.toPersianDateTimeString(row.paidAt),
        refundedAt: row.refundedAt,
        refundedAtFa: this.toPersianDateTimeString(row.refundedAt),
      },
      order: {
        id: row.orderId,
        orderNumber: row.orderNumber,
        userId: row.userId,
        status: row.orderStatus,
        paymentStatus: row.orderPaymentStatus,
      },
    };
  }
}
