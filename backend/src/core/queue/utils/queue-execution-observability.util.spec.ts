import { QUEUE_JOB_NAMES, QUEUE_NAMES } from '../constants/queue.constants';

import type {
  AiQueueJobData,
  QueueFailureClassification,
  QueueRetryDecision,
} from '../types/queue.types';

import { QueueExecutionEnvelopeUtil } from './queue-execution-envelope.util';
import { QueueExecutionObservabilityUtil } from './queue-execution-observability.util';

function createData(): AiQueueJobData {
  return QueueExecutionEnvelopeUtil.prepareAiJob({
    queueName: QUEUE_NAMES.AI,
    jobName: QUEUE_JOB_NAMES.AI_PROCESS,
    data: {
      task: 'catalog.search',
      payload: {
        query: 'observability',
      },
      metadata: {
        createdAt: '2026-07-23T00:00:00.000Z',
        executionId: 'execution-observe-1',
        parentExecutionId: 'execution-parent-1',
        correlationId: 'correlation-observe-1',
        requestId: 'request-observe-1',
        source: 'test',
        agentId: 'semantic-retrieval',
        agentTaskType: 'EMBEDDING',
      },
    },
    options: {
      jobId: 'job-observe-1',
      attempts: 3,
    },
  }).data;
}

describe('QueueExecutionObservabilityUtil', () => {
  it('builds payload-free execution and attempt context', () => {
    const failure: QueueFailureClassification = {
      version: '1.0.0',
      category: 'TIMEOUT',
      code: 'ETIMEDOUT',
      retryable: true,
      severity: 'WARNING',
      message: 'request timed out',
      classifiedAt: '2026-07-23T00:00:00.000Z',
    };
    const retryDecision: QueueRetryDecision = {
      version: '1.0.0',
      action: 'RETRY',
      reason: 'RETRY_ATTEMPTS_REMAIN',
      retryable: true,
      shouldRetry: true,
      shouldDiscard: false,
      shouldCaptureDeadLetter: false,
      attempt: {
        attemptsMade: 0,
        attemptsStarted: 1,
        currentAttempt: 1,
        maxAttempts: 3,
        attemptsRemaining: 2,
        finalAttempt: false,
      },
      decidedAt: '2026-07-23T00:00:00.000Z',
    };

    const observation = QueueExecutionObservabilityUtil.observe({
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_PROCESS,
      jobId: 'job-observe-1',
      phase: 'RETRY_SCHEDULED',
      data: createData(),
      attemptsMade: 0,
      attemptsStarted: 1,
      maxAttempts: 3,
      failure,
      retryDecision,
    });

    expect(observation).toMatchObject({
      version: '1.0.0',
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_PROCESS,
      jobId: 'job-observe-1',
      phase: 'RETRY_SCHEDULED',
      attempt: retryDecision.attempt,
      execution: {
        executionId: 'execution-observe-1',
        parentExecutionId: 'execution-parent-1',
        correlationId: 'correlation-observe-1',
        requestId: 'request-observe-1',
        agentId: 'semantic-retrieval',
        agentTaskType: 'EMBEDDING',
      },
      failure,
      retryDecision,
    });
    expect(observation).not.toHaveProperty('payload');
    expect(observation).not.toHaveProperty('prompt');
    expect(QueueExecutionObservabilityUtil.format(observation)).toContain(
      'attempt=1/3',
    );
  });

  it('publishes a safe queue observability snapshot', () => {
    expect(QueueExecutionObservabilityUtil.getSnapshot()).toEqual({
      version: '1.0.0',
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
    });
  });
});
