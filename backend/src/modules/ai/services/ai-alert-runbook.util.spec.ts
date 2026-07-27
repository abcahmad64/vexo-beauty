import { AiAlertRunbookUtil } from './ai-alert-runbook.util';

describe('AiAlertRunbookUtil', () => {
  it('creates and parses a versioned runbook document', () => {
    const doc = AiAlertRunbookUtil.createDocument({
      policyVersion: 1,
      source: 'SLO',
      decision: 'BREACHED',
      severity: 'CRITICAL',
      scope: 'MODEL',
      scopeValue: 'qwen',
      title: 'Model SLO incident',
      url: 'https://ops.example.com/runbooks/model-slo',
      owner: 'AI Platform',
      updatedById: 'admin-1',
      updatedAt: '2026-07-24T00:00:00.000Z',
    });
    expect(AiAlertRunbookUtil.parseDocument(JSON.stringify(doc))).toEqual(doc);
  });

  it('rejects scopeValue without scope', () => {
    expect(() =>
      AiAlertRunbookUtil.createDocument({
        policyVersion: 1,
        source: 'SLO',
        decision: 'WARN',
        severity: 'WARNING',
        scopeValue: 'qwen',
        title: 'Invalid',
        url: 'https://ops.example.com/runbooks/invalid',
        owner: 'AI Platform',
        updatedById: 'admin-1',
      }),
    ).toThrow('scope is required');
  });
});
