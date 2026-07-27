import type {
  AiChatMessage,
  AiGenerateOptions,
  AiProvider,
  AiProviderResult,
} from '../interfaces/ai-provider.interface';

import { AiAgentRegistryService } from './ai-agent-registry.service';

import type { AiPermissionGuardService } from './ai-permission-guard.service';

import { AiOrchestratorService } from './ai-orchestrator.service';

import type { AiToolRegistryService } from './ai-tool-registry.service';

describe('AI foundation contract', () => {
  it('attaches the resolved agent contract to provider metadata', async () => {
    const providerResult: AiProviderResult = {
      content: 'done',
      model: 'sales-model',
      provider: 'ollama',
    };

    const generate = jest.fn<
      Promise<AiProviderResult>,
      [AiChatMessage[], AiGenerateOptions?]
    >(() => Promise.resolve(providerResult));

    const aiProvider: AiProvider = {
      generate,
    };

    const service = new AiOrchestratorService(
      aiProvider,
      {} as AiToolRegistryService,
      {} as AiPermissionGuardService,
      new AiAgentRegistryService(),
    );

    const messages: AiChatMessage[] = [
      {
        role: 'user',
        content: 'برای خرید راهنمایی کن.',
      },
    ];

    await service.generate(messages, {
      task: 'SALES',
      metadata: {
        requestId: 'request-1',
      },
    });

    expect(generate).toHaveBeenCalledTimes(1);

    const [actualMessages, actualOptions] = generate.mock.calls[0];

    expect(actualMessages).toEqual(messages);
    expect(actualOptions?.task).toBe('SALES');
    expect(actualOptions?.metadata?.requestId).toBe('request-1');
    expect(actualOptions?.metadata?.agentId).toBe('storefront-sales');
    expect(actualOptions?.metadata?.agentVersion).toBe('1.0.0');
    expect(actualOptions?.metadata?.agentExecutionMode).toBe('READ_ONLY');
    expect(actualOptions?.metadata?.agentTaskType).toBe('SALES');
    expect(actualOptions?.metadata?.agentSupportsHumanHandoff).toBe(true);
    expect(actualOptions?.metadata?.agentCapabilities).toContain(
      'SALES_CONSULTING',
    );
    expect(actualOptions?.metadata?.agentCapabilities).toContain(
      'HUMAN_HANDOFF',
    );
    expect(actualOptions?.metadata?.agentModelRequirements).toMatchObject({
      provider: 'ollama',
      supportsFallback: true,
    });
  });
});
