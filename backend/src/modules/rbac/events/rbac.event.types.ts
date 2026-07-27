export enum RbacEventType {
  ROLE_CREATED = 'rbac.role_created',
  ROLE_UPDATED = 'rbac.role_updated',
  ROLE_DELETED = 'rbac.role_deleted',

  PERMISSION_CREATED = 'rbac.permission_created',
  PERMISSION_UPDATED = 'rbac.permission_updated',
  PERMISSION_DELETED = 'rbac.permission_deleted',

  ROLE_PERMISSION_GRANTED = 'rbac.role_permission_granted',
  ROLE_PERMISSION_REVOKED = 'rbac.role_permission_revoked',
  ROLE_PERMISSIONS_SYNCED = 'rbac.role_permissions_synced',

  USER_ROLE_ASSIGNED = 'rbac.user_role_assigned',
  USER_ROLE_REVOKED = 'rbac.user_role_revoked',

  DEFAULT_PERMISSIONS_SEEDED = 'rbac.default_permissions_seeded',
}
