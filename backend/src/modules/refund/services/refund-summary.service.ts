import { BadRequestException, Injectable } from '@nestjs/common';

import { PaymentStatus, Prisma, RefundStatus } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { RefundSummaryQueryDto } from '../dto/refund-summary-query.dto';

type RefundSummaryAggregateRow = {
  totalCount: number | bigint;
  totalAmount: Prisma.Decimal | null;
  pendingCount: number | bigint;
  pendingAmount: Prisma.Decimal | null;
  processingCount: number | bigint;
  processingAmount: Prisma.Decimal | null;
  completedCount: number | bigint;
  completedAmount: Prisma.Decimal | null;
  failedCount: number | bigint;
  failedAmount: Prisma.Decimal | null;
  uniqueUsers: number | bigint;
  uniqueOrders: number | bigint;
  uniquePayments: number | bigint;
};

type RefundDailyRow = {
  day: Date;
  count: number | bigint;
  amount: Prisma.Decimal | null;
};

type RefundGatewayRow = {
  gateway: string | null;
  count: number | bigint;
  amount: Prisma.Decimal | null;
};

type RefundPaymentStatusRow = {
  paymentStatus: PaymentStatus | null;
  count: number | bigint;
  amount: Prisma.Decimal | null;
};

type RefundSummaryResponse = {
  totals: {
    totalCount: number;
    totalAmount: string;
    pendingCount: number;
    pendingAmount: string;
    processingCount: number;
    processingAmount: string;
    completedCount: number;
    completedAmount: string;
    failedCount: number;
    failedAmount: string;
    uniqueUsers: number;
    uniqueOrders: number;
    uniquePayments: number;
  };
  ratios: {
    completedRate: string;
    failedRate: string;
    pendingRate: string;
    processingRate: string;
  };
  byPaymentStatus: Array<{
    paymentStatus: PaymentStatus | null;
    count: number;
    amount: string;
  }>;
  byGateway: Array<{
    gateway: string;
    count: number;
    amount: string;
  }>;
  dailyCompleted: Array<{
    day: string;
    count: number;
    amount: string;
  }>;
};

/** Customer-facing aggregate; excludes cross-customer operational dimensions. */
export type CustomerRefundSummaryResponse = {
  totals: {
    totalCount: number;
    totalAmount: string;
    pendingCount: number;
    pendingAmount: string;
    processingCount: number;
    processingAmount: string;
    completedCount: number;
    completedAmount: string;
    failedCount: number;
    failedAmount: string;
    uniqueOrders: number;
    uniquePayments: number;
  };
  ratios: {
    completedRate: string;
    failedRate: string;
    pendingRate: string;
    processingRate: string;
  };
};

