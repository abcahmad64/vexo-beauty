import { QUEUE_RETRY_POLICY_VERSION } from '../types/queue.types';

import type {
  QueueAttemptContext,
  QueueFailureClassification,
  QueueRetryDecision,
} from '../types/queue.types';

export interface QueueRetryPolicyInput {
  readonly failure: QueueFailureClassification;
  readonly attemptsMade: number;
  readonly attemptsStarted?: number;
  readonly maxAttempts?: number;
}

export interface QueueRetryPolicySnapshot {
  readonly version: typeof QUEUE_RETRY_POLICY_VERSION;
  readonly attemptAware: true;
  readonly nonRetryableFailuresDiscarded: true;
  readonly deadLetterCapture: 'NON_RETRYABLE_OR_FINAL_ATTEMPT_ONLY';
  readonly retryableFailureBehavior: 'RETHROW_WITHOUT_DLQ_UNTIL_FINAL_ATTEMPT';
  readonly maxSupportedAttempts: 20;
  readonly bullMqAttemptsRemainAuthoritative: true;
}

export class QueueRetryPolicyUtil {
  static decide(input: QueueRetryPolicyInput): QueueRetryDecision {
    const attempt = this.resolveAttemptContext(input);

    if (!input.failure.retryable) {
      return {
        version: QUEUE_RETRY_POLICY_VERSION,
        action: 'DEAD_LETTER_NON_RETRYABLE',
        reason: 'NON_RETRYABLE_FAILURE',
        retryable: false,
        shouldRetry: false,
        shouldDiscard: true,
        shouldCaptureDeadLetter: true,
        attempt,
        decidedAt: new Date().toISOString(),
      };
    }

    if (attempt.finalAttempt) {
      return {
        version: QUEUE_RETRY_POLICY_VERSION,
        action: 'DEAD_LETTER_EXHAUSTED',
        reason: 'RETRY_ATTEMPTS_EXHAUSTED',
        retryable: true,
        shouldRetry: false,
        shouldDiscard: false,
        shouldCaptureDeadLetter: true,
        attempt,
        decidedAt: new Date().toISOString(),
      };
    }

    return {
      version: QUEUE_RETRY_POLICY_VERSION,
      action: 'RETRY',
      reason: 'RETRY_ATTEMPTS_REMAIN',
      retryable: true,
      shouldRetry: true,
      shouldDiscard: false,
      shouldCaptureDeadLetter: false,
      attempt,
      decidedAt: new Date().toISOString(),
    };
  }

  static resolveAttemptContext(
    input: Pick<
      QueueRetryPolicyInput,
      'attemptsMade' | 'attemptsStarted' | 'maxAttempts'
    >,
  ): QueueAttemptContext {
    const maxAttempts = this.normalizeInteger(input.maxAttempts, 1, 1, 20);
    const attemptsMade = this.normalizeInteger(
      input.attemptsMade,
      0,
      0,
      1_000_000,
    );
    const attemptsStarted = this.normalizeInteger(
      input.attemptsStarted,
      attemptsMade + 1,
      0,
      1_000_000,
    );
    const rawCurrentAttempt = Math.max(attemptsMade + 1, attemptsStarted, 1);
    const currentAttempt = Math.min(rawCurrentAttempt, maxAttempts);
    const attemptsRemaining = Math.max(maxAttempts - currentAttempt, 0);

    return {
      attemptsMade,
      attemptsStarted,
      currentAttempt,
      maxAttempts,
      attemptsRemaining,
      finalAttempt: currentAttempt >= maxAttempts,
    };
  }

  static getSnapshot(): QueueRetryPolicySnapshot {
    return {
      version: QUEUE_RETRY_POLICY_VERSION,
      attemptAware: true,
      nonRetryableFailuresDiscarded: true,
      deadLetterCapture: 'NON_RETRYABLE_OR_FINAL_ATTEMPT_ONLY',
      retryableFailureBehavior: 'RETHROW_WITHOUT_DLQ_UNTIL_FINAL_ATTEMPT',
      maxSupportedAttempts: 20,
      bullMqAttemptsRemainAuthoritative: true,
    };
  }

  private static normalizeInteger(
    value: number | undefined,
    fallback: number,
    min: number,
    max: number,
  ): number {
    if (value === undefined || !Number.isInteger(value)) {
      return fallback;
    }

    if (value < min || value > max) {
      return fallback;
    }

    return value;
  }
}
