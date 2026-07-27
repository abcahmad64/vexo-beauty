import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import {
  AiPermissionContext,
  AiPermissionGuardService,
} from '../../ai/services/ai-permission-guard.service';

import {
  AiToolDefinition,
  AiToolRegistryService,
} from '../../ai/services/ai-tool-registry.service';

import {
  AdminReportAiOrderSummaryDto,
  AdminReportAiSalesInsightDto,
  AdminReportAiStoreHealthDto,
} from '../dto/admin-report-ai.dto';

type JsonRecord = Record<string, unknown>;

type OrderMetricRow = {
  orderCount: number | bigint;
  pendingCount: number | bigint;
  processingCount: number | bigint;
  shippedCount: number | bigint;
  deliveredCount: number | bigint;
  cancelledCount: number | bigint;
  paymentPendingCount: number | bigint;
  paymentFailedCount: number | bigint;
  grossRevenue: unknown;
  discountAmount: unknown;
  averageOrderValue: unknown;
};

type PaymentMetricRow = {
  paymentCount: number | bigint;
  completedCount: number | bigint;
  failedCount: number | bigint;
  pendingCount: number | bigint;
  refundedCount: number | bigint;
  completedAmount: unknown;
  failedAmount: unknown;
};

type RefundMetricRow = {
  refundCount: number | bigint;
  pendingCount: number | bigint;
  completedCount: number | bigint;
  failedCount: number | bigint;
  requestedAmount: unknown;
  completedAmount: unknown;
};

type InventoryMetricRow = {
  inventoryCount: number | bigint;
  lowStockCount: number | bigint;
  outOfStockCount: number | bigint;
  reservedQuantity: number | bigint;
  availableQuantity: number | bigint;
};

type CouponMetricRow = {
  couponCount: number | bigint;
  activeCount: number | bigint;
  exhaustedCount: number | bigint;
  usedCount: number | bigint;
};

type AuditMetricRow = {
  eventCount: number | bigint;
  errorCount: number | bigint;
  warningCount: number | bigint;
  criticalCount: number | bigint;
};

type TopProductRow = {
  productId: string | null;
  productName: string;
  sku: string | null;
  quantity: number | bigint;
  orderCount: number | bigint;
  revenue: unknown;
};

type RecentOrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: unknown;
  currency: string;
  createdAt: Date;
  userEmail: string | null;
};

