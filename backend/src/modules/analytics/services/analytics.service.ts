import { BadRequestException, Injectable } from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { QueryAnalyticsDto } from '../dto/query-analytics.dto';

import { RecordEventDto } from '../dto/record-event.dto';

import { RecordMetricDto } from '../dto/record-metric.dto';

import { AnalyticsEventPublisher } from '../events/analytics.event.publisher';

type CountRow = {
  count: number | bigint;
};

type DashboardSummaryRow = {
  totalRevenue: Prisma.Decimal | null;
  netRevenue: Prisma.Decimal | null;
  totalOrders: number | bigint;
  paidOrders: number | bigint;
  pendingOrders: number | bigint;
  cancelledOrders: number | bigint;
  refundedOrders: number | bigint;
  averageOrderValue: Prisma.Decimal | null;
};

type PaymentSummaryRow = {
  totalPayments: number | bigint;
  completedPayments: number | bigint;
  failedPayments: number | bigint;
  refundedPayments: number | bigint;
  partialRefundedPayments: number | bigint;
  totalPaidAmount: Prisma.Decimal | null;
  totalRefundedAmount: Prisma.Decimal | null;
};

type CustomerSummaryRow = {
  totalCustomers: number | bigint;
  newCustomers: number | bigint;
  activeBuyingCustomers: number | bigint;
};

type ProductSummaryRow = {
  totalProducts: number | bigint;
  activeProducts: number | bigint;
  draftProducts: number | bigint;
  inactiveProducts: number | bigint;
  totalViews: number | bigint;
  averageRating: Prisma.Decimal | null;
};

type TimeSeriesRow = {
  period: Date;
  orders: number | bigint;
  revenue: Prisma.Decimal | null;
  subtotal: Prisma.Decimal | null;
  tax: Prisma.Decimal | null;
  shipping: Prisma.Decimal | null;
  discount: Prisma.Decimal | null;
};

type OrderStatusRow = {
  status: string;
  count: number | bigint;
  revenue: Prisma.Decimal | null;
};

type PaymentStatusRow = {
  status: string;
  count: number | bigint;
  amount: Prisma.Decimal | null;
};

type PaymentMethodRow = {
  method: string;
  count: number | bigint;
  amount: Prisma.Decimal | null;
};

type TopProductRow = {
  productId: string;
  productName: string;
  sku: string;
  categoryId: string | null;
  categoryName: string | null;
  brandId: string | null;
  brandName: string | null;
  quantitySold: number | bigint;
  grossRevenue: Prisma.Decimal | null;
  netRevenue: Prisma.Decimal | null;
};

