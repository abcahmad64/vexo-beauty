import { QueueMonitorService } from '../../../core/queue/services/queue-monitor.service';

import { AiRerankerClientService } from './ai-reranker-client.service';
import { AiRuntimeCoordinatorService } from './ai-runtime-coordinator.service';
import { AiRuntimeHealthService } from './ai-runtime-health.service';
import { OllamaClientService } from './ollama-client.service';

const requiredModels = [
  'qwen3.5:9b',
  'qwen3:14b',
  'qwen3-vl:8b',
  'qwen3-embedding:4b',
];

function createQueueReport(
  level: 'HEALTHY' | 'WARNING' | 'DEGRADED' | 'CRITICAL',
) {
  return {
    version: '1.0.0',
    healthVersion: '1.0.0',
    checkedAt: '2026-07-23T00:00:00.000Z',
    queues: [],
    aggregate: {
      version: '1.0.0',
      queueCount: 9,
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
      level,
      ready: level === 'HEALTHY' || level === 'WARNING',
      degraded: level === 'DEGRADED' || level === 'CRITICAL',
      critical: level === 'CRITICAL',
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
        HEALTHY: level === 'HEALTHY' ? 9 : 8,
        WARNING: level === 'WARNING' ? 1 : 0,
        DEGRADED: level === 'DEGRADED' ? 1 : 0,
        CRITICAL: level === 'CRITICAL' ? 1 : 0,
      },
      affectedQueues: level === 'HEALTHY' ? [] : ['ai'],
      signals: [],
      workersCountEnforced: false,
      workersCountPolicy: 'INFORMATIONAL_ONLY',
    },
  };
}

function createService(level: 'WARNING' | 'DEGRADED') {
  const ollamaClient = {
    health: jest.fn(() =>
      Promise.resolve({
        ok: true,
        models: requiredModels,
      }),
    ),
  } as unknown as OllamaClientService;

  const rerankerClient = {
    health: jest.fn(() =>
      Promise.resolve({
        ok: true,
      }),
    ),
  } as unknown as AiRerankerClientService;

  const runtimeCoordinator = {
    getSnapshot: jest.fn(() => ({
      version: '1.0.0',
    })),
  } as unknown as AiRuntimeCoordinatorService;

  const queueMonitorService = {
    getStatus: jest.fn(() => Promise.resolve(createQueueReport(level))),
  } as unknown as QueueMonitorService;

  return new AiRuntimeHealthService(
    ollamaClient,
    rerankerClient,
    runtimeCoordinator,
    undefined,
    undefined,
    undefined,
    queueMonitorService,
  );
}

describe('AiRuntimeHealthService queue operational health', () => {
  it('keeps warning-level queue health ready', async () => {
    const health = await createService('WARNING').getHealth();

    expect(health.ready).toBe(true);
    expect(health.status).toBe('READY');
    expect(health.foundation.queueOperationalReady).toBe(true);
    expect(health.foundation.queueOperationalHealth).toMatchObject({
      available: true,
      ready: true,
      level: 'WARNING',
    });
  });

  it('degrades AI runtime health for degraded queue operations', async () => {
    const health = await createService('DEGRADED').getHealth();

    expect(health.ready).toBe(false);
    expect(health.status).toBe('DEGRADED');
    expect(health.foundation.queueOperationalReady).toBe(false);
    expect(health.foundation.queueOperationalHealth).toMatchObject({
      available: true,
      ready: false,
      level: 'DEGRADED',
    });
  });
});
