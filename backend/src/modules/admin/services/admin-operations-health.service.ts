import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminQueueService } from './admin-queue.service';

import { AdminSchedulerService } from './admin-scheduler.service';

type OperationsHealthLevel = 'healthy' | 'warning' | 'degraded' | 'critical';

type DatabaseHealthRow = {
  now: Date;
};

type OperationalRiskRow = {
  stalePendingOrders: number | bigint;
  failedPayments: number | bigint;
  pendingRefunds: number | bigint;
  failedRefunds: number | bigint;
  lowStockRows: number | bigint;
  outOfStockRows: number | bigint;
  unreadSystemNotifications: number | bigint;
  warningAuditLogs: number | bigint;
  errorAuditLogs: number | bigint;
  criticalAuditLogs: number | bigint;
};

type OperationsHealthResponse = {
  meta: {
    generatedAt: string;
    requestedBy: string;
  };
  status: {
    level: OperationsHealthLevel;
    score: number;
    message: string;
  };
  database: {
    reachable: boolean;
    serverTime: string | null;
  };
  queues: unknown;
  scheduler: unknown;
  risks: {
    stalePendingOrders: number;
    failedPayments: number;
    pendingRefunds: number;
    failedRefunds: number;
    lowStockRows: number;
    outOfStockRows: number;
    unreadSystemNotifications: number;
    warningAuditLogs: number;
    errorAuditLogs: number;
    criticalAuditLogs: number;
  };
  signals: string[];
};

