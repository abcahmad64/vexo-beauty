import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import type { Job, Queue } from 'bullmq';

import { QUEUE_JOB_NAMES, QUEUE_NAMES } from '../constants/queue.constants';
import type {
  DeadLetterQueueJobData,
  EnqueueJobInput,
  EnqueuedJobResult,
  AiQueueJobData,
  QueueConfig,
  QueueExecutionCancellation,
  QueueJobName,
  QueueJobResult,
  VexoQueueJobData,
} from '../types/queue.types';

import { QueueConfigService } from './queue-config.service';
import type { QueueProducerService } from './queue-producer.service';
import { QueueMonitorService } from './queue-monitor.service';

type VexoBullQueue = Queue<VexoQueueJobData, QueueJobResult, QueueJobName>;

const operationalHealth: QueueConfig['operationalHealth'] = {
  backlogWarningThreshold: 25,
  backlogCriticalThreshold: 100,
  failedWarningThreshold: 10,
  failedCriticalThreshold: 50,
  delayedWarningThreshold: 25,
  delayedCriticalThreshold: 100,
  failureRateWarningPercent: 20,
  failureRateCriticalPercent: 50,
  failureRateMinSample: 20,
};

interface QueueMethodMocks {
  readonly getJobCounts: jest.Mock;
  readonly getWorkersCount: jest.Mock;
  readonly isPaused: jest.Mock;
  readonly getMetrics: jest.Mock;
  readonly getJobs: jest.Mock;
  readonly getJob: jest.Mock;
  readonly pause: jest.Mock;
  readonly resume: jest.Mock;
}

interface QueueMockBundle {
  readonly queue: VexoBullQueue;
  readonly mocks: QueueMethodMocks;
}

function createQueueMock(
  overrides: {
    counts?: Record<string, number>;
    workersCount?: number;
    queuePaused?: boolean;
    completedMetricCount?: number;
    failedMetricCount?: number;
  } = {},
): QueueMockBundle {
  const getJobCounts = jest.fn(() =>
    Promise.resolve({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      prioritized: 0,
      'waiting-children': 0,
      ...(overrides.counts ?? {}),
    }),
  );
  const getWorkersCount = jest.fn(() =>
    Promise.resolve(overrides.workersCount ?? 0),
  );
  const isPaused = jest.fn(() =>
    Promise.resolve(overrides.queuePaused ?? false),
  );
  const getMetrics = jest.fn((metric: 'completed' | 'failed') =>
    Promise.resolve({
      meta: {
        count:
          metric === 'completed'
            ? (overrides.completedMetricCount ?? 0)
            : (overrides.failedMetricCount ?? 0),
      },
      data: [],
      count: 0,
    }),
  );
  const getJobs = jest.fn();
  const getJob = jest.fn();
  const pause = jest.fn();
  const resume = jest.fn();

  const queue = {
    getJobCounts,
    getWorkersCount,
    isPaused,
    getMetrics,
    getJobs,
    getJob,
    pause,
    resume,
  } as unknown as VexoBullQueue;

  return {
    queue,
    mocks: {
      getJobCounts,
      getWorkersCount,
      isPaused,
      getMetrics,
      getJobs,
      getJob,
      pause,
      resume,
    },
  };
}

function createProducerMock() {
  let enqueueInput: EnqueueJobInput<VexoQueueJobData> | null = null;
  const enqueue = jest.fn<
    Promise<EnqueuedJobResult>,
    [EnqueueJobInput<VexoQueueJobData>]
  >((input) => {
    enqueueInput = input;

    return Promise.resolve({
      queueName: input.queueName,
      jobName: input.jobName,
      jobId: input.options?.jobId ?? 'generated-job',
      createdAt: '2026-07-23T00:00:01.000Z',
    });
  });

  return {
    service: {
      enqueue,
    } as unknown as QueueProducerService,
    enqueue,
    getInput: () => enqueueInput,
  };
}

