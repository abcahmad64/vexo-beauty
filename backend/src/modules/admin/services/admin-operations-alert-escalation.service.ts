import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { createHash } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { NotificationService } from '../../notification/services/notification.service';

import { AdminOperationsDigestNotificationChannel } from '../dto/notify-admin-operations-digest.dto';

import { RunAdminOperationsAlertEscalationDto } from '../dto/run-admin-operations-alert-escalation.dto';

type EscalationSeverity = 'warning' | 'error' | 'critical';

type EscalationRunReason = 'scheduled' | 'manual';

type AdminRecipientRow = {
  id: string;
};

type EscalationAlertRow = {
  id: string;
  source: string;
  severity: EscalationSeverity;
  title: string;
  message: string;
  actionUrl: string | null;
  createdAt: Date;
};

type EscalationStatus = {
  enabled: boolean;
  cron: string;
  timezone: string;
  channels: AdminOperationsDigestNotificationChannel[];
  minAgeMinutes: number;
  maxAlerts: number;
  minSeverity: EscalationSeverity;
  lastRunAt: string | null;
  lastEscalationAt: string | null;
  lastSkippedAt: string | null;
  lastResult: unknown;
};

type EscalationRunResponse = {
  generatedAt: string;
  requestedBy: string;
  reason: EscalationRunReason;
  escalationSent: boolean;
  skippedReason: string | null;
  unreadAlertsCount: number;
  recipientsCount: number;
  sentCount: number;
  failedCount: number;
  minAgeMinutes: number;
  maxAlerts: number;
  minSeverity: EscalationSeverity;
  channels: AdminOperationsDigestNotificationChannel[];
  dedupeKey: string | null;
  alerts: Array<{
    id: string;
    source: string;
    severity: EscalationSeverity;
    title: string;
    actionUrl: string | null;
    createdAt: string;
  }>;
  failures: Array<{
    userId: string;
    reason: string;
  }>;
};

@Injectable()
export class AdminOperationsAlertEscalationService {
  private readonly logger = new Logger(
    AdminOperationsAlertEscalationService.name,
  );

  private readonly defaultChannels: AdminOperationsDigestNotificationChannel[] =
    ['database', 'websocket', 'push'];

  private lastRunAt: Date | null = null;

  private lastEscalationAt: Date | null = null;

  private lastSkippedAt: Date | null = null;

  private lastResult: unknown = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron('*/30 * * * *', {
    timeZone: 'Asia/Tehran',
  })
  async runScheduledEscalation(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    await this.runEscalationInternal(
      'system:operations-alert-escalation',
      'scheduled',
      {
        channels: this.getChannels(),
        minAgeMinutes: this.getMinAgeMinutes(),
        maxAlerts: this.getMaxAlerts(),
        minSeverity: this.getMinSeverity(),
      },
    );
  }

  async runNow(
    dto: RunAdminOperationsAlertEscalationDto,
    actorId: string,
  ): Promise<EscalationRunResponse> {
    return this.runEscalationInternal(actorId, 'manual', {
      channels:
        dto.channels && dto.channels.length > 0
          ? dto.channels
          : this.getChannels(),
      minAgeMinutes: dto.minAgeMinutes ?? this.getMinAgeMinutes(),
      maxAlerts: dto.maxAlerts ?? this.getMaxAlerts(),
      minSeverity: dto.minSeverity ?? this.getMinSeverity(),
    });
  }

  getStatus(): EscalationStatus {
    return {
      enabled: this.isEnabled(),
      cron: '*/30 * * * *',
      timezone: 'Asia/Tehran',
      channels: this.getChannels(),
      minAgeMinutes: this.getMinAgeMinutes(),
      maxAlerts: this.getMaxAlerts(),
      minSeverity: this.getMinSeverity(),
      lastRunAt: this.lastRunAt ? this.lastRunAt.toISOString() : null,
      lastEscalationAt: this.lastEscalationAt
        ? this.lastEscalationAt.toISOString()
        : null,
      lastSkippedAt: this.lastSkippedAt
        ? this.lastSkippedAt.toISOString()
        : null,
      lastResult: this.lastResult,
    };
  }