@Injectable()
export class AdminOperationsHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminQueueService: AdminQueueService,
    private readonly adminSchedulerService: AdminSchedulerService,
  ) {}

  async getOperationsHealth(
    actorId: string,
  ): Promise<OperationsHealthResponse> {
    const scheduler = this.adminSchedulerService.getStatus();

    const [database, queues, riskRows] = await Promise.all([
      this.getDatabaseHealth(),
      this.adminQueueService.getStatus(),
      this.getOperationalRisks(),
    ]);

    const risks = riskRows[0] ?? this.emptyRisks();

    const normalizedRisks = {
      stalePendingOrders: this.toNumber(risks.stalePendingOrders),
      failedPayments: this.toNumber(risks.failedPayments),
      pendingRefunds: this.toNumber(risks.pendingRefunds),
      failedRefunds: this.toNumber(risks.failedRefunds),
      lowStockRows: this.toNumber(risks.lowStockRows),
      outOfStockRows: this.toNumber(risks.outOfStockRows),
      unreadSystemNotifications: this.toNumber(risks.unreadSystemNotifications),
      warningAuditLogs: this.toNumber(risks.warningAuditLogs),
      errorAuditLogs: this.toNumber(risks.errorAuditLogs),
      criticalAuditLogs: this.toNumber(risks.criticalAuditLogs),
    };

    const signals = this.buildSignals(normalizedRisks);

    const status = this.buildStatus(database.reachable, normalizedRisks);

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        requestedBy: actorId,
      },
      status,
      database,
      queues,
      scheduler,
      risks: normalizedRisks,
      signals,
    };
  }

  private async getDatabaseHealth(): Promise<{
    reachable: boolean;
    serverTime: string | null;
  }> {
    try {
      const rows = await this.prisma.$queryRaw<DatabaseHealthRow[]>(
        Prisma.sql`
            SELECT NOW() AS "now"
          `,
      );

      return {
        reachable: true,
        serverTime: rows[0]?.now ? rows[0].now.toISOString() : null,
      };
    } catch {
      return {
        reachable: false,
        serverTime: null,
      };
    }
  }

  private getOperationalRisks(): Promise<OperationalRiskRow[]> {
    return this.prisma.$queryRaw<OperationalRiskRow[]>(
      Prisma.sql`
        SELECT
          (
            SELECT COUNT(*)::int
            FROM "Order" o
            WHERE
              o."deleted_at" IS NULL
              AND o."status"::text IN ('PENDING', 'CONFIRMED')
              AND o."createdAt" <= NOW() - INTERVAL '24 hours'
          ) AS "stalePendingOrders",

          (
            SELECT COUNT(*)::int
            FROM "Payment" p
            WHERE
              p."deleted_at" IS NULL
              AND p."paymentStatus"::text = 'FAILED'
          ) AS "failedPayments",

          (
            SELECT COUNT(*)::int
            FROM "Refund" r
            WHERE
              r."deleted_at" IS NULL
              AND r."status"::text IN ('PENDING', 'PROCESSING')
          ) AS "pendingRefunds",

          (
            SELECT COUNT(*)::int
            FROM "Refund" r
            WHERE
              r."deleted_at" IS NULL
              AND r."status"::text = 'FAILED'
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
              n."deleted_at" IS NULL
              AND n."isActive" = TRUE
              AND n."isRead" = FALSE
              AND n."type"::text = 'SYSTEM'
          ) AS "unreadSystemNotifications",

          (
            SELECT COUNT(*)::int
            FROM "Event" e
            WHERE
              e."deleted_at" IS NULL
              AND COALESCE(e."data" #>> '{severity}', 'info') = 'warning'
          ) AS "warningAuditLogs",

          (
            SELECT COUNT(*)::int
            FROM "Event" e
            WHERE
              e."deleted_at" IS NULL
              AND COALESCE(e."data" #>> '{severity}', 'info') = 'error'
          ) AS "errorAuditLogs",

          (
            SELECT COUNT(*)::int
            FROM "Event" e
            WHERE
              e."deleted_at" IS NULL
              AND COALESCE(e."data" #>> '{severity}', 'info') = 'critical'
          ) AS "criticalAuditLogs"
      `,
    );
  }

  private buildStatus(
    databaseReachable: boolean,
    risks: OperationsHealthResponse['risks'],
  ): OperationsHealthResponse['status'] {
    if (!databaseReachable) {
      return {
        level: 'critical',
        score: 100,
        message: 'اتصال دیتابیس برقرار نیست و سیستم در وضعیت بحرانی قرار دارد.',
      };
    }

    let score = 0;

    score += risks.criticalAuditLogs * 30;

    score += risks.errorAuditLogs * 15;

    score += risks.failedPayments * 8;

    score += risks.failedRefunds * 10;

    score += risks.outOfStockRows * 6;

    score += risks.stalePendingOrders * 4;

    score += risks.pendingRefunds * 3;

    score += risks.lowStockRows * 2;

    if (risks.unreadSystemNotifications > 20) {
      score += 10;
    }

    const normalizedScore = Math.min(100, score);

    if (normalizedScore >= 80) {
      return {
        level: 'critical',
        score: normalizedScore,
        message: 'وضعیت عملیاتی سیستم بحرانی است و نیاز به رسیدگی فوری دارد.',
      };
    }

    if (normalizedScore >= 50) {
      return {
        level: 'degraded',
        score: normalizedScore,
        message: 'سیستم در وضعیت افت کیفیت عملیاتی قرار دارد.',
      };
    }

    if (normalizedScore >= 20) {
      return {
        level: 'warning',
        score: normalizedScore,
        message: 'سیستم پایدار است اما چند هشدار عملیاتی وجود دارد.',
      };
    }

    return {
      level: 'healthy',
      score: normalizedScore,
      message: 'وضعیت عملیاتی سیستم سالم است.',
    };
  }

  private buildSignals(risks: OperationsHealthResponse['risks']): string[] {
    const signals: string[] = [];

    if (risks.criticalAuditLogs > 0) {
      signals.push('رویداد Audit بحرانی وجود دارد.');
    }

    if (risks.errorAuditLogs > 0) {
      signals.push('رویداد Audit با سطح خطا وجود دارد.');
    }

    if (risks.failedPayments > 0) {
      signals.push('پرداخت ناموفق وجود دارد.');
    }

    if (risks.failedRefunds > 0) {
      signals.push('بازگشت وجه ناموفق وجود دارد.');
    }

    if (risks.outOfStockRows > 0) {
      signals.push('بعضی موجودی‌ها ناموجود شده‌اند.');
    }

    if (risks.lowStockRows > 0) {
      signals.push('بعضی موجودی‌ها به آستانه هشدار رسیده‌اند.');
    }

    if (risks.stalePendingOrders > 0) {
      signals.push('سفارش معطل‌شده بیش از ۲۴ ساعت وجود دارد.');
    }

    if (risks.pendingRefunds > 0) {
      signals.push('درخواست بازگشت وجه در انتظار رسیدگی وجود دارد.');
    }

    if (risks.unreadSystemNotifications > 20) {
      signals.push('تعداد اعلان‌های سیستمی خوانده‌نشده زیاد است.');
    }

    if (signals.length === 0) {
      signals.push('هشدار عملیاتی مهمی شناسایی نشد.');
    }

    return signals;
  }

  private emptyRisks(): OperationalRiskRow {
    return {
      stalePendingOrders: 0,
      failedPayments: 0,
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
}
