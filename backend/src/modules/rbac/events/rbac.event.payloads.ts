export interface RbacBaseEventPayload {
  actorId?: string;
  occurredAt: Date;
}

export interface RoleCreatedEventPayload extends RbacBaseEventPayload {
  roleId: string;
  name: string;
}

export interface RoleUpdatedEventPayload extends RbacBaseEventPayload {
  roleId: string;
  name: string;
  changedFields: string[];
}

export interface RoleDeletedEventPayload extends RbacBaseEventPayload {
  roleId: string;
  name: string;
}

export interface PermissionCreatedEventPayload extends RbacBaseEventPayload {
  permissionId: string;
  name: string;
}

export interface PermissionUpdatedEventPayload extends RbacBaseEventPayload {
  permissionId: string;
  name: string;
  changedFields: string[];
}

export interface PermissionDeletedEventPayload extends RbacBaseEventPayload {
  permissionId: string;
  name: string;
}

export interface RolePermissionGrantedEventPayload extends RbacBaseEventPayload {
  roleId: string;
  permissionId: string;
}

export interface RolePermissionRevokedEventPayload extends RbacBaseEventPayload {
  roleId: string;
  permissionId: string;
}

export interface RolePermissionsSyncedEventPayload extends RbacBaseEventPayload {
  roleId: string;
  permissionIds: string[];
}

export interface UserRoleAssignedEventPayload extends RbacBaseEventPayload {
  userId: string;
  roleId: string;
}

export interface UserRoleRevokedEventPayload extends RbacBaseEventPayload {
  userId: string;
}

export interface DefaultPermissionsSeededEventPayload extends RbacBaseEventPayload {
  createdCount: number;
  existingCount: number;
}
