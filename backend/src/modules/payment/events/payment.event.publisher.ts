import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { PaymentEventType } from './payment.event.types';

import {
  OrderPaymentSyncedEventPayload,
  PaymentCompletedEventPayload,
  PaymentCreatedEventPayload,
  PaymentDeletedEventPayload,
  PaymentFailedEventPayload,
  PaymentRefundedEventPayload,
  PaymentStatusChangedEventPayload,
  PaymentUpdatedEventPayload,
} from './payment.event.payloads';

@Injectable()
export class PaymentEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishCreated(payload: PaymentCreatedEventPayload): void {
    this.eventEmitter.emit(PaymentEventType.CREATED, payload);
  }

  publishUpdated(payload: PaymentUpdatedEventPayload): void {
    this.eventEmitter.emit(PaymentEventType.UPDATED, payload);
  }

  publishCompleted(payload: PaymentCompletedEventPayload): void {
    this.eventEmitter.emit(PaymentEventType.COMPLETED, payload);
  }

  publishFailed(payload: PaymentFailedEventPayload): void {
    this.eventEmitter.emit(PaymentEventType.FAILED, payload);
  }

  publishRefunded(payload: PaymentRefundedEventPayload): void {
    this.eventEmitter.emit(PaymentEventType.REFUNDED, payload);
  }

  publishStatusChanged(payload: PaymentStatusChangedEventPayload): void {
    this.eventEmitter.emit(PaymentEventType.STATUS_CHANGED, payload);
  }

  publishDeleted(payload: PaymentDeletedEventPayload): void {
    this.eventEmitter.emit(PaymentEventType.DELETED, payload);
  }

  publishOrderPaymentSynced(payload: OrderPaymentSyncedEventPayload): void {
    this.eventEmitter.emit(PaymentEventType.ORDER_PAYMENT_SYNCED, payload);
  }
}
