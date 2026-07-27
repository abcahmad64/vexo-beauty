import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { CreatePaymentDto } from '../dto/create-payment.dto';

import { FailPaymentDto } from '../dto/fail-payment.dto';

import { MarkPaymentRefundedDto } from '../dto/mark-payment-refunded.dto';

import { QueryPaymentDto } from '../dto/query-payment.dto';

import { UpdatePaymentDto } from '../dto/update-payment.dto';

import { VerifyPaymentDto } from '../dto/verify-payment.dto';

import { PaymentEventPublisher } from '../events/payment.event.publisher';

type PrismaTx = Prisma.TransactionClient;

type CountRow = {
  count: number | bigint;
};

type OrderPaymentContextRow = {
  id: string;
  user_id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: unknown;
  currency: string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  deleted_at: Date | null;
};

type PaymentRow = {
  id: string;
  order_id: string;
  user_id: string;
  amount: unknown;
  currency: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  transaction_id: string | null;
  gateway: string | null;
  receipt_url: string | null;
  metadata: unknown;
  paid_at: Date | null;
  refunded_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  order_number?: string | null;
  order_total_amount?: unknown;
  order_status?: OrderStatus | null;
};

type PaymentAggregateRow = {
  completed_amount: unknown;
  refunded_amount: unknown;
  failed_count: number | bigint;
  pending_count?: number | bigint;
};

export type GatewayRequestState =
  'REQUESTING' | 'READY' | 'UNKNOWN' | 'FAILED' | 'COMPLETED' | 'CANCELLED';

type GatewayPaymentReservationRow = {
  id: string;
  order_id: string;
  user_id: string;
  amount: unknown;
  currency: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  transaction_id: string | null;
  gateway: string | null;
  metadata: unknown;
  gateway_authority: string | null;
  gateway_request_key: string | null;
  gateway_request_state: GatewayRequestState | null;
  gateway_requested_at: Date | null;
  gateway_request_completed_at: Date | null;
  order_number: string;
  email: string | null;
  phone: string | null;
};

