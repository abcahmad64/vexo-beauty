import { AiModelRolloutCanaryUtil } from './ai-model-rollout-canary.util';
describe('AiModelRolloutCanaryUtil', () => {
  it('assigns a stable deterministic cohort', () => {
    const first = AiModelRolloutCanaryUtil.resolveCohort('user-1', 'salt', 10);
    const second = AiModelRolloutCanaryUtil.resolveCohort('user-1', 'salt', 10);
    expect(first).toEqual(second);
    expect(first.routingMutation).toBe(false);
  });
  it('rejects identical baseline and candidate', () => {
    expect(() =>
      AiModelRolloutCanaryUtil.createDocument({
        policyVersion: 1,
        baselineProvider: 'ollama',
        baselineModel: 'm1',
        candidateProvider: 'ollama',
        candidateModel: 'm1',
        taskType: null,
        trafficPercent: 10,
        cohortSalt: 'salt',
        minimumSampleSize: 10,
        maxFailureRateIncreasePercent: 10,
        maxP95LatencyIncreasePercent: 20,
        maxCostIncreasePercent: null,
        effectiveFrom: null,
        effectiveTo: null,
        updatedById: 'admin',
      }),
    ).toThrow('must differ');
  });
});