function createDeadLetterJob(
  overrides: Partial<DeadLetterQueueJobData> = {},
): Job<VexoQueueJobData, QueueJobResult, QueueJobName> {
  const data: DeadLetterQueueJobData = {
    originalQueue: QUEUE_NAMES.AI,
    originalJobName: QUEUE_JOB_NAMES.AI_PROCESS,
    originalJobId: 'ai-original-1',
    failureReason: 'request timed out',
    failedAt: '2026-07-23T00:00:00.000Z',
    attemptsMade: 2,
    retryDecision: {
      version: '1.0.0',
      action: 'DEAD_LETTER_EXHAUSTED',
      reason: 'RETRY_ATTEMPTS_EXHAUSTED',
      retryable: true,
      shouldRetry: false,
      shouldDiscard: false,
      shouldCaptureDeadLetter: true,
      attempt: {
        attemptsMade: 2,
        attemptsStarted: 3,
        currentAttempt: 3,
        maxAttempts: 3,
        attemptsRemaining: 0,
        finalAttempt: true,
      },
      decidedAt: '2026-07-23T00:00:00.000Z',
    },
    envelope: {
      version: '1.0.0',
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_PROCESS,
      task: 'catalog.search',
      executionId: 'execution-original-1',
      correlationId: 'correlation-original-1',
      requestId: 'request-original-1',
      source: 'test',
      producer: 'test',
      enqueuedAt: '2026-07-23T00:00:00.000Z',
      idempotencyKey: 'original-idempotency',
      idempotencyMode: 'EXPLICIT',
      payloadHash: 'hash',
    },
    data: {
      task: 'catalog.search',
      payload: {
        query: 'dead-letter replay',
      },
      envelope: {
        version: '1.0.0',
        queueName: QUEUE_NAMES.AI,
        jobName: QUEUE_JOB_NAMES.AI_PROCESS,
        task: 'catalog.search',
        executionId: 'execution-original-1',
        correlationId: 'correlation-original-1',
        requestId: 'request-original-1',
        source: 'test',
        producer: 'test',
        enqueuedAt: '2026-07-23T00:00:00.000Z',
        idempotencyKey: 'original-idempotency',
        idempotencyMode: 'EXPLICIT',
        payloadHash: 'hash',
      },
      metadata: {
        createdAt: '2026-07-23T00:00:00.000Z',
        executionId: 'execution-original-1',
        correlationId: 'correlation-original-1',
        requestId: 'request-original-1',
        idempotencyKey: 'original-idempotency',
      },
    },
    metadata: {
      createdAt: '2026-07-23T00:00:00.000Z',
    },
    ...overrides,
  };

  return {
    id: 'dead-letter-source-1',
    name: QUEUE_JOB_NAMES.DEAD_LETTER_CAPTURE,
    data,
    getState: jest.fn(() => Promise.resolve('completed')),
    remove: jest.fn(),
  } as unknown as Job<VexoQueueJobData, QueueJobResult, QueueJobName>;
}

