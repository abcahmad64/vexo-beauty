import type { Request } from 'express';

export interface AuthenticatedRequestRole {
  readonly id?: string | null;
  readonly name?: string | null;
}

export interface AuthenticatedRequestUser {
  readonly id?: string | null;
  readonly userId?: string | null;
  readonly sub?: string | null;
  readonly sessionId?: string | null;

  readonly email?: string | null;
  readonly phone?: string | null;
  readonly mobile?: string | null;

  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly avatarUrl?: string | null;

  readonly status?: string | null;
  readonly roleId?: string | null;
  readonly roleName?: string | null;
  readonly role?: string | AuthenticatedRequestRole | null;
  readonly roles?: readonly string[];

  readonly permissions?: readonly string[];

  readonly isActive?: boolean;
}

export interface AuthenticatedRequest extends Request {
  readonly user?: AuthenticatedRequestUser;
  readonly requestId?: string;
  readonly correlationId?: string;
}
