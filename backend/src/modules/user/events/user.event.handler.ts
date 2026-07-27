import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

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
export class UserEventHandler {
  private readonly logger = new Logger(UserEventHandler.name);

  @OnEvent(UserEventType.CREATED)
  handleCreated(payload: UserCreatedEventPayload): void {
    this.logger.log(
      `User created: id=${payload.userId}; email=${payload.email ?? 'null'}; phone=${payload.phone ?? 'null'}`,
    );
  }

  @OnEvent(UserEventType.PROFILE_UPDATED)
  handleProfileUpdated(payload: UserProfileUpdatedEventPayload): void {
    this.logger.log(
      `User profile updated: ${payload.userId}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(UserEventType.UPDATED)
  handleUpdated(payload: UserUpdatedEventPayload): void {
    this.logger.log(
      `User updated: ${payload.userId}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(UserEventType.PASSWORD_CHANGED)
  handlePasswordChanged(payload: UserPasswordChangedEventPayload): void {
    this.logger.warn(`User password changed: ${payload.userId}`);
  }

  @OnEvent(UserEventType.PASSWORD_RESET)
  handlePasswordReset(payload: UserPasswordResetEventPayload): void {
    this.logger.warn(
      `User password reset: ${payload.userId}; revokedSessions=${payload.revokedSessions}`,
    );
  }

  @OnEvent(UserEventType.STATUS_CHANGED)
  handleStatusChanged(payload: UserStatusChangedEventPayload): void {
    this.logger.warn(
      `User status changed: ${payload.userId}; ${payload.previousStatus} -> ${payload.currentStatus}`,
    );
  }

  @OnEvent(UserEventType.SOFT_DELETED)
  handleSoftDeleted(payload: UserSoftDeletedEventPayload): void {
    this.logger.warn(`User soft deleted: ${payload.userId}`);
  }

  @OnEvent(UserEventType.RESTORED)
  handleRestored(payload: UserRestoredEventPayload): void {
    this.logger.log(`User restored: ${payload.userId}`);
  }

  @OnEvent(UserEventType.SESSIONS_REVOKED)
  handleSessionsRevoked(payload: UserSessionsRevokedEventPayload): void {
    this.logger.warn(
      `User sessions revoked: ${payload.userId}; tokens=${payload.revokedRefreshTokens}; sessions=${payload.revokedSessions}`,
    );
  }
}
