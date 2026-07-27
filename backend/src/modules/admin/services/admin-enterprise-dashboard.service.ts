import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminEnterpriseDashboardQueryDto } from '../dto/admin-enterprise-dashboard-query.dto';

type OrderKpiRow = {
  totalOrders: number | bigint;
  pendingOrders: number | bigint;
  confirmedOrders: number | bigint;
  processingOrders: number | bigint;
  shippedOrders: number | bigint;
  deliveredOrders: number | bigint;
  cancelledOrders: number | bigint;
  refundedOrders: number | bigint;
  stalePendingOrders: number | bigint;
  grossOrderAmount: Prisma.Decimal | number | string | null;
  averageOrderAmount: Prisma.Decimal | number | string | null;
};

type PaymentKpiRow = {
  totalPayments: number | bigint;
  pendingPayments: number | bigint;
  completedPayments: number | bigint;
  failedPayments: number | bigint;
  refundedPayments: number | bigint;
  partialRefundedPayments: number | bigint;
  completedAmount: Prisma.Decimal | number | string | null;
  refundedLikeAmount: Prisma.Decimal | number | string | null;
  failedAmount: Prisma.Decimal | number | string | null;
};

type RefundKpiRow = {
  totalRefunds: number | bigint;
  pendingRefunds: number | bigint;
  processingRefunds: number | bigint;
  completedRefunds: number | bigint;
  failedRefunds: number | bigint;
  totalRefundAmount: Prisma.Decimal | number | string | null;
  completedRefundAmount: Prisma.Decimal | number | string | null;
};

type InvoiceKpiRow = {
  totalInvoices: number | bigint;
  pendingInvoices: number | bigint;
  paidInvoices: number | bigint;
  overdueInvoices: number | bigint;
  cancelledInvoices: number | bigint;
  totalInvoiceAmount: Prisma.Decimal | number | string | null;
  paidInvoiceAmount: Prisma.Decimal | number | string | null;
};

type ProductKpiRow = {
  totalProducts: number | bigint;
  activeProducts: number | bigint;
  draftProducts: number | bigint;
  inactiveProducts: number | bigint;
  archivedProducts: number | bigint;
  totalViews: number | bigint;
  averageRating: Prisma.Decimal | number | string | null;
};

type UserKpiRow = {
  totalUsers: number | bigint;
  activeUsers: number | bigint;
  inactiveUsers: number | bigint;
  suspendedUsers: number | bigint;
  newUsers: number | bigint;
};

type InventoryKpiRow = {
  totalInventoryRows: number | bigint;
  totalQuantity: number | bigint;
  totalReservedQuantity: number | bigint;
  totalAvailableQuantity: number | bigint;
  lowStockRows: number | bigint;
  outOfStockRows: number | bigint;
};

type NotificationKpiRow = {
  totalNotifications: number | bigint;
  unreadNotifications: number | bigint;
  systemNotifications: number | bigint;
};

type AuditKpiRow = {
  totalAuditLogs: number | bigint;
  warningAuditLogs: number | bigint;
  errorAuditLogs: number | bigint;
  criticalAuditLogs: number | bigint;
  sensitiveAuditLogs: number | bigint;
};

type DailyMetricRow = {
  day: Date;
  count: number | bigint;
  amount?: Prisma.Decimal | number | string | null;
};

type RecentSensitiveAuditRow = {
  id: string;
  action: string;
  description: string | null;
  category: string | null;
  severity: string | null;
  entityType: string | null;
  entityId: string | null;
  actorId: string | null;
  occurredAt: Date;
};

