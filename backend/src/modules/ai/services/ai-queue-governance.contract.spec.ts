import {
  QUEUE_JOB_NAMES,
  QUEUE_NAMES,
} from '../../../core/queue/constants/queue.constants';

import {
  QueueExecutionEnvelopeUtil,
  type QueueEnvelopeSnapshot,
} from '../../../core/queue/utils/queue-execution-envelope.util';

import { QueueFailureClassifierUtil } from '../../../core/queue/utils/queue-failure-classifier.util';

describe('AI queue governance contract', () => {
  it('publishes a versioned envelope and failure taxonomy snapshot', () => {
    const envelopeSnapshot: QueueEnvelopeSnapshot =
      QueueExecutionEnvelopeUtil.getSnapshot();

    expect(envelopeSnapshot).toEqual({
      version: '1.0.0',
      appliedQueue: QUEUE_NAMES.AI,
      registryExecutionContextBridge: true,
      correlationPropagation: true,
      requestPropagation: true,
      idempotencyContextPropagation: true,
      bullJobIdRemainsDeduplicationAuthority: true,
      payloadIntegrityHash: 'SHA-256',
      validationMode: 'PRODUCER_ENRICHMENT_AND_WORKER_ASSERTION',
    });

    const failureSnapshot = QueueFailureClassifierUtil.getSnapshot();

    expect(failureSnapshot.version).toBe('1.0.0');
    expect(failureSnapshot.deadLetterPropagation).toBe(true);
    expect(failureSnapshot.categories).toEqual([
      'VALIDATION',
      'AUTHORIZATION',
      'NOT_FOUND',
      'CONFLICT',
      'RATE_LIMIT',
      'TIMEOUT',
      'DEPENDENCY_UNAVAILABLE',
      'TRANSIENT_NETWORK',
      'CIRCUIT_OPEN',
      'PERMANENT',
      'UNKNOWN',
    ]);
  });

  it('keeps child jobs correlated while assigning a separate execution id', () => {
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
          createdAt: '2026-07-22T20:00:00.000Z',
          parentExecutionId: 'parent-execution-1',
          correlationId: 'correlation-chain-1',
          requestId: 'request-chain-1',
          source: 'catalog.research.bootstrap',
          producer: 'ai-queue-processor',
          executionContextVersion: '1.0.0',
          agentId: 'product-intelligence',
          agentVersion: '1.0.0',
          agentTaskType: 'CONTENT',
          agentExecutionMode: 'SUGGEST_ONLY',
          agentCapabilities: ['PRODUCT_RESEARCH'],
          agentSupportsHumanHandoff: false,
          agentModelRequirements: {
            provider: 'ollama',
            requiresEmbedding: false,
            requiresVision: false,
          },
          idempotencyKey: 'catalog-web-research-run-1',
        },
      },
      options: {
        jobId: 'catalog-web-research-run-1',
      },
    });

    expect(prepared.data.envelope).toMatchObject({
      parentExecutionId: 'parent-execution-1',
      correlationId: 'correlation-chain-1',
      requestId: 'request-chain-1',
      idempotencyKey: 'catalog-web-research-run-1',
      idempotencyMode: 'EXPLICIT',
      executionContextVersion: '1.0.0',
      agentId: 'product-intelligence',
      agentVersion: '1.0.0',
      agentTaskType: 'CONTENT',
      agentExecutionMode: 'SUGGEST_ONLY',
      agentCapabilities: ['PRODUCT_RESEARCH'],
      agentSupportsHumanHandoff: false,
      agentModelRequirements: {
        provider: 'ollama',
        requiresEmbedding: false,
        requiresVision: false,
      },
    });
    expect(prepared.data.envelope?.executionId).not.toBe('parent-execution-1');
  });
});
