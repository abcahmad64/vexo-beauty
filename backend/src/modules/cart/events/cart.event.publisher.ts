import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { CartEventType } from './cart.event.types';

import {
  CartClearedEventPayload,
  CartCreatedEventPayload,
  CartItemAddedEventPayload,
  CartItemRemovedEventPayload,
  CartItemUpdatedEventPayload,
  CartMergedEventPayload,
} from './cart.event.payloads';

@Injectable()
export class CartEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishCreated(payload: CartCreatedEventPayload): void {
    this.eventEmitter.emit(CartEventType.CREATED, payload);
  }

  publishItemAdded(payload: CartItemAddedEventPayload): void {
    this.eventEmitter.emit(CartEventType.ITEM_ADDED, payload);
  }

  publishItemUpdated(payload: CartItemUpdatedEventPayload): void {
    this.eventEmitter.emit(CartEventType.ITEM_UPDATED, payload);
  }

  publishItemRemoved(payload: CartItemRemovedEventPayload): void {
    this.eventEmitter.emit(CartEventType.ITEM_REMOVED, payload);
  }

  publishCleared(payload: CartClearedEventPayload): void {
    this.eventEmitter.emit(CartEventType.CLEARED, payload);
  }

  publishMerged(payload: CartMergedEventPayload): void {
    this.eventEmitter.emit(CartEventType.MERGED, payload);
  }
}
