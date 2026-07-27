import { Injectable, Logger } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { Prisma } from '../../../generated/prisma';

import {
  QUEUE_JOB_NAMES,
  QUEUE_NAMES,
} from '../../../core/queue/constants/queue.constants';

import { QueueProducerService } from '../../../core/queue/services/queue-producer.service';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { NotificationDeliveryChannel } from '../delivery/notification-delivery.channel';

import {
  NOTIFICATION_DELIVERY_OUTBOX_TYPE,
  NOTIFICATION_DELIVERY_OUTBOX_VERSION,
  NotificationDeliveryOutboxPayload,
  NotificationDeliveryOutboxSnapshot,
} from './notification-delivery-outbox.types';

interface PendingOutboxRow {
  readonly id: string;
  readonly aggregateId: string;
  readonly payload: Prisma.JsonValue;
  readonly createdAt: Date;
}

export interface NotificationDeliveryOutboxDispatchResult {
  readonly checkedAt: string;
  readonly pendingCount: number;
  readonly enqueuedCount: number;
  readonly malformedCount: number;
  readonly failedToEnqueueCount: number;
}

@Injectable()
export class NotificationDeliveryOutboxService {
  private readonly logger = new Logger(NotificationDeliveryOutboxService.name);

  @Cron('* * * * *', {
    timeZone: 'Asia/Tehran',
  })
  async dispatchScheduled(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    await this.dispatchPending();
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueProducerService: QueueProducerService,
  ) {}

  async dispatchPending(
    limit = this.getBatchSize(),
  ): Promise<NotificationDeliveryOutboxDispatchResult> {
    const normalizedLimit = this.normalizeLimit(limit);
    const rows = await this.prisma.$queryRaw<PendingOutboxRow[]>(
      Prisma.sql`
        SELECT
          o."id",
          o."aggregateId",
          o."payload",
          o."createdAt"
        FROM "EventOutbox" o
        WHERE
          o."status"::text = 'PENDING'
          AND o."type" = ${NOTIFICATION_DELIVERY_OUTBOX_TYPE}
        ORDER BY
          o."createdAt" ASC,
          o."id" ASC
        LIMIT ${normalizedLimit}
      `,
    );

    let enqueuedCount = 0;
    let malformedCount = 0;
    let failedToEnqueueCount = 0;

    for (const row of rows) {
      const payload = this.parsePayload(row.payload);

      if (!payload) {
        malformedCount += 1;
        await this.markFailed(
          row.id,
          null,
          'Outbox payload is invalid or incomplete.',
        );
        continue;
      }

      try {
        const jobId = this.buildJobId(row.id);

        await this.queueProducerService.enqueue({
          queueName: QUEUE_NAMES.NOTIFICATION,
          jobName: QUEUE_JOB_NAMES.NOTIFICATION_DELIVERY,
          data: {
            notificationId: payload.notificationId,
            channel: payload.channel,
            userId: payload.userId,
            title: payload.title,
            message: payload.message,
            type: payload.type,
            payload: {
              actionUrl: payload.actionUrl ?? null,
              metadata: payload.metadata ?? null,
              outboxId: row.id,
              aggregateId: row.aggregateId,
              lifecycleKey: payload.lifecycleKey ?? null,
              deliveryVersion: payload.deliveryVersion ?? null,
              transition: payload.transition ?? null,
            },
            metadata: {
              createdAt: new Date().toISOString(),
              actorId: payload.actorId,
              source: 'notification.delivery.outbox',
              producer: 'notification-delivery-outbox',
              requestId: row.id,
              correlationId: payload.lifecycleKey ?? row.aggregateId,
              idempotencyKey: jobId,
            },
          },
          options: {
            jobId,
            attempts: 5,
            backoffType: 'exponential',
            backoffDelayMs: 5_000,
            removeOnCompleteCount: 5_000,
            removeOnFailCount: 10_000,
          },
        });

        await this.recordDispatched(row.id, jobId);
        enqueuedCount += 1;
      } catch (error) {
        failedToEnqueueCount += 1;
        this.logger.warn(
          `Notification outbox dispatch deferred: outbox=${row.id}; reason=${this.resolveErrorMessage(error)}`,
        );
      }
    }

    return {
      checkedAt: new Date().toISOString(),
      pendingCount: rows.length,
      enqueuedCount,
      malformedCount,
      failedToEnqueueCount,
    };
  }

