import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

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
export class NotificationEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishNotificationCreated(payload: NotificationCreatedEventPayload): void {
    this.eventEmitter.emit(NotificationEventType.NOTIFICATION_CREATED, payload);
  }

  publishNotificationSent(payload: NotificationSentEventPayload): void {
    this.eventEmitter.emit(NotificationEventType.NOTIFICATION_SENT, payload);
  }

  publishNotificationRead(payload: NotificationReadEventPayload): void {
    this.eventEmitter.emit(NotificationEventType.NOTIFICATION_READ, payload);
  }

  publishNotificationAllRead(payload: NotificationAllReadEventPayload): void {
    this.eventEmitter.emit(
      NotificationEventType.NOTIFICATION_ALL_READ,
      payload,
    );
  }

  publishNotificationDeleted(payload: NotificationDeletedEventPayload): void {
    this.eventEmitter.emit(NotificationEventType.NOTIFICATION_DELETED, payload);
  }

  publishOrderNotificationCreated(
    payload: OrderNotificationCreatedEventPayload,
  ): void {
    this.eventEmitter.emit(
      NotificationEventType.ORDER_NOTIFICATION_CREATED,
      payload,
    );
  }

  publishPaymentNotificationCreated(
    payload: PaymentNotificationCreatedEventPayload,
  ): void {
    this.eventEmitter.emit(
      NotificationEventType.PAYMENT_NOTIFICATION_CREATED,
      payload,
    );
  }

  publishShipmentNotificationCreated(
    payload: ShipmentNotificationCreatedEventPayload,
  ): void {
    this.eventEmitter.emit(
      NotificationEventType.SHIPMENT_NOTIFICATION_CREATED,
      payload,
    );
  }

  publishRefundNotificationCreated(
    payload: RefundNotificationCreatedEventPayload,
  ): void {
    this.eventEmitter.emit(
      NotificationEventType.REFUND_NOTIFICATION_CREATED,
      payload,
    );
  }

  publishSystemNotificationCreated(
    payload: SystemNotificationCreatedEventPayload,
  ): void {
    this.eventEmitter.emit(
      NotificationEventType.SYSTEM_NOTIFICATION_CREATED,
      payload,
    );
  }
}
