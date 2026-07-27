import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { QueueMonitorService } from '../../../core/queue/services/queue-monitor.service';

import type { QueueOperationalHealthSignal } from '../../../core/queue/types/queue.types';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { NotificationDeliveryChannel } from '../../notification/delivery/notification-delivery.channel';

import {
  NOTIFICATION_DELIVERY_OUTBOX_TYPE,
  NOTIFICATION_DELIVERY_OUTBOX_VERSION,
  NotificationDeliveryOutboxPayload,
} from '../../notification/services/notification-delivery-outbox.types';

import {
  ADMIN_OPERATIONS_QUEUE_ALERT_ACTION_URL,
  ADMIN_OPERATIONS_QUEUE_ALERT_SOURCE,
  AdminOperationsQueueAlertLifecycleUtil,
  AdminOperationsQueueAlertTransition,
} from './admin-operations-queue-alert-lifecycle.util';

const NOTIFICATION_DELIVERY_CHANNEL_BY_VALUE: Readonly<
  Record<string, NotificationDeliveryChannel>
> = {
  [NotificationDeliveryChannel.WEBSOCKET]:
    NotificationDeliveryChannel.WEBSOCKET,
  [NotificationDeliveryChannel.PUSH]: NotificationDeliveryChannel.PUSH,
  [NotificationDeliveryChannel.EMAIL]: NotificationDeliveryChannel.EMAIL,
  [NotificationDeliveryChannel.SMS]: NotificationDeliveryChannel.SMS,
};

type AdminRecipientRow = {
  readonly id: string;
};

