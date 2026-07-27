import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

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
export class AuthEventHandler {
  private readonly logger = new Logger(AuthEventHandler.name);

  @OnEvent(AuthEventType.USER_REGISTERED)
  handleUserRegistered(payload: UserRegisteredEventPayload): void {
    this.logger.log(
      `User registered: ${this.getIdentityLabel(payload)}; id=${payload.userId}`,
    );
  }

  @OnEvent(AuthEventType.USER_LOGGED_IN)
  handleUserLoggedIn(payload: UserLoggedInEventPayload): void {
    this.logger.log(
      `User logged in: ${this.getIdentityLabel(payload)}; session=${payload.sessionId ?? 'N/A'}`,
    );
  }

  @OnEvent(AuthEventType.TOKEN_REFRESHED)
  handleTokenRefreshed(payload: TokenRefreshedEventPayload): void {
    this.logger.log(
      `Token refreshed: user=${payload.userId}; session=${payload.sessionId ?? 'N/A'}`,
    );
  }

  @OnEvent(AuthEventType.USER_LOGGED_OUT)
  handleUserLoggedOut(payload: UserLoggedOutEventPayload): void {
    this.logger.log(`User logged out: user=${payload.userId}`);
  }

  @OnEvent(AuthEventType.ALL_SESSIONS_LOGGED_OUT)
  handleAllSessionsLoggedOut(payload: AllSessionsLoggedOutEventPayload): void {
    this.logger.warn(
      `All sessions logged out: user=${payload.userId}; count=${payload.revokedSessionsCount}`,
    );
  }

  @OnEvent(AuthEventType.SESSION_REVOKED)
  handleSessionRevoked(payload: SessionRevokedEventPayload): void {
    this.logger.warn(
      `Session revoked: user=${payload.userId}; session=${payload.sessionId}`,
    );
  }

  @OnEvent(AuthEventType.LOGIN_FAILED)
  handleLoginFailed(payload: LoginFailedEventPayload): void {
    this.logger.warn(
      `Login failed: ${this.getIdentityLabel(payload)}; reason=${payload.reason}`,
    );
  }

  private getIdentityLabel(payload: {
    identity?: string | null;
    identityType?: string | null;
    email?: string | null;
    phone?: string | null;
    userId?: string | null;
  }): string {
    if (payload.identity) {
      return `${payload.identityType ?? 'identity'}=${this.maskIdentity(
        payload.identity,
      )}`;
    }

    if (payload.phone) {
      return `phone=${this.maskPhone(payload.phone)}`;
    }

    if (payload.email) {
      return `email=${this.maskEmail(payload.email)}`;
    }

    if (payload.userId) {
      return `user=${payload.userId}`;
    }

    return 'unknown';
  }

  private maskIdentity(value: string): string {
    if (value.includes('@')) {
      return this.maskEmail(value);
    }

    if (value.startsWith('+') || /^\d+$/.test(value)) {
      return this.maskPhone(value);
    }

    return value.length <= 4
      ? '****'
      : `${value.slice(0, 2)}****${value.slice(-2)}`;
  }

  private maskPhone(phone: string): string {
    const normalized = phone.trim();

    if (normalized.length <= 6) {
      return '****';
    }

    return `${normalized.slice(0, 4)}****${normalized.slice(-3)}`;
  }

  private maskEmail(email: string): string {
    const normalized = email.trim().toLowerCase();
    const [localPart, domain] = normalized.split('@');

    if (!localPart || !domain) {
      return this.maskIdentity(normalized);
    }

    const maskedLocal =
      localPart.length <= 2
        ? `${localPart[0] ?? '*'}***`
        : `${localPart.slice(0, 2)}***`;

    return `${maskedLocal}@${domain}`;
  }
}