  async markProcessed(
    outboxId: string,
    jobId: string | null,
    delivery: {
      readonly delivered: boolean;
      readonly provider?: string;
      readonly messageId?: string | null;
      readonly error?: string | null;
    },
  ): Promise<void> {
    const processedAt = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "EventOutbox" o
        SET
          "status" = 'PROCESSED'::"OutboxStatus",
          "processedAt" = ${processedAt},
          "payload" =
            COALESCE(o."payload", '{}'::jsonb)
            || jsonb_build_object(
              'deliveryState', 'PROCESSED',
              'delivered', ${delivery.delivered},
              'deliveryProvider', ${delivery.provider ?? null},
              'providerMessageId', ${delivery.messageId ?? null},
              'deliveryError', ${delivery.error ?? null},
              'processedJobId', ${jobId},
              'processedAt', ${processedAt.toISOString()}
            )
        WHERE
          o."id" = ${outboxId}
          AND o."type" = ${NOTIFICATION_DELIVERY_OUTBOX_TYPE}
          AND o."status"::text = 'PENDING'
      `,
    );
  }

  async markFailed(
    outboxId: string,
    jobId: string | null,
    failureReason: string,
  ): Promise<void> {
    const failedAt = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "EventOutbox" o
        SET
          "status" = 'FAILED'::"OutboxStatus",
          "processedAt" = ${failedAt},
          "payload" =
            COALESCE(o."payload", '{}'::jsonb)
            || jsonb_build_object(
              'deliveryState', 'FAILED',
              'failedJobId', ${jobId},
              'failureReason', ${failureReason.slice(0, 2_000)},
              'failedAt', ${failedAt.toISOString()}
            )
        WHERE
          o."id" = ${outboxId}
          AND o."type" = ${NOTIFICATION_DELIVERY_OUTBOX_TYPE}
          AND o."status"::text = 'PENDING'
      `,
    );
  }

  getSnapshot(): NotificationDeliveryOutboxSnapshot {
    return {
      version: NOTIFICATION_DELIVERY_OUTBOX_VERSION,
      outboxType: NOTIFICATION_DELIVERY_OUTBOX_TYPE,
      deterministicJobId: true,
      queueAttempts: 5,
      queueBackoff: 'EXPONENTIAL',
      marksProcessedOnlyAfterDelivery: true,
      marksFailedOnlyAfterTerminalFailure: true,
      payloadValidation: true,
    };
  }

  private async recordDispatched(
    outboxId: string,
    jobId: string,
  ): Promise<void> {
    const dispatchedAt = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "EventOutbox" o
        SET
          "payload" =
            COALESCE(o."payload", '{}'::jsonb)
            || jsonb_build_object(
              'deliveryState', 'ENQUEUED',
              'dispatchJobId', ${jobId},
              'lastDispatchedAt', ${dispatchedAt.toISOString()},
              'dispatchCount',
                COALESCE(
                  NULLIF(o."payload" #>> '{dispatchCount}', '')::int,
                  0
                ) + 1
            )
        WHERE
          o."id" = ${outboxId}
          AND o."type" = ${NOTIFICATION_DELIVERY_OUTBOX_TYPE}
          AND o."status"::text = 'PENDING'
      `,
    );
  }

  private parsePayload(
    value: Prisma.JsonValue,
  ): NotificationDeliveryOutboxPayload | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, unknown>;
    const version = this.readString(record.version);
    const notificationId = this.readString(record.notificationId);
    const userId = this.readString(record.userId);
    const title = this.readString(record.title);
    const message = this.readString(record.message);
    const type = this.readString(record.type);
    const channel = this.readChannel(record.channel);
    const requestedAt = this.readString(record.requestedAt);

    if (
      version !== NOTIFICATION_DELIVERY_OUTBOX_VERSION ||
      !notificationId ||
      !userId ||
      !title ||
      !message ||
      !type ||
      !channel ||
      !requestedAt
    ) {
      return null;
    }

    return {
      version: NOTIFICATION_DELIVERY_OUTBOX_VERSION,
      notificationId,
      userId,
      title,
      message,
      type,
      channel,
      actionUrl: this.readNullableString(record.actionUrl),
      metadata: this.readRecord(record.metadata),
      actorId: this.readString(record.actorId),
      requestedAt,
      lifecycleKey: this.readString(record.lifecycleKey),
      deliveryVersion: this.readNonNegativeInteger(record.deliveryVersion),
      transition: this.readString(record.transition),
    };
  }

  private buildJobId(outboxId: string): string {
    return `notification-delivery-${outboxId}`;
  }

  private isEnabled(): boolean {
    return process.env.NOTIFICATION_DELIVERY_OUTBOX_ENABLED !== 'false';
  }

  private getBatchSize(): number {
    const parsed = Number.parseInt(
      process.env.NOTIFICATION_DELIVERY_OUTBOX_BATCH_SIZE ?? '',
      10,
    );

    return this.normalizeLimit(parsed);
  }

  private normalizeLimit(value: number): number {
    if (!Number.isInteger(value) || value < 1) {
      return 50;
    }

    return Math.min(value, 200);
  }

  private readChannel(value: unknown): NotificationDeliveryChannel | null {
    if (
      value === NotificationDeliveryChannel.DATABASE ||
      value === NotificationDeliveryChannel.EMAIL ||
      value === NotificationDeliveryChannel.SMS ||
      value === NotificationDeliveryChannel.PUSH ||
      value === NotificationDeliveryChannel.WEBSOCKET
    ) {
      return value;
    }

    return null;
  }

  private readString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized : undefined;
  }

  private readNullableString(value: unknown): string | null | undefined {
    if (value === null) {
      return null;
    }

    return this.readString(value);
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private readNonNegativeInteger(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0
      ? value
      : undefined;
  }

  private resolveErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
