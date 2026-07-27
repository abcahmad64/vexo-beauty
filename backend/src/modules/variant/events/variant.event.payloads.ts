export interface VariantBaseEventPayload {
  variantId: string;
  productId: string;
  sku: string;
  actorId?: string;
  occurredAt: Date;
}

export type VariantCreatedEventPayload = VariantBaseEventPayload;

export interface VariantUpdatedEventPayload extends VariantBaseEventPayload {
  changedFields: string[];
}

export type VariantActivatedEventPayload = VariantBaseEventPayload;

export type VariantDeactivatedEventPayload = VariantBaseEventPayload;

export type VariantDeletedEventPayload = VariantBaseEventPayload;

export type VariantRestoredEventPayload = VariantBaseEventPayload;

export interface VariantPriceChangedEventPayload extends VariantBaseEventPayload {
  previousPrice?: string | null;
  currentPrice?: string | null;
  previousComparePrice?: string | null;
  currentComparePrice?: string | null;
}

export interface VariantImageUpdatedEventPayload extends VariantBaseEventPayload {
  imageUrl?: string | null;
}
