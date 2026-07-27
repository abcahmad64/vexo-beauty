import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

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
export class BrandEventHandler {
  private readonly logger = new Logger(BrandEventHandler.name);

  @OnEvent(BrandEventType.CREATED)
  handleCreated(payload: BrandCreatedEventPayload): void {
    this.logger.log(`Brand created: ${payload.name}; slug=${payload.slug}`);
  }

  @OnEvent(BrandEventType.UPDATED)
  handleUpdated(payload: BrandUpdatedEventPayload): void {
    this.logger.log(
      `Brand updated: ${payload.name}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(BrandEventType.ACTIVATED)
  handleActivated(payload: BrandActivatedEventPayload): void {
    this.logger.log(`Brand activated: ${payload.name}`);
  }

  @OnEvent(BrandEventType.DEACTIVATED)
  handleDeactivated(payload: BrandDeactivatedEventPayload): void {
    this.logger.warn(`Brand deactivated: ${payload.name}`);
  }

  @OnEvent(BrandEventType.DELETED)
  handleDeleted(payload: BrandDeletedEventPayload): void {
    this.logger.warn(`Brand soft deleted: ${payload.name}`);
  }

  @OnEvent(BrandEventType.RESTORED)
  handleRestored(payload: BrandRestoredEventPayload): void {
    this.logger.log(`Brand restored: ${payload.name}`);
  }
}
