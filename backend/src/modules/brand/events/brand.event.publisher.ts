import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { BrandEventType } from './brand.event.types';

import {
  BrandActivatedEventPayload,
  BrandCreatedEventPayload,
  BrandDeactivatedEventPayload,
  BrandDeletedEventPayload,
  BrandRestoredEventPayload,
  BrandUpdatedEventPayload,
} from './brand.event.payloads';

@Injectable()
export class BrandEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishCreated(payload: BrandCreatedEventPayload): void {
    this.eventEmitter.emit(BrandEventType.CREATED, payload);
  }

  publishUpdated(payload: BrandUpdatedEventPayload): void {
    this.eventEmitter.emit(BrandEventType.UPDATED, payload);
  }

  publishActivated(payload: BrandActivatedEventPayload): void {
    this.eventEmitter.emit(BrandEventType.ACTIVATED, payload);
  }

  publishDeactivated(payload: BrandDeactivatedEventPayload): void {
    this.eventEmitter.emit(BrandEventType.DEACTIVATED, payload);
  }

  publishDeleted(payload: BrandDeletedEventPayload): void {
    this.eventEmitter.emit(BrandEventType.DELETED, payload);
  }

  publishRestored(payload: BrandRestoredEventPayload): void {
    this.eventEmitter.emit(BrandEventType.RESTORED, payload);
  }
}
