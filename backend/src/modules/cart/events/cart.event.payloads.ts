export interface CartBaseEventPayload {
  cartId: string;
  userId: string;
  actorId?: string;
  occurredAt: Date;
}

export type CartCreatedEventPayload = CartBaseEventPayload;

export interface CartItemAddedEventPayload extends CartBaseEventPayload {
  cartItemId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  price: string;
}

export interface CartItemUpdatedEventPayload extends CartBaseEventPayload {
  cartItemId: string;
  productId: string;
  variantId?: string | null;
  previousQuantity: number;
  currentQuantity: number;
}

export interface CartItemRemovedEventPayload extends CartBaseEventPayload {
  cartItemId: string;
  productId: string;
  variantId?: string | null;
}

export interface CartClearedEventPayload extends CartBaseEventPayload {
  removedItemsCount: number;
}

export interface CartMergedEventPayload extends CartBaseEventPayload {
  mergedItemsCount: number;
}
