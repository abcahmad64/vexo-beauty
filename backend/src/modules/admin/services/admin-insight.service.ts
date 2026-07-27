import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminInsightQueryDto } from '../dto/admin-insight-query.dto';

type InsightSeverity = 'info' | 'warning' | 'error' | 'critical';

type InsightCategory =
  | 'sales'
  | 'payment'
  | 'refund'
  | 'inventory'
  | 'invoice'
  | 'notification'
  | 'security'
  | 'operations';

type InsightMetricRow = {
  stalePendingOrders: number | bigint;
  cancelledOrders: number | bigint;
  failedPayments: number | bigint;
  failedPaymentAmount: Prisma.Decimal | number | string | null;
  pendingRefunds: number | bigint;
  processingRefunds: number | bigint;
  failedRefunds: number | bigint;
  pendingRefundAmount: Prisma.Decimal | number | string | null;
  overdueInvoices: number | bigint;
  pendingInvoices: number | bigint;
  overdueInvoiceAmount: Prisma.Decimal | number | string | null;
  lowStockRows: number | bigint;
  outOfStockRows: number | bigint;
  unreadSystemNotifications: number | bigint;
  warningAuditLogs: number | bigint;
  errorAuditLogs: number | bigint;
  criticalAuditLogs: number | bigint;
};

type AdminInsightItem = {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  actionUrl: string;
  metric: {
    key: string;
    value: number | string;
  };
  metadata: Record<string, unknown>;
};

type AdminInsightResponse = {
  meta: {
    generatedAt: string;
    requestedBy: string;
    currency: string | null;
    createdFrom: string | null;
    createdTo: string | null;
  };
  score: {
    value: number;
    level: 'low' | 'medium' | 'high' | 'critical';
  };
  summary: {
    totalInsights: number;
    critical: number;
    error: number;
    warning: number;
    info: number;
  };
  insights: AdminInsightItem[];
};

@Injectable()
export class AdminInsightService {
  constructor(private readonly prisma: PrismaService) {}

