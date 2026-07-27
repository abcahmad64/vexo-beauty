import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { AuditLogCreatedEventPayload } from '../events/audit.event.payloads';

import { AuditEventType } from '../events/audit.event.types';

import { AuditSecurityAlertService } from '../services/audit-security-alert.service';

@Injectable()
export class AuditSecurityAlertEventHandler {
  private readonly logger = new Logger(AuditSecurityAlertEventHandler.name);

  constructor(
    private readonly auditSecurityAlertService: AuditSecurityAlertService,
  ) {}

  @OnEvent(AuditEventType.AUDIT_LOG_CREATED)
  async handleAuditLogCreated(
    payload: AuditLogCreatedEventPayload,
  ): Promise<void> {
    try {
      await this.auditSecurityAlertService.notifyAdminsForSensitiveAudit(
        payload,
      );
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }
}
