import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

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
export class ReviewEventHandler {
  private readonly logger = new Logger(ReviewEventHandler.name);

  @OnEvent(ReviewEventType.CREATED)
  handleCreated(payload: ReviewCreatedEventPayload): void {
    this.logger.log(
      `Review created: ${payload.reviewId}; product=${payload.productId}; rating=${payload.rating}`,
    );
  }

  @OnEvent(ReviewEventType.UPDATED)
  handleUpdated(payload: ReviewUpdatedEventPayload): void {
    this.logger.log(
      `Review updated: ${payload.reviewId}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(ReviewEventType.DELETED)
  handleDeleted(payload: ReviewDeletedEventPayload): void {
    this.logger.warn(
      `Review deleted: ${payload.reviewId}; product=${payload.productId}`,
    );
  }

  @OnEvent(ReviewEventType.VERIFIED)
  handleVerified(payload: ReviewVerifiedEventPayload): void {
    this.logger.log(
      `Review verified: ${payload.reviewId}; product=${payload.productId}`,
    );
  }

  @OnEvent(ReviewEventType.UNVERIFIED)
  handleUnverified(payload: ReviewUnverifiedEventPayload): void {
    this.logger.warn(
      `Review unverified: ${payload.reviewId}; product=${payload.productId}`,
    );
  }

  @OnEvent(ReviewEventType.PRODUCT_RATING_SYNCED)
  handleProductRatingSynced(
    payload: ReviewProductRatingSyncedEventPayload,
  ): void {
    this.logger.log(
      `Product rating synced: ${payload.productId}; count=${payload.reviewCount}; avg=${payload.averageRating ?? 'N/A'}`,
    );
  }
}