  async getInsights(
    query: AdminInsightQueryDto,
    actorId: string,
  ): Promise<AdminInsightResponse> {
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

    const metrics = await this.getMetrics(query, createdFrom, createdTo);

    const row = metrics[0] ?? this.emptyMetrics();

    const insights = this.buildInsights(row, query.currency);

    const score = this.buildScore(insights);

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        requestedBy: actorId,
        currency: query.currency ?? null,
        createdFrom: createdFrom ? createdFrom.toISOString() : null,
        createdTo: createdTo ? createdTo.toISOString() : null,
      },
      score,
      summary: this.buildSummary(insights),
      insights,
    };
  }

  private async getMetrics(
    query: AdminInsightQueryDto,
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Promise<InsightMetricRow[]> {
    const orderWhere = this.buildBaseWhere('o', createdFrom, createdTo);

    const paymentWhere = this.buildBaseWhere('p', createdFrom, createdTo);

    const refundWhere = this.buildBaseWhere('r', createdFrom, createdTo);

    const invoiceWhere = this.buildBaseWhere('i', createdFrom, createdTo);

    const notificationWhere = this.buildBaseWhere('n', createdFrom, createdTo);

    const auditWhere = this.buildEventWhere(createdFrom, createdTo);

    if (query.currency) {
      orderWhere.push(Prisma.sql`o."currency" = ${query.currency}`);

      paymentWhere.push(Prisma.sql`p."currency" = ${query.currency}`);

      invoiceWhere.push(Prisma.sql`i."currency" = ${query.currency}`);
    }

    return this.prisma.$queryRaw<InsightMetricRow[]>(
      Prisma.sql`
        SELECT
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
            FROM "Order" o
            WHERE
              ${Prisma.join(orderWhere, ' AND ')}
              AND o."status"::text = 'CANCELLED'
          ) AS "cancelledOrders",

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
              AND r."status"::text = 'PENDING'
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
              AND r."status"::text = 'PROCESSING'
              ${
                query.currency
                  ? Prisma.sql`AND rp."currency" = ${query.currency}`
                  : Prisma.sql``
              }
          ) AS "processingRefunds",

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
            SELECT COALESCE(SUM(r."amount"), 0)
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
          ) AS "pendingRefundAmount",

          (
            SELECT COUNT(*)::int
            FROM "Invoice" i
            WHERE
              ${Prisma.join(invoiceWhere, ' AND ')}
              AND i."status"::text = 'OVERDUE'
          ) AS "overdueInvoices",

          (
            SELECT COUNT(*)::int
            FROM "Invoice" i
            WHERE
              ${Prisma.join(invoiceWhere, ' AND ')}
              AND i."status"::text = 'PENDING'
          ) AS "pendingInvoices",

          (
            SELECT COALESCE(SUM(i."amount"), 0)
            FROM "Invoice" i
            WHERE
              ${Prisma.join(invoiceWhere, ' AND ')}
              AND i."status"::text = 'OVERDUE'
          ) AS "overdueInvoiceAmount",

          (
            SELECT COUNT(*)::int
            FROM "Inventory" inv
            WHERE
              GREATEST(inv."quantity" - inv."reservedQuantity", 0)
              <= inv."lowStockThreshold"
          ) AS "lowStockRows",

          (
            SELECT COUNT(*)::int
            FROM "Inventory" inv
            WHERE
              GREATEST(inv."quantity" - inv."reservedQuantity", 0) <= 0
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

  private buildInsights(
    metrics: InsightMetricRow,
    currency?: string,
  ): AdminInsightItem[] {
    const insights: AdminInsightItem[] = [];

    const stalePendingOrders = this.toNumber(metrics.stalePendingOrders);

    if (stalePendingOrders > 0) {
      insights.push({
        id: 'operations.stale-pending-orders',
        category: 'operations',
        severity: stalePendingOrders >= 10 ? 'error' : 'warning',
        title: 'سفارش‌های معطل‌شده نیاز به رسیدگی دارند',
        description: `${stalePendingOrders} سفارش بیش از ۲۴ ساعت در وضعیت در انتظار یا تأییدشده باقی مانده است.`,
        impact:
          'تأخیر در پردازش سفارش می‌تواند باعث نارضایتی مشتری و افزایش درخواست پشتیبانی شود.',
        recommendation:
          'وضعیت سفارش‌ها را بررسی کن، پرداخت‌های ناقص را پیگیری کن و سفارش‌های آماده را وارد مرحله پردازش کن.',
        actionUrl: '/admin/action-center',
        metric: {
          key: 'stalePendingOrders',
          value: stalePendingOrders,
        },
        metadata: {
          stalePendingOrders,
        },
      });
    }

    const failedPayments = this.toNumber(metrics.failedPayments);

    if (failedPayments > 0) {
      insights.push({
        id: 'payment.failed-payments',
        category: 'payment',
        severity: failedPayments >= 10 ? 'error' : 'warning',
        title: 'پرداخت‌های ناموفق افزایش یافته‌اند',
        description: `${failedPayments} پرداخت ناموفق با مجموع مبلغ ${this.toDecimalString(metrics.failedPaymentAmount)} ${currency ?? ''} ثبت شده است.`,
        impact:
          'پرداخت ناموفق مستقیماً روی نرخ تبدیل و درآمد فروشگاه اثر می‌گذارد.',
        recommendation:
          'لاگ پرداخت‌ها، پاسخ درگاه، وضعیت callback و خطاهای Gateway را بررسی کن.',
        actionUrl: '/admin/payments?status=FAILED',
        metric: {
          key: 'failedPayments',
          value: failedPayments,
        },
        metadata: {
          failedPayments,
          failedPaymentAmount: this.toDecimalString(
            metrics.failedPaymentAmount,
          ),
          currency: currency ?? null,
        },
      });
    }

    const pendingRefunds = this.toNumber(metrics.pendingRefunds);

    const processingRefunds = this.toNumber(metrics.processingRefunds);

    if (pendingRefunds + processingRefunds > 0) {
      insights.push({
        id: 'refund.pending-refunds',
        category: 'refund',
        severity: pendingRefunds + processingRefunds >= 10 ? 'warning' : 'info',
        title: 'درخواست‌های بازگشت وجه در انتظار رسیدگی هستند',
        description: `${pendingRefunds} درخواست در انتظار و ${processingRefunds} درخواست در حال پردازش وجود دارد.`,
        impact:
          'تأخیر در Refund می‌تواند باعث افزایش نارضایتی و تیکت‌های پشتیبانی شود.',
        recommendation:
          'درخواست‌های بازگشت وجه را بررسی، تأیید یا رد کن و موارد پردازشی را تکمیل کن.',
        actionUrl: '/admin/refunds',
        metric: {
          key: 'pendingRefunds',
          value: pendingRefunds + processingRefunds,
        },
        metadata: {
          pendingRefunds,
          processingRefunds,
          pendingRefundAmount: this.toDecimalString(
            metrics.pendingRefundAmount,
          ),
          currency: currency ?? null,
        },
      });
    }

    const failedRefunds = this.toNumber(metrics.failedRefunds);

    if (failedRefunds > 0) {
      insights.push({
        id: 'refund.failed-refunds',
        category: 'refund',
        severity: 'error',
        title: 'بازگشت وجه ناموفق ثبت شده است',
        description: `${failedRefunds} عملیات بازگشت وجه ناموفق شده است.`,
        impact: 'Refund ناموفق یک ریسک مالی و پشتیبانی جدی است.',
        recommendation:
          'علت خطا را بررسی کن و پس از اصلاح وضعیت پرداخت، عملیات را دوباره انجام بده.',
        actionUrl: '/admin/refunds?status=FAILED',
        metric: {
          key: 'failedRefunds',
          value: failedRefunds,
        },
        metadata: {
          failedRefunds,
        },
      });
    }

    const overdueInvoices = this.toNumber(metrics.overdueInvoices);

    if (overdueInvoices > 0) {
      insights.push({
        id: 'invoice.overdue-invoices',
        category: 'invoice',
        severity: overdueInvoices >= 10 ? 'warning' : 'info',
        title: 'فاکتورهای سررسیدگذشته وجود دارد',
        description: `${overdueInvoices} فاکتور سررسیدگذشته با مجموع مبلغ ${this.toDecimalString(metrics.overdueInvoiceAmount)} ${currency ?? ''} وجود دارد.`,
        impact:
          'فاکتورهای سررسیدگذشته می‌توانند باعث ابهام مالی و اختلال حساب شوند.',
        recommendation:
          'فاکتورهای سررسیدگذشته را بررسی و وضعیت آن‌ها را با پرداخت یا سفارش مرتبط هماهنگ کن.',
        actionUrl: '/admin/invoices?status=OVERDUE',
        metric: {
          key: 'overdueInvoices',
          value: overdueInvoices,
        },
        metadata: {
          overdueInvoices,
          overdueInvoiceAmount: this.toDecimalString(
            metrics.overdueInvoiceAmount,
          ),
          currency: currency ?? null,
        },
      });
    }

    const outOfStockRows = this.toNumber(metrics.outOfStockRows);

    if (outOfStockRows > 0) {
      insights.push({
        id: 'inventory.out-of-stock',
        category: 'inventory',
        severity: 'critical',
        title: 'بعضی موجودی‌ها تمام شده‌اند',
        description: `${outOfStockRows} ردیف موجودی در وضعیت ناموجود قرار دارد.`,
        impact: 'ناموجودی باعث از دست رفتن فروش و تجربه بد مشتری می‌شود.',
        recommendation:
          'واریانت‌های ناموجود را بررسی کن، تأمین موجودی انجام بده یا محصول را موقتاً غیرفعال کن.',
        actionUrl: '/admin/inventory?status=out-of-stock',
        metric: {
          key: 'outOfStockRows',
          value: outOfStockRows,
        },
        metadata: {
          outOfStockRows,
        },
      });
    }

    const lowStockRows = this.toNumber(metrics.lowStockRows);

    if (lowStockRows > 0 && outOfStockRows === 0) {
      insights.push({
        id: 'inventory.low-stock',
        category: 'inventory',
        severity: 'warning',
        title: 'موجودی بعضی کالاها کم شده است',
        description: `${lowStockRows} ردیف موجودی به آستانه هشدار رسیده است.`,
        impact:
          'اگر موجودی به‌موقع تأمین نشود، سفارش‌های آینده با مشکل روبه‌رو می‌شوند.',
        recommendation:
          'موجودی کالاهای پرفروش و واریانت‌های کم‌موجودی را سریعاً بررسی کن.',
        actionUrl: '/admin/inventory?status=low-stock',
        metric: {
          key: 'lowStockRows',
          value: lowStockRows,
        },
        metadata: {
          lowStockRows,
        },
      });
    }

    const criticalAuditLogs = this.toNumber(metrics.criticalAuditLogs);

    if (criticalAuditLogs > 0) {
      insights.push({
        id: 'security.critical-audit',
        category: 'security',
        severity: 'critical',
        title: 'رویداد Audit بحرانی ثبت شده است',
        description: `${criticalAuditLogs} رویداد بحرانی در گزارش فعالیت‌ها وجود دارد.`,
        impact:
          'رویداد بحرانی می‌تواند نشانه ریسک امنیتی، مالی یا عملیاتی باشد.',
        recommendation:
          'جزئیات Audit را بررسی کن و در صورت نیاز دسترسی کاربر یا وضعیت عملیات مرتبط را محدود کن.',
        actionUrl: '/admin/audit-logs?severity=critical',
        metric: {
          key: 'criticalAuditLogs',
          value: criticalAuditLogs,
        },
        metadata: {
          criticalAuditLogs,
        },
      });
    }

    const errorAuditLogs = this.toNumber(metrics.errorAuditLogs);

    if (errorAuditLogs > 0) {
      insights.push({
        id: 'security.error-audit',
        category: 'security',
        severity: 'error',
        title: 'رویدادهای خطادار در Audit وجود دارد',
        description: `${errorAuditLogs} رویداد با سطح خطا ثبت شده است.`,
        impact:
          'خطاهای Audit ممکن است نشان‌دهنده شکست در عملیات‌های مهم باشند.',
        recommendation:
          'رویدادهای خطادار را بر اساس ماژول، کاربر و entity بررسی کن.',
        actionUrl: '/admin/audit-logs?severity=error',
        metric: {
          key: 'errorAuditLogs',
          value: errorAuditLogs,
        },
        metadata: {
          errorAuditLogs,
        },
      });
    }

    const unreadSystemNotifications = this.toNumber(
      metrics.unreadSystemNotifications,
    );

    if (unreadSystemNotifications > 20) {
      insights.push({
        id: 'notification.unread-system',
        category: 'notification',
        severity: 'warning',
        title: 'اعلان‌های سیستمی خوانده‌نشده زیاد شده‌اند',
        description: `${unreadSystemNotifications} اعلان سیستمی خوانده‌نشده وجود دارد.`,
        impact:
          'نادیده‌گرفتن اعلان‌های سیستمی می‌تواند باعث از دست رفتن هشدارهای مهم شود.',
        recommendation: 'اعلان‌های سیستمی را بررسی و موارد مهم را پیگیری کن.',
        actionUrl: '/admin/notifications?type=SYSTEM&isRead=false',
        metric: {
          key: 'unreadSystemNotifications',
          value: unreadSystemNotifications,
        },
        metadata: {
          unreadSystemNotifications,
        },
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: 'operations.system-stable',
        category: 'operations',
        severity: 'info',
        title: 'وضعیت کلی سیستم پایدار است',
        description: 'در بازه انتخاب‌شده هشدار جدی مدیریتی شناسایی نشد.',
        impact: 'عملیات فروشگاه در وضعیت عادی قرار دارد.',
        recommendation:
          'مانیتورینگ روزانه سفارش‌ها، پرداخت‌ها، موجودی و Audit را ادامه بده.',
        actionUrl: '/admin/enterprise-dashboard',
        metric: {
          key: 'systemStable',
          value: 1,
        },
        metadata: {},
      });
    }

    return insights.sort(
      (first, second) =>
        this.severityWeight(second.severity) -
        this.severityWeight(first.severity),
    );
  }

  private buildScore(
    insights: AdminInsightItem[],
  ): AdminInsightResponse['score'] {
    const value = Math.min(
      100,
      insights.reduce(
        (sum, insight) => sum + this.scoreWeight(insight.severity),
        0,
      ),
    );

    if (value >= 80) {
      return {
        value,
        level: 'critical',
      };
    }

    if (value >= 50) {
      return {
        value,
        level: 'high',
      };
    }

    if (value >= 20) {
      return {
        value,
        level: 'medium',
      };
    }

    return {
      value,
      level: 'low',
    };
  }

  private buildSummary(
    insights: AdminInsightItem[],
  ): AdminInsightResponse['summary'] {
    return {
      totalInsights: insights.length,
      critical: insights.filter((item) => item.severity === 'critical').length,
      error: insights.filter((item) => item.severity === 'error').length,
      warning: insights.filter((item) => item.severity === 'warning').length,
      info: insights.filter((item) => item.severity === 'info').length,
    };
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

  private scoreWeight(severity: InsightSeverity): number {
    if (severity === 'critical') {
      return 35;
    }

    if (severity === 'error') {
      return 25;
    }

    if (severity === 'warning') {
      return 15;
    }

    return 0;
  }

  private severityWeight(severity: InsightSeverity): number {
    if (severity === 'critical') {
      return 4;
    }

    if (severity === 'error') {
      return 3;
    }

    if (severity === 'warning') {
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

  private emptyMetrics(): InsightMetricRow {
    return {
      stalePendingOrders: 0,
      cancelledOrders: 0,
      failedPayments: 0,
      failedPaymentAmount: 0,
      pendingRefunds: 0,
      processingRefunds: 0,
      failedRefunds: 0,
      pendingRefundAmount: 0,
      overdueInvoices: 0,
      pendingInvoices: 0,
      overdueInvoiceAmount: 0,
      lowStockRows: 0,
      outOfStockRows: 0,
      unreadSystemNotifications: 0,
      warningAuditLogs: 0,
      errorAuditLogs: 0,
      criticalAuditLogs: 0,
    };
  }
}
