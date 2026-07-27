import type { QueueFailureClassification } from '../types/queue.types';

import { QueueRetryPolicyUtil } from './queue-retry-policy.util';

function createFailure(retryable: boolean): QueueFailureClassification {
  return {
    version: '1.0.0',
    category: retryable ? 'TIMEOUT' : 'VALIDATION',
    code: retryable ? 'ETIMEDOUT' : 'HTTP_VALIDATION_ERROR',
    retryable,
    severity: 'WARNING',
    message: retryable ? 'request timed out' : 'invalid payload',
    classifiedAt: '2026-07-23T00:00:00.000Z',
  };
}

describe('QueueRetryPolicyUtil', () => {
  it('discards non-retryable failures and captures DLQ immediately', () => {
    const decision = QueueRetryPolicyUtil.decide({
      failure: createFailure(false),
      attemptsMade: 0,
      attemptsStarted: 1,
      maxAttempts: 3,
    });

    expect(decision).toMatchObject({
      version: '1.0.0',
      action: 'DEAD_LETTER_NON_RETRYABLE',
      reason: 'NON_RETRYABLE_FAILURE',
      retryable: false,
      shouldRetry: false,
      shouldDiscard: true,
      shouldCaptureDeadLetter: true,
      attempt: {
        attemptsMade: 0,
        attemptsStarted: 1,
        currentAttempt: 1,
        maxAttempts: 3,
        attemptsRemaining: 2,
        finalAttempt: false,
      },
    });
  });

  it('retries retryable failures without DLQ while attempts remain', () => {
    const decision = QueueRetryPolicyUtil.decide({
      failure: createFailure(true),
      attemptsMade: 0,
      attemptsStarted: 1,
      maxAttempts: 3,
    });

    expect(decision).toMatchObject({
      action: 'RETRY',
      reason: 'RETRY_ATTEMPTS_REMAIN',
      retryable: true,
      shouldRetry: true,
      shouldDiscard: false,
      shouldCaptureDeadLetter: false,
      attempt: {
        currentAttempt: 1,
        maxAttempts: 3,
        attemptsRemaining: 2,
        finalAttempt: false,
      },
    });
  });

  it('captures retryable failures only after the final attempt', () => {
    const decision = QueueRetryPolicyUtil.decide({
      failure: createFailure(true),
      attemptsMade: 2,
      attemptsStarted: 3,
      maxAttempts: 3,
    });

    expect(decision).toMatchObject({
      action: 'DEAD_LETTER_EXHAUSTED',
      reason: 'RETRY_ATTEMPTS_EXHAUSTED',
      retryable: true,
      shouldRetry: false,
      shouldDiscard: false,
      shouldCaptureDeadLetter: true,
      attempt: {
        currentAttempt: 3,
        maxAttempts: 3,
        attemptsRemaining: 0,
        finalAttempt: true,
      },
    });
  });

  it('publishes an attempt-aware retry policy snapshot', () => {
    expect(QueueRetryPolicyUtil.getSnapshot()).toEqual({
      version: '1.0.0',
      attemptAware: true,
      nonRetryableFailuresDiscarded: true,
      deadLetterCapture: 'NON_RETRYABLE_OR_FINAL_ATTEMPT_ONLY',
      retryableFailureBehavior: 'RETHROW_WITHOUT_DLQ_UNTIL_FINAL_ATTEMPT',
      maxSupportedAttempts: 20,
      bullMqAttemptsRemainAuthoritative: true,
    });
  });
});
