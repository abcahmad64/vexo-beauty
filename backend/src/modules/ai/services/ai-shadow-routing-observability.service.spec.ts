import { AiShadowRoutingObservabilityService } from './ai-shadow-routing-observability.service';

type PersistedDecisionData = {
  requestIdFingerprint?: string;
  traceIdFingerprint?: string;
  routeChanged: boolean;
  providerInvoked: boolean;
  modelActivated: boolean;
};

type CreateInput = {
  data: PersistedDecisionData;
};

describe('AiShadowRoutingObservabilityService', () => {
  it('persists fingerprints without raw correlation values', async () => {
    const create = jest.fn((input: CreateInput) => {
      void input;
      return Promise.resolve({ id: 'row-1' });
    });
    const prisma = { aiShadowRoutingDecision: { create } };
    const service = new AiShadowRoutingObservabilityService(prisma as never);

    const persisted = await service.persistDecision(
      {
        version: '1.0.0',
        mode: 'SHADOW_RESOLUTION_ONLY',
        decisionId: 'decision-1',
        resolvedAt: '2026-07-24T00:00:00.000Z',
        subjectKeySource: 'REQUEST_ID',
        subjectKeyFingerprint: '0123456789abcdef01234567',
        requestedTask: 'PUBLIC_CHAT',
        taskType: 'PUBLIC_CHAT',
        actualRoute: { provider: 'ollama', model: 'baseline' },
        rollout: null,
        shadowRoute: { provider: 'ollama', model: 'baseline' },
        routeChanged: false,
        providerInvoked: false,
        modelActivated: false,
        decisionPersisted: false,
      },
      {
        requestId: 'secret-request',
        traceId: 'secret-trace',
      },
    );

    expect(persisted).toBe(true);
    const data = create.mock.calls[0][0].data;
    expect(JSON.stringify(data)).not.toContain('secret-request');
    expect(JSON.stringify(data)).not.toContain('secret-trace');
    expect(data.requestIdFingerprint).toMatch(/^[0-9a-f]{24}$/);
    expect(data.traceIdFingerprint).toMatch(/^[0-9a-f]{24}$/);
    expect(data.routeChanged).toBe(false);
    expect(data.providerInvoked).toBe(false);
    expect(data.modelActivated).toBe(false);
  });

  it('uses an explicit controlled cleanup', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = { aiShadowRoutingDecision: { deleteMany } };
    const service = new AiShadowRoutingObservabilityService(prisma as never);

    await expect(service.cleanupExpired(30)).resolves.toEqual({
      retentionDays: 30,
      deletedCount: 3,
      cleanupMode: 'EXPLICIT_ADMIN_CONTROLLED',
    });
  });
});
