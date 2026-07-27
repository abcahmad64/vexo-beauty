import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AcknowledgeAdminOperationsAlertsDto } from '../dto/acknowledge-admin-operations-alerts.dto';

import {
  AdminOperationsAlertQueryDto,
  AdminOperationsAlertSeverity,
  AdminOperationsAlertSource,
} from '../dto/admin-operations-alert-query.dto';

type AlertRow = {
  id: string;
  userId: string;
  source: string;
  severity: string;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  metadata: Prisma.JsonValue | null;
};

type OperationsAlertItem = {
  id: string;
  userId: string;
  source: AdminOperationsAlertSource;
  severity: AdminOperationsAlertSeverity;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

type OperationsAlertResponse = {
  meta: {
    generatedAt: string;
    requestedBy: string;
    limit: number;
    source: AdminOperationsAlertSource | null;
    severity: AdminOperationsAlertSeverity | null;
    isRead: boolean | null;
    createdFrom: string | null;
    createdTo: string | null;
  };
  summary: {
    totalVisible: number;
    unread: number;
    read: number;
    critical: number;
    error: number;
    warning: number;
    info: number;
    watchdog: number;
    digest: number;
    escalation: number;
    queueHealth: number;
  };
  items: OperationsAlertItem[];
};

type AcknowledgeResponse = {
  acknowledgedAt: string;
  acknowledgedBy: string;
  acknowledgedCount: number;
};

@Injectable()
export class AdminOperationsAlertService {
  private readonly defaultLimit = 50;

  constructor(private readonly prisma: PrismaService) {}

  async findAlerts(
    query: AdminOperationsAlertQueryDto,
    actorId: string,
  ): Promise<OperationsAlertResponse> {
    const createdFrom = this.parseOptionalDate(query.createdFrom);

    const createdTo = this.parseOptionalDate(query.createdTo);

    this.assertValidDateRange(createdFrom, createdTo);

    const limit = query.limit ?? this.defaultLimit;

    const rows = await this.findAlertRows(query, createdFrom, createdTo, limit);

    const items = rows.map((row) => this.mapRow(row));

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        requestedBy: actorId,
        limit,
        source: query.source ?? null,
        severity: query.severity ?? null,
        isRead: query.isRead ?? null,
        createdFrom: createdFrom ? createdFrom.toISOString() : null,
        createdTo: createdTo ? createdTo.toISOString() : null,
      },
      summary: this.buildSummary(items),
      items,
    };
  }

  async acknowledgeOne(
    notificationId: string,
    actorId: string,
  ): Promise<AcknowledgeResponse> {
    const acknowledgedAt = new Date();

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
      }>
    >(
      Prisma.sql`
          UPDATE "Notification" n
          SET
            "isRead" = TRUE,
            "readAt" = COALESCE(n."readAt", NOW()),
            "updatedAt" = NOW(),
            "metadata" =
              COALESCE(n."metadata", '{}'::jsonb)
              || jsonb_build_object(
                'acknowledgedBy', ${actorId},
                'acknowledgedAt', ${acknowledgedAt.toISOString()}
              )
          WHERE
            n."id" = ${notificationId}
            AND n."deleted_at" IS NULL
            AND n."isActive" = TRUE
            AND n."metadata" #>> '{source}' IN (
              'admin.operations_watchdog',
              'admin.operations_digest',
              'admin.operations_alert_escalation',
              'admin.operations_queue_health'
            )
          RETURNING n."id"
        `,
    );

    if (rows.length === 0) {
      throw new NotFoundException('هشدار عملیاتی موردنظر یافت نشد.');
    }

    return {
      acknowledgedAt: acknowledgedAt.toISOString(),
      acknowledgedBy: actorId,
      acknowledgedCount: rows.length,
    };
  }

  async acknowledgeMany(
    dto: AcknowledgeAdminOperationsAlertsDto,
    actorId: string,
  ): Promise<AcknowledgeResponse> {
    const createdFrom = this.parseOptionalDate(dto.createdFrom);

    const createdTo = this.parseOptionalDate(dto.createdTo);

    this.assertValidDateRange(createdFrom, createdTo);

    const where = this.buildAcknowledgeWhere(dto, createdFrom, createdTo);

    const acknowledgedAt = new Date();

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
      }>
    >(
      Prisma.sql`
          UPDATE "Notification" n
          SET
            "isRead" = TRUE,
            "readAt" = COALESCE(n."readAt", NOW()),
            "updatedAt" = NOW(),
            "metadata" =
              COALESCE(n."metadata", '{}'::jsonb)
              || jsonb_build_object(
                'acknowledgedBy', ${actorId},
                'acknowledgedAt', ${acknowledgedAt.toISOString()}
              )
          WHERE ${Prisma.join(where, ' AND ')}
          RETURNING n."id"
        `,
    );

    return {
      acknowledgedAt: acknowledgedAt.toISOString(),
      acknowledgedBy: actorId,
      acknowledgedCount: rows.length,
    };
  }

  private findAlertRows(
    query: AdminOperationsAlertQueryDto,
    createdFrom: Date | null,
    createdTo: Date | null,
    limit: number,
  ): Promise<AlertRow[]> {
    const innerWhere = this.buildAlertWhere(
      query.source,
      query.isRead,
      createdFrom,
      createdTo,
    );

    const outerWhere: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.severity) {
      outerWhere.push(Prisma.sql`t."severity" = ${query.severity}`);
    }

    return this.prisma.$queryRaw<AlertRow[]>(
      Prisma.sql`
        SELECT
          t."id",
          t."userId",
          t."source",
          t."severity",
          t."title",
          t."message",
          t."actionUrl",
          t."isRead",
          t."readAt",
          t."createdAt",
          t."metadata"
        FROM (
          SELECT
            n."id",
            n."userId",
            CASE
              WHEN n."metadata" #>> '{source}' = 'admin.operations_watchdog'
                THEN 'operations_watchdog'
              WHEN n."metadata" #>> '{source}' = 'admin.operations_digest'
                THEN 'operations_digest'
              WHEN n."metadata" #>> '{source}' = 'admin.operations_alert_escalation'
                THEN 'operations_alert_escalation'
              WHEN n."metadata" #>> '{source}' = 'admin.operations_queue_health'
                THEN 'operations_queue_health'
              ELSE 'operations_digest'
            END AS "source",
            CASE
              WHEN n."metadata" #>> '{source}' = 'admin.operations_watchdog'
                THEN
                  CASE
                    WHEN n."metadata" #>> '{healthLevel}' = 'critical'
                      THEN 'critical'
                    WHEN n."metadata" #>> '{healthLevel}' = 'degraded'
                      THEN 'error'
                    WHEN n."metadata" #>> '{healthLevel}' = 'warning'
                      THEN 'warning'
                    ELSE 'info'
                  END
              WHEN n."metadata" #>> '{source}' = 'admin.operations_digest'
                THEN
                  CASE
                    WHEN n."metadata" #>> '{digestLevel}' = 'critical'
                      THEN 'critical'
                    WHEN n."metadata" #>> '{digestLevel}' = 'high_risk'
                      THEN 'error'
                    WHEN n."metadata" #>> '{digestLevel}' = 'attention_required'
                      THEN 'warning'
                    ELSE 'info'
                  END
              WHEN n."metadata" #>> '{source}' = 'admin.operations_alert_escalation'
                THEN
                  CASE
                    WHEN n."metadata" #>> '{highestSeverity}' = 'critical'
                      THEN 'critical'
                    WHEN n."metadata" #>> '{highestSeverity}' = 'error'
                      THEN 'error'
                    WHEN n."metadata" #>> '{highestSeverity}' = 'warning'
                      THEN 'warning'
                    ELSE 'info'
                  END
              WHEN n."metadata" #>> '{source}' = 'admin.operations_queue_health'
                THEN
                  CASE
                    WHEN n."metadata" #>> '{lifecycleStatus}' = 'RECOVERED'
                      THEN 'info'
                    WHEN n."metadata" #>> '{healthLevel}' = 'critical'
                      THEN 'critical'
                    WHEN n."metadata" #>> '{healthLevel}' = 'degraded'
                      THEN 'error'
                    WHEN n."metadata" #>> '{healthLevel}' = 'warning'
                      THEN 'warning'
                    ELSE 'info'
                  END
              ELSE 'info'
            END AS "severity",
            n."title",
            n."message",
            n."linkUrl" AS "actionUrl",
            n."isRead",
            n."readAt",
            CASE
              WHEN n."metadata" #>> '{source}' = 'admin.operations_queue_health'
                THEN n."updatedAt"
              ELSE n."createdAt"
            END AS "createdAt",
            n."metadata"
          FROM "Notification" n
          WHERE ${Prisma.join(innerWhere, ' AND ')}
        ) t
        WHERE ${Prisma.join(outerWhere, ' AND ')}
        ORDER BY
          t."isRead" ASC,
          CASE
            WHEN t."severity" = 'critical' THEN 4
            WHEN t."severity" = 'error' THEN 3
            WHEN t."severity" = 'warning' THEN 2
            ELSE 1
          END DESC,
          t."createdAt" DESC,
          t."id" DESC
        LIMIT ${limit}
      `,
    );
  }

  private buildAlertWhere(
    source: AdminOperationsAlertSource | undefined,
    isRead: boolean | undefined,
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Prisma.Sql[] {
    const sourceValues = this.resolveSourceValues(source);

    const where: Prisma.Sql[] = [
      Prisma.sql`n."deleted_at" IS NULL`,
      Prisma.sql`n."isActive" = TRUE`,
      Prisma.sql`n."metadata" #>> '{source}' IN (${Prisma.join(sourceValues)})`,
    ];

    if (isRead !== undefined) {
      where.push(Prisma.sql`n."isRead" = ${isRead}`);
    }

    if (createdFrom) {
      where.push(Prisma.sql`n."createdAt" >= ${createdFrom}`);
    }

    if (createdTo) {
      where.push(Prisma.sql`n."createdAt" <= ${createdTo}`);
    }

    return where;
  }

  private buildAcknowledgeWhere(
    dto: AcknowledgeAdminOperationsAlertsDto,
    createdFrom: Date | null,
    createdTo: Date | null,
  ): Prisma.Sql[] {
    const sourceValues = this.resolveSourceValues(dto.source);

    const where: Prisma.Sql[] = [
      Prisma.sql`n."deleted_at" IS NULL`,
      Prisma.sql`n."isActive" = TRUE`,
      Prisma.sql`n."isRead" = FALSE`,
      Prisma.sql`n."metadata" #>> '{source}' IN (${Prisma.join(sourceValues)})`,
    ];

    if (dto.notificationIds && dto.notificationIds.length > 0) {
      where.push(Prisma.sql`n."id" IN (${Prisma.join(dto.notificationIds)})`);
    }

    if (createdFrom) {
      where.push(Prisma.sql`n."createdAt" >= ${createdFrom}`);
    }

    if (createdTo) {
      where.push(Prisma.sql`n."createdAt" <= ${createdTo}`);
    }

    return where;
  }

  private resolveSourceValues(source?: AdminOperationsAlertSource): string[] {
    if (source === 'operations_watchdog') {
      return ['admin.operations_watchdog'];
    }

    if (source === 'operations_digest') {
      return ['admin.operations_digest'];
    }

    if (source === 'operations_alert_escalation') {
      return ['admin.operations_alert_escalation'];
    }

    if (source === 'operations_queue_health') {
      return ['admin.operations_queue_health'];
    }

    return [
      'admin.operations_watchdog',
      'admin.operations_digest',
      'admin.operations_alert_escalation',
      'admin.operations_queue_health',
    ];
  }

  private mapRow(row: AlertRow): OperationsAlertItem {
    return {
      id: row.id,
      userId: row.userId,
      source: this.normalizeSource(row.source),
      severity: this.normalizeSeverity(row.severity),
      title: row.title,
      message: row.message,
      actionUrl: row.actionUrl,
      isRead: row.isRead,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      metadata: this.toRecord(row.metadata),
    };
  }

  private buildSummary(
    items: OperationsAlertItem[],
  ): OperationsAlertResponse['summary'] {
    return {
      totalVisible: items.length,
      unread: items.filter((item) => !item.isRead).length,
      read: items.filter((item) => item.isRead).length,
      critical: items.filter((item) => item.severity === 'critical').length,
      error: items.filter((item) => item.severity === 'error').length,
      warning: items.filter((item) => item.severity === 'warning').length,
      info: items.filter((item) => item.severity === 'info').length,
      watchdog: items.filter((item) => item.source === 'operations_watchdog')
        .length,
      digest: items.filter((item) => item.source === 'operations_digest')
        .length,
      escalation: items.filter(
        (item) => item.source === 'operations_alert_escalation',
      ).length,
      queueHealth: items.filter(
        (item) => item.source === 'operations_queue_health',
      ).length,
    };
  }

  private normalizeSource(value: string): AdminOperationsAlertSource {
    if (value === 'operations_watchdog') {
      return 'operations_watchdog';
    }

    if (value === 'operations_alert_escalation') {
      return 'operations_alert_escalation';
    }

    if (value === 'operations_queue_health') {
      return 'operations_queue_health';
    }

    return 'operations_digest';
  }

  private normalizeSeverity(value: string): AdminOperationsAlertSeverity {
    if (
      value === 'critical' ||
      value === 'error' ||
      value === 'warning' ||
      value === 'info'
    ) {
      return value;
    }

    return 'info';
  }

  private parseOptionalDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('تاریخ واردشده معتبر نیست.');
    }

    return date;
  }

  private assertValidDateRange(
    createdFrom: Date | null,
    createdTo: Date | null,
  ): void {
    if (
      createdFrom &&
      createdTo &&
      createdFrom.getTime() > createdTo.getTime()
    ) {
      throw new BadRequestException(
        'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.',
      );
    }
  }

  private toRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }

    return {};
  }
}
