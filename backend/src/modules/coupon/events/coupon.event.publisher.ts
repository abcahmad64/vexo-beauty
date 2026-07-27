import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { CouponEventType } from './coupon.event.types';

import {
  CouponActivatedEventPayload,
  CouponAppliedEventPayload,
  CouponCreatedEventPayload,
  CouponDeactivatedEventPayload,
  CouponDeletedEventPayload,
  CouponExpiredEventPayload,
  CouponUpdatedEventPayload,
  CouponUsageRecordedEventPayload,
  CouponValidatedEventPayload,
  CouponValidationFailedEventPayload,
} from './coupon.event.payloads';

@Injectable()
export class CouponEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishCreated(payload: CouponCreatedEventPayload): void {
    this.eventEmitter.emit(CouponEventType.CREATED, payload);
  }

  publishUpdated(payload: CouponUpdatedEventPayload): void {
    this.eventEmitter.emit(CouponEventType.UPDATED, payload);
  }

  publishDeleted(payload: CouponDeletedEventPayload): void {
    this.eventEmitter.emit(CouponEventType.DELETED, payload);
  }

  publishActivated(payload: CouponActivatedEventPayload): void {
    this.eventEmitter.emit(CouponEventType.ACTIVATED, payload);
  }

  publishDeactivated(payload: CouponDeactivatedEventPayload): void {
    this.eventEmitter.emit(CouponEventType.DEACTIVATED, payload);
  }

  publishExpired(payload: CouponExpiredEventPayload): void {
    this.eventEmitter.emit(CouponEventType.EXPIRED, payload);
  }

  publishValidated(payload: CouponValidatedEventPayload): void {
    this.eventEmitter.emit(CouponEventType.VALIDATED, payload);
  }

  publishValidationFailed(payload: CouponValidationFailedEventPayload): void {
    this.eventEmitter.emit(CouponEventType.VALIDATION_FAILED, payload);
  }

  publishApplied(payload: CouponAppliedEventPayload): void {
    this.eventEmitter.emit(CouponEventType.APPLIED, payload);
  }

  publishUsageRecorded(payload: CouponUsageRecordedEventPayload): void {
    this.eventEmitter.emit(CouponEventType.USAGE_RECORDED, payload);
  }
}
