import {
  QUEUE_METRICS_AGGREGATION_VERSION,
  QUEUE_OPERATIONAL_HEALTH_VERSION,
} from '../../../core/queue/types/queue.types';
import { QueueOperationalHealthUtil } from '../../../core/queue/utils/queue-operational-health.util';

describe('AI queue metrics governance contract', () => {
  it('keeps queue metrics and operational health versioned and privacy-safe', () => {
    const snapshot = QueueOperationalHealthUtil.getSnapshot();

    expect(QUEUE_METRICS_AGGREGATION_VERSION).toBe('1.0.0');
    expect(QUEUE_OPERATIONAL_HEALTH_VERSION).toBe('1.0.0');
    expect(snapshot).toEqual({
      version: '1.0.0',
      metricsVersion: '1.0.0',
      workerCountPolicy: 'INFORMATIONAL_ONLY',
      workerCountEnforced: false,
      degradationLevels: ['WARNING', 'DEGRADED', 'CRITICAL'],
      signalCodes: [
        'BACKLOG',
        'FAILED',
        'DELAYED',
        'FAILURE_RATE',
        'PAUSED_WITH_BACKLOG',
      ],
    });
  });
});
