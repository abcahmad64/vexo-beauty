import { ConfigService } from '@nestjs/config';

import { QueueConfigService } from './queue-config.service';

describe('QueueConfigService operational health contract', () => {
  it('uses safe defaults and preserves the legacy failed-warning alias', () => {
    const values = new Map<string, string | number | boolean>([
      ['SCHEDULER_QUEUE_HEALTH_FAILED_WARNING_THRESHOLD', 12],
    ]);

    const configService = {
      get: jest.fn((key: string) => values.get(key)),
    } as unknown as ConfigService;

    const config = new QueueConfigService(configService).getConfig();

    expect(config.operationalHealth).toEqual({
      backlogWarningThreshold: 25,
      backlogCriticalThreshold: 100,
      failedWarningThreshold: 12,
      failedCriticalThreshold: 50,
      delayedWarningThreshold: 25,
      delayedCriticalThreshold: 100,
      failureRateWarningPercent: 20,
      failureRateCriticalPercent: 50,
      failureRateMinSample: 20,
    });
  });

  it('normalizes critical thresholds above warning thresholds', () => {
    const values = new Map<string, string | number | boolean>([
      ['QUEUE_HEALTH_BACKLOG_WARNING_THRESHOLD', 100],
      ['QUEUE_HEALTH_BACKLOG_CRITICAL_THRESHOLD', 50],
      ['QUEUE_HEALTH_FAILED_WARNING_THRESHOLD', 50],
      ['QUEUE_HEALTH_FAILED_CRITICAL_THRESHOLD', 20],
      ['QUEUE_HEALTH_DELAYED_WARNING_THRESHOLD', 100],
      ['QUEUE_HEALTH_DELAYED_CRITICAL_THRESHOLD', 90],
      ['QUEUE_HEALTH_FAILURE_RATE_WARNING_PERCENT', 50],
      ['QUEUE_HEALTH_FAILURE_RATE_CRITICAL_PERCENT', 40],
    ]);

    const configService = {
      get: jest.fn((key: string) => values.get(key)),
    } as unknown as ConfigService;

    const config = new QueueConfigService(configService).getConfig();

    expect(config.operationalHealth).toMatchObject({
      backlogCriticalThreshold: 101,
      failedCriticalThreshold: 51,
      delayedCriticalThreshold: 101,
      failureRateCriticalPercent: 51,
    });
  });
});
