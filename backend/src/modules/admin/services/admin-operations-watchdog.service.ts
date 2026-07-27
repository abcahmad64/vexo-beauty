import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { NotificationService } from '../../notification/services/notification.service';

import { AdminOperationsDigestNotificationChannel } from '../dto/notify-admin-operations-digest.dto';

import { RunAdminOperationsWatchdogDto } from '../dto/run-admin-operations-watchdog.dto';

import { AdminOperationsHealthService } from './admin-operations-health.service';

type AdminRecipientRow = {
  id: string;
};

type WatchdogRunReason = 'scheduled' | 'manual';

type WatchdogStatus = {
  enabled: boolean;
  cron: string;
  timezone: string;
  channels: AdminOperationsDigestNotificationChannel[];
  lastRunAt: string | null;
  lastAlertAt: string | null;
  lastSkippedAt: string | null;
  lastResult: unknown;
};

type WatchdogRunResponse = {
  generatedAt: string;
  requestedBy: string;
  reason: WatchdogRunReason;
  healthLevel: string;
  healthScore: number;
  alertSent: boolean;
  skippedReason: string | null;
  recipientsCount: number;
  sentCount: number;
  failedCount: number;
  channels: AdminOperationsDigestNotificationChannel[];
  signals: string[];
  failures: Array<{
    userId: string;
    reason: string;
  }>;
};

@Injectable()
export class AdminOperationsWatchdogService {
  private readonly logger = new Logger(AdminOperationsWatchdogService.name);

  private readonly defaultChannels: AdminOperationsDigestNotificationChannel[] =
    ['database', 'websocket', 'push'];

  private lastRunAt: Date | null = null;

  private lastAlertAt: Date | null = null;

  private lastSkippedAt: Date | null = null;

  private lastResult: unknown = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly operationsHealthService: AdminOperationsHealthService,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron('0 * * * *', {
    timeZone: 'Asia/Tehran',
  })
  async runScheduledWatchdog(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    await this.runWatchdogInternal('system:operations-watchdog', 'scheduled', {
      channels: this.getChannels(),
    });
  }

  async runNow(
    dto: RunAdminOperationsWatchdogDto,
    actorId: string,
  ): Promise<WatchdogRunResponse> {
    return this.runWatchdogInternal(actorId, 'manual', {
      channels:
        dto.channels && dto.channels.length > 0
          ? dto.channels
          : this.getChannels(),
    });
  }

  getStatus(): WatchdogStatus {
    return {
      enabled: this.isEnabled(),
      cron: '0 * * * *',
      timezone: 'Asia/Tehran',
      channels: this.getChannels(),
      lastRunAt: this.lastRunAt ? this.lastRunAt.toISOString() : null,
      lastAlertAt: this.lastAlertAt ? this.lastAlertAt.toISOString() : null,
      lastSkippedAt: this.lastSkippedAt
        ? this.lastSkippedAt.toISOString()
        : null,
      lastResult: this.lastResult,
    };
  }