type EnterpriseDashboardResponse = {
  meta: {
    generatedAt: string;
    requestedBy: string;
    currency: string | null;
    createdFrom: string | null;
    createdTo: string | null;
    chartDays: number;
  };
  kpis: {
    orders: {
      total: number;
      pending: number;
      confirmed: number;
      processing: number;
      shipped: number;
      delivered: number;
      cancelled: number;
      refunded: number;
      stalePending: number;
      grossAmount: string;
      averageAmount: string;
    };
    payments: {
      total: number;
      pending: number;
      completed: number;
      failed: number;
      refunded: number;
      partialRefunded: number;
      completedAmount: string;
      refundedLikeAmount: string;
      failedAmount: string;
    };
    refunds: {
      total: number;
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      totalAmount: string;
      completedAmount: string;
    };
    invoices: {
      total: number;
      pending: number;
      paid: number;
      overdue: number;
      cancelled: number;
      totalAmount: string;
      paidAmount: string;
    };
    products: {
      total: number;
      active: number;
      draft: number;
      inactive: number;
      archived: number;
      totalViews: number;
      averageRating: string;
    };
    users: {
      total: number;
      active: number;
      inactive: number;
      suspended: number;
      newUsers: number;
    };
    inventory: {
      totalRows: number;
      totalQuantity: number;
      reservedQuantity: number;
      availableQuantity: number;
      lowStockRows: number;
      outOfStockRows: number;
    };
    notifications: {
      total: number;
      unread: number;
      system: number;
    };
    audit: {
      total: number;
      warning: number;
      error: number;
      critical: number;
      sensitive: number;
    };
  };
  risk: {
    score: number;
    level: 'low' | 'medium' | 'high' | 'critical';
    signals: string[];
  };
  charts: {
    dailyOrders: Array<{
      day: string;
      count: number;
    }>;
    dailyRevenue: Array<{
      day: string;
      amount: string;
    }>;
    dailyAudit: Array<{
      day: string;
      count: number;
    }>;
  };
  recentSensitiveAudits: Array<{
    id: string;
    action: string;
    description: string | null;
    category: string | null;
    severity: string;
    entityType: string | null;
    entityId: string | null;
    actorId: string | null;
    occurredAt: string;
  }>;
};

@Injectable()
export class AdminEnterpriseDashboardService {
  private readonly defaultChartDays = 30;

  constructor(private readonly prisma: PrismaService) {}

