export type AuthIdentityType = 'email' | 'phone' | 'unknown';

export interface AuthBaseEventPayload {
  userId?: string;
  email?: string | null;
  phone?: string | null;
  identity?: string | null;
  identityType?: AuthIdentityType;
  ipAddress?: string | null;
  userAgent?: string | null;
  occurredAt: Date;
}

export interface UserRegisteredEventPayload extends AuthBaseEventPayload {
  userId: string;
}

export interface UserLoggedInEventPayload extends AuthBaseEventPayload {
  userId: string;
  sessionId?: string | null;
}

export interface TokenRefreshedEventPayload extends AuthBaseEventPayload {
  userId: string;
  sessionId?: string | null;
}

export interface UserLoggedOutEventPayload extends AuthBaseEventPayload {
  userId: string;
}

export interface AllSessionsLoggedOutEventPayload extends AuthBaseEventPayload {
  userId: string;
  revokedSessionsCount: number;
}

export interface SessionRevokedEventPayload extends AuthBaseEventPayload {
  userId: string;
  sessionId: string;
}

export interface LoginFailedEventPayload extends AuthBaseEventPayload {
  reason: string;
}