  private async runWatchdogInternal(
    actorId: string,
    reason: WatchdogRunReason,
    options: {
      channels: AdminOperationsDigestNotificationChannel[];
    },
  ): Promise<WatchdogRunResponse> {
    this.lastRunAt = new Date();

    const health =
      await this.operationsHealthService.getOperationsHealth(actorId);

    if (health.status.level === 'healthy') {
      const response = this.buildSkippedResponse({
        actorId,
        reason,
        healthLevel: health.status.level,
        healthScore: health.status.score,
        skippedReason: 'وضعیت سیستم سالم است و نیازی به ارسال هشدار نیست.',
        channels: options.channels,
        signals: health.signals,
      });

      this.lastSkippedAt = new Date();

      this.lastResult = response;

      return response;
    }

    const dedupeKey = this.buildDedupeKey(health.status.level);

    const alreadySent = await this.hasRecentAlert(dedupeKey);

    if (alreadySent && reason === 'scheduled') {
      const response = this.buildSkippedResponse({
        actorId,
        reason,
        healthLevel: health.status.level,
        healthScore: health.status.score,
        skippedReason:
          'برای این سطح هشدار در بازه فعلی قبلاً اعلان ارسال شده است.',
        channels: options.channels,
        signals: health.signals,
      });

      this.lastSkippedAt = new Date();

      this.lastResult = response;

      return response;
    }

    const recipients = await this.findAdminRecipients();

    const title = this.buildTitle(health.status.level);

    const message = this.buildMessage(health);

    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        this.notificationService.sendNotification(
          {
            userId: recipient.id,
            title,
            message,
            type: 'SYSTEM',
            actionUrl: '/admin/operations-health',
            channels: options.channels,
            saveToDatabase: true,
            metadata: {
              source: 'admin.operations_watchdog',
              dedupeKey,
              watchdogReason: reason,
              healthLevel: health.status.level,
              healthScore: health.status.score,
              healthMessage: health.status.message,
              risks: health.risks,
              signals: health.signals,
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
        `Operations watchdog alert failed for ${failures.length} admin recipient(s).`,
      );
    }

    const response: WatchdogRunResponse = {
      generatedAt: new Date().toISOString(),
      requestedBy: actorId,
      reason,
      healthLevel: health.status.level,
      healthScore: health.status.score,
      alertSent: true,
      skippedReason: null,
      recipientsCount: recipients.length,
      sentCount: results.filter((result) => result.status === 'fulfilled')
        .length,
      failedCount: failures.length,
      channels: options.channels,
      signals: health.signals,
      failures,
    };

    this.lastAlertAt = new Date();

    this.lastResult = response;

    return response;
  }

  private buildSkippedResponse(input: {
    actorId: string;
    reason: WatchdogRunReason;
    healthLevel: string;
    healthScore: number;
    skippedReason: string;
    channels: AdminOperationsDigestNotificationChannel[];
    signals: string[];
  }): WatchdogRunResponse {
    return {
      generatedAt: new Date().toISOString(),
      requestedBy: input.actorId,
      reason: input.reason,
      healthLevel: input.healthLevel,
      healthScore: input.healthScore,
      alertSent: false,
      skippedReason: input.skippedReason,
      recipientsCount: 0,
      sentCount: 0,
      failedCount: 0,
      channels: input.channels,
      signals: input.signals,
      failures: [],
    };
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
              'queue:*',
              'queue:read',
              'scheduler:*',
              'scheduler:read',
              'audit:*',
              'audit:read',
              'audits:*',
              'audits:read'
            )
          )
      `,
    );
  }

  private async hasRecentAlert(dedupeKey: string): Promise<boolean> {
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
            AND n."metadata" #>> '{source}' = 'admin.operations_watchdog'
            AND n."metadata" #>> '{dedupeKey}' = ${dedupeKey}
            AND n."createdAt" >= NOW() - INTERVAL '1 hour'
          LIMIT 1
        `,
    );

    return rows.length > 0;
  }

  private buildDedupeKey(level: string): string {
    const now = new Date();

    const hourKey = now.toISOString().slice(0, 13);

    return `operations-watchdog:${level}:${hourKey}`;
  }

  private buildTitle(level: string): string {
    if (level === 'critical') {
      return 'هشدار بحرانی عملیات فروشگاه';
    }

    if (level === 'degraded') {
      return 'افت کیفیت عملیاتی فروشگاه';
    }

    if (level === 'warning') {
      return 'هشدار عملیاتی فروشگاه';
    }

    return 'وضعیت عملیاتی فروشگاه';
  }

  private buildMessage(
    health: Awaited<
      ReturnType<AdminOperationsHealthService['getOperationsHealth']>
    >,
  ): string {
    const signals = health.signals
      .map((signal, index) => `${index + 1}. ${signal}`)
      .join('\n');

    return [
      `وضعیت: ${health.status.message}`,
      `سطح: ${health.status.level}`,
      `امتیاز ریسک: ${health.status.score}`,
      '',
      'سیگنال‌ها:',
      signals,
      '',
      'برای بررسی جزئیات وارد بخش سلامت عملیاتی پنل مدیریت شوید.',
    ].join('\n');
  }

  private isEnabled(): boolean {
    return process.env.ADMIN_OPERATIONS_WATCHDOG_ENABLED === 'true';
  }

  private getChannels(): AdminOperationsDigestNotificationChannel[] {
    const raw = process.env.ADMIN_OPERATIONS_WATCHDOG_CHANNELS?.trim();

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
}
