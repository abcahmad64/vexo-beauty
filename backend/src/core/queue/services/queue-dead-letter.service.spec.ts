import type {
  DeadLetterQueueJobData,
  EnqueuedJobResult,
  QueueFailureInput,
} from '../types/queue.types';

import type { QueueProducerService } from './queue-producer.service';
import { QueueDeadLetterService } from './queue-dead-letter.service';

function createFailureInput(
  shouldCaptureDeadLetter: boolean,
): QueueFailureInput {
  return {
    queueName: 'ai',
    jobName: 'ai.process',
    jobId: 'job-1',
    attemptsMade: shouldCaptureDeadLetter ? 2 : 0,
    failureReason: 'request timed out',
    failure: {
      version: '1.0.0',
      category: 'TIMEOUT',
      code: 'ETIMEDOUT',
      retryable: true,
      severity: 'WARNING',
      message: 'request timed out',
      classifiedAt: '2026-07-23T00:00:00.000Z',
    },
    retryDecision: {
      version: '1.0.0',
      action: shouldCaptureDeadLetter ? 'DEAD_LETTER_EXHAUSTED' : 'RETRY',
      reason: shouldCaptureDeadLetter
        ? 'RETRY_ATTEMPTS_EXHAUSTED'
        : 'RETRY_ATTEMPTS_REMAIN',
      retryable: true,
      shouldRetry: !shouldCaptureDeadLetter,
      shouldDiscard: false,
      shouldCaptureDeadLetter,
      attempt: {
        attemptsMade: shouldCaptureDeadLetter ? 2 : 0,
        attemptsStarted: shouldCaptureDeadLetter ? 3 : 1,
        currentAttempt: shouldCaptureDeadLetter ? 3 : 1,
        maxAttempts: 3,
        attemptsRemaining: shouldCaptureDeadLetter ? 0 : 2,
        finalAttempt: shouldCaptureDeadLetter,
      },
      decidedAt: '2026-07-23T00:00:00.000Z',
    },
    data: {
      metadata: {
        createdAt: '2026-07-23T00:00:00.000Z',
      },
    },
  };
}

describe('QueueDeadLetterService retry policy', () => {
  it('does not create a DLQ item while retry attempts remain', async () => {
    const enqueueDeadLetterCapture = jest.fn<
      Promise<EnqueuedJobResult>,
      [DeadLetterQueueJobData]
    >(() =>
      Promise.resolve({
        queueName: 'dead-letter',
        jobName: 'dead-letter.capture',
        jobId: 'dead-letter-skipped',
        createdAt: '2026-07-23T00:00:00.000Z',
      }),
    );
    const service = new QueueDeadLetterService({
      enqueueDeadLetterCapture,
    } as unknown as QueueProducerService);

    await service.captureFailure(createFailureInput(false));

    expect(enqueueDeadLetterCapture).not.toHaveBeenCalled();
  });

  it('propagates the final retry decision into DLQ', async () => {
    const enqueueDeadLetterCapture = jest.fn<
      Promise<EnqueuedJobResult>,
      [DeadLetterQueueJobData]
    >(() =>
      Promise.resolve({
        queueName: 'dead-letter',
        jobName: 'dead-letter.capture',
        jobId: 'dead-letter-1',
        createdAt: '2026-07-23T00:00:00.000Z',
      }),
    );
    const service = new QueueDeadLetterService({
      enqueueDeadLetterCapture,
    } as unknown as QueueProducerService);
    const input = createFailureInput(true);

    await service.captureFailure(input);

    expect(enqueueDeadLetterCapture).toHaveBeenCalledTimes(1);
    expect(enqueueDeadLetterCapture.mock.calls[0][0]).toMatchObject({
      originalQueue: 'ai',
      originalJobName: 'ai.process',
      originalJobId: 'job-1',
      failure: input.failure,
      retryDecision: input.retryDecision,
      attemptsMade: 2,
    });
  });
});
