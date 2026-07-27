import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { ProductEventType } from './product.event.types';

import {
  ProductAttributesSyncedEventPayload,
  ProductCreatedEventPayload,
  ProductDeletedEventPayload,
  ProductImageAddedEventPayload,
  ProductStatusChangedEventPayload,
  ProductUpdatedEventPayload,
  ProductVariantAddedEventPayload,
  ProductVariantDeletedEventPayload,
  ProductVariantUpdatedEventPayload,
  ProductViewedEventPayload,
} from './product.event.payloads';

@Injectable()
export class ProductEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishCreated(payload: ProductCreatedEventPayload): void {
    this.eventEmitter.emit(ProductEventType.CREATED, payload);
  }

  publishUpdated(payload: ProductUpdatedEventPayload): void {
    this.eventEmitter.emit(ProductEventType.UPDATED, payload);
  }

  publishStatusChanged(payload: ProductStatusChangedEventPayload): void {
    this.eventEmitter.emit(ProductEventType.STATUS_CHANGED, payload);
  }

  publishDeleted(payload: ProductDeletedEventPayload): void {
    this.eventEmitter.emit(ProductEventType.DELETED, payload);
  }

  publishViewed(payload: ProductViewedEventPayload): void {
    this.eventEmitter.emit(ProductEventType.VIEWED, payload);
  }

  publishImageAdded(payload: ProductImageAddedEventPayload): void {
    this.eventEmitter.emit(ProductEventType.IMAGE_ADDED, payload);
  }

  publishVariantAdded(payload: ProductVariantAddedEventPayload): void {
    this.eventEmitter.emit(ProductEventType.VARIANT_ADDED, payload);
  }

  publishVariantUpdated(payload: ProductVariantUpdatedEventPayload): void {
    this.eventEmitter.emit(ProductEventType.VARIANT_UPDATED, payload);
  }

  publishVariantDeleted(payload: ProductVariantDeletedEventPayload): void {
    this.eventEmitter.emit(ProductEventType.VARIANT_DELETED, payload);
  }

  publishAttributesSynced(payload: ProductAttributesSyncedEventPayload): void {
    this.eventEmitter.emit(ProductEventType.ATTRIBUTES_SYNCED, payload);
  }
}
