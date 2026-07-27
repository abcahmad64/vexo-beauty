import { AiAlertRunbookService } from './ai-alert-runbook.service';

describe('AiAlertRunbookService', () => {
  it('stores a versioned runbook in AiGuardrailRule', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'r1',
      name: 'SLO breach',
      pattern: JSON.stringify({
        schemaVersion: '1.0.0',
        policyVersion: 1,
        source: 'SLO',
        decision: 'BREACHED',
        severity: 'CRITICAL',
        scope: null,
        scopeValue: null,
        title: 'SLO breach',
        url: 'https://ops.example.com/runbooks/slo',
        owner: 'AI Platform',
        summary: null,
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
    const prisma = {
      aiGuardrailRule: {
        findMany: jest.fn().mockResolvedValue([]),
        create,
      },
    };
    const service = new AiAlertRunbookService(prisma as never);
    const result = await service.createRunbook(
      {
        name: 'SLO breach',
        source: 'SLO',
        decision: 'BREACHED',
        severity: 'CRITICAL',
        title: 'SLO breach',
        url: 'https://ops.example.com/runbooks/slo',
        owner: 'AI Platform',
      },
      'admin-1',
    );
    expect(result.id).toBe('r1');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
