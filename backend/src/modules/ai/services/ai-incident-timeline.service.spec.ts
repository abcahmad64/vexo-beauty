import { AiIncidentTimelineService } from './ai-incident-timeline.service';

describe('AiIncidentTimelineService', () => {
  it('opens an append-only event and redacts evidence', async () => {
    const incidentId = '11111111-1111-4111-8111-111111111111';
    const occurredAt = '2026-07-24T00:00:00.000Z';
    const storedDocument = {
      version: '1.0.0' as const,
      incidentId,
      sequence: 1,
      eventType: 'OPENED' as const,
      severity: 'CRITICAL' as const,
      status: 'OPEN' as const,
      source: 'SLO',
      title: 'Breach',
      summary: null,
      actorId: 'admin',
      occurredAt,
      correlation: {
        requestId: null,
        traceId: null,
        runId: null,
        jobId: null,
      },
      runbookIds: [],
      evidence: { token: '[REDACTED]' },
      metadata: null,
    };
    const createdRow = {
      id: 'e1',
      name: 'OPENED',
      description: null,
      category: 'AI_INCIDENT_TIMELINE_V1',
      timestamp: new Date(occurredAt),
      userId: 'admin',
      data: storedDocument,
      createdAt: new Date(occurredAt),
    };
    const create = jest.fn<Promise<typeof createdRow>, [unknown]>();
    create.mockResolvedValue(createdRow);

    const tx = {
      $queryRaw: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue([]),
      event: { create },
    };
    const findMany = jest
      .fn<Promise<(typeof createdRow)[]>, [unknown?]>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([createdRow]);
    const transaction = jest.fn<
      Promise<unknown>,
      [(client: typeof tx) => Promise<unknown>]
    >();
    transaction.mockImplementation(async (callback) => callback(tx));

    const prisma = {
      event: { findMany },
      $transaction: transaction,
    };
    const service = new AiIncidentTimelineService(prisma as never);

    const result = await service.openIncident(
      {
        incidentId,
        severity: 'CRITICAL',
        source: 'SLO',
        title: 'Breach',
        evidence: { token: 'secret' },
        occurredAt,
      },
      'admin',
    );

    expect(result.currentStatus).toBe('OPEN');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
