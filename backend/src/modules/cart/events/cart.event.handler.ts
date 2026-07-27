import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

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
export class CartEventHandler {
  private readonly logger = new Logger(CartEventHandler.name);

  @OnEvent(CartEventType.CREATED)
  handleCreated(payload: CartCreatedEventPayload): void {
    this.logger.log(`Cart created: ${payload.cartId}; user=${payload.userId}`);
  }

  @OnEvent(CartEventType.ITEM_ADDED)
  handleItemAdded(payload: CartItemAddedEventPayload): void {
    this.logger.log(
      `Cart item added: cart=${payload.cartId}; product=${payload.productId}; quantity=${payload.quantity}`,
    );
  }

  @OnEvent(CartEventType.ITEM_UPDATED)
  handleItemUpdated(payload: CartItemUpdatedEventPayload): void {
    this.logger.log(
      `Cart item updated: ${payload.cartItemId}; ${payload.previousQuantity} -> ${payload.currentQuantity}`,
    );
  }

  @OnEvent(CartEventType.ITEM_REMOVED)
  handleItemRemoved(payload: CartItemRemovedEventPayload): void {
    this.logger.log(
      `Cart item removed: ${payload.cartItemId}; cart=${payload.cartId}`,
    );
  }

  @OnEvent(CartEventType.CLEARED)
  handleCleared(payload: CartClearedEventPayload): void {
    this.logger.warn(
      `Cart cleared: ${payload.cartId}; removed=${payload.removedItemsCount}`,
    );
  }

  @OnEvent(CartEventType.MERGED)
  handleMerged(payload: CartMergedEventPayload): void {
    this.logger.log(
      `Cart merged: ${payload.cartId}; merged=${payload.mergedItemsCount}`,
    );
  }
}
