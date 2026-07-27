import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminOperationsDigestQueryDto } from '../dto/admin-operations-digest-query.dto';

type DigestLevel = 'stable' | 'attention_required' | 'high_risk' | 'critical';

type DigestMetricRow = {
  totalOrders: number | bigint;
  pendingOrders: number | bigint;
  stalePendingOrders: number | bigint;
  completedPayments: number | bigint;
  failedPayments: number | bigint;
  completedPaymentAmount: Prisma.Decimal | number | string | null;
  failedPaymentAmount: Prisma.Decimal | number | string | null;
  pendingRefunds: number | bigint;
  failedRefunds: number | bigint;
  lowStockRows: number | bigint;
  outOfStockRows: number | bigint;
  unreadSystemNotifications: number | bigint;
  warningAuditLogs: number | bigint;
  errorAuditLogs: number | bigint;
  criticalAuditLogs: number | bigint;
};

type DigestPriorityItem = {
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  actionUrl: string;
};

type OperationsDigestResponse = {
  meta: {
    generatedAt: string;
    requestedBy: string;
    mode: 'compact' | 'full';
    currency: string | null;
    createdFrom: string | null;
    createdTo: string | null;
  };
  status: {
    level: DigestLevel;
    score: number;
    title: string;
    message: string;
  };
  summary: {
    orders: string;
    payments: string;
    refunds: string;
    inventory: string;
    security: string;
  };
  metrics: {
    orders: {
      total: number;
      pending: number;
      stalePending: number;
    };
    payments: {
      completed: number;
      failed: number;
      completedAmount: string;
      failedAmount: string;
    };
    refunds: {
      pending: number;
      failed: number;
    };
    inventory: {
      lowStock: number;
      outOfStock: number;
    };
    notifications: {
      unreadSystem: number;
    };
    audit: {
      warning: number;
      error: number;
      critical: number;
    };
  };
  priorities: DigestPriorityItem[];
  recommendations: string[];
};

@Injectable()
export class AdminOperationsDigestService {
  constructor(private readonly prisma: PrismaService) {}

