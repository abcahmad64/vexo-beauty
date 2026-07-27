import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { RequestRefundDto } from '../dto/request-refund.dto';

import { RefundService } from './refund.service';

import type { CustomerRefundResponse } from './refund.service';

type RefundPaymentContextRow = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  amount: Prisma.Decimal;
  currency: string;
  paymentStatus: PaymentStatus;
  paidAt: Date | null;
  orderStatus: OrderStatus;
  deletedAt: Date | null;
};

type CountRow = {
  count: number;
};

type SumRow = {
  total: Prisma.Decimal | null;
};

@Injectable()
export class RefundRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refundService: RefundService,
  ) {}

  async requestForUser(
    userId: string,
    dto: RequestRefundDto,
  ): Promise<CustomerRefundResponse> {
    const payment = await this.findPaymentForUser(userId, dto.paymentId);

    this.assertPaymentCanBeRequestedForRefund(payment);

    await this.assertNoOpenRefundRequest(payment.paymentId);

    const alreadyReservedAmount = await this.getReservedRefundAmount(
      payment.paymentId,
    );

    const remainingAmount = payment.amount.minus(alreadyReservedAmount);

    if (remainingAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'مبلغ قابل بازگشت برای این پرداخت باقی نمانده است.',
      );
    }

    const requestedAmount = dto.amount
      ? new Prisma.Decimal(dto.amount)
      : remainingAmount;

    if (requestedAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'مبلغ درخواست بازگشت وجه باید بزرگ‌تر از صفر باشد.',
      );
    }

    if (requestedAmount.greaterThan(remainingAmount)) {
      throw new BadRequestException(
        'مبلغ درخواست بازگشت وجه بیشتر از مبلغ قابل بازگشت است.',
      );
    }

    const created = await this.refundService.createRefund(
      {
        paymentId: payment.paymentId,
        amount: this.toDecimalString(requestedAmount),
        reason: dto.reason,
        status: RefundStatus.PENDING,
        notifyCustomer: true,
      },
      {
        actorId: userId,
      },
    );

    return this.refundService.findOneForUser(userId, created.id);
  }

  private async findPaymentForUser(
    userId: string,
    paymentId: string,
  ): Promise<RefundPaymentContextRow> {
    const rows = await this.prisma.$queryRaw<RefundPaymentContextRow[]>(
      Prisma.sql`
          SELECT
            p."id" AS "paymentId",
            p."orderId",
            o."orderNumber",
            p."userId",
            p."amount",
            p."currency",
            p."paymentStatus",
            p."paidAt",
            o."status" AS "orderStatus",
            p."deleted_at" AS "deletedAt"
          FROM "Payment" p
          INNER JOIN "Order" o
            ON o."id" = p."orderId"
          WHERE
            p."id" = ${paymentId}
            AND p."userId" = ${userId}
            AND p."deleted_at" IS NULL
            AND o."deleted_at" IS NULL
          LIMIT 1
        `,
    );

    const payment = rows[0];

    if (!payment) {
      throw new NotFoundException('پرداخت برای درخواست بازگشت وجه یافت نشد.');
    }

    return payment;
  }

  private assertPaymentCanBeRequestedForRefund(
    payment: RefundPaymentContextRow,
  ): void {
    if (
      payment.paymentStatus !== PaymentStatus.COMPLETED &&
      payment.paymentStatus !== PaymentStatus.PARTIAL_REFUNDED
    ) {
      throw new BadRequestException(
        'فقط پرداخت‌های موفق یا بخشی بازگشت‌خورده قابل درخواست بازگشت وجه هستند.',
      );
    }

    if (!payment.paidAt) {
      throw new BadRequestException(
        'پرداخت هنوز زمان پرداخت معتبر ندارد و قابل بازگشت وجه نیست.',
      );
    }

    if (payment.orderStatus !== OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'درخواست بازگشت وجه فقط برای سفارش تحویل‌شده قابل ثبت است.',
      );
    }
  }

  private async assertNoOpenRefundRequest(paymentId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Refund" r
          WHERE
            r."paymentId" = ${paymentId}
            AND r."deleted_at" IS NULL
            AND r."status" IN (
              'PENDING'::"RefundStatus",
              'PROCESSING'::"RefundStatus"
            )
        `,
    );

    if ((rows[0]?.count ?? 0) > 0) {
      throw new BadRequestException(
        'برای این پرداخت یک درخواست بازگشت وجه باز وجود دارد.',
      );
    }
  }

  private async getReservedRefundAmount(
    paymentId: string,
  ): Promise<Prisma.Decimal> {
    const rows = await this.prisma.$queryRaw<SumRow[]>(
      Prisma.sql`
          SELECT
            COALESCE(SUM(r."amount"), 0) AS "total"
          FROM "Refund" r
          WHERE
            r."paymentId" = ${paymentId}
            AND r."deleted_at" IS NULL
            AND r."status" IN (
              'PENDING'::"RefundStatus",
              'PROCESSING'::"RefundStatus",
              'COMPLETED'::"RefundStatus"
            )
        `,
    );

    return rows[0]?.total ?? new Prisma.Decimal(0);
  }

  private toDecimalString(value: Prisma.Decimal): string {
    return value.toFixed(2);
  }
}
