import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import { CORE_METADATA_KEYS } from '../../../core/constants/core.constants';

import { SECURITY_MESSAGES } from '../../../core/security/constants/security.constants';

import { RBAC_ROLES_KEY, SystemRoles } from '../constants/rbac.constants';

type RequestWithUser = {
  user?: {
    role?:
      | string
      | {
          name?: string | null;
        }
      | null;
    roleName?: string | null;
  };
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublic(context)) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      RBAC_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const roleName = this.getRoleName(request.user);

    if (!roleName) {
      throw new ForbiddenException(SECURITY_MESSAGES.ROLE_REQUIRED);
    }

    if (this.isPrivilegedRole(roleName)) {
      return true;
    }

    const allowed = requiredRoles
      .map((role) => this.normalizeRole(role))
      .includes(roleName);

    if (!allowed) {
      throw new ForbiddenException(SECURITY_MESSAGES.ROLE_FORBIDDEN);
    }

    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(CORE_METADATA_KEYS.IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  private isPrivilegedRole(roleName: string): boolean {
    return [
      this.normalizeRole(SystemRoles.SUPER_ADMIN),
      this.normalizeRole(SystemRoles.ADMIN),
    ].includes(roleName);
  }

  private getRoleName(user: RequestWithUser['user']): string | null {
    const role =
      typeof user?.role === 'string'
        ? user.role
        : (user?.role?.name ?? user?.roleName ?? null);

    return role ? this.normalizeRole(role) : null;
  }

  private normalizeRole(role: string): string {
    return role.trim().toUpperCase();
  }
}