export type GatewayPaymentReservation = {
  paymentId: string;
  orderId: string;
  userId: string;
  orderNumber: string;
  amount: string;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionId: string | null;
  gateway: string | null;
  authority: string | null;
  requestKey: string | null;
  requestState: GatewayRequestState | null;
  requestedAt: Date | null;
  requestCompletedAt: Date | null;
  email: string | null;
  phone: string | null;
  created: boolean;
};

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: PaymentEventPublisher,
  ) {}

  async createForUser(userId: string, dto: CreatePaymentDto, actorId?: string) {
    const payment = await this.createPayment(dto, {
      userId,
      enforceOrderOwner: true,
      actorId: actorId ?? userId,
    });

    return this.findOneForUser(userId, payment.id);
  }

  async createForAdmin(dto: CreatePaymentDto, actorId?: string) {
    const payment = await this.createPayment(dto, {
      enforceOrderOwner: false,
      actorId,
    });

    return this.findOneForAdmin(payment.id);
  }

  async reserveZarinpalPaymentForUser(
    userId: string,
    orderId: string,
    actorId?: string,
  ): Promise<GatewayPaymentReservation> {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await this.findOrderContextForUpdateTx(tx, orderId);

      if (order.user_id !== userId) {
        throw new NotFoundException('سفارش پیدا نشد.');
      }

      if (order.deleted_at !== null) {
        throw new BadRequestException('سفارش حذف شده است.');
      }

      const forbiddenOrderStatuses: OrderStatus[] = [
        OrderStatus.CANCELLED,
        OrderStatus.REFUNDED,
      ];

      if (forbiddenOrderStatuses.includes(order.status)) {
        throw new BadRequestException(
          'برای سفارش لغوشده یا مرجوع‌شده امکان ایجاد پرداخت وجود ندارد.',
        );
      }

      const existing = await this.findPendingZarinpalPaymentTx(
        tx,
        userId,
        order.id,
      );

      if (existing) {
        return {
          payment: existing,
          created: false,
        };
      }

      const remainingAmount = await this.calculateRemainingOrderAmountTx(
        tx,
        order.id,
        order.total_amount,
      );

      if (remainingAmount.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          'مبلغ قابل پرداختی برای این سفارش باقی نمانده است.',
        );
      }

      const paymentId = randomUUID();

      const requestKey = randomUUID();

      await tx.$executeRaw(
        Prisma.sql`
              INSERT INTO "Payment" (
                "id",
                "orderId",
                "userId",
                "amount",
                "currency",
                "paymentMethod",
                "paymentStatus",
                "gateway",
                "metadata",
                "gatewayRequestKey",
                "gatewayRequestState",
                "gatewayRequestedAt",
                "createdAt",
                "updatedAt"
              )
              VALUES (
                ${paymentId},
                ${order.id},
                ${order.user_id},
                ${remainingAmount},
                ${order.currency},
                ${PaymentMethod.ZARINPAL}::"PaymentMethod",
                ${PaymentStatus.PENDING}::"PaymentStatus",
                'zarinpal',
                ${this.jsonb({
                  initiatedBy: 'payment-gateway',
                })},
                ${requestKey},
                'REQUESTING',
                NOW(),
                NOW(),
                NOW()
              )
            `,
      );

      await tx.$executeRaw(
        Prisma.sql`
              UPDATE "Order"
              SET
                "paymentMethod" = ${PaymentMethod.ZARINPAL}::"PaymentMethod",
                "paymentStatus" = ${PaymentStatus.PENDING}::"PaymentStatus",
                "updatedAt" = NOW()
              WHERE "id" = ${order.id}
                AND "deleted_at" IS NULL
            `,
      );

      const payment = await this.findGatewayPaymentReservationRowTx(
        tx,
        paymentId,
      );

      return {
        payment,
        created: true,
      };
    });

    if (result.created) {
      this.eventPublisher.publishCreated({
        paymentId: result.payment.id,
        orderId: result.payment.order_id,
        userId: result.payment.user_id,
        amount: this.toDecimalString(result.payment.amount),
        currency: result.payment.currency,
        paymentMethod: result.payment.payment_method,
        paymentStatus: result.payment.payment_status,
        actorId: actorId ?? userId,
        occurredAt: new Date(),
      });
    }

    return this.mapGatewayPaymentReservation(result.payment, result.created);
  }

  async markZarinpalRequestReady(
    paymentId: string,
    requestKey: string,
    authority: string,
    rawResponse: Record<string, unknown>,
  ): Promise<GatewayPaymentReservation> {
    const payment = await this.prisma.$transaction(async (tx) => {
      const current = await this.findGatewayPaymentReservationRowForUpdateTx(
        tx,
        paymentId,
      );

      this.assertGatewayRequestClaim(current, requestKey);

      if (
        current.gateway_request_state === 'READY' &&
        current.gateway_authority === authority
      ) {
        return current;
      }

      if (
        current.payment_status !== PaymentStatus.PENDING ||
        current.gateway_request_state !== 'REQUESTING'
      ) {
        throw new ConflictException(
          'وضعیت درخواست پرداخت برای ثبت شناسه درگاه معتبر نیست.',
        );
      }

      const metadata = this.mergeGatewayMetadata(current.metadata, {
        authority,
        requestState: 'READY',
        requestedAt:
          current.gateway_requested_at?.toISOString() ??
          new Date().toISOString(),
        completedAt: new Date().toISOString(),
        response: rawResponse,
      });

      await tx.$executeRaw(
        Prisma.sql`
              UPDATE "Payment"
              SET
                "gateway" = 'zarinpal',
                "gatewayAuthority" = ${authority},
                "transactionId" = ${authority},
                "gatewayRequestState" = 'READY',
                "gatewayRequestCompletedAt" = NOW(),
                "metadata" = ${this.jsonb(metadata)},
                "updatedAt" = NOW()
              WHERE "id" = ${paymentId}
                AND "gatewayRequestKey" = ${requestKey}
                AND "paymentStatus" = ${PaymentStatus.PENDING}::"PaymentStatus"
                AND "deleted_at" IS NULL
            `,
      );

      return this.findGatewayPaymentReservationRowForUpdateTx(tx, paymentId);
    });

    return this.mapGatewayPaymentReservation(payment, false);
  }

  async markZarinpalRequestUnknown(
    paymentId: string,
    requestKey: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.findGatewayPaymentReservationRowForUpdateTx(
        tx,
        paymentId,
      );

      this.assertGatewayRequestClaim(current, requestKey);

      if (
        current.gateway_request_state === 'UNKNOWN' ||
        current.gateway_request_state === 'READY'
      ) {
        return;
      }

      if (
        current.payment_status !== PaymentStatus.PENDING ||
        current.gateway_request_state !== 'REQUESTING'
      ) {
        return;
      }

      const metadata = this.mergeGatewayMetadata(current.metadata, {
        requestState: 'UNKNOWN',
        unknownReason: reason,
        completedAt: new Date().toISOString(),
      });

      await tx.$executeRaw(
        Prisma.sql`
            UPDATE "Payment"
            SET
              "gatewayRequestState" = 'UNKNOWN',
              "gatewayRequestCompletedAt" = NOW(),
              "metadata" = ${this.jsonb(metadata)},
              "updatedAt" = NOW()
            WHERE "id" = ${paymentId}
              AND "gatewayRequestKey" = ${requestKey}
              AND "paymentStatus" = ${PaymentStatus.PENDING}::"PaymentStatus"
              AND "deleted_at" IS NULL
          `,
      );
    });
  }

  async markZarinpalRequestFailed(
    paymentId: string,
    requestKey: string,
    reason: string,
    actorId?: string,
  ): Promise<void> {
    const paymentContext = await this.findPaymentRow(paymentId);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.findOrderContextForUpdateTx(tx, paymentContext.order_id);

      const current = await this.findGatewayPaymentReservationRowForUpdateTx(
        tx,
        paymentId,
      );

      this.assertGatewayRequestClaim(current, requestKey);

      if (current.payment_status === PaymentStatus.FAILED) {
        return {
          payment: current,
          previousStatus: PaymentStatus.FAILED,
          syncedStatus: await this.syncOrderPaymentStatusTx(
            tx,
            current.order_id,
          ),
        };
      }

      if (
        current.payment_status !== PaymentStatus.PENDING ||
        current.gateway_request_state !== 'REQUESTING'
      ) {
        throw new ConflictException(
          'وضعیت درخواست پرداخت برای ثبت شکست درگاه معتبر نیست.',
        );
      }

      const metadata = this.mergeGatewayMetadata(current.metadata, {
        requestState: 'FAILED',
        failureReason: reason,
        completedAt: new Date().toISOString(),
      });

      await tx.$executeRaw(
        Prisma.sql`
              UPDATE "Payment"
              SET
                "paymentStatus" = ${PaymentStatus.FAILED}::"PaymentStatus",
                "gatewayRequestState" = 'FAILED',
                "gatewayRequestCompletedAt" = NOW(),
                "metadata" = ${this.jsonb(metadata)},
                "updatedAt" = NOW()
              WHERE "id" = ${paymentId}
                AND "gatewayRequestKey" = ${requestKey}
                AND "paymentStatus" = ${PaymentStatus.PENDING}::"PaymentStatus"
                AND "deleted_at" IS NULL
            `,
      );

      const updated = await this.findGatewayPaymentReservationRowForUpdateTx(
        tx,
        paymentId,
      );

      const syncedStatus = await this.syncOrderPaymentStatusTx(
        tx,
        updated.order_id,
      );

      return {
        payment: updated,
        previousStatus: current.payment_status,
        syncedStatus,
      };
    });

    if (result.previousStatus !== PaymentStatus.FAILED) {
      this.eventPublisher.publishStatusChanged({
        paymentId: result.payment.id,
        orderId: result.payment.order_id,
        userId: result.payment.user_id,
        previousStatus: result.previousStatus,
        currentStatus: PaymentStatus.FAILED,
        actorId,
        occurredAt: new Date(),
      });

      this.eventPublisher.publishFailed({
        paymentId: result.payment.id,
        orderId: result.payment.order_id,
        userId: result.payment.user_id,
        reason,
        transactionId: result.payment.transaction_id,
        gateway: result.payment.gateway,
        actorId,
        occurredAt: new Date(),
      });
    }

    this.eventPublisher.publishOrderPaymentSynced({
      orderId: result.payment.order_id,
      userId: result.payment.user_id,
      paymentStatus: result.syncedStatus,
      actorId,
      occurredAt: new Date(),
    });
  }

  async findAllForAdmin(query: QueryPaymentDto) {
    return this.findAllPayments(query, (row) => this.mapPaymentRow(row));
  }

  async findAllForUser(userId: string, query: QueryPaymentDto) {
    return this.findAllPayments(
      {
        ...query,
        userId,
        includeDeleted: false,
      },
      (row) => this.mapCustomerPaymentRow(row),
    );
  }

  async findOneForAdmin(paymentId: string) {
    const payment = await this.findPaymentRow(paymentId);

    return this.mapPaymentRow(payment);
  }

  async findOneForUser(userId: string, paymentId: string) {
    const payment = await this.findPaymentRow(paymentId);

    if (payment.user_id !== userId) {
      throw new NotFoundException('پرداخت پیدا نشد.');
    }

    return this.mapCustomerPaymentRow(payment);
  }

  async update(paymentId: string, dto: UpdatePaymentDto, actorId?: string) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'هیچ فیلدی برای ویرایش پرداخت ارسال نشده است.',
      );
    }

    const current = await this.findPaymentRow(paymentId);

    this.assertPaymentEditable(current.payment_status);

    if (dto.amount) {
      this.assertPositiveDecimal(dto.amount, 'amount');
    }

    const updates: Prisma.Sql[] = [];

    if (dto.amount !== undefined) {
      updates.push(Prisma.sql`"amount" = ${new Prisma.Decimal(dto.amount)}`);
    }

    if (dto.currency !== undefined) {
      updates.push(Prisma.sql`"currency" = ${dto.currency}`);
    }

    if (dto.paymentMethod !== undefined) {
      updates.push(
        Prisma.sql`"paymentMethod" = ${dto.paymentMethod}::"PaymentMethod"`,
      );
    }

    if (dto.transactionId !== undefined) {
      updates.push(Prisma.sql`"transactionId" = ${dto.transactionId}`);
    }

    if (dto.gateway !== undefined) {
      updates.push(Prisma.sql`"gateway" = ${dto.gateway}`);
    }

    if (dto.receiptUrl !== undefined) {
      updates.push(Prisma.sql`"receiptUrl" = ${dto.receiptUrl}`);
    }

    if (dto.metadata !== undefined) {
      updates.push(Prisma.sql`"metadata" = ${this.jsonb(dto.metadata)}`);
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Payment"
        SET
          ${Prisma.join(updates, ', ')},
          "updatedAt" = NOW()
        WHERE "id" = ${paymentId}
          AND "deleted_at" IS NULL
      `,
    );

    this.eventPublisher.publishUpdated({
      paymentId: current.id,
      orderId: current.order_id,
      userId: current.user_id,
      changedFields: Object.keys(dto),
      actorId,
      occurredAt: new Date(),
    });

    return this.findOneForAdmin(paymentId);
  }

  async complete(paymentId: string, dto: VerifyPaymentDto, actorId?: string) {
    const paymentContext = await this.findPaymentRow(paymentId);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.findOrderContextForUpdateTx(tx, paymentContext.order_id);

      const current = await this.findPaymentRowForUpdate(tx, paymentId);

      if (current.payment_status === PaymentStatus.COMPLETED) {
        return {
          payment: current,
          previousStatus: current.payment_status,
          syncedStatus: await this.syncOrderPaymentStatusTx(
            tx,
            current.order_id,
          ),
        };
      }

      if (
        current.payment_status !== PaymentStatus.PENDING &&
        current.payment_status !== PaymentStatus.FAILED
      ) {
        throw new BadRequestException(
          'فقط پرداخت‌های در انتظار یا ناموفق قابل تکمیل هستند.',
        );
      }

      await tx.$executeRaw(
        Prisma.sql`
              UPDATE "Payment"
              SET
                "paymentStatus" = ${PaymentStatus.COMPLETED}::"PaymentStatus",
                "transactionId" = COALESCE(${dto.transactionId ?? null}, "transactionId"),
                "gateway" = COALESCE(${dto.gateway ?? null}, "gateway"),
                "receiptUrl" = COALESCE(${dto.receiptUrl ?? null}, "receiptUrl"),
                "metadata" = COALESCE(${dto.metadata === undefined ? null : this.jsonb(dto.metadata)}, "metadata"),
                "paidAt" = ${dto.paidAt ? this.parseDate(dto.paidAt) : new Date()},
                "gatewayRequestState" = CASE
                  WHEN LOWER(COALESCE("gateway", '')) = 'zarinpal'
                    THEN 'COMPLETED'
                  ELSE "gatewayRequestState"
                END,
                "gatewayRequestCompletedAt" = CASE
                  WHEN LOWER(COALESCE("gateway", '')) = 'zarinpal'
                    THEN COALESCE("gatewayRequestCompletedAt", NOW())
                  ELSE "gatewayRequestCompletedAt"
                END,
                "updatedAt" = NOW()
              WHERE "id" = ${paymentId}
                AND "deleted_at" IS NULL
            `,
      );

      const updated = await this.findPaymentRowForUpdate(tx, paymentId);

      const syncedStatus = await this.syncOrderPaymentStatusTx(
        tx,
        updated.order_id,
      );

      return {
        payment: updated,
        previousStatus: current.payment_status,
        syncedStatus,
      };
    });

    this.eventPublisher.publishStatusChanged({
      paymentId: result.payment.id,
      orderId: result.payment.order_id,
      userId: result.payment.user_id,
      previousStatus: result.previousStatus,
      currentStatus: PaymentStatus.COMPLETED,
      actorId,
      occurredAt: new Date(),
    });

    this.eventPublisher.publishCompleted({
      paymentId: result.payment.id,
      orderId: result.payment.order_id,
      userId: result.payment.user_id,
      amount: this.toDecimalString(result.payment.amount),
      currency: result.payment.currency,
      transactionId: result.payment.transaction_id,
      gateway: result.payment.gateway,
      actorId,
      occurredAt: new Date(),
    });

    this.eventPublisher.publishOrderPaymentSynced({
      orderId: result.payment.order_id,
      userId: result.payment.user_id,
      paymentStatus: result.syncedStatus,
      actorId,
      occurredAt: new Date(),
    });

    return this.findOneForAdmin(paymentId);
  }

  async fail(paymentId: string, dto: FailPaymentDto, actorId?: string) {
    const paymentContext = await this.findPaymentRow(paymentId);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.findOrderContextForUpdateTx(tx, paymentContext.order_id);

      const current = await this.findPaymentRowForUpdate(tx, paymentId);

      if (current.payment_status !== PaymentStatus.PENDING) {
        throw new BadRequestException(
          'فقط پرداخت‌های در انتظار قابل ناموفق‌سازی هستند.',
        );
      }

      const metadata = this.mergeMetadata(current.metadata, {
        failureReason: dto.reason ?? null,
        failurePayload: dto.metadata ?? null,
      });

      await tx.$executeRaw(
        Prisma.sql`
              UPDATE "Payment"
              SET
                "paymentStatus" = ${PaymentStatus.FAILED}::"PaymentStatus",
                "transactionId" = COALESCE(${dto.transactionId ?? null}, "transactionId"),
                "gateway" = COALESCE(${dto.gateway ?? null}, "gateway"),
                "metadata" = ${this.jsonb(metadata)},
                "gatewayRequestState" = CASE
                  WHEN LOWER(COALESCE(${dto.gateway ?? null}, "gateway", '')) = 'zarinpal'
                    THEN 'FAILED'
                  ELSE "gatewayRequestState"
                END,
                "gatewayRequestCompletedAt" = CASE
                  WHEN LOWER(COALESCE(${dto.gateway ?? null}, "gateway", '')) = 'zarinpal'
                    THEN COALESCE("gatewayRequestCompletedAt", NOW())
                  ELSE "gatewayRequestCompletedAt"
                END,
                "updatedAt" = NOW()
              WHERE "id" = ${paymentId}
                AND "deleted_at" IS NULL
            `,
      );

      const updated = await this.findPaymentRowForUpdate(tx, paymentId);

      const syncedStatus = await this.syncOrderPaymentStatusTx(
        tx,
        updated.order_id,
      );

      return {
        payment: updated,
        previousStatus: current.payment_status,
        syncedStatus,
      };
    });

    this.eventPublisher.publishStatusChanged({
      paymentId: result.payment.id,
      orderId: result.payment.order_id,
      userId: result.payment.user_id,
      previousStatus: result.previousStatus,
      currentStatus: PaymentStatus.FAILED,
      actorId,
      occurredAt: new Date(),
    });

    this.eventPublisher.publishFailed({
      paymentId: result.payment.id,
      orderId: result.payment.order_id,
      userId: result.payment.user_id,
      reason: dto.reason,
      transactionId: result.payment.transaction_id,
      gateway: result.payment.gateway,
      actorId,
      occurredAt: new Date(),
    });

    this.eventPublisher.publishOrderPaymentSynced({
      orderId: result.payment.order_id,
      userId: result.payment.user_id,
      paymentStatus: result.syncedStatus,
      actorId,
      occurredAt: new Date(),
    });

    return this.findOneForAdmin(paymentId);
  }

  async markRefunded(
    paymentId: string,
    dto: MarkPaymentRefundedDto,
    actorId?: string,
  ) {
    const paymentContext = await this.findPaymentRow(paymentId);

    const result = await this.prisma.$transaction(async (tx) => {
      await this.findOrderContextForUpdateTx(tx, paymentContext.order_id);

      const current = await this.findPaymentRowForUpdate(tx, paymentId);

      if (
        current.payment_status !== PaymentStatus.COMPLETED &&
        current.payment_status !== PaymentStatus.PARTIAL_REFUNDED
      ) {
        throw new BadRequestException(
          'فقط پرداخت‌های موفق قابل بازگشت وجه هستند.',
        );
      }

      const currentAmount = this.toDecimal(current.amount);

      const refundedAmount = dto.refundedAmount
        ? new Prisma.Decimal(dto.refundedAmount)
        : currentAmount;

      if (refundedAmount.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          'مبلغ بازگشت وجه باید بیشتر از صفر باشد.',
        );
      }

      if (refundedAmount.greaterThan(currentAmount)) {
        throw new BadRequestException(
          'مبلغ بازگشت وجه نمی‌تواند بیشتر از مبلغ پرداخت باشد.',
        );
      }

      const nextStatus =
        dto.isPartial === true || refundedAmount.lessThan(currentAmount)
          ? PaymentStatus.PARTIAL_REFUNDED
          : PaymentStatus.REFUNDED;

      const metadata = this.mergeMetadata(current.metadata, {
        refundedAmount: refundedAmount.toString(),
        refundMetadata: dto.metadata ?? null,
      });

      await tx.$executeRaw(
        Prisma.sql`
              UPDATE "Payment"
              SET
                "paymentStatus" = ${nextStatus}::"PaymentStatus",
                "metadata" = ${this.jsonb(metadata)},
                "refundedAt" = ${dto.refundedAt ? this.parseDate(dto.refundedAt) : new Date()},
                "updatedAt" = NOW()
              WHERE "id" = ${paymentId}
                AND "deleted_at" IS NULL
            `,
      );

      const updated = await this.findPaymentRowForUpdate(tx, paymentId);

      const syncedStatus = await this.syncOrderPaymentStatusTx(
        tx,
        updated.order_id,
      );

      return {
        payment: updated,
        previousStatus: current.payment_status,
        currentStatus: nextStatus,
        refundedAmount: refundedAmount.toString(),
        syncedStatus,
      };
    });

    this.eventPublisher.publishStatusChanged({
      paymentId: result.payment.id,
      orderId: result.payment.order_id,
      userId: result.payment.user_id,
      previousStatus: result.previousStatus,
      currentStatus: result.currentStatus,
      actorId,
      occurredAt: new Date(),
    });

    this.eventPublisher.publishRefunded({
      paymentId: result.payment.id,
      orderId: result.payment.order_id,
      userId: result.payment.user_id,
      refundedAmount: result.refundedAmount,
      currentPaymentStatus: result.currentStatus,
      actorId,
      occurredAt: new Date(),
    });

    this.eventPublisher.publishOrderPaymentSynced({
      orderId: result.payment.order_id,
      userId: result.payment.user_id,
      paymentStatus: result.syncedStatus,
      actorId,
      occurredAt: new Date(),
    });

    return this.findOneForAdmin(paymentId);
  }

  async remove(paymentId: string, actorId?: string) {
    const payment = await this.findPaymentRow(paymentId);

    if (payment.payment_status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('پرداخت تکمیل‌شده قابل حذف نیست.');
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Payment"
        SET
          "deleted_at" = NOW(),
          "gatewayRequestState" = CASE
            WHEN LOWER(COALESCE("gateway", '')) = 'zarinpal'
              THEN 'CANCELLED'
            ELSE "gatewayRequestState"
          END,
          "gatewayRequestCompletedAt" = CASE
            WHEN LOWER(COALESCE("gateway", '')) = 'zarinpal'
              THEN COALESCE("gatewayRequestCompletedAt", NOW())
            ELSE "gatewayRequestCompletedAt"
          END,
          "updatedAt" = NOW()
        WHERE "id" = ${paymentId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.syncOrderPaymentStatus(payment.order_id, actorId);

    this.eventPublisher.publishDeleted({
      paymentId: payment.id,
      orderId: payment.order_id,
      userId: payment.user_id,
      actorId,
      occurredAt: new Date(),
    });

    return {
      success: true,
      message: 'پرداخت با موفقیت حذف شد.',
    };
  }

  async syncOrderPaymentStatus(orderId: string, actorId?: string) {
    const order = await this.findOrderContext(orderId);

    const status = await this.prisma.$transaction(async (tx) =>
      this.syncOrderPaymentStatusTx(tx, orderId),
    );

    this.eventPublisher.publishOrderPaymentSynced({
      orderId,
      userId: order.user_id,
      paymentStatus: status,
      actorId,
      occurredAt: new Date(),
    });

    return {
      orderId,
      paymentStatus: status,
    };
  }

  private async createPayment(
    dto: CreatePaymentDto,
    options: {
      userId?: string;
      enforceOrderOwner: boolean;
      actorId?: string;
    },
  ): Promise<PaymentRow> {
    this.assertPositiveDecimal(dto.amount, 'amount', true);

    const payment = await this.prisma.$transaction(async (tx) => {
      const order = await this.findOrderContextForUpdateTx(tx, dto.orderId);

      if (options.enforceOrderOwner && order.user_id !== options.userId) {
        throw new NotFoundException('سفارش پیدا نشد.');
      }

      if (order.deleted_at !== null) {
        throw new BadRequestException('سفارش حذف شده است.');
      }

      const forbiddenOrderStatuses: OrderStatus[] = [
        OrderStatus.CANCELLED,
        OrderStatus.REFUNDED,
      ];

      if (forbiddenOrderStatuses.includes(order.status)) {
        throw new BadRequestException(
          'برای سفارش لغوشده یا مرجوع‌شده امکان ایجاد پرداخت وجود ندارد.',
        );
      }

      if (
        dto.paymentMethod === PaymentMethod.ZARINPAL &&
        dto.gateway?.trim().toLowerCase() === 'zarinpal'
      ) {
        const existing = await this.findPendingZarinpalPaymentTx(
          tx,
          order.user_id,
          order.id,
        );

        if (existing) {
          throw new ConflictException(
            'برای این سفارش یک پرداخت زرین‌پال در انتظار وجود دارد.',
          );
        }
      }

      const remainingAmount = await this.calculateRemainingOrderAmountTx(
        tx,
        order.id,
        order.total_amount,
      );

      const amount = dto.amount
        ? new Prisma.Decimal(dto.amount)
        : remainingAmount;

      if (amount.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          'مبلغ قابل پرداختی برای این سفارش باقی نمانده است.',
        );
      }

      if (amount.greaterThan(remainingAmount)) {
        throw new BadRequestException(
          'مبلغ پرداخت نمی‌تواند بیشتر از مانده قابل پرداخت سفارش باشد.',
        );
      }

      const currency = dto.currency ?? order.currency;

      if (currency !== order.currency) {
        throw new BadRequestException(
          'واحد پول پرداخت باید با واحد پول سفارش یکسان باشد.',
        );
      }

      const paymentId = randomUUID();

      const rows = await tx.$queryRaw<PaymentRow[]>(
        Prisma.sql`
                INSERT INTO "Payment" (
                  "id",
                  "orderId",
                  "userId",
                  "amount",
                  "currency",
                  "paymentMethod",
                  "paymentStatus",
                  "transactionId",
                  "gateway",
                  "receiptUrl",
                  "metadata",
                  "createdAt",
                  "updatedAt"
                )
                VALUES (
                  ${paymentId},
                  ${order.id},
                  ${order.user_id},
                  ${amount},
                  ${currency},
                  ${dto.paymentMethod}::"PaymentMethod",
                  ${PaymentStatus.PENDING}::"PaymentStatus",
                  ${dto.transactionId ?? null},
                  ${dto.gateway ?? null},
                  ${dto.receiptUrl ?? null},
                  ${this.jsonb(dto.metadata ?? null)},
                  NOW(),
                  NOW()
                )
                RETURNING
                  "id",
                  "orderId" AS order_id,
                  "userId" AS user_id,
                  "amount",
                  "currency",
                  "paymentMethod" AS payment_method,
                  "paymentStatus" AS payment_status,
                  "transactionId" AS transaction_id,
                  "gateway",
                  "receiptUrl" AS receipt_url,
                  "metadata",
                  "paidAt" AS paid_at,
                  "refundedAt" AS refunded_at,
                  "createdAt" AS created_at,
                  "updatedAt" AS updated_at,
                  "deleted_at" AS deleted_at,
                  NULL::text AS order_number,
                  NULL::numeric AS order_total_amount,
                  NULL::"OrderStatus" AS order_status
              `,
      );

      await tx.$executeRaw(
        Prisma.sql`
              UPDATE "Order"
              SET
                "paymentMethod" = ${dto.paymentMethod}::"PaymentMethod",
                "paymentStatus" = ${PaymentStatus.PENDING}::"PaymentStatus",
                "updatedAt" = NOW()
              WHERE "id" = ${order.id}
                AND "deleted_at" IS NULL
            `,
      );

      return rows[0];
    });

    this.eventPublisher.publishCreated({
      paymentId: payment.id,
      orderId: payment.order_id,
      userId: payment.user_id,
      amount: this.toDecimalString(payment.amount),
      currency: payment.currency,
      paymentMethod: payment.payment_method,
      paymentStatus: payment.payment_status,
      actorId: options.actorId,
      occurredAt: new Date(),
    });

    return payment;
  }

  private async calculateRemainingOrderAmountTx(
    tx: PrismaTx,
    orderId: string,
    orderTotalAmount: unknown,
  ): Promise<Prisma.Decimal> {
    const rows = await tx.$queryRaw<PaymentAggregateRow[]>(
      Prisma.sql`
          SELECT
            COALESCE(SUM("amount") FILTER (
              WHERE "paymentStatus"::text = 'COMPLETED'
            ), 0) AS completed_amount,
            COALESCE(SUM("amount") FILTER (
              WHERE "paymentStatus"::text IN ('REFUNDED', 'PARTIAL_REFUNDED')
            ), 0) AS refunded_amount,
            COUNT(*) FILTER (
              WHERE "paymentStatus"::text = 'FAILED'
            )::int AS failed_count,
            COUNT(*) FILTER (
              WHERE "paymentStatus"::text = 'PENDING'
            )::int AS pending_count
          FROM "Payment"
          WHERE "orderId" = ${orderId}
            AND "deleted_at" IS NULL
        `,
    );

    const completedAmount = this.toDecimal(rows[0]?.completed_amount);

    const orderTotal = this.toDecimal(orderTotalAmount);

    return Prisma.Decimal.max(
      new Prisma.Decimal(0),
      orderTotal.minus(completedAmount),
    );
  }

  private async syncOrderPaymentStatusTx(
    tx: PrismaTx,
    orderId: string,
  ): Promise<PaymentStatus> {
    const order = await this.findOrderContextForUpdateTx(tx, orderId);

    const rows = await tx.$queryRaw<PaymentAggregateRow[]>(
      Prisma.sql`
          SELECT
            COALESCE(SUM("amount") FILTER (
              WHERE "paymentStatus"::text = 'COMPLETED'
            ), 0) AS completed_amount,
            COALESCE(SUM("amount") FILTER (
              WHERE "paymentStatus"::text IN ('REFUNDED', 'PARTIAL_REFUNDED')
            ), 0) AS refunded_amount,
            COUNT(*) FILTER (
              WHERE "paymentStatus"::text = 'FAILED'
            )::int AS failed_count,
            COUNT(*) FILTER (
              WHERE "paymentStatus"::text = 'PENDING'
            )::int AS pending_count
          FROM "Payment"
          WHERE "orderId" = ${orderId}
            AND "deleted_at" IS NULL
        `,
    );

    const aggregate = rows[0];

    const completedAmount = this.toDecimal(aggregate?.completed_amount);

    const refundedAmount = this.toDecimal(aggregate?.refunded_amount);

    const failedCount = this.toNumber(aggregate?.failed_count);

    const pendingCount = this.toNumber(aggregate?.pending_count);

    const totalAmount = this.toDecimal(order.total_amount);

    let nextPaymentStatus: PaymentStatus = PaymentStatus.PENDING;

    if (failedCount > 0 && pendingCount === 0 && completedAmount.equals(0)) {
      nextPaymentStatus = PaymentStatus.FAILED;
    }

    if (pendingCount > 0) {
      nextPaymentStatus = PaymentStatus.PENDING;
    }

    if (completedAmount.greaterThanOrEqualTo(totalAmount)) {
      nextPaymentStatus = PaymentStatus.COMPLETED;
    }

    if (refundedAmount.greaterThan(0) && refundedAmount.lessThan(totalAmount)) {
      nextPaymentStatus = PaymentStatus.PARTIAL_REFUNDED;
    }

    if (refundedAmount.greaterThanOrEqualTo(totalAmount)) {
      nextPaymentStatus = PaymentStatus.REFUNDED;
    }

    const orderStatusUpdate =
      nextPaymentStatus === PaymentStatus.COMPLETED &&
      order.status === OrderStatus.PENDING
        ? Prisma.sql`, "status" = ${OrderStatus.CONFIRMED}::"OrderStatus"`
        : Prisma.empty;

    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "Order"
        SET
          "paymentStatus" = ${nextPaymentStatus}::"PaymentStatus",
          "updatedAt" = NOW()
          ${orderStatusUpdate}
        WHERE "id" = ${orderId}
          AND "deleted_at" IS NULL
      `,
    );

    return nextPaymentStatus;
  }

  private async findPaymentRow(paymentId: string): Promise<PaymentRow> {
    const rows = await this.prisma.$queryRaw<PaymentRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."orderId" AS order_id,
            p."userId" AS user_id,
            p."amount",
            p."currency",
            p."paymentMethod" AS payment_method,
            p."paymentStatus" AS payment_status,
            p."transactionId" AS transaction_id,
            p."gateway",
            p."receiptUrl" AS receipt_url,
            p."metadata",
            p."paidAt" AS paid_at,
            p."refundedAt" AS refunded_at,
            p."createdAt" AS created_at,
            p."updatedAt" AS updated_at,
            p."deleted_at" AS deleted_at,
            o."orderNumber" AS order_number,
            o."totalAmount" AS order_total_amount,
            o."status" AS order_status
          FROM "Payment" p
          LEFT JOIN "Order" o ON o."id" = p."orderId"
          WHERE p."id" = ${paymentId}
            AND p."deleted_at" IS NULL
          LIMIT 1
        `,
    );

    if (!rows[0]) {
      throw new NotFoundException('پرداخت پیدا نشد.');
    }

    return rows[0];
  }

  private async findPaymentRowForUpdate(
    tx: PrismaTx,
    paymentId: string,
  ): Promise<PaymentRow> {
    const rows = await tx.$queryRaw<PaymentRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."orderId" AS order_id,
            p."userId" AS user_id,
            p."amount",
            p."currency",
            p."paymentMethod" AS payment_method,
            p."paymentStatus" AS payment_status,
            p."transactionId" AS transaction_id,
            p."gateway",
            p."receiptUrl" AS receipt_url,
            p."metadata",
            p."paidAt" AS paid_at,
            p."refundedAt" AS refunded_at,
            p."createdAt" AS created_at,
            p."updatedAt" AS updated_at,
            p."deleted_at" AS deleted_at,
            o."orderNumber" AS order_number,
            o."totalAmount" AS order_total_amount,
            o."status" AS order_status
          FROM "Payment" p
          LEFT JOIN "Order" o ON o."id" = p."orderId"
          WHERE p."id" = ${paymentId}
            AND p."deleted_at" IS NULL
          LIMIT 1
          FOR UPDATE OF p
        `,
    );

    if (!rows[0]) {
      throw new NotFoundException('پرداخت پیدا نشد.');
    }

    return rows[0];
  }

  private async findOrderContext(
    orderId: string,
  ): Promise<OrderPaymentContextRow> {
    return this.findOrderContextTx(this.prisma, orderId);
  }

  private async findOrderContextTx(
    tx: PrismaTx | PrismaService,
    orderId: string,
  ): Promise<OrderPaymentContextRow> {
    const rows = await tx.$queryRaw<OrderPaymentContextRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "userId" AS user_id,
            "orderNumber" AS order_number,
            "status",
            "totalAmount" AS total_amount,
            "currency",
            "paymentStatus" AS payment_status,
            "paymentMethod" AS payment_method,
            "deleted_at" AS deleted_at
          FROM "Order"
          WHERE "id" = ${orderId}
          LIMIT 1
        `,
    );

    if (!rows[0]) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }

    return rows[0];
  }

  private async findOrderContextForUpdateTx(
    tx: PrismaTx,
    orderId: string,
  ): Promise<OrderPaymentContextRow> {
    const rows = await tx.$queryRaw<OrderPaymentContextRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "userId" AS user_id,
            "orderNumber" AS order_number,
            "status",
            "totalAmount" AS total_amount,
            "currency",
            "paymentStatus" AS payment_status,
            "paymentMethod" AS payment_method,
            "deleted_at" AS deleted_at
          FROM "Order"
          WHERE "id" = ${orderId}
          LIMIT 1
          FOR UPDATE
        `,
    );

    if (!rows[0]) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }

    return rows[0];
  }

  private async findPendingZarinpalPaymentTx(
    tx: PrismaTx,
    userId: string,
    orderId: string,
  ): Promise<GatewayPaymentReservationRow | null> {
    const rows = await tx.$queryRaw<GatewayPaymentReservationRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."orderId" AS order_id,
            p."userId" AS user_id,
            p."amount",
            p."currency",
            p."paymentMethod" AS payment_method,
            p."paymentStatus" AS payment_status,
            p."transactionId" AS transaction_id,
            p."gateway",
            p."metadata",
            p."gatewayAuthority" AS gateway_authority,
            p."gatewayRequestKey" AS gateway_request_key,
            p."gatewayRequestState" AS gateway_request_state,
            p."gatewayRequestedAt" AS gateway_requested_at,
            p."gatewayRequestCompletedAt" AS gateway_request_completed_at,
            o."orderNumber" AS order_number,
            u."email",
            u."phone"
          FROM "Payment" p
          INNER JOIN "Order" o
            ON o."id" = p."orderId"
          INNER JOIN "User" u
            ON u."id" = p."userId"
          WHERE
            p."orderId" = ${orderId}
            AND p."userId" = ${userId}
            AND p."paymentStatus" = ${PaymentStatus.PENDING}::"PaymentStatus"
            AND p."paymentMethod" = ${PaymentMethod.ZARINPAL}::"PaymentMethod"
            AND LOWER(COALESCE(p."gateway", '')) = 'zarinpal'
            AND p."deleted_at" IS NULL
          ORDER BY p."createdAt" ASC, p."id" ASC
          LIMIT 1
          FOR UPDATE OF p
        `,
    );

    return rows[0] ?? null;
  }

  private async findGatewayPaymentReservationRowTx(
    tx: PrismaTx,
    paymentId: string,
  ): Promise<GatewayPaymentReservationRow> {
    const rows = await tx.$queryRaw<GatewayPaymentReservationRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."orderId" AS order_id,
            p."userId" AS user_id,
            p."amount",
            p."currency",
            p."paymentMethod" AS payment_method,
            p."paymentStatus" AS payment_status,
            p."transactionId" AS transaction_id,
            p."gateway",
            p."metadata",
            p."gatewayAuthority" AS gateway_authority,
            p."gatewayRequestKey" AS gateway_request_key,
            p."gatewayRequestState" AS gateway_request_state,
            p."gatewayRequestedAt" AS gateway_requested_at,
            p."gatewayRequestCompletedAt" AS gateway_request_completed_at,
            o."orderNumber" AS order_number,
            u."email",
            u."phone"
          FROM "Payment" p
          INNER JOIN "Order" o
            ON o."id" = p."orderId"
          INNER JOIN "User" u
            ON u."id" = p."userId"
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

  private async findGatewayPaymentReservationRowForUpdateTx(
    tx: PrismaTx,
    paymentId: string,
  ): Promise<GatewayPaymentReservationRow> {
    const rows = await tx.$queryRaw<GatewayPaymentReservationRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."orderId" AS order_id,
            p."userId" AS user_id,
            p."amount",
            p."currency",
            p."paymentMethod" AS payment_method,
            p."paymentStatus" AS payment_status,
            p."transactionId" AS transaction_id,
            p."gateway",
            p."metadata",
            p."gatewayAuthority" AS gateway_authority,
            p."gatewayRequestKey" AS gateway_request_key,
            p."gatewayRequestState" AS gateway_request_state,
            p."gatewayRequestedAt" AS gateway_requested_at,
            p."gatewayRequestCompletedAt" AS gateway_request_completed_at,
            o."orderNumber" AS order_number,
            u."email",
            u."phone"
          FROM "Payment" p
          INNER JOIN "Order" o
            ON o."id" = p."orderId"
          INNER JOIN "User" u
            ON u."id" = p."userId"
          WHERE
            p."id" = ${paymentId}
            AND p."deleted_at" IS NULL
          LIMIT 1
          FOR UPDATE OF p
        `,
    );

    const payment = rows[0];

    if (!payment) {
      throw new NotFoundException('پرداخت پیدا نشد.');
    }

    return payment;
  }

  private mapGatewayPaymentReservation(
    row: GatewayPaymentReservationRow,
    created: boolean,
  ): GatewayPaymentReservation {
    return {
      paymentId: row.id,
      orderId: row.order_id,
      userId: row.user_id,
      orderNumber: row.order_number,
      amount: this.toDecimalString(row.amount),
      currency: row.currency,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      transactionId: row.transaction_id,
      gateway: row.gateway,
      authority: row.gateway_authority ?? row.transaction_id,
      requestKey: row.gateway_request_key,
      requestState: row.gateway_request_state,
      requestedAt: row.gateway_requested_at,
      requestCompletedAt: row.gateway_request_completed_at,
      email: row.email,
      phone: row.phone,
      created,
    };
  }

  private assertGatewayRequestClaim(
    payment: GatewayPaymentReservationRow,
    requestKey: string,
  ): void {
    if (
      !payment.gateway_request_key ||
      payment.gateway_request_key !== requestKey
    ) {
      throw new ConflictException(
        'مالکیت درخواست پرداخت تغییر کرده است؛ درخواست تکرار نشد.',
      );
    }
  }

  private mergeGatewayMetadata(
    current: unknown,
    patch: Record<string, unknown>,
  ): Record<string, unknown> {
    const base =
      current && typeof current === 'object' && !Array.isArray(current)
        ? (current as Record<string, unknown>)
        : {};

    const currentGateway =
      base.zarinpal &&
      typeof base.zarinpal === 'object' &&
      !Array.isArray(base.zarinpal)
        ? (base.zarinpal as Record<string, unknown>)
        : {};

    return {
      ...base,
      zarinpal: {
        ...currentGateway,
        ...patch,
      },
    };
  }

  private async findAllPayments<T>(
    query: QueryPaymentDto,
    mapRow: (row: PaymentRow) => T,
  ) {
    const { page, limit, skip } = this.buildPagination(query);

    const whereSql = this.buildPaymentWhereSql(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<PaymentRow[]>(
        Prisma.sql`
            SELECT
              p."id",
              p."orderId" AS order_id,
              p."userId" AS user_id,
              p."amount",
              p."currency",
              p."paymentMethod" AS payment_method,
              p."paymentStatus" AS payment_status,
              p."transactionId" AS transaction_id,
              p."gateway",
              p."receiptUrl" AS receipt_url,
              p."metadata",
              p."paidAt" AS paid_at,
              p."refundedAt" AS refunded_at,
              p."createdAt" AS created_at,
              p."updatedAt" AS updated_at,
              p."deleted_at" AS deleted_at,
              o."orderNumber" AS order_number,
              o."totalAmount" AS order_total_amount,
              o."status" AS order_status
            FROM "Payment" p
            LEFT JOIN "Order" o ON o."id" = p."orderId"
            ${whereSql}
            ORDER BY p."createdAt" DESC, p."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),

      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS count
            FROM "Payment" p
            LEFT JOIN "Order" o ON o."id" = p."orderId"
            ${whereSql}
          `,
      ),
    ]);

    return this.buildPaginatedResult(
      rows.map(mapRow),
      this.toNumber(countRows[0]?.count),
      page,
      limit,
    );
  }

  private buildPaymentWhereSql(query: QueryPaymentDto): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];

    if (query.includeDeleted !== true) {
      conditions.push(Prisma.sql`p."deleted_at" IS NULL`);
    }

    if (query.orderId) {
      conditions.push(Prisma.sql`p."orderId" = ${query.orderId}`);
    }

    if (query.userId) {
      conditions.push(Prisma.sql`p."userId" = ${query.userId}`);
    }

    if (query.paymentMethod) {
      conditions.push(
        Prisma.sql`p."paymentMethod" = ${query.paymentMethod}::"PaymentMethod"`,
      );
    }

    if (query.paymentStatus) {
      conditions.push(
        Prisma.sql`p."paymentStatus" = ${query.paymentStatus}::"PaymentStatus"`,
      );
    }

    if (query.transactionId) {
      conditions.push(
        Prisma.sql`p."transactionId" ILIKE ${`%${query.transactionId}%`}`,
      );
    }

    if (query.gateway) {
      conditions.push(Prisma.sql`p."gateway" ILIKE ${`%${query.gateway}%`}`);
    }

    if (query.currency) {
      conditions.push(Prisma.sql`p."currency" = ${query.currency}`);
    }

    if (query.createdFrom) {
      conditions.push(
        Prisma.sql`p."createdAt" >= ${this.parseDate(query.createdFrom)}`,
      );
    }

    if (query.createdTo) {
      conditions.push(
        Prisma.sql`p."createdAt" <= ${this.parseDate(query.createdTo)}`,
      );
    }

    if (conditions.length === 0) {
      return Prisma.empty;
    }

    return Prisma.sql`
      WHERE ${Prisma.join(conditions, ' AND ')}
    `;
  }

  private mapCustomerPaymentRow(row: PaymentRow) {
    return {
      id: row.id,
      orderId: row.order_id,
      amount: this.toDecimalString(row.amount),
      currency: row.currency,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      transactionId: row.transaction_id,
      gateway: row.gateway,
      receiptUrl: row.receipt_url,
      paidAt: row.paid_at,
      paidAtFa: this.toPersianDateTimeString(row.paid_at),
      refundedAt: row.refunded_at,
      refundedAtFa: this.toPersianDateTimeString(row.refunded_at),
      order: row.order_number
        ? {
            orderNumber: row.order_number,
            totalAmount: this.toDecimalString(row.order_total_amount),
            status: row.order_status,
          }
        : null,
      createdAt: row.created_at,
      createdAtFa: this.toPersianDateTimeString(row.created_at),
      updatedAt: row.updated_at,
      updatedAtFa: this.toPersianDateTimeString(row.updated_at),
    };
  }

  private mapPaymentRow(row: PaymentRow) {
    return {
      id: row.id,
      orderId: row.order_id,
      userId: row.user_id,
      amount: this.toDecimalString(row.amount),
      currency: row.currency,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      transactionId: row.transaction_id,
      gateway: row.gateway,
      receiptUrl: row.receipt_url,
      metadata: row.metadata,
      paidAt: row.paid_at,
      paidAtFa: this.toPersianDateTimeString(row.paid_at),
      refundedAt: row.refunded_at,
      refundedAtFa: this.toPersianDateTimeString(row.refunded_at),
      order: row.order_number
        ? {
            orderNumber: row.order_number,
            totalAmount: this.toDecimalString(row.order_total_amount),
            status: row.order_status,
          }
        : null,
      createdAt: row.created_at,
      createdAtFa: this.toPersianDateTimeString(row.created_at),
      updatedAt: row.updated_at,
      updatedAtFa: this.toPersianDateTimeString(row.updated_at),
      deletedAt: row.deleted_at,
      deletedAtFa: this.toPersianDateTimeString(row.deleted_at),
    };
  }

  private assertPaymentEditable(status: PaymentStatus): void {
    const editablePaymentStatuses: PaymentStatus[] = [
      PaymentStatus.PENDING,
      PaymentStatus.FAILED,
    ];

    if (!editablePaymentStatuses.includes(status)) {
      throw new BadRequestException(
        'فقط پرداخت‌های در انتظار یا ناموفق قابل ویرایش هستند.',
      );
    }
  }

  private assertPositiveDecimal(
    value: string | undefined,
    field: string,
    allowEmpty = false,
  ): void {
    if (!value && allowEmpty) {
      return;
    }

    if (!value) {
      throw new BadRequestException(`${field} الزامی است.`);
    }

    const decimal = new Prisma.Decimal(value);

    if (decimal.lessThanOrEqualTo(0)) {
      throw new BadRequestException(`${field} باید بیشتر از صفر باشد.`);
    }
  }

  private mergeMetadata(
    current: unknown,
    patch: Record<string, unknown>,
  ): Record<string, unknown> {
    const base =
      current && typeof current === 'object' && !Array.isArray(current)
        ? (current as Record<string, unknown>)
        : {};

    return {
      ...base,
      ...patch,
    };
  }

  private jsonb(value: unknown): Prisma.Sql {
    if (value === undefined || value === null) {
      return Prisma.sql`NULL`;
    }

    return Prisma.sql`${JSON.stringify(value)}::jsonb`;
  }

  private buildPagination(query: QueryPaymentDto) {
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

  private parseDate(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('تاریخ واردشده معتبر نیست.');
    }

    return date;
  }

  private toPersianDateTimeString(value: Date | null): string | null {
    return formatPersianDateTime(value);
  }

  private toDecimal(value: unknown): Prisma.Decimal {
    if (value === null || value === undefined) {
      return new Prisma.Decimal(0);
    }

    if (value instanceof Prisma.Decimal) {
      return value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return new Prisma.Decimal(value);
    }

    if (typeof value === 'bigint') {
      return new Prisma.Decimal(value.toString());
    }

    throw new TypeError('Unexpected decimal value returned by the database.');
  }

  private toDecimalString(value: unknown): string {
    if (value === null || value === undefined) {
      return '0';
    }

    if (value instanceof Prisma.Decimal) {
      return value.toString();
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'bigint'
    ) {
      return value.toString();
    }

    throw new TypeError('Unexpected decimal value returned by the database.');
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }

    const numericValue =
      value instanceof Prisma.Decimal
        ? value.toNumber()
        : typeof value === 'bigint'
          ? Number(value)
          : typeof value === 'number'
            ? value
            : typeof value === 'string'
              ? Number(value)
              : Number.NaN;

    if (!Number.isFinite(numericValue)) {
      throw new TypeError('Unexpected numeric value returned by the database.');
    }

    return numericValue;
  }
}
