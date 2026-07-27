import { SetMetadata } from '@nestjs/common';

import { RBAC_ROLES_KEY } from '../constants/rbac.constants';

export const Roles = (...roles: string[]) => SetMetadata(RBAC_ROLES_KEY, roles);
