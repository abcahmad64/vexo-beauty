import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminActionCenterQueryDto } from '../dto/admin-action-center-query.dto';

type ActionSeverity = 'info' | 'warning' | 'error' | 'critical';

type PendingOrderRow = {
  id: string;
  orderNumber: string;
  userId: string;
  status: string;
  paymentStatus: string;
  totalAmount: Prisma.Decimal | number | string;
  currency: string;
  createdAt: Date;
};

type FailedPaymentRow = {
  id: string;
  orderId: string;
  userId: string;
  amount: Prisma.Decimal | number | string;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  transactionId: string | null;
  createdAt: Date;
};

type PendingRefundRow = {
  id: string;
  paymentId: string;
  orderId: string | null;
  orderNumber: string | null;
  userId: string | null;
  amount: Prisma.Decimal | number | string;
  currency: string | null;
  status: string;
  reason: string | null;
  createdAt: Date;
};

type LowStockInventoryRow = {
  id: string;
  variantId: string;
  quantity: number | bigint;
  reservedQuantity: number | bigint;
  lowStockThreshold: number | bigint;
  availableQuantity: number | bigint;
  updatedAt: Date;
};

type SensitiveAuditRow = {
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

type UnreadNotificationRow = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  createdAt: Date;
};

type ActionCenterItem = {
  type:
    | 'pending_order'
    | 'failed_payment'
    | 'pending_refund'
    | 'low_stock_inventory'
    | 'sensitive_audit'
    | 'unread_system_notification';
  severity: ActionSeverity;
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  actionUrl: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
};

type ActionCenterResponse = {
  meta: {
    generatedAt: string;
    requestedBy: string;
    limit: number;
  };
  summary: {
    totalVisibleActions: number;
    critical: number;
    error: number;
    warning: number;
    info: number;
  };
  sections: {
    pendingOrders: ActionCenterItem[];
    failedPayments: ActionCenterItem[];
    pendingRefunds: ActionCenterItem[];
    lowStockInventory: ActionCenterItem[];
    sensitiveAudits: ActionCenterItem[];
    unreadSystemNotifications: ActionCenterItem[];
  };
  actions: ActionCenterItem[];
};

@Injectable()
export class AdminActionCenterService {
  private readonly defaultLimit = 10;

  constructor(private readonly prisma: PrismaService) {}

