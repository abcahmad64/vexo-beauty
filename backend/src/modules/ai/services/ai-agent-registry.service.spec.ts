import { ConflictException, ServiceUnavailableException } from '@nestjs/common';

import type { AiAgentDefinition } from '../interfaces/ai-agent.interface';

import { AiAgentRegistryService } from './ai-agent-registry.service';

describe('AiAgentRegistryService', () => {
  const envKeys = ['AI_AGENT_STOREFRONT_SALES_ENABLED'] as const;

  const originalEnv = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const key of envKeys) {
      originalEnv.set(key, process.env[key]);
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv.get(key);

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('registers built-in agents with complete task coverage', () => {
    const service = new AiAgentRegistryService();
    const snapshot = service.getSnapshot();

    expect(snapshot.totalAgents).toBe(8);
    expect(snapshot.availableAgents).toBe(8);
    expect(snapshot.coveredTaskTypes).toEqual(
      expect.arrayContaining([
        'PUBLIC_CHAT',
        'CONTENT',
        'RECOMMENDATION',
        'MARKETING_STRATEGY',
        'ANALYTICS',
        'VISION',
        'EMBEDDING',
        'FALLBACK',
      ]),
    );
  });

  it('resolves legacy task aliases to the owning agent', () => {
    const service = new AiAgentRegistryService();

    const resolution = service.resolveForTask('marketing');

    expect(resolution.normalizedTaskType).toBe('MARKETING_STRATEGY');
    expect(resolution.agent.id).toBe('marketing-strategist');
    expect(resolution.agent.modelRequirements.supportsFallback).toBe(true);
  });

  it('rejects duplicate agent identifiers', () => {
    const service = new AiAgentRegistryService();
    const existing = service.getAgent('storefront-sales');

    expect(() => service.registerAgent(existing)).toThrow(ConflictException);
  });

  it('rejects duplicate task ownership', () => {
    const service = new AiAgentRegistryService();

    const duplicateTaskAgent: AiAgentDefinition = {
      id: 'custom-sales-agent',
      title: 'عامل فروش دوم',
      description: 'تعریف تکراری برای آزمون مالکیت وظیفه.',
      version: '1.0.0',
      enabled: true,
      executionMode: 'READ_ONLY',
      capabilities: ['SALES_CONSULTING'],
      taskTypes: ['SALES'],
      modelRequirements: {
        provider: 'ollama',
        taskTypes: ['SALES'],
        supportsFallback: true,
        requiresEmbedding: false,
        requiresVision: false,
      },
      supportsHumanHandoff: false,
    };

    expect(() => service.registerAgent(duplicateTaskAgent)).toThrow(
      ConflictException,
    );
  });

  it('blocks resolution of a disabled agent', () => {
    process.env.AI_AGENT_STOREFRONT_SALES_ENABLED = 'false';

    const service = new AiAgentRegistryService();

    expect(() => service.resolveForTask('PUBLIC_CHAT')).toThrow(
      ServiceUnavailableException,
    );
  });
});
