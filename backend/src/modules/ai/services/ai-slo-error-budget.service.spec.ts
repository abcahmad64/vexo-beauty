import { AiSloErrorBudgetService } from './ai-slo-error-budget.service';

const policy = {
  id: 'slo-1',
  name: 'Global AI availability',
  schemaVersion: '1.0.0' as const,
  policyVersion: 1,
  scope: 'GLOBAL' as const,
  scopeValue: null,
  window: 'ROLLING_24_HOURS' as const,
  availabilityTargetPercent: 90,
  latencyTargetMs: 1000,
  minimumSampleSize: 2,
  warningBurnRate: 0.5,
  criticalBurnRate: 1,
  effectiveFrom: null,
  effectiveTo: null,
  updatedById: 'admin-1',
  updatedAt: '2026-07-24T00:00:00.000Z',
  isActive: true,
  priority: 100,
  createdById: 'admin-1',
  createdAt: '2026-07-24T00:00:00.000Z',
  databaseUpdatedAt: '2026-07-24T00:00:00.000Z',
  deletedAt: null,
};

describe('AiSloErrorBudgetService', () => {
  it('calculates availability, burn rate and breach without writes', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'run-1',
        taskType: 'CONTENT',
        userId: null,
        provider: 'ollama',
        model: 'qwen',
        status: 'SUCCESS',
        latencyMs: 500,
        inputJson: {},
        createdAt: new Date('2026-07-23T12:00:00.000Z'),
      },
      {
        id: 'run-2',
        taskType: 'CONTENT',
        userId: null,
        provider: 'ollama',
        model: 'qwen',
        status: 'FAILED',
        latencyMs: 800,
        inputJson: {},
        createdAt: new Date('2026-07-23T13:00:00.000Z'),
      },
    ]);
    const service = new AiSloErrorBudgetService(
      { aiRunLog: { findMany } } as never,
      { findPolicies: jest.fn().mockResolvedValue([policy]) } as never,
      undefined,
    );

    const report = await service.getReport({
      asOf: '2026-07-24T00:00:00.000Z',
    });

    expect(report.overallDecision).toBe('BREACHED');
    expect(report.evaluations[0]?.sample.totalTerminalRuns).toBe(2);
    expect(report.evaluations[0]?.availability.actualPercent).toBe(50);
    expect(report.evaluations[0]?.errorBudget.burnRate).toBe(5);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('builds a typed task scope filter without widening to global data', async () => {
    type FindManyInput = {
      where?: {
        taskType?: string;
      };
    };
    const findMany = jest
      .fn<Promise<unknown[]>, [FindManyInput]>()
      .mockResolvedValue([]);
    const taskPolicy = {
      ...policy,
      id: 'slo-task-1',
      name: 'Content task SLO',
      scope: 'TASK' as const,
      scopeValue: 'CONTENT',
    };
    const service = new AiSloErrorBudgetService(
      { aiRunLog: { findMany } } as never,
      { findPolicies: jest.fn().mockResolvedValue([taskPolicy]) } as never,
      undefined,
    );

    await service.getReport({ asOf: '2026-07-24T00:00:00.000Z' });

    expect(findMany).toHaveBeenCalledTimes(1);
    const [findManyInput] = findMany.mock.calls[0];
    expect(findManyInput.where?.taskType).toBe('CONTENT');
  });

  it('returns insufficient data below minimum sample size', async () => {
    const service = new AiSloErrorBudgetService(
      { aiRunLog: { findMany: jest.fn().mockResolvedValue([]) } } as never,
      { findPolicies: jest.fn().mockResolvedValue([policy]) } as never,
      undefined,
    );
    const report = await service.getReport();
    expect(report.overallDecision).toBe('INSUFFICIENT_DATA');
  });
});
