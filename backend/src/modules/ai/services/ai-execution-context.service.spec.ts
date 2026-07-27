import { BadRequestException } from '@nestjs/common';

import { AI_EXECUTION_CONTEXT_VERSION } from '../interfaces/ai-execution-context.interface';

import { AiAgentRegistryService } from './ai-agent-registry.service';

import { AiExecutionContextService } from './ai-execution-context.service';

describe('AiExecutionContextService', () => {
  let registry: AiAgentRegistryService;
  let service: AiExecutionContextService;

  beforeEach(() => {
    registry = new AiAgentRegistryService();
    service = new AiExecutionContextService(registry);
  });

  it('creates a deterministic execution context from trusted identifiers', () => {
    const result = service.prepare({
      task: 'SALES',
      temperature: 0.2,
      metadata: {
        executionId: 'execution-1',
        correlationId: 'correlation-1',
        requestId: 'request-1',
        source: 'storefront-assistant',
        channel: 'web',
      },
    });

    expect(Number.isNaN(Date.parse(result.context.startedAt))).toBe(false);

    expect({
      ...result.context,
      startedAt: '<timestamp>',
    }).toEqual({
      executionId: 'execution-1',
      correlationId: 'correlation-1',
      requestId: 'request-1',
      source: 'storefront-assistant',
      startedAt: '<timestamp>',
      contextVersion: AI_EXECUTION_CONTEXT_VERSION,
      requestedTask: 'SALES',
      taskType: 'SALES',
      agentId: 'storefront-sales',
      agentVersion: '1.0.0',
      agentExecutionMode: 'READ_ONLY',
      agentCapabilities: [
        'PUBLIC_ASSISTANT',
        'SALES_CONSULTING',
        'PRODUCT_COMPARISON',
        'HUMAN_HANDOFF',
      ],
      agentSupportsHumanHandoff: true,
      agentModelRequirements: {
        provider: 'ollama',
        taskTypes: ['PUBLIC_CHAT', 'CONSULTING', 'SALES', 'COMPARISON'],
        supportsFallback: true,
        requiresEmbedding: false,
        requiresVision: false,
      },
    });

    expect(result.options.metadata).toEqual({
      executionId: 'execution-1',
      correlationId: 'correlation-1',
      requestId: 'request-1',
      source: 'storefront-assistant',
      channel: 'web',
      executionStartedAt: result.context.startedAt,
      executionContextVersion: AI_EXECUTION_CONTEXT_VERSION,
      requestedTask: 'SALES',
      agentId: 'storefront-sales',
      agentVersion: '1.0.0',
      agentExecutionMode: 'READ_ONLY',
      agentCapabilities: [
        'PUBLIC_ASSISTANT',
        'SALES_CONSULTING',
        'PRODUCT_COMPARISON',
        'HUMAN_HANDOFF',
      ],
      agentSupportsHumanHandoff: true,
      agentTaskType: 'SALES',
      agentModelRequirements: {
        provider: 'ollama',
        taskTypes: ['PUBLIC_CHAT', 'CONSULTING', 'SALES', 'COMPARISON'],
        supportsFallback: true,
        requiresEmbedding: false,
        requiresVision: false,
      },
    });
  });

  it('generates correlated identifiers when none are supplied', () => {
    const result = service.prepare({
      task: 'CONTENT',
      metadata: {
        channel: 'admin',
      },
    });

    expect(result.context.executionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    expect(result.context.correlationId).toBe(result.context.executionId);

    expect(result.context.requestId).toBe(result.context.executionId);

    expect(result.context.source).toBe('admin');
    expect(result.context.agentId).toBe('product-intelligence');
  });

  it('rejects an agent identifier that attempts to spoof task ownership', () => {
    expect(() =>
      service.prepare({
        task: 'SALES',
        metadata: {
          agentId: 'marketing-strategist',
        },
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects an agent task type that conflicts with the resolved route', () => {
    expect(() =>
      service.prepare({
        task: 'SEO',
        metadata: {
          agentTaskType: 'SALES',
        },
      }),
    ).toThrow(BadRequestException);
  });

  it('exposes the immutable execution-governance contract', () => {
    expect(service.getSnapshot()).toEqual({
      version: AI_EXECUTION_CONTEXT_VERSION,
      registryEnforced: true,
      agentSpoofingProtection: true,
      correlationPropagation: true,
      runLogPropagation:
        'AiGenerateOptions.metadata -> AiRunLog.inputJson.metadata',
      protectedAgentMetadataKeys: [
        'agentId',
        'agentVersion',
        'agentExecutionMode',
        'agentCapabilities',
        'agentSupportsHumanHandoff',
        'agentTaskType',
        'agentModelRequirements',
      ],
      generatedExecutionMetadataKeys: [
        'executionId',
        'correlationId',
        'requestId',
        'executionStartedAt',
        'executionContextVersion',
      ],
    });
  });
});