@Injectable()
export class RefundSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminSummary(
    query: RefundSummaryQueryDto,
  ): Promise<RefundSummaryResponse> {
    return this.buildSummary(query);
  }

  async getUserSummary(
    userId: string,
    query: RefundSummaryQueryDto,
  ): Promise<CustomerRefundSummaryResponse> {
    const summary = await this.buildSummary({
      ...query,
      userId,
      includeDeleted: false,
    });

    return {
      totals: {
        totalCount: summary.totals.totalCount,
        totalAmount: summary.totals.totalAmount,
        pendingCount: summary.totals.pendingCount,
        pendingAmount: summary.totals.pendingAmount,
        processingCount: summary.totals.processingCount,
        processingAmount: summary.totals.processingAmount,
        completedCount: summary.totals.completedCount,
        completedAmount: summary.totals.completedAmount,
        failedCount: summary.totals.failedCount,
        failedAmount: summary.totals.failedAmount,
        uniqueOrders: summary.totals.uniqueOrders,
        uniquePayments: summary.totals.uniquePayments,
      },
      ratios: summary.ratios,
    };
  }

  private async buildSummary(
    query: RefundSummaryQueryDto,
  ): Promise<RefundSummaryResponse> {
    const where = this.buildWhere(query);

    const [aggregateRows, dailyRows, gatewayRows, paymentStatusRows] =
      await Promise.all([
        this.prisma.$queryRaw<RefundSummaryAggregateRow[]>(
          Prisma.sql`
            SELECT
              COUNT(*)::int AS "totalCount",
              COALESCE(SUM(r."amount"), 0) AS "totalAmount",

              COUNT(*) FILTER (
                WHERE r."status" = ${RefundStatus.PENDING}::"RefundStatus"
              )::int AS "pendingCount",
              COALESCE(SUM(r."amount") FILTER (
                WHERE r."status" = ${RefundStatus.PENDING}::"RefundStatus"
              ), 0) AS "pendingAmount",

              COUNT(*) FILTER (
                WHERE r."status" = ${RefundStatus.PROCESSING}::"RefundStatus"
              )::int AS "processingCount",
              COALESCE(SUM(r."amount") FILTER (
                WHERE r."status" = ${RefundStatus.PROCESSING}::"RefundStatus"
              ), 0) AS "processingAmount",

              COUNT(*) FILTER (
                WHERE r."status" = ${RefundStatus.COMPLETED}::"RefundStatus"
              )::int AS "completedCount",
              COALESCE(SUM(r."amount") FILTER (
                WHERE r."status" = ${RefundStatus.COMPLETED}::"RefundStatus"
              ), 0) AS "completedAmount",

              COUNT(*) FILTER (
                WHERE r."status" = ${RefundStatus.FAILED}::"RefundStatus"
              )::int AS "failedCount",
              COALESCE(SUM(r."amount") FILTER (
                WHERE r."status" = ${RefundStatus.FAILED}::"RefundStatus"
              ), 0) AS "failedAmount",

              COUNT(DISTINCT p."userId")::int AS "uniqueUsers",
              COUNT(DISTINCT p."orderId")::int AS "uniqueOrders",
              COUNT(DISTINCT r."paymentId")::int AS "uniquePayments"
            FROM "Refund" r
            LEFT JOIN "Payment" p
              ON p."id" = r."paymentId"
            LEFT JOIN "Order" o
              ON o."id" = p."orderId"
            WHERE ${Prisma.join(where, ' AND ')}
          `,
        ),

        this.prisma.$queryRaw<RefundDailyRow[]>(
          Prisma.sql`
            SELECT
              DATE_TRUNC('day', r."processedAt") AS "day",
              COUNT(*)::int AS "count",
              COALESCE(SUM(r."amount"), 0) AS "amount"
            FROM "Refund" r
            LEFT JOIN "Payment" p
              ON p."id" = r."paymentId"
            LEFT JOIN "Order" o
              ON o."id" = p."orderId"
            WHERE
              ${Prisma.join(where, ' AND ')}
              AND r."status" = ${RefundStatus.COMPLETED}::"RefundStatus"
              AND r."processedAt" IS NOT NULL
            GROUP BY
              DATE_TRUNC('day', r."processedAt")
            ORDER BY
              "day" DESC
            LIMIT 30
          `,
        ),

        this.prisma.$queryRaw<RefundGatewayRow[]>(
          Prisma.sql`
            SELECT
              p."gateway" AS "gateway",
              COUNT(*)::int AS "count",
              COALESCE(SUM(r."amount"), 0) AS "amount"
            FROM "Refund" r
            LEFT JOIN "Payment" p
              ON p."id" = r."paymentId"
            LEFT JOIN "Order" o
              ON o."id" = p."orderId"
            WHERE ${Prisma.join(where, ' AND ')}
            GROUP BY
              p."gateway"
            ORDER BY
              "amount" DESC,
              "count" DESC
          `,
        ),

        this.prisma.$queryRaw<RefundPaymentStatusRow[]>(
          Prisma.sql`
            SELECT
              p."paymentStatus" AS "paymentStatus",
              COUNT(*)::int AS "count",
              COALESCE(SUM(r."amount"), 0) AS "amount"
            FROM "Refund" r
            LEFT JOIN "Payment" p
              ON p."id" = r."paymentId"
            LEFT JOIN "Order" o
              ON o."id" = p."orderId"
            WHERE ${Prisma.join(where, ' AND ')}
            GROUP BY
              p."paymentStatus"
            ORDER BY
              "amount" DESC,
              "count" DESC
          `,
        ),
      ]);

    const aggregate = aggregateRows[0] ?? this.emptyAggregate();

    return {
      totals: {
        totalCount: this.toNumber(aggregate.totalCount),
        totalAmount: this.toDecimalString(aggregate.totalAmount),
        pendingCount: this.toNumber(aggregate.pendingCount),
        pendingAmount: this.toDecimalString(aggregate.pendingAmount),
        processingCount: this.toNumber(aggregate.processingCount),
        processingAmount: this.toDecimalString(aggregate.processingAmount),
        completedCount: this.toNumber(aggregate.completedCount),
        completedAmount: this.toDecimalString(aggregate.completedAmount),
        failedCount: this.toNumber(aggregate.failedCount),
        failedAmount: this.toDecimalString(aggregate.failedAmount),
        uniqueUsers: this.toNumber(aggregate.uniqueUsers),
        uniqueOrders: this.toNumber(aggregate.uniqueOrders),
        uniquePayments: this.toNumber(aggregate.uniquePayments),
      },
      ratios: this.buildRatios(aggregate),
      byPaymentStatus: paymentStatusRows.map((row) => ({
        paymentStatus: row.paymentStatus,
        count: this.toNumber(row.count),
        amount: this.toDecimalString(row.amount),
      })),
      byGateway: gatewayRows.map((row) => ({
        gateway: row.gateway ?? 'manual',
        count: this.toNumber(row.count),
        amount: this.toDecimalString(row.amount),
      })),
      dailyCompleted: dailyRows.map((row) => ({
        day: row.day.toISOString().slice(0, 10),
        count: this.toNumber(row.count),
        amount: this.toDecimalString(row.amount),
      })),
    };
  }

  private buildWhere(query: RefundSummaryQueryDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [
      query.includeDeleted === true
        ? Prisma.sql`TRUE`
        : Prisma.sql`r."deleted_at" IS NULL`,
    ];

    if (query.userId) {
      where.push(Prisma.sql`p."userId" = ${query.userId}`);
    }

    if (query.paymentId) {
      where.push(Prisma.sql`r."paymentId" = ${query.paymentId}`);
    }

    if (query.orderId) {
      where.push(Prisma.sql`p."orderId" = ${query.orderId}`);
    }

    if (query.createdFrom) {
      where.push(
        Prisma.sql`r."createdAt" >= ${this.parseDate(query.createdFrom)}`,
      );
    }

    if (query.createdTo) {
      where.push(
        Prisma.sql`r."createdAt" <= ${this.parseDate(query.createdTo)}`,
      );
    }

    if (query.processedFrom) {
      where.push(
        Prisma.sql`r."processedAt" >= ${this.parseDate(query.processedFrom)}`,
      );
    }

    if (query.processedTo) {
      where.push(
        Prisma.sql`r."processedAt" <= ${this.parseDate(query.processedTo)}`,
      );
    }

    return where;
  }

  private buildRatios(
    aggregate: RefundSummaryAggregateRow,
  ): RefundSummaryResponse['ratios'] {
    const total = this.toNumber(aggregate.totalCount);

    if (total === 0) {
      return {
        completedRate: '0.00',
        failedRate: '0.00',
        pendingRate: '0.00',
        processingRate: '0.00',
      };
    }

    return {
      completedRate: this.toPercent(
        this.toNumber(aggregate.completedCount),
        total,
      ),
      failedRate: this.toPercent(this.toNumber(aggregate.failedCount), total),
      pendingRate: this.toPercent(this.toNumber(aggregate.pendingCount), total),
      processingRate: this.toPercent(
        this.toNumber(aggregate.processingCount),
        total,
      ),
    };
  }

  private emptyAggregate(): RefundSummaryAggregateRow {
    return {
      totalCount: 0,
      totalAmount: new Prisma.Decimal(0),
      pendingCount: 0,
      pendingAmount: new Prisma.Decimal(0),
      processingCount: 0,
      processingAmount: new Prisma.Decimal(0),
      completedCount: 0,
      completedAmount: new Prisma.Decimal(0),
      failedCount: 0,
      failedAmount: new Prisma.Decimal(0),
      uniqueUsers: 0,
      uniqueOrders: 0,
      uniquePayments: 0,
    };
  }

  private parseDate(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('تاریخ واردشده معتبر نیست.');
    }

    return date;
  }

  private toPercent(value: number, total: number): string {
    return ((value / total) * 100).toFixed(2);
  }

  private toNumber(value: number | bigint): number {
    if (typeof value === 'bigint') {
      return Number(value);
    }

    return value;
  }

  private toDecimalString(value: Prisma.Decimal | null): string {
    if (!value) {
      return '0.00';
    }

    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    return new Prisma.Decimal(value).toFixed(2);
  }
}
