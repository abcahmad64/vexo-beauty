import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { VariantEventType } from './variant.event.types';

import {
  VariantActivatedEventPayload,
  VariantCreatedEventPayload,
  VariantDeactivatedEventPayload,
  VariantDeletedEventPayload,
  VariantImageUpdatedEventPayload,
  VariantPriceChangedEventPayload,
  VariantRestoredEventPayload,
  VariantUpdatedEventPayload,
} from './variant.event.payloads';

@Injectable()
export class VariantEventHandler {
  private readonly logger = new Logger(VariantEventHandler.name);

  @OnEvent(VariantEventType.CREATED)
  handleCreated(payload: VariantCreatedEventPayload): void {
    this.logger.log(
      `Variant created: ${payload.sku}; product=${payload.productId}`,
    );
  }

  @OnEvent(VariantEventType.UPDATED)
  handleUpdated(payload: VariantUpdatedEventPayload): void {
    this.logger.log(
      `Variant updated: ${payload.sku}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(VariantEventType.ACTIVATED)
  handleActivated(payload: VariantActivatedEventPayload): void {
    this.logger.log(`Variant activated: ${payload.sku}`);
  }

  @OnEvent(VariantEventType.DEACTIVATED)
  handleDeactivated(payload: VariantDeactivatedEventPayload): void {
    this.logger.warn(`Variant deactivated: ${payload.sku}`);
  }

  @OnEvent(VariantEventType.DELETED)
  handleDeleted(payload: VariantDeletedEventPayload): void {
    this.logger.warn(`Variant soft deleted: ${payload.sku}`);
  }

  @OnEvent(VariantEventType.RESTORED)
  handleRestored(payload: VariantRestoredEventPayload): void {
    this.logger.log(`Variant restored: ${payload.sku}`);
  }

  @OnEvent(VariantEventType.PRICE_CHANGED)
  handlePriceChanged(payload: VariantPriceChangedEventPayload): void {
    this.logger.log(
      `Variant price changed: ${payload.sku}; ${payload.previousPrice ?? 'null'} -> ${payload.currentPrice ?? 'null'}`,
    );
  }

  @OnEvent(VariantEventType.IMAGE_UPDATED)
  handleImageUpdated(payload: VariantImageUpdatedEventPayload): void {
    this.logger.log(`Variant image updated: ${payload.sku}`);
  }
}