type LifecycleNotificationRow = {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly message: string;
  readonly isRead: boolean;
  readonly readAt: Date | null;
  readonly metadata: Prisma.JsonValue | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

type QueueAlertRunReason = 'scheduled' | 'manual';

type QueueAlertTransitionResult = {
  readonly notificationId: string;
  readonly lifecycleKey: string;
  readonly transition: AdminOperationsQueueAlertTransition;
  readonly outboxCount: number;
};

export interface AdminOperationsQueueAlertLifecycleRunResult {
  readonly generatedAt: string;
  readonly requestedBy: string;
  readonly reason: QueueAlertRunReason;
  readonly healthLevel: string;
  readonly signalsCount: number;
  readonly recipientsCount: number;
  readonly transitions: readonly QueueAlertTransitionResult[];
  readonly activatedCount: number;
  readonly observedCount: number;
  readonly escalatedCount: number;
  readonly deescalatedCount: number;
  readonly reactivatedCount: number;
  readonly recoveredCount: number;
  readonly outboxCount: number;
}

export interface AdminOperationsQueueAlertLifecycleStatus {
  readonly enabled: boolean;
  readonly cron: string;
  readonly timezone: string;
  readonly channels: readonly NotificationDeliveryChannel[];
  readonly lastRunAt: string | null;
  readonly lastTransitionAt: string | null;
  readonly lastResult: AdminOperationsQueueAlertLifecycleRunResult | null;
  readonly snapshot: ReturnType<
    typeof AdminOperationsQueueAlertLifecycleUtil.getSnapshot
  >;
}

@Injectable()
export class AdminOperationsQueueAlertLifecycleService {
  private readonly logger = new Logger(
    AdminOperationsQueueAlertLifecycleService.name,
  );

  private lastRunAt: Date | null = null;

  private lastTransitionAt: Date | null = null;

  private lastResult: AdminOperationsQueueAlertLifecycleRunResult | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueMonitorService: QueueMonitorService,
  ) {}

  @Cron('*/5 * * * *', {
    timeZone: 'Asia/Tehran',
  })
  async runScheduledLifecycle(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    await this.runLifecycle('system:queue-alert-lifecycle', 'scheduled');
  }

  async runNow(
    actorId: string,
  ): Promise<AdminOperationsQueueAlertLifecycleRunResult> {
    return await this.runLifecycle(actorId, 'manual');
  }

  getStatus(): AdminOperationsQueueAlertLifecycleStatus {
    return {
      enabled: this.isEnabled(),
      cron: '*/5 * * * *',
      timezone: 'Asia/Tehran',
      channels: this.getChannels(),
      lastRunAt: this.lastRunAt?.toISOString() ?? null,
      lastTransitionAt: this.lastTransitionAt?.toISOString() ?? null,
      lastResult: this.lastResult,
      snapshot: AdminOperationsQueueAlertLifecycleUtil.getSnapshot(),
    };
  }

  private async runLifecycle(
    actorId: string,
    reason: QueueAlertRunReason,
  ): Promise<AdminOperationsQueueAlertLifecycleRunResult> {
    this.lastRunAt = new Date();

    const report = await this.queueMonitorService.getStatus();
    const recipients = await this.findAdminRecipients();
    const channels = this.getChannels();
    const transitions: QueueAlertTransitionResult[] = [];
    const activeLifecycleKeys = new Set(
      report.health.signals.map((signal) =>
        AdminOperationsQueueAlertLifecycleUtil.buildLifecycleKey(signal),
      ),
    );

    for (const recipient of recipients) {
      for (const signal of report.health.signals) {
        transitions.push(
          await this.synchronizeSignal(recipient.id, signal, channels, actorId),
        );
      }

      const recoveryRows = await this.findRecoveryCandidates(
        recipient.id,
        activeLifecycleKeys,
      );

      for (const row of recoveryRows) {
        transitions.push(await this.recoverLifecycle(row, channels, actorId));
      }
    }

    const result: AdminOperationsQueueAlertLifecycleRunResult = {
      generatedAt: new Date().toISOString(),
      requestedBy: actorId,
      reason,
      healthLevel: report.health.level,
      signalsCount: report.health.signals.length,
      recipientsCount: recipients.length,
      transitions,
      activatedCount: this.countTransition(transitions, 'ACTIVATED'),
      observedCount: this.countTransition(transitions, 'OBSERVED'),
      escalatedCount: this.countTransition(transitions, 'ESCALATED'),
      deescalatedCount: this.countTransition(transitions, 'DEESCALATED'),
      reactivatedCount: this.countTransition(transitions, 'REACTIVATED'),
      recoveredCount: this.countTransition(transitions, 'RECOVERED'),
      outboxCount: transitions.reduce(
        (total, item) => total + item.outboxCount,
        0,
      ),
    };

    if (
      result.activatedCount > 0 ||
      result.escalatedCount > 0 ||
      result.deescalatedCount > 0 ||
      result.reactivatedCount > 0 ||
      result.recoveredCount > 0
    ) {
      this.lastTransitionAt = new Date();
    }

    this.lastResult = result;

    if (result.transitions.length > 0) {
      this.logger.log(
        `Queue alert lifecycle synchronized: reason=${reason} signals=${result.signalsCount} transitions=${result.transitions.length} outbox=${result.outboxCount}.`,
      );
    }

    return result;
  }

  private async synchronizeSignal(
    userId: string,
    signal: QueueOperationalHealthSignal,
    channels: readonly NotificationDeliveryChannel[],
    actorId: string,
  ): Promise<QueueAlertTransitionResult> {
    const lifecycleKey =
      AdminOperationsQueueAlertLifecycleUtil.buildLifecycleKey(signal);
    const lockKey = AdminOperationsQueueAlertLifecycleUtil.buildLockKey(
      userId,
      lifecycleKey,
    );

    return await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
        `,
      );

      const rows = await tx.$queryRaw<LifecycleNotificationRow[]>(
        Prisma.sql`
          SELECT
            n."id",
            n."userId",
            n."title",
            n."message",
            n."isRead",
            n."readAt",
            n."metadata",
            n."createdAt",
            n."updatedAt"
          FROM "Notification" n
          WHERE
            n."userId" = ${userId}
            AND n."deleted_at" IS NULL
            AND n."isActive" = TRUE
            AND n."metadata" #>> '{source}' = ${ADMIN_OPERATIONS_QUEUE_ALERT_SOURCE}
            AND n."metadata" #>> '{lifecycleKey}' = ${lifecycleKey}
          ORDER BY n."createdAt" ASC
          LIMIT 1
          FOR UPDATE
        `,
      );

      const existing = rows[0] ?? null;
      const existingMetadata = this.toRecord(existing?.metadata ?? null);
      const existingState = existing
        ? AdminOperationsQueueAlertLifecycleUtil.readExistingState(
            existingMetadata,
            existing.isRead,
          )
        : null;
      const decision = AdminOperationsQueueAlertLifecycleUtil.decideSignal(
        existingState,
        signal,
      );
      const observedAt = new Date();
      const title = AdminOperationsQueueAlertLifecycleUtil.buildTitle({
        signal,
        transition: decision.transition,
      });
      const message = AdminOperationsQueueAlertLifecycleUtil.buildMessage({
        signal,
        transition: decision.transition,
      });
      const metadata = AdminOperationsQueueAlertLifecycleUtil.buildMetadata({
        existingMetadata,
        lifecycleKey,
        signal,
        decision,
        observedAt: observedAt.toISOString(),
        actorId,
      });

      const notification = existing
        ? await this.updateLifecycleNotification(
            tx,
            existing,
            title,
            message,
            metadata,
            decision.reopenAcknowledgement,
            observedAt,
          )
        : await this.insertLifecycleNotification(
            tx,
            userId,
            title,
            message,
            metadata,
            observedAt,
          );

      const outboxCount = decision.deliveryRequired
        ? await this.insertDeliveryOutboxRows(
            tx,
            notification,
            metadata,
            decision.transition,
            decision.deliveryVersion,
            channels,
            actorId,
            observedAt,
          )
        : 0;

      return {
        notificationId: notification.id,
        lifecycleKey,
        transition: decision.transition,
        outboxCount,
      };
    });
  }

  private async recoverLifecycle(
    candidate: LifecycleNotificationRow,
    channels: readonly NotificationDeliveryChannel[],
    actorId: string,
  ): Promise<QueueAlertTransitionResult> {
    const metadata = this.toRecord(candidate.metadata);
    const lifecycleKey = this.readRequiredString(metadata.lifecycleKey);
    const lockKey = AdminOperationsQueueAlertLifecycleUtil.buildLockKey(
      candidate.userId,
      lifecycleKey,
    );

    return await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
        `,
      );

      const rows = await tx.$queryRaw<LifecycleNotificationRow[]>(
        Prisma.sql`
          SELECT
            n."id",
            n."userId",
            n."title",
            n."message",
            n."isRead",
            n."readAt",
            n."metadata",
            n."createdAt",
            n."updatedAt"
          FROM "Notification" n
          WHERE
            n."id" = ${candidate.id}
            AND n."deleted_at" IS NULL
            AND n."isActive" = TRUE
            AND n."metadata" #>> '{source}' = ${ADMIN_OPERATIONS_QUEUE_ALERT_SOURCE}
          LIMIT 1
          FOR UPDATE
        `,
      );

      const current = rows[0];

      if (!current) {
        return {
          notificationId: candidate.id,
          lifecycleKey,
          transition: 'UNCHANGED',
          outboxCount: 0,
        };
      }

      const currentMetadata = this.toRecord(current.metadata);
      const existingState =
        AdminOperationsQueueAlertLifecycleUtil.readExistingState(
          currentMetadata,
          current.isRead,
        );
      const decision =
        AdminOperationsQueueAlertLifecycleUtil.decideRecovery(existingState);

      if (decision.transition === 'UNCHANGED') {
        return {
          notificationId: current.id,
          lifecycleKey,
          transition: decision.transition,
          outboxCount: 0,
        };
      }

      const observedAt = new Date();
      const recoverySignal = this.buildRecoverySignal(currentMetadata);
      const title = AdminOperationsQueueAlertLifecycleUtil.buildTitle({
        signal: recoverySignal,
        transition: decision.transition,
      });
      const message = AdminOperationsQueueAlertLifecycleUtil.buildMessage({
        signal: recoverySignal,
        transition: decision.transition,
      });
      const nextMetadata = AdminOperationsQueueAlertLifecycleUtil.buildMetadata(
        {
          existingMetadata: currentMetadata,
          lifecycleKey,
          signal: recoverySignal,
          decision,
          observedAt: observedAt.toISOString(),
          actorId,
        },
      );
      const notification = await this.updateRecoveredNotification(
        tx,
        current,
        title,
        message,
        nextMetadata,
        observedAt,
      );
      const outboxCount = await this.insertDeliveryOutboxRows(
        tx,
        notification,
        nextMetadata,
        decision.transition,
        decision.deliveryVersion,
        channels,
        actorId,
        observedAt,
      );

      return {
        notificationId: notification.id,
        lifecycleKey,
        transition: decision.transition,
        outboxCount,
      };
    });
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
            r."name" IN ('ADMIN', 'SUPER_ADMIN')
            OR p."name" IN (
              'admin:*',
              'admin:read',
              'dashboard:*',
              'dashboard:read',
              'notifications:*',
              'notifications:read',
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

  private findRecoveryCandidates(
    userId: string,
    activeLifecycleKeys: ReadonlySet<string>,
  ): Promise<LifecycleNotificationRow[]> {
    const keys = [...activeLifecycleKeys];
    const exclusion =
      keys.length > 0
        ? Prisma.sql`AND n."metadata" #>> '{lifecycleKey}' NOT IN (${Prisma.join(
            keys,
          )})`
        : Prisma.empty;

    return this.prisma.$queryRaw<LifecycleNotificationRow[]>(
      Prisma.sql`
        SELECT
          n."id",
          n."userId",
          n."title",
          n."message",
          n."isRead",
          n."readAt",
          n."metadata",
          n."createdAt",
          n."updatedAt"
        FROM "Notification" n
        WHERE
          n."userId" = ${userId}
          AND n."deleted_at" IS NULL
          AND n."isActive" = TRUE
          AND n."metadata" #>> '{source}' = ${ADMIN_OPERATIONS_QUEUE_ALERT_SOURCE}
          AND n."metadata" #>> '{lifecycleStatus}' = 'ACTIVE'
          ${exclusion}
        ORDER BY n."updatedAt" ASC
      `,
    );
  }

  private async insertLifecycleNotification(
    tx: Prisma.TransactionClient,
    userId: string,
    title: string,
    message: string,
    metadata: Record<string, unknown>,
    now: Date,
  ): Promise<LifecycleNotificationRow> {
    const rows = await tx.$queryRaw<LifecycleNotificationRow[]>(
      Prisma.sql`
        INSERT INTO "Notification" (
          "id",
          "userId",
          "type",
          "title",
          "message",
          "isRead",
          "readAt",
          "linkUrl",
          "metadata",
          "isActive",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${randomUUID()},
          ${userId},
          'SYSTEM'::"NotificationType",
          ${title},
          ${message},
          FALSE,
          NULL,
          ${ADMIN_OPERATIONS_QUEUE_ALERT_ACTION_URL},
          ${this.toJsonb(metadata)},
          TRUE,
          ${now},
          ${now}
        )
        RETURNING
          "id",
          "userId",
          "title",
          "message",
          "isRead",
          "readAt",
          "metadata",
          "createdAt",
          "updatedAt"
      `,
    );

    return this.requireNotification(rows);
  }

  private async updateLifecycleNotification(
    tx: Prisma.TransactionClient,
    existing: LifecycleNotificationRow,
    title: string,
    message: string,
    metadata: Record<string, unknown>,
    reopenAcknowledgement: boolean,
    now: Date,
  ): Promise<LifecycleNotificationRow> {
    const rows = await tx.$queryRaw<LifecycleNotificationRow[]>(
      Prisma.sql`
        UPDATE "Notification" n
        SET
          "title" = ${title},
          "message" = ${message},
          "linkUrl" = ${ADMIN_OPERATIONS_QUEUE_ALERT_ACTION_URL},
          "metadata" = ${this.toJsonb(metadata)},
          "isRead" =
            CASE
              WHEN ${reopenAcknowledgement} THEN FALSE
              ELSE n."isRead"
            END,
          "readAt" =
            CASE
              WHEN ${reopenAcknowledgement} THEN NULL
              ELSE n."readAt"
            END,
          "updatedAt" = ${now}
        WHERE n."id" = ${existing.id}
        RETURNING
          "id",
          "userId",
          "title",
          "message",
          "isRead",
          "readAt",
          "metadata",
          "createdAt",
          "updatedAt"
      `,
    );

    return this.requireNotification(rows);
  }

  private async updateRecoveredNotification(
    tx: Prisma.TransactionClient,
    existing: LifecycleNotificationRow,
    title: string,
    message: string,
    metadata: Record<string, unknown>,
    now: Date,
  ): Promise<LifecycleNotificationRow> {
    const rows = await tx.$queryRaw<LifecycleNotificationRow[]>(
      Prisma.sql`
        UPDATE "Notification" n
        SET
          "title" = ${title},
          "message" = ${message},
          "linkUrl" = ${ADMIN_OPERATIONS_QUEUE_ALERT_ACTION_URL},
          "metadata" = ${this.toJsonb(metadata)},
          "isRead" = TRUE,
          "readAt" = COALESCE(n."readAt", ${now}),
          "updatedAt" = ${now}
        WHERE n."id" = ${existing.id}
        RETURNING
          "id",
          "userId",
          "title",
          "message",
          "isRead",
          "readAt",
          "metadata",
          "createdAt",
          "updatedAt"
      `,
    );

    return this.requireNotification(rows);
  }

  private async insertDeliveryOutboxRows(
    tx: Prisma.TransactionClient,
    notification: LifecycleNotificationRow,
    metadata: Record<string, unknown>,
    transition: AdminOperationsQueueAlertTransition,
    deliveryVersion: number,
    channels: readonly NotificationDeliveryChannel[],
    actorId: string,
    requestedAt: Date,
  ): Promise<number> {
    let count = 0;

    for (const channel of channels) {
      const payload: NotificationDeliveryOutboxPayload = {
        version: NOTIFICATION_DELIVERY_OUTBOX_VERSION,
        notificationId: notification.id,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: 'SYSTEM',
        channel,
        actionUrl: ADMIN_OPERATIONS_QUEUE_ALERT_ACTION_URL,
        metadata,
        actorId,
        requestedAt: requestedAt.toISOString(),
        lifecycleKey: this.readRequiredString(metadata.lifecycleKey),
        deliveryVersion,
        transition,
      };
      const aggregateId =
        AdminOperationsQueueAlertLifecycleUtil.buildOutboxAggregateId({
          notificationId: notification.id,
          deliveryVersion,
          channel,
        });

      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO "EventOutbox" (
            "id",
            "aggregateId",
            "type",
            "payload",
            "status",
            "createdAt",
            "processedAt"
          )
          VALUES (
            ${randomUUID()},
            ${aggregateId},
            ${NOTIFICATION_DELIVERY_OUTBOX_TYPE},
            ${this.toJsonb(payload)},
            'PENDING'::"OutboxStatus",
            ${requestedAt},
            NULL
          )
        `,
      );

      count += 1;
    }

    return count;
  }

  private buildRecoverySignal(
    metadata: Record<string, unknown>,
  ): QueueOperationalHealthSignal {
    return {
      queueName: this.readRequiredString(
        metadata.queueName,
      ) as QueueOperationalHealthSignal['queueName'],
      code: this.readRequiredString(
        metadata.signalCode,
      ) as QueueOperationalHealthSignal['code'],
      level: 'WARNING',
      actual: this.readNumber(metadata.actual),
      threshold: this.readNumber(metadata.threshold),
      message:
        this.readString(metadata.signalMessage) ??
        'سیگنال عملیاتی قبلی برطرف شده است.',
    };
  }

  private getChannels(): readonly NotificationDeliveryChannel[] {
    const raw = process.env.ADMIN_OPERATIONS_QUEUE_ALERT_CHANNELS?.trim();

    if (!raw) {
      return [];
    }

    const channels = raw
      .split(',')
      .map(
        (item) =>
          NOTIFICATION_DELIVERY_CHANNEL_BY_VALUE[item.trim().toLowerCase()],
      )
      .filter(
        (item): item is NotificationDeliveryChannel => item !== undefined,
      );

    return [...new Set(channels)];
  }

  private isEnabled(): boolean {
    return (
      process.env.ADMIN_OPERATIONS_QUEUE_ALERT_LIFECYCLE_ENABLED !== 'false'
    );
  }

  private countTransition(
    transitions: readonly QueueAlertTransitionResult[],
    transition: AdminOperationsQueueAlertTransition,
  ): number {
    return transitions.filter((item) => item.transition === transition).length;
  }

  private requireNotification(
    rows: LifecycleNotificationRow[],
  ): LifecycleNotificationRow {
    const row = rows[0];

    if (!row) {
      throw new Error('Queue alert lifecycle notification was not persisted.');
    }

    return row;
  }

  private toRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value;
  }

  private toJsonb(value: unknown): Prisma.Sql {
    return Prisma.sql`${JSON.stringify(value)}::jsonb`;
  }

  private readRequiredString(value: unknown): string {
    const normalized = this.readString(value);

    if (!normalized) {
      throw new Error('Required queue alert lifecycle metadata is missing.');
    }

    return normalized;
  }

  private readString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized : undefined;
  }

  private readNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
}
