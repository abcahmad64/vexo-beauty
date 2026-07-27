import type { ExecutionContext } from '@nestjs/common';

import type {
  AuthenticatedRequest,
  AuthenticatedRequestUser,
} from '../../interfaces/authenticated-request.interface';

export interface SecurityClientInfo {
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly requestId: string | null;
  readonly correlationId: string | null;
}

export interface SecurityContextSnapshot {
  readonly isHttp: boolean;
  readonly isPublic: boolean;
  readonly user: AuthenticatedRequestUser | null;
  readonly userId: string | null;
  readonly roleName: string | null;
  readonly permissions: readonly string[];
  readonly client: SecurityClientInfo | null;
}

export interface SecurityContextReader {
  getRequest(context: ExecutionContext): AuthenticatedRequest | null;

  getUser(context: ExecutionContext): AuthenticatedRequestUser | null;

  getUserId(context: ExecutionContext): string | null;

  getRoleName(context: ExecutionContext): string | null;

  getPermissions(context: ExecutionContext): readonly string[];

  isPublic(context: ExecutionContext): boolean;

  getClientInfo(context: ExecutionContext): SecurityClientInfo | null;

  createSnapshot(context: ExecutionContext): SecurityContextSnapshot;
}
