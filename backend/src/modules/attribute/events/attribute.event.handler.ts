import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { AttributeEventType } from './attribute.event.types';

import {
  AttributeCreatedEventPayload,
  AttributeDeletedEventPayload,
  AttributeRestoredEventPayload,
  AttributeUpdatedEventPayload,
  AttributeValueCreatedEventPayload,
  AttributeValueDeletedEventPayload,
  AttributeValueRestoredEventPayload,
  AttributeValueUpdatedEventPayload,
  ProductAttributesSyncedEventPayload,
  VariantAttributesSyncedEventPayload,
} from './attribute.event.payloads';

@Injectable()
export class AttributeEventHandler {
  private readonly logger = new Logger(AttributeEventHandler.name);

  @OnEvent(AttributeEventType.ATTRIBUTE_CREATED)
  handleAttributeCreated(payload: AttributeCreatedEventPayload): void {
    this.logger.log(
      `Attribute created: ${payload.name}; id=${payload.attributeId}`,
    );
  }

  @OnEvent(AttributeEventType.ATTRIBUTE_UPDATED)
  handleAttributeUpdated(payload: AttributeUpdatedEventPayload): void {
    this.logger.log(
      `Attribute updated: ${payload.name}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(AttributeEventType.ATTRIBUTE_DELETED)
  handleAttributeDeleted(payload: AttributeDeletedEventPayload): void {
    this.logger.warn(`Attribute soft deleted: ${payload.name}`);
  }

  @OnEvent(AttributeEventType.ATTRIBUTE_RESTORED)
  handleAttributeRestored(payload: AttributeRestoredEventPayload): void {
    this.logger.log(`Attribute restored: ${payload.name}`);
  }

  @OnEvent(AttributeEventType.VALUE_CREATED)
  handleValueCreated(payload: AttributeValueCreatedEventPayload): void {
    this.logger.log(
      `Attribute value created: ${payload.value}; attribute=${payload.attributeId}`,
    );
  }

  @OnEvent(AttributeEventType.VALUE_UPDATED)
  handleValueUpdated(payload: AttributeValueUpdatedEventPayload): void {
    this.logger.log(
      `Attribute value updated: ${payload.value}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(AttributeEventType.VALUE_DELETED)
  handleValueDeleted(payload: AttributeValueDeletedEventPayload): void {
    this.logger.warn(`Attribute value soft deleted: ${payload.value}`);
  }

  @OnEvent(AttributeEventType.VALUE_RESTORED)
  handleValueRestored(payload: AttributeValueRestoredEventPayload): void {
    this.logger.log(`Attribute value restored: ${payload.value}`);
  }

  @OnEvent(AttributeEventType.PRODUCT_ATTRIBUTES_SYNCED)
  handleProductAttributesSynced(
    payload: ProductAttributesSyncedEventPayload,
  ): void {
    this.logger.log(
      `Product attributes synced: product=${payload.productId}; mode=${payload.mode}; count=${payload.attributeValueIds.length}`,
    );
  }

  @OnEvent(AttributeEventType.VARIANT_ATTRIBUTES_SYNCED)
  handleVariantAttributesSynced(
    payload: VariantAttributesSyncedEventPayload,
  ): void {
    this.logger.log(
      `Variant attributes synced: variant=${payload.variantId}; mode=${payload.mode}; count=${payload.attributeValueIds.length}`,
    );
  }
}
