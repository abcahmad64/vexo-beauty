import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { AddressEventType } from './address.event.types';

import {
  AddressCreatedEventPayload,
  AddressDefaultChangedEventPayload,
  AddressDeletedEventPayload,
  AddressUpdatedEventPayload,
} from './address.event.payloads';

@Injectable()
export class AddressEventHandler {
  private readonly logger = new Logger(AddressEventHandler.name);

  @OnEvent(AddressEventType.CREATED)
  handleCreated(payload: AddressCreatedEventPayload): void {
    this.logger.log(
      `Address created: ${payload.addressId} for user ${payload.userId}`,
    );
  }

  @OnEvent(AddressEventType.UPDATED)
  handleUpdated(payload: AddressUpdatedEventPayload): void {
    this.logger.log(
      `Address updated: ${payload.addressId}; fields: ${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(AddressEventType.DELETED)
  handleDeleted(payload: AddressDeletedEventPayload): void {
    this.logger.log(
      `Address soft deleted: ${payload.addressId}; wasDefault=${payload.wasDefault}`,
    );
  }

  @OnEvent(AddressEventType.DEFAULT_CHANGED)
  handleDefaultChanged(payload: AddressDefaultChangedEventPayload): void {
    this.logger.log(
      `Default address changed for user ${payload.userId}; newDefault=${payload.addressId}`,
    );
  }
}
