import { Injectable, Logger } from '@nestjs/common';

import { NotificationType } from '../../../generated/prisma';
import { QueueProducerService } from '../../queue/services/queue-producer.service';
import { QueueJobMetadataUtil } from '../../queue/utils/queue-job-metadata.util';

export interface OrderNotificationInput {
  readonly userId: string;
  readonly orderId: string;
  readonly orderNumber?: string | null;
  readonly title: string;
  readonly message: string;
  readonly actorId?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface PaymentNotificationInput {
  readonly userId: string;
  readonly orderId: string;
  readonly paymentId: string;
  readonly transactionId?: string | null;
  readonly title: string;
  readonly message: string;
  readonly actorId?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ShipmentNotificationInput {
  readonly userId: string;
  readonly orderId: string;
  readonly orderNumber?: string | null;
  readonly trackingNumber?: string | null;
  readonly title: string;
  readonly message: string;
  readonly actorId?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface InvoiceNotificationInput {
  readonly userId: string;
  readonly orderId: string;
  readonly orderNumber?: string | null;
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly title: string;
  readonly message: string;
  readonly actorId?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RefundNotificationInput {
  readonly userId: string;
  readonly orderId: string;
  readonly paymentId: string;
  readonly refundId: string;
  readonly title: string;
  readonly message: string;
  readonly actorId?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

interface DatabaseNotificationInput {
  readonly userId: string;
  readonly title: string;
  readonly message: string;
  readonly type: NotificationType;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly actorId?: string | null;
  readonly source: string;
  readonly failureLabel: string;
}

@Injectable()
export class NotificationOrchestrator {
  private readonly logger = new Logger(NotificationOrchestrator.name);

  constructor(private readonly queueProducerService: QueueProducerService) {}

  async notifyOrder(input: OrderNotificationInput): Promise<void> {
    await this.enqueueDatabaseNotification({
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: NotificationType.ORDER_UPDATE,
      payload: {
        ...(input.metadata ?? {}),
        orderId: input.orderId,
        orderNumber: input.orderNumber ?? null,
        actionUrl: `/account/orders/${input.orderId}`,
      },
      actorId: input.actorId,
      source: 'notification-orchestrator.order',
      failureLabel: 'order',
    });
  }

  async notifyPayment(input: PaymentNotificationInput): Promise<void> {
    await this.enqueueDatabaseNotification({
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: NotificationType.ORDER_UPDATE,
      payload: {
        ...(input.metadata ?? {}),
        paymentId: input.paymentId,
        orderId: input.orderId,
        transactionId: input.transactionId ?? null,
        actionUrl: `/account/orders/${input.orderId}`,
      },
      actorId: input.actorId,
      source: 'notification-orchestrator.payment',
      failureLabel: 'payment',
    });
  }

  async notifyShipment(input: ShipmentNotificationInput): Promise<void> {
    await this.enqueueDatabaseNotification({
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: NotificationType.ORDER_UPDATE,
      payload: {
        ...(input.metadata ?? {}),
        orderId: input.orderId,
        orderNumber: input.orderNumber ?? null,
        trackingNumber: input.trackingNumber ?? null,
        actionUrl: `/account/orders/${input.orderId}`,
      },
      actorId: input.actorId,
      source: 'notification-orchestrator.shipment',
      failureLabel: 'shipment',
    });
  }

  async notifyInvoice(input: InvoiceNotificationInput): Promise<void> {
    await this.enqueueDatabaseNotification({
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: NotificationType.ORDER_UPDATE,
      payload: {
        ...(input.metadata ?? {}),
        orderId: input.orderId,
        orderNumber: input.orderNumber ?? null,
        invoiceId: input.invoiceId,
        invoiceNumber: input.invoiceNumber,
        actionUrl: `/account/orders/${input.orderId}`,
      },
      actorId: input.actorId,
      source: 'notification-orchestrator.invoice',
      failureLabel: 'invoice',
    });
  }

  async notifyRefund(input: RefundNotificationInput): Promise<void> {
    await this.enqueueDatabaseNotification({
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: NotificationType.ORDER_UPDATE,
      payload: {
        ...(input.metadata ?? {}),
        refundId: input.refundId,
        paymentId: input.paymentId,
        orderId: input.orderId,
        actionUrl: `/account/orders/${input.orderId}`,
      },
      actorId: input.actorId,
      source: 'notification-orchestrator.refund',
      failureLabel: 'refund',
    });
  }

  private async enqueueDatabaseNotification(
    input: DatabaseNotificationInput,
  ): Promise<void> {
    const userId = this.normalizeRequiredString(input.userId);
    const title = this.normalizeRequiredString(input.title);
    const message = this.normalizeRequiredString(input.message);

    if (!userId || !title || !message) {
      this.logger.warn(
        `ایجاد اعلان انجام نشد؛ داده ضروری ناقص است: ${input.failureLabel}`,
      );
      return;
    }

    try {
      await this.queueProducerService.enqueueNotificationDatabase({
        userId,
        title,
        message,
        type: input.type,
        payload: input.payload,
        metadata: QueueJobMetadataUtil.create({
          actorId: this.normalizeOptionalString(input.actorId),
          source: input.source,
        }),
      });
    } catch (error) {
      this.logger.error(
        `ثبت job اعلان ناموفق بود: ${input.failureLabel}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private normalizeRequiredString(value: string): string | null {
    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private normalizeOptionalString(
    value: string | null | undefined,
  ): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }
}
