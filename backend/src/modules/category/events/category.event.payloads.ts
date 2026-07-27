export interface CategoryBaseEventPayload {
  categoryId: string;
  name: string;
  slug: string;
  actorId?: string;
  occurredAt: Date;
}

export interface CategoryCreatedEventPayload extends CategoryBaseEventPayload {
  parentId?: string | null;
}

export interface CategoryUpdatedEventPayload extends CategoryBaseEventPayload {
  changedFields: string[];
}

export type CategoryActivatedEventPayload = CategoryBaseEventPayload;

export type CategoryDeactivatedEventPayload = CategoryBaseEventPayload;

export type CategoryDeletedEventPayload = CategoryBaseEventPayload;

export type CategoryRestoredEventPayload = CategoryBaseEventPayload;

export interface CategoryMovedEventPayload extends CategoryBaseEventPayload {
  previousParentId?: string | null;
  currentParentId?: string | null;
}
