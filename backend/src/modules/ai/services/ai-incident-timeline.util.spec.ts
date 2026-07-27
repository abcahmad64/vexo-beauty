import { AiIncidentTimelineUtil } from './ai-incident-timeline.util';
describe('AiIncidentTimelineUtil', () => {
  it('enforces lifecycle transitions', () => {
    expect(AiIncidentTimelineUtil.nextStatus(null, 'OPENED')).toBe('OPEN');
    expect(AiIncidentTimelineUtil.nextStatus('OPEN', 'ACKNOWLEDGED')).toBe(
      'ACKNOWLEDGED',
    );
    expect(
      AiIncidentTimelineUtil.nextStatus('ACKNOWLEDGED', 'MITIGATION_STARTED'),
    ).toBe('MITIGATING');
    expect(AiIncidentTimelineUtil.nextStatus('MITIGATING', 'MITIGATED')).toBe(
      'MITIGATED',
    );
    expect(AiIncidentTimelineUtil.nextStatus('MITIGATED', 'RESOLVED')).toBe(
      'RESOLVED',
    );
    expect(AiIncidentTimelineUtil.nextStatus('RESOLVED', 'REOPENED')).toBe(
      'OPEN',
    );
  });
  it('rejects invalid transitions', () => {
    expect(() =>
      AiIncidentTimelineUtil.nextStatus('RESOLVED', 'ACKNOWLEDGED'),
    ).toThrow('not allowed');
  });
});
