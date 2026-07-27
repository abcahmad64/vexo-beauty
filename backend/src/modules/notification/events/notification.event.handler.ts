import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { NotificationEventType } from './notification.event.types';

import {
  NotificationAllReadEventPayload,
  NotificationCreatedEventPayload,
  NotificationDeletedEventPayload,
  NotificationReadEventPayload,
  NotificationSentEventPayload,
  OrderNotificationCreatedEventPayload,
  PaymentNotificationCreatedEventPayload,
  RefundNotificationCreatedEventPayload,
  ShipmentNotificationCreatedEventPayload,
  SystemNotificationCreatedEventPayload,
} from './notification.event.payloads';

@Injectable()
export class NotificationEventHandler {
  private readonly logger = new Logger(NotificationEventHandler.name);

  @OnEvent(NotificationEventType.NOTIFICATION_CREATED)
  handleNotificationCreated(payload: NotificationCreatedEventPayload): void {
    this.logger.log(
      `Notification created: ${payload.notificationId} for user ${payload.userId}`,
    );
  }

  @OnEvent(NotificationEventType.NOTIFICATION_SENT)
  handleNotificationSent(payload: NotificationSentEventPayload): void {
    this.logger.log(
      `Notification sent through ${payload.channel}: ${payload.notificationId}`,
    );
  }

  @OnEvent(NotificationEventType.NOTIFICATION_READ)
  handleNotificationRead(payload: NotificationReadEventPayload): void {
    this.logger.log(
      `Notification read: ${payload.notificationId} by user ${payload.userId}`,
    );
  }

  @OnEvent(NotificationEventType.NOTIFICATION_ALL_READ)
  handleNotificationAllRead(payload: NotificationAllReadEventPayload): void {
    this.logger.log(
      `All notifications marked as read for user ${payload.userId}; count=${payload.count}`,
    );
  }

  @OnEvent(NotificationEventType.NOTIFICATION_DELETED)
  handleNotificationDeleted(payload: NotificationDeletedEventPayload): void {
    this.logger.warn(
      `Notification deleted: ${payload.notificationId} for user ${payload.userId}`,
    );
  }

  @OnEvent(NotificationEventType.ORDER_NOTIFICATION_CREATED)
  handleOrderNotificationCreated(
    payload: OrderNotificationCreatedEventPayload,
  ): void {
    this.logger.log(
      `Order notification created for order ${payload.orderNumber ?? payload.orderId}`,
    );
  }

  @OnEvent(NotificationEventType.PAYMENT_NOTIFICATION_CREATED)
  handlePaymentNotificationCreated(
    payload: PaymentNotificationCreatedEventPayload,
  ): void {
    this.logger.log(
      `Payment notification created for payment ${payload.paymentId}`,
    );
  }

  @OnEvent(NotificationEventType.SHIPMENT_NOTIFICATION_CREATED)
  handleShipmentNotificationCreated(
    payload: ShipmentNotificationCreatedEventPayload,
  ): void {
    this.logger.log(
      `Shipment notification created for order ${payload.orderNumber ?? payload.orderId}`,
    );
  }

  @OnEvent(NotificationEventType.REFUND_NOTIFICATION_CREATED)
  handleRefundNotificationCreated(
    payload: RefundNotificationCreatedEventPayload,
  ): void {
    this.logger.log(
      `Refund notification created for refund ${payload.refundId}`,
    );
  }

  @OnEvent(NotificationEventType.SYSTEM_NOTIFICATION_CREATED)
  handleSystemNotificationCreated(
    payload: SystemNotificationCreatedEventPayload,
  ): void {
    this.logger.log(
      `System notification created for user ${payload.userId}; severity=${payload.severity ?? 'info'}`,
    );
  }
}
