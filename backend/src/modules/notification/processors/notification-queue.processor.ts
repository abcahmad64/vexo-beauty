import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { Processor, WorkerHost } from '@nestjs/bullmq';

import type { Job } from 'bullmq';

import { NotificationType } from '../../../generated/prisma';

import {
  QUEUE_JOB_NAMES,
  QUEUE_NAMES,
} from '../../../core/queue/constants/queue.constants';

import { QueueProcessorBase } from '../../../core/queue/processors/queue-processor.base';

import { QueueDeadLetterService } from '../../../core/queue/services/queue-dead-letter.service';

import type {
  NotificationQueueJobData,
  QueueFailureInput,
  QueueJobName,
  QueueJobResult,
} from '../../../core/queue/types/queue.types';

import { NotificationDeliveryChannel } from '../delivery/notification-delivery.channel';

import { NotificationDeliveryService } from '../delivery/notification-delivery.service';

import { NotificationDeliveryOutboxService } from '../services/notification-delivery-outbox.service';

import { NotificationService } from '../services/notification.service';

type NotificationChannel = 'database' | 'email' | 'sms' | 'push' | 'websocket';

@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationQueueProcessor extends WorkerHost {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly deliveryService: NotificationDeliveryService,
    private readonly deliveryOutboxService: NotificationDeliveryOutboxService,
    private readonly deadLetterService: QueueDeadLetterService,
  ) {
    super();
  }

  async process(
    job: Job<NotificationQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    const handler = new NotificationQueueProcessorHandler(
      this.notificationService,
      this.deliveryService,
      this.deliveryOutboxService,
      this.deadLetterService,
    );

    return await handler.process(job);
  }
}

