import { AiSloPolicyUtil } from './ai-slo-policy.util';

describe('AiSloPolicyUtil', () => {
  it('creates and parses a normalized versioned policy', () => {
    const document = AiSloPolicyUtil.createDocument({
      policyVersion: 1,
      scope: 'GLOBAL',
      window: 'ROLLING_24_HOURS',
      availabilityTargetPercent: 99.9,
      latencyTargetMs: 2500,
      minimumSampleSize: 30,
      warningBurnRate: 1,
      criticalBurnRate: 2,
      updatedById: 'admin-1',
      updatedAt: '2026-07-24T00:00:00.000Z',
    });

    expect(document.scopeValue).toBeNull();
    expect(
      AiSloPolicyUtil.parseDocument(
        AiSloPolicyUtil.serializeDocument(document),
      ),
    ).toEqual(document);
  });

  it('requires scopeValue outside GLOBAL', () => {
    expect(() =>
      AiSloPolicyUtil.createDocument({
        policyVersion: 1,
        scope: 'PROVIDER',
        window: 'ROLLING_1_HOUR',
        availabilityTargetPercent: 99,
        updatedById: 'admin-1',
      }),
    ).toThrow('scopeValue is required');
  });

  it('calculates rolling window boundaries deterministically', () => {
    const asOf = new Date('2026-07-24T00:00:00.000Z');
    expect(
      AiSloPolicyUtil.windowStart('ROLLING_24_HOURS', asOf).toISOString(),
    ).toBe('2026-07-23T00:00:00.000Z');
  });
});
