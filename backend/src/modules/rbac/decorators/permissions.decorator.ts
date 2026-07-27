import { SetMetadata } from '@nestjs/common';

import {
  RBAC_ANY_PERMISSIONS_KEY,
  RBAC_PERMISSIONS_KEY,
} from '../constants/rbac.constants';

export const Permissions = (...permissions: string[]) =>
  SetMetadata(RBAC_PERMISSIONS_KEY, permissions);

export const AnyPermissions = (...permissions: string[]) =>
  SetMetadata(RBAC_ANY_PERMISSIONS_KEY, permissions);
