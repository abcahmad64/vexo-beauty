import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { RefundEventType } from './refund.event.types';

import {
  RefundCompletedEventPayload,
  RefundCreatedEventPayload,
  RefundDeletedEventPayload,
  RefundFailedEventPayload,
  RefundProcessingEventPayload,
  RefundUpdatedEventPayload,
} from './refund.event.payloads';

@Injectable()
export class RefundEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishRefundCreated(payload: RefundCreatedEventPayload): void {
    this.eventEmitter.emit(RefundEventType.REFUND_CREATED, payload);
  }

  publishRefundUpdated(payload: RefundUpdatedEventPayload): void {
    this.eventEmitter.emit(RefundEventType.REFUND_UPDATED, payload);
  }

  publishRefundProcessing(payload: RefundProcessingEventPayload): void {
    this.eventEmitter.emit(RefundEventType.REFUND_PROCESSING, payload);
  }

  publishRefundCompleted(payload: RefundCompletedEventPayload): void {
    this.eventEmitter.emit(RefundEventType.REFUND_COMPLETED, payload);
  }

  publishRefundFailed(payload: RefundFailedEventPayload): void {
    this.eventEmitter.emit(RefundEventType.REFUND_FAILED, payload);
  }

  publishRefundDeleted(payload: RefundDeletedEventPayload): void {
    this.eventEmitter.emit(RefundEventType.REFUND_DELETED, payload);
  }
}
