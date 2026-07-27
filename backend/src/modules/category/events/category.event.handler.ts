import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { CategoryEventType } from './category.event.types';

import {
  CategoryActivatedEventPayload,
  CategoryCreatedEventPayload,
  CategoryDeactivatedEventPayload,
  CategoryDeletedEventPayload,
  CategoryMovedEventPayload,
  CategoryRestoredEventPayload,
  CategoryUpdatedEventPayload,
} from './category.event.payloads';

@Injectable()
export class CategoryEventHandler {
  private readonly logger = new Logger(CategoryEventHandler.name);

  @OnEvent(CategoryEventType.CREATED)
  handleCreated(payload: CategoryCreatedEventPayload): void {
    this.logger.log(
      `Category created: ${payload.name}; slug=${payload.slug}; parent=${payload.parentId ?? 'root'}`,
    );
  }

  @OnEvent(CategoryEventType.UPDATED)
  handleUpdated(payload: CategoryUpdatedEventPayload): void {
    this.logger.log(
      `Category updated: ${payload.name}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(CategoryEventType.ACTIVATED)
  handleActivated(payload: CategoryActivatedEventPayload): void {
    this.logger.log(`Category activated: ${payload.name}`);
  }

  @OnEvent(CategoryEventType.DEACTIVATED)
  handleDeactivated(payload: CategoryDeactivatedEventPayload): void {
    this.logger.warn(`Category deactivated: ${payload.name}`);
  }

  @OnEvent(CategoryEventType.DELETED)
  handleDeleted(payload: CategoryDeletedEventPayload): void {
    this.logger.warn(`Category soft deleted: ${payload.name}`);
  }

  @OnEvent(CategoryEventType.RESTORED)
  handleRestored(payload: CategoryRestoredEventPayload): void {
    this.logger.log(`Category restored: ${payload.name}`);
  }

  @OnEvent(CategoryEventType.MOVED)
  handleMoved(payload: CategoryMovedEventPayload): void {
    this.logger.log(
      `Category moved: ${payload.name}; ${payload.previousParentId ?? 'root'} -> ${payload.currentParentId ?? 'root'}`,
    );
  }
}
