import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminActivityQueryDto } from '../dto/admin-activity-query.dto';

import { AdminDashboardQueryDto } from '../dto/admin-dashboard-query.dto';

import { AdminEventPublisher } from '../events/admin.event.publisher';

type CountRow = {
  count: number;
};

type DatabaseNowRow = {
  now: Date;
};

type OrderSummaryRow = {
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
  totalRevenue: Prisma.Decimal | null;
  averageOrderValue: Prisma.Decimal | null;
};

type PaymentSummaryRow = {
  totalPayments: number;
  pendingPayments: number;
  completedPayments: number;
  failedPayments: number;
  refundedPayments: number;
  partialRefundedPayments: number;
  paidAmount: Prisma.Decimal | null;
  refundedAmount: Prisma.Decimal | null;
};

type ProductSummaryRow = {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  draftProducts: number;
  totalViews: number;
  averageRating: Prisma.Decimal | null;
};

type UserSummaryRow = {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  newUsersLast30Days: number;
};

type InventorySummaryRow = {
  totalVariants: number;
  lowStockVariants: number;
  outOfStockVariants: number;
  totalAvailableStock: number;
};

type OperationalSummaryRow = {
  totalRefunds: number;
  pendingRefunds: number;
  completedRefunds: number;
  totalInvoices: number;
  pendingInvoices: number;
  paidInvoices: number;
  unreadNotifications: number;
};

type RecentOrderRow = {
  id: string;
  orderNumber: string;
  userId: string;
  userEmail: string | null;
  status: string;
  paymentStatus: string;
  totalAmount: Prisma.Decimal;
  currency: string;
  createdAt: Date;
};

type RecentPaymentRow = {
  id: string;
  orderId: string;
  userId: string;
  userEmail: string | null;
  amount: Prisma.Decimal;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  transactionId: string | null;
  createdAt: Date;
};

type RecentUserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  createdAt: Date;
};

type RecentNotificationRow = {
  id: string;
  userId: string;
  userEmail: string | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
};

type AdminActivityRow = {
  source: string;
  id: string;
  title: string;
  description: string | null;
  userId: string | null;
  amount: Prisma.Decimal | null;
  currency: string | null;
  status: string | null;
  occurredAt: Date;
};

type HealthMetricRow = {
  failedPaymentsLast24h: number;
  stalePendingOrders: number;
  lowStockVariants: number;
  unreadNotifications: number;
};

type PaginatedResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