  async getDigest(
    query: AdminOperationsDigestQueryDto,
    actorId: string,
  ): Promise<OperationsDigestResponse> {
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

    const mode = query.mode ?? 'compact';

    const rows = await this.getMetrics(query, createdFrom, createdTo);

    const metrics = rows[0] ?? this.emptyMetrics();

    const normalized = this.normalizeMetrics(metrics);

    const status = this.buildStatus(normalized);

    const priorities = this.buildPriorities(normalized);

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        requestedBy: actorId,
        mode,
        currency: query.currency ?? null,
        createdFrom: createdFrom ? createdFrom.toISOString() : null,
        createdTo: createdTo ? createdTo.toISOString() : null,
      },
      status,
      summary: this.buildSummary(normalized, query.currency),
      metrics: normalized,
      priorities: mode === 'compact' ? priorities.slice(0, 5) : priorities,
      recommendations: this.buildRecommendations(normalized),
    };
  }

  private getMetrics(
    query: AdminOperationsDigestQueryDto,
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Promise<DigestMetricRow[]> {
    const orderWhere = this.buildBaseWhere('o', createdFrom, createdTo);

    const paymentWhere = this.buildBaseWhere('p', createdFrom, createdTo);

    const refundWhere = this.buildBaseWhere('r', createdFrom, createdTo);

    const notificationWhere = this.buildBaseWhere('n', createdFrom, createdTo);

    const auditWhere = this.buildEventWhere(createdFrom, createdTo);

    if (query.currency) {
      orderWhere.push(Prisma.sql`o."currency" = ${query.currency}`);

      paymentWhere.push(Prisma.sql`p."currency" = ${query.currency}`);
    }

    return this.prisma.$queryRaw<DigestMetricRow[]>(
      Prisma.sql`
        SELECT
          (
            SELECT COUNT(*)::int
            FROM "Order" o
            WHERE ${Prisma.join(orderWhere, ' AND ')}
          ) AS "totalOrders",

          (
            SELECT COUNT(*)::int
            FROM "Order" o
            WHERE
              ${Prisma.join(orderWhere, ' AND ')}
              AND o."status"::text IN ('PENDING', 'CONFIRMED')
          ) AS "pendingOrders",

          (
            SELECT COUNT(*)::int
            FROM "Order" o
            WHERE
              ${Prisma.join(orderWhere, ' AND ')}
              AND o."status"::text IN ('PENDING', 'CONFIRMED')
              AND o."createdAt" <= NOW() - INTERVAL '24 hours'
          ) AS "stalePendingOrders",

          (
            SELECT COUNT(*)::int
            FROM "Payment" p
            WHERE
              ${Prisma.join(paymentWhere, ' AND ')}
              AND p."paymentStatus"::text = 'COMPLETED'
          ) AS "completedPayments",

          (
            SELECT COUNT(*)::int
            FROM "Payment" p
            WHERE
              ${Prisma.join(paymentWhere, ' AND ')}
              AND p."paymentStatus"::text = 'FAILED'
          ) AS "failedPayments",

          (
            SELECT COALESCE(SUM(p."amount"), 0)
            FROM "Payment" p
            WHERE
              ${Prisma.join(paymentWhere, ' AND ')}
              AND p."paymentStatus"::text = 'COMPLETED'
          ) AS "completedPaymentAmount",

          (
            SELECT COALESCE(SUM(p."amount"), 0)
            FROM "Payment" p
            WHERE
              ${Prisma.join(paymentWhere, ' AND ')}
              AND p."paymentStatus"::text = 'FAILED'
          ) AS "failedPaymentAmount",

          (
            SELECT COUNT(*)::int
            FROM "Refund" r
            LEFT JOIN "Payment" rp
              ON rp."id" = r."paymentId"
              AND rp."deleted_at" IS NULL
            WHERE
              ${Prisma.join(refundWhere, ' AND ')}
              AND r."status"::text IN ('PENDING', 'PROCESSING')
              ${
                query.currency
                  ? Prisma.sql`AND rp."currency" = ${query.currency}`
                  : Prisma.sql``
              }
          ) AS "pendingRefunds",

          (
            SELECT COUNT(*)::int
            FROM "Refund" r
            LEFT JOIN "Payment" rp
              ON rp."id" = r."paymentId"
              AND rp."deleted_at" IS NULL
            WHERE
              ${Prisma.join(refundWhere, ' AND ')}
              AND r."status"::text = 'FAILED'
              ${
                query.currency
                  ? Prisma.sql`AND rp."currency" = ${query.currency}`
                  : Prisma.sql``
              }
          ) AS "failedRefunds",

          (
            SELECT COUNT(*)::int
            FROM "Inventory" i
            WHERE
              GREATEST(
                i."quantity" - i."reservedQuantity",
                0
              ) <= i."lowStockThreshold"
          ) AS "lowStockRows",

          (
            SELECT COUNT(*)::int
            FROM "Inventory" i
            WHERE
              GREATEST(
                i."quantity" - i."reservedQuantity",
                0
              ) <= 0
          ) AS "outOfStockRows",

          (
            SELECT COUNT(*)::int
            FROM "Notification" n
            WHERE
              ${Prisma.join(notificationWhere, ' AND ')}
              AND n."isActive" = TRUE
              AND n."isRead" = FALSE
              AND n."type"::text = 'SYSTEM'
          ) AS "unreadSystemNotifications",

          (
            SELECT COUNT(*)::int
            FROM "Event" e
            WHERE
              ${Prisma.join(auditWhere, ' AND ')}
              AND COALESCE(e."data" #>> '{severity}', 'info') = 'warning'
          ) AS "warningAuditLogs",

          (
            SELECT COUNT(*)::int
            FROM "Event" e
            WHERE
              ${Prisma.join(auditWhere, ' AND ')}
              AND COALESCE(e."data" #>> '{severity}', 'info') = 'error'
          ) AS "errorAuditLogs",

          (
            SELECT COUNT(*)::int
            FROM "Event" e
            WHERE
              ${Prisma.join(auditWhere, ' AND ')}
              AND COALESCE(e."data" #>> '{severity}', 'info') = 'critical'
          ) AS "criticalAuditLogs"
      `,
    );
  }

  private normalizeMetrics(
    row: DigestMetricRow,
  ): OperationsDigestResponse['metrics'] {
    return {
      orders: {
        total: this.toNumber(row.totalOrders),
        pending: this.toNumber(row.pendingOrders),
        stalePending: this.toNumber(row.stalePendingOrders),
      },
      payments: {
        completed: this.toNumber(row.completedPayments),
        failed: this.toNumber(row.failedPayments),
        completedAmount: this.toDecimalString(row.completedPaymentAmount),
        failedAmount: this.toDecimalString(row.failedPaymentAmount),
      },
      refunds: {
        pending: this.toNumber(row.pendingRefunds),
        failed: this.toNumber(row.failedRefunds),
      },
      inventory: {
        lowStock: this.toNumber(row.lowStockRows),
        outOfStock: this.toNumber(row.outOfStockRows),
      },
      notifications: {
        unreadSystem: this.toNumber(row.unreadSystemNotifications),
      },
      audit: {
        warning: this.toNumber(row.warningAuditLogs),
        error: this.toNumber(row.errorAuditLogs),
        critical: this.toNumber(row.criticalAuditLogs),
      },
    };
  }

  private buildStatus(
    metrics: OperationsDigestResponse['metrics'],
  ): OperationsDigestResponse['status'] {
    let score = 0;

    score += metrics.audit.critical * 35;

    score += metrics.audit.error * 20;

    score += metrics.payments.failed * 8;

    score += metrics.refunds.failed * 10;

    score += metrics.inventory.outOfStock * 8;

    score += metrics.orders.stalePending * 5;

    score += metrics.refunds.pending * 3;

    if (metrics.notifications.unreadSystem > 20) {
      score += 10;
    }

    const normalizedScore = Math.min(100, score);

    if (normalizedScore >= 80) {
      return {
        level: 'critical',
        score: normalizedScore,
        title: 'وضعیت بحرانی',
        message: 'فروشگاه نیازمند رسیدگی فوری مدیریتی است.',
      };
    }

    if (normalizedScore >= 50) {
      return {
        level: 'high_risk',
        score: normalizedScore,
        title: 'ریسک بالا',
        message: 'چند هشدار جدی در عملیات فروشگاه وجود دارد.',
      };
    }

    if (normalizedScore >= 20) {
      return {
        level: 'attention_required',
        score: normalizedScore,
        title: 'نیازمند توجه',
        message: 'وضعیت کلی قابل قبول است اما چند مورد نیاز به بررسی دارد.',
      };
    }

    return {
      level: 'stable',
      score: normalizedScore,
      title: 'پایدار',
      message: 'وضعیت کلی فروشگاه پایدار است.',
    };
  }

  private buildSummary(
    metrics: OperationsDigestResponse['metrics'],
    currency?: string,
  ): OperationsDigestResponse['summary'] {
    return {
      orders: `${metrics.orders.total} سفارش ثبت شده، ${metrics.orders.pending} سفارش در انتظار و ${metrics.orders.stalePending} سفارش معطل‌شده وجود دارد.`,
      payments: `${metrics.payments.completed} پرداخت موفق با مجموع ${metrics.payments.completedAmount} ${currency ?? ''} و ${metrics.payments.failed} پرداخت ناموفق ثبت شده است.`,
      refunds: `${metrics.refunds.pending} درخواست بازگشت وجه در انتظار رسیدگی و ${metrics.refunds.failed} بازگشت وجه ناموفق وجود دارد.`,
      inventory: `${metrics.inventory.lowStock} موجودی کم و ${metrics.inventory.outOfStock} موجودی ناموجود شناسایی شده است.`,
      security: `${metrics.audit.warning} هشدار Audit، ${metrics.audit.error} خطای Audit و ${metrics.audit.critical} رویداد بحرانی ثبت شده است.`,
    };
  }

  private buildPriorities(
    metrics: OperationsDigestResponse['metrics'],
  ): DigestPriorityItem[] {
    const priorities: DigestPriorityItem[] = [];

    if (metrics.audit.critical > 0) {
      priorities.push({
        priority: 'critical',
        title: 'بررسی رویدادهای Audit بحرانی',
        description: `${metrics.audit.critical} رویداد بحرانی ثبت شده است.`,
        actionUrl: '/admin/audit-logs?severity=critical',
      });
    }

    if (metrics.inventory.outOfStock > 0) {
      priorities.push({
        priority: 'critical',
        title: 'رسیدگی به موجودی‌های ناموجود',
        description: `${metrics.inventory.outOfStock} ردیف موجودی ناموجود شده است.`,
        actionUrl: '/admin/inventory?status=out-of-stock',
      });
    }

    if (metrics.audit.error > 0) {
      priorities.push({
        priority: 'high',
        title: 'بررسی خطاهای Audit',
        description: `${metrics.audit.error} رویداد با سطح خطا ثبت شده است.`,
        actionUrl: '/admin/audit-logs?severity=error',
      });
    }

    if (metrics.payments.failed > 0) {
      priorities.push({
        priority: 'high',
        title: 'پیگیری پرداخت‌های ناموفق',
        description: `${metrics.payments.failed} پرداخت ناموفق وجود دارد.`,
        actionUrl: '/admin/payments?status=FAILED',
      });
    }

    if (metrics.refunds.failed > 0) {
      priorities.push({
        priority: 'high',
        title: 'رسیدگی به بازگشت وجه‌های ناموفق',
        description: `${metrics.refunds.failed} بازگشت وجه ناموفق وجود دارد.`,
        actionUrl: '/admin/refunds?status=FAILED',
      });
    }

    if (metrics.orders.stalePending > 0) {
      priorities.push({
        priority: 'medium',
        title: 'بررسی سفارش‌های معطل‌شده',
        description: `${metrics.orders.stalePending} سفارش بیش از ۲۴ ساعت معطل مانده است.`,
        actionUrl: '/admin/action-center',
      });
    }

    if (metrics.refunds.pending > 0) {
      priorities.push({
        priority: 'medium',
        title: 'بررسی درخواست‌های بازگشت وجه',
        description: `${metrics.refunds.pending} درخواست بازگشت وجه در انتظار رسیدگی است.`,
        actionUrl: '/admin/refunds',
      });
    }

    if (metrics.inventory.lowStock > 0) {
      priorities.push({
        priority: 'medium',
        title: 'بررسی موجودی‌های کم',
        description: `${metrics.inventory.lowStock} موجودی به آستانه هشدار رسیده است.`,
        actionUrl: '/admin/inventory?status=low-stock',
      });
    }

    if (priorities.length === 0) {
      priorities.push({
        priority: 'low',
        title: 'وضعیت پایدار',
        description: 'مورد فوری برای رسیدگی شناسایی نشد.',
        actionUrl: '/admin/enterprise-dashboard',
      });
    }

    return priorities.sort(
      (first, second) =>
        this.priorityWeight(second.priority) -
        this.priorityWeight(first.priority),
    );
  }

  private buildRecommendations(
    metrics: OperationsDigestResponse['metrics'],
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.audit.critical > 0 || metrics.audit.error > 0) {
      recommendations.push(
        'ابتدا رویدادهای حساس Audit را بررسی کن و در صورت نیاز دسترسی‌های مشکوک را محدود کن.',
      );
    }

    if (metrics.payments.failed > 0) {
      recommendations.push('لاگ پرداخت‌های ناموفق و پاسخ درگاه را بررسی کن.');
    }

    if (metrics.inventory.outOfStock > 0 || metrics.inventory.lowStock > 0) {
      recommendations.push(
        'موجودی کالاهای کم یا ناموجود را به‌روزرسانی کن تا فروش متوقف نشود.',
      );
    }

    if (metrics.orders.stalePending > 0) {
      recommendations.push(
        'سفارش‌های معطل‌شده را تعیین تکلیف کن تا تجربه مشتری آسیب نبیند.',
      );
    }

    if (metrics.refunds.pending > 0 || metrics.refunds.failed > 0) {
      recommendations.push(
        'درخواست‌های بازگشت وجه را بررسی و موارد ناموفق را دوباره پردازش کن.',
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'مانیتورینگ روزانه سفارش، پرداخت، موجودی و Audit را ادامه بده.',
      );
    }

    return recommendations;
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

  private priorityWeight(priority: DigestPriorityItem['priority']): number {
    if (priority === 'critical') {
      return 4;
    }

    if (priority === 'high') {
      return 3;
    }

    if (priority === 'medium') {
      return 2;
    }

    return 1;
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

  private emptyMetrics(): DigestMetricRow {
    return {
      totalOrders: 0,
      pendingOrders: 0,
      stalePendingOrders: 0,
      completedPayments: 0,
      failedPayments: 0,
      completedPaymentAmount: 0,
      failedPaymentAmount: 0,
      pendingRefunds: 0,
      failedRefunds: 0,
      lowStockRows: 0,
      outOfStockRows: 0,
      unreadSystemNotifications: 0,
      warningAuditLogs: 0,
      errorAuditLogs: 0,
      criticalAuditLogs: 0,
    };
  }
}
