import { AIMessageRole } from '../../../generated/prisma';

export interface AiBaseEventPayload {
  actorId?: string;
  occurredAt: Date;
}

export interface AiConversationCreatedEventPayload extends AiBaseEventPayload {
  conversationId: string;
  userId: string;
  externalId?: string | null;
}

export interface AiMessageCreatedEventPayload extends AiBaseEventPayload {
  conversationId: string;
  messageId: string;
  role: AIMessageRole;
}

export interface AiProductAdviceGeneratedEventPayload extends AiBaseEventPayload {
  productIds: string[];
  request: string;
}

export interface AiProductComparisonGeneratedEventPayload extends AiBaseEventPayload {
  productIds: string[];
}

export interface AiProductContentGeneratedEventPayload extends AiBaseEventPayload {
  productId: string;
  applied: boolean;
}

export interface AiProductContentAppliedEventPayload extends AiBaseEventPayload {
  productId: string;
  updatedFields: string[];
}

export interface AiArticleDraftGeneratedEventPayload extends AiBaseEventPayload {
  topic: string;
  productIds: string[];
}

export interface AiAbandonedOfferGeneratedEventPayload extends AiBaseEventPayload {
  productId: string;
  userId?: string | null;
  visitorId?: string | null;
  discountPercent: number;
  couponCode?: string | null;
}
