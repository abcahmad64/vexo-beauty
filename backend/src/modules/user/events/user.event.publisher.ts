import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  UserCreatedEventPayload,
  UserPasswordChangedEventPayload,
  UserPasswordResetEventPayload,
  UserProfileUpdatedEventPayload,
  UserRestoredEventPayload,
  UserSessionsRevokedEventPayload,
  UserSoftDeletedEventPayload,
  UserStatusChangedEventPayload,
  UserUpdatedEventPayload,
} from './user.event.payloads';
import { UserEventType } from './user.event.types';

@Injectable()
export class UserEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishCreated(payload: UserCreatedEventPayload): void {
    this.eventEmitter.emit(UserEventType.CREATED, payload);
  }

  publishProfileUpdated(payload: UserProfileUpdatedEventPayload): void {
    this.eventEmitter.emit(UserEventType.PROFILE_UPDATED, payload);
  }

  publishUpdated(payload: UserUpdatedEventPayload): void {
    this.eventEmitter.emit(UserEventType.UPDATED, payload);
  }

  publishPasswordChanged(payload: UserPasswordChangedEventPayload): void {
    this.eventEmitter.emit(UserEventType.PASSWORD_CHANGED, payload);
  }

  publishPasswordReset(payload: UserPasswordResetEventPayload): void {
    this.eventEmitter.emit(UserEventType.PASSWORD_RESET, payload);
  }

  publishStatusChanged(payload: UserStatusChangedEventPayload): void {
    this.eventEmitter.emit(UserEventType.STATUS_CHANGED, payload);
  }

  publishSoftDeleted(payload: UserSoftDeletedEventPayload): void {
    this.eventEmitter.emit(UserEventType.SOFT_DELETED, payload);
  }

  publishRestored(payload: UserRestoredEventPayload): void {
    this.eventEmitter.emit(UserEventType.RESTORED, payload);
  }

  publishSessionsRevoked(payload: UserSessionsRevokedEventPayload): void {
    this.eventEmitter.emit(UserEventType.SESSIONS_REVOKED, payload);
  }
}
