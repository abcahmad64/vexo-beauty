import type { PrismaService } from '../../../core/prisma/prisma.service';

import { AI_PROVIDER_COST_ACCOUNTING_VERSION } from '../interfaces/ai-provider-cost-accounting.interface';

import { AiProviderCostReportService } from './ai-provider-cost-report.service';

jest.mock('../../../core/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

type FindManyMock = jest.Mock<Promise<unknown[]>, [unknown]>;

const objectContaining = <T extends object>(value: T): T =>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Jest asymmetric matcher types expose any; this boundary is test-only.
  expect.objectContaining(value) as unknown as T;

const createFindManyMock = (rows: readonly unknown[]): FindManyMock => {
  const findMany = jest.fn<Promise<unknown[]>, [unknown]>();

  findMany.mockResolvedValue([...rows]);

  return findMany;
};

type PrismaMock = {
  aiRunLog: {
    findMany: FindManyMock;
  };
};

describe('AiProviderCostReportService', () => {
  it('aggregates retries by correlation and fallback attempts without double counting', async () => {
    const summary = {
      accountingVersion: AI_PROVIDER_COST_ACCOUNTING_VERSION,
      pricingCatalogVersion: '2026-07-23.v1',
      currency: 'USD',
      lineage: {
        executionId: 'execution-1',
        correlationId: 'correlation-1',
        requestId: 'request-1',
        source: 'queue',
        toolName: null,
        agentId: 'sales-agent',
        taskType: 'SALES',
        retryOrdinal: 1,
      },
      attempts: [
        {
          provider: 'ollama',
          model: 'primary',
        },
        {
          provider: 'ollama',
          model: 'fallback',
        },
      ],
      aggregateUsage: {
        inputTokens: 30,
        outputTokens: 12,
        totalTokens: 42,
        cachedInputTokens: 2,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        reported: true,
        source: 'PROVIDER_RESPONSE',
      },
      aggregateCostMicros: '9',
      pricedAttemptCount: 2,
      unpricedAttemptCount: 0,
      fallbackUsed: true,
      cancelledAttemptCount: 0,
      partialUsageAttemptCount: 1,
    };
    const prisma: PrismaMock = {
      aiRunLog: {
        findMany: createFindManyMock([
          {
            id: 'run-1',
            taskType: 'SALES',
            promptKey: 'sales.prompt',
            userId: 'user-1',
            provider: 'ollama',
            model: 'fallback',
            status: 'SUCCESS',
            latencyMs: 50,
            tokenUsageJson: summary,
            inputJson: {
              metadata: {
                correlationId: 'correlation-1',
              },
            },
            createdAt: new Date('2026-07-23T10:00:00.000Z'),
          },
          {
            id: 'legacy-run',
            taskType: 'CONTENT',
            promptKey: null,
            userId: null,
            provider: 'ollama',
            model: 'legacy',
            status: 'SUCCESS',
            latencyMs: 20,
            tokenUsageJson: {
              promptEvalCount: 1,
            },
            inputJson: {},
            createdAt: new Date('2026-07-23T09:00:00.000Z'),
          },
        ]),
      },
    };
    const service = new AiProviderCostReportService(
      prisma as unknown as PrismaService,
    );

    const report = await service.getReport({
      provider: 'ollama',
      limit: 100,
    });

    expect(prisma.aiRunLog.findMany).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({
          provider: 'ollama',
          deletedAt: null,
        }),
        take: 100,
      }),
    );
    expect(report.metrics).toEqual(
      objectContaining({
        queriedRunCount: 2,
        accountingRunCount: 1,
        legacyOrUnaccountedRunCount: 1,
        runCount: 1,
        attemptCount: 2,
        inputTokens: 30,
        outputTokens: 12,
        totalTokens: 42,
        totalCostMicros: '9',
        totalCostUsd: '0.000009',
        fallbackRunCount: 1,
      }),
    );
    expect(report.byCorrelation).toEqual([
      objectContaining({
        correlationId: 'correlation-1',
        runCount: 1,
        totalCostMicros: '9',
      }),
    ]);
    expect(report.readOnly).toBe(true);
    expect(report.costBasis).toBe('PROVIDER_TOKEN_FEE_ONLY');
  });

  it('applies an empty read-only query without writing data', async () => {
    const prisma: PrismaMock = {
      aiRunLog: {
        findMany: createFindManyMock([]),
      },
    };
    const service = new AiProviderCostReportService(
      prisma as unknown as PrismaService,
    );

    const report = await service.getReport({});

    expect(report.metrics.queriedRunCount).toBe(0);
    expect(prisma.aiRunLog.findMany).toHaveBeenCalledTimes(1);
  });
});
