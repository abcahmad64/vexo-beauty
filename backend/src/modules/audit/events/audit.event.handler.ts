import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import {
  AuditLogCreatedEventPayload,
  AuditLogDeletedEventPayload,
} from './audit.event.payloads';

import { AuditEventType } from './audit.event.types';

@Injectable()
export class AuditEventHandler {
  private readonly logger = new Logger(AuditEventHandler.name);

  @OnEvent(AuditEventType.AUDIT_LOG_CREATED)
  handleCreated(payload: AuditLogCreatedEventPayload): void {
    this.logger.log(
      `Audit log created: ${payload.action}; entity=${payload.entityType}:${payload.entityId ?? 'N/A'}`,
    );
  }

  @OnEvent(AuditEventType.AUDIT_LOG_DELETED)
  handleDeleted(payload: AuditLogDeletedEventPayload): void {
    this.logger.warn(`Audit log deleted: ${payload.auditLogId}`);
  }
}
