import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { RbacEventType } from './rbac.event.types';

import {
  DefaultPermissionsSeededEventPayload,
  PermissionCreatedEventPayload,
  PermissionDeletedEventPayload,
  PermissionUpdatedEventPayload,
  RoleCreatedEventPayload,
  RoleDeletedEventPayload,
  RolePermissionGrantedEventPayload,
  RolePermissionRevokedEventPayload,
  RolePermissionsSyncedEventPayload,
  RoleUpdatedEventPayload,
  UserRoleAssignedEventPayload,
  UserRoleRevokedEventPayload,
} from './rbac.event.payloads';

@Injectable()
export class RbacEventHandler {
  private readonly logger = new Logger(RbacEventHandler.name);

  @OnEvent(RbacEventType.ROLE_CREATED)
  handleRoleCreated(payload: RoleCreatedEventPayload): void {
    this.logger.log(`Role created: ${payload.name}; id=${payload.roleId}`);
  }

  @OnEvent(RbacEventType.ROLE_UPDATED)
  handleRoleUpdated(payload: RoleUpdatedEventPayload): void {
    this.logger.log(
      `Role updated: ${payload.name}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(RbacEventType.ROLE_DELETED)
  handleRoleDeleted(payload: RoleDeletedEventPayload): void {
    this.logger.warn(`Role soft deleted: ${payload.name}`);
  }

  @OnEvent(RbacEventType.PERMISSION_CREATED)
  handlePermissionCreated(payload: PermissionCreatedEventPayload): void {
    this.logger.log(
      `Permission created: ${payload.name}; id=${payload.permissionId}`,
    );
  }

  @OnEvent(RbacEventType.PERMISSION_UPDATED)
  handlePermissionUpdated(payload: PermissionUpdatedEventPayload): void {
    this.logger.log(
      `Permission updated: ${payload.name}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(RbacEventType.PERMISSION_DELETED)
  handlePermissionDeleted(payload: PermissionDeletedEventPayload): void {
    this.logger.warn(`Permission soft deleted: ${payload.name}`);
  }

  @OnEvent(RbacEventType.ROLE_PERMISSION_GRANTED)
  handleRolePermissionGranted(
    payload: RolePermissionGrantedEventPayload,
  ): void {
    this.logger.log(
      `Permission granted: role=${payload.roleId}; permission=${payload.permissionId}`,
    );
  }

  @OnEvent(RbacEventType.ROLE_PERMISSION_REVOKED)
  handleRolePermissionRevoked(
    payload: RolePermissionRevokedEventPayload,
  ): void {
    this.logger.warn(
      `Permission revoked: role=${payload.roleId}; permission=${payload.permissionId}`,
    );
  }

  @OnEvent(RbacEventType.ROLE_PERMISSIONS_SYNCED)
  handleRolePermissionsSynced(
    payload: RolePermissionsSyncedEventPayload,
  ): void {
    this.logger.log(
      `Role permissions synced: role=${payload.roleId}; count=${payload.permissionIds.length}`,
    );
  }

  @OnEvent(RbacEventType.USER_ROLE_ASSIGNED)
  handleUserRoleAssigned(payload: UserRoleAssignedEventPayload): void {
    this.logger.log(
      `User role assigned: user=${payload.userId}; role=${payload.roleId}`,
    );
  }

  @OnEvent(RbacEventType.USER_ROLE_REVOKED)
  handleUserRoleRevoked(payload: UserRoleRevokedEventPayload): void {
    this.logger.warn(`User role revoked: user=${payload.userId}`);
  }

  @OnEvent(RbacEventType.DEFAULT_PERMISSIONS_SEEDED)
  handleDefaultPermissionsSeeded(
    payload: DefaultPermissionsSeededEventPayload,
  ): void {
    this.logger.log(
      `Default permissions seeded: created=${payload.createdCount}; existing=${payload.existingCount}`,
    );
  }
}
