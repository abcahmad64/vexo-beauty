import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

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
export class CategoryEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishCreated(payload: CategoryCreatedEventPayload): void {
    this.eventEmitter.emit(CategoryEventType.CREATED, payload);
  }

  publishUpdated(payload: CategoryUpdatedEventPayload): void {
    this.eventEmitter.emit(CategoryEventType.UPDATED, payload);
  }

  publishActivated(payload: CategoryActivatedEventPayload): void {
    this.eventEmitter.emit(CategoryEventType.ACTIVATED, payload);
  }

  publishDeactivated(payload: CategoryDeactivatedEventPayload): void {
    this.eventEmitter.emit(CategoryEventType.DEACTIVATED, payload);
  }

  publishDeleted(payload: CategoryDeletedEventPayload): void {
    this.eventEmitter.emit(CategoryEventType.DELETED, payload);
  }

  publishRestored(payload: CategoryRestoredEventPayload): void {
    this.eventEmitter.emit(CategoryEventType.RESTORED, payload);
  }

  publishMoved(payload: CategoryMovedEventPayload): void {
    this.eventEmitter.emit(CategoryEventType.MOVED, payload);
  }
}
