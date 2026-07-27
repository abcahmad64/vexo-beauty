import { QueueConfigService } from '../../queue/services/queue-config.service';
import { QueueMonitorService } from '../../queue/services/queue-monitor.service';
import { SchedulerLockService } from '../services/scheduler-lock.service';
import { SchedulerConfigService } from '../services/scheduler-config.service';
import { SchedulerTaskRunnerService } from '../services/scheduler-task-runner.service';

import { QueueHealthScheduler } from './queue-health.scheduler';

describe('QueueHealthScheduler', () => {
  it('returns a skipped result without reading queue status when disabled', async () => {
    const schedulerConfigService = {
      getConfig: jest.fn(() => ({
        enabled: true,
        queueHealth: {
          enabled: true,
          failedWarningThreshold: 10,
        },
      })),
    } as unknown as SchedulerConfigService;

    const queueConfigService = {
      getConfig: jest.fn(() => ({
        enabled: false,
      })),
    } as unknown as QueueConfigService;

    const executeWithLock = jest.fn();
    const getStatus = jest.fn();

    const lockService = {
      executeWithLock,
    } as unknown as SchedulerLockService;

    const queueMonitorService = {
      getStatus,
    } as unknown as QueueMonitorService;

    const taskRunner = new SchedulerTaskRunnerService(lockService);
    const scheduler = new QueueHealthScheduler(
      schedulerConfigService,
      taskRunner,
      queueConfigService,
      queueMonitorService,
    );

    const result = await scheduler.runOnce('manual');

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.details).toEqual({
      reason: 'disabled',
    });
    expect(executeWithLock).not.toHaveBeenCalled();
    expect(getStatus).not.toHaveBeenCalled();
  });

  it('returns the existing queue report as scheduler degradation details', async () => {
    const schedulerConfigService = {
      getConfig: jest.fn(() => ({
        enabled: true,
        queueHealth: {
          enabled: true,
          failedWarningThreshold: 10,
        },
      })),
    } as unknown as SchedulerConfigService;

    const queueConfigService = {
      getConfig: jest.fn(() => ({
        enabled: true,
      })),
    } as unknown as QueueConfigService;

    const lockService = {
      executeWithLock: jest.fn(
        async (_key: string, run: () => Promise<unknown>) => ({
          locked: true,
          result: await run(),
        }),
      ),
    } as unknown as SchedulerLockService;

    const queueMonitorService = {
      getStatus: jest.fn(() =>
        Promise.resolve({
          version: '1.0.0',
          healthVersion: '1.0.0',
          checkedAt: '2026-07-23T00:00:00.000Z',
          aggregate: {
            version: '1.0.0',
            queueCount: 9,
            waiting: 25,
            active: 0,
            completed: 0,
            failed: 10,
            delayed: 0,
            paused: 0,
            prioritized: 0,
            waitingChildren: 0,
            backlog: 25,
            workersCount: 0,
            pausedQueues: 0,
            historical: {
              completed: 15,
              failed: 5,
              sampleSize: 20,
              failureRatePercent: 25,
              sufficientSample: true,
            },
          },
          health: {
            version: '1.0.0',
            level: 'DEGRADED',
            ready: false,
            degraded: true,
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
              HEALTHY: 8,
              WARNING: 0,
              DEGRADED: 1,
              CRITICAL: 0,
            },
            affectedQueues: ['ai'],
            signals: [
              {
                queueName: 'ai',
                code: 'BACKLOG',
                level: 'WARNING',
                actual: 25,
                threshold: 25,
                message: 'backlog warning',
              },
              {
                queueName: 'ai',
                code: 'FAILED',
                level: 'WARNING',
                actual: 10,
                threshold: 10,
                message: 'failed warning',
              },
            ],
            workersCountEnforced: false,
            workersCountPolicy: 'INFORMATIONAL_ONLY',
          },
          queues: [
            {
              name: 'ai',
              waiting: 25,
              active: 0,
              completed: 0,
              failed: 10,
              delayed: 0,
              paused: 0,
              prioritized: 0,
              waitingChildren: 0,
              workersCount: 0,
              queuePaused: false,
              backlog: 25,
              historical: {
                completed: 15,
                failed: 5,
                sampleSize: 20,
                failureRatePercent: 25,
                sufficientSample: true,
              },
              health: {
                level: 'DEGRADED',
                ready: false,
                degraded: true,
                critical: false,
                signals: [],
                workersCountEnforced: false,
                workersCountPolicy: 'INFORMATIONAL_ONLY',
              },
            },
          ],
        }),
      ),
    } as unknown as QueueMonitorService;

    const taskRunner = new SchedulerTaskRunnerService(lockService);
    const scheduler = new QueueHealthScheduler(
      schedulerConfigService,
      taskRunner,
      queueConfigService,
      queueMonitorService,
    );

    const result = await scheduler.runOnce('manual');

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.details).toMatchObject({
      healthLevel: 'DEGRADED',
      ready: false,
      degraded: true,
      critical: false,
      affectedQueuesCount: 1,
      affectedQueues: ['ai'],
      workersCountEnforced: false,
      workersCountPolicy: 'INFORMATIONAL_ONLY',
    });
  });
});
