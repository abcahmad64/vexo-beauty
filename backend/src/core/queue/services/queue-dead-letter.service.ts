import { Injectable, Logger } from '@nestjs/common';

import { QUEUE_JOB_NAMES, QUEUE_NAMES } from '../constants/queue.constants';
import type { QueueFailureInput, QueuePayload } from '../types/queue.types';
import { QueueJobMetadataUtil } from '../utils/queue-job-metadata.util';
import { QueueProducerService } from './queue-producer.service';

@Injectable()
export class QueueDeadLetterService {
  private readonly logger = new Logger(QueueDeadLetterService.name);

  constructor(private readonly queueProducerService: QueueProducerService) {}

  async captureFailure(input: QueueFailureInput): Promise<void> {
    if (this.isDeadLetterCapture(input)) {
      this.logger.warn(
        `ثبت dead-letter نادیده گرفته شد تا loop ایجاد نشود: ${input.jobName}`,
      );
      return;
    }

    if (!input.retryDecision.shouldCaptureDeadLetter) {
      this.logger.log(
        `ثبت dead-letter تا آخرین Attempt به تعویق افتاد: ${input.queueName}/${input.jobName} attempt=${input.retryDecision.attempt.currentAttempt}/${input.retryDecision.attempt.maxAttempts}`,
      );
      return;
    }

    try {
      await this.queueProducerService.enqueueDeadLetterCapture({
        originalQueue: input.queueName,
        originalJobName: input.jobName,
        originalJobId: this.normalizeOptionalString(input.jobId),
        failureReason: this.normalizeFailureReason(input.failureReason),
        failedAt: new Date().toISOString(),
        attemptsMade: this.normalizeAttemptsMade(input.attemptsMade),
        failure: input.failure,
        retryDecision: input.retryDecision,
        ...(input.envelope
          ? {
              envelope: input.envelope,
            }
          : {}),
        data: this.normalizePayload(input.data),
        metadata: QueueJobMetadataUtil.create({
          source: 'queue-dead-letter',
          producer: 'queue-dead-letter-service',
          correlationId: input.envelope?.correlationId,
          requestId: input.envelope?.requestId,
          parentExecutionId: input.envelope?.executionId,
          executionContextVersion: this.resolveMetadataString(
            input.data,
            'executionContextVersion',
          ),
          idempotencyKey: this.buildDeadLetterIdempotencyKey(input),
        }),
      });
    } catch (error) {
      this.logger.error(
        `ثبت dead-letter ناموفق بود: ${input.queueName}/${input.jobName}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private isDeadLetterCapture(input: QueueFailureInput): boolean {
    return (
      input.queueName === QUEUE_NAMES.DEAD_LETTER ||
      input.jobName === QUEUE_JOB_NAMES.DEAD_LETTER_CAPTURE
    );
  }

  private normalizeFailureReason(value: string): string {
    const normalizedValue = value.trim();

    return normalizedValue.length > 0
      ? normalizedValue
      : 'Unknown queue failure';
  }

  private normalizeAttemptsMade(value: number): number {
    if (!Number.isInteger(value) || value < 0) {
      return 0;
    }

    return value;
  }

  private normalizePayload(value: QueuePayload): QueuePayload {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value;
  }

  private resolveMetadataString(
    data: QueuePayload,
    key: string,
  ): string | undefined {
    const metadata = data.metadata;

    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return undefined;
    }

    return this.normalizeOptionalString(
      (metadata as Record<string, unknown>)[key],
    );
  }

  private buildDeadLetterIdempotencyKey(input: QueueFailureInput): string {
    return [
      'dead-letter',
      input.queueName,
      input.jobName,
      input.jobId ?? input.envelope?.executionId ?? 'unknown',
      input.retryDecision.action,
      String(input.retryDecision.attempt.currentAttempt),
    ].join(':');
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }
}