class NotificationQueueProcessorHandler extends QueueProcessorBase {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly deliveryService: NotificationDeliveryService,
    private readonly deliveryOutboxService: NotificationDeliveryOutboxService,
    private readonly deadLetterService: QueueDeadLetterService,
  ) {
    super();
  }

  async process(
    job: Job<NotificationQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    this.logJobStarted(QUEUE_NAMES.NOTIFICATION, job);

    try {
      const result = await this.processNotificationJob(job);

      this.logJobCompleted(QUEUE_NAMES.NOTIFICATION, job);

      return result;
    } catch (error) {
      const failureInput = this.buildFailureInput(
        QUEUE_NAMES.NOTIFICATION,
        job,
        error,
      );

      this.logJobFailed(QUEUE_NAMES.NOTIFICATION, job, error, failureInput);

      await this.deadLetterService.captureFailure(failureInput);

      await this.finalizeOutboxFailure(job, failureInput);

      throw error;
    }
  }

  private processNotificationJob(
    job: Job<NotificationQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    if (job.name === QUEUE_JOB_NAMES.NOTIFICATION_DATABASE) {
      return this.sendToChannels(job, ['database'], true);
    }

    if (job.name === QUEUE_JOB_NAMES.NOTIFICATION_PUSH) {
      return this.sendToChannels(job, ['push'], false);
    }

    if (job.name === QUEUE_JOB_NAMES.NOTIFICATION_DELIVERY) {
      return this.deliverPersistedNotification(job);
    }

    throw new BadRequestException('نوع Job اعلان معتبر نیست.');
  }

  private async deliverPersistedNotification(
    job: Job<NotificationQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    const data = job.data;
    const notificationId = this.requireString(
      data.notificationId,
      'شناسه اعلان برای تحویل الزامی است.',
    );
    const userId = this.requireString(
      data.userId,
      'شناسه کاربر برای تحویل اعلان الزامی است.',
    );
    const channel = this.resolveDeliveryChannel(data.channel);
    const payload = this.toRecord(data.payload);
    const outboxId = this.requireString(
      payload.outboxId,
      'شناسه Outbox برای تحویل اعلان الزامی است.',
    );
    const metadata = this.toRecordOrNull(payload.metadata);
    const result = await this.deliveryService.deliver({
      notificationId,
      userId,
      title: data.title,
      message: data.message,
      type: data.type,
      channel,
      metadata,
      actorId: data.metadata.actorId,
      occurredAt: new Date(data.metadata.createdAt),
    });

    if (!result.delivered) {
      throw new ServiceUnavailableException(
        result.error ?? 'تحویل اعلان توسط کانال مقصد کامل نشد.',
      );
    }

    await this.deliveryOutboxService.markProcessed(
      outboxId,
      this.resolveNullableJobId(job),
      result,
    );

    return this.success('تحویل قابل اتکای اعلان با موفقیت کامل شد.', {
      jobName: job.name,
      notificationId,
      outboxId,
      channel,
      provider: result.provider,
      providerMessageId: result.messageId,
    });
  }

  private async sendToChannels(
    job: Job<NotificationQueueJobData, QueueJobResult, QueueJobName>,
    channels: NotificationChannel[],
    saveToDatabase: boolean,
  ): Promise<QueueJobResult> {
    const data = job.data;

    if (!data.userId) {
      throw new BadRequestException('شناسه کاربر برای ارسال اعلان الزامی است.');
    }

    const notification = await this.notificationService.sendNotification(
      {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: this.resolveNotificationType(data.type),
        channels,
        saveToDatabase,
        actionUrl: this.resolveActionUrl(data.payload),
        metadata: this.resolveNotificationMetadata(data.payload),
      },
      {
        actorId: data.metadata.actorId,
      },
    );

    return this.success('Job اعلان با موفقیت پردازش شد.', {
      jobName: job.name,
      userId: data.userId,
      channels: notification.channels,
      savedToDatabase: notification.savedToDatabase,
      notificationId: notification.notification?.id,
    });
  }

  private async finalizeOutboxFailure(
    job: Job<NotificationQueueJobData, QueueJobResult, QueueJobName>,
    failureInput: QueueFailureInput,
  ): Promise<void> {
    if (
      job.name !== QUEUE_JOB_NAMES.NOTIFICATION_DELIVERY ||
      !failureInput.retryDecision.shouldCaptureDeadLetter
    ) {
      return;
    }

    const outboxId = this.readString(this.toRecord(job.data.payload).outboxId);

    if (!outboxId) {
      return;
    }

    await this.deliveryOutboxService.markFailed(
      outboxId,
      this.resolveNullableJobId(job),
      failureInput.failureReason,
    );
  }

  private resolveNotificationType(value: string): NotificationType {
    const normalized = value.trim().toUpperCase();

    const types = Object.values(NotificationType);

    if (!types.includes(normalized as NotificationType)) {
      throw new BadRequestException(`نوع اعلان معتبر نیست: ${value}`);
    }

    return normalized as NotificationType;
  }

  private resolveDeliveryChannel(
    value: string | null | undefined,
  ): NotificationDeliveryChannel {
    if (
      value === NotificationDeliveryChannel.DATABASE ||
      value === NotificationDeliveryChannel.EMAIL ||
      value === NotificationDeliveryChannel.SMS ||
      value === NotificationDeliveryChannel.PUSH ||
      value === NotificationDeliveryChannel.WEBSOCKET
    ) {
      return value;
    }

    throw new BadRequestException('کانال تحویل اعلان معتبر نیست.');
  }

  private resolveActionUrl(
    payload?: Record<string, unknown>,
  ): string | undefined {
    const value = payload?.actionUrl;

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    return undefined;
  }

  private resolveNotificationMetadata(
    payload?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!payload) {
      return undefined;
    }

    const metadata = {
      ...payload,
    };

    delete metadata.actionUrl;

    return metadata;
  }

  private resolveNullableJobId(
    job: Job<NotificationQueueJobData, QueueJobResult, QueueJobName>,
  ): string | null {
    if (job.id === undefined || job.id === null) {
      return null;
    }

    const normalized = String(job.id).trim();

    return normalized.length > 0 ? normalized : null;
  }

  private requireString(value: unknown, message: string): string {
    const normalized = this.readString(value);

    if (!normalized) {
      throw new BadRequestException(message);
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

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private toRecordOrNull(value: unknown): Record<string, unknown> | null {
    const record = this.toRecord(value);

    return Object.keys(record).length > 0 ? record : null;
  }
}
