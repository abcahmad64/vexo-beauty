import {
  AI_BUDGET_ENFORCEMENT_VERSION,
  AI_BUDGET_POLICY_SCHEMA_VERSION,
} from '../interfaces/ai-budget-enforcement.interface';

import { AiBudgetPolicyUtil } from './ai-budget-policy.util';

describe('AiBudgetPolicyUtil', () => {
  it('creates and parses a versioned global policy document', () => {
    const document = AiBudgetPolicyUtil.createDocument({
      policyVersion: 1,
      scope: 'GLOBAL',
      scopeValue: 'ignored-for-global',
      window: 'DAILY',
      softLimitMicros: '500000',
      hardLimitMicros: '1000000',
      unknownPricingMode: 'BLOCK',
      updatedById: 'admin-1',
    });

    expect(document).toEqual({
      schemaVersion: AI_BUDGET_POLICY_SCHEMA_VERSION,
      policyVersion: 1,
      scope: 'GLOBAL',
      scopeValue: null,
      window: 'DAILY',
      softLimitMicros: '500000',
      hardLimitMicros: '1000000',
      unknownPricingMode: 'BLOCK',
      effectiveFrom: null,
      effectiveTo: null,
      updatedById: 'admin-1',
    });

    const policy = AiBudgetPolicyUtil.parsePolicy({
      id: 'policy-1',
      name: 'Global daily budget',
      pattern: AiBudgetPolicyUtil.serializeDocument(document),
      isActive: true,
      priority: 10,
      createdById: 'admin-1',
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T00:00:00.000Z',
      deletedAt: null,
    });

    expect(policy.scope).toBe('GLOBAL');
    expect(policy.scopeValue).toBeNull();
    expect(policy.policyVersion).toBe(1);
  });

  it('resolves deterministic UTC budget windows', () => {
    const now = new Date('2026-07-23T22:45:00.000Z');

    expect(AiBudgetPolicyUtil.resolveWindowRange('DAILY', now)).toEqual({
      start: new Date('2026-07-23T00:00:00.000Z'),
      end: new Date('2026-07-24T00:00:00.000Z'),
    });
    expect(AiBudgetPolicyUtil.resolveWindowRange('WEEKLY', now)).toEqual({
      start: new Date('2026-07-20T00:00:00.000Z'),
      end: new Date('2026-07-27T00:00:00.000Z'),
    });
    expect(AiBudgetPolicyUtil.resolveWindowRange('MONTHLY', now)).toEqual({
      start: new Date('2026-07-01T00:00:00.000Z'),
      end: new Date('2026-08-01T00:00:00.000Z'),
    });
    expect(
      AiBudgetPolicyUtil.resolveWindowRange('ROLLING_24_HOURS', now),
    ).toEqual({
      start: new Date('2026-07-22T22:45:00.000Z'),
      end: now,
    });
  });

  it('matches scoped execution context without case sensitivity', () => {
    const context = AiBudgetPolicyUtil.normalizeContext({
      runLogId: 'run-1',
      taskType: 'SALES',
      userId: 'USER-1',
      provider: 'OLLAMA',
      model: 'Qwen3.5:9B',
      metadata: {
        agentId: 'Storefront-Sales',
      },
    });

    expect(
      AiBudgetPolicyUtil.matchesContext(
        { scope: 'USER', scopeValue: 'user-1' },
        context,
      ),
    ).toBe(true);
    expect(
      AiBudgetPolicyUtil.matchesContext(
        { scope: 'PROVIDER', scopeValue: 'ollama' },
        context,
      ),
    ).toBe(true);
    expect(
      AiBudgetPolicyUtil.matchesContext(
        { scope: 'TASK', scopeValue: 'sales' },
        context,
      ),
    ).toBe(true);
  });

  it('preserves unrelated run input while writing budget evidence', () => {
    const written = AiBudgetPolicyUtil.writeRunEvidence(
      {
        source: 'storefront',
      },
      {
        version: AI_BUDGET_ENFORCEMENT_VERSION,
        decisions: [],
        reservations: [],
      },
    );

    expect(written).toEqual({
      source: 'storefront',
      budgetEnforcement: {
        version: AI_BUDGET_ENFORCEMENT_VERSION,
        decisions: [],
        reservations: [],
      },
    });
    expect(AiBudgetPolicyUtil.readRunEvidence(written)).toEqual(
      written.budgetEnforcement,
    );
  });

  it('rejects invalid limit ordering', () => {
    expect(() =>
      AiBudgetPolicyUtil.createDocument({
        policyVersion: 1,
        scope: 'GLOBAL',
        window: 'DAILY',
        softLimitMicros: '200',
        hardLimitMicros: '100',
      }),
    ).toThrow('Soft budget limit cannot exceed hard budget limit.');
  });
});
