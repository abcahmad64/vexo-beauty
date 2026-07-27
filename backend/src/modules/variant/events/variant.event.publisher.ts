import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

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
export class VariantEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishCreated(payload: VariantCreatedEventPayload): void {
    this.eventEmitter.emit(VariantEventType.CREATED, payload);
  }

  publishUpdated(payload: VariantUpdatedEventPayload): void {
    this.eventEmitter.emit(VariantEventType.UPDATED, payload);
  }

  publishActivated(payload: VariantActivatedEventPayload): void {
    this.eventEmitter.emit(VariantEventType.ACTIVATED, payload);
  }

  publishDeactivated(payload: VariantDeactivatedEventPayload): void {
    this.eventEmitter.emit(VariantEventType.DEACTIVATED, payload);
  }

  publishDeleted(payload: VariantDeletedEventPayload): void {
    this.eventEmitter.emit(VariantEventType.DELETED, payload);
  }

  publishRestored(payload: VariantRestoredEventPayload): void {
    this.eventEmitter.emit(VariantEventType.RESTORED, payload);
  }

  publishPriceChanged(payload: VariantPriceChangedEventPayload): void {
    this.eventEmitter.emit(VariantEventType.PRICE_CHANGED, payload);
  }

  publishImageUpdated(payload: VariantImageUpdatedEventPayload): void {
    this.eventEmitter.emit(VariantEventType.IMAGE_UPDATED, payload);
  }
}
