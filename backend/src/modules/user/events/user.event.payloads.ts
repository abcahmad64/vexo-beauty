import { UserStatus } from '../../../generated/prisma';

export interface UserBaseEventPayload {
  readonly userId: string;
  readonly actorId?: string;
  readonly occurredAt: Date;
}

export interface UserCreatedEventPayload extends UserBaseEventPayload {
  readonly email?: string | null;
  readonly phone?: string | null;
}

export interface UserProfileUpdatedEventPayload extends UserBaseEventPayload {
  readonly changedFields: readonly string[];
}

export interface UserUpdatedEventPayload extends UserBaseEventPayload {
  readonly changedFields: readonly string[];
}

export type UserPasswordChangedEventPayload = UserBaseEventPayload;

export interface UserPasswordResetEventPayload extends UserBaseEventPayload {
  readonly revokedSessions: boolean;
}

export interface UserStatusChangedEventPayload extends UserBaseEventPayload {
  readonly previousStatus: UserStatus;
  readonly currentStatus: UserStatus;
  readonly reason?: string | null;
}

export type UserSoftDeletedEventPayload = UserBaseEventPayload;

export type UserRestoredEventPayload = UserBaseEventPayload;

export interface UserSessionsRevokedEventPayload extends UserBaseEventPayload {
  readonly revokedRefreshTokens: number;
  readonly revokedSessions: number;
}
