export interface BrandBaseEventPayload {
  brandId: string;
  name: string;
  slug: string;
  actorId?: string;
  occurredAt: Date;
}

export type BrandCreatedEventPayload = BrandBaseEventPayload;

export interface BrandUpdatedEventPayload extends BrandBaseEventPayload {
  changedFields: string[];
}

export type BrandActivatedEventPayload = BrandBaseEventPayload;

export type BrandDeactivatedEventPayload = BrandBaseEventPayload;

export type BrandDeletedEventPayload = BrandBaseEventPayload;

export type BrandRestoredEventPayload = BrandBaseEventPayload;
