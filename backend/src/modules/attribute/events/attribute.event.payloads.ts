export interface AttributeBaseEventPayload {
  attributeId: string;
  name: string;
  actorId?: string;
  occurredAt: Date;
}

export type AttributeCreatedEventPayload = AttributeBaseEventPayload;

export interface AttributeUpdatedEventPayload extends AttributeBaseEventPayload {
  changedFields: string[];
}

export type AttributeDeletedEventPayload = AttributeBaseEventPayload;

export type AttributeRestoredEventPayload = AttributeBaseEventPayload;

export interface AttributeValueBaseEventPayload {
  attributeId: string;
  attributeValueId: string;
  value: string;
  actorId?: string;
  occurredAt: Date;
}

export type AttributeValueCreatedEventPayload = AttributeValueBaseEventPayload;

export interface AttributeValueUpdatedEventPayload extends AttributeValueBaseEventPayload {
  changedFields: string[];
}

export type AttributeValueDeletedEventPayload = AttributeValueBaseEventPayload;

export type AttributeValueRestoredEventPayload = AttributeValueBaseEventPayload;

export interface ProductAttributesSyncedEventPayload {
  productId: string;
  attributeValueIds: string[];
  mode: string;
  actorId?: string;
  occurredAt: Date;
}

export interface VariantAttributesSyncedEventPayload {
  variantId: string;
  productId: string;
  attributeValueIds: string[];
  mode: string;
  actorId?: string;
  occurredAt: Date;
}
