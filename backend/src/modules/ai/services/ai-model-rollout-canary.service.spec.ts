import { AiModelRolloutCanaryService } from './ai-model-rollout-canary.service';
describe('AiModelRolloutCanaryService', () => {
  it('resolves cohort without mutating routing', () => {
    const service = new AiModelRolloutCanaryService({} as never);
    const result = service.resolveCohort(
      {
        id: 'r1',
        name: 'test',
        schemaVersion: '1.0.0',
        policyVersion: 1,
        baselineProvider: 'ollama',
        baselineModel: 'base',
        candidateProvider: 'ollama',
        candidateModel: 'candidate',
        taskType: 'PUBLIC_CHAT',
        trafficPercent: 20,
        cohortSalt: 'salt',
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
      },
      'user-1',
    );
    expect(result.routingMutation).toBe(false);
    expect(['BASELINE', 'CANDIDATE']).toContain(result.cohort);
  });
});
