import { AiSloPolicyService } from './ai-slo-policy.service';

const createRow = () => ({
  id: 'slo-1',
  name: 'Global SLO',
  pattern: JSON.stringify({
    schemaVersion: '1.0.0',
    policyVersion: 1,
    scope: 'GLOBAL',
    scopeValue: null,
    window: 'ROLLING_24_HOURS',
    availabilityTargetPercent: 99.9,
    latencyTargetMs: 2500,
    minimumSampleSize: 30,
    warningBurnRate: 1,
    criticalBurnRate: 2,
    effectiveFrom: null,
    effectiveTo: null,
    updatedById: 'admin-1',
    updatedAt: '2026-07-24T00:00:00.000Z',
  }),
  isActive: true,
  priority: 100,
  createdById: 'admin-1',
  createdAt: new Date('2026-07-24T00:00:00.000Z'),
  updatedAt: new Date('2026-07-24T00:00:00.000Z'),
  deletedAt: null,
});

describe('AiSloPolicyService', () => {
  it('creates a versioned policy in AiGuardrailRule', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const create = jest.fn().mockResolvedValue(createRow());
    const service = new AiSloPolicyService({
      aiGuardrailRule: { findMany, create },
    } as never);

    const result = await service.createPolicy(
      {
        name: 'Global SLO',
        scope: 'GLOBAL',
        window: 'ROLLING_24_HOURS',
        availabilityTargetPercent: 99.9,
        latencyTargetMs: 2500,
      },
      'admin-1',
    );

    expect(result.scope).toBe('GLOBAL');
    expect(create).toHaveBeenCalledTimes(1);
    const [createInput] = create.mock.calls[0] as [
      { data: { ruleType: string; action: string } },
    ];
    expect(createInput.data.ruleType).toBe('AI_SLO_POLICY_V1');
    expect(createInput.data.action).toBe('SLO');
  });

  it('rejects duplicate scope and window policies', async () => {
    const service = new AiSloPolicyService({
      aiGuardrailRule: { findMany: jest.fn().mockResolvedValue([createRow()]) },
    } as never);

    await expect(
      service.createPolicy(
        {
          name: 'Duplicate',
          scope: 'GLOBAL',
          window: 'ROLLING_24_HOURS',
          availabilityTargetPercent: 99,
        },
        'admin-1',
      ),
    ).rejects.toThrow('یک سیاست SLO دیگر وجود دارد');
  });
});
