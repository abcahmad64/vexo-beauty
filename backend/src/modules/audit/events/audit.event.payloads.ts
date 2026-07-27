export interface AuditLogCreatedEventPayload {
  auditLogId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  category?: string | null;
  severity: string;
  occurredAt: Date;
}

export interface AuditLogDeletedEventPayload {
  auditLogId: string;
  actorId?: string;
  occurredAt: Date;
}
