import { AiModelRolloutReportService } from './ai-model-rollout-report.service';
describe('AiModelRolloutReportService', () => {
  it('exposes read-only report method', () => {
    const service = new AiModelRolloutReportService({} as never, {} as never);
    expect(typeof service.getReport).toBe('function');
  });
});
