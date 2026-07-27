import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  AllSessionsLoggedOutEventPayload,
  LoginFailedEventPayload,
  SessionRevokedEventPayload,
  TokenRefreshedEventPayload,
  UserLoggedInEventPayload,
  UserLoggedOutEventPayload,
  UserRegisteredEventPayload,
} from './auth.event.payloads';
import { AuthEventType } from './auth.event.types';

@Injectable()
export class AuthEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishUserRegistered(payload: UserRegisteredEventPayload): void {
    this.emit(AuthEventType.USER_REGISTERED, payload);
  }

  publishUserLoggedIn(payload: UserLoggedInEventPayload): void {
    this.emit(AuthEventType.USER_LOGGED_IN, payload);
  }

  publishTokenRefreshed(payload: TokenRefreshedEventPayload): void {
    this.emit(AuthEventType.TOKEN_REFRESHED, payload);
  }

  publishUserLoggedOut(payload: UserLoggedOutEventPayload): void {
    this.emit(AuthEventType.USER_LOGGED_OUT, payload);
  }

  publishAllSessionsLoggedOut(payload: AllSessionsLoggedOutEventPayload): void {
    this.emit(AuthEventType.ALL_SESSIONS_LOGGED_OUT, payload);
  }

  publishSessionRevoked(payload: SessionRevokedEventPayload): void {
    this.emit(AuthEventType.SESSION_REVOKED, payload);
  }

  publishLoginFailed(payload: LoginFailedEventPayload): void {
    this.emit(AuthEventType.LOGIN_FAILED, payload);
  }

  private emit<TPayload extends object>(
    eventType: AuthEventType,
    payload: TPayload,
  ): void {
    this.eventEmitter.emit(eventType, payload);
  }
}
