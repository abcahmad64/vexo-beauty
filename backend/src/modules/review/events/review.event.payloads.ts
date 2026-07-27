export interface ReviewBaseEventPayload {
  reviewId: string;
  productId: string;
  userId: string;
  actorId?: string;
  occurredAt: Date;
}

export interface ReviewCreatedEventPayload extends ReviewBaseEventPayload {
  rating: number;
  isVerified: boolean;
}

export interface ReviewUpdatedEventPayload extends ReviewBaseEventPayload {
  changedFields: string[];
  previousRating: number;
  currentRating: number;
}

export interface ReviewDeletedEventPayload extends ReviewBaseEventPayload {
  rating: number;
}

export interface ReviewVerifiedEventPayload extends ReviewBaseEventPayload {
  reason?: string;
}

export interface ReviewUnverifiedEventPayload extends ReviewBaseEventPayload {
  reason?: string;
}

export interface ReviewProductRatingSyncedEventPayload {
  productId: string;
  reviewCount: number;
  averageRating: string | null;
  actorId?: string;
  occurredAt: Date;
}
