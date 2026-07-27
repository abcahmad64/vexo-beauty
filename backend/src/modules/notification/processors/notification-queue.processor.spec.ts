import type { Job } from 'bullmq';

import { QUEUE_JOB_NAMES } from '../../../core/queue/constants/queue.constants';

import type {
  NotificationQueueJobData,
  QueueJobName,
  QueueJobResult,
} from '../../../core/queue/types/queue.types';

import { NotificationQueueProcessor } from './notification-queue.processor';

function createJob(input: {
  attemptsMade: number;
  attemptsStarted: number;
}): Job<NotificationQueueJobData, QueueJobResult, QueueJobName> {
  return {
    id: 'notification-job-1',
    name: QUEUE_JOB_NAMES.NOTIFICATION_DELIVERY,
    attemptsMade: input.attemptsMade,
    attemptsStarted: input.attemptsStarted,
    opts: {
      attempts: 3,
    },
    discard: jest.fn(),
    data: {
      notificationId: 'notification-1',
      channel: 'push',
      userId: 'admin-1',
      title: 'Queue alert',
      message: 'Queue failure',
      type: 'SYSTEM',
      payload: {
        outboxId: 'outbox-1',
        metadata: {
          source: 'admin.operations_queue_health',
        },
      },
      metadata: {
        createdAt: '2026-07-23T00:00:00.000Z',
        actorId: 'system:test',
        source: 'notification.delivery.outbox',
        requestId: 'outbox-1',
        correlationId: 'queue-health:ai:FAILED',
        idempotencyKey: 'notification-delivery-outbox-1',
      },
    },
  } as unknown as Job<NotificationQueueJobData, QueueJobResult, QueueJobName>;
}

describe('NotificationQueueProcessor reliable delivery', () => {
  it('marks the outbox processed only after the delivery driver succeeds', async () => {
    const deliver = jest.fn().mockResolvedValue({
      channel: 'push',
      delivered: true,
      provider: 'web-push',
      messageId: 'provider-1',
      error: null,
    });
    const markProcessed = jest.fn().mockResolvedValue(undefined);
    const markFailed = jest.fn().mockResolvedValue(undefined);
    const captureFailure = jest.fn().mockResolvedValue(undefined);
    const processor = new NotificationQueueProcessor(
      {
        sendNotification: jest.fn(),
      } as never,
      {
        deliver,
      } as never,
      {
        markProcessed,
        markFailed,
      } as never,
      {
        captureFailure,
      } as never,
    );

    const result = await processor.process(
      createJob({
        attemptsMade: 0,
        attemptsStarted: 1,
      }),
    );

    expect(result.success).toBe(true);
    expect(result.details).toMatchObject({
      notificationId: 'notification-1',
      outboxId: 'outbox-1',
      channel: 'push',
    });

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(markProcessed).toHaveBeenCalledWith(
      'outbox-1',
      'notification-job-1',
      expect.objectContaining({
        delivered: true,
      }),
    );
    expect(markFailed).not.toHaveBeenCalled();
    expect(captureFailure).not.toHaveBeenCalled();
  });

  it('keeps the outbox pending while retry attempts remain', async () => {
    const deliver = jest.fn().mockResolvedValue({
      channel: 'push',
      delivered: false,
      provider: 'web-push',
      messageId: 'notification-1',
      error: 'provider unavailable',
    });
    const markProcessed = jest.fn();
    const markFailed = jest.fn();
    const captureFailure = jest.fn().mockResolvedValue(undefined);
    const processor = new NotificationQueueProcessor(
      {
        sendNotification: jest.fn(),
      } as never,
      {
        deliver,
      } as never,
      {
        markProcessed,
        markFailed,
      } as never,
      {
        captureFailure,
      } as never,
    );

    await expect(
      processor.process(
        createJob({
          attemptsMade: 0,
          attemptsStarted: 1,
        }),
      ),
    ).rejects.toThrow('provider unavailable');

    expect(captureFailure).toHaveBeenCalledTimes(1);
    expect(markProcessed).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('marks the outbox failed only when the final retry attempt is exhausted', async () => {
    const deliver = jest.fn().mockResolvedValue({
      channel: 'push',
      delivered: false,
      provider: 'web-push',
      messageId: 'notification-1',
      error: 'provider unavailable',
    });
    const markProcessed = jest.fn();
    const markFailed = jest.fn().mockResolvedValue(undefined);
    const captureFailure = jest.fn().mockResolvedValue(undefined);
    const processor = new NotificationQueueProcessor(
      {
        sendNotification: jest.fn(),
      } as never,
      {
        deliver,
      } as never,
      {
        markProcessed,
        markFailed,
      } as never,
      {
        captureFailure,
      } as never,
    );

    await expect(
      processor.process(
        createJob({
          attemptsMade: 2,
          attemptsStarted: 3,
        }),
      ),
    ).rejects.toThrow('provider unavailable');

    expect(captureFailure).toHaveBeenCalledTimes(1);
    expect(markProcessed).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith(
      'outbox-1',
      'notification-job-1',
      'provider unavailable',
    );
  });
});
