import type { Job } from 'bullmq';

import {
  QUEUE_JOB_NAMES,
  QUEUE_NAMES,
} from '../../../core/queue/constants/queue.constants';

import type {
  AiQueueJobData,
  QueueFailureInput,
  QueueJobName,
  QueueJobResult,
} from '../../../core/queue/types/queue.types';

import type { QueueDeadLetterService } from '../../../core/queue/services/queue-dead-letter.service';
import type { QueueProducerService } from '../../../core/queue/services/queue-producer.service';

import { QueueExecutionEnvelopeUtil } from '../../../core/queue/utils/queue-execution-envelope.util';

import { AiBudgetEnforcementException } from '../errors/ai-budget-enforcement.exception';

import type { AiBudgetEnforcementService } from '../services/ai-budget-enforcement.service';
import type { AiContextService } from '../services/ai-context.service';
import type { CatalogResearchBootstrapService } from '../services/catalog-research-bootstrap.service';
import type { CatalogWebResearchService } from '../services/catalog-web-research.service';

import { AiQueueProcessor } from './ai-queue.processor';

interface CreateJobOptions {
  readonly attemptsMade?: number;
  readonly attemptsStarted?: number;
  readonly attempts?: number;
}

interface CreatedJob {
  readonly job: Job<AiQueueJobData, QueueJobResult, QueueJobName>;
  readonly discard: jest.Mock<void, []>;
  readonly updateData: jest.Mock;
  readonly updateProgress: jest.Mock;
}

function createPreparedJobData(): AiQueueJobData {
  return QueueExecutionEnvelopeUtil.prepareAiJob({
    queueName: QUEUE_NAMES.AI,
    jobName: QUEUE_JOB_NAMES.AI_PROCESS,
    data: {
      task: 'catalog.search',
      payload: {
        query: 'کرم آبرسان',
      },
      metadata: {
        createdAt: '2026-07-22T20:00:00.000Z',
        executionId: 'execution-queue-1',
        correlationId: 'correlation-queue-1',
        requestId: 'request-queue-1',
        source: 'ai-orchestrator',
        executionContextVersion: '1.0.0',
        agentId: 'semantic-retrieval',
        agentVersion: '1.0.0',
        agentTaskType: 'EMBEDDING',
        agentExecutionMode: 'READ_ONLY',
        agentCapabilities: ['SEMANTIC_EMBEDDING'],
        agentSupportsHumanHandoff: false,
        agentModelRequirements: {
          provider: 'ollama',
          requiresEmbedding: true,
          requiresVision: false,
        },
      },
    },
    options: {
      jobId: 'ai-job-1',
      attempts: 3,
    },
  }).data;
}

function createJob(
  data: AiQueueJobData,
  options: CreateJobOptions = {},
): CreatedJob {
  const discard = jest.fn<void, []>();
  let storedData = data;
  let storedProgress: unknown = 0;
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
    attemptsMade: options.attemptsMade ?? 0,
    attemptsStarted: options.attemptsStarted ?? 1,
    opts: {
      attempts: options.attempts ?? 3,
    },
    discard,
    updateData,
    updateProgress,
  } as unknown as Job<AiQueueJobData, QueueJobResult, QueueJobName>;

  Object.defineProperties(job, {
    data: {
      get: () => storedData,
    },
    progress: {
      get: () => storedProgress,
    },
  });

  return {
    discard,
    updateData,
    updateProgress,
    job,
  };
}

function createBudgetEnforcementMock() {
  return {
    preflightQueue: jest
      .fn<Promise<'NO_POLICY'>, [unknown]>()
      .mockResolvedValue('NO_POLICY'),
  };
}

function createCaptureFailureMock() {
  return jest
    .fn<Promise<void>, [QueueFailureInput]>()
    .mockResolvedValue(undefined);
}

function createTimeoutError(): Error & { readonly code: string } {
  return Object.assign(new Error('request timed out'), {
    code: 'ETIMEDOUT',
  });
}

