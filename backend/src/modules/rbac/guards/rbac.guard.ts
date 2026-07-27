import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { PermissionsGuard } from './permissions.guard';

import { RolesGuard } from './roles.guard';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly rolesGuard: RolesGuard,
    private readonly permissionsGuard: PermissionsGuard,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesAllowed = this.rolesGuard.canActivate(context);

    if (!rolesAllowed) {
      return false;
    }

    return this.permissionsGuard.canActivate(context);
  }
}