describe('QueueMonitorService', () => {
  it('rejects every public operation before touching a queue when disabled', async () => {
    const queueConfigService = {
      getConfig: jest.fn(() => ({
        enabled: false,
        operationalHealth,
      })),
    } as unknown as QueueConfigService;

    const queueMocks = Array.from({ length: 9 }, () => createQueueMock());
    const queues = queueMocks.map(({ queue }) => queue);
    const producer = createProducerMock();

    const service = new QueueMonitorService(
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
      producer.service,
    );

    const operations = [
      () => service.getStatus(),
      () => service.getJobs('notification', {}),
      () => service.getJobDetails('notification', 'job-1'),
      () => service.retryJob('notification', 'job-1'),
      () => service.replayDeadLetterJob('job-1', 'admin-1'),
      () =>
        service.cancelAiExecution('job-1', 'admin-1', undefined, () => false),
      () => service.removeJob('notification', 'job-1'),
      () => service.pauseQueue('notification'),
      () => service.resumeQueue('notification'),
    ];

    for (const operation of operations) {
      await expect(operation()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    }

    for (const {
      mocks: {
        getJobCounts,
        getWorkersCount,
        isPaused,
        getMetrics,
        getJobs,
        getJob,
        pause,
        resume,
      },
    } of queueMocks) {
      expect(getJobCounts).not.toHaveBeenCalled();
      expect(getWorkersCount).not.toHaveBeenCalled();
      expect(isPaused).not.toHaveBeenCalled();
      expect(getMetrics).not.toHaveBeenCalled();
      expect(getJobs).not.toHaveBeenCalled();
      expect(getJob).not.toHaveBeenCalled();
      expect(pause).not.toHaveBeenCalled();
      expect(resume).not.toHaveBeenCalled();
    }

    expect(producer.enqueue).not.toHaveBeenCalled();
  });

  it('aggregates BullMQ counts and returns operational degradation without worker-count alerts', async () => {
    const queueConfigService = {
      getConfig: jest.fn(() => ({
        enabled: true,
        operationalHealth,
      })),
    } as unknown as QueueConfigService;

    const queueMocks = Array.from({ length: 9 }, () => createQueueMock());

    queueMocks[5] = createQueueMock({
      counts: {
        waiting: 25,
        failed: 10,
      },
      workersCount: 0,
      completedMetricCount: 15,
      failedMetricCount: 5,
    });

    const queues = queueMocks.map(({ queue }) => queue);

    const service = new QueueMonitorService(
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
      createProducerMock().service,
    );

    const report = await service.getStatus();
    const aiQueue = report.queues.find((queue) => queue.name === 'ai');

    expect(report.version).toBe('1.0.0');
    expect(report.healthVersion).toBe('1.0.0');
    expect(report.aggregate.queueCount).toBe(9);
    expect(report.aggregate.backlog).toBe(25);
    expect(report.aggregate.failed).toBe(10);
    expect(report.aggregate.workersCount).toBe(0);
    expect(report.health.level).toBe('DEGRADED');
    expect(report.health.ready).toBe(false);
    expect(report.health.workersCountEnforced).toBe(false);
    expect(report.health.affectedQueues).toEqual(['ai']);

    expect(aiQueue).toMatchObject({
      backlog: 25,
      workersCount: 0,
      health: {
        level: 'DEGRADED',
        workersCountEnforced: false,
      },
    });

    expect(aiQueue?.health.signals.map((signal) => signal.code)).toEqual([
      'BACKLOG',
      'FAILED',
      'FAILURE_RATE',
    ]);
  });

  it('replays one settled dead-letter capture through QueueProducerService with deterministic governance metadata', async () => {
    const queueConfigService = {
      getConfig: jest.fn(() => ({
        enabled: true,
        operationalHealth,
      })),
    } as unknown as QueueConfigService;
    const queueMocks = Array.from({ length: 9 }, () => createQueueMock());
    const queues = queueMocks.map(({ queue }) => queue);
    const producer = createProducerMock();
    const sourceJob = createDeadLetterJob();
    const expectedReplayJobId = `dead-letter-replay-${createHash('sha256')
      .update('dead-letter-source-1')
      .digest('hex')
      .slice(0, 32)}`;

    queueMocks[8].mocks.getJob.mockResolvedValue(sourceJob);
    queueMocks[5].mocks.getJob.mockResolvedValue(undefined);

    const service = new QueueMonitorService(
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
      producer.service,
    );

    const result = await service.replayDeadLetterJob(
      'dead-letter-source-1',
      'admin-1',
    );

    expect(producer.enqueue).toHaveBeenCalledTimes(1);

    const enqueueInput = producer.getInput();

    expect(enqueueInput).toMatchObject({
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_PROCESS,
      options: {
        jobId: expectedReplayJobId,
        attempts: 3,
        backoffType: 'exponential',
        backoffDelayMs: 5000,
      },
      data: {
        task: 'catalog.search',
        metadata: {
          actorId: 'admin-1',
          source: 'admin.queue.dead-letter-replay',
          producer: 'queue-monitor-service',
          executionId: expectedReplayJobId,
          requestId: expectedReplayJobId,
          idempotencyKey: expectedReplayJobId,
          correlationId: 'correlation-original-1',
          parentExecutionId: 'execution-original-1',
          deadLetterReplay: {
            version: '1.0.0',
            sourceJobId: 'dead-letter-source-1',
            originalQueue: QUEUE_NAMES.AI,
            originalJobName: QUEUE_JOB_NAMES.AI_PROCESS,
            originalJobId: 'ai-original-1',
            replayedBy: 'admin-1',
          },
        },
      },
    });
    expect(enqueueInput?.data).not.toHaveProperty('envelope');
    expect(result).toMatchObject({
      version: '1.0.0',
      success: true,
      source: {
        queueName: QUEUE_NAMES.DEAD_LETTER,
        jobId: 'dead-letter-source-1',
        state: 'completed',
        retained: true,
      },
      target: {
        queueName: QUEUE_NAMES.AI,
        jobName: QUEUE_JOB_NAMES.AI_PROCESS,
        jobId: expectedReplayJobId,
        originalJobId: 'ai-original-1',
        attempts: 3,
        idempotentJobId: true,
        alreadyExisted: false,
      },
      audit: {
        actorId: 'admin-1',
        replayJobId: expectedReplayJobId,
      },
    });
  });

  it('returns the same deterministic target when the dead-letter item was already replayed', async () => {
    const queueConfigService = {
      getConfig: jest.fn(() => ({
        enabled: true,
        operationalHealth,
      })),
    } as unknown as QueueConfigService;
    const queueMocks = Array.from({ length: 9 }, () => createQueueMock());
    const queues = queueMocks.map(({ queue }) => queue);
    const producer = createProducerMock();
    const sourceJob = createDeadLetterJob();

    queueMocks[8].mocks.getJob.mockResolvedValue(sourceJob);
    queueMocks[5].mocks.getJob.mockResolvedValue({
      id: 'existing-replay',
    });

    const service = new QueueMonitorService(
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
      producer.service,
    );

    const result = await service.replayDeadLetterJob(
      'dead-letter-source-1',
      'admin-1',
    );

    expect(result.target.alreadyExisted).toBe(true);
    expect(result.message).toContain('قبلاً');
    expect(producer.enqueue).toHaveBeenCalledTimes(1);
  });

  it('rejects recursive and unsupported dead-letter replay targets', async () => {
    const queueConfigService = {
      getConfig: jest.fn(() => ({
        enabled: true,
        operationalHealth,
      })),
    } as unknown as QueueConfigService;
    const queueMocks = Array.from({ length: 9 }, () => createQueueMock());
    const queues = queueMocks.map(({ queue }) => queue);
    const producer = createProducerMock();

    const service = new QueueMonitorService(
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
      producer.service,
    );

    queueMocks[8].mocks.getJob.mockResolvedValue(
      createDeadLetterJob({
        originalQueue: QUEUE_NAMES.DEAD_LETTER,
        originalJobName: QUEUE_JOB_NAMES.DEAD_LETTER_CAPTURE,
      }),
    );

    await expect(
      service.replayDeadLetterJob('dead-letter-source-1', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    queueMocks[8].mocks.getJob.mockResolvedValue(
      createDeadLetterJob({
        originalQueue: QUEUE_NAMES.AI,
        originalJobName: QUEUE_JOB_NAMES.EMAIL_SEND,
      }),
    );

    await expect(
      service.replayDeadLetterJob('dead-letter-source-1', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(producer.enqueue).not.toHaveBeenCalled();
  });

  it('registers an idempotent active AI cancellation with lineage and dispatches one cooperative signal', async () => {
    const queueConfigService = {
      getConfig: jest.fn(() => ({
        enabled: true,
        operationalHealth,
      })),
    } as unknown as QueueConfigService;
    const queueMocks = Array.from({ length: 9 }, () => createQueueMock());
    const queues = queueMocks.map(({ queue }) => queue);
    const data: AiQueueJobData = {
      task: 'catalog.search',
      metadata: {
        createdAt: '2026-07-23T00:00:00.000Z',
        executionId: 'execution-1',
        correlationId: 'correlation-1',
        requestId: 'request-1',
      },
    };
    let storedData = data;
    let storedProgress: unknown = { percent: 25 };
    const getState = jest.fn(() => Promise.resolve('active'));
    const updateData = jest.fn((value: AiQueueJobData) => {
      storedData = value;
      return Promise.resolve();
    });
    const updateProgress = jest.fn((value: unknown) => {
      storedProgress = value;
      return Promise.resolve();
    });
    const job = {
      id: 'ai-job-1',
      name: QUEUE_JOB_NAMES.AI_PROCESS,
      data: storedData,
      progress: storedProgress,
      getState,
      updateData,
      updateProgress,
    } as unknown as Job<VexoQueueJobData, QueueJobResult, QueueJobName>;

    Object.defineProperties(job, {
      data: {
        get: () => storedData,
      },
      progress: {
        get: () => storedProgress,
      },
    });

    queueMocks[5].mocks.getJob.mockResolvedValue(job);
    let dispatchedCancellation: QueueExecutionCancellation | null = null;
    const cancelActiveJob = jest.fn(
      (_jobId: string, cancellation: QueueExecutionCancellation) => {
        dispatchedCancellation = cancellation;
        return true;
      },
    );
    const service = new QueueMonitorService(
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
      createProducerMock().service,
    );

    const first = await service.cancelAiExecution(
      'ai-job-1',
      'admin-1',
      ' توقف امن ',
      cancelActiveJob,
    );
    const second = await service.cancelAiExecution(
      'ai-job-1',
      'admin-2',
      'ignored duplicate reason',
      cancelActiveJob,
    );

    expect(first).toMatchObject({
      version: '1.0.0',
      success: true,
      queueName: QUEUE_NAMES.AI,
      jobId: 'ai-job-1',
      stateAtRequest: 'active',
      idempotent: false,
      activeSignalDispatched: true,
      evidenceRetained: true,
      cancellation: {
        status: 'REQUESTED',
        requestedBy: 'admin-1',
        reason: 'توقف امن',
        executionId: 'execution-1',
        correlationId: 'correlation-1',
        requestId: 'request-1',
        activeSignalDispatched: true,
      },
    });
    expect(second.idempotent).toBe(true);
    expect(second.cancellation.cancellationId).toBe(
      first.cancellation.cancellationId,
    );
    expect(cancelActiveJob).toHaveBeenCalledTimes(2);
    expect(dispatchedCancellation).toMatchObject({
      requestedBy: 'admin-1',
    });
    expect(updateData).toHaveBeenCalled();
    expect(updateProgress).toHaveBeenCalled();
    expect(storedProgress).toMatchObject({
      percent: 25,
      cancellation: {
        cancellationId: first.cancellation.cancellationId,
      },
    });
  });

  it('records completion-versus-cancellation races as superseded instead of retrying or deleting evidence', async () => {
    const queueConfigService = {
      getConfig: jest.fn(() => ({
        enabled: true,
        operationalHealth,
      })),
    } as unknown as QueueConfigService;
    const queueMocks = Array.from({ length: 9 }, () => createQueueMock());
    const queues = queueMocks.map(({ queue }) => queue);
    const data: AiQueueJobData = {
      task: 'catalog.search',
      metadata: {
        createdAt: '2026-07-23T00:00:00.000Z',
      },
    };
    let stateIndex = 0;
    const states = ['active', 'completed'];
    const getState = jest.fn(() =>
      Promise.resolve(states[stateIndex++] ?? 'completed'),
    );
    const updateData = jest.fn(() => Promise.resolve());
    const updateProgress = jest.fn(() => Promise.resolve());
    const remove = jest.fn();
    const retry = jest.fn();
    const job = {
      id: 'ai-job-race',
      name: QUEUE_JOB_NAMES.AI_PROCESS,
      data,
      progress: 0,
      getState,
      updateData,
      updateProgress,
      remove,
      retry,
    } as unknown as Job<VexoQueueJobData, QueueJobResult, QueueJobName>;

    queueMocks[5].mocks.getJob.mockResolvedValue(job);
    const cancelActiveJob = jest.fn(() => true);
    const service = new QueueMonitorService(
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
      createProducerMock().service,
    );

    const result = await service.cancelAiExecution(
      'ai-job-race',
      'admin-1',
      undefined,
      cancelActiveJob,
    );

    expect(result).toMatchObject({
      stateAtRequest: 'active',
      stateAfterRequest: 'completed',
      activeSignalDispatched: false,
      evidenceRetained: true,
      cancellation: {
        status: 'SUPERSEDED',
        outcome: 'COMPLETED_BEFORE_CANCELLATION',
      },
    });
    expect(cancelActiveJob).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });
});
