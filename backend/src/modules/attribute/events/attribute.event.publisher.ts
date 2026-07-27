import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

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
export class AttributeEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishAttributeCreated(payload: AttributeCreatedEventPayload): void {
    this.eventEmitter.emit(AttributeEventType.ATTRIBUTE_CREATED, payload);
  }

  publishAttributeUpdated(payload: AttributeUpdatedEventPayload): void {
    this.eventEmitter.emit(AttributeEventType.ATTRIBUTE_UPDATED, payload);
  }

  publishAttributeDeleted(payload: AttributeDeletedEventPayload): void {
    this.eventEmitter.emit(AttributeEventType.ATTRIBUTE_DELETED, payload);
  }

  publishAttributeRestored(payload: AttributeRestoredEventPayload): void {
    this.eventEmitter.emit(AttributeEventType.ATTRIBUTE_RESTORED, payload);
  }

  publishValueCreated(payload: AttributeValueCreatedEventPayload): void {
    this.eventEmitter.emit(AttributeEventType.VALUE_CREATED, payload);
  }

  publishValueUpdated(payload: AttributeValueUpdatedEventPayload): void {
    this.eventEmitter.emit(AttributeEventType.VALUE_UPDATED, payload);
  }

  publishValueDeleted(payload: AttributeValueDeletedEventPayload): void {
    this.eventEmitter.emit(AttributeEventType.VALUE_DELETED, payload);
  }

  publishValueRestored(payload: AttributeValueRestoredEventPayload): void {
    this.eventEmitter.emit(AttributeEventType.VALUE_RESTORED, payload);
  }

  publishProductAttributesSynced(
    payload: ProductAttributesSyncedEventPayload,
  ): void {
    this.eventEmitter.emit(
      AttributeEventType.PRODUCT_ATTRIBUTES_SYNCED,
      payload,
    );
  }

  publishVariantAttributesSynced(
    payload: VariantAttributesSyncedEventPayload,
  ): void {
    this.eventEmitter.emit(
      AttributeEventType.VARIANT_ATTRIBUTES_SYNCED,
      payload,
    );
  }
}