type ProductPerformanceRow = {
  id: string;
  name: string;
  sku: string;
  status: string;
  isActive: boolean;
  price: Prisma.Decimal;
  viewCount: number | bigint;
  reviewCount: number | bigint;
  averageRating: Prisma.Decimal | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type CustomerRow = {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  orders: number | bigint;
  revenue: Prisma.Decimal | null;
  lastOrderAt: Date | null;
  createdAt: Date;
};

type AnalyticsEventRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  timestamp: Date;
  userId: string | null;
  data: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type MetricRow = {
  id: string;
  name: string;
  value: Prisma.Decimal;
  unit: string | null;
  description: string | null;
  category: string | null;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type PaginatedResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

type DateRange = {
  createdFrom?: Date;
  createdTo?: Date;
};

type GroupByValue = 'day' | 'week' | 'month' | 'year';

@Injectable()
export class AnalyticsService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: AnalyticsEventPublisher,
  ) {}

  async getDashboard(
    query: QueryAnalyticsDto,
    actorId?: string,
  ): Promise<unknown> {
    const dateRange = this.parseDateRange(query);

    const newCustomerFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const orderWhere = this.buildOrderWhere(query, dateRange);

    const paymentWhere = this.buildPaymentWhere(query, dateRange);

    const productWhere = this.buildProductWhere(query, dateRange);

    const customerWhere = this.buildCustomerWhere(query, dateRange);

    const [orderRows, paymentRows, productRows, customerRows] =
      await Promise.all([
        this.prisma.$queryRaw<DashboardSummaryRow[]>(
          Prisma.sql`
            SELECT
              COALESCE(SUM(o."totalAmount"), 0)::numeric AS "totalRevenue",
              COALESCE(SUM(o."totalAmount" - o."discountAmount"), 0)::numeric AS "netRevenue",
              COUNT(*)::int AS "totalOrders",
              COUNT(*) FILTER (
                WHERE o."paymentStatus" = 'COMPLETED'::"PaymentStatus"
              )::int AS "paidOrders",
              COUNT(*) FILTER (
                WHERE o."status" = 'PENDING'::"OrderStatus"
              )::int AS "pendingOrders",
              COUNT(*) FILTER (
                WHERE o."status" = 'CANCELLED'::"OrderStatus"
              )::int AS "cancelledOrders",
              COUNT(*) FILTER (
                WHERE o."status" = 'REFUNDED'::"OrderStatus"
              )::int AS "refundedOrders",
              COALESCE(AVG(o."totalAmount"), 0)::numeric AS "averageOrderValue"
            FROM "Order" o
            WHERE ${Prisma.join(orderWhere, ' AND ')}
          `,
        ),
        this.prisma.$queryRaw<PaymentSummaryRow[]>(
          Prisma.sql`
            SELECT
              COUNT(*)::int AS "totalPayments",
              COUNT(*) FILTER (
                WHERE p."paymentStatus" = 'COMPLETED'::"PaymentStatus"
              )::int AS "completedPayments",
              COUNT(*) FILTER (
                WHERE p."paymentStatus" = 'FAILED'::"PaymentStatus"
              )::int AS "failedPayments",
              COUNT(*) FILTER (
                WHERE p."paymentStatus" = 'REFUNDED'::"PaymentStatus"
              )::int AS "refundedPayments",
              COUNT(*) FILTER (
                WHERE p."paymentStatus" = 'PARTIAL_REFUNDED'::"PaymentStatus"
              )::int AS "partialRefundedPayments",
              COALESCE(SUM(p."amount") FILTER (
                WHERE p."paymentStatus" = 'COMPLETED'::"PaymentStatus"
              ), 0)::numeric AS "totalPaidAmount",
              COALESCE(SUM(p."amount") FILTER (
                WHERE p."paymentStatus" IN (
                  'REFUNDED'::"PaymentStatus",
                  'PARTIAL_REFUNDED'::"PaymentStatus"
                )
              ), 0)::numeric AS "totalRefundedAmount"
            FROM "Payment" p
            WHERE ${Prisma.join(paymentWhere, ' AND ')}
          `,
        ),
        this.prisma.$queryRaw<ProductSummaryRow[]>(
          Prisma.sql`
            SELECT
              COUNT(*)::int AS "totalProducts",
              COUNT(*) FILTER (
                WHERE p."isActive" = TRUE
              )::int AS "activeProducts",
              COUNT(*) FILTER (
                WHERE p."status" = 'DRAFT'::"ProductStatus"
              )::int AS "draftProducts",
              COUNT(*) FILTER (
                WHERE p."status" = 'INACTIVE'::"ProductStatus"
              )::int AS "inactiveProducts",
              COALESCE(SUM(p."viewCount"), 0)::int AS "totalViews",
              COALESCE(AVG(p."averageRating"), 0)::numeric AS "averageRating"
            FROM "Product" p
            WHERE ${Prisma.join(productWhere, ' AND ')}
          `,
        ),
        this.prisma.$queryRaw<CustomerSummaryRow[]>(
          Prisma.sql`
            SELECT
              COUNT(*)::int AS "totalCustomers",
              COUNT(*) FILTER (
                WHERE u."createdAt" >= ${newCustomerFrom}
              )::int AS "newCustomers",
              COUNT(DISTINCT o."userId")::int AS "activeBuyingCustomers"
            FROM "User" u
            LEFT JOIN "Order" o
              ON o."userId" = u."id"
              AND o."deleted_at" IS NULL
            WHERE ${Prisma.join(customerWhere, ' AND ')}
          `,
        ),
      ]);

    if (actorId) {
      this.eventPublisher.publishDashboardViewed({
        actorId,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
        occurredAt: new Date(),
      });
    }

    const orders = orderRows[0];

    const payments = paymentRows[0];

    const products = productRows[0];

    const customers = customerRows[0];

    return {
      orders: {
        total: this.toNumber(orders?.totalOrders),
        paid: this.toNumber(orders?.paidOrders),
        pending: this.toNumber(orders?.pendingOrders),
        cancelled: this.toNumber(orders?.cancelledOrders),
        refunded: this.toNumber(orders?.refundedOrders),
        averageOrderValue: this.toDecimalString(orders?.averageOrderValue ?? 0),
      },
      revenue: {
        total: this.toDecimalString(orders?.totalRevenue ?? 0),
        net: this.toDecimalString(orders?.netRevenue ?? 0),
      },
      payments: {
        total: this.toNumber(payments?.totalPayments),
        completed: this.toNumber(payments?.completedPayments),
        failed: this.toNumber(payments?.failedPayments),
        refunded: this.toNumber(payments?.refundedPayments),
        partialRefunded: this.toNumber(payments?.partialRefundedPayments),
        totalPaidAmount: this.toDecimalString(payments?.totalPaidAmount ?? 0),
        totalRefundedAmount: this.toDecimalString(
          payments?.totalRefundedAmount ?? 0,
        ),
      },
      products: {
        total: this.toNumber(products?.totalProducts),
        active: this.toNumber(products?.activeProducts),
        draft: this.toNumber(products?.draftProducts),
        inactive: this.toNumber(products?.inactiveProducts),
        totalViews: this.toNumber(products?.totalViews),
        averageRating: this.toDecimalString(products?.averageRating ?? 0),
      },
      customers: {
        total: this.toNumber(customers?.totalCustomers),
        newLast30Days: this.toNumber(customers?.newCustomers),
        activeBuying: this.toNumber(customers?.activeBuyingCustomers),
      },
      range: {
        createdFrom: dateRange.createdFrom?.toISOString() ?? null,
        createdFromFa: this.formatDate(dateRange.createdFrom ?? null),
        createdTo: dateRange.createdTo?.toISOString() ?? null,
        createdToFa: this.formatDate(dateRange.createdTo ?? null),
      },
    };
  }

  async getSalesReport(
    query: QueryAnalyticsDto,
    actorId?: string,
  ): Promise<unknown> {
    const groupBy = this.normalizeGroupBy(query.groupBy);

    const dateRange = this.parseDateRange(query);

    const orderWhere = this.buildOrderWhere(query, dateRange);

    const periodSql = this.groupPeriodSql(groupBy);

    const rows = await this.prisma.$queryRaw<TimeSeriesRow[]>(
      Prisma.sql`
          SELECT
            ${periodSql} AS "period",
            COUNT(*)::int AS "orders",
            COALESCE(SUM(o."totalAmount"), 0)::numeric AS "revenue",
            COALESCE(SUM(o."subtotal"), 0)::numeric AS "subtotal",
            COALESCE(SUM(o."taxAmount"), 0)::numeric AS "tax",
            COALESCE(SUM(o."shippingAmount"), 0)::numeric AS "shipping",
            COALESCE(SUM(o."discountAmount"), 0)::numeric AS "discount"
          FROM "Order" o
          WHERE ${Prisma.join(orderWhere, ' AND ')}
          GROUP BY
            ${periodSql}
          ORDER BY
            "period" ASC
        `,
    );

    if (actorId) {
      this.eventPublisher.publishReportViewed({
        report: 'sales',
        actorId,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
        occurredAt: new Date(),
      });
    }

    return rows.map((row) => ({
      period: row.period.toISOString(),
      periodFa: this.formatDate(row.period),
      orders: this.toNumber(row.orders),
      revenue: this.toDecimalString(row.revenue),
      subtotal: this.toDecimalString(row.subtotal),
      tax: this.toDecimalString(row.tax),
      shipping: this.toDecimalString(row.shipping),
      discount: this.toDecimalString(row.discount),
    }));
  }

  async getOrderReport(
    query: QueryAnalyticsDto,
    actorId?: string,
  ): Promise<unknown> {
    const dateRange = this.parseDateRange(query);

    const orderWhere = this.buildOrderWhere(query, dateRange);

    const rows = await this.prisma.$queryRaw<OrderStatusRow[]>(
      Prisma.sql`
          SELECT
            o."status"::text AS "status",
            COUNT(*)::int AS "count",
            COALESCE(SUM(o."totalAmount"), 0)::numeric AS "revenue"
          FROM "Order" o
          WHERE ${Prisma.join(orderWhere, ' AND ')}
          GROUP BY
            o."status"
          ORDER BY
            "count" DESC
        `,
    );

    if (actorId) {
      this.eventPublisher.publishReportViewed({
        report: 'orders',
        actorId,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
        occurredAt: new Date(),
      });
    }

    return rows.map((row) => ({
      status: row.status,
      count: this.toNumber(row.count),
      revenue: this.toDecimalString(row.revenue),
    }));
  }

  async getPaymentReport(
    query: QueryAnalyticsDto,
    actorId?: string,
  ): Promise<unknown> {
    const dateRange = this.parseDateRange(query);

    const paymentWhere = this.buildPaymentWhere(query, dateRange);

    const [byStatus, byMethod] = await Promise.all([
      this.prisma.$queryRaw<PaymentStatusRow[]>(
        Prisma.sql`
            SELECT
              p."paymentStatus"::text AS "status",
              COUNT(*)::int AS "count",
              COALESCE(SUM(p."amount"), 0)::numeric AS "amount"
            FROM "Payment" p
            WHERE ${Prisma.join(paymentWhere, ' AND ')}
            GROUP BY
              p."paymentStatus"
            ORDER BY
              "count" DESC
          `,
      ),
      this.prisma.$queryRaw<PaymentMethodRow[]>(
        Prisma.sql`
            SELECT
              p."paymentMethod"::text AS "method",
              COUNT(*)::int AS "count",
              COALESCE(SUM(p."amount"), 0)::numeric AS "amount"
            FROM "Payment" p
            WHERE ${Prisma.join(paymentWhere, ' AND ')}
            GROUP BY
              p."paymentMethod"
            ORDER BY
              "amount" DESC
          `,
      ),
    ]);

    if (actorId) {
      this.eventPublisher.publishReportViewed({
        report: 'payments',
        actorId,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
        occurredAt: new Date(),
      });
    }

    return {
      byStatus: byStatus.map((row) => ({
        status: row.status,
        count: this.toNumber(row.count),
        amount: this.toDecimalString(row.amount),
      })),
      byMethod: byMethod.map((row) => ({
        method: row.method,
        count: this.toNumber(row.count),
        amount: this.toDecimalString(row.amount),
      })),
    };
  }

  async getTopProducts(
    query: QueryAnalyticsDto,
    actorId?: string,
  ): Promise<unknown> {
    const limit = this.normalizeLimit(query.limit);

    const dateRange = this.parseDateRange(query);

    const where = this.buildOrderItemWhere(query, dateRange);

    const rows = await this.prisma.$queryRaw<TopProductRow[]>(
      Prisma.sql`
          SELECT
            oi."productId" AS "productId",
            COALESCE(MAX(oi."productName"), MAX(p."name")) AS "productName",
            COALESCE(MAX(oi."sku"), MAX(p."sku")) AS "sku",
            MAX(p."categoryId") AS "categoryId",
            MAX(c."name") AS "categoryName",
            MAX(p."brandId") AS "brandId",
            MAX(b."name") AS "brandName",
            COALESCE(SUM(oi."quantity"), 0)::int AS "quantitySold",
            COALESCE(SUM(oi."price" * oi."quantity"), 0)::numeric AS "grossRevenue",
            COALESCE(SUM((oi."price" * oi."quantity") - oi."discount"), 0)::numeric AS "netRevenue"
          FROM "OrderItem" oi
          INNER JOIN "Order" o
            ON o."id" = oi."orderId"
          LEFT JOIN "Product" p
            ON p."id" = oi."productId"
          LEFT JOIN "Category" c
            ON c."id" = p."categoryId"
          LEFT JOIN "Brand" b
            ON b."id" = p."brandId"
          WHERE ${Prisma.join(where, ' AND ')}
          GROUP BY
            oi."productId"
          ORDER BY
            "quantitySold" DESC,
            "netRevenue" DESC
          LIMIT ${limit}
        `,
    );

    if (actorId) {
      this.eventPublisher.publishReportViewed({
        report: 'top-products',
        actorId,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
        occurredAt: new Date(),
      });
    }

    return rows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      category: {
        id: row.categoryId,
        name: row.categoryName,
      },
      brand: {
        id: row.brandId,
        name: row.brandName,
      },
      quantitySold: this.toNumber(row.quantitySold),
      grossRevenue: this.toDecimalString(row.grossRevenue),
      netRevenue: this.toDecimalString(row.netRevenue),
    }));
  }

  async getProductPerformance(
    query: QueryAnalyticsDto,
  ): Promise<PaginatedResponse<unknown>> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const offset = (page - 1) * limit;

    const dateRange = this.parseDateRange(query);

    const where = this.buildProductWhere(query, dateRange);

    const orderBy = this.productOrderBy(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<ProductPerformanceRow[]>(
        Prisma.sql`
            SELECT
              p."id",
              p."name",
              p."sku",
              p."status"::text AS "status",
              p."isActive",
              p."price",
              p."viewCount",
              p."reviewCount",
              p."averageRating",
              p."createdAt",
              p."updatedAt",
              p."deleted_at" AS "deletedAt"
            FROM "Product" p
            WHERE ${Prisma.join(where, ' AND ')}
            ${orderBy}
            LIMIT ${limit}
            OFFSET ${offset}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Product" p
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return this.buildPaginatedResult(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        sku: row.sku,
        status: row.status,
        isActive: row.isActive,
        price: this.toDecimalString(row.price),
        viewCount: this.toNumber(row.viewCount),
        reviewCount: this.toNumber(row.reviewCount),
        averageRating: this.toDecimalString(row.averageRating ?? 0),
        createdAt: row.createdAt.toISOString(),
        createdAtFa: this.formatDate(row.createdAt),
        updatedAt: row.updatedAt.toISOString(),
        updatedAtFa: this.formatDate(row.updatedAt),
        deletedAt: row.deletedAt?.toISOString() ?? null,
        deletedAtFa: this.formatDate(row.deletedAt),
      })),
      total,
      page,
      limit,
    );
  }

  async getCustomerReport(
    query: QueryAnalyticsDto,
  ): Promise<PaginatedResponse<unknown>> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const offset = (page - 1) * limit;

    const dateRange = this.parseDateRange(query);

    const where = this.buildCustomerOrderWhere(query, dateRange);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<CustomerRow[]>(
        Prisma.sql`
            SELECT
              u."id" AS "userId",
              u."email",
              u."firstName",
              u."lastName",
              COUNT(o."id")::int AS "orders",
              COALESCE(SUM(o."totalAmount"), 0)::numeric AS "revenue",
              MAX(o."createdAt") AS "lastOrderAt",
              u."createdAt" AS "createdAt"
            FROM "User" u
            LEFT JOIN "Order" o
              ON o."userId" = u."id"
              AND o."deleted_at" IS NULL
            WHERE ${Prisma.join(where, ' AND ')}
            GROUP BY
              u."id",
              u."email",
              u."firstName",
              u."lastName",
              u."createdAt"
            ORDER BY
              "revenue" DESC,
              "orders" DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "User" u
            WHERE
              u."deleted_at" IS NULL
              AND u."status"::text <> 'DELETED'
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return this.buildPaginatedResult(
      rows.map((row) => ({
        userId: row.userId,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        fullName:
          [row.firstName, row.lastName].filter(Boolean).join(' ') || null,
        orders: this.toNumber(row.orders),
        revenue: this.toDecimalString(row.revenue),
        lastOrderAt: row.lastOrderAt?.toISOString() ?? null,
        lastOrderAtFa: this.formatDate(row.lastOrderAt),
        createdAt: row.createdAt.toISOString(),
        createdAtFa: this.formatDate(row.createdAt),
      })),
      total,
      page,
      limit,
    );
  }

  async findEvents(
    query: QueryAnalyticsDto,
  ): Promise<PaginatedResponse<unknown>> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const offset = (page - 1) * limit;

    const dateRange = this.parseDateRange(query);

    const where = this.buildEventWhere(query, dateRange);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AnalyticsEventRow[]>(
        Prisma.sql`
            SELECT
              e."id",
              e."name",
              e."description",
              e."category",
              e."timestamp",
              e."userId",
              e."data",
              e."createdAt",
              e."updatedAt",
              e."deleted_at" AS "deletedAt"
            FROM "Event" e
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              e."timestamp" DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Event" e
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return this.buildPaginatedResult(
      rows.map((row) => this.mapEvent(row)),
      total,
      page,
      limit,
    );
  }

  async findMetrics(
    query: QueryAnalyticsDto,
  ): Promise<PaginatedResponse<unknown>> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const offset = (page - 1) * limit;

    const dateRange = this.parseDateRange(query);

    const where = this.buildMetricWhere(query, dateRange);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<MetricRow[]>(
        Prisma.sql`
            SELECT
              m."id",
              m."name",
              m."value",
              m."unit",
              m."description",
              m."category",
              m."timestamp",
              m."createdAt",
              m."updatedAt",
              m."deleted_at" AS "deletedAt"
            FROM "Metric" m
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              m."timestamp" DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Metric" m
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return this.buildPaginatedResult(
      rows.map((row) => this.mapMetric(row)),
      total,
      page,
      limit,
    );
  }

  async recordEvent(dto: RecordEventDto, actorId?: string): Promise<unknown> {
    const timestamp = this.parseOptionalDate(dto.timestamp) ?? new Date();

    const now = new Date();

    const eventId = randomUUID();

    if (dto.userId) {
      await this.assertUserExists(dto.userId);
    }

    const rows = await this.prisma.$queryRaw<AnalyticsEventRow[]>(
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
            ${dto.name},
            ${dto.description ?? null},
            ${dto.category ?? null},
            ${timestamp},
            ${dto.userId ?? null},
            ${this.toJsonb(dto.data)},
            ${now},
            ${now}
          )
          RETURNING
            "id",
            "name",
            "description",
            "category",
            "timestamp",
            "userId",
            "data",
            "createdAt",
            "updatedAt",
            "deleted_at" AS "deletedAt"
        `,
    );

    const event = rows[0];

    if (!event) {
      throw new BadRequestException('رویداد تحلیلی ثبت نشد.');
    }

    this.eventPublisher.publishAnalyticsEventRecorded({
      eventId: event.id,
      name: event.name,
      category: event.category,
      userId: event.userId,
      data: this.toMetadataRecord(event.data),
      actorId,
      occurredAt: now,
    });

    return this.mapEvent(event);
  }

  async recordMetric(dto: RecordMetricDto, actorId?: string): Promise<unknown> {
    const timestamp = this.parseOptionalDate(dto.timestamp) ?? new Date();

    const now = new Date();

    const value = new Prisma.Decimal(dto.value);

    const metricId = randomUUID();

    const rows = await this.prisma.$queryRaw<MetricRow[]>(
      Prisma.sql`
          INSERT INTO "Metric" (
            "id",
            "name",
            "value",
            "unit",
            "description",
            "category",
            "timestamp",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${metricId},
            ${dto.name},
            ${value},
            ${dto.unit ?? null},
            ${dto.description ?? null},
            ${dto.category ?? null},
            ${timestamp},
            ${now},
            ${now}
          )
          RETURNING
            "id",
            "name",
            "value",
            "unit",
            "description",
            "category",
            "timestamp",
            "createdAt",
            "updatedAt",
            "deleted_at" AS "deletedAt"
        `,
    );

    const metric = rows[0];

    if (!metric) {
      throw new BadRequestException('متریک تحلیلی ثبت نشد.');
    }

    this.eventPublisher.publishAnalyticsMetricRecorded({
      metricId: metric.id,
      name: metric.name,
      value: this.toDecimalString(metric.value, 4),
      unit: metric.unit,
      category: metric.category,
      actorId,
      occurredAt: now,
    });

    return this.mapMetric(metric);
  }

  private buildOrderWhere(
    query: QueryAnalyticsDto,
    dateRange: DateRange,
  ): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (query.includeDeleted) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(Prisma.sql`o."deleted_at" IS NULL`);
    }

    if (dateRange.createdFrom) {
      where.push(Prisma.sql`o."createdAt" >= ${dateRange.createdFrom}`);
    }

    if (dateRange.createdTo) {
      where.push(Prisma.sql`o."createdAt" <= ${dateRange.createdTo}`);
    }

    if (query.currency) {
      where.push(Prisma.sql`o."currency" = ${query.currency}`);
    }

    if (query.userId) {
      where.push(Prisma.sql`o."userId" = ${query.userId}`);
    }

    return where;
  }

  private buildPaymentWhere(
    query: QueryAnalyticsDto,
    dateRange: DateRange,
  ): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (query.includeDeleted) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(Prisma.sql`p."deleted_at" IS NULL`);
    }

    if (dateRange.createdFrom) {
      where.push(Prisma.sql`p."createdAt" >= ${dateRange.createdFrom}`);
    }

    if (dateRange.createdTo) {
      where.push(Prisma.sql`p."createdAt" <= ${dateRange.createdTo}`);
    }

    if (query.currency) {
      where.push(Prisma.sql`p."currency" = ${query.currency}`);
    }

    if (query.userId) {
      where.push(Prisma.sql`p."userId" = ${query.userId}`);
    }

    return where;
  }

  private buildProductWhere(
    query: QueryAnalyticsDto,
    dateRange: DateRange,
  ): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (query.includeDeleted) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(Prisma.sql`p."deleted_at" IS NULL`);
    }

    if (query.productId) {
      where.push(Prisma.sql`p."id" = ${query.productId}`);
    }

    if (query.categoryId) {
      where.push(Prisma.sql`p."categoryId" = ${query.categoryId}`);
    }

    if (query.brandId) {
      where.push(Prisma.sql`p."brandId" = ${query.brandId}`);
    }

    if (dateRange.createdFrom) {
      where.push(Prisma.sql`p."createdAt" >= ${dateRange.createdFrom}`);
    }

    if (dateRange.createdTo) {
      where.push(Prisma.sql`p."createdAt" <= ${dateRange.createdTo}`);
    }

    return where;
  }

  private buildOrderItemWhere(
    query: QueryAnalyticsDto,
    dateRange: DateRange,
  ): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`o."deleted_at" IS NULL`];

    if (dateRange.createdFrom) {
      where.push(Prisma.sql`o."createdAt" >= ${dateRange.createdFrom}`);
    }

    if (dateRange.createdTo) {
      where.push(Prisma.sql`o."createdAt" <= ${dateRange.createdTo}`);
    }

    if (query.currency) {
      where.push(Prisma.sql`o."currency" = ${query.currency}`);
    }

    if (query.productId) {
      where.push(Prisma.sql`oi."productId" = ${query.productId}`);
    }

    if (query.categoryId) {
      where.push(Prisma.sql`p."categoryId" = ${query.categoryId}`);
    }

    if (query.brandId) {
      where.push(Prisma.sql`p."brandId" = ${query.brandId}`);
    }

    return where;
  }

  private buildCustomerWhere(
    query: QueryAnalyticsDto,
    dateRange: DateRange,
  ): Prisma.Sql[] {
    const where: Prisma.Sql[] = [
      Prisma.sql`u."deleted_at" IS NULL`,
      Prisma.sql`u."status"::text <> 'DELETED'`,
    ];

    if (dateRange.createdFrom) {
      where.push(Prisma.sql`u."createdAt" >= ${dateRange.createdFrom}`);
    }

    if (dateRange.createdTo) {
      where.push(Prisma.sql`u."createdAt" <= ${dateRange.createdTo}`);
    }

    if (query.userId) {
      where.push(Prisma.sql`u."id" = ${query.userId}`);
    }

    return where;
  }

  private buildCustomerOrderWhere(
    query: QueryAnalyticsDto,
    dateRange: DateRange,
  ): Prisma.Sql[] {
    const where: Prisma.Sql[] = [
      Prisma.sql`u."deleted_at" IS NULL`,
      Prisma.sql`u."status"::text <> 'DELETED'`,
    ];

    if (query.userId) {
      where.push(Prisma.sql`u."id" = ${query.userId}`);
    }

    if (dateRange.createdFrom) {
      where.push(
        Prisma.sql`
          (
            o."createdAt" IS NULL
            OR o."createdAt" >= ${dateRange.createdFrom}
          )
        `,
      );
    }

    if (dateRange.createdTo) {
      where.push(
        Prisma.sql`
          (
            o."createdAt" IS NULL
            OR o."createdAt" <= ${dateRange.createdTo}
          )
        `,
      );
    }

    return where;
  }

  private buildEventWhere(
    query: QueryAnalyticsDto,
    dateRange: DateRange,
  ): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (query.includeDeleted) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(Prisma.sql`e."deleted_at" IS NULL`);
    }

    if (query.userId) {
      where.push(Prisma.sql`e."userId" = ${query.userId}`);
    }

    if (dateRange.createdFrom) {
      where.push(Prisma.sql`e."timestamp" >= ${dateRange.createdFrom}`);
    }

    if (dateRange.createdTo) {
      where.push(Prisma.sql`e."timestamp" <= ${dateRange.createdTo}`);
    }

    return where;
  }

  private buildMetricWhere(
    query: QueryAnalyticsDto,
    dateRange: DateRange,
  ): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (query.includeDeleted) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(Prisma.sql`m."deleted_at" IS NULL`);
    }

    if (dateRange.createdFrom) {
      where.push(Prisma.sql`m."timestamp" >= ${dateRange.createdFrom}`);
    }

    if (dateRange.createdTo) {
      where.push(Prisma.sql`m."timestamp" <= ${dateRange.createdTo}`);
    }

    return where;
  }

  private groupPeriodSql(groupBy: GroupByValue): Prisma.Sql {
    if (groupBy === 'week') {
      return Prisma.sql`DATE_TRUNC('week', o."createdAt")`;
    }

    if (groupBy === 'month') {
      return Prisma.sql`DATE_TRUNC('month', o."createdAt")`;
    }

    if (groupBy === 'year') {
      return Prisma.sql`DATE_TRUNC('year', o."createdAt")`;
    }

    return Prisma.sql`DATE_TRUNC('day', o."createdAt")`;
  }

  private productOrderBy(query: QueryAnalyticsDto): Prisma.Sql {
    const direction =
      query.sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    if (query.sortBy === 'views') {
      return Prisma.sql`ORDER BY p."viewCount" ${direction}`;
    }

    if (query.sortBy === 'rating') {
      return Prisma.sql`ORDER BY p."averageRating" ${direction} NULLS LAST`;
    }

    return Prisma.sql`ORDER BY p."createdAt" ${direction}`;
  }

  private async assertUserExists(userId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "User" u
          WHERE
            u."id" = ${userId}
            AND u."deleted_at" IS NULL
            AND u."status"::text <> 'DELETED'
        `,
    );

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException('کاربر موردنظر یافت نشد.');
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

  private normalizeGroupBy(groupBy?: string): GroupByValue {
    if (
      groupBy === 'day' ||
      groupBy === 'week' ||
      groupBy === 'month' ||
      groupBy === 'year'
    ) {
      return groupBy;
    }

    return 'day';
  }

  private parseDateRange(query: QueryAnalyticsDto): DateRange {
    const createdFrom = this.parseOptionalDate(query.createdFrom);

    const createdTo = this.parseOptionalDate(query.createdTo);

    if (
      createdFrom &&
      createdTo &&
      createdFrom.getTime() > createdTo.getTime()
    ) {
      throw new BadRequestException(
        'تاریخ شروع گزارش نمی‌تواند بعد از تاریخ پایان باشد.',
      );
    }

    return {
      createdFrom,
      createdTo,
    };
  }

  private parseOptionalDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('مقدار تاریخ معتبر نیست.');
    }

    return date;
  }

  private mapEvent(row: AnalyticsEventRow): Record<string, unknown> {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      timestamp: row.timestamp.toISOString(),
      timestampFa: this.formatDate(row.timestamp),
      userId: row.userId,
      data: row.data,
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDate(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDate(row.updatedAt),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      deletedAtFa: this.formatDate(row.deletedAt),
    };
  }

  private mapMetric(row: MetricRow): Record<string, unknown> {
    return {
      id: row.id,
      name: row.name,
      value: this.toDecimalString(row.value, 4),
      unit: row.unit,
      description: row.description,
      category: row.category,
      timestamp: row.timestamp.toISOString(),
      timestampFa: this.formatDate(row.timestamp),
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDate(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDate(row.updatedAt),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      deletedAtFa: this.formatDate(row.deletedAt),
    };
  }

  private buildPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponse<T> {
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  private toJsonb(value?: Record<string, unknown>): Prisma.Sql {
    if (value === undefined || value === null) {
      return Prisma.sql`NULL`;
    }

    return Prisma.sql`${JSON.stringify(value)}::jsonb`;
  }

  private toMetadataRecord(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value;
  }

  private toNumber(value: number | bigint | null | undefined): number {
    if (value === null || value === undefined) {
      return 0;
    }

    return Number(value);
  }

  private toDecimalString(
    value: Prisma.Decimal | number | string | null,
    scale = 2,
  ): string {
    if (value === null) {
      return Number(0).toFixed(scale);
    }

    if (value instanceof Prisma.Decimal) {
      return value.toFixed(scale);
    }

    return new Prisma.Decimal(value).toFixed(scale);
  }

  private formatDate(value: Date | null): string | null {
    return formatPersianDateTime(value);
  }
}