type OrderDetailRow = {
  id: string;
  orderNumber: string;
  userId: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  totalAmount: unknown;
  discountAmount: unknown;
  currency: string;
  itemCount: number | bigint;
  totalQuantity: number | bigint;
  failedPaymentCount: number | bigint;
  userEmail: string | null;
  userPhone: string | null;
  trackingNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TimelineRow = {
  source: string;
  title: string;
  description: string | null;
  status: string | null;
  amount: unknown;
  currency: string | null;
  occurredAt: Date;
};

@Injectable()
export class AdminReportAiService {
  private readonly modelName = 'backend-deterministic-store-intelligence';

  constructor(
    private readonly prisma: PrismaService,
    private readonly toolRegistry: AiToolRegistryService,
    private readonly permissionGuard: AiPermissionGuardService,
  ) {}

  async generateStoreHealth(
    dto: AdminReportAiStoreHealthDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAccess(
      'report.store.health',
      context,
      'گزارش هوشمند سلامت فروشگاه',
    );

    const range = this.resolveRange(dto.createdFrom, dto.createdTo);

    const snapshot = await this.buildStoreSnapshot(range, dto.currency);

    const health = this.analyzeStoreHealth(snapshot);

    return {
      range: this.toPublicRange(range),
      health,
      snapshot,
      model: this.modelName,
      applied: false,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'report.ai_store_health_generated',
      },
    };
  }

  async generateSalesInsight(
    dto: AdminReportAiSalesInsightDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAccess(
      'analytics.sales.insight',
      context,
      'تحلیل هوشمند فروش',
    );

    const range = this.resolveRange(dto.createdFrom, dto.createdTo);

    const [orders, payments, topProducts] = await Promise.all([
      this.getOrderMetrics(range),
      this.getPaymentMetrics(range),
      this.getTopProducts(range, dto.topProductsLimit ?? 5),
    ]);

    const insight = this.analyzeSales(orders, payments, topProducts);

    return {
      range: this.toPublicRange(range),
      insight,
      metrics: {
        orders,
        payments,
        topProducts,
      },
      model: this.modelName,
      applied: false,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'analytics.ai_sales_insight_generated',
      },
    };
  }

  async generateOrderSummary(
    dto: AdminReportAiOrderSummaryDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAccess(
      'order.summary',
      context,
      'خلاصه هوشمند سفارش‌ها',
    );

    const range = this.resolveRange(dto.createdFrom, dto.createdTo);

    if (dto.orderId) {
      const detail = await this.getOrderDetail(dto.orderId);

      const timeline =
        dto.includeTimeline === true
          ? await this.getOrderTimeline(dto.orderId, 30)
          : [];

      return {
        mode: 'single_order',
        order: detail,
        timeline,
        summary: this.analyzeSingleOrder(detail, timeline),
        model: this.modelName,
        applied: false,
        tool: this.toPublicTool(tool),
        audit: {
          actorId: context.userId ?? null,
          action: 'order.ai_summary_generated',
        },
      };
    }

    const [metrics, recentOrders] = await Promise.all([
      this.getOrderMetrics(range),
      this.getRecentOrders(range, dto.limit ?? 10),
    ]);

    return {
      mode: 'order_list',
      range: this.toPublicRange(range),
      metrics,
      recentOrders,
      summary: this.analyzeOrders(metrics, recentOrders),
      model: this.modelName,
      applied: false,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'order.ai_summary_generated',
      },
    };
  }

  private async buildStoreSnapshot(
    range: {
      from: Date;
      to: Date;
    },
    currency?: string,
  ) {
    const [
      ordersResult,
      paymentsResult,
      refundsResult,
      inventoryResult,
      couponsResult,
      contentResult,
      auditResult,
      recentOrdersResult,
      topProductsResult,
    ] = await Promise.all([
      this.collectSafeMetric('orders', this.defaultOrderMetrics(), () =>
        this.getOrderMetrics(range),
      ),
      this.collectSafeMetric('payments', this.defaultPaymentMetrics(), () =>
        this.getPaymentMetrics(range),
      ),
      this.collectSafeMetric('refunds', this.defaultRefundMetrics(), () =>
        this.getRefundMetrics(range),
      ),
      this.collectSafeMetric('inventory', this.defaultInventoryMetrics(), () =>
        this.getInventoryMetrics(),
      ),
      this.collectSafeMetric('coupons', this.defaultCouponMetrics(), () =>
        this.getCouponMetrics(),
      ),
      this.collectSafeMetric('content', this.defaultContentMetrics(), () =>
        this.getContentMetrics(),
      ),
      this.collectSafeMetric('audit', this.defaultAuditMetrics(), () =>
        this.getAuditMetrics(range),
      ),
      this.collectSafeMetric('recentOrders', [] as JsonRecord[], () =>
        this.getRecentOrders(range, 8),
      ),
      this.collectSafeMetric('topProducts', [] as JsonRecord[], () =>
        this.getTopProducts(range, 5),
      ),
    ]);

    const diagnostics = [
      ordersResult,
      paymentsResult,
      refundsResult,
      inventoryResult,
      couponsResult,
      contentResult,
      auditResult,
      recentOrdersResult,
      topProductsResult,
    ]
      .filter((result) => result.error !== null)
      .map((result) => ({
        section: result.label,
        message: result.error,
      }));

    return {
      currency: currency ?? null,
      orders: ordersResult.data,
      payments: paymentsResult.data,
      refunds: refundsResult.data,
      inventory: inventoryResult.data,
      coupons: couponsResult.data,
      content: contentResult.data,
      audit: auditResult.data,
      recentOrders: recentOrdersResult.data,
      topProducts: topProductsResult.data,
      diagnostics,
    };
  }

  private async collectSafeMetric<T>(
    label: string,
    fallback: T,
    resolver: () => Promise<T>,
  ): Promise<{
    label: string;
    data: T;
    error: string | null;
  }> {
    try {
      return {
        label,
        data: await resolver(),
        error: null,
      };
    } catch (error) {
      return {
        label,
        data: fallback,
        error: this.toSafeErrorMessage(error),
      };
    }
  }

  private toSafeErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'بخشی از داده‌های گزارش سلامت فروشگاه در دسترس نبود.';
  }

  private defaultOrderMetrics() {
    return {
      orderCount: 0,
      pendingCount: 0,
      processingCount: 0,
      shippedCount: 0,
      deliveredCount: 0,
      cancelledCount: 0,
      paymentPendingCount: 0,
      paymentFailedCount: 0,
      grossRevenue: '0.00',
      discountAmount: '0.00',
      averageOrderValue: '0.00',
    };
  }

  private defaultPaymentMetrics() {
    return {
      paymentCount: 0,
      completedCount: 0,
      failedCount: 0,
      pendingCount: 0,
      refundedCount: 0,
      completedAmount: '0.00',
      failedAmount: '0.00',
    };
  }

  private defaultRefundMetrics() {
    return {
      refundCount: 0,
      pendingCount: 0,
      completedCount: 0,
      failedCount: 0,
      requestedAmount: '0.00',
      completedAmount: '0.00',
    };
  }

  private defaultInventoryMetrics() {
    return {
      inventoryCount: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
    };
  }

  private defaultCouponMetrics() {
    return {
      couponCount: 0,
      activeCount: 0,
      exhaustedCount: 0,
      usedCount: 0,
    };
  }

  private defaultContentMetrics() {
    return {
      pageCount: 0,
      publishedPageCount: 0,
      blockCount: 0,
      publishedBlockCount: 0,
      faqCount: 0,
      publishedFaqCount: 0,
    };
  }

  private defaultAuditMetrics() {
    return {
      eventCount: 0,
      errorCount: 0,
      warningCount: 0,
      criticalCount: 0,
    };
  }

  private async getOrderMetrics(range: { from: Date; to: Date }) {
    const rows = await this.prisma.$queryRaw<OrderMetricRow[]>(
      Prisma.sql`
          SELECT
            COUNT(o."id")::int AS "orderCount",
            COUNT(*) FILTER (WHERE o."status"::text = 'PENDING')::int AS "pendingCount",
            COUNT(*) FILTER (WHERE o."status"::text = 'PROCESSING')::int AS "processingCount",
            COUNT(*) FILTER (WHERE o."status"::text = 'SHIPPED')::int AS "shippedCount",
            COUNT(*) FILTER (WHERE o."status"::text = 'DELIVERED')::int AS "deliveredCount",
            COUNT(*) FILTER (WHERE o."status"::text = 'CANCELLED')::int AS "cancelledCount",
            COUNT(*) FILTER (WHERE o."paymentStatus"::text = 'PENDING')::int AS "paymentPendingCount",
            COUNT(*) FILTER (WHERE o."paymentStatus"::text = 'FAILED')::int AS "paymentFailedCount",
            COALESCE(SUM(o."totalAmount"), 0)::numeric AS "grossRevenue",
            COALESCE(SUM(o."discountAmount"), 0)::numeric AS "discountAmount",
            COALESCE(AVG(o."totalAmount"), 0)::numeric AS "averageOrderValue"
          FROM "Order" o
          WHERE
            o."deleted_at" IS NULL
            AND o."createdAt" >= ${range.from}
            AND o."createdAt" <= ${range.to}
        `,
    );

    const row = rows[0];

    return {
      orderCount: this.toNumber(row?.orderCount),
      pendingCount: this.toNumber(row?.pendingCount),
      processingCount: this.toNumber(row?.processingCount),
      shippedCount: this.toNumber(row?.shippedCount),
      deliveredCount: this.toNumber(row?.deliveredCount),
      cancelledCount: this.toNumber(row?.cancelledCount),
      paymentPendingCount: this.toNumber(row?.paymentPendingCount),
      paymentFailedCount: this.toNumber(row?.paymentFailedCount),
      grossRevenue: this.toDecimalString(row?.grossRevenue),
      discountAmount: this.toDecimalString(row?.discountAmount),
      averageOrderValue: this.toDecimalString(row?.averageOrderValue),
    };
  }

  private async getPaymentMetrics(range: { from: Date; to: Date }) {
    const rows = await this.prisma.$queryRaw<PaymentMetricRow[]>(
      Prisma.sql`
          SELECT
            COUNT(p."id")::int AS "paymentCount",
            COUNT(*) FILTER (WHERE p."paymentStatus"::text = 'COMPLETED')::int AS "completedCount",
            COUNT(*) FILTER (WHERE p."paymentStatus"::text = 'FAILED')::int AS "failedCount",
            COUNT(*) FILTER (WHERE p."paymentStatus"::text = 'PENDING')::int AS "pendingCount",
            COUNT(*) FILTER (WHERE p."paymentStatus"::text IN ('REFUNDED', 'PARTIAL_REFUNDED'))::int AS "refundedCount",
            COALESCE(SUM(p."amount") FILTER (WHERE p."paymentStatus"::text IN ('COMPLETED', 'PARTIAL_REFUNDED', 'REFUNDED')), 0)::numeric AS "completedAmount",
            COALESCE(SUM(p."amount") FILTER (WHERE p."paymentStatus"::text = 'FAILED'), 0)::numeric AS "failedAmount"
          FROM "Payment" p
          WHERE
            p."deleted_at" IS NULL
            AND p."createdAt" >= ${range.from}
            AND p."createdAt" <= ${range.to}
        `,
    );

    const row = rows[0];

    return {
      paymentCount: this.toNumber(row?.paymentCount),
      completedCount: this.toNumber(row?.completedCount),
      failedCount: this.toNumber(row?.failedCount),
      pendingCount: this.toNumber(row?.pendingCount),
      refundedCount: this.toNumber(row?.refundedCount),
      completedAmount: this.toDecimalString(row?.completedAmount),
      failedAmount: this.toDecimalString(row?.failedAmount),
    };
  }

  private async getRefundMetrics(range: { from: Date; to: Date }) {
    const rows = await this.prisma.$queryRaw<RefundMetricRow[]>(
      Prisma.sql`
          SELECT
            COUNT(r."id")::int AS "refundCount",
            COUNT(*) FILTER (WHERE r."status"::text IN ('PENDING', 'REQUESTED', 'PROCESSING'))::int AS "pendingCount",
            COUNT(*) FILTER (WHERE r."status"::text = 'COMPLETED')::int AS "completedCount",
            COUNT(*) FILTER (WHERE r."status"::text = 'FAILED')::int AS "failedCount",
            COALESCE(SUM(r."amount"), 0)::numeric AS "requestedAmount",
            COALESCE(SUM(r."amount") FILTER (WHERE r."status"::text = 'COMPLETED'), 0)::numeric AS "completedAmount"
          FROM "Refund" r
          WHERE
            r."deleted_at" IS NULL
            AND r."createdAt" >= ${range.from}
            AND r."createdAt" <= ${range.to}
        `,
    );

    const row = rows[0];

    return {
      refundCount: this.toNumber(row?.refundCount),
      pendingCount: this.toNumber(row?.pendingCount),
      completedCount: this.toNumber(row?.completedCount),
      failedCount: this.toNumber(row?.failedCount),
      requestedAmount: this.toDecimalString(row?.requestedAmount),
      completedAmount: this.toDecimalString(row?.completedAmount),
    };
  }

  private async getInventoryMetrics() {
    const rows = await this.prisma.$queryRaw<InventoryMetricRow[]>(
      Prisma.sql`
          SELECT
            COUNT(i."id")::int AS "inventoryCount",
            COUNT(*) FILTER (
              WHERE GREATEST(i."quantity" - i."reservedQuantity", 0) <= i."lowStockThreshold"
              AND GREATEST(i."quantity" - i."reservedQuantity", 0) > 0
            )::int AS "lowStockCount",
            COUNT(*) FILTER (
              WHERE GREATEST(i."quantity" - i."reservedQuantity", 0) <= 0
            )::int AS "outOfStockCount",
            COALESCE(SUM(i."reservedQuantity"), 0)::int AS "reservedQuantity",
            COALESCE(SUM(GREATEST(i."quantity" - i."reservedQuantity", 0)), 0)::int AS "availableQuantity"
          FROM "Inventory" i
          INNER JOIN "Warehouse" w
            ON w."id" = i."warehouseId"
          WHERE w."isActive" = TRUE
        `,
    );

    const row = rows[0];

    return {
      inventoryCount: this.toNumber(row?.inventoryCount),
      lowStockCount: this.toNumber(row?.lowStockCount),
      outOfStockCount: this.toNumber(row?.outOfStockCount),
      reservedQuantity: this.toNumber(row?.reservedQuantity),
      availableQuantity: this.toNumber(row?.availableQuantity),
    };
  }

  private async getCouponMetrics() {
    const rows = await this.prisma.$queryRaw<CouponMetricRow[]>(
      Prisma.sql`
          SELECT
            COUNT(c."id")::int AS "couponCount",
            COUNT(*) FILTER (
              WHERE c."status"::text = 'ACTIVE'
              AND c."isActive" = TRUE
              AND c."deleted_at" IS NULL
            )::int AS "activeCount",
            COUNT(*) FILTER (
              WHERE c."usageLimit" IS NOT NULL
              AND c."usedCount" >= c."usageLimit"
              AND c."deleted_at" IS NULL
            )::int AS "exhaustedCount",
            COALESCE(SUM(c."usedCount"), 0)::int AS "usedCount"
          FROM "Coupon" c
          WHERE c."deleted_at" IS NULL
        `,
    );

    const row = rows[0];

    return {
      couponCount: this.toNumber(row?.couponCount),
      activeCount: this.toNumber(row?.activeCount),
      exhaustedCount: this.toNumber(row?.exhaustedCount),
      usedCount: this.toNumber(row?.usedCount),
    };
  }

  private async getContentMetrics() {
    const [pageMetrics, blockMetrics, faqMetrics] = await Promise.all([
      this.getContentTableMetrics('CmsPage'),
      this.getContentTableMetrics('CmsBlock'),
      this.getContentTableMetrics('CmsFaq'),
    ]);

    return {
      pageCount: pageMetrics.count,
      publishedPageCount: pageMetrics.publishedCount,
      blockCount: blockMetrics.count,
      publishedBlockCount: blockMetrics.publishedCount,
      faqCount: faqMetrics.count,
      publishedFaqCount: faqMetrics.publishedCount,
    };
  }

  private async getContentTableMetrics(
    tableName: 'CmsPage' | 'CmsBlock' | 'CmsFaq',
  ) {
    const [hasDeletedAt, hasStatus] = await Promise.all([
      this.tableHasColumn(tableName, 'deleted_at'),
      this.tableHasColumn(tableName, 'status'),
    ]);

    const safeTableName = this.toSafeContentTableName(tableName);

    const deletedWhere = hasDeletedAt ? '"deleted_at" IS NULL' : 'TRUE';

    const publishedFilter = hasStatus
      ? `"status"::text = 'PUBLISHED'`
      : 'FALSE';

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        count: number | bigint;
        publishedCount: number | bigint;
      }>
    >(
      `
          SELECT
            COUNT(*)::int AS "count",
            COUNT(*) FILTER (WHERE ${publishedFilter})::int AS "publishedCount"
          FROM "${safeTableName}"
          WHERE ${deletedWhere}
        `,
    );

    const row = rows[0];

    return {
      count: this.toNumber(row?.count),
      publishedCount: this.toNumber(row?.publishedCount),
    };
  }

  private async tableHasColumn(
    tableName: 'CmsPage' | 'CmsBlock' | 'CmsFaq',
    columnName: string,
  ): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        exists: boolean;
      }>
    >(
      Prisma.sql`
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE
              table_schema = current_schema()
              AND table_name = ${tableName}
              AND column_name = ${columnName}
          ) AS "exists"
        `,
    );

    return rows[0]?.exists === true;
  }

  private toSafeContentTableName(
    tableName: 'CmsPage' | 'CmsBlock' | 'CmsFaq',
  ): 'CmsPage' | 'CmsBlock' | 'CmsFaq' {
    if (
      tableName === 'CmsPage' ||
      tableName === 'CmsBlock' ||
      tableName === 'CmsFaq'
    ) {
      return tableName;
    }

    throw new BadRequestException('جدول محتوای درخواستی معتبر نیست.');
  }

  private async getAuditMetrics(range: { from: Date; to: Date }) {
    const rows = await this.prisma.$queryRaw<AuditMetricRow[]>(
      Prisma.sql`
          SELECT
            COUNT(e."id")::int AS "eventCount",
            COUNT(*) FILTER (
              WHERE e."name" ILIKE '%error%'
              OR e."description" ILIKE '%error%'
            )::int AS "errorCount",
            COUNT(*) FILTER (
              WHERE e."name" ILIKE '%warning%'
              OR e."description" ILIKE '%warning%'
            )::int AS "warningCount",
            COUNT(*) FILTER (
              WHERE e."name" ILIKE '%critical%'
              OR e."description" ILIKE '%critical%'
            )::int AS "criticalCount"
          FROM "Event" e
          WHERE
            e."deleted_at" IS NULL
            AND e."createdAt" >= ${range.from}
            AND e."createdAt" <= ${range.to}
        `,
    );

    const row = rows[0];

    return {
      eventCount: this.toNumber(row?.eventCount),
      errorCount: this.toNumber(row?.errorCount),
      warningCount: this.toNumber(row?.warningCount),
      criticalCount: this.toNumber(row?.criticalCount),
    };
  }

  private async getRecentOrders(
    range: {
      from: Date;
      to: Date;
    },
    limit: number,
  ) {
    const rows = await this.prisma.$queryRaw<RecentOrderRow[]>(
      Prisma.sql`
          SELECT
            o."id",
            o."orderNumber",
            o."status"::text AS "status",
            o."paymentStatus"::text AS "paymentStatus",
            o."totalAmount",
            o."currency",
            o."createdAt",
            u."email" AS "userEmail"
          FROM "Order" o
          LEFT JOIN "User" u
            ON u."id" = o."userId"
          WHERE
            o."deleted_at" IS NULL
            AND o."createdAt" >= ${range.from}
            AND o."createdAt" <= ${range.to}
          ORDER BY
            o."createdAt" DESC,
            o."id" DESC
          LIMIT ${Math.min(Math.max(limit, 1), 50)}
        `,
    );

    return rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      status: row.status,
      paymentStatus: row.paymentStatus,
      totalAmount: this.toDecimalString(row.totalAmount),
      currency: row.currency,
      createdAt: row.createdAt.toISOString(),
      userEmail: row.userEmail,
    }));
  }

  private async getTopProducts(
    range: {
      from: Date;
      to: Date;
    },
    limit: number,
  ) {
    const rows = await this.prisma.$queryRaw<TopProductRow[]>(
      Prisma.sql`
          SELECT
            oi."productId",
            oi."productName",
            oi."sku",
            COALESCE(SUM(oi."quantity"), 0)::int AS "quantity",
            COUNT(DISTINCT oi."orderId")::int AS "orderCount",
            COALESCE(SUM((oi."price" * oi."quantity") - oi."discount"), 0)::numeric AS "revenue"
          FROM "OrderItem" oi
          INNER JOIN "Order" o
            ON o."id" = oi."orderId"
          WHERE
            o."deleted_at" IS NULL
            AND o."createdAt" >= ${range.from}
            AND o."createdAt" <= ${range.to}
          GROUP BY
            oi."productId",
            oi."productName",
            oi."sku"
          ORDER BY
            "revenue" DESC,
            "quantity" DESC
          LIMIT ${Math.min(Math.max(limit, 1), 20)}
        `,
    );

    return rows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      quantity: this.toNumber(row.quantity),
      orderCount: this.toNumber(row.orderCount),
      revenue: this.toDecimalString(row.revenue),
    }));
  }

  private async getOrderDetail(orderId: string) {
    const rows = await this.prisma.$queryRaw<OrderDetailRow[]>(
      Prisma.sql`
          SELECT
            o."id",
            o."orderNumber",
            o."userId",
            o."status"::text AS "status",
            o."paymentStatus"::text AS "paymentStatus",
            o."paymentMethod"::text AS "paymentMethod",
            o."totalAmount",
            o."discountAmount",
            o."currency",
            COALESCE(stats."itemCount", 0)::int AS "itemCount",
            COALESCE(stats."totalQuantity", 0)::int AS "totalQuantity",
            COALESCE(stats."failedPaymentCount", 0)::int AS "failedPaymentCount",
            u."email" AS "userEmail",
            u."phone" AS "userPhone",
            o."trackingNumber",
            o."createdAt",
            o."updatedAt"
          FROM "Order" o
          LEFT JOIN "User" u
            ON u."id" = o."userId"
          LEFT JOIN LATERAL (
            SELECT
              COUNT(oi."id")::int AS "itemCount",
              COALESCE(SUM(oi."quantity"), 0)::int AS "totalQuantity",
              (
                SELECT COUNT(*)::int
                FROM "Payment" p
                WHERE
                  p."orderId" = o."id"
                  AND p."deleted_at" IS NULL
                  AND p."paymentStatus"::text = 'FAILED'
              ) AS "failedPaymentCount"
            FROM "OrderItem" oi
            WHERE oi."orderId" = o."id"
          ) stats ON TRUE
          WHERE
            o."id" = ${orderId}
            AND o."deleted_at" IS NULL
          LIMIT 1
        `,
    );

    const row = rows[0];

    if (!row) {
      throw new BadRequestException('سفارش موردنظر برای خلاصه‌سازی پیدا نشد.');
    }

    return {
      id: row.id,
      orderNumber: row.orderNumber,
      userId: row.userId,
      customer: {
        email: row.userEmail,
        phone: row.userPhone,
      },
      status: row.status,
      paymentStatus: row.paymentStatus,
      paymentMethod: row.paymentMethod,
      totalAmount: this.toDecimalString(row.totalAmount),
      discountAmount: this.toDecimalString(row.discountAmount),
      currency: row.currency,
      itemCount: this.toNumber(row.itemCount),
      totalQuantity: this.toNumber(row.totalQuantity),
      failedPaymentCount: this.toNumber(row.failedPaymentCount),
      trackingNumber: row.trackingNumber,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async getOrderTimeline(orderId: string, limit: number) {
    const rows = await this.prisma.$queryRaw<TimelineRow[]>(
      Prisma.sql`
          SELECT *
          FROM (
            SELECT
              'payment'::text AS "source",
              'پرداخت سفارش'::text AS "title",
              p."paymentMethod"::text AS "description",
              p."paymentStatus"::text AS "status",
              p."amount" AS "amount",
              p."currency" AS "currency",
              p."createdAt" AS "occurredAt"
            FROM "Payment" p
            WHERE
              p."orderId" = ${orderId}
              AND p."deleted_at" IS NULL

            UNION ALL

            SELECT
              'refund'::text AS "source",
              'بازگشت وجه سفارش'::text AS "title",
              r."reason" AS "description",
              r."status"::text AS "status",
              r."amount" AS "amount",
              p."currency" AS "currency",
              r."createdAt" AS "occurredAt"
            FROM "Refund" r
            INNER JOIN "Payment" p
              ON p."id" = r."paymentId"
            WHERE
              p."orderId" = ${orderId}
              AND p."deleted_at" IS NULL
              AND r."deleted_at" IS NULL

            UNION ALL

            SELECT
              'event'::text AS "source",
              e."name" AS "title",
              e."description" AS "description",
              e."category" AS "status",
              NULL::numeric AS "amount",
              NULL::text AS "currency",
              e."timestamp" AS "occurredAt"
            FROM "Event" e
            WHERE
              e."deleted_at" IS NULL
              AND e."data" #>> '{orderId}' = ${orderId}
          ) timeline
          ORDER BY
            timeline."occurredAt" DESC
          LIMIT ${Math.min(Math.max(limit, 1), 50)}
        `,
    );

    return rows.map((row) => ({
      source: row.source,
      title: row.title,
      description: row.description,
      status: row.status,
      amount: row.amount === null ? null : this.toDecimalString(row.amount),
      currency: row.currency,
      occurredAt: row.occurredAt.toISOString(),
    }));
  }

  private analyzeStoreHealth(snapshot: JsonRecord) {
    const orders = this.toRecord(snapshot.orders);
    const payments = this.toRecord(snapshot.payments);
    const refunds = this.toRecord(snapshot.refunds);
    const inventory = this.toRecord(snapshot.inventory);
    const audit = this.toRecord(snapshot.audit);

    let riskScore = 0;
    const priorities: string[] = [];
    const recommendations: string[] = [];

    const pendingOrders = this.toNumber(orders.pendingCount);
    const failedPayments =
      this.toNumber(payments.failedCount) +
      this.toNumber(orders.paymentFailedCount);
    const lowStock = this.toNumber(inventory.lowStockCount);
    const outOfStock = this.toNumber(inventory.outOfStockCount);
    const pendingRefunds = this.toNumber(refunds.pendingCount);
    const criticalEvents =
      this.toNumber(audit.criticalCount) + this.toNumber(audit.errorCount);

    if (pendingOrders > 0) {
      riskScore += Math.min(pendingOrders * 5, 25);
      priorities.push(`${pendingOrders} سفارش در وضعیت انتظار قرار دارد.`);
      recommendations.push(
        'سفارش‌های در انتظار را بررسی و مسیر پردازش یا تماس با مشتری را مشخص کن.',
      );
    }

    if (failedPayments > 0) {
      riskScore += Math.min(failedPayments * 8, 25);
      priorities.push(
        `${failedPayments} پرداخت ناموفق یا سفارش با پرداخت ناموفق شناسایی شد.`,
      );
      recommendations.push(
        'پرداخت‌های ناموفق را برای پیگیری مشتری، خطای درگاه یا تکرار تلاش پرداخت بررسی کن.',
      );
    }

    if (lowStock > 0 || outOfStock > 0) {
      riskScore += Math.min((lowStock + outOfStock) * 5, 25);
      priorities.push(
        `${lowStock} موجودی کم و ${outOfStock} موجودی ناموجود شناسایی شد.`,
      );
      recommendations.push(
        'موجودی کالاهای کم‌موجودی و ناموجود را قبل از کمپین فروش کنترل کن.',
      );
    }

    if (pendingRefunds > 0) {
      riskScore += Math.min(pendingRefunds * 6, 15);
      priorities.push(
        `${pendingRefunds} درخواست بازگشت وجه نیازمند پیگیری است.`,
      );
      recommendations.push(
        'درخواست‌های بازگشت وجه معطل را برای جلوگیری از نارضایتی مشتری بررسی کن.',
      );
    }

    if (criticalEvents > 0) {
      riskScore += Math.min(criticalEvents * 10, 30);
      priorities.push(
        `${criticalEvents} رویداد خطا یا بحرانی در بازه گزارش ثبت شده است.`,
      );
      recommendations.push(
        'رویدادهای خطا و بحرانی را در لاگ عملیاتی بررسی کن.',
      );
    }

    if (priorities.length === 0) {
      priorities.push('مورد فوری برای رسیدگی شناسایی نشد.');
      recommendations.push(
        'مانیتورینگ روزانه سفارش، پرداخت، موجودی و Audit را ادامه بده.',
      );
    }

    const status =
      riskScore >= 60 ? 'critical' : riskScore >= 25 ? 'warning' : 'stable';

    return {
      status,
      riskScore,
      title:
        status === 'critical'
          ? 'نیازمند رسیدگی فوری'
          : status === 'warning'
            ? 'نیازمند پیگیری'
            : 'پایدار',
      summary: `در این بازه ${this.toNumber(orders.orderCount)} سفارش با مجموع فروش ${this.toDecimalString(orders.grossRevenue)} ثبت شده است.`,
      priorities,
      recommendations,
      guardrails: this.readOnlyGuardrails(),
    };
  }

  private analyzeSales(
    orders: JsonRecord,
    payments: JsonRecord,
    topProducts: unknown[],
  ) {
    const orderCount = this.toNumber(orders.orderCount);
    const failedPaymentCount = this.toNumber(payments.failedCount);
    const recommendations: string[] = [];

    if (orderCount < 1) {
      recommendations.push(
        'در بازه انتخاب‌شده سفارشی ثبت نشده است؛ کمپین جذب، محتوای محصول و وضعیت موجودی بررسی شود.',
      );
    } else {
      recommendations.push(
        'محصولات پرفروش همین بازه را برای کمپین، بنر و پیامک هدفمند بررسی کن.',
      );
    }

    if (failedPaymentCount > 0) {
      recommendations.push(
        'پرداخت‌های ناموفق می‌تواند بخشی از فروش ازدست‌رفته باشد؛ پیگیری مشتریان و سلامت درگاه بررسی شود.',
      );
    }

    if (topProducts.length < 1) {
      recommendations.push(
        'داده کافی برای رتبه‌بندی محصولات وجود ندارد؛ پس از ثبت فروش بیشتر دوباره تحلیل بگیر.',
      );
    }

    return {
      title:
        orderCount > 0
          ? 'تحلیل فروش بر اساس سفارش‌های واقعی'
          : 'داده فروش کافی نیست',
      summary: `${orderCount} سفارش با میانگین ارزش سفارش ${this.toDecimalString(orders.averageOrderValue)} ثبت شده است.`,
      findings: [
        `فروش ناخالص: ${this.toDecimalString(orders.grossRevenue)}`,
        `تخفیف ثبت‌شده: ${this.toDecimalString(orders.discountAmount)}`,
        `پرداخت موفق: ${this.toNumber(payments.completedCount)}`,
        `پرداخت ناموفق: ${this.toNumber(payments.failedCount)}`,
      ],
      recommendations,
      guardrails: this.readOnlyGuardrails(),
    };
  }

  private analyzeOrders(metrics: JsonRecord, recentOrders: unknown[]) {
    const pending = this.toNumber(metrics.pendingCount);
    const paymentFailed = this.toNumber(metrics.paymentFailedCount);
    const recommendations: string[] = [];

    if (pending > 0) {
      recommendations.push(
        'سفارش‌های در انتظار را برای کاهش تأخیر پردازش بررسی کن.',
      );
    }

    if (paymentFailed > 0) {
      recommendations.push(
        'سفارش‌های دارای پرداخت ناموفق را برای پیگیری مشتری یا مشکل درگاه بررسی کن.',
      );
    }

    if (recommendations.length < 1) {
      recommendations.push('وضعیت سفارش‌ها در بازه انتخاب‌شده پایدار است.');
    }

    return {
      title: 'خلاصه وضعیت سفارش‌ها',
      summary: `${this.toNumber(metrics.orderCount)} سفارش در بازه انتخاب‌شده بررسی شد.`,
      needsFollowUp: pending + paymentFailed,
      recentOrderCount: recentOrders.length,
      recommendations,
      guardrails: this.readOnlyGuardrails(),
    };
  }

  private analyzeSingleOrder(order: JsonRecord, timeline: unknown[]) {
    const recommendations: string[] = [];

    if (order.paymentStatus === 'FAILED') {
      recommendations.push(
        'پرداخت این سفارش ناموفق است؛ پیگیری مشتری یا بررسی درگاه پیشنهاد می‌شود.',
      );
    }

    if (order.status === 'PENDING' || order.status === 'PROCESSING') {
      recommendations.push(
        'وضعیت سفارش هنوز نهایی نشده است؛ مرحله بعدی پردازش را بررسی کن.',
      );
    }

    if (!order.trackingNumber) {
      recommendations.push(
        'کد رهگیری برای این سفارش ثبت نشده است؛ در صورت ارسال، اطلاعات حمل تکمیل شود.',
      );
    }

    if (recommendations.length < 1) {
      recommendations.push('مورد فوری برای این سفارش شناسایی نشد.');
    }

    return {
      title: `خلاصه سفارش ${this.toText(order.orderNumber, '')}`.trim(),
      summary: `سفارش با وضعیت ${this.toText(order.status, '-')} و وضعیت پرداخت ${this.toText(order.paymentStatus, '-')} بررسی شد.`,
      timelineCount: timeline.length,
      recommendations,
      guardrails: this.readOnlyGuardrails(),
    };
  }

  private assertToolAccess(
    toolName: string,
    context: AiPermissionContext,
    operationTitle: string,
  ): AiToolDefinition {
    const tool = this.toolRegistry.assertToolEnabled(toolName);

    this.permissionGuard.assertAuthenticated(context);

    this.permissionGuard.assertAllowed(
      context,
      tool.requiredPermissions,
      operationTitle,
    );

    return tool;
  }

  private resolveRange(
    createdFrom?: string,
    createdTo?: string,
  ): {
    from: Date;
    to: Date;
  } {
    const to = createdTo ? new Date(createdTo) : new Date();

    const from = createdFrom
      ? new Date(createdFrom)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('بازه زمانی گزارش معتبر نیست.');
    }

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException(
        'تاریخ شروع گزارش نمی‌تواند بعد از تاریخ پایان باشد.',
      );
    }

    return {
      from,
      to,
    };
  }

  private toPublicRange(range: { from: Date; to: Date }) {
    return {
      createdFrom: range.from.toISOString(),
      createdTo: range.to.toISOString(),
    };
  }

  private readOnlyGuardrails(): string[] {
    return [
      'این گزارش فقط خواندنی است و هیچ داده‌ای را تغییر نمی‌دهد.',
      'تحلیل فقط بر اساس داده‌های ثبت‌شده در دیتابیس تولید شده است.',
      'برای عملیات حساس مثل تغییر سفارش، پرداخت، موجودی یا تخفیف باید از مسیرهای مدیریتی دارای مجوز استفاده شود.',
    ];
  }

  private toPublicTool(tool: AiToolDefinition) {
    return {
      name: tool.name,
      title: tool.title,
      riskLevel: tool.riskLevel,
      executionMode: tool.executionMode,
      requiresApproval: tool.requiresApproval,
    };
  }

  private toDecimalString(value: unknown): string {
    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'bigint'
    ) {
      return '0.00';
    }

    try {
      return new Prisma.Decimal(String(value)).toFixed(2);
    } catch {
      return '0.00';
    }
  }

  private toNumber(value: unknown): number {
    if (value instanceof Prisma.Decimal) {
      return value.toNumber();
    }

    switch (typeof value) {
      case 'number':
        return value;
      case 'bigint':
        return Number(value);
      case 'string':
        return Number(value);
      case 'boolean':
        return Number(value);
      default:
        return 0;
    }
  }

  private toText(value: unknown, fallback: string): string {
    switch (typeof value) {
      case 'string':
        return value;
      case 'number':
        return String(value);
      case 'bigint':
        return String(value);
      case 'boolean':
        return String(value);
      default:
        return fallback;
    }
  }

  private toRecord(value: unknown): JsonRecord {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as JsonRecord;
    }

    return {};
  }
}
