import { NotificationDeliveryChannel } from '../delivery/notification-delivery.channel';

import { NotificationDeliveryOutboxService } from './notification-delivery-outbox.service';

const VALID_PAYLOAD = {
  version: '1.0.0',
  notificationId: 'notification-1',
  userId: 'admin-1',
  title: 'Queue alert',
  message: 'Queue backlog warning',
  type: 'SYSTEM',
  channel: NotificationDeliveryChannel.PUSH,
  actionUrl: '/admin/queues',
  metadata: {
    lifecycleKey: 'queue-health:ai:BACKLOG',
  },
  actorId: 'system:test',
  requestedAt: '2026-07-23T00:00:00.000Z',
  lifecycleKey: 'queue-health:ai:BACKLOG',
  deliveryVersion: 1,
  transition: 'ACTIVATED',
};

describe('NotificationDeliveryOutboxService', () => {
  it('enqueues a deterministic BullMQ delivery job and keeps the outbox pending', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        id: 'outbox-1',
        aggregateId: 'aggregate-1',
        payload: VALID_PAYLOAD,
        createdAt: new Date('2026-07-23T00:00:00.000Z'),
      },
    ]);
    const executeRaw = jest.fn().mockResolvedValue(1);
    let enqueueInput: unknown = null;
    const enqueue = jest.fn((input: unknown) => {
      enqueueInput = input;

      return Promise.resolve({
        queueName: 'notification',
        jobName: 'notification.delivery',
        jobId: 'notification-delivery-outbox-1',
        createdAt: '2026-07-23T00:00:01.000Z',
      });
    });
    const service = new NotificationDeliveryOutboxService(
      {
        $queryRaw: queryRaw,
        $executeRaw: executeRaw,
      } as never,
      {
        enqueue,
      } as never,
    );

    await expect(service.dispatchPending()).resolves.toMatchObject({
      pendingCount: 1,
      enqueuedCount: 1,
      malformedCount: 0,
      failedToEnqueueCount: 0,
    });

    expect(enqueue).toHaveBeenCalledTimes(1);

    expect(enqueueInput).toMatchObject({
      queueName: 'notification',
      jobName: 'notification.delivery',
      options: {
        jobId: 'notification-delivery-outbox-1',
        attempts: 5,
        backoffType: 'exponential',
      },
      data: {
        notificationId: 'notification-1',
        channel: 'push',
        userId: 'admin-1',
        metadata: {
          idempotencyKey: 'notification-delivery-outbox-1',
        },
      },
    });
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('marks malformed payloads failed without enqueueing a job', async () => {
    const queryRaw = jest.fn().mockResolvedValue([
      {
        id: 'outbox-invalid',
        aggregateId: 'aggregate-invalid',
        payload: {
          version: '0.0.0',
        },
        createdAt: new Date('2026-07-23T00:00:00.000Z'),
      },
    ]);
    const executeRaw = jest.fn().mockResolvedValue(1);
    const enqueue = jest.fn();
    const service = new NotificationDeliveryOutboxService(
      {
        $queryRaw: queryRaw,
        $executeRaw: executeRaw,
      } as never,
      {
        enqueue,
      } as never,
    );

    await expect(service.dispatchPending()).resolves.toMatchObject({
      pendingCount: 1,
      enqueuedCount: 0,
      malformedCount: 1,
    });

    expect(enqueue).not.toHaveBeenCalled();
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('records terminal delivery state through explicit processed and failed methods', async () => {
    const executeRaw = jest.fn().mockResolvedValue(1);
    const service = new NotificationDeliveryOutboxService(
      {
        $queryRaw: jest.fn(),
        $executeRaw: executeRaw,
      } as never,
      {
        enqueue: jest.fn(),
      } as never,
    );

    await service.markProcessed('outbox-1', 'job-1', {
      delivered: true,
      provider: 'web-push',
      messageId: 'provider-1',
      error: null,
    });
    await service.markFailed('outbox-2', 'job-2', 'provider unavailable');

    expect(executeRaw).toHaveBeenCalledTimes(2);
    expect(service.getSnapshot()).toEqual({
      version: '1.0.0',
      outboxType: 'notification.delivery.requested',
      deterministicJobId: true,
      queueAttempts: 5,
      queueBackoff: 'EXPONENTIAL',
      marksProcessedOnlyAfterDelivery: true,
      marksFailedOnlyAfterTerminalFailure: true,
      payloadValidation: true,
    });
  });
});
