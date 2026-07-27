import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import { CORE_METADATA_KEYS } from '../../../core/constants/core.constants';

import { SECURITY_MESSAGES } from '../../../core/security/constants/security.constants';

import {
  RBAC_ANY_PERMISSIONS_KEY,
  RBAC_PERMISSIONS_KEY,
  SystemRoles,
} from '../constants/rbac.constants';

type RequestWithUser = {
  user?: {
    role?:
      | string
      | {
          name?: string | null;
        }
      | null;
    roleName?: string | null;
    permissions?: readonly string[];
  };
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublic(context)) {
      return true;
    }

    const requiredAllPermissions =
      this.reflector.getAllAndOverride<string[]>(RBAC_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const requiredAnyPermissions =
      this.reflector.getAllAndOverride<string[]>(RBAC_ANY_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (
      requiredAllPermissions.length === 0 &&
      requiredAnyPermissions.length === 0
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const roleName = this.getRoleName(request.user);

    if (roleName === this.normalizeRole(SystemRoles.SUPER_ADMIN)) {
      return true;
    }

    const userPermissions = new Set(
      (request.user?.permissions ?? []).map((permission) =>
        this.normalizePermission(permission),
      ),
    );

    const hasAllPermissions = requiredAllPermissions.every((permission) =>
      userPermissions.has(this.normalizePermission(permission)),
    );

    const hasAnyPermission =
      requiredAnyPermissions.length === 0 ||
      requiredAnyPermissions.some((permission) =>
        userPermissions.has(this.normalizePermission(permission)),
      );

    if (!hasAllPermissions || !hasAnyPermission) {
      throw new ForbiddenException(SECURITY_MESSAGES.PERMISSION_FORBIDDEN);
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

  private normalizePermission(permission: string): string {
    return permission.trim().toLowerCase();
  }
}
