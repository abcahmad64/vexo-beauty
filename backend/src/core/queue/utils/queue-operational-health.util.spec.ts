import type {
  QueueOperationalHealthThresholds,
  QueueOperationalMetrics,
} from '../types/queue.types';

import { QueueOperationalHealthUtil } from './queue-operational-health.util';

const thresholds: QueueOperationalHealthThresholds = {
  backlogWarningThreshold: 25,
  backlogCriticalThreshold: 100,
  failedWarningThreshold: 10,
  failedCriticalThreshold: 50,
  delayedWarningThreshold: 25,
  delayedCriticalThreshold: 100,
  failureRateWarningPercent: 20,
  failureRateCriticalPercent: 50,
  failureRateMinSample: 20,
};

function createMetrics(
  overrides: Partial<QueueOperationalMetrics> = {},
): QueueOperationalMetrics {
  return {
    name: 'ai',
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    paused: 0,
    prioritized: 0,
    waitingChildren: 0,
    workersCount: 0,
    queuePaused: false,
    backlog: 0,
    historical: QueueOperationalHealthUtil.buildHistoricalMetrics(0, 0, 20),
    ...overrides,
  };
}

describe('QueueOperationalHealthUtil', () => {
  it('keeps an idle queue healthy even when worker discovery reports zero', () => {
    const health = QueueOperationalHealthUtil.assessQueue(
      createMetrics({
        workersCount: 0,
      }),
      thresholds,
    );

    expect(health.level).toBe('HEALTHY');
    expect(health.ready).toBe(true);
    expect(health.signals).toHaveLength(0);
    expect(health.workersCountEnforced).toBe(false);
    expect(health.workersCountPolicy).toBe('INFORMATIONAL_ONLY');
  });

  it('marks a single threshold breach as warning', () => {
    const health = QueueOperationalHealthUtil.assessQueue(
      createMetrics({
        waiting: 25,
        backlog: 25,
      }),
      thresholds,
    );

    expect(health.level).toBe('WARNING');
    expect(health.ready).toBe(true);
    expect(health.signals.map((signal) => signal.code)).toEqual(['BACKLOG']);
  });

  it('marks multiple warning signals as degraded', () => {
    const health = QueueOperationalHealthUtil.assessQueue(
      createMetrics({
        waiting: 25,
        backlog: 25,
        failed: 10,
      }),
      thresholds,
    );

    expect(health.level).toBe('DEGRADED');
    expect(health.ready).toBe(false);
    expect(health.signals.map((signal) => signal.code)).toEqual([
      'BACKLOG',
      'FAILED',
    ]);
  });

  it('marks a critical threshold breach as critical', () => {
    const health = QueueOperationalHealthUtil.assessQueue(
      createMetrics({
        failed: 50,
      }),
      thresholds,
    );

    expect(health.level).toBe('CRITICAL');
    expect(health.critical).toBe(true);
  });

  it('only evaluates failure rate when the historical sample is sufficient', () => {
    const insufficient = QueueOperationalHealthUtil.assessQueue(
      createMetrics({
        historical: QueueOperationalHealthUtil.buildHistoricalMetrics(3, 2, 20),
      }),
      thresholds,
    );

    const sufficient = QueueOperationalHealthUtil.assessQueue(
      createMetrics({
        historical: QueueOperationalHealthUtil.buildHistoricalMetrics(
          15,
          5,
          20,
        ),
      }),
      thresholds,
    );

    expect(insufficient.signals).toHaveLength(0);
    expect(sufficient.signals.map((signal) => signal.code)).toEqual([
      'FAILURE_RATE',
    ]);
    expect(sufficient.level).toBe('WARNING');
  });

  it('marks a paused queue with backlog as degraded without worker enforcement', () => {
    const health = QueueOperationalHealthUtil.assessQueue(
      createMetrics({
        queuePaused: true,
        waiting: 1,
        backlog: 1,
        workersCount: 0,
      }),
      thresholds,
    );

    expect(health.level).toBe('DEGRADED');
    expect(health.signals[0]).toMatchObject({
      code: 'PAUSED_WITH_BACKLOG',
      level: 'DEGRADED',
    });
    expect(health.workersCountEnforced).toBe(false);
  });
});
