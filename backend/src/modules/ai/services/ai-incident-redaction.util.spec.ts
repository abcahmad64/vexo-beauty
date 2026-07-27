import { AiIncidentRedactionUtil } from './ai-incident-redaction.util';
describe('AiIncidentRedactionUtil', () => {
  it('redacts sensitive values', () => {
    expect(
      AiIncidentRedactionUtil.object({
        apiKey: 'x',
        nested: { owner: 'ops@example.com' },
      }),
    ).toEqual({ apiKey: '[REDACTED]', nested: { owner: '[REDACTED_EMAIL]' } });
  });
});
