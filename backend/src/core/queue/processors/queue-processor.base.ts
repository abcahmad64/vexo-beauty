import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import type {
  QueueExecutionCancellation,
  QueueExecutionEnvelope,
  QueueExecutionObservation,
  QueueFailureInput,
  QueueJobName,
  QueueJobResult,
  QueueName,
  QueuePayload,
  VexoQueueJobData,
} from '../types/queue.types';
import { QueueErrorUtil } from '../utils/queue-error.util';
import { QueueExecutionObservabilityUtil } from '../utils/queue-execution-observability.util';
import { QueueFailureClassifierUtil } from '../utils/queue-failure-classifier.util';
import { QueueResultUtil } from '../utils/queue-result.util';
import { QueueRetryPolicyUtil } from '../utils/queue-retry-policy.util';

type QueueResultDetails = Record<string, unknown>;

export abstract class QueueProcessorBase {
  protected readonly logger = new Logger(this.constructor.name);

  protected success(
    message: string,
    details?: QueueResultDetails,
  ): QueueJobResult {
    return QueueResultUtil.success(message, details);
  }

  protected failed(
    message: string,
    details?: QueueResultDetails,
  ): QueueJobResult {
    return QueueResultUtil.failed(message, details);
  }

  protected buildFailureInput<TData extends VexoQueueJobData>(
    queueName: QueueName,
    job: Job<TData, QueueJobResult, QueueJobName>,
    error: unknown,
  ): QueueFailureInput {
    const failure = QueueFailureClassifierUtil.classify(error);
    const retryDecision = QueueRetryPolicyUtil.decide({
      failure,
      attemptsMade: job.attemptsMade,
      attemptsStarted: job.attemptsStarted,
      maxAttempts: this.resolveMaxAttempts(job),
    });
    const envelope = this.resolveEnvelope(job.data);

    if (retryDecision.shouldDiscard) {
      job.discard();
    }

    return {
      queueName,
      jobName: job.name,
      jobId: this.resolveJobId(job),
      attemptsMade: retryDecision.attempt.attemptsMade,
      failureReason: failure.message,
      failure,
      retryDecision,
      ...(envelope
        ? {
            envelope,
          }
        : {}),
      data: this.resolveSafeJobData(job.data),
    };
  }

  protected logJobStarted<TData extends VexoQueueJobData>(
    queueName: QueueName,
    job: Job<TData, QueueJobResult, QueueJobName>,
  ): void {
    const observation = this.observe(queueName, job, 'STARTED');

    this.logger.log(
      `پردازش Job شروع شد. ${QueueExecutionObservabilityUtil.format(
        observation,
      )}`,
    );
  }

  protected logJobCompleted<TData extends VexoQueueJobData>(
    queueName: QueueName,
    job: Job<TData, QueueJobResult, QueueJobName>,
  ): void {
    const observation = this.observe(queueName, job, 'COMPLETED');

    this.logger.log(
      `پردازش Job با موفقیت کامل شد. ${QueueExecutionObservabilityUtil.format(
        observation,
      )}`,
    );
  }

  protected logJobFailed<TData extends VexoQueueJobData>(
    queueName: QueueName,
    job: Job<TData, QueueJobResult, QueueJobName>,
    error: unknown,
    failureInput?: QueueFailureInput,
  ): void {
    const resolvedFailureInput =
      failureInput ?? this.previewFailureInput(queueName, job, error);
    const observation = this.observe(
      queueName,
      job,
      'FAILED',
      resolvedFailureInput,
    );

    this.logger.error(
      `پردازش Job شکست خورد. ${QueueExecutionObservabilityUtil.format(
        observation,
      )} reason=${QueueErrorUtil.resolveMessage(error)}`,
      QueueErrorUtil.resolveStack(error),
    );
  }

  protected logJobRetryScheduled<TData extends VexoQueueJobData>(
    queueName: QueueName,
    job: Job<TData, QueueJobResult, QueueJobName>,
    failureInput: QueueFailureInput,
  ): void {
    const observation = this.observe(
      queueName,
      job,
      'RETRY_SCHEDULED',
      failureInput,
    );

    this.logger.warn(
      `Job برای Retry بعدی واگذار شد. ${QueueExecutionObservabilityUtil.format(
        observation,
      )}`,
    );
  }

