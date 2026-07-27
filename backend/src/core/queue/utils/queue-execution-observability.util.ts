import { QUEUE_EXECUTION_OBSERVABILITY_VERSION } from '../types/queue.types';

import type {
  QueueExecutionEnvelope,
  QueueExecutionObservation,
  QueueExecutionPhase,
  QueueFailureClassification,
  QueueName,
  QueueRetryDecision,
  VexoQueueJobData,
} from '../types/queue.types';

import { QueueRetryPolicyUtil } from './queue-retry-policy.util';

export interface QueueExecutionObservationInput {
  readonly queueName: QueueName;
  readonly jobName: string;
  readonly jobId?: string | number | null;
  readonly phase: QueueExecutionPhase;
  readonly data: VexoQueueJobData;
  readonly attemptsMade: number;
  readonly attemptsStarted?: number;
  readonly maxAttempts?: number;
  readonly failure?: QueueFailureClassification;
  readonly retryDecision?: QueueRetryDecision;
}

export interface QueueExecutionObservabilitySnapshot {
  readonly version: typeof QUEUE_EXECUTION_OBSERVABILITY_VERSION;
  readonly phases: readonly QueueExecutionPhase[];
  readonly attemptAware: true;
  readonly executionFields: readonly [
    'executionId',
    'parentExecutionId',
    'correlationId',
    'requestId',
    'agentId',
    'agentTaskType',
  ];
  readonly payloadExcluded: true;
  readonly promptExcluded: true;
  readonly failureClassificationIncluded: true;
  readonly retryDecisionIncluded: true;
}

export class QueueExecutionObservabilityUtil {
  static observe(
    input: QueueExecutionObservationInput,
  ): QueueExecutionObservation {
    const envelope = this.resolveEnvelope(input.data);
    const attempt =
      input.retryDecision?.attempt ??
      QueueRetryPolicyUtil.resolveAttemptContext({
        attemptsMade: input.attemptsMade,
        attemptsStarted: input.attemptsStarted,
        maxAttempts: input.maxAttempts,
      });
    const jobId = this.normalizeOptionalString(input.jobId);

    return {
      version: QUEUE_EXECUTION_OBSERVABILITY_VERSION,
      queueName: input.queueName,
      jobName: input.jobName,
      ...(jobId ? { jobId } : {}),
      phase: input.phase,
      observedAt: new Date().toISOString(),
      attempt,
      execution: {
        ...(envelope?.executionId ? { executionId: envelope.executionId } : {}),
        ...(envelope?.parentExecutionId
          ? { parentExecutionId: envelope.parentExecutionId }
          : {}),
        ...(envelope?.correlationId
          ? { correlationId: envelope.correlationId }
          : {}),
        ...(envelope?.requestId ? { requestId: envelope.requestId } : {}),
        ...(envelope?.agentId ? { agentId: envelope.agentId } : {}),
        ...(envelope?.agentTaskType
          ? { agentTaskType: envelope.agentTaskType }
          : {}),
      },
      ...(input.failure ? { failure: input.failure } : {}),
      ...(input.retryDecision ? { retryDecision: input.retryDecision } : {}),
    };
  }

  static format(observation: QueueExecutionObservation): string {
    const execution = observation.execution;
    const retryAction = observation.retryDecision?.action ?? '-';
    const failureCategory = observation.failure?.category ?? '-';

    return [
      `queue=${observation.queueName}`,
      `job=${observation.jobName}`,
      `id=${observation.jobId ?? '-'}`,
      `phase=${observation.phase}`,
      `attempt=${observation.attempt.currentAttempt}/${observation.attempt.maxAttempts}`,
      `execution=${execution.executionId ?? '-'}`,
      `correlation=${execution.correlationId ?? '-'}`,
      `agent=${execution.agentId ?? '-'}`,
      `failure=${failureCategory}`,
      `retryAction=${retryAction}`,
    ].join(' ');
  }

  static getSnapshot(): QueueExecutionObservabilitySnapshot {
    return {
      version: QUEUE_EXECUTION_OBSERVABILITY_VERSION,
      phases: [
        'STARTED',
        'COMPLETED',
        'FAILED',
        'RETRY_SCHEDULED',
        'DEAD_LETTER',
      ],
      attemptAware: true,
      executionFields: [
        'executionId',
        'parentExecutionId',
        'correlationId',
        'requestId',
        'agentId',
        'agentTaskType',
      ],
      payloadExcluded: true,
      promptExcluded: true,
      failureClassificationIncluded: true,
      retryDecisionIncluded: true,
    };
  }

  private static resolveEnvelope(
    data: VexoQueueJobData,
  ): QueueExecutionEnvelope | undefined {
    if (!('envelope' in data)) {
      return undefined;
    }

    return data.envelope;
  }

  private static normalizeOptionalString(
    value: string | number | null | undefined,
  ): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    const normalized = String(value).trim();

    return normalized.length > 0 ? normalized : undefined;
  }
}