  async getActionCenter(
    query: AdminActionCenterQueryDto,
    actorId: string,
  ): Promise<ActionCenterResponse> {
    const limit = query.limit ?? this.defaultLimit;

    const [
      pendingOrders,
      failedPayments,
      pendingRefunds,
      lowStockInventory,
      sensitiveAudits,
      unreadSystemNotifications,
    ] = await Promise.all([
      this.findPendingOrders(limit),
      this.findFailedPayments(limit),
      this.findPendingRefunds(limit),
      this.findLowStockInventory(limit),
      this.findSensitiveAudits(limit),
      this.findUnreadSystemNotifications(limit),
    ]);

    const pendingOrderItems = pendingOrders.map((row) =>
      this.mapPendingOrder(row),
    );

    const failedPaymentItems = failedPayments.map((row) =>
      this.mapFailedPayment(row),
    );

    const pendingRefundItems = pendingRefunds.map((row) =>
      this.mapPendingRefund(row),
    );

    const lowStockInventoryItems = lowStockInventory.map((row) =>
      this.mapLowStockInventory(row),
    );

    const sensitiveAuditItems = sensitiveAudits.map((row) =>
      this.mapSensitiveAudit(row),
    );

    const unreadSystemNotificationItems = unreadSystemNotifications.map((row) =>
      this.mapUnreadSystemNotification(row),
    );

    const actions = [
      ...sensitiveAuditItems,
      ...failedPaymentItems,
      ...pendingRefundItems,
      ...pendingOrderItems,
      ...lowStockInventoryItems,
      ...unreadSystemNotificationItems,
    ].sort(
      (first, second) =>
        new Date(second.occurredAt).getTime() -
        new Date(first.occurredAt).getTime(),
    );

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        requestedBy: actorId,
        limit,
      },
      summary: this.buildSummary(actions),
      sections: {
        pendingOrders: pendingOrderItems,
        failedPayments: failedPaymentItems,
        pendingRefunds: pendingRefundItems,
        lowStockInventory: lowStockInventoryItems,
        sensitiveAudits: sensitiveAuditItems,
        unreadSystemNotifications: unreadSystemNotificationItems,
      },
      actions,
    };
  }

  private findPendingOrders(limit: number): Promise<PendingOrderRow[]> {
    return this.prisma.$queryRaw<PendingOrderRow[]>(
      Prisma.sql`
        SELECT
          o."id",
          o."orderNumber",
          o."userId",
          o."status"::text AS "status",
          o."paymentStatus"::text AS "paymentStatus",
          o."totalAmount",
          o."currency",
          o."createdAt"
        FROM "Order" o
        WHERE
          o."deleted_at" IS NULL
          AND o."status"::text IN (
            'PENDING',
            'CONFIRMED'
          )
          AND o."createdAt" <= NOW() - INTERVAL '24 hours'
        ORDER BY
          o."createdAt" ASC
        LIMIT ${limit}
      `,
    );
  }

  private findFailedPayments(limit: number): Promise<FailedPaymentRow[]> {
    return this.prisma.$queryRaw<FailedPaymentRow[]>(
      Prisma.sql`
        SELECT
          p."id",
          p."orderId",
          p."userId",
          p."amount",
          p."currency",
          p."paymentMethod"::text AS "paymentMethod",
          p."paymentStatus"::text AS "paymentStatus",
          p."transactionId",
          p."createdAt"
        FROM "Payment" p
        WHERE
          p."deleted_at" IS NULL
          AND p."paymentStatus"::text = 'FAILED'
        ORDER BY
          p."createdAt" DESC
        LIMIT ${limit}
      `,
    );
  }

  private findPendingRefunds(limit: number): Promise<PendingRefundRow[]> {
    return this.prisma.$queryRaw<PendingRefundRow[]>(
      Prisma.sql`
        SELECT
          r."id",
          r."paymentId",
          p."orderId",
          o."orderNumber",
          p."userId",
          r."amount",
          p."currency",
          r."status"::text AS "status",
          r."reason",
          r."createdAt"
        FROM "Refund" r
        LEFT JOIN "Payment" p
          ON p."id" = r."paymentId"
          AND p."deleted_at" IS NULL
        LEFT JOIN "Order" o
          ON o."id" = p."orderId"
          AND o."deleted_at" IS NULL
        WHERE
          r."deleted_at" IS NULL
          AND r."status"::text IN (
            'PENDING',
            'PROCESSING'
          )
        ORDER BY
          r."createdAt" ASC
        LIMIT ${limit}
      `,
    );
  }

  private findLowStockInventory(
    limit: number,
  ): Promise<LowStockInventoryRow[]> {
    return this.prisma.$queryRaw<LowStockInventoryRow[]>(
      Prisma.sql`
        SELECT
          i."id",
          i."variantId",
          i."quantity"::int AS "quantity",
          i."reservedQuantity"::int AS "reservedQuantity",
          i."lowStockThreshold"::int AS "lowStockThreshold",
          GREATEST(
            i."quantity" - i."reservedQuantity",
            0
          )::int AS "availableQuantity",
          i."updatedAt"
        FROM "Inventory" i
        WHERE
          GREATEST(
            i."quantity" - i."reservedQuantity",
            0
          ) <= i."lowStockThreshold"
        ORDER BY
          "availableQuantity" ASC,
          i."updatedAt" DESC
        LIMIT ${limit}
      `,
    );
  }

  private findSensitiveAudits(limit: number): Promise<SensitiveAuditRow[]> {
    return this.prisma.$queryRaw<SensitiveAuditRow[]>(
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
          AND COALESCE(
            e."data" #>> '{severity}',
            'info'
          ) IN (
            'warning',
            'error',
            'critical'
          )
        ORDER BY
          e."timestamp" DESC,
          e."createdAt" DESC
        LIMIT ${limit}
      `,
    );
  }

  private findUnreadSystemNotifications(
    limit: number,
  ): Promise<UnreadNotificationRow[]> {
    return this.prisma.$queryRaw<UnreadNotificationRow[]>(
      Prisma.sql`
        SELECT
          n."id",
          n."userId",
          n."type"::text AS "type",
          n."title",
          n."message",
          n."createdAt"
        FROM "Notification" n
        WHERE
          n."isActive" = TRUE
          AND n."isRead" = FALSE
          AND n."type"::text = 'SYSTEM'
        ORDER BY
          n."createdAt" DESC
        LIMIT ${limit}
      `,
    );
  }

  private mapPendingOrder(row: PendingOrderRow): ActionCenterItem {
    return {
      type: 'pending_order',
      severity: 'warning',
      title: 'سفارش معطل‌شده',
      description: `سفارش ${row.orderNumber} بیش از ۲۴ ساعت در وضعیت ${row.status} باقی مانده است.`,
      entityType: 'order',
      entityId: row.id,
      actionUrl: `/admin/orders/${row.id}`,
      occurredAt: row.createdAt.toISOString(),
      metadata: {
        orderId: row.id,
        orderNumber: row.orderNumber,
        userId: row.userId,
        status: row.status,
        paymentStatus: row.paymentStatus,
        totalAmount: this.toDecimalString(row.totalAmount),
        currency: row.currency,
      },
    };
  }

  private mapFailedPayment(row: FailedPaymentRow): ActionCenterItem {
    return {
      type: 'failed_payment',
      severity: 'error',
      title: 'پرداخت ناموفق',
      description: `پرداخت ${row.id} با مبلغ ${this.toDecimalString(
        row.amount,
      )} ${row.currency} ناموفق شده است.`,
      entityType: 'payment',
      entityId: row.id,
      actionUrl: `/admin/payments/${row.id}`,
      occurredAt: row.createdAt.toISOString(),
      metadata: {
        paymentId: row.id,
        orderId: row.orderId,
        userId: row.userId,
        amount: this.toDecimalString(row.amount),
        currency: row.currency,
        paymentMethod: row.paymentMethod,
        paymentStatus: row.paymentStatus,
        transactionId: row.transactionId,
      },
    };
  }

  private mapPendingRefund(row: PendingRefundRow): ActionCenterItem {
    return {
      type: 'pending_refund',
      severity: row.status === 'PROCESSING' ? 'warning' : 'info',
      title: 'بازگشت وجه در انتظار رسیدگی',
      description: `بازگشت وجه ${row.id} با مبلغ ${this.toDecimalString(
        row.amount,
      )} ${row.currency ?? ''} در وضعیت ${row.status} قرار دارد.`,
      entityType: 'refund',
      entityId: row.id,
      actionUrl: `/admin/refunds/${row.id}`,
      occurredAt: row.createdAt.toISOString(),
      metadata: {
        refundId: row.id,
        paymentId: row.paymentId,
        orderId: row.orderId,
        orderNumber: row.orderNumber,
        userId: row.userId,
        amount: this.toDecimalString(row.amount),
        currency: row.currency,
        status: row.status,
        reason: row.reason,
      },
    };
  }

  private mapLowStockInventory(row: LowStockInventoryRow): ActionCenterItem {
    const available = this.toNumber(row.availableQuantity);

    return {
      type: 'low_stock_inventory',
      severity: available <= 0 ? 'critical' : 'warning',
      title: available <= 0 ? 'موجودی ناموجود شده است' : 'موجودی کم شده است',
      description: `موجودی واریانت ${row.variantId} به ${available} رسیده است.`,
      entityType: 'inventory',
      entityId: row.id,
      actionUrl: `/admin/inventory/${row.id}`,
      occurredAt: row.updatedAt.toISOString(),
      metadata: {
        inventoryId: row.id,
        variantId: row.variantId,
        quantity: this.toNumber(row.quantity),
        reservedQuantity: this.toNumber(row.reservedQuantity),
        availableQuantity: available,
        lowStockThreshold: this.toNumber(row.lowStockThreshold),
      },
    };
  }

  private mapSensitiveAudit(row: SensitiveAuditRow): ActionCenterItem {
    const severity = this.normalizeSeverity(row.severity);

    return {
      type: 'sensitive_audit',
      severity,
      title: this.auditTitle(severity),
      description: row.description ?? `رویداد حساس ${row.action} ثبت شده است.`,
      entityType: row.entityType ?? 'audit',
      entityId: row.entityId ?? row.id,
      actionUrl: `/admin/audit-logs/${row.id}`,
      occurredAt: row.occurredAt.toISOString(),
      metadata: {
        auditLogId: row.id,
        action: row.action,
        category: row.category,
        severity: row.severity,
        entityType: row.entityType,
        entityId: row.entityId,
        actorId: row.actorId,
      },
    };
  }

  private mapUnreadSystemNotification(
    row: UnreadNotificationRow,
  ): ActionCenterItem {
    return {
      type: 'unread_system_notification',
      severity: 'info',
      title: row.title,
      description: row.message,
      entityType: 'notification',
      entityId: row.id,
      actionUrl: `/admin/notifications/${row.id}`,
      occurredAt: row.createdAt.toISOString(),
      metadata: {
        notificationId: row.id,
        userId: row.userId,
        type: row.type,
      },
    };
  }

  private buildSummary(
    actions: ActionCenterItem[],
  ): ActionCenterResponse['summary'] {
    return {
      totalVisibleActions: actions.length,
      critical: actions.filter((item) => item.severity === 'critical').length,
      error: actions.filter((item) => item.severity === 'error').length,
      warning: actions.filter((item) => item.severity === 'warning').length,
      info: actions.filter((item) => item.severity === 'info').length,
    };
  }

  private normalizeSeverity(value: string | null): ActionSeverity {
    if (
      value === 'critical' ||
      value === 'error' ||
      value === 'warning' ||
      value === 'info'
    ) {
      return value;
    }

    return 'warning';
  }

  private auditTitle(severity: ActionSeverity): string {
    if (severity === 'critical') {
      return 'رویداد Audit بحرانی';
    }

    if (severity === 'error') {
      return 'رویداد Audit خطادار';
    }

    if (severity === 'warning') {
      return 'رویداد Audit حساس';
    }

    return 'رویداد Audit';
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
}