  protected logJobCancelled<TData extends VexoQueueJobData>(
    queueName: QueueName,
    job: Job<TData, QueueJobResult, QueueJobName>,
    cancellation: QueueExecutionCancellation,
  ): void {
    const observation = this.observe(queueName, job, 'CANCELLED');

    this.logger.warn(
      `پردازش Job عمداً لغو شد. ${QueueExecutionObservabilityUtil.format(
        observation,
      )} cancellation=${cancellation.cancellationId} actor=${
        cancellation.requestedBy
      } reason=${cancellation.reason}`,
    );
  }

  protected logJobDeadLetter<TData extends VexoQueueJobData>(
    queueName: QueueName,
    job: Job<TData, QueueJobResult, QueueJobName>,
    failureInput: QueueFailureInput,
  ): void {
    const observation = this.observe(
      queueName,
      job,
      'DEAD_LETTER',
      failureInput,
    );

    this.logger.warn(
      `Job برای Dead Letter ثبت می‌شود. ${QueueExecutionObservabilityUtil.format(
        observation,
      )}`,
    );
  }

  private previewFailureInput<TData extends VexoQueueJobData>(
    queueName: QueueName,
    job: Job<TData, QueueJobResult, QueueJobName>,
    error: unknown,
  ): QueueFailureInput {
    const failure = QueueFailureClassifierUtil.classify(error);
    const retryDecision = QueueRetryPolicyUtil.decide({
      failure,
      attemptsMade: job.attemptsMade,
      attemptsStarted: job.attemptsStarted,
      maxAttempts: this.resolveMaxAttempts(job),
    });
    const envelope = this.resolveEnvelope(job.data);

    return {
      queueName,
      jobName: job.name,
      jobId: this.resolveJobId(job),
      attemptsMade: retryDecision.attempt.attemptsMade,
      failureReason: failure.message,
      failure,
      retryDecision,
      ...(envelope ? { envelope } : {}),
      data: this.resolveSafeJobData(job.data),
    };
  }

  private observe<TData extends VexoQueueJobData>(
    queueName: QueueName,
    job: Job<TData, QueueJobResult, QueueJobName>,
    phase: QueueExecutionObservation['phase'],
    failureInput?: QueueFailureInput,
  ): QueueExecutionObservation {
    return QueueExecutionObservabilityUtil.observe({
      queueName,
      jobName: String(job.name),
      jobId: job.id,
      phase,
      data: job.data,
      attemptsMade: job.attemptsMade,
      attemptsStarted: job.attemptsStarted,
      maxAttempts: this.resolveMaxAttempts(job),
      ...(failureInput
        ? {
            failure: failureInput.failure,
            retryDecision: failureInput.retryDecision,
          }
        : {}),
    });
  }

  private resolveEnvelope(
    data: VexoQueueJobData,
  ): QueueExecutionEnvelope | undefined {
    if (!('envelope' in data)) {
      return undefined;
    }

    return data.envelope;
  }

  private resolveJobId<TData extends VexoQueueJobData>(
    job: Job<TData, QueueJobResult, QueueJobName>,
  ): string | undefined {
    if (job.id === undefined || job.id === null) {
      return undefined;
    }

    const normalizedJobId = String(job.id).trim();

    return normalizedJobId.length > 0 ? normalizedJobId : undefined;
  }

  private resolveMaxAttempts<TData extends VexoQueueJobData>(
    job: Job<TData, QueueJobResult, QueueJobName>,
  ): number | undefined {
    const attempts = job.opts.attempts;

    return typeof attempts === 'number' ? attempts : undefined;
  }

  private resolveSafeJobData(data: unknown): QueuePayload {
    const safeData = QueueErrorUtil.toSafeRecord(data);

    if (!safeData || typeof safeData !== 'object' || Array.isArray(safeData)) {
      return {};
    }

    return safeData;
  }
}
