import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  AuditLogCreatedEventPayload,
  AuditLogDeletedEventPayload,
} from './audit.event.payloads';

import { AuditEventType } from './audit.event.types';

@Injectable()
export class AuditEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishCreated(payload: AuditLogCreatedEventPayload): void {
    this.eventEmitter.emit(AuditEventType.AUDIT_LOG_CREATED, payload);
  }

  publishDeleted(payload: AuditLogDeletedEventPayload): void {
    this.eventEmitter.emit(AuditEventType.AUDIT_LOG_DELETED, payload);
  }
}
