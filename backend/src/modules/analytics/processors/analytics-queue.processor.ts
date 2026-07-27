import { BadRequestException } from '@nestjs/common';

import { Processor, WorkerHost } from '@nestjs/bullmq';

import type { Job } from 'bullmq';

import {
  QUEUE_JOB_NAMES,
  QUEUE_NAMES,
} from '../../../core/queue/constants/queue.constants';

import { QueueProcessorBase } from '../../../core/queue/processors/queue-processor.base';

import { QueueDeadLetterService } from '../../../core/queue/services/queue-dead-letter.service';

import type {
  AnalyticsQueueJobData,
  QueueJobName,
  QueueJobResult,
} from '../../../core/queue/types/queue.types';

import { AnalyticsService } from '../services/analytics.service';

type RecordedAnalyticsEvent = {
  id: string;
  name: string;
  category: string | null;
  userId: string | null;
};

@Processor(QUEUE_NAMES.ANALYTICS)
export class AnalyticsQueueProcessor extends WorkerHost {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly deadLetterService: QueueDeadLetterService,
  ) {
    super();
  }

  async process(
    job: Job<AnalyticsQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    const handler = new AnalyticsQueueProcessorHandler(
      this.analyticsService,
      this.deadLetterService,
    );

    return handler.process(job);
  }
}

class AnalyticsQueueProcessorHandler extends QueueProcessorBase {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly deadLetterService: QueueDeadLetterService,
  ) {
    super();
  }

  async process(
    job: Job<AnalyticsQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    this.logJobStarted(QUEUE_NAMES.ANALYTICS, job);

    try {
      if (job.name !== QUEUE_JOB_NAMES.ANALYTICS_CAPTURE_EVENT) {
        throw new BadRequestException('نوع Job آنالیتیکس معتبر نیست.');
      }

      const event = (await this.analyticsService.recordEvent(
        {
          name: job.data.event,
          description: this.resolveDescription(job.data),
          category: job.data.entityType,
          userId: this.resolveUserId(job.data),
          data: this.resolveEventData(job.data),
        },
        job.data.metadata.actorId,
      )) as RecordedAnalyticsEvent;

      this.logJobCompleted(QUEUE_NAMES.ANALYTICS, job);

      return this.success('Job آنالیتیکس با موفقیت پردازش شد.', {
        eventId: event.id,
        name: event.name,
        category: event.category,
        userId: event.userId,
      });
    } catch (error) {
      this.logJobFailed(QUEUE_NAMES.ANALYTICS, job, error);

      await this.deadLetterService.captureFailure(
        this.buildFailureInput(QUEUE_NAMES.ANALYTICS, job, error),
      );

      throw error;
    }
  }

  private resolveDescription(data: AnalyticsQueueJobData): string | undefined {
    const value = data.payload?.description;

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    return undefined;
  }

  private resolveUserId(data: AnalyticsQueueJobData): string | undefined {
    const value = data.payload?.userId;

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    if (
      typeof data.metadata.actorId === 'string' &&
      data.metadata.actorId.trim().length > 0
    ) {
      return data.metadata.actorId.trim();
    }

    return undefined;
  }

  private resolveEventData(
    data: AnalyticsQueueJobData,
  ): Record<string, unknown> {
    return {
      ...(data.payload ?? {}),
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      queueMetadata: data.metadata,
    };
  }
}
