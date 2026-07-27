import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { ReviewEventType } from './review.event.types';

import {
  ReviewCreatedEventPayload,
  ReviewDeletedEventPayload,
  ReviewProductRatingSyncedEventPayload,
  ReviewUnverifiedEventPayload,
  ReviewUpdatedEventPayload,
  ReviewVerifiedEventPayload,
} from './review.event.payloads';

@Injectable()
export class ReviewEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishCreated(payload: ReviewCreatedEventPayload): void {
    this.eventEmitter.emit(ReviewEventType.CREATED, payload);
  }

  publishUpdated(payload: ReviewUpdatedEventPayload): void {
    this.eventEmitter.emit(ReviewEventType.UPDATED, payload);
  }

  publishDeleted(payload: ReviewDeletedEventPayload): void {
    this.eventEmitter.emit(ReviewEventType.DELETED, payload);
  }

  publishVerified(payload: ReviewVerifiedEventPayload): void {
    this.eventEmitter.emit(ReviewEventType.VERIFIED, payload);
  }

  publishUnverified(payload: ReviewUnverifiedEventPayload): void {
    this.eventEmitter.emit(ReviewEventType.UNVERIFIED, payload);
  }

  publishProductRatingSynced(
    payload: ReviewProductRatingSyncedEventPayload,
  ): void {
    this.eventEmitter.emit(ReviewEventType.PRODUCT_RATING_SYNCED, payload);
  }
}
