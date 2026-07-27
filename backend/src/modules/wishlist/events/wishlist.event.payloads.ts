export interface WishlistBaseEventPayload {
  wishlistId: string;
  userId: string;
  actorId?: string;
  occurredAt: Date;
}

export type WishlistCreatedEventPayload = WishlistBaseEventPayload;

export interface WishlistItemAddedEventPayload extends WishlistBaseEventPayload {
  wishlistItemId: string;
  productId: string;
}

export interface WishlistItemRemovedEventPayload extends WishlistBaseEventPayload {
  wishlistItemId: string;
  productId: string;
}

export interface WishlistClearedEventPayload extends WishlistBaseEventPayload {
  removedItemsCount: number;
}

export interface WishlistMergedEventPayload extends WishlistBaseEventPayload {
  mergedItemsCount: number;
}
