import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Queue } from 'bullmq';

import { QUEUE_JOB_NAMES, QUEUE_NAMES } from '../constants/queue.constants';
import type { QueueConfig, QueueName } from '../types/queue.types';

import { QueueConfigService } from './queue-config.service';
import {
  isDisabledQueueReference,
  QueueRuntimeService,
} from './queue-runtime.service';

jest.mock('bullmq', () => ({
  Queue: jest.fn(),
}));

const OPERATIONAL_HEALTH_CONFIG: QueueConfig['operationalHealth'] = {
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

const ENABLED_CONFIG: QueueConfig = {
  enabled: true,
  redisRequired: true,
  prefix: 'vexo:queue:test',
  defaultAttempts: 3,
  defaultBackoffDelayMs: 5_000,
  defaultTimeoutMs: 60_000,
  removeOnCompleteCount: 100,
  removeOnFailCount: 200,
  workerConcurrency: 5,
  stalledIntervalMs: 30_000,
  maxStalledCount: 1,
  operationalHealth: OPERATIONAL_HEALTH_CONFIG,
};

describe('QueueRuntimeService', () => {
  const QueueConstructor = Queue as unknown as jest.Mock;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns a cached disabled reference without constructing BullMQ Queue', async () => {
    const queueConfigService = {
      getConfig: jest.fn(() => ({
        ...ENABLED_CONFIG,
        enabled: false,
      })),
      createBullConnectionOptions: jest.fn(),
      createDefaultJobOptions: jest.fn(),
    } as unknown as QueueConfigService;

    const bullRegistrar = {
      register: jest.fn(),
    };
    const moduleRef = {
      get: jest.fn(() => bullRegistrar),
    } as unknown as ModuleRef;

    const service = new QueueRuntimeService(queueConfigService, moduleRef);

    const firstQueue = service.getQueue(QUEUE_NAMES.NOTIFICATION);
    const secondQueue = service.getQueue(QUEUE_NAMES.NOTIFICATION);

    expect(firstQueue).toBe(secondQueue);
    expect(isDisabledQueueReference(firstQueue)).toBe(true);
    expect(QueueConstructor).not.toHaveBeenCalled();

    await expect(
      firstQueue.add(QUEUE_JOB_NAMES.NOTIFICATION_DATABASE, {
        title: 'Test',
        message: 'Test',
        type: 'test',
        metadata: {
          createdAt: new Date().toISOString(),
        },
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    service.onModuleInit();

    expect(bullRegistrar.register).not.toHaveBeenCalled();

    await service.onApplicationShutdown();
  });

  it('creates one real queue, registers workers once, and closes the queue', async () => {
    const close = jest.fn().mockResolvedValue(undefined);
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const queueReference = {
      name: QUEUE_NAMES.ORDER,
      opts: {
        prefix: ENABLED_CONFIG.prefix,
      },
      connection: {
        status: 'ready',
      },
      close,
      disconnect,
    };

    QueueConstructor.mockImplementation(() => queueReference);

    const queueConfigService = {
      getConfig: jest.fn(() => ENABLED_CONFIG),
      createBullConnectionOptions: jest.fn(() => ({
        host: '127.0.0.1',
        port: 6379,
      })),
      createDefaultJobOptions: jest.fn(() => ({
        attempts: 3,
      })),
    } as unknown as QueueConfigService;

    const bullRegistrar = {
      register: jest.fn(),
    };
    const moduleRef = {
      get: jest.fn(() => bullRegistrar),
    } as unknown as ModuleRef;

    const service = new QueueRuntimeService(queueConfigService, moduleRef);

    const firstQueue = service.getQueue(QUEUE_NAMES.ORDER);
    const secondQueue = service.getQueue(QUEUE_NAMES.ORDER);

    expect(firstQueue).toBe(secondQueue);
    expect(QueueConstructor).toHaveBeenCalledTimes(1);

    service.onModuleInit();
    service.onModuleInit();

    expect(bullRegistrar.register).toHaveBeenCalledTimes(1);

    await service.onApplicationShutdown();

    expect(close).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('rejects queue names outside the declared contract', () => {
    const queueConfigService = {
      getConfig: jest.fn(() => ENABLED_CONFIG),
    } as unknown as QueueConfigService;

    const moduleRef = {
      get: jest.fn(),
    } as unknown as ModuleRef;

    const service = new QueueRuntimeService(queueConfigService, moduleRef);

    expect(() => service.getQueue('unknown' as QueueName)).toThrow(
      BadRequestException,
    );
  });
});
