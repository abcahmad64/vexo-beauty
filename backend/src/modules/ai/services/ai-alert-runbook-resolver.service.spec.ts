import { AiAlertRunbookResolverService } from './ai-alert-runbook-resolver.service';

describe('AiAlertRunbookResolverService', () => {
  it('returns exact SLO runbooks before generic mappings', async () => {
    const service = new AiAlertRunbookResolverService({
      findRunbooks: jest.fn().mockResolvedValue([
        {
          id: 'generic',
          name: 'Generic',
          schemaVersion: '1.0.0',
          policyVersion: 1,
          source: 'SLO',
          decision: 'ANY',
          severity: 'CRITICAL',
          scope: null,
          scopeValue: null,
          title: 'Generic',
          url: 'https://ops.example.com/generic',
          owner: 'AI',
          summary: null,
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
        {
          id: 'exact',
          name: 'Exact',
          schemaVersion: '1.0.0',
          policyVersion: 1,
          source: 'SLO',
          decision: 'BREACHED',
          severity: 'CRITICAL',
          scope: 'MODEL',
          scopeValue: 'qwen',
          title: 'Exact',
          url: 'https://ops.example.com/exact',
          owner: 'AI',
          summary: null,
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
      ]),
    } as never);
    const result = await service.resolve({
      source: 'SLO',
      decision: 'BREACHED',
      severity: 'CRITICAL',
      scope: 'MODEL',
      scopeValue: 'qwen',
      asOf: '2026-07-24T01:00:00.000Z',
    });
    expect(result.runbooks.map((item) => item.id)).toEqual([
      'exact',
      'generic',
    ]);
    expect(result.semantics.automaticExecution).toBe(false);
  });
});
