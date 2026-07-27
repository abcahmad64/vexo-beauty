import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

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
export class RbacEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishRoleCreated(payload: RoleCreatedEventPayload): void {
    this.eventEmitter.emit(RbacEventType.ROLE_CREATED, payload);
  }

  publishRoleUpdated(payload: RoleUpdatedEventPayload): void {
    this.eventEmitter.emit(RbacEventType.ROLE_UPDATED, payload);
  }

  publishRoleDeleted(payload: RoleDeletedEventPayload): void {
    this.eventEmitter.emit(RbacEventType.ROLE_DELETED, payload);
  }

  publishPermissionCreated(payload: PermissionCreatedEventPayload): void {
    this.eventEmitter.emit(RbacEventType.PERMISSION_CREATED, payload);
  }

  publishPermissionUpdated(payload: PermissionUpdatedEventPayload): void {
    this.eventEmitter.emit(RbacEventType.PERMISSION_UPDATED, payload);
  }

  publishPermissionDeleted(payload: PermissionDeletedEventPayload): void {
    this.eventEmitter.emit(RbacEventType.PERMISSION_DELETED, payload);
  }

  publishRolePermissionGranted(
    payload: RolePermissionGrantedEventPayload,
  ): void {
    this.eventEmitter.emit(RbacEventType.ROLE_PERMISSION_GRANTED, payload);
  }

  publishRolePermissionRevoked(
    payload: RolePermissionRevokedEventPayload,
  ): void {
    this.eventEmitter.emit(RbacEventType.ROLE_PERMISSION_REVOKED, payload);
  }

  publishRolePermissionsSynced(
    payload: RolePermissionsSyncedEventPayload,
  ): void {
    this.eventEmitter.emit(RbacEventType.ROLE_PERMISSIONS_SYNCED, payload);
  }

  publishUserRoleAssigned(payload: UserRoleAssignedEventPayload): void {
    this.eventEmitter.emit(RbacEventType.USER_ROLE_ASSIGNED, payload);
  }

  publishUserRoleRevoked(payload: UserRoleRevokedEventPayload): void {
    this.eventEmitter.emit(RbacEventType.USER_ROLE_REVOKED, payload);
  }

  publishDefaultPermissionsSeeded(
    payload: DefaultPermissionsSeededEventPayload,
  ): void {
    this.eventEmitter.emit(RbacEventType.DEFAULT_PERMISSIONS_SEEDED, payload);
  }
}
