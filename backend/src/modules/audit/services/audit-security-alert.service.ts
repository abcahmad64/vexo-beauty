import { Injectable, Logger } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { NotificationService } from '../../notification/services/notification.service';

import { AuditLogCreatedEventPayload } from '../events/audit.event.payloads';

type AuditLogForAlertRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  timestamp: Date;
  userId: string | null;
  data: Prisma.JsonValue | null;
};

type AdminRecipientRow = {
  id: string;
};

@Injectable()
export class AuditSecurityAlertService {
  private readonly logger = new Logger(AuditSecurityAlertService.name);

  private readonly alertSeverities = new Set(['warning', 'error', 'critical']);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async notifyAdminsForSensitiveAudit(
    payload: AuditLogCreatedEventPayload,
  ): Promise<void> {
    if (!this.alertSeverities.has(payload.severity)) {
      return;
    }

    const auditLog = await this.findAuditLog(payload.auditLogId);

    if (!auditLog) {
      return;
    }

    const recipients = await this.findAdminRecipients();

    if (recipients.length === 0) {
      this.logger.warn(
        `No admin recipients found for audit security alert: ${payload.auditLogId}`,
      );

      return;
    }

    await Promise.all(
      recipients.map((recipient) =>
        this.notifyAdmin(recipient.id, auditLog, payload),
      ),
    );
  }

  private async findAuditLog(
    auditLogId: string,
  ): Promise<AuditLogForAlertRow | null> {
    const rows = await this.prisma.$queryRaw<AuditLogForAlertRow[]>(
      Prisma.sql`
          SELECT
            e."id",
            e."name",
            e."description",
            e."category",
            e."timestamp",
            e."userId",
            e."data"
          FROM "Event" e
          WHERE
            e."id" = ${auditLogId}
            AND e."deleted_at" IS NULL
          LIMIT 1
        `,
    );

    return rows[0] ?? null;
  }

  private async findAdminRecipients(): Promise<AdminRecipientRow[]> {
    return this.prisma.$queryRaw<AdminRecipientRow[]>(
      Prisma.sql`
        SELECT DISTINCT
          u."id"
        FROM "User" u
        LEFT JOIN "Role" r
          ON r."id" = u."roleId"
          AND r."deleted_at" IS NULL
        LEFT JOIN "RolePermission" rp
          ON rp."roleId" = r."id"
        LEFT JOIN "Permission" p
          ON p."id" = rp."permissionId"
          AND p."deleted_at" IS NULL
        WHERE
          u."deleted_at" IS NULL
          AND u."status" = 'ACTIVE'::"UserStatus"
          AND (
            r."name" IN (
              'ADMIN',
              'SUPER_ADMIN'
            )
            OR p."name" IN (
              'audit:*',
              'audit:read',
              'audit:manage',
              'audits:*',
              'audits:read',
              'audits:manage',
              'admin:*',
              'admin:read',
              'admin:manage'
            )
          )
      `,
    );
  }

  private async notifyAdmin(
    adminId: string,
    auditLog: AuditLogForAlertRow,
    payload: AuditLogCreatedEventPayload,
  ): Promise<void> {
    try {
      const data = this.toRecord(auditLog.data);

      const title = this.buildTitle(payload.severity);

      const description =
        auditLog.description ??
        this.readString(data.title) ??
        `رویداد حساس ${auditLog.name} ثبت شد.`;

      await this.notificationService.sendNotification(
        {
          userId: adminId,
          title,
          message: description,
          type: 'SYSTEM',
          actionUrl: `/admin/audit-logs/${auditLog.id}`,
          channels: ['database', 'websocket', 'push'],
          saveToDatabase: true,
          metadata: {
            auditLogId: auditLog.id,
            action: auditLog.name,
            category: auditLog.category,
            severity: payload.severity,
            entityType: payload.entityType,
            entityId: payload.entityId ?? null,
            actorId: payload.actorId ?? null,
            occurredAt: payload.occurredAt.toISOString(),
            occurredAtFa: formatPersianDateTime(payload.occurredAt),
          },
        },
        {
          actorId: payload.actorId ?? undefined,
        },
      );
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  private buildTitle(severity: string): string {
    if (severity === 'critical') {
      return 'هشدار بحرانی امنیتی';
    }

    if (severity === 'error') {
      return 'هشدار خطای سیستمی';
    }

    return 'هشدار فعالیت حساس';
  }

  private toRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }

    return {};
  }

  private readString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    return null;
  }
}
