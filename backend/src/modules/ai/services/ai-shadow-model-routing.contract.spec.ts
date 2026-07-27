import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('shadow routing source contract', () => {
  it('contains persistence but no provider execution path', () => {
    const source = readFileSync(
      join(__dirname, 'ai-shadow-model-routing.service.ts'),
      'utf8',
    );

    for (const forbidden of [
      '.generate(',
      'queue.add(',
      'notificationService',
      'openIncident(',
      'updateRollout(',
    ]) {
      expect(source).not.toContain(forbidden);
    }

    expect(source).toContain("mode: 'SHADOW_RESOLUTION_ONLY'");
    expect(source).toContain('routeChanged: false');
    expect(source).toContain('providerInvoked: false');
    expect(source).toContain('persistDecision');
    expect(source).toContain('decisionPersisted: false');
  });
});