describe('AiQueueProcessor retry and execution governance', () => {
  it('validates the envelope before executing an AI queue task', async () => {
    const searchCatalog = jest.fn(() =>
      Promise.resolve({
        total: 0,
        products: [],
      }),
    );
    const captureFailure = createCaptureFailureMock();
    const created = createJob(createPreparedJobData());

    const processor = new AiQueueProcessor(
      {
        searchCatalog,
      } as unknown as AiContextService,
      createBudgetEnforcementMock() as unknown as AiBudgetEnforcementService,
      {} as unknown as CatalogResearchBootstrapService,
      {} as unknown as CatalogWebResearchService,
      {} as unknown as QueueProducerService,
      {
        captureFailure,
      } as unknown as QueueDeadLetterService,
    );

    const result = await processor.process(created.job);

    expect(result.success).toBe(true);
    expect(searchCatalog).toHaveBeenCalledWith({
      query: 'کرم آبرسان',
      productIds: [],
      categoryId: undefined,
      brandId: undefined,
      budgetMin: undefined,
      budgetMax: undefined,
      limit: undefined,
    });
    expect(result.details).toMatchObject({
      task: 'catalog.search',
      queueExecution: {
        version: '1.0.0',
        executionId: 'execution-queue-1',
        correlationId: 'correlation-queue-1',
        requestId: 'request-queue-1',
        idempotencyKey: 'ai-job-1',
        idempotencyMode: 'JOB_ID',
        executionContextVersion: '1.0.0',
        agentId: 'semantic-retrieval',
        agentVersion: '1.0.0',
        agentTaskType: 'EMBEDDING',
        agentExecutionMode: 'READ_ONLY',
      },
    });
    expect(created.discard).not.toHaveBeenCalled();
    expect(captureFailure).not.toHaveBeenCalled();
  });

  it('discards non-retryable failures and captures DLQ immediately', async () => {
    const captureFailure = createCaptureFailureMock();
    const prepared = createPreparedJobData();
    const tampered: AiQueueJobData = {
      ...prepared,
      payload: {
        query: 'payload changed after enqueue',
      },
    };
    const created = createJob(tampered, {
      attemptsMade: 0,
      attemptsStarted: 1,
      attempts: 3,
    });

    const processor = new AiQueueProcessor(
      {} as unknown as AiContextService,
      createBudgetEnforcementMock() as unknown as AiBudgetEnforcementService,
      {} as unknown as CatalogResearchBootstrapService,
      {} as unknown as CatalogWebResearchService,
      {} as unknown as QueueProducerService,
      {
        captureFailure,
      } as unknown as QueueDeadLetterService,
    );

    await expect(processor.process(created.job)).rejects.toThrow(
      'AI queue payload integrity hash does not match the envelope.',
    );

    expect(created.discard).toHaveBeenCalledTimes(1);
    expect(captureFailure).toHaveBeenCalledTimes(1);
    expect(captureFailure.mock.calls[0][0]).toMatchObject({
      failure: {
        category: 'VALIDATION',
        retryable: false,
      },
      retryDecision: {
        version: '1.0.0',
        action: 'DEAD_LETTER_NON_RETRYABLE',
        reason: 'NON_RETRYABLE_FAILURE',
        shouldRetry: false,
        shouldDiscard: true,
        shouldCaptureDeadLetter: true,
        attempt: {
          currentAttempt: 1,
          maxAttempts: 3,
          attemptsRemaining: 2,
          finalAttempt: false,
        },
      },
    });
  });

  it('rethrows retryable failures without DLQ while attempts remain', async () => {
    const timeoutError = createTimeoutError();
    const searchCatalog = jest.fn(() => Promise.reject(timeoutError));
    const captureFailure = createCaptureFailureMock();
    const created = createJob(createPreparedJobData(), {
      attemptsMade: 0,
      attemptsStarted: 1,
      attempts: 3,
    });

    const processor = new AiQueueProcessor(
      {
        searchCatalog,
      } as unknown as AiContextService,
      createBudgetEnforcementMock() as unknown as AiBudgetEnforcementService,
      {} as unknown as CatalogResearchBootstrapService,
      {} as unknown as CatalogWebResearchService,
      {} as unknown as QueueProducerService,
      {
        captureFailure,
      } as unknown as QueueDeadLetterService,
    );

    await expect(processor.process(created.job)).rejects.toBe(timeoutError);

    expect(created.discard).not.toHaveBeenCalled();
    expect(captureFailure).not.toHaveBeenCalled();
  });

  it('captures retryable failures only after attempts are exhausted', async () => {
    const timeoutError = createTimeoutError();
    const searchCatalog = jest.fn(() => Promise.reject(timeoutError));
    const captureFailure = createCaptureFailureMock();
    const created = createJob(createPreparedJobData(), {
      attemptsMade: 2,
      attemptsStarted: 3,
      attempts: 3,
    });

    const processor = new AiQueueProcessor(
      {
        searchCatalog,
      } as unknown as AiContextService,
      createBudgetEnforcementMock() as unknown as AiBudgetEnforcementService,
      {} as unknown as CatalogResearchBootstrapService,
      {} as unknown as CatalogWebResearchService,
      {} as unknown as QueueProducerService,
      {
        captureFailure,
      } as unknown as QueueDeadLetterService,
    );

    await expect(processor.process(created.job)).rejects.toBe(timeoutError);

    expect(created.discard).not.toHaveBeenCalled();
    expect(captureFailure).toHaveBeenCalledTimes(1);
    expect(captureFailure.mock.calls[0][0]).toMatchObject({
      failure: {
        category: 'TIMEOUT',
        code: 'ETIMEDOUT',
        retryable: true,
      },
      retryDecision: {
        action: 'DEAD_LETTER_EXHAUSTED',
        reason: 'RETRY_ATTEMPTS_EXHAUSTED',
        shouldRetry: false,
        shouldDiscard: false,
        shouldCaptureDeadLetter: true,
        attempt: {
          currentAttempt: 3,
          maxAttempts: 3,
          attemptsRemaining: 0,
          finalAttempt: true,
        },
      },
    });
  });

  it('terminates a budget block without retry or dead-letter capture', async () => {
    const searchCatalog = jest.fn();
    const captureFailure = createCaptureFailureMock();
    const preflightQueue = jest
      .fn()
      .mockRejectedValue(
        new AiBudgetEnforcementException(
          'HARD_LIMIT_EXCEEDED',
          'Hard budget limit reached.',
        ),
      );
    const created = createJob(createPreparedJobData());
    const processor = new AiQueueProcessor(
      { searchCatalog } as unknown as AiContextService,
      { preflightQueue } as unknown as AiBudgetEnforcementService,
      {} as unknown as CatalogResearchBootstrapService,
      {} as unknown as CatalogWebResearchService,
      {} as unknown as QueueProducerService,
      { captureFailure } as unknown as QueueDeadLetterService,
    );

    const result = await processor.process(created.job);

    expect(result).toMatchObject({
      success: false,
      details: {
        budgetBlocked: true,
        reason: 'HARD_LIMIT_EXCEEDED',
        retryScheduled: false,
        deadLetterCaptured: false,
      },
    });
    expect(created.discard).toHaveBeenCalledTimes(1);
    expect(searchCatalog).not.toHaveBeenCalled();
    expect(captureFailure).not.toHaveBeenCalled();
  });

  it('completes a queued cancellation as terminal without retry or dead-letter capture', async () => {
    const prepared = createPreparedJobData();
    const cancellation = {
      version: '1.0.0' as const,
      status: 'REQUESTED' as const,
      queueName: QUEUE_NAMES.AI,
      jobId: 'ai-job-1',
      cancellationId: 'ai-cancel-1',
      requestedAt: '2026-07-23T00:01:00.000Z',
      requestedBy: 'admin-1',
      reason: 'توقف تست',
      source: 'admin.queue.ai-execution-cancellation' as const,
      stateAtRequest: 'waiting',
      activeSignalDispatched: false,
      executionId: 'execution-queue-1',
      correlationId: 'correlation-queue-1',
      requestId: 'request-queue-1',
    };
    const created = createJob({
      ...prepared,
      metadata: {
        ...prepared.metadata,
        cancellation,
      },
    });
    const searchCatalog = jest.fn();
    const captureFailure = createCaptureFailureMock();
    const processor = new AiQueueProcessor(
      { searchCatalog } as unknown as AiContextService,
      createBudgetEnforcementMock() as unknown as AiBudgetEnforcementService,
      {} as unknown as CatalogResearchBootstrapService,
      {} as unknown as CatalogWebResearchService,
      {} as unknown as QueueProducerService,
      { captureFailure } as unknown as QueueDeadLetterService,
    );

    const result = await processor.process(created.job);

    expect(result).toMatchObject({
      success: false,
      details: {
        cancelled: true,
        retryScheduled: false,
        deadLetterCaptured: false,
        cancellation: {
          status: 'CANCELLED',
          outcome: 'CANCELLED_BEFORE_START',
        },
      },
    });
    expect(created.discard).toHaveBeenCalledTimes(1);
    expect(created.updateData).toHaveBeenCalledTimes(1);
    expect(created.updateProgress).toHaveBeenCalledTimes(1);
    expect(searchCatalog).not.toHaveBeenCalled();
    expect(captureFailure).not.toHaveBeenCalled();
  });

  it('propagates BullMQ cooperative cancellation to catalog research and suppresses retry and dead-letter', async () => {
    const prepared = QueueExecutionEnvelopeUtil.prepareAiJob({
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_PROCESS,
      data: {
        task: 'catalog.research.web',
        payload: {
          researchRunId: 'run-1',
          productId: 'product-1',
        },
        metadata: {
          createdAt: '2026-07-23T00:00:00.000Z',
          executionId: 'execution-queue-1',
          correlationId: 'correlation-queue-1',
          requestId: 'request-queue-1',
          source: 'ai-orchestrator',
        },
      },
      options: {
        jobId: 'ai-job-1',
        attempts: 3,
      },
    }).data;
    const created = createJob(prepared);
    const controller = new AbortController();
    const cancellation = {
      version: '1.0.0' as const,
      status: 'REQUESTED' as const,
      queueName: QUEUE_NAMES.AI,
      jobId: 'ai-job-1',
      cancellationId: 'ai-cancel-active',
      requestedAt: '2026-07-23T00:01:00.000Z',
      requestedBy: 'admin-1',
      reason: 'توقف اجرای فعال',
      source: 'admin.queue.ai-execution-cancellation' as const,
      stateAtRequest: 'active',
      activeSignalDispatched: true,
      executionId: 'execution-queue-1',
      correlationId: 'correlation-queue-1',
      requestId: 'request-queue-1',
    };
    let receivedSignal: AbortSignal | undefined;
    const research = jest.fn(
      (_payload: unknown, options?: { signal?: AbortSignal }) => {
        receivedSignal = options?.signal;
        return new Promise<Record<string, unknown>>((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () =>
              reject(
                new Error(
                  String(
                    options.signal?.reason ??
                      'AI execution cancellation signal received.',
                  ),
                ),
              ),
            { once: true },
          );
        });
      },
    );
    const captureFailure = createCaptureFailureMock();
    const processor = new AiQueueProcessor(
      {} as unknown as AiContextService,
      createBudgetEnforcementMock() as unknown as AiBudgetEnforcementService,
      {} as unknown as CatalogResearchBootstrapService,
      { research } as unknown as CatalogWebResearchService,
      {} as unknown as QueueProducerService,
      { captureFailure } as unknown as QueueDeadLetterService,
    );
    const request = processor.process(
      created.job,
      undefined,
      controller.signal,
    );

    await Promise.resolve();

    controller.abort(
      JSON.stringify({
        kind: 'VEXO_QUEUE_EXECUTION_CANCELLATION',
        cancellation,
      }),
    );

    const result = await request;

    expect(receivedSignal).toBe(controller.signal);
    expect(result).toMatchObject({
      success: false,
      details: {
        cancelled: true,
        retryScheduled: false,
        deadLetterCaptured: false,
        cancellation: {
          status: 'CANCELLED',
          outcome: 'CANCELLED_DURING_EXECUTION',
        },
      },
    });
    expect(created.discard).toHaveBeenCalledTimes(1);
    expect(captureFailure).not.toHaveBeenCalled();
  });
});