  async getEnterpriseDashboard(
    query: AdminEnterpriseDashboardQueryDto,
    actorId: string,
  ): Promise<EnterpriseDashboardResponse> {
    const createdFrom = this.parseOptionalDate(query.createdFrom);

    const createdTo = this.parseOptionalDate(query.createdTo);

    if (
      createdFrom &&
      createdTo &&
      createdFrom.getTime() > createdTo.getTime()
    ) {
      throw new BadRequestException(
        'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.',
      );
    }

    const chartDays = query.chartDays ?? this.defaultChartDays;

    const [
      orderRows,
      paymentRows,
      refundRows,
      invoiceRows,
      productRows,
      userRows,
      inventoryRows,
      notificationRows,
      auditRows,
      dailyOrderRows,
      dailyRevenueRows,
      dailyAuditRows,
      recentSensitiveAuditRows,
    ] = await Promise.all([
      this.getOrderKpis(query, createdFrom, createdTo),
      this.getPaymentKpis(query, createdFrom, createdTo),
      this.getRefundKpis(query, createdFrom, createdTo),
      this.getInvoiceKpis(query, createdFrom, createdTo),
      this.getProductKpis(createdFrom, createdTo),
      this.getUserKpis(createdFrom, createdTo),
      this.getInventoryKpis(),
      this.getNotificationKpis(createdFrom, createdTo),
      this.getAuditKpis(createdFrom, createdTo),
      this.getDailyOrders(chartDays, query.currency),
      this.getDailyRevenue(chartDays, query.currency),
      this.getDailyAudit(chartDays),
      this.getRecentSensitiveAudits(),
    ]);

    const orders = orderRows[0] ?? this.emptyOrderKpis();

    const payments = paymentRows[0] ?? this.emptyPaymentKpis();

    const refunds = refundRows[0] ?? this.emptyRefundKpis();

    const invoices = invoiceRows[0] ?? this.emptyInvoiceKpis();

    const products = productRows[0] ?? this.emptyProductKpis();

    const users = userRows[0] ?? this.emptyUserKpis();

    const inventory = inventoryRows[0] ?? this.emptyInventoryKpis();

    const notifications = notificationRows[0] ?? this.emptyNotificationKpis();

    const audit = auditRows[0] ?? this.emptyAuditKpis();

    const risk = this.buildRisk({
      orders,
      payments,
      refunds,
      inventory,
      notifications,
      audit,
    });

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        requestedBy: actorId,
        currency: query.currency ?? null,
        createdFrom: createdFrom ? createdFrom.toISOString() : null,
        createdTo: createdTo ? createdTo.toISOString() : null,
        chartDays,
      },
      kpis: {
        orders: {
          total: this.toNumber(orders.totalOrders),
          pending: this.toNumber(orders.pendingOrders),
          confirmed: this.toNumber(orders.confirmedOrders),
          processing: this.toNumber(orders.processingOrders),
          shipped: this.toNumber(orders.shippedOrders),
          delivered: this.toNumber(orders.deliveredOrders),
          cancelled: this.toNumber(orders.cancelledOrders),
          refunded: this.toNumber(orders.refundedOrders),
          stalePending: this.toNumber(orders.stalePendingOrders),
          grossAmount: this.toDecimalString(orders.grossOrderAmount),
          averageAmount: this.toDecimalString(orders.averageOrderAmount),
        },
        payments: {
          total: this.toNumber(payments.totalPayments),
          pending: this.toNumber(payments.pendingPayments),
          completed: this.toNumber(payments.completedPayments),
          failed: this.toNumber(payments.failedPayments),
          refunded: this.toNumber(payments.refundedPayments),
          partialRefunded: this.toNumber(payments.partialRefundedPayments),
          completedAmount: this.toDecimalString(payments.completedAmount),
          refundedLikeAmount: this.toDecimalString(payments.refundedLikeAmount),
          failedAmount: this.toDecimalString(payments.failedAmount),
        },
        refunds: {
          total: this.toNumber(refunds.totalRefunds),
          pending: this.toNumber(refunds.pendingRefunds),
          processing: this.toNumber(refunds.processingRefunds),
          completed: this.toNumber(refunds.completedRefunds),
          failed: this.toNumber(refunds.failedRefunds),
          totalAmount: this.toDecimalString(refunds.totalRefundAmount),
          completedAmount: this.toDecimalString(refunds.completedRefundAmount),
        },
        invoices: {
          total: this.toNumber(invoices.totalInvoices),
          pending: this.toNumber(invoices.pendingInvoices),
          paid: this.toNumber(invoices.paidInvoices),
          overdue: this.toNumber(invoices.overdueInvoices),
          cancelled: this.toNumber(invoices.cancelledInvoices),
          totalAmount: this.toDecimalString(invoices.totalInvoiceAmount),
          paidAmount: this.toDecimalString(invoices.paidInvoiceAmount),
        },
        products: {
          total: this.toNumber(products.totalProducts),
          active: this.toNumber(products.activeProducts),
          draft: this.toNumber(products.draftProducts),
          inactive: this.toNumber(products.inactiveProducts),
          archived: this.toNumber(products.archivedProducts),
          totalViews: this.toNumber(products.totalViews),
          averageRating: this.toDecimalString(products.averageRating),
        },
        users: {
          total: this.toNumber(users.totalUsers),
          active: this.toNumber(users.activeUsers),
          inactive: this.toNumber(users.inactiveUsers),
          suspended: this.toNumber(users.suspendedUsers),
          newUsers: this.toNumber(users.newUsers),
        },
        inventory: {
          totalRows: this.toNumber(inventory.totalInventoryRows),
          totalQuantity: this.toNumber(inventory.totalQuantity),
          reservedQuantity: this.toNumber(inventory.totalReservedQuantity),
          availableQuantity: this.toNumber(inventory.totalAvailableQuantity),
          lowStockRows: this.toNumber(inventory.lowStockRows),
          outOfStockRows: this.toNumber(inventory.outOfStockRows),
        },
        notifications: {
          total: this.toNumber(notifications.totalNotifications),
          unread: this.toNumber(notifications.unreadNotifications),
          system: this.toNumber(notifications.systemNotifications),
        },
        audit: {
          total: this.toNumber(audit.totalAuditLogs),
          warning: this.toNumber(audit.warningAuditLogs),
          error: this.toNumber(audit.errorAuditLogs),
          critical: this.toNumber(audit.criticalAuditLogs),
          sensitive: this.toNumber(audit.sensitiveAuditLogs),
        },
      },
      risk,
      charts: {
        dailyOrders: dailyOrderRows.map((row) => ({
          day: this.toDay(row.day),
          count: this.toNumber(row.count),
        })),
        dailyRevenue: dailyRevenueRows.map((row) => ({
          day: this.toDay(row.day),
          amount: this.toDecimalString(row.amount),
        })),
        dailyAudit: dailyAuditRows.map((row) => ({
          day: this.toDay(row.day),
          count: this.toNumber(row.count),
        })),
      },
      recentSensitiveAudits: recentSensitiveAuditRows.map((row) => ({
        id: row.id,
        action: row.action,
        description: row.description,
        category: row.category,
        severity: row.severity ?? 'warning',
        entityType: row.entityType,
        entityId: row.entityId,
        actorId: row.actorId,
        occurredAt: row.occurredAt.toISOString(),
      })),
    };
  }

  private getOrderKpis(
    query: AdminEnterpriseDashboardQueryDto,
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Promise<OrderKpiRow[]> {
    const where = this.buildBaseWhere('o', createdFrom, createdTo);

    if (query.currency) {
      where.push(Prisma.sql`o."currency" = ${query.currency}`);
    }

    return this.prisma.$queryRaw<OrderKpiRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "totalOrders",
          COUNT(*) FILTER (
            WHERE o."status"::text = 'PENDING'
          )::int AS "pendingOrders",
          COUNT(*) FILTER (
            WHERE o."status"::text = 'CONFIRMED'
          )::int AS "confirmedOrders",
          COUNT(*) FILTER (
            WHERE o."status"::text = 'PROCESSING'
          )::int AS "processingOrders",
          COUNT(*) FILTER (
            WHERE o."status"::text = 'SHIPPED'
          )::int AS "shippedOrders",
          COUNT(*) FILTER (
            WHERE o."status"::text = 'DELIVERED'
          )::int AS "deliveredOrders",
          COUNT(*) FILTER (
            WHERE o."status"::text = 'CANCELLED'
          )::int AS "cancelledOrders",
          COUNT(*) FILTER (
            WHERE o."status"::text = 'REFUNDED'
          )::int AS "refundedOrders",
          COUNT(*) FILTER (
            WHERE
              o."status"::text IN ('PENDING', 'CONFIRMED')
              AND o."createdAt" <= NOW() - INTERVAL '24 hours'
          )::int AS "stalePendingOrders",
          COALESCE(SUM(o."totalAmount"), 0) AS "grossOrderAmount",
          COALESCE(AVG(o."totalAmount"), 0) AS "averageOrderAmount"
        FROM "Order" o
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private getPaymentKpis(
    query: AdminEnterpriseDashboardQueryDto,
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Promise<PaymentKpiRow[]> {
    const where = this.buildBaseWhere('p', createdFrom, createdTo);

    if (query.currency) {
      where.push(Prisma.sql`p."currency" = ${query.currency}`);
    }

    return this.prisma.$queryRaw<PaymentKpiRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "totalPayments",
          COUNT(*) FILTER (
            WHERE p."paymentStatus"::text = 'PENDING'
          )::int AS "pendingPayments",
          COUNT(*) FILTER (
            WHERE p."paymentStatus"::text = 'COMPLETED'
          )::int AS "completedPayments",
          COUNT(*) FILTER (
            WHERE p."paymentStatus"::text = 'FAILED'
          )::int AS "failedPayments",
          COUNT(*) FILTER (
            WHERE p."paymentStatus"::text = 'REFUNDED'
          )::int AS "refundedPayments",
          COUNT(*) FILTER (
            WHERE p."paymentStatus"::text = 'PARTIAL_REFUNDED'
          )::int AS "partialRefundedPayments",
          COALESCE(SUM(p."amount") FILTER (
            WHERE p."paymentStatus"::text = 'COMPLETED'
          ), 0) AS "completedAmount",
          COALESCE(SUM(p."amount") FILTER (
            WHERE p."paymentStatus"::text IN ('REFUNDED', 'PARTIAL_REFUNDED')
          ), 0) AS "refundedLikeAmount",
          COALESCE(SUM(p."amount") FILTER (
            WHERE p."paymentStatus"::text = 'FAILED'
          ), 0) AS "failedAmount"
        FROM "Payment" p
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private getRefundKpis(
    query: AdminEnterpriseDashboardQueryDto,
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Promise<RefundKpiRow[]> {
    const where = this.buildBaseWhere('r', createdFrom, createdTo);

    if (query.currency) {
      where.push(Prisma.sql`p."currency" = ${query.currency}`);
    }

    return this.prisma.$queryRaw<RefundKpiRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "totalRefunds",
          COUNT(*) FILTER (
            WHERE r."status"::text = 'PENDING'
          )::int AS "pendingRefunds",
          COUNT(*) FILTER (
            WHERE r."status"::text = 'PROCESSING'
          )::int AS "processingRefunds",
          COUNT(*) FILTER (
            WHERE r."status"::text = 'COMPLETED'
          )::int AS "completedRefunds",
          COUNT(*) FILTER (
            WHERE r."status"::text = 'FAILED'
          )::int AS "failedRefunds",
          COALESCE(SUM(r."amount"), 0) AS "totalRefundAmount",
          COALESCE(SUM(r."amount") FILTER (
            WHERE r."status"::text = 'COMPLETED'
          ), 0) AS "completedRefundAmount"
        FROM "Refund" r
        LEFT JOIN "Payment" p
          ON p."id" = r."paymentId"
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private getInvoiceKpis(
    query: AdminEnterpriseDashboardQueryDto,
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Promise<InvoiceKpiRow[]> {
    const where = this.buildBaseWhere('i', createdFrom, createdTo);

    if (query.currency) {
      where.push(Prisma.sql`i."currency" = ${query.currency}`);
    }

    return this.prisma.$queryRaw<InvoiceKpiRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "totalInvoices",
          COUNT(*) FILTER (
            WHERE i."status"::text = 'PENDING'
          )::int AS "pendingInvoices",
          COUNT(*) FILTER (
            WHERE i."status"::text = 'PAID'
          )::int AS "paidInvoices",
          COUNT(*) FILTER (
            WHERE i."status"::text = 'OVERDUE'
          )::int AS "overdueInvoices",
          COUNT(*) FILTER (
            WHERE i."status"::text = 'CANCELLED'
          )::int AS "cancelledInvoices",
          COALESCE(SUM(i."amount"), 0) AS "totalInvoiceAmount",
          COALESCE(SUM(i."amount") FILTER (
            WHERE i."status"::text = 'PAID'
          ), 0) AS "paidInvoiceAmount"
        FROM "Invoice" i
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private getProductKpis(
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Promise<ProductKpiRow[]> {
    const where = this.buildBaseWhere('p', createdFrom, createdTo);

    return this.prisma.$queryRaw<ProductKpiRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "totalProducts",
          COUNT(*) FILTER (
            WHERE p."status"::text = 'ACTIVE'
              AND p."isActive" = TRUE
          )::int AS "activeProducts",
          COUNT(*) FILTER (
            WHERE p."status"::text = 'DRAFT'
          )::int AS "draftProducts",
          COUNT(*) FILTER (
            WHERE p."status"::text = 'INACTIVE'
          )::int AS "inactiveProducts",
          COUNT(*) FILTER (
            WHERE p."status"::text = 'ARCHIVED'
          )::int AS "archivedProducts",
          COALESCE(SUM(p."viewCount"), 0)::int AS "totalViews",
          COALESCE(AVG(p."averageRating"), 0) AS "averageRating"
        FROM "Product" p
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private getUserKpis(
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Promise<UserKpiRow[]> {
    const where = this.buildBaseWhere('u', createdFrom, createdTo);

    return this.prisma.$queryRaw<UserKpiRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "totalUsers",
          COUNT(*) FILTER (
            WHERE u."status"::text = 'ACTIVE'
          )::int AS "activeUsers",
          COUNT(*) FILTER (
            WHERE u."status"::text = 'INACTIVE'
          )::int AS "inactiveUsers",
          COUNT(*) FILTER (
            WHERE u."status"::text = 'SUSPENDED'
          )::int AS "suspendedUsers",
          COUNT(*) FILTER (
            WHERE u."createdAt" >= NOW() - INTERVAL '30 days'
          )::int AS "newUsers"
        FROM "User" u
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private getInventoryKpis(): Promise<InventoryKpiRow[]> {
    return this.prisma.$queryRaw<InventoryKpiRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "totalInventoryRows",
          COALESCE(SUM(i."quantity"), 0)::int AS "totalQuantity",
          COALESCE(SUM(i."reservedQuantity"), 0)::int AS "totalReservedQuantity",
          COALESCE(SUM(GREATEST(i."quantity" - i."reservedQuantity", 0)), 0)::int AS "totalAvailableQuantity",
          COUNT(*) FILTER (
            WHERE GREATEST(i."quantity" - i."reservedQuantity", 0) <= i."lowStockThreshold"
          )::int AS "lowStockRows",
          COUNT(*) FILTER (
            WHERE GREATEST(i."quantity" - i."reservedQuantity", 0) <= 0
          )::int AS "outOfStockRows"
        FROM "Inventory" i
      `,
    );
  }

  private getNotificationKpis(
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Promise<NotificationKpiRow[]> {
    const where = this.buildBaseWhere('n', createdFrom, createdTo);

    where.push(Prisma.sql`n."isActive" = TRUE`);

    return this.prisma.$queryRaw<NotificationKpiRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "totalNotifications",
          COUNT(*) FILTER (
            WHERE n."isRead" = FALSE
          )::int AS "unreadNotifications",
          COUNT(*) FILTER (
            WHERE n."type"::text = 'SYSTEM'
          )::int AS "systemNotifications"
        FROM "Notification" n
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private getAuditKpis(
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Promise<AuditKpiRow[]> {
    const where = this.buildEventWhere(createdFrom, createdTo);

    return this.prisma.$queryRaw<AuditKpiRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "totalAuditLogs",
          COUNT(*) FILTER (
            WHERE COALESCE(e."data" #>> '{severity}', 'info') = 'warning'
          )::int AS "warningAuditLogs",
          COUNT(*) FILTER (
            WHERE COALESCE(e."data" #>> '{severity}', 'info') = 'error'
          )::int AS "errorAuditLogs",
          COUNT(*) FILTER (
            WHERE COALESCE(e."data" #>> '{severity}', 'info') = 'critical'
          )::int AS "criticalAuditLogs",
          COUNT(*) FILTER (
            WHERE COALESCE(e."data" #>> '{severity}', 'info') IN ('warning', 'error', 'critical')
          )::int AS "sensitiveAuditLogs"
        FROM "Event" e
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
  }

  private getDailyOrders(
    chartDays: number,
    currency?: string,
  ): Promise<DailyMetricRow[]> {
    const where: Prisma.Sql[] = [
      Prisma.sql`o."deleted_at" IS NULL`,
      Prisma.sql`o."createdAt" >= NOW() - (${chartDays} * INTERVAL '1 day')`,
    ];

    if (currency) {
      where.push(Prisma.sql`o."currency" = ${currency}`);
    }

    return this.prisma.$queryRaw<DailyMetricRow[]>(
      Prisma.sql`
        SELECT
          DATE_TRUNC('day', o."createdAt") AS "day",
          COUNT(*)::int AS "count"
        FROM "Order" o
        WHERE ${Prisma.join(where, ' AND ')}
        GROUP BY DATE_TRUNC('day', o."createdAt")
        ORDER BY "day" ASC
      `,
    );
  }

  private getDailyRevenue(
    chartDays: number,
    currency?: string,
  ): Promise<DailyMetricRow[]> {
    const where: Prisma.Sql[] = [
      Prisma.sql`p."deleted_at" IS NULL`,
      Prisma.sql`p."paymentStatus"::text = 'COMPLETED'`,
      Prisma.sql`p."createdAt" >= NOW() - (${chartDays} * INTERVAL '1 day')`,
    ];

    if (currency) {
      where.push(Prisma.sql`p."currency" = ${currency}`);
    }

    return this.prisma.$queryRaw<DailyMetricRow[]>(
      Prisma.sql`
        SELECT
          DATE_TRUNC('day', p."createdAt") AS "day",
          COUNT(*)::int AS "count",
          COALESCE(SUM(p."amount"), 0) AS "amount"
        FROM "Payment" p
        WHERE ${Prisma.join(where, ' AND ')}
        GROUP BY DATE_TRUNC('day', p."createdAt")
        ORDER BY "day" ASC
      `,
    );
  }

  private getDailyAudit(chartDays: number): Promise<DailyMetricRow[]> {
    return this.prisma.$queryRaw<DailyMetricRow[]>(
      Prisma.sql`
        SELECT
          DATE_TRUNC('day', e."timestamp") AS "day",
          COUNT(*)::int AS "count"
        FROM "Event" e
        WHERE
          e."deleted_at" IS NULL
          AND e."timestamp" >= NOW() - (${chartDays} * INTERVAL '1 day')
        GROUP BY DATE_TRUNC('day', e."timestamp")
        ORDER BY "day" ASC
      `,
    );
  }

  private getRecentSensitiveAudits(): Promise<RecentSensitiveAuditRow[]> {
    return this.prisma.$queryRaw<RecentSensitiveAuditRow[]>(
      Prisma.sql`
        SELECT
          e."id",
          e."name" AS "action",
          e."description",
          e."category",
          COALESCE(e."data" #>> '{severity}', 'info') AS "severity",
          e."data" #>> '{entityType}' AS "entityType",
          e."data" #>> '{entityId}' AS "entityId",
          e."userId" AS "actorId",
          e."timestamp" AS "occurredAt"
        FROM "Event" e
        WHERE
          e."deleted_at" IS NULL
          AND COALESCE(e."data" #>> '{severity}', 'info') IN ('warning', 'error', 'critical')
        ORDER BY
          e."timestamp" DESC,
          e."createdAt" DESC
        LIMIT 15
      `,
    );
  }

  private buildBaseWhere(
    alias: string,
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Prisma.Sql[] {
    const table = Prisma.raw(alias);

    const where: Prisma.Sql[] = [Prisma.sql`${table}."deleted_at" IS NULL`];

    if (createdFrom) {
      where.push(Prisma.sql`${table}."createdAt" >= ${createdFrom}`);
    }

    if (createdTo) {
      where.push(Prisma.sql`${table}."createdAt" <= ${createdTo}`);
    }

    return where;
  }

  private buildEventWhere(
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`e."deleted_at" IS NULL`];

    if (createdFrom) {
      where.push(Prisma.sql`e."timestamp" >= ${createdFrom}`);
    }

    if (createdTo) {
      where.push(Prisma.sql`e."timestamp" <= ${createdTo}`);
    }

    return where;
  }

  private buildRisk(input: {
    orders: OrderKpiRow;
    payments: PaymentKpiRow;
    refunds: RefundKpiRow;
    inventory: InventoryKpiRow;
    notifications: NotificationKpiRow;
    audit: AuditKpiRow;
  }): EnterpriseDashboardResponse['risk'] {
    let score = 0;

    const signals: string[] = [];

    const criticalAudit = this.toNumber(input.audit.criticalAuditLogs);

    const errorAudit = this.toNumber(input.audit.errorAuditLogs);

    const failedPayments = this.toNumber(input.payments.failedPayments);

    const failedRefunds = this.toNumber(input.refunds.failedRefunds);

    const staleOrders = this.toNumber(input.orders.stalePendingOrders);

    const outOfStockRows = this.toNumber(input.inventory.outOfStockRows);

    const unreadNotifications = this.toNumber(
      input.notifications.unreadNotifications,
    );

    if (criticalAudit > 0) {
      score += 35;
      signals.push('رویداد Audit بحرانی ثبت شده است.');
    }

    if (errorAudit > 0) {
      score += 20;
      signals.push('رویداد Audit با سطح خطا وجود دارد.');
    }

    if (failedPayments > 0) {
      score += 15;
      signals.push('پرداخت ناموفق وجود دارد.');
    }

    if (failedRefunds > 0) {
      score += 10;
      signals.push('بازگشت وجه ناموفق وجود دارد.');
    }

    if (staleOrders > 0) {
      score += 10;
      signals.push('سفارش معطل‌شده بیش از ۲۴ ساعت وجود دارد.');
    }

    if (outOfStockRows > 0) {
      score += 10;
      signals.push('بخشی از موجودی‌ها ناموجود شده‌اند.');
    }

    if (unreadNotifications > 20) {
      score += 5;
      signals.push('اعلان‌های خوانده‌نشده زیاد شده‌اند.');
    }

    const normalizedScore = Math.min(100, score);

    if (normalizedScore >= 80) {
      return {
        score: normalizedScore,
        level: 'critical',
        signals,
      };
    }

    if (normalizedScore >= 50) {
      return {
        score: normalizedScore,
        level: 'high',
        signals,
      };
    }

    if (normalizedScore >= 20) {
      return {
        score: normalizedScore,
        level: 'medium',
        signals,
      };
    }

    return {
      score: normalizedScore,
      level: 'low',
      signals,
    };
  }

  private parseOptionalDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('تاریخ واردشده معتبر نیست.');
    }

    return date;
  }

  private toDay(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (typeof value === 'object') {
      const primitiveValue = value.valueOf();

      return primitiveValue === value ? Number.NaN : Number(primitiveValue);
    }

    return Number(value);
  }

  private toDecimalString(
    value: Prisma.Decimal | number | string | null | undefined,
  ): string {
    if (value === null || value === undefined) {
      return '0.00';
    }

    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    return new Prisma.Decimal(value).toFixed(2);
  }

  private emptyOrderKpis(): OrderKpiRow {
    return {
      totalOrders: 0,
      pendingOrders: 0,
      confirmedOrders: 0,
      processingOrders: 0,
      shippedOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      refundedOrders: 0,
      stalePendingOrders: 0,
      grossOrderAmount: 0,
      averageOrderAmount: 0,
    };
  }

  private emptyPaymentKpis(): PaymentKpiRow {
    return {
      totalPayments: 0,
      pendingPayments: 0,
      completedPayments: 0,
      failedPayments: 0,
      refundedPayments: 0,
      partialRefundedPayments: 0,
      completedAmount: 0,
      refundedLikeAmount: 0,
      failedAmount: 0,
    };
  }

  private emptyRefundKpis(): RefundKpiRow {
    return {
      totalRefunds: 0,
      pendingRefunds: 0,
      processingRefunds: 0,
      completedRefunds: 0,
      failedRefunds: 0,
      totalRefundAmount: 0,
      completedRefundAmount: 0,
    };
  }

  private emptyInvoiceKpis(): InvoiceKpiRow {
    return {
      totalInvoices: 0,
      pendingInvoices: 0,
      paidInvoices: 0,
      overdueInvoices: 0,
      cancelledInvoices: 0,
      totalInvoiceAmount: 0,
      paidInvoiceAmount: 0,
    };
  }

  private emptyProductKpis(): ProductKpiRow {
    return {
      totalProducts: 0,
      activeProducts: 0,
      draftProducts: 0,
      inactiveProducts: 0,
      archivedProducts: 0,
      totalViews: 0,
      averageRating: 0,
    };
  }

  private emptyUserKpis(): UserKpiRow {
    return {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      suspendedUsers: 0,
      newUsers: 0,
    };
  }

  private emptyInventoryKpis(): InventoryKpiRow {
    return {
      totalInventoryRows: 0,
      totalQuantity: 0,
      totalReservedQuantity: 0,
      totalAvailableQuantity: 0,
      lowStockRows: 0,
      outOfStockRows: 0,
    };
  }

  private emptyNotificationKpis(): NotificationKpiRow {
    return {
      totalNotifications: 0,
      unreadNotifications: 0,
      systemNotifications: 0,
    };
  }

  private emptyAuditKpis(): AuditKpiRow {
    return {
      totalAuditLogs: 0,
      warningAuditLogs: 0,
      errorAuditLogs: 0,
      criticalAuditLogs: 0,
      sensitiveAuditLogs: 0,
    };
  }
}
