import type { QueueExecutionObservabilitySnapshot } from '../../../core/queue/utils/queue-execution-observability.util';
import { QueueExecutionObservabilityUtil } from '../../../core/queue/utils/queue-execution-observability.util';

import type { QueueRetryPolicySnapshot } from '../../../core/queue/utils/queue-retry-policy.util';
import { QueueRetryPolicyUtil } from '../../../core/queue/utils/queue-retry-policy.util';

describe('AI queue retry governance contract', () => {
  it('publishes declaration-safe retry and observability contracts', () => {
    const retryPolicy: QueueRetryPolicySnapshot =
      QueueRetryPolicyUtil.getSnapshot();
    const observability: QueueExecutionObservabilitySnapshot =
      QueueExecutionObservabilityUtil.getSnapshot();

    expect(retryPolicy).toEqual({
      version: '1.0.0',
      attemptAware: true,
      nonRetryableFailuresDiscarded: true,
      deadLetterCapture: 'NON_RETRYABLE_OR_FINAL_ATTEMPT_ONLY',
      retryableFailureBehavior: 'RETHROW_WITHOUT_DLQ_UNTIL_FINAL_ATTEMPT',
      maxSupportedAttempts: 20,
      bullMqAttemptsRemainAuthoritative: true,
    });

    expect(observability).toEqual({
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

  it('keeps BullMQ attempts authoritative while preventing duplicate DLQ capture', () => {
    const failure = {
      version: '1.0.0' as const,
      category: 'TIMEOUT' as const,
      code: 'ETIMEDOUT',
      retryable: true,
      severity: 'WARNING' as const,
      message: 'request timed out',
      classifiedAt: '2026-07-23T00:00:00.000Z',
    };

    const retryable = QueueRetryPolicyUtil.decide({
      failure,
      attemptsMade: 1,
      attemptsStarted: 2,
      maxAttempts: 3,
    });

    const exhausted = QueueRetryPolicyUtil.decide({
      failure,
      attemptsMade: 2,
      attemptsStarted: 3,
      maxAttempts: 3,
    });

    expect(retryable).toMatchObject({
      action: 'RETRY',
      shouldRetry: true,
      shouldCaptureDeadLetter: false,
    });
    expect(exhausted).toMatchObject({
      action: 'DEAD_LETTER_EXHAUSTED',
      shouldRetry: false,
      shouldCaptureDeadLetter: true,
    });
  });
});
