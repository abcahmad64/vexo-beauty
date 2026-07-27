import { ServiceUnavailableException } from '@nestjs/common';
import type { JobsOptions, Queue } from 'bullmq';

import { QUEUE_JOB_NAMES, QUEUE_NAMES } from '../constants/queue.constants';
import type {
  AiQueueJobData,
  NotificationQueueJobData,
  QueueJobName,
  QueueJobResult,
  VexoQueueJobData,
} from '../types/queue.types';

import { QueueConfigService } from './queue-config.service';
import { QueueProducerService } from './queue-producer.service';

type VexoBullQueue = Queue<VexoQueueJobData, QueueJobResult, QueueJobName>;

type QueueAddMock = jest.Mock<
  Promise<{ readonly id: string }>,
  [QueueJobName, VexoQueueJobData, JobsOptions?]
>;

interface QueueMock {
  readonly queue: VexoBullQueue;
  readonly add: QueueAddMock;
}

function createQueueMock(): QueueMock {
  const add = jest.fn<
    Promise<{ readonly id: string }>,
    [QueueJobName, VexoQueueJobData, JobsOptions?]
  >();

  return {
    add,
    queue: {
      add,
    } as unknown as VexoBullQueue,
  };
}

describe('QueueProducerService disabled contract', () => {
  it('rejects before invoking Queue.add()', async () => {
    const queueConfigService = {
      getConfig: jest.fn(() => ({
        enabled: false,
      })),
    } as unknown as QueueConfigService;

    const queueMocks = Array.from({ length: 9 }, () => createQueueMock());
    const queues = queueMocks.map(({ queue }) => queue);

    const service = new QueueProducerService(
      queueConfigService,
      queues[0],
      queues[1],
      queues[2],
      queues[3],
      queues[4],
      queues[5],
      queues[6],
      queues[7],
      queues[8],
    );

    const data: NotificationQueueJobData = {
      title: 'Test',
      message: 'Test',
      type: 'test',
      metadata: {
        createdAt: new Date().toISOString(),
      },
    };

    await expect(
      service.enqueue({
        queueName: QUEUE_NAMES.NOTIFICATION,
        jobName: QUEUE_JOB_NAMES.NOTIFICATION_DATABASE,
        data,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    for (const { add } of queueMocks) {
      expect(add).not.toHaveBeenCalled();
    }
  });
});

describe('QueueProducerService AI execution envelope', () => {
  it('enriches AI jobs before Queue.add() while preserving BullMQ job id', async () => {
    const add = jest
      .fn<
        Promise<{ readonly id: string }>,
        [QueueJobName, VexoQueueJobData, JobsOptions?]
      >()
      .mockResolvedValue({
        id: 'ai-job-1',
      });

    const queueConfigService = {
      getConfig: jest.fn(() => ({
        enabled: true,
        redisRequired: true,
        prefix: 'vexo:queue',
        defaultAttempts: 3,
        defaultBackoffDelayMs: 5_000,
        defaultTimeoutMs: 60_000,
        removeOnCompleteCount: 1_000,
        removeOnFailCount: 5_000,
        workerConcurrency: 5,
        stalledIntervalMs: 30_000,
        maxStalledCount: 1,
      })),
    } as unknown as QueueConfigService;

    const queues = Array.from({ length: 9 }, () => createQueueMock().queue);
    queues[5] = {
      add,
    } as unknown as VexoBullQueue;

    const service = new QueueProducerService(
      queueConfigService,
      queues[0],
      queues[1],
      queues[2],
      queues[3],
      queues[4],
      queues[5],
      queues[6],
      queues[7],
      queues[8],
    );

    const data: AiQueueJobData = {
      task: 'catalog.search',
      payload: {
        query: 'شامپو بدون سولفات',
      },
      metadata: {
        createdAt: '2026-07-22T20:00:00.000Z',
        correlationId: 'correlation-queue-producer',
        requestId: 'request-queue-producer',
        source: 'test-producer',
      },
    };

    const result = await service.enqueue({
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_PROCESS,
      data,
      options: {
        jobId: 'ai-job-1',
        attempts: 4,
      },
    });

    expect(result).toMatchObject({
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_PROCESS,
      jobId: 'ai-job-1',
    });
    expect(add).toHaveBeenCalledTimes(1);

    const [jobName, queuedData, options] = add.mock.calls[0];

    expect(jobName).toBe(QUEUE_JOB_NAMES.AI_PROCESS);
    expect(options).toMatchObject({
      jobId: 'ai-job-1',
      attempts: 4,
    });

    expect(queuedData).toHaveProperty('task', 'catalog.search');
    expect(queuedData).toHaveProperty('metadata.queueEnvelopeVersion', '1.0.0');
    expect(queuedData).toHaveProperty('metadata.idempotencyKey', 'ai-job-1');

    if (!('envelope' in queuedData) || !queuedData.envelope) {
      throw new Error('AI queue envelope was not attached by the producer.');
    }

    const envelope = queuedData.envelope;

    expect(envelope).toMatchObject({
      version: '1.0.0',
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_PROCESS,
      task: 'catalog.search',
      correlationId: 'correlation-queue-producer',
      requestId: 'request-queue-producer',
      source: 'test-producer',
      producer: 'test-producer',
      idempotencyKey: 'ai-job-1',
      idempotencyMode: 'JOB_ID',
    });
    expect(envelope.executionId).toEqual(expect.any(String));
    expect(envelope.enqueuedAt).toEqual(expect.any(String));
    expect(envelope.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
