import { Injectable } from '@nestjs/common';

import { NotificationType } from '../../../generated/prisma';

import { AiQueueProcessor } from '../../ai/processors/ai-queue.processor';

import { QueueMonitorService } from '../../../core/queue/services/queue-monitor.service';

import { QueueProducerService } from '../../../core/queue/services/queue-producer.service';

import { QueueJobMetadataUtil } from '../../../core/queue/utils/queue-job-metadata.util';

import {
  EnqueueTestAnalyticsJobDto,
  EnqueueTestNotificationJobDto,
} from '../dto/enqueue-queue-test.dto';

import { QueryQueueJobsDto } from '../dto/query-queue-jobs.dto';

@Injectable()
export class AdminQueueService {
  constructor(
    private readonly queueMonitorService: QueueMonitorService,
    private readonly queueProducerService: QueueProducerService,
    private readonly aiQueueProcessor: AiQueueProcessor,
  ) {}

  getStatus() {
    return this.queueMonitorService.getStatus();
  }

  getJobs(queueName: string, query: QueryQueueJobsDto) {
    return this.queueMonitorService.getJobs(queueName, {
      status: query.status,
      start: query.start,
      end: query.end,
      asc: this.parseBooleanString(query.asc),
    });
  }

  getJobDetails(queueName: string, jobId: string) {
    return this.queueMonitorService.getJobDetails(queueName, jobId);
  }

  retryJob(queueName: string, jobId: string) {
    return this.queueMonitorService.retryJob(queueName, jobId);
  }

  replayDeadLetterJob(jobId: string, actorId: string) {
    return this.queueMonitorService.replayDeadLetterJob(jobId, actorId);
  }

  cancelAiExecution(jobId: string, actorId: string, reason?: string) {
    return this.queueMonitorService.cancelAiExecution(
      jobId,
      actorId,
      reason,
      (activeJobId, cancellation) =>
        this.aiQueueProcessor.cancelActiveJob(activeJobId, cancellation),
    );
  }

  removeJob(queueName: string, jobId: string) {
    return this.queueMonitorService.removeJob(queueName, jobId);
  }

  pauseQueue(queueName: string) {
    return this.queueMonitorService.pauseQueue(queueName);
  }

  resumeQueue(queueName: string) {
    return this.queueMonitorService.resumeQueue(queueName);
  }

  enqueueTestNotificationJob(
    dto: EnqueueTestNotificationJobDto,
    actorId: string,
  ) {
    return this.queueProducerService.enqueueNotificationDatabase({
      userId: dto.userId,
      title: this.resolveText(dto.title, 'تست سیستم صف اعلان'),
      message: this.resolveText(
        dto.message,
        'این اعلان برای تست واقعی Queue Layer ایجاد شده است.',
      ),
      type: NotificationType.SYSTEM,
      payload: {
        ...(dto.metadata ?? {}),
        actionUrl: this.resolveText(dto.actionUrl, '/admin/queues/status'),
        severity: 'info',
        smokeTest: true,
        source: 'admin.queue.test.notification',
      },
      metadata: QueueJobMetadataUtil.create({
        actorId,
        source: 'admin-queue-service.test-notification',
      }),
    });
  }

  enqueueTestAnalyticsJob(dto: EnqueueTestAnalyticsJobDto, actorId: string) {
    const name = this.resolveText(dto.name, 'admin.queue.smoke_test');

    const category = this.resolveText(dto.category, 'queue');

    return this.queueProducerService.enqueueAnalyticsCaptureEvent({
      event: name,
      entityType: category,
      entityId: this.resolveOptionalText(dto.entityId),
      payload: {
        ...(dto.data ?? {}),
        description: this.resolveText(
          dto.description,
          'Admin queue smoke test event',
        ),
        userId: this.resolveOptionalText(dto.userId),
        timestamp: new Date().toISOString(),
        smokeTest: true,
        source: 'admin.queue.test.analytics',
      },
      metadata: QueueJobMetadataUtil.create({
        actorId,
        source: 'admin-queue-service.test-analytics',
      }),
    });
  }

  private parseBooleanString(value?: string): boolean | undefined {
    if (value === undefined) {
      return undefined;
    }

    return value.trim().toLowerCase() === 'true';
  }

  private resolveText(value: string | undefined, fallback: string): string {
    const normalized = value?.trim();

    if (normalized && normalized.length > 0) {
      return normalized;
    }

    return fallback;
  }

  private resolveOptionalText(value: string | undefined): string | undefined {
    const normalized = value?.trim();

    if (normalized && normalized.length > 0) {
      return normalized;
    }

    return undefined;
  }
}
