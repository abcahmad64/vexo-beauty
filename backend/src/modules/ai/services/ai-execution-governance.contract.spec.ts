import type {
  AiChatMessage,
  AiGenerateOptions,
  AiProviderResult,
} from '../interfaces/ai-provider.interface';

import { AiAgentRegistryService } from './ai-agent-registry.service';

import { AiCircuitBreakerService } from './ai-circuit-breaker.service';

import { AiExecutionContextService } from './ai-execution-context.service';

import type {
  AiPermissionContext,
  AiPermissionGuardService,
} from './ai-permission-guard.service';

import { AiOrchestratorService } from './ai-orchestrator.service';

import type { AiRerankerClientService } from './ai-reranker-client.service';

import type { AiRuntimeCoordinatorService } from './ai-runtime-coordinator.service';

import { AiRuntimeHealthService } from './ai-runtime-health.service';

import type {
  AiToolDefinition,
  AiToolRegistryService,
} from './ai-tool-registry.service';

import type { OllamaClientService } from './ollama-client.service';

type AiProviderMock = {
  generate: jest.Mock<
    Promise<AiProviderResult>,
    [AiChatMessage[], AiGenerateOptions?]
  >;
};

type ToolRegistryMock = {
  assertToolEnabled: jest.Mock<AiToolDefinition, [string]>;
};

type PermissionGuardMock = {
  assertAllowed: jest.Mock<void, [AiPermissionContext, string[], string?]>;
  assertApprovalAllowed: jest.Mock<void, [AiPermissionContext, string?]>;
};

type OllamaHealthFixture = {
  ok: boolean;
  baseUrl: string;
  version: string | null;
  models: string[];
  error: string | null;
};

type RerankerHealthFixture = {
  ok: boolean;
  baseUrl: string;
  model: string;
  error: string | null;
};

type RuntimeSnapshotFixture = {
  maxConcurrent: number;
  activeCount: number;
  queueDepth: number;
  maxQueueDepth: number;
  queueTimeoutMs: number;
  activeExecutions: never[];
};

describe('AI execution governance contract', () => {
  const messages: AiChatMessage[] = [
    {
      role: 'user',
      content: 'یک محصول مناسب معرفی کن.',
    },
  ];

  it('routes orchestrator execution through the registry-governed context', async () => {
    const providerResult: AiProviderResult = {
      content: 'پیشنهاد آماده شد.',
      model: 'primary-model',
      provider: 'ollama',
    };

    const aiProvider: AiProviderMock = {
      generate: jest
        .fn<Promise<AiProviderResult>, [AiChatMessage[], AiGenerateOptions?]>()
        .mockResolvedValue(providerResult),
    };

    const toolRegistry: ToolRegistryMock = {
      assertToolEnabled: jest.fn<AiToolDefinition, [string]>(),
    };

    const permissionGuard: PermissionGuardMock = {
      assertAllowed: jest.fn<void, [AiPermissionContext, string[], string?]>(),
      assertApprovalAllowed: jest.fn<void, [AiPermissionContext, string?]>(),
    };

    const registry = new AiAgentRegistryService();
    const executionContext = new AiExecutionContextService(registry);

    const service = new AiOrchestratorService(
      aiProvider,
      toolRegistry as unknown as AiToolRegistryService,
      permissionGuard as unknown as AiPermissionGuardService,
      registry,
      executionContext,
    );

    const result = await service.generate(messages, {
      task: 'SALES',
      metadata: {
        executionId: 'execution-1',
        correlationId: 'correlation-1',
        requestId: 'request-1',
        source: 'storefront-assistant',
        channel: 'web',
      },
    });

    const call = aiProvider.generate.mock.calls[0];
    const sentOptions = call[1];
    const metadata = sentOptions?.metadata;

    expect(call[0]).toBe(messages);
    expect(metadata?.executionId).toBe('execution-1');
    expect(metadata?.correlationId).toBe('correlation-1');
    expect(metadata?.requestId).toBe('request-1');
    expect(metadata?.source).toBe('storefront-assistant');
    expect(metadata?.channel).toBe('web');
    expect(metadata?.agentId).toBe('storefront-sales');
    expect(metadata?.agentTaskType).toBe('SALES');
    expect(metadata?.agentExecutionMode).toBe('READ_ONLY');
    expect(metadata?.executionContextVersion).toBe('1.0.0');
    expect(result).toBe(providerResult);
  });

  it('publishes execution-governance readiness through runtime health', async () => {
    const registry = new AiAgentRegistryService();
    const circuitBreaker = new AiCircuitBreakerService();
    const executionContext = new AiExecutionContextService(registry);

    const ollamaClient = {
      health: jest.fn<Promise<OllamaHealthFixture>, []>().mockResolvedValue({
        ok: true,
        baseUrl: 'http://ollama:11434',
        version: 'test',
        models: [
          'qwen3.5:9b',
          'qwen3:14b',
          'qwen3-vl:8b',
          'qwen3-embedding:4b',
        ],
        error: null,
      }),
    };

    const rerankerClient = {
      health: jest.fn<Promise<RerankerHealthFixture>, []>().mockResolvedValue({
        ok: true,
        baseUrl: 'http://reranker:8000',
        model: 'test-reranker',
        error: null,
      }),
    };

    const runtimeCoordinator = {
      getSnapshot: jest.fn<RuntimeSnapshotFixture, []>().mockReturnValue({
        maxConcurrent: 1,
        activeCount: 0,
        queueDepth: 0,
        maxQueueDepth: 24,
        queueTimeoutMs: 300000,
        activeExecutions: [],
      }),
    };

    const service = new AiRuntimeHealthService(
      ollamaClient as unknown as OllamaClientService,
      rerankerClient as unknown as AiRerankerClientService,
      runtimeCoordinator as unknown as AiRuntimeCoordinatorService,
      registry,
      circuitBreaker,
      executionContext,
    );

    const result = await service.getHealth();

    expect(result.ready).toBe(true);
    expect(result.status).toBe('READY');
    expect(result.foundation.executionGovernanceReady).toBe(true);
    expect(result.foundation.executionGovernance).toEqual(
      executionContext.getSnapshot(),
    );
  });
});
