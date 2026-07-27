import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

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
export class AiEventHandler {
  private readonly logger = new Logger(AiEventHandler.name);

  @OnEvent(AiEventType.CONVERSATION_CREATED)
  handleConversationCreated(payload: AiConversationCreatedEventPayload): void {
    this.logger.log(`AI conversation created: ${payload.conversationId}`);
  }

  @OnEvent(AiEventType.MESSAGE_CREATED)
  handleMessageCreated(payload: AiMessageCreatedEventPayload): void {
    this.logger.log(
      `AI message created: ${payload.messageId}; role=${payload.role}`,
    );
  }

  @OnEvent(AiEventType.PRODUCT_ADVICE_GENERATED)
  handleProductAdviceGenerated(
    payload: AiProductAdviceGeneratedEventPayload,
  ): void {
    this.logger.log(
      `AI product advice generated; products=${payload.productIds.length}`,
    );
  }

  @OnEvent(AiEventType.PRODUCT_COMPARISON_GENERATED)
  handleProductComparisonGenerated(
    payload: AiProductComparisonGeneratedEventPayload,
  ): void {
    this.logger.log(
      `AI product comparison generated; products=${payload.productIds.length}`,
    );
  }

  @OnEvent(AiEventType.PRODUCT_CONTENT_GENERATED)
  handleProductContentGenerated(
    payload: AiProductContentGeneratedEventPayload,
  ): void {
    this.logger.log(
      `AI product content generated: ${payload.productId}; applied=${payload.applied}`,
    );
  }

  @OnEvent(AiEventType.PRODUCT_CONTENT_APPLIED)
  handleProductContentApplied(
    payload: AiProductContentAppliedEventPayload,
  ): void {
    this.logger.log(
      `AI product content applied: ${payload.productId}; fields=${payload.updatedFields.join(', ')}`,
    );
  }

  @OnEvent(AiEventType.ARTICLE_DRAFT_GENERATED)
  handleArticleDraftGenerated(
    payload: AiArticleDraftGeneratedEventPayload,
  ): void {
    this.logger.log(`AI article draft generated: ${payload.topic}`);
  }

  @OnEvent(AiEventType.ABANDONED_OFFER_GENERATED)
  handleAbandonedOfferGenerated(
    payload: AiAbandonedOfferGeneratedEventPayload,
  ): void {
    this.logger.log(
      `AI abandoned offer generated: product=${payload.productId}; discount=${payload.discountPercent}%`,
    );
  }
}
