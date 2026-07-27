import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { WishlistEventType } from './wishlist.event.types';

import {
  WishlistClearedEventPayload,
  WishlistCreatedEventPayload,
  WishlistItemAddedEventPayload,
  WishlistItemRemovedEventPayload,
  WishlistMergedEventPayload,
} from './wishlist.event.payloads';

@Injectable()
export class WishlistEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishCreated(payload: WishlistCreatedEventPayload): void {
    this.eventEmitter.emit(WishlistEventType.CREATED, payload);
  }

  publishItemAdded(payload: WishlistItemAddedEventPayload): void {
    this.eventEmitter.emit(WishlistEventType.ITEM_ADDED, payload);
  }

  publishItemRemoved(payload: WishlistItemRemovedEventPayload): void {
    this.eventEmitter.emit(WishlistEventType.ITEM_REMOVED, payload);
  }

  publishCleared(payload: WishlistClearedEventPayload): void {
    this.eventEmitter.emit(WishlistEventType.CLEARED, payload);
  }

  publishMerged(payload: WishlistMergedEventPayload): void {
    this.eventEmitter.emit(WishlistEventType.MERGED, payload);
  }
}
