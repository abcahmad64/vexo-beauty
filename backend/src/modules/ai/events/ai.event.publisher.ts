import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { AiEventType } from './ai.event.types';

import {
  AiAbandonedOfferGeneratedEventPayload,
  AiArticleDraftGeneratedEventPayload,
  AiConversationCreatedEventPayload,
  AiMessageCreatedEventPayload,
  AiProductAdviceGeneratedEventPayload,
  AiProductComparisonGeneratedEventPayload,
  AiProductContentAppliedEventPayload,
  AiProductContentGeneratedEventPayload,
} from './ai.event.payloads';

@Injectable()
export class AiEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishConversationCreated(payload: AiConversationCreatedEventPayload): void {
    this.eventEmitter.emit(AiEventType.CONVERSATION_CREATED, payload);
  }

  publishMessageCreated(payload: AiMessageCreatedEventPayload): void {
    this.eventEmitter.emit(AiEventType.MESSAGE_CREATED, payload);
  }

  publishProductAdviceGenerated(
    payload: AiProductAdviceGeneratedEventPayload,
  ): void {
    this.eventEmitter.emit(AiEventType.PRODUCT_ADVICE_GENERATED, payload);
  }

  publishProductComparisonGenerated(
    payload: AiProductComparisonGeneratedEventPayload,
  ): void {
    this.eventEmitter.emit(AiEventType.PRODUCT_COMPARISON_GENERATED, payload);
  }

  publishProductContentGenerated(
    payload: AiProductContentGeneratedEventPayload,
  ): void {
    this.eventEmitter.emit(AiEventType.PRODUCT_CONTENT_GENERATED, payload);
  }

  publishProductContentApplied(
    payload: AiProductContentAppliedEventPayload,
  ): void {
    this.eventEmitter.emit(AiEventType.PRODUCT_CONTENT_APPLIED, payload);
  }

  publishArticleDraftGenerated(
    payload: AiArticleDraftGeneratedEventPayload,
  ): void {
    this.eventEmitter.emit(AiEventType.ARTICLE_DRAFT_GENERATED, payload);
  }

  publishAbandonedOfferGenerated(
    payload: AiAbandonedOfferGeneratedEventPayload,
  ): void {
    this.eventEmitter.emit(AiEventType.ABANDONED_OFFER_GENERATED, payload);
  }
}