@Injectable()
export class AdminService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: AdminEventPublisher,
  ) {}

  async getDashboard(query: AdminDashboardQueryDto, actorId: string) {
    const [
      orderRows,
      paymentRows,
      productRows,
      userRows,
      inventoryRows,
      operationalRows,
    ] = await Promise.all([
      this.getOrderSummary(query),
      this.getPaymentSummary(query),
      this.getProductSummary(query),
      this.getUserSummary(query),
      this.getInventorySummary(),
      this.getOperationalSummary(query),
    ]);

    this.events.publishDashboardViewed({
      actorId,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      currency: query.currency,
      occurredAt: new Date(),
    });

    const orders = orderRows[0];

    const payments = paymentRows[0];

    const products = productRows[0];

    const users = userRows[0];

    const inventory = inventoryRows[0];

    const operations = operationalRows[0];

    return {
      orders: {
        total: orders?.totalOrders ?? 0,
        pending: orders?.pendingOrders ?? 0,
        processing: orders?.processingOrders ?? 0,
        shipped: orders?.shippedOrders ?? 0,
        delivered: orders?.deliveredOrders ?? 0,
        cancelled: orders?.cancelledOrders ?? 0,
        refunded: orders?.refundedOrders ?? 0,
        totalRevenue: this.toDecimalString(orders?.totalRevenue ?? 0),
        averageOrderValue: this.toDecimalString(orders?.averageOrderValue ?? 0),
      },
      payments: {
        total: payments?.totalPayments ?? 0,
        pending: payments?.pendingPayments ?? 0,
        completed: payments?.completedPayments ?? 0,
        failed: payments?.failedPayments ?? 0,
        refunded: payments?.refundedPayments ?? 0,
        partialRefunded: payments?.partialRefundedPayments ?? 0,
        paidAmount: this.toDecimalString(payments?.paidAmount ?? 0),
        refundedAmount: this.toDecimalString(payments?.refundedAmount ?? 0),
      },
      products: {
        total: products?.totalProducts ?? 0,
        active: products?.activeProducts ?? 0,
        inactive: products?.inactiveProducts ?? 0,
        draft: products?.draftProducts ?? 0,
        totalViews: products?.totalViews ?? 0,
        averageRating: this.toDecimalString(products?.averageRating ?? 0),
      },
      users: {
        total: users?.totalUsers ?? 0,
        active: users?.activeUsers ?? 0,
        suspended: users?.suspendedUsers ?? 0,
        newLast30Days: users?.newUsersLast30Days ?? 0,
      },
      inventory: {
        totalVariants: inventory?.totalVariants ?? 0,
        lowStockVariants: inventory?.lowStockVariants ?? 0,
        outOfStockVariants: inventory?.outOfStockVariants ?? 0,
        totalAvailableStock: inventory?.totalAvailableStock ?? 0,
      },
      operations: {
        totalRefunds: operations?.totalRefunds ?? 0,
        pendingRefunds: operations?.pendingRefunds ?? 0,
        completedRefunds: operations?.completedRefunds ?? 0,
        totalInvoices: operations?.totalInvoices ?? 0,
        pendingInvoices: operations?.pendingInvoices ?? 0,
        paidInvoices: operations?.paidInvoices ?? 0,
        unreadNotifications: operations?.unreadNotifications ?? 0,
      },
    };
  }

  async getOverview(query: AdminDashboardQueryDto, actorId: string) {
    const dashboard = await this.getDashboard(query, actorId);

    const [recentOrders, recentPayments, recentUsers, recentNotifications] =
      await Promise.all([
        this.getRecentOrders(query),
        this.getRecentPayments(query),
        this.getRecentUsers(),
        this.getRecentNotifications(),
      ]);

    this.events.publishOverviewViewed({
      actorId,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      currency: query.currency,
      occurredAt: new Date(),
    });

    return {
      dashboard,
      recent: {
        orders: recentOrders,
        payments: recentPayments,
        users: recentUsers,
        notifications: recentNotifications,
      },
    };
  }

  async getRecentOrders(query: AdminDashboardQueryDto) {
    const where = this.buildOrderWhere(query);

    const rows = await this.prisma.$queryRaw<RecentOrderRow[]>(
      Prisma.sql`
          SELECT
            o."id",
            o."orderNumber",
            o."userId",
            u."email" AS "userEmail",
            o."status"::text AS "status",
            o."paymentStatus"::text AS "paymentStatus",
            o."totalAmount",
            o."currency",
            o."createdAt"
          FROM "Order" o
          LEFT JOIN "User" u
            ON u."id" = o."userId"
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            o."createdAt" DESC
          LIMIT 10
        `,
    );

    return rows.map((row) => ({
      ...row,
      totalAmount: this.toDecimalString(row.totalAmount),
    }));
  }

  async getRecentPayments(query: AdminDashboardQueryDto) {
    const where = this.buildPaymentWhere(query);

    const rows = await this.prisma.$queryRaw<RecentPaymentRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."orderId",
            p."userId",
            u."email" AS "userEmail",
            p."amount",
            p."currency",
            p."paymentMethod"::text AS "paymentMethod",
            p."paymentStatus"::text AS "paymentStatus",
            p."transactionId",
            p."createdAt"
          FROM "Payment" p
          LEFT JOIN "User" u
            ON u."id" = p."userId"
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            p."createdAt" DESC
          LIMIT 10
        `,
    );

    return rows.map((row) => ({
      ...row,
      amount: this.toDecimalString(row.amount),
    }));
  }

  async getRecentUsers() {
    return this.prisma.$queryRaw<RecentUserRow[]>(
      Prisma.sql`
        SELECT
          u."id",
          u."email",
          u."firstName",
          u."lastName",
          u."status"::text AS "status",
          u."createdAt"
        FROM "User" u
        WHERE
          u."deleted_at" IS NULL
          AND u."status"::text <> 'DELETED'
        ORDER BY
          u."createdAt" DESC
        LIMIT 10
      `,
    );
  }

  async getRecentNotifications() {
    return this.prisma.$queryRaw<RecentNotificationRow[]>(
      Prisma.sql`
        SELECT
          n."id",
          n."userId",
          u."email" AS "userEmail",
          n."type"::text AS "type",
          n."title",
          n."message",
          n."isRead",
          n."createdAt"
        FROM "Notification" n
        LEFT JOIN "User" u
          ON u."id" = n."userId"
        WHERE
          n."deleted_at" IS NULL
          AND n."isActive" = TRUE
        ORDER BY
          n."createdAt" DESC
        LIMIT 10
      `,
    );
  }

  async getActivity(
    query: AdminActivityQueryDto,
    actorId: string,
  ): Promise<PaginatedResponse<unknown>> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const offset = (page - 1) * limit;

    const where = this.buildActivityWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AdminActivityRow[]>(
        Prisma.sql`
            SELECT *
            FROM (
              ${this.activityUnionSql()}
            ) activity
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              activity."occurredAt" DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM (
              ${this.activityUnionSql()}
            ) activity
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = countRows[0]?.count ?? 0;

    this.events.publishActivityViewed({
      actorId,
      source: query.source,
      page,
      limit,
      occurredAt: new Date(),
    });

    return {
      data: rows.map((row) => ({
        ...row,
        amount: row.amount === null ? null : this.toDecimalString(row.amount),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getHealth(actorId: string) {
    const [nowRows, metricRows] = await Promise.all([
      this.prisma.$queryRaw<DatabaseNowRow[]>(
        Prisma.sql`
            SELECT NOW() AS "now"
          `,
      ),
      this.prisma.$queryRaw<HealthMetricRow[]>(
        Prisma.sql`
            SELECT
              (
                SELECT
                  COUNT(*)::int
                FROM "Payment" p
                WHERE
                  p."deleted_at" IS NULL
                  AND p."paymentStatus" = 'FAILED'::"PaymentStatus"
                  AND p."createdAt" >= NOW() - INTERVAL '24 hours'
              ) AS "failedPaymentsLast24h",
              (
                SELECT
                  COUNT(*)::int
                FROM "Order" o
                WHERE
                  o."deleted_at" IS NULL
                  AND o."status" = 'PENDING'::"OrderStatus"
                  AND o."createdAt" <= NOW() - INTERVAL '48 hours'
              ) AS "stalePendingOrders",
              (
                SELECT
                  COUNT(*)::int
                FROM (
                  SELECT
                    v."id",
                    COALESCE(SUM(i."quantity" - i."reservedQuantity"), 0)::int AS "available"
                  FROM "ProductVariant" v
                  LEFT JOIN "Inventory" i
                    ON i."variantId" = v."id"
                    AND i."deleted_at" IS NULL
                  WHERE
                    v."deleted_at" IS NULL
                    AND v."isActive" = TRUE
                  GROUP BY
                    v."id"
                  HAVING
                    COALESCE(SUM(i."quantity" - i."reservedQuantity"), 0)::int BETWEEN 1 AND 5
                ) low_stock
              ) AS "lowStockVariants",
              (
                SELECT
                  COUNT(*)::int
                FROM "Notification" n
                WHERE
                  n."deleted_at" IS NULL
                  AND n."isActive" = TRUE
                  AND n."isRead" = FALSE
              ) AS "unreadNotifications"
          `,
      ),
    ]);

    const metrics = metricRows[0];

    const warningCount =
      (metrics?.failedPaymentsLast24h ?? 0) +
      (metrics?.stalePendingOrders ?? 0) +
      (metrics?.lowStockVariants ?? 0);

    const status =
      warningCount >= 20
        ? 'critical'
        : warningCount > 0
          ? 'warning'
          : 'healthy';

    this.events.publishHealthChecked({
      actorId,
      status,
      occurredAt: new Date(),
    });

    return {
      status,
      database: {
        connected: true,
        now: nowRows[0]?.now ?? new Date(),
      },
      checks: {
        failedPaymentsLast24h: metrics?.failedPaymentsLast24h ?? 0,
        stalePendingOrders: metrics?.stalePendingOrders ?? 0,
        lowStockVariants: metrics?.lowStockVariants ?? 0,
        unreadNotifications: metrics?.unreadNotifications ?? 0,
      },
    };
  }

  private async getOrderSummary(
    query: AdminDashboardQueryDto,
  ): Promise<OrderSummaryRow[]> {
    const where = this.buildOrderWhere(query);

    return this.prisma.$queryRaw<OrderSummaryRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "totalOrders",
          COUNT(*) FILTER (
            WHERE o."status" = 'PENDING'::"OrderStatus"
          )::int AS "pendingOrders",
          COUNT(*) FILTER (
            WHERE o."status" = 'PROCESSING'::"OrderStatus"
          )::int AS "processingOrders",
          COUNT(*) FILTER (
            WHERE o."status" = 'SHIPPED'::"OrderStatus"
          )::int AS "shippedOrders",
          COUNT(*) FILTER (
            WHERE o."status" = 'DELIVERED'::"OrderStatus"
          )::int AS "deliveredOrders",
          COUNT(*) FILTER (
            WHERE o."status" = 'CANCELLED'::"OrderStatus"
          )::int AS "cancelledOrders",
          COUNT(*) FILTER (
            WHERE o."status" = 'REFUNDED'::"OrderStatus"
          )::int AS "refundedOrders",
          COALESCE(SUM(o."totalAmount"), 0)::numeric AS "totalRevenue",
          COALESCE(AVG(o."totalAmount"), 0)::numeric AS "averageOrderValue"
        FROM "Order" o
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private async getPaymentSummary(
    query: AdminDashboardQueryDto,
  ): Promise<PaymentSummaryRow[]> {
    const where = this.buildPaymentWhere(query);

    return this.prisma.$queryRaw<PaymentSummaryRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "totalPayments",
          COUNT(*) FILTER (
            WHERE p."paymentStatus" = 'PENDING'::"PaymentStatus"
          )::int AS "pendingPayments",
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
          ), 0)::numeric AS "paidAmount",
          COALESCE(SUM(p."amount") FILTER (
            WHERE p."paymentStatus" IN (
              'REFUNDED'::"PaymentStatus",
              'PARTIAL_REFUNDED'::"PaymentStatus"
            )
          ), 0)::numeric AS "refundedAmount"
        FROM "Payment" p
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private async getProductSummary(
    query: AdminDashboardQueryDto,
  ): Promise<ProductSummaryRow[]> {
    const where = this.buildProductWhere(query);

    return this.prisma.$queryRaw<ProductSummaryRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "totalProducts",
          COUNT(*) FILTER (
            WHERE p."isActive" = TRUE
          )::int AS "activeProducts",
          COUNT(*) FILTER (
            WHERE p."isActive" = FALSE
          )::int AS "inactiveProducts",
          COUNT(*) FILTER (
            WHERE p."status" = 'DRAFT'::"ProductStatus"
          )::int AS "draftProducts",
          COALESCE(SUM(p."viewCount"), 0)::int AS "totalViews",
          COALESCE(AVG(p."averageRating"), 0)::numeric AS "averageRating"
        FROM "Product" p
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private async getUserSummary(
    query: AdminDashboardQueryDto,
  ): Promise<UserSummaryRow[]> {
    const where = this.buildUserWhere(query);

    return this.prisma.$queryRaw<UserSummaryRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "totalUsers",
          COUNT(*) FILTER (
            WHERE u."status" = 'ACTIVE'::"UserStatus"
          )::int AS "activeUsers",
          COUNT(*) FILTER (
            WHERE u."status" = 'SUSPENDED'::"UserStatus"
          )::int AS "suspendedUsers",
          COUNT(*) FILTER (
            WHERE u."createdAt" >= NOW() - INTERVAL '30 days'
          )::int AS "newUsersLast30Days"
        FROM "User" u
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private async getInventorySummary(): Promise<InventorySummaryRow[]> {
    return this.prisma.$queryRaw<InventorySummaryRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "totalVariants",
          COUNT(*) FILTER (
            WHERE stock."available" BETWEEN 1 AND 5
          )::int AS "lowStockVariants",
          COUNT(*) FILTER (
            WHERE stock."available" <= 0
          )::int AS "outOfStockVariants",
          COALESCE(SUM(stock."available"), 0)::int AS "totalAvailableStock"
        FROM (
          SELECT
            v."id",
            COALESCE(SUM(i."quantity" - i."reservedQuantity"), 0)::int AS "available"
          FROM "ProductVariant" v
          LEFT JOIN "Inventory" i
            ON i."variantId" = v."id"
            AND i."deleted_at" IS NULL
          WHERE
            v."deleted_at" IS NULL
            AND v."isActive" = TRUE
          GROUP BY
            v."id"
        ) stock
      `,
    );
  }

  private async getOperationalSummary(
    query: AdminDashboardQueryDto,
  ): Promise<OperationalSummaryRow[]> {
    const refundWhere = this.buildRefundWhere(query);

    const invoiceWhere = this.buildInvoiceWhere(query);

    return this.prisma.$queryRaw<OperationalSummaryRow[]>(
      Prisma.sql`
        SELECT
          (
            SELECT
              COUNT(*)::int
            FROM "Refund" r
            WHERE ${Prisma.join(refundWhere, ' AND ')}
          ) AS "totalRefunds",
          (
            SELECT
              COUNT(*)::int
            FROM "Refund" r
            WHERE
              ${Prisma.join(refundWhere, ' AND ')}
              AND r."status" = 'PENDING'::"RefundStatus"
          ) AS "pendingRefunds",
          (
            SELECT
              COUNT(*)::int
            FROM "Refund" r
            WHERE
              ${Prisma.join(refundWhere, ' AND ')}
              AND r."status" = 'COMPLETED'::"RefundStatus"
          ) AS "completedRefunds",
          (
            SELECT
              COUNT(*)::int
            FROM "Invoice" i
            WHERE ${Prisma.join(invoiceWhere, ' AND ')}
          ) AS "totalInvoices",
          (
            SELECT
              COUNT(*)::int
            FROM "Invoice" i
            WHERE
              ${Prisma.join(invoiceWhere, ' AND ')}
              AND i."status" = 'PENDING'::"InvoiceStatus"
          ) AS "pendingInvoices",
          (
            SELECT
              COUNT(*)::int
            FROM "Invoice" i
            WHERE
              ${Prisma.join(invoiceWhere, ' AND ')}
              AND i."status" = 'PAID'::"InvoiceStatus"
          ) AS "paidInvoices",
          (
            SELECT
              COUNT(*)::int
            FROM "Notification" n
            WHERE
              n."deleted_at" IS NULL
              AND n."isActive" = TRUE
              AND n."isRead" = FALSE
          ) AS "unreadNotifications"
      `,
    );
  }

  private activityUnionSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        'orders'::text AS "source",
        o."id" AS "id",
        CONCAT('Order ', o."orderNumber") AS "title",
        o."status"::text AS "description",
        o."userId" AS "userId",
        o."totalAmount" AS "amount",
        o."currency" AS "currency",
        o."status"::text AS "status",
        o."createdAt" AS "occurredAt"
      FROM "Order" o
      WHERE o."deleted_at" IS NULL

      UNION ALL

      SELECT
        'payments'::text AS "source",
        p."id" AS "id",
        CONCAT('Payment ', p."paymentStatus"::text) AS "title",
        p."paymentMethod"::text AS "description",
        p."userId" AS "userId",
        p."amount" AS "amount",
        p."currency" AS "currency",
        p."paymentStatus"::text AS "status",
        p."createdAt" AS "occurredAt"
      FROM "Payment" p
      WHERE p."deleted_at" IS NULL

      UNION ALL

      SELECT
        'refunds'::text AS "source",
        r."id" AS "id",
        CONCAT('Refund ', r."status"::text) AS "title",
        r."reason" AS "description",
        p."userId" AS "userId",
        r."amount" AS "amount",
        p."currency" AS "currency",
        r."status"::text AS "status",
        r."createdAt" AS "occurredAt"
      FROM "Refund" r
      LEFT JOIN "Payment" p
        ON p."id" = r."paymentId"
      WHERE r."deleted_at" IS NULL

      UNION ALL

      SELECT
        'invoices'::text AS "source",
        i."id" AS "id",
        CONCAT('Invoice ', i."invoiceNumber") AS "title",
        i."status"::text AS "description",
        o."userId" AS "userId",
        i."amount" AS "amount",
        i."currency" AS "currency",
        i."status"::text AS "status",
        i."createdAt" AS "occurredAt"
      FROM "Invoice" i
      LEFT JOIN "Order" o
        ON o."id" = i."orderId"
      WHERE i."deleted_at" IS NULL

      UNION ALL

      SELECT
        'notifications'::text AS "source",
        n."id" AS "id",
        n."title" AS "title",
        n."message" AS "description",
        n."userId" AS "userId",
        NULL::numeric AS "amount",
        NULL::text AS "currency",
        n."type"::text AS "status",
        n."createdAt" AS "occurredAt"
      FROM "Notification" n
      WHERE
        n."deleted_at" IS NULL
        AND n."isActive" = TRUE

      UNION ALL

      SELECT
        'users'::text AS "source",
        u."id" AS "id",
        CONCAT('User ', u."email") AS "title",
        u."status"::text AS "description",
        u."id" AS "userId",
        NULL::numeric AS "amount",
        NULL::text AS "currency",
        u."status"::text AS "status",
        u."createdAt" AS "occurredAt"
      FROM "User" u
      WHERE
        u."deleted_at" IS NULL
        AND u."status"::text <> 'DELETED'
    `;
  }

  private buildOrderWhere(query: AdminDashboardQueryDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (query.includeDeleted) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(Prisma.sql`o."deleted_at" IS NULL`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`o."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`o."createdAt" <= ${new Date(query.createdTo)}`);
    }

    if (query.currency) {
      where.push(Prisma.sql`o."currency" = ${query.currency}`);
    }

    return where;
  }

  private buildPaymentWhere(query: AdminDashboardQueryDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (query.includeDeleted) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(Prisma.sql`p."deleted_at" IS NULL`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`p."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`p."createdAt" <= ${new Date(query.createdTo)}`);
    }

    if (query.currency) {
      where.push(Prisma.sql`p."currency" = ${query.currency}`);
    }

    return where;
  }

  private buildProductWhere(query: AdminDashboardQueryDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (query.includeDeleted) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(Prisma.sql`p."deleted_at" IS NULL`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`p."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`p."createdAt" <= ${new Date(query.createdTo)}`);
    }

    return where;
  }

  private buildUserWhere(query: AdminDashboardQueryDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (query.includeDeleted) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(
        Prisma.sql`
          u."deleted_at" IS NULL
          AND u."status"::text <> 'DELETED'
        `,
      );
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`u."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`u."createdAt" <= ${new Date(query.createdTo)}`);
    }

    return where;
  }

  private buildRefundWhere(query: AdminDashboardQueryDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (query.includeDeleted) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(Prisma.sql`r."deleted_at" IS NULL`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`r."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`r."createdAt" <= ${new Date(query.createdTo)}`);
    }

    return where;
  }

  private buildInvoiceWhere(query: AdminDashboardQueryDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (query.includeDeleted) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(Prisma.sql`i."deleted_at" IS NULL`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`i."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`i."createdAt" <= ${new Date(query.createdTo)}`);
    }

    if (query.currency) {
      where.push(Prisma.sql`i."currency" = ${query.currency}`);
    }

    return where;
  }

  private buildActivityWhere(query: AdminActivityQueryDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (query.source && query.source !== 'all') {
      where.push(Prisma.sql`activity."source" = ${query.source}`);
    } else {
      where.push(Prisma.sql`TRUE`);
    }

    if (query.createdFrom) {
      where.push(
        Prisma.sql`activity."occurredAt" >= ${new Date(query.createdFrom)}`,
      );
    }

    if (query.createdTo) {
      where.push(
        Prisma.sql`activity."occurredAt" <= ${new Date(query.createdTo)}`,
      );
    }

    return where;
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
}
