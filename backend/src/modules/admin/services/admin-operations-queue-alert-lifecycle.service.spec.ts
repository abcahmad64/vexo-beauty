import { AdminOperationsQueueAlertLifecycleService } from './admin-operations-queue-alert-lifecycle.service';

describe('AdminOperationsQueueAlertLifecycleService', () => {
  it('performs a healthy no-op without creating notifications or outbox rows', async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const transaction = jest.fn();
    const getStatus = jest.fn().mockResolvedValue({
      version: '1.0.0',
      healthVersion: '1.0.0',
      checkedAt: '2026-07-23T00:00:00.000Z',
      queues: [],
      aggregate: {
        version: '1.0.0',
        queueCount: 0,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
        prioritized: 0,
        waitingChildren: 0,
        backlog: 0,
        workersCount: 0,
        pausedQueues: 0,
        historical: {
          completed: 0,
          failed: 0,
          sampleSize: 0,
          failureRatePercent: null,
          sufficientSample: false,
        },
      },
      health: {
        version: '1.0.0',
        level: 'HEALTHY',
        ready: true,
        degraded: false,
        critical: false,
        thresholds: {
          backlogWarningThreshold: 25,
          backlogCriticalThreshold: 100,
          failedWarningThreshold: 10,
          failedCriticalThreshold: 50,
          delayedWarningThreshold: 25,
          delayedCriticalThreshold: 100,
          failureRateWarningPercent: 20,
          failureRateCriticalPercent: 50,
          failureRateMinSample: 20,
        },
        queueLevels: {
          HEALTHY: 0,
          WARNING: 0,
          DEGRADED: 0,
          CRITICAL: 0,
        },
        affectedQueues: [],
        signals: [],
        workersCountEnforced: false,
        workersCountPolicy: 'INFORMATIONAL_ONLY',
      },
    });
    const service = new AdminOperationsQueueAlertLifecycleService(
      {
        $queryRaw: queryRaw,
        $transaction: transaction,
      } as never,
      {
        getStatus,
      } as never,
    );

    await expect(service.runNow('admin-1')).resolves.toMatchObject({
      requestedBy: 'admin-1',
      reason: 'manual',
      healthLevel: 'HEALTHY',
      signalsCount: 0,
      recipientsCount: 0,
      transitions: [],
      outboxCount: 0,
    });

    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(transaction).not.toHaveBeenCalled();
    expect(service.getStatus()).toMatchObject({
      enabled: true,
      cron: '*/5 * * * *',
      timezone: 'Asia/Tehran',
      channels: [],
      snapshot: {
        databaseMigrationRequired: false,
      },
    });
  });
});
