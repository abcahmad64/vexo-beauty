import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { WishlistEventType } from './wishlist.event.types';

import {
  WishlistClearedEventPayload,
  WishlistCreatedEventPayload,
  WishlistItemAddedEventPayload,
  WishlistItemRemovedEventPayload,
  WishlistMergedEventPayload,
} from './wishlist.event.payloads';

@Injectable()
export class WishlistEventHandler {
  private readonly logger = new Logger(WishlistEventHandler.name);

  @OnEvent(WishlistEventType.CREATED)
  handleCreated(payload: WishlistCreatedEventPayload): void {
    this.logger.log(
      `Wishlist created: ${payload.wishlistId}; user=${payload.userId}`,
    );
  }

  @OnEvent(WishlistEventType.ITEM_ADDED)
  handleItemAdded(payload: WishlistItemAddedEventPayload): void {
    this.logger.log(
      `Wishlist item added: wishlist=${payload.wishlistId}; product=${payload.productId}`,
    );
  }

  @OnEvent(WishlistEventType.ITEM_REMOVED)
  handleItemRemoved(payload: WishlistItemRemovedEventPayload): void {
    this.logger.log(
      `Wishlist item removed: ${payload.wishlistItemId}; product=${payload.productId}`,
    );
  }

  @OnEvent(WishlistEventType.CLEARED)
  handleCleared(payload: WishlistClearedEventPayload): void {
    this.logger.warn(
      `Wishlist cleared: ${payload.wishlistId}; removed=${payload.removedItemsCount}`,
    );
  }

  @OnEvent(WishlistEventType.MERGED)
  handleMerged(payload: WishlistMergedEventPayload): void {
    this.logger.log(
      `Wishlist merged: ${payload.wishlistId}; merged=${payload.mergedItemsCount}`,
    );
  }
}
