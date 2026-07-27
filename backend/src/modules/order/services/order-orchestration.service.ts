import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { OrderStatus, Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import type { OrderQueueJobData } from '../../../core/queue/types/queue.types';

import { NotificationService } from '../../notification/services/notification.service';

import { OrderService } from './order.service';

type CountRow = {
  count: number;
};

type AdminRecipientRow = {
  id: string;
};

type OrderSnapshot = {
  id: string;
  userId: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: string;
  currency: string;
  paymentStatus: string;
};

export type OrderOrchestrationResult = {
  readonly action: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly previousStatus?: OrderStatus;
  readonly currentStatus: OrderStatus;
  readonly customerNotified: boolean;
  readonly adminRecipients: number;
};

@Injectable()
export class OrderOrchestrationService {
  private readonly logger = new Logger(OrderOrchestrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly notificationService: NotificationService,
  ) {}

  async processPostCreated(
    data: OrderQueueJobData,
  ): Promise<OrderOrchestrationResult> {
    const order = await this.loadOrderSnapshot(data.orderId);

    const customerNotified = await this.notifyCustomerOrderCreated(order, data);

    const adminRecipients = await this.notifyAdminsOrderCreated(order, data);

    return {
      action: 'order_post_created_processed',
      orderId: order.id,
      orderNumber: order.orderNumber,
      currentStatus: order.status,
      customerNotified,
      adminRecipients,
    };
  }

  async processPostPaid(
    data: OrderQueueJobData,
  ): Promise<OrderOrchestrationResult> {
    const before = await this.loadOrderSnapshot(data.orderId);

    const nextStatus = this.resolveNextStatus(data.payload);

    let after = before;

    let action = 'order_post_paid_no_status_change';

    if (
      before.status === OrderStatus.PENDING ||
      before.status === OrderStatus.CONFIRMED
    ) {
      const updated = await this.orderService.updateStatus(
        before.id,
        {
          status: nextStatus,
          reason:
            this.resolveReason(data.payload) ??
            'پرداخت سفارش با موفقیت انجام شد و سفارش آماده پردازش است.',
        },
        data.metadata.actorId,
      );

      after = this.normalizeOrderSnapshot(updated);

      action = 'order_moved_to_processing_after_payment';
    } else if (
      before.status === OrderStatus.PROCESSING ||
      before.status === OrderStatus.SHIPPED ||
      before.status === OrderStatus.DELIVERED
    ) {
      action = 'order_already_in_operational_flow';
    } else {
      action = 'order_post_paid_skipped_for_final_status';
    }

    const customerNotified = await this.notifyCustomerOrderPaid(after, data);

    const adminRecipients = await this.notifyAdminsOrderPaid(after, data);

    return {
      action,
      orderId: after.id,
      orderNumber: after.orderNumber,
      previousStatus: before.status,
      currentStatus: after.status,
      customerNotified,
      adminRecipients,
    };
  }

  private async loadOrderSnapshot(orderId: string): Promise<OrderSnapshot> {
    const order = await this.orderService.findOneForAdmin(orderId);

    return this.normalizeOrderSnapshot(order);
  }

  private normalizeOrderSnapshot(value: unknown): OrderSnapshot {
    const record = this.toRecord(value);

    return {
      id: this.getRequiredString(record, 'id'),
      userId: this.getRequiredString(record, 'userId'),
      orderNumber: this.getRequiredString(record, 'orderNumber'),
      status: this.getOrderStatus(record.status),
      totalAmount: this.getRequiredString(record, 'totalAmount'),
      currency: this.getRequiredString(record, 'currency'),
      paymentStatus: this.getRequiredString(record, 'paymentStatus'),
    };
  }

  private async notifyCustomerOrderCreated(
    order: OrderSnapshot,
    data: OrderQueueJobData,
  ): Promise<boolean> {
    return this.notifyOnce({
      userId: order.userId,
      orchestrationKey: `order:${order.id}:created:customer`,
      title: 'سفارش شما ثبت شد',
      message: `سفارش ${order.orderNumber} با مبلغ ${order.totalAmount} ${order.currency} با موفقیت ثبت شد.`,
      actionUrl: `/account/orders/${order.id}`,
      actorId: data.metadata.actorId,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        currency: order.currency,
        source: 'order.post-created',
      },
    });
  }

  private async notifyAdminsOrderCreated(
    order: OrderSnapshot,
    data: OrderQueueJobData,
  ): Promise<number> {
    const adminIds = await this.findAdminRecipientIds();

    let sentCount = 0;

    for (const adminId of adminIds) {
      const sent = await this.notifyOnce({
        userId: adminId,
        orchestrationKey: `order:${order.id}:created:admin:${adminId}`,
        title: 'سفارش جدید ثبت شد',
        message: `سفارش ${order.orderNumber} با مبلغ ${order.totalAmount} ${order.currency} ثبت شد.`,
        actionUrl: `/admin/orders/${order.id}`,
        actorId: data.metadata.actorId,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.userId,
          totalAmount: order.totalAmount,
          currency: order.currency,
          source: 'order.post-created',
        },
      });

      if (sent) {
        sentCount += 1;
      }
    }

    return sentCount;
  }

  private async notifyCustomerOrderPaid(
    order: OrderSnapshot,
    data: OrderQueueJobData,
  ): Promise<boolean> {
    return this.notifyOnce({
      userId: order.userId,
      orchestrationKey: `order:${order.id}:paid:customer`,
      title: 'سفارش شما وارد مرحله پردازش شد',
      message: `پرداخت سفارش ${order.orderNumber} تأیید شد و سفارش شما در حال پردازش است.`,
      actionUrl: `/account/orders/${order.id}`,
      actorId: data.metadata.actorId,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentId: this.getOptionalPayloadString(data.payload, 'paymentId'),
        transactionId: this.getOptionalPayloadString(
          data.payload,
          'transactionId',
        ),
        gateway: this.getOptionalPayloadString(data.payload, 'gateway'),
        source: 'order.post-paid',
      },
    });
  }

  private async notifyAdminsOrderPaid(
    order: OrderSnapshot,
    data: OrderQueueJobData,
  ): Promise<number> {
    const adminIds = await this.findAdminRecipientIds();

    let sentCount = 0;

    for (const adminId of adminIds) {
      const sent = await this.notifyOnce({
        userId: adminId,
        orchestrationKey: `order:${order.id}:paid:admin:${adminId}`,
        title: 'پرداخت سفارش تأیید شد',
        message: `پرداخت سفارش ${order.orderNumber} تأیید شد و سفارش وارد مرحله پردازش شد.`,
        actionUrl: `/admin/orders/${order.id}`,
        actorId: data.metadata.actorId,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.userId,
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentId: this.getOptionalPayloadString(data.payload, 'paymentId'),
          transactionId: this.getOptionalPayloadString(
            data.payload,
            'transactionId',
          ),
          gateway: this.getOptionalPayloadString(data.payload, 'gateway'),
          source: 'order.post-paid',
        },
      });

      if (sent) {
        sentCount += 1;
      }
    }

    return sentCount;
  }

  private async notifyOnce(input: {
    userId: string;
    orchestrationKey: string;
    title: string;
    message: string;
    actionUrl: string;
    actorId?: string;
    metadata: Record<string, unknown>;
  }): Promise<boolean> {
    const alreadySent = await this.hasNotificationWithKey(
      input.userId,
      input.orchestrationKey,
    );

    if (alreadySent) {
      return false;
    }

    await this.notificationService.sendNotification(
      {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: 'ORDER_UPDATE',
        actionUrl: input.actionUrl,
        channels: ['database', 'websocket', 'push'],
        saveToDatabase: true,
        metadata: {
          ...input.metadata,
          orchestrationKey: input.orchestrationKey,
        },
      },
      {
        actorId: input.actorId,
      },
    );

    return true;
  }

  private async hasNotificationWithKey(
    userId: string,
    orchestrationKey: string,
  ): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Notification" n
          WHERE
            n."userId" = ${userId}
            AND n."deleted_at" IS NULL
            AND n."metadata" #>> '{orchestrationKey}' = ${orchestrationKey}
          LIMIT 1
        `,
    );

    return (rows[0]?.count ?? 0) > 0;
  }

  private async findAdminRecipientIds(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<AdminRecipientRow[]>(
      Prisma.sql`
          SELECT DISTINCT
            u."id"
          FROM "User" u
          LEFT JOIN "Role" r
            ON r."id" = u."roleId"
            AND r."deleted_at" IS NULL
          LEFT JOIN "RolePermission" rp
            ON rp."roleId" = r."id"
          LEFT JOIN "Permission" p
            ON p."id" = rp."permissionId"
            AND p."deleted_at" IS NULL
          WHERE
            u."deleted_at" IS NULL
            AND u."status"::text = 'ACTIVE'
            AND (
              UPPER(r."name") IN (
                'ADMIN',
                'SUPER_ADMIN'
              )
              OR p."name" IN (
                'order:*',
                'orders:*',
                'order:read',
                'orders:read',
                'order:manage',
                'orders:manage',
                'finance:read',
                'finance:manage'
              )
            )
        `,
    );

    return rows.map((row) => row.id);
  }

  private resolveNextStatus(payload?: Record<string, unknown>): OrderStatus {
    const value = payload?.nextStatus;

    if (value === undefined || value === null) {
      return OrderStatus.PROCESSING;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('وضعیت بعدی سفارش باید رشته معتبر باشد.');
    }

    const normalized = value.trim().toUpperCase();

    const statuses = Object.values(OrderStatus);

    if (!statuses.includes(normalized as OrderStatus)) {
      throw new BadRequestException(`وضعیت سفارش معتبر نیست: ${value}`);
    }

    return normalized as OrderStatus;
  }

  private resolveReason(payload?: Record<string, unknown>): string | undefined {
    const value = payload?.reason;

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    return undefined;
  }

  private getOptionalPayloadString(
    payload: Record<string, unknown> | undefined,
    key: string,
  ): string | null {
    const value = payload?.[key];

    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }

  private getOrderStatus(value: unknown): OrderStatus {
    if (typeof value !== 'string') {
      throw new BadRequestException('وضعیت سفارش معتبر نیست.');
    }

    const normalized = value.trim().toUpperCase();

    const statuses = Object.values(OrderStatus);

    if (!statuses.includes(normalized as OrderStatus)) {
      throw new BadRequestException(`وضعیت سفارش معتبر نیست: ${value}`);
    }

    return normalized as OrderStatus;
  }

  private getRequiredString(
    record: Record<string, unknown>,
    key: string,
  ): string {
    const value = record[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
      return String(value);
    }

    if (value instanceof Prisma.Decimal) {
      return value.toString();
    }

    this.logger.error(`Required order field was not found: ${key}`);

    throw new BadRequestException(`اطلاعات سفارش کامل نیست: ${key}`);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    throw new BadRequestException('داده سفارش معتبر نیست.');
  }
}
