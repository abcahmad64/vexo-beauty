import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

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
export class CouponEventHandler {
  private readonly logger = new Logger(CouponEventHandler.name);

  @OnEvent(CouponEventType.CREATED)
  handleCreated(payload: CouponCreatedEventPayload): void {
    this.logger.log(
      `Coupon created: ${payload.code}; type=${payload.type}; value=${payload.value}`,
    );
  }

  @OnEvent(CouponEventType.UPDATED)
  handleUpdated(payload: CouponUpdatedEventPayload): void {
    this.logger.log(
      `Coupon updated: ${payload.code}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(CouponEventType.DELETED)
  handleDeleted(payload: CouponDeletedEventPayload): void {
    this.logger.warn(`Coupon soft deleted: ${payload.code}`);
  }

  @OnEvent(CouponEventType.ACTIVATED)
  handleActivated(payload: CouponActivatedEventPayload): void {
    this.logger.log(`Coupon activated: ${payload.code}`);
  }

  @OnEvent(CouponEventType.DEACTIVATED)
  handleDeactivated(payload: CouponDeactivatedEventPayload): void {
    this.logger.warn(`Coupon deactivated: ${payload.code}`);
  }

  @OnEvent(CouponEventType.EXPIRED)
  handleExpired(payload: CouponExpiredEventPayload): void {
    this.logger.warn(`Coupon expired: ${payload.code}`);
  }

  @OnEvent(CouponEventType.VALIDATED)
  handleValidated(payload: CouponValidatedEventPayload): void {
    this.logger.log(
      `Coupon validated: ${payload.code}; discount=${payload.discountAmount}`,
    );
  }

  @OnEvent(CouponEventType.VALIDATION_FAILED)
  handleValidationFailed(payload: CouponValidationFailedEventPayload): void {
    this.logger.warn(
      `Coupon validation failed: ${payload.code}; reason=${payload.reason}`,
    );
  }

  @OnEvent(CouponEventType.APPLIED)
  handleApplied(payload: CouponAppliedEventPayload): void {
    this.logger.log(
      `Coupon applied preview: ${payload.code}; final=${payload.finalAmount}`,
    );
  }

  @OnEvent(CouponEventType.USAGE_RECORDED)
  handleUsageRecorded(payload: CouponUsageRecordedEventPayload): void {
    this.logger.log(
      `Coupon usage recorded: ${payload.code}; order=${payload.orderId}`,
    );
  }
}
