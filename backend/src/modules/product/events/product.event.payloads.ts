import { ProductStatus } from '../../../generated/prisma';

export interface ProductBaseEventPayload {
  productId: string;
  actorId?: string;
  occurredAt: Date;
}

export interface ProductCreatedEventPayload extends ProductBaseEventPayload {
  name: string;
  slug: string;
  sku: string;
  status: ProductStatus;
}

export interface ProductUpdatedEventPayload extends ProductBaseEventPayload {
  changedFields: string[];
}

export interface ProductStatusChangedEventPayload extends ProductBaseEventPayload {
  previousStatus: ProductStatus;
  currentStatus: ProductStatus;
}

export interface ProductDeletedEventPayload extends ProductBaseEventPayload {
  name: string;
  slug: string;
}

export interface ProductViewedEventPayload extends ProductBaseEventPayload {
  visitorId?: string;
}

export interface ProductImageAddedEventPayload extends ProductBaseEventPayload {
  imageId: string;
  url: string;
}

export interface ProductVariantAddedEventPayload extends ProductBaseEventPayload {
  variantId: string;
  sku: string;
}

export interface ProductVariantUpdatedEventPayload extends ProductBaseEventPayload {
  variantId: string;
  changedFields: string[];
}

export interface ProductVariantDeletedEventPayload extends ProductBaseEventPayload {
  variantId: string;
  sku: string;
}

export interface ProductAttributesSyncedEventPayload extends ProductBaseEventPayload {
  attributeValueIds: string[];
}
