import { Injectable, Optional } from '@nestjs/common';

import {
  QueueMonitorService,
  type QueueStatusReport,
} from '../../../core/queue/services/queue-monitor.service';

import { QueueExecutionEnvelopeUtil } from '../../../core/queue/utils/queue-execution-envelope.util';

import { QueueFailureClassifierUtil } from '../../../core/queue/utils/queue-failure-classifier.util';

import { QueueExecutionObservabilityUtil } from '../../../core/queue/utils/queue-execution-observability.util';

import { QueueRetryPolicyUtil } from '../../../core/queue/utils/queue-retry-policy.util';

import { AiAgentRegistryService } from './ai-agent-registry.service';

import { AiCircuitBreakerService } from './ai-circuit-breaker.service';

import { AiExecutionContextService } from './ai-execution-context.service';

import { AiRerankerClientService } from './ai-reranker-client.service';

import { AiRuntimeCoordinatorService } from './ai-runtime-coordinator.service';

import { OllamaClientService } from './ollama-client.service';

export interface AiQueueOperationalHealthSnapshot {
  readonly available: boolean;
  readonly ready: boolean;
  readonly level: QueueStatusReport['health']['level'] | 'UNAVAILABLE';
  readonly report: QueueStatusReport | null;
  readonly error: string | null;
}

@Injectable()
export class AiRuntimeHealthService {
  constructor(
    private readonly ollamaClient: OllamaClientService,
    private readonly rerankerClient: AiRerankerClientService,
    private readonly runtimeCoordinator: AiRuntimeCoordinatorService,
    @Optional()
    private readonly agentRegistry?: AiAgentRegistryService,
    @Optional()
    private readonly circuitBreaker?: AiCircuitBreakerService,
    @Optional()
    private readonly executionContext?: AiExecutionContextService,
    @Optional()
    private readonly queueMonitorService?: QueueMonitorService,
  ) {}

  async getHealth() {
    const [ollama, reranker] = await Promise.all([
      this.ollamaClient.health(),
      this.rerankerClient.health(),
    ]);

    const requiredModels = this.requiredModels();
    const missingModels = requiredModels.filter(
      (model) => !ollama.models.includes(model),
    );

    const agents = this.agentRegistry?.getSnapshot() ?? null;

    const circuitBreakers = this.circuitBreaker?.getSnapshot() ?? null;

    const circuitReady =
      !circuitBreakers ||
      (circuitBreakers.openCircuits === 0 &&
        circuitBreakers.halfOpenCircuits === 0);

    const executionGovernance = this.executionContext?.getSnapshot() ?? null;

    const executionGovernanceReady =
      !executionGovernance ||
      (executionGovernance.registryEnforced &&
        executionGovernance.agentSpoofingProtection &&
        executionGovernance.correlationPropagation);

    const queueExecutionEnvelope = QueueExecutionEnvelopeUtil.getSnapshot();

    const queueFailureTaxonomy = QueueFailureClassifierUtil.getSnapshot();

    const queueRetryPolicy = QueueRetryPolicyUtil.getSnapshot();

    const queueExecutionObservability =
      QueueExecutionObservabilityUtil.getSnapshot();

    const queueOperationalHealth = await this.resolveQueueOperationalHealth();

    const queueOperationalReady = queueOperationalHealth?.ready ?? true;

    const queueExecutionGovernanceReady =
      queueExecutionEnvelope.version === '1.0.0' &&
      queueExecutionEnvelope.registryExecutionContextBridge &&
      queueExecutionEnvelope.correlationPropagation &&
      queueExecutionEnvelope.idempotencyContextPropagation &&
      queueExecutionEnvelope.bullJobIdRemainsDeduplicationAuthority &&
      queueFailureTaxonomy.version === '1.0.0' &&
      queueFailureTaxonomy.deadLetterPropagation &&
      queueRetryPolicy.version === '1.0.0' &&
      queueRetryPolicy.attemptAware &&
      queueRetryPolicy.nonRetryableFailuresDiscarded &&
      queueRetryPolicy.bullMqAttemptsRemainAuthoritative &&
      queueExecutionObservability.version === '1.0.0' &&
      queueExecutionObservability.attemptAware &&
      queueExecutionObservability.payloadExcluded &&
      queueExecutionObservability.promptExcluded;

    const ready =
      ollama.ok &&
      reranker.ok &&
      missingModels.length === 0 &&
      circuitReady &&
      executionGovernanceReady &&
      queueExecutionGovernanceReady &&
      queueOperationalReady;

    return {
      status: ready ? 'READY' : 'DEGRADED',
      ready,
      checkedAt: new Date().toISOString(),
      ollama,
      reranker,
      requiredModels,
      missingModels,
      scheduler: this.runtimeCoordinator.getSnapshot(),
      foundation: {
        agents,
        circuitBreakers,
        circuitReady,
        executionGovernance,
        executionGovernanceReady,
        queueExecutionGovernance: {
          envelope: queueExecutionEnvelope,
          failureTaxonomy: queueFailureTaxonomy,
          retryPolicy: queueRetryPolicy,
          observability: queueExecutionObservability,
          ready: queueExecutionGovernanceReady,
        },
        queueOperationalHealth,
        queueOperationalReady,
      },
    };
  }

  private async resolveQueueOperationalHealth(): Promise<AiQueueOperationalHealthSnapshot | null> {
    if (!this.queueMonitorService) {
      return null;
    }

    try {
      const report = await this.queueMonitorService.getStatus();

      return {
        available: true,
        ready: report.health.ready,
        level: report.health.level,
        report,
        error: null,
      };
    } catch (error) {
      return {
        available: false,
        ready: false,
        level: 'UNAVAILABLE',
        report: null,
        error:
          error instanceof Error && error.message.trim().length > 0
            ? error.message.trim()
            : 'Queue operational health is unavailable.',
      };
    }
  }

  private requiredModels(): string[] {
    return [
      process.env.AI_OLLAMA_PUBLIC_MODEL || 'qwen3.5:9b',
      process.env.AI_OLLAMA_CONTENT_MODEL || 'qwen3:14b',
      process.env.AI_OLLAMA_VISION_MODEL || 'qwen3-vl:8b',
      process.env.AI_OLLAMA_EMBEDDING_MODEL || 'qwen3-embedding:4b',
      process.env.AI_OLLAMA_FALLBACK_MODEL || 'qwen3:14b',
    ]
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item, index, values) => values.indexOf(item) === index);
  }
}
