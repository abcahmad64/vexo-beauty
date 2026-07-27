import type { PrismaService } from '../../../core/prisma/prisma.service';

import type { AiBudgetEnforcementException } from '../errors/ai-budget-enforcement.exception';
import {
  AI_BUDGET_ENFORCEMENT_VERSION,
  AI_BUDGET_POLICY_RULE_TYPE,
} from '../interfaces/ai-budget-enforcement.interface';

import { AiBudgetEnforcementService } from './ai-budget-enforcement.service';
import { AiBudgetPolicyUtil } from './ai-budget-policy.util';

function createGlobalPolicyRow(input: {
  readonly softLimitMicros: string;
  readonly hardLimitMicros: string;
  readonly unknownPricingMode?: 'WARN' | 'BLOCK';
}) {
  const document = AiBudgetPolicyUtil.createDocument({
    policyVersion: 1,
    scope: 'GLOBAL',
    window: 'DAILY',
    softLimitMicros: input.softLimitMicros,
    hardLimitMicros: input.hardLimitMicros,
    unknownPricingMode: input.unknownPricingMode ?? 'BLOCK',
    updatedById: 'admin-1',
  });

  return {
    id: 'policy-global',
    name: 'Global daily budget',
    ruleType: AI_BUDGET_POLICY_RULE_TYPE,
    pattern: AiBudgetPolicyUtil.serializeDocument(document),
    isActive: true,
    priority: 10,
    createdById: 'admin-1',
    createdAt: new Date('2026-07-23T00:00:00.000Z'),
    updatedAt: new Date('2026-07-23T00:00:00.000Z'),
    deletedAt: null,
  };
}

function createTransactionPrisma(input: {
  readonly policyRow: ReturnType<typeof createGlobalPolicyRow>;
  readonly runInputJson?: unknown;
}) {
  let storedInputJson: unknown = input.runInputJson ?? { source: 'test' };
  const findPolicies = jest.fn().mockResolvedValue([input.policyRow]);
  const findRun = jest.fn().mockImplementation(() =>
    Promise.resolve({
      id: 'run-1',
      taskType: 'SALES',
      userId: 'user-1',
      provider: 'paid-provider',
      model: 'paid-model',
      inputJson: storedInputJson,
      tokenUsageJson: null,
      createdAt: new Date('2026-07-23T10:00:00.000Z'),
      deletedAt: null,
    }),
  );
  const findRuns = jest.fn().mockResolvedValue([]);
  const updateRun = jest
    .fn()
    .mockImplementation(({ data }: { data: { inputJson: unknown } }) => {
      storedInputJson = data.inputJson;

      return Promise.resolve({ id: 'run-1' });
    });
  const queryRaw = jest.fn().mockResolvedValue([{ locked: true }]);
  const tx = {
    aiGuardrailRule: {
      findMany: findPolicies,
    },
    aiRunLog: {
      findFirst: findRun,
      findMany: findRuns,
      update: updateRun,
    },
    $queryRaw: queryRaw,
  };
  const transaction = jest
    .fn()
    .mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
  const prisma = {
    $transaction: transaction,
  } as unknown as PrismaService;

  return {
    prisma,
    findPolicies,
    findRun,
    findRuns,
    updateRun,
    queryRaw,
    getStoredInputJson: () => storedInputJson,
  };
}