  private async runEscalationInternal(
    actorId: string,
    reason: EscalationRunReason,
    options: {
      channels: AdminOperationsDigestNotificationChannel[];
      minAgeMinutes: number;
      maxAlerts: number;
      minSeverity: EscalationSeverity;
    },
  ): Promise<EscalationRunResponse> {
    this.lastRunAt = new Date();

    const alerts = await this.findUnreadEscalationAlerts(
      options.minAgeMinutes,
      options.maxAlerts,
      options.minSeverity,
    );

    if (alerts.length === 0) {
      const response = this.buildSkippedResponse({
        actorId,
        reason,
        skippedReason: 'هشدار خوانده‌نشده‌ای با شرایط Escalation پیدا نشد.',
        options,
        alerts,
        dedupeKey: null,
      });

      this.lastSkippedAt = new Date();

      this.lastResult = response;

      return response;
    }

    const dedupeKey = this.buildDedupeKey(alerts, options.minSeverity);

    const alreadyEscalated = await this.hasRecentEscalation(dedupeKey);

    if (alreadyEscalated && reason === 'scheduled') {
      const response = this.buildSkippedResponse({
        actorId,
        reason,
        skippedReason:
          'برای این گروه هشدارها در بازه فعلی قبلاً Escalation ارسال شده است.',
        options,
        alerts,
        dedupeKey,
      });

      this.lastSkippedAt = new Date();

      this.lastResult = response;

      return response;
    }

    const recipients = await this.findAdminRecipients();

    const title = this.buildTitle(alerts);

    const message = this.buildMessage(alerts, options.minAgeMinutes);

    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        this.notificationService.sendNotification(
          {
            userId: recipient.id,
            title,
            message,
            type: 'SYSTEM',
            actionUrl: '/admin/operations-alerts?isRead=false',
            channels: options.channels,
            saveToDatabase: true,
            metadata: {
              source: 'admin.operations_alert_escalation',
              dedupeKey,
              originalAlertIds: alerts.map((alert) => alert.id),
              originalAlertSources: Array.from(
                new Set(alerts.map((alert) => alert.source)),
              ),
              highestSeverity: this.highestSeverity(alerts),
              minSeverity: options.minSeverity,
              minAgeMinutes: options.minAgeMinutes,
              maxAlerts: options.maxAlerts,
              escalationReason: reason,
              generatedAt: new Date().toISOString(),
              requestedBy: actorId,
            },
          },
          {
            actorId,
          },
        ),
      ),
    );

    const failures = results
      .map((result, index) => ({
        result,
        recipient: recipients[index],
      }))
      .filter(
        (
          item,
        ): item is {
          result: PromiseRejectedResult;
          recipient: AdminRecipientRow;
        } => item.result.status === 'rejected',
      )
      .map((item) => ({
        userId: item.recipient.id,
        reason:
          item.result.reason instanceof Error
            ? item.result.reason.message
            : String(item.result.reason),
      }));

    if (failures.length > 0) {
      this.logger.warn(
        `Operations alert escalation failed for ${failures.length} admin recipient(s).`,
      );
    }

    const response: EscalationRunResponse = {
      generatedAt: new Date().toISOString(),
      requestedBy: actorId,
      reason,
      escalationSent: true,
      skippedReason: null,
      unreadAlertsCount: alerts.length,
      recipientsCount: recipients.length,
      sentCount: results.filter((result) => result.status === 'fulfilled')
        .length,
      failedCount: failures.length,
      minAgeMinutes: options.minAgeMinutes,
      maxAlerts: options.maxAlerts,
      minSeverity: options.minSeverity,
      channels: options.channels,
      dedupeKey,
      alerts: this.mapAlerts(alerts),
      failures,
    };

    this.lastEscalationAt = new Date();

    this.lastResult = response;

    return response;
  }

  private findUnreadEscalationAlerts(
    minAgeMinutes: number,
    maxAlerts: number,
    minSeverity: EscalationSeverity,
  ): Promise<EscalationAlertRow[]> {
    const minWeight = this.severityWeight(minSeverity);

    return this.prisma.$queryRaw<EscalationAlertRow[]>(
      Prisma.sql`
        SELECT
          t."id",
          t."source",
          t."severity",
          t."title",
          t."message",
          t."actionUrl",
          t."createdAt"
        FROM (
          SELECT
            n."id",
            CASE
              WHEN n."metadata" #>> '{source}' = 'admin.operations_watchdog'
                THEN 'operations_watchdog'
              WHEN n."metadata" #>> '{source}' = 'admin.operations_digest'
                THEN 'operations_digest'
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
              WHEN n."metadata" #>> '{source}' = 'admin.operations_queue_health'
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
              ELSE 'info'
            END AS "severity",
            CASE
              WHEN n."metadata" #>> '{source}' = 'admin.operations_watchdog'
                THEN
                  CASE
                    WHEN n."metadata" #>> '{healthLevel}' = 'critical'
                      THEN 3
                    WHEN n."metadata" #>> '{healthLevel}' = 'degraded'
                      THEN 2
                    WHEN n."metadata" #>> '{healthLevel}' = 'warning'
                      THEN 1
                    ELSE 0
                  END
              WHEN n."metadata" #>> '{source}' = 'admin.operations_digest'
                THEN
                  CASE
                    WHEN n."metadata" #>> '{digestLevel}' = 'critical'
                      THEN 3
                    WHEN n."metadata" #>> '{digestLevel}' = 'high_risk'
                      THEN 2
                    WHEN n."metadata" #>> '{digestLevel}' = 'attention_required'
                      THEN 1
                    ELSE 0
                  END
              WHEN n."metadata" #>> '{source}' = 'admin.operations_queue_health'
                THEN
                  CASE
                    WHEN n."metadata" #>> '{healthLevel}' = 'critical'
                      THEN 3
                    WHEN n."metadata" #>> '{healthLevel}' = 'degraded'
                      THEN 2
                    WHEN n."metadata" #>> '{healthLevel}' = 'warning'
                      THEN 1
                    ELSE 0
                  END
              ELSE 0
            END AS "severityWeight",
            n."title",
            n."message",
            n."linkUrl" AS "actionUrl",
            n."createdAt"
          FROM "Notification" n
          WHERE
            n."deleted_at" IS NULL
            AND n."isActive" = TRUE
            AND n."isRead" = FALSE
            AND n."metadata" #>> '{source}' IN (
              'admin.operations_watchdog',
              'admin.operations_digest',
              'admin.operations_queue_health'
            )
            AND n."createdAt" <= NOW() - (${minAgeMinutes} * INTERVAL '1 minute')
        ) t
        WHERE
          t."severityWeight" >= ${minWeight}
        ORDER BY
          t."severityWeight" DESC,
          t."createdAt" ASC
        LIMIT ${maxAlerts}
      `,
    );
  }

  private findAdminRecipients(): Promise<AdminRecipientRow[]> {
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
          AND u."status"::text = 'ACTIVE'
          AND (
            r."name" IN (
              'ADMIN',
              'SUPER_ADMIN'
            )
            OR p."name" IN (
              'admin:*',
              'admin:read',
              'dashboard:*',
              'dashboard:read',
              'reports:*',
              'reports:read',
              'notifications:*',
              'notifications:read',
              'notifications:manage',
              'audit:*',
              'audit:read',
              'audits:*',
              'audits:read'
            )
          )
      `,
    );
  }

  private async hasRecentEscalation(dedupeKey: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
      }>
    >(
      Prisma.sql`
          SELECT
            n."id"
          FROM "Notification" n
          WHERE
            n."deleted_at" IS NULL
            AND n."isActive" = TRUE
            AND n."metadata" #>> '{source}' = 'admin.operations_alert_escalation'
            AND n."metadata" #>> '{dedupeKey}' = ${dedupeKey}
            AND n."createdAt" >= NOW() - INTERVAL '2 hours'
          LIMIT 1
        `,
    );

    return rows.length > 0;
  }

  private buildSkippedResponse(input: {
    actorId: string;
    reason: EscalationRunReason;
    skippedReason: string;
    options: {
      channels: AdminOperationsDigestNotificationChannel[];
      minAgeMinutes: number;
      maxAlerts: number;
      minSeverity: EscalationSeverity;
    };
    alerts: EscalationAlertRow[];
    dedupeKey: string | null;
  }): EscalationRunResponse {
    return {
      generatedAt: new Date().toISOString(),
      requestedBy: input.actorId,
      reason: input.reason,
      escalationSent: false,
      skippedReason: input.skippedReason,
      unreadAlertsCount: input.alerts.length,
      recipientsCount: 0,
      sentCount: 0,
      failedCount: 0,
      minAgeMinutes: input.options.minAgeMinutes,
      maxAlerts: input.options.maxAlerts,
      minSeverity: input.options.minSeverity,
      channels: input.options.channels,
      dedupeKey: input.dedupeKey,
      alerts: this.mapAlerts(input.alerts),
      failures: [],
    };
  }

  private buildDedupeKey(
    alerts: EscalationAlertRow[],
    minSeverity: EscalationSeverity,
  ): string {
    const hourKey = new Date().toISOString().slice(0, 13);

    const alertHash = createHash('sha256')
      .update(alerts.map((alert) => alert.id).join('|'))
      .digest('hex')
      .slice(0, 16);

    return `operations-alert-escalation:${minSeverity}:${hourKey}:${alertHash}`;
  }

  private buildTitle(alerts: EscalationAlertRow[]): string {
    const highest = this.highestSeverity(alerts);

    if (highest === 'critical') {
      return 'Escalation بحرانی هشدارهای عملیاتی';
    }

    if (highest === 'error') {
      return 'Escalation هشدارهای مهم عملیاتی';
    }

    return 'Escalation هشدارهای عملیاتی';
  }

  private buildMessage(
    alerts: EscalationAlertRow[],
    minAgeMinutes: number,
  ): string {
    const highest = this.highestSeverity(alerts);

    const items = alerts
      .slice(0, 10)
      .map((alert, index) => `${index + 1}. [${alert.severity}] ${alert.title}`)
      .join('\n');

    return [
      `تعداد هشدارهای تأییدنشده: ${alerts.length}`,
      `بالاترین سطح هشدار: ${highest}`,
      `حداقل زمان خوانده‌نشده بودن: ${minAgeMinutes} دقیقه`,
      '',
      'هشدارهای مهم:',
      items,
      '',
      'برای مشاهده و تأیید هشدارها وارد Inbox هشدارهای عملیاتی شوید.',
    ].join('\n');
  }

  private highestSeverity(alerts: EscalationAlertRow[]): EscalationSeverity {
    if (alerts.some((alert) => alert.severity === 'critical')) {
      return 'critical';
    }

    if (alerts.some((alert) => alert.severity === 'error')) {
      return 'error';
    }

    return 'warning';
  }

  private mapAlerts(
    alerts: EscalationAlertRow[],
  ): EscalationRunResponse['alerts'] {
    return alerts.map((alert) => ({
      id: alert.id,
      source: alert.source,
      severity: alert.severity,
      title: alert.title,
      actionUrl: alert.actionUrl,
      createdAt: alert.createdAt.toISOString(),
    }));
  }

  private severityWeight(severity: EscalationSeverity): number {
    if (severity === 'critical') {
      return 3;
    }

    if (severity === 'error') {
      return 2;
    }

    return 1;
  }

  private isEnabled(): boolean {
    return process.env.ADMIN_OPERATIONS_ALERT_ESCALATION_ENABLED === 'true';
  }

  private getChannels(): AdminOperationsDigestNotificationChannel[] {
    const raw = process.env.ADMIN_OPERATIONS_ALERT_ESCALATION_CHANNELS?.trim();

    if (!raw) {
      return this.defaultChannels;
    }

    const channels = raw
      .split(',')
      .map((item) => item.trim())
      .filter(
        (item): item is AdminOperationsDigestNotificationChannel =>
          item === 'database' ||
          item === 'websocket' ||
          item === 'push' ||
          item === 'email',
      );

    return channels.length > 0 ? channels : this.defaultChannels;
  }

  private getMinAgeMinutes(): number {
    const parsed = Number(
      process.env.ADMIN_OPERATIONS_ALERT_ESCALATION_MIN_AGE_MINUTES,
    );

    if (Number.isFinite(parsed) && parsed >= 5 && parsed <= 1440) {
      return Math.trunc(parsed);
    }

    return 30;
  }

  private getMaxAlerts(): number {
    const parsed = Number(
      process.env.ADMIN_OPERATIONS_ALERT_ESCALATION_MAX_ALERTS,
    );

    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 100) {
      return Math.trunc(parsed);
    }

    return 20;
  }

  private getMinSeverity(): EscalationSeverity {
    const value =
      process.env.ADMIN_OPERATIONS_ALERT_ESCALATION_MIN_SEVERITY?.trim();

    if (value === 'warning' || value === 'error' || value === 'critical') {
      return value;
    }

    return 'error';
  }
}
