import { ForbiddenException, Injectable } from '@nestjs/common';

type AiRoleInput =
  | string
  | {
      name?: string | null;
    }
  | null
  | undefined;

export interface AiPermissionContext {
  userId?: string | null;
  role?: AiRoleInput;
  roleName?: string | null;
  permissions?: Array<string | null | undefined>;
}

@Injectable()
export class AiPermissionGuardService {
  assertAuthenticated(context: AiPermissionContext): void {
    if (!context.userId) {
      throw new ForbiddenException(
        'برای انجام عملیات هوشمند مدیریتی باید وارد حساب کاربری شوید.',
      );
    }
  }

  assertAllowed(
    context: AiPermissionContext,
    requiredPermissions: string[],
    operationTitle = 'عملیات هوشمند',
  ): void {
    if (this.hasAdminRole(context)) {
      return;
    }

    if (requiredPermissions.length === 0) {
      return;
    }

    if (this.hasAnyPermission(context, requiredPermissions)) {
      return;
    }

    throw new ForbiddenException(`شما مجوز انجام ${operationTitle} را ندارید.`);
  }

  assertApprovalAllowed(
    context: AiPermissionContext,
    operationTitle = 'تأیید عملیات هوشمند',
  ): void {
    this.assertAuthenticated(context);

    this.assertAllowed(
      context,
      ['admin:*', 'admin:manage', 'ai:*', 'ai:manage', 'ai:approve'],
      operationTitle,
    );
  }

  hasAdminRole(context: AiPermissionContext): boolean {
    const role =
      this.normalizeRole(context.roleName) || this.normalizeRole(context.role);

    return role === 'admin' || role === 'super_admin' || role === 'owner';
  }

  hasAnyPermission(
    context: AiPermissionContext,
    requiredPermissions: string[],
  ): boolean {
    const permissions = this.normalizePermissions(context.permissions ?? []);

    if (permissions.has('admin:*') || permissions.has('ai:*')) {
      return true;
    }

    return requiredPermissions
      .map((permission) => this.normalizePermission(permission))
      .some((permission) => this.matchesPermission(permissions, permission));
  }

  normalizePermissions(
    permissions: Array<string | null | undefined>,
  ): Set<string> {
    return new Set(
      permissions
        .map((permission) => this.normalizePermission(permission ?? ''))
        .filter(Boolean),
    );
  }

  private matchesPermission(
    permissions: Set<string>,
    requiredPermission: string,
  ): boolean {
    if (permissions.has(requiredPermission)) {
      return true;
    }

    const [scope] = requiredPermission.split(':');

    if (scope && permissions.has(`${scope}:*`)) {
      return true;
    }

    return false;
  }

  private normalizePermission(permission: string): string {
    return permission.trim().toLowerCase();
  }

  private normalizeRole(role: AiRoleInput): string | null {
    if (!role) {
      return null;
    }

    if (typeof role === 'string') {
      return role.trim().toLowerCase();
    }

    return role.name ? role.name.trim().toLowerCase() : null;
  }
}