describe('AiBudgetEnforcementService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-23T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('blocks a reservation that would exceed the hard limit', async () => {
    const fixture = createTransactionPrisma({
      policyRow: createGlobalPolicyRow({
        softLimitMicros: '50',
        hardLimitMicros: '100',
      }),
    });
    const service = new AiBudgetEnforcementService(fixture.prisma);

    const request = service.reserve({
      runLogId: 'run-1',
      taskType: 'SALES',
      userId: 'user-1',
      provider: 'paid-provider',
      model: 'paid-model',
      estimate: {
        pricingStatus: 'CALCULATED',
        estimatedCostMicros: '101',
        estimatedInputTokens: 10,
        estimatedOutputTokens: 20,
      },
      attemptSequence: 1,
      attemptKind: 'PRIMARY',
    });

    await expect(request).rejects.toMatchObject({
      reason: 'HARD_LIMIT_EXCEEDED',
    });
    expect(fixture.queryRaw).toHaveBeenCalledTimes(1);
    expect(fixture.updateRun).toHaveBeenCalledTimes(1);
    expect(
      AiBudgetPolicyUtil.readRunEvidence(fixture.getStoredInputJson())
        .decisions[0].decision,
    ).toBe('BLOCK');
  });

  it('creates one deterministic reservation for repeated execution input', async () => {
    const fixture = createTransactionPrisma({
      policyRow: createGlobalPolicyRow({
        softLimitMicros: '500',
        hardLimitMicros: '1000',
      }),
    });
    const service = new AiBudgetEnforcementService(fixture.prisma);
    const input = {
      runLogId: 'run-1',
      taskType: 'SALES',
      userId: 'user-1',
      provider: 'paid-provider',
      model: 'paid-model',
      metadata: {
        executionId: 'execution-1',
        correlationId: 'correlation-1',
        requestId: 'request-1',
      },
      estimate: {
        pricingStatus: 'CALCULATED' as const,
        estimatedCostMicros: '100',
        estimatedInputTokens: 10,
        estimatedOutputTokens: 20,
      },
      attemptSequence: 1,
      attemptKind: 'PRIMARY' as const,
    };

    const first = await service.reserve(input);
    const second = await service.reserve(input);

    expect(first.reservationId).toMatch(/^ai-budget-reservation-/u);
    expect(second.reservationId).toBe(first.reservationId);
    expect(fixture.updateRun).toHaveBeenCalledTimes(1);
    expect(
      AiBudgetPolicyUtil.readRunEvidence(fixture.getStoredInputJson())
        .reservations,
    ).toHaveLength(1);
  });

  it('blocks an unpriced provider when policy mode is BLOCK', async () => {
    const fixture = createTransactionPrisma({
      policyRow: createGlobalPolicyRow({
        softLimitMicros: '500',
        hardLimitMicros: '1000',
        unknownPricingMode: 'BLOCK',
      }),
    });
    const service = new AiBudgetEnforcementService(fixture.prisma);

    await expect(
      service.reserve({
        runLogId: 'run-1',
        taskType: 'SALES',
        provider: 'unknown-provider',
        model: 'unknown-model',
        estimate: {
          pricingStatus: 'UNPRICED',
          estimatedCostMicros: null,
          estimatedInputTokens: 10,
          estimatedOutputTokens: 20,
        },
        attemptSequence: 1,
        attemptKind: 'PRIMARY',
      }),
    ).rejects.toMatchObject({
      reason: 'UNKNOWN_PRICING_BLOCKED',
    } satisfies Partial<AiBudgetEnforcementException>);
  });

  it('does not double count an actual attempt and its unreconciled reservation', async () => {
    const policyRow = createGlobalPolicyRow({
      softLimitMicros: '500',
      hardLimitMicros: '1000',
    });
    const reservation = {
      version: AI_BUDGET_ENFORCEMENT_VERSION,
      reservationId: 'reservation-1',
      status: 'RESERVED' as const,
      attemptSequence: 1,
      attemptKind: 'PRIMARY' as const,
      context: AiBudgetPolicyUtil.normalizeContext({
        runLogId: 'run-1',
        taskType: 'SALES',
        userId: 'user-1',
        provider: 'paid-provider',
        model: 'paid-model',
      }),
      pricingStatus: 'CALCULATED' as const,
      estimatedCostMicros: '100',
      actualCostMicros: null,
      deltaCostMicros: null,
      providerAttemptId: null,
      providerAttemptStatus: null,
      policyDecisions: [],
      reservedAt: '2026-07-23T10:00:00.000Z',
      reconciledAt: null,
    };
    const findPolicies = jest.fn().mockResolvedValue([policyRow]);
    const findRuns = jest.fn().mockResolvedValue([
      {
        id: 'run-1',
        taskType: 'SALES',
        userId: 'user-1',
        provider: 'paid-provider',
        model: 'paid-model',
        inputJson: {
          budgetEnforcement: {
            version: AI_BUDGET_ENFORCEMENT_VERSION,
            decisions: [],
            reservations: [reservation],
          },
        },
        tokenUsageJson: {
          accountingVersion: '1.0.0',
          attempts: [
            {
              attemptId: 'attempt-1',
              sequence: 1,
              kind: 'PRIMARY',
              status: 'SUCCESS',
              provider: 'paid-provider',
              model: 'paid-model',
              usage: {
                inputTokens: 10,
                outputTokens: 20,
                totalTokens: 30,
                cachedInputTokens: 0,
                cacheWriteTokens: 0,
                reasoningTokens: 0,
                reported: true,
                source: 'PROVIDER',
              },
              cost: {
                status: 'CALCULATED',
                currency: 'USD',
                unit: 'MICRO_USD',
                totalCostMicros: '40',
              },
              lineage: {
                taskType: 'FALLBACK',
                agentId: null,
                executionId: null,
                correlationId: null,
                requestId: null,
              },
            },
          ],
        },
        createdAt: new Date('2026-07-23T10:00:00.000Z'),
        deletedAt: null,
      },
    ]);
    const prisma = {
      aiGuardrailRule: {
        findMany: findPolicies,
      },
      aiRunLog: {
        findMany: findRuns,
      },
    } as unknown as PrismaService;
    const service = new AiBudgetEnforcementService(prisma);

    const report = await service.getUsageReport();

    expect(report.policies[0]).toMatchObject({
      actualCostMicros: '40',
      activeReservationMicros: '0',
      committedCostMicros: '40',
    });
  });
});
