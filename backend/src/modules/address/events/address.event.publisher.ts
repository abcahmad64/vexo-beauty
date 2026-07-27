import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { AddressEventType } from './address.event.types';

import {
  AddressCreatedEventPayload,
  AddressDefaultChangedEventPayload,
  AddressDeletedEventPayload,
  AddressUpdatedEventPayload,
} from './address.event.payloads';

@Injectable()
export class AddressEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishCreated(payload: AddressCreatedEventPayload): void {
    this.eventEmitter.emit(AddressEventType.CREATED, payload);
  }

  publishUpdated(payload: AddressUpdatedEventPayload): void {
    this.eventEmitter.emit(AddressEventType.UPDATED, payload);
  }

  publishDeleted(payload: AddressDeletedEventPayload): void {
    this.eventEmitter.emit(AddressEventType.DELETED, payload);
  }

  publishDefaultChanged(payload: AddressDefaultChangedEventPayload): void {
    this.eventEmitter.emit(AddressEventType.DEFAULT_CHANGED, payload);
  }
}
