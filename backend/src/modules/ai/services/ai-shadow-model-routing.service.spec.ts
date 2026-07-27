import type { AiModelRolloutRecord } from '../interfaces/ai-model-rollout-canary.interface';
import type { AiModelRoute } from './ai-model-router.service';

import { AiShadowModelRoutingService } from './ai-shadow-model-routing.service';

describe('AiShadowModelRoutingService', () => {
  const actualRoute: AiModelRoute = {
    provider: 'ollama',
    taskType: 'PUBLIC_CHAT',
    model: 'baseline',
    temperature: 0.4,
    numPredict: 256,
    numCtx: 8192,
    timeoutMs: 180000,
    keepAlive: '5m',
    think: false,
  };

  const rollout: AiModelRolloutRecord = {
    id: 'rollout-1',
    name: 'test rollout',
    schemaVersion: '1.0.0',
    policyVersion: 2,
    baselineProvider: 'ollama',
    baselineModel: 'baseline',
    candidateProvider: 'ollama',
    candidateModel: 'candidate',
    taskType: 'PUBLIC_CHAT',
    trafficPercent: 10,
    cohortSalt: 'stable-salt',
    minimumSampleSize: 10,
    maxFailureRateIncreasePercent: 10,
    maxP95LatencyIncreasePercent: 20,
    maxCostIncreasePercent: null,
    effectiveFrom: null,
    effectiveTo: null,
    updatedById: 'admin',
    updatedAt: '2026-07-24T00:00:00.000Z',
    isActive: true,
    priority: 100,
    createdById: 'admin',
    createdAt: '2026-07-24T00:00:00.000Z',
    databaseUpdatedAt: '2026-07-24T00:00:00.000Z',
    deletedAt: null,
  };

  it('returns candidate only as a shadow route', async () => {
    const router = {
      normalizeTaskType: jest.fn().mockReturnValue('PUBLIC_CHAT' as const),
      resolve: jest
        .fn<AiModelRoute, [{ task: 'PUBLIC_CHAT' }]>()
        .mockReturnValue(actualRoute),
    };
    const rollouts = {
      findApplicableRollout: jest
        .fn<
          Promise<AiModelRolloutRecord | null>,
          [
            {
              taskType: string;
              baselineProvider: string;
              baselineModel: string;
              at?: Date;
            },
          ]
        >()
        .mockResolvedValue(rollout),
      resolveCohort: jest.fn().mockReturnValue({
        rolloutId: rollout.id,
        baseline: { provider: 'ollama', model: 'baseline' },
        candidate: { provider: 'ollama', model: 'candidate' },
        trafficPercent: 10,
        bucket: 4,
        threshold: 1000,
        cohort: 'CANDIDATE' as const,
        stable: true,
        mode: 'OBSERVABILITY_AND_RECOMMENDATION_ONLY',
        routingMutation: false,
      }),
    };
    const observability = {
      persistDecision: jest.fn().mockResolvedValue(true),
    };
    const service = new AiShadowModelRoutingService(
      router as never,
      rollouts as never,
      observability as never,
    );

    const result = await service.resolve({ subjectKey: 'user-1' });

    expect(result.actualRoute.model).toBe('baseline');
    expect(result.shadowRoute.model).toBe('candidate');
    expect(result.routeChanged).toBe(false);
    expect(result.providerInvoked).toBe(false);
    expect(result.modelActivated).toBe(false);
    expect(result.decisionPersisted).toBe(true);
  });

  it('does not expose a raw subject key', async () => {
    const router = {
      normalizeTaskType: jest.fn().mockReturnValue('PUBLIC_CHAT' as const),
      resolve: jest
        .fn<AiModelRoute, [{ task: 'PUBLIC_CHAT' }]>()
        .mockReturnValue(actualRoute),
    };
    const rollouts = {
      findApplicableRollout: jest
        .fn<
          Promise<AiModelRolloutRecord | null>,
          [
            {
              taskType: string;
              baselineProvider: string;
              baselineModel: string;
              at?: Date;
            },
          ]
        >()
        .mockResolvedValue(null),
      resolveCohort: jest.fn(),
    };
    const observability = {
      persistDecision: jest.fn().mockResolvedValue(true),
    };
    const service = new AiShadowModelRoutingService(
      router as never,
      rollouts as never,
      observability as never,
    );

    const result = await service.resolve({ requestId: 'secret-request-id' });

    expect(JSON.stringify(result)).not.toContain('secret-request-id');
    expect(result.rollout).toBeNull();
    expect(result.shadowRoute).toEqual(result.actualRoute);
  });
});
