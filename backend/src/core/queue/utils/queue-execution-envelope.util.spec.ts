import { BadRequestException } from '@nestjs/common';

import { QUEUE_JOB_NAMES, QUEUE_NAMES } from '../constants/queue.constants';

import type { AiQueueJobData, EnqueueJobInput } from '../types/queue.types';

import { QueueExecutionEnvelopeUtil } from './queue-execution-envelope.util';

function createInput(
  overrides?: Partial<EnqueueJobInput<AiQueueJobData>>,
): EnqueueJobInput<AiQueueJobData> {
  return {
    queueName: QUEUE_NAMES.AI,
    jobName: QUEUE_JOB_NAMES.AI_PROCESS,
    data: {
      task: 'catalog.search',
      payload: {
        query: 'ضد آفتاب',
      },
      metadata: {
        createdAt: '2026-07-22T20:00:00.000Z',
        executionId: 'execution-parent',
        correlationId: 'correlation-1',
        requestId: 'request-1',
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
      jobId: 'catalog-search-job-1',
      attempts: 3,
    },
    ...overrides,
  };
}

describe('QueueExecutionEnvelopeUtil', () => {
  it('bridges execution context into a versioned AI queue envelope', () => {
    const prepared = QueueExecutionEnvelopeUtil.prepareAiJob(createInput());

    const envelope = prepared.data.envelope;

    expect(envelope).toBeDefined();
    expect(envelope).toMatchObject({
      version: '1.0.0',
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_PROCESS,
      task: 'catalog.search',
      executionId: 'execution-parent',
      correlationId: 'correlation-1',
      requestId: 'request-1',
      source: 'ai-orchestrator',
      producer: 'ai-orchestrator',
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
      idempotencyKey: 'catalog-search-job-1',
      idempotencyMode: 'JOB_ID',
    });

    expect(envelope?.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(prepared.data.metadata).toMatchObject({
      executionId: 'execution-parent',
      correlationId: 'correlation-1',
      requestId: 'request-1',
      queueEnvelopeVersion: '1.0.0',
      idempotencyKey: 'catalog-search-job-1',
    });

    expect(
      QueueExecutionEnvelopeUtil.assertAiJob(prepared.data, {
        queueName: QUEUE_NAMES.AI,
        jobName: QUEUE_JOB_NAMES.AI_PROCESS,
        jobId: 'catalog-search-job-1',
      }),
    ).toEqual(envelope);
  });

  it('uses an explicit idempotency key without replacing BullMQ job id', () => {
    const base = createInput();
    const prepared = QueueExecutionEnvelopeUtil.prepareAiJob({
      ...base,
      data: {
        ...base.data,
        metadata: {
          ...base.data.metadata,
          idempotencyKey: 'explicit-idempotency-key',
        },
      },
    });

    expect(prepared.options?.jobId).toBe('catalog-search-job-1');
    expect(prepared.data.envelope).toMatchObject({
      idempotencyKey: 'explicit-idempotency-key',
      idempotencyMode: 'EXPLICIT',
    });
  });

  it('generates isolated execution context when no ids are supplied', () => {
    const prepared = QueueExecutionEnvelopeUtil.prepareAiJob({
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_PROCESS,
      data: {
        task: 'product.snapshot',
        payload: {
          productId: 'product-1',
        },
        metadata: {
          createdAt: '2026-07-22T20:00:00.000Z',
        },
      },
    });

    const envelope = prepared.data.envelope;

    expect(envelope?.executionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(envelope?.correlationId).toBe(envelope?.executionId);
    expect(envelope?.requestId).toBe(envelope?.executionId);
    expect(envelope?.idempotencyKey).toBe(envelope?.executionId);
    expect(envelope?.idempotencyMode).toBe('EXECUTION_ID');
  });

  it('rejects payload tampering before task execution', () => {
    const prepared = QueueExecutionEnvelopeUtil.prepareAiJob(createInput());

    const tampered: AiQueueJobData = {
      ...prepared.data,
      payload: {
        query: 'محصول دستکاری‌شده',
      },
    };

    expect(() =>
      QueueExecutionEnvelopeUtil.assertAiJob(tampered, {
        queueName: QUEUE_NAMES.AI,
        jobName: QUEUE_JOB_NAMES.AI_PROCESS,
        jobId: 'catalog-search-job-1',
      }),
    ).toThrow(BadRequestException);
  });
});
