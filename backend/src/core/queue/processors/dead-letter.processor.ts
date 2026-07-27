import { Processor, WorkerHost } from '@nestjs/bullmq';

import type { Job } from 'bullmq';

import { QUEUE_JOB_NAMES, QUEUE_NAMES } from '../constants/queue.constants';

import { QueueProcessorBase } from './queue-processor.base';

import type {
  DeadLetterQueueJobData,
  QueueJobName,
  QueueJobResult,
} from '../types/queue.types';

@Processor(QUEUE_NAMES.DEAD_LETTER)
export class DeadLetterProcessor extends WorkerHost {
  private readonly processor = new DeadLetterProcessorHandler();

  process(
    job: Job<DeadLetterQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    return this.processor.process(job);
  }
}

class DeadLetterProcessorHandler extends QueueProcessorBase {
  process(
    job: Job<DeadLetterQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobResult> {
    this.logJobStarted(QUEUE_NAMES.DEAD_LETTER, job);

    if (job.name !== QUEUE_JOB_NAMES.DEAD_LETTER_CAPTURE) {
      const result = this.failed('نوع Job برای Dead Letter Queue معتبر نیست.', {
        jobName: job.name,
      });

      this.logJobCompleted(QUEUE_NAMES.DEAD_LETTER, job);

      return Promise.resolve(result);
    }

    const data = job.data;

    const result = this.success(
      'خطای Job شکست‌خورده در Dead Letter Queue ثبت شد.',
      {
        originalQueue: data.originalQueue,
        originalJobName: data.originalJobName,
        originalJobId: data.originalJobId,
        failureReason: data.failureReason,
        failedAt: data.failedAt,
        attemptsMade: data.attemptsMade,
        failure: data.failure ?? null,
        retryDecision: data.retryDecision ?? null,
        execution: data.envelope
          ? {
              version: data.envelope.version,
              executionId: data.envelope.executionId,
              correlationId: data.envelope.correlationId,
              requestId: data.envelope.requestId,
              idempotencyKey: data.envelope.idempotencyKey,
              idempotencyMode: data.envelope.idempotencyMode,
            }
          : null,
      },
    );

    this.logJobCompleted(QUEUE_NAMES.DEAD_LETTER, job);

    return Promise.resolve(result);
  }
}
