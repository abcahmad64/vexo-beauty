import { BullRegistrar } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Queue } from 'bullmq';
import type { QueueOptions } from 'bullmq';

import { ALL_QUEUE_NAMES } from '../constants/queue.constants';
import type {
  QueueJobName,
  QueueJobResult,
  QueueName,
  VexoQueueJobData,
} from '../types/queue.types';

import { QueueConfigService } from './queue-config.service';

type VexoBullQueue = Queue<VexoQueueJobData, QueueJobResult, QueueJobName>;

const DISABLED_QUEUE_REFERENCE = Symbol('vexo.disabled-queue-reference');

interface DisabledQueueReference {
  readonly [DISABLED_QUEUE_REFERENCE]: true;
  readonly name: QueueName;
  readonly opts: QueueOptions;
  readonly connection: {
    readonly status: 'closed';
  };
}

export function isDisabledQueueReference(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    (value as Partial<DisabledQueueReference>)[DISABLED_QUEUE_REFERENCE] ===
    true
  );
}

@Injectable()
export class QueueRuntimeService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly queueReferences = new Map<QueueName, VexoBullQueue>();
  private workersRegistered = false;

  constructor(
    private readonly queueConfigService: QueueConfigService,
    private readonly moduleRef: ModuleRef,
  ) {}

  getQueue(queueName: QueueName): VexoBullQueue {
    this.assertKnownQueue(queueName);

    const existingQueue = this.queueReferences.get(queueName);

    if (existingQueue) {
      return existingQueue;
    }

    const queue = this.queueConfigService.getConfig().enabled
      ? this.createRedisBackedQueue(queueName)
      : this.createDisabledQueueReference(queueName);

    this.queueReferences.set(queueName, queue);

    return queue;
  }

  onModuleInit(): void {
    if (
      !this.queueConfigService.getConfig().enabled ||
      this.workersRegistered
    ) {
      return;
    }

    // Worker discovery is deliberately manual so disabled mode never creates
    // Redis-backed workers or queue event listeners.
    const bullRegistrar = this.moduleRef.get(BullRegistrar, { strict: false });

    bullRegistrar.register();
    this.workersRegistered = true;
  }

  async onApplicationShutdown(): Promise<void> {
    const activeQueues = [...this.queueReferences.values()].filter(
      (queue) => !isDisabledQueueReference(queue),
    );

    await Promise.all(activeQueues.map((queue) => this.closeQueue(queue)));

    this.queueReferences.clear();
    this.workersRegistered = false;
  }

  private createRedisBackedQueue(queueName: QueueName): VexoBullQueue {
    const config = this.queueConfigService.getConfig();

    return new Queue<VexoQueueJobData, QueueJobResult, QueueJobName>(
      queueName,
      {
        connection: this.queueConfigService.createBullConnectionOptions(),
        prefix: config.prefix,
        defaultJobOptions: this.queueConfigService.createDefaultJobOptions(),
      },
    );
  }

  private createDisabledQueueReference(queueName: QueueName): VexoBullQueue {
    const unavailable = (): Promise<never> =>
      Promise.reject(
        new ServiceUnavailableException('سیستم صف در حال حاضر غیرفعال است.'),
      );

    const queueReference: DisabledQueueReference & Record<string, unknown> = {
      [DISABLED_QUEUE_REFERENCE]: true,
      name: queueName,
      opts: {
        prefix: this.queueConfigService.getConfig().prefix,
        connection: {},
      },
      connection: {
        status: 'closed',
      },
      add: unavailable,
      getJob: unavailable,
      getJobs: unavailable,
      getJobCounts: unavailable,
      pause: unavailable,
      resume: unavailable,
      close: (): Promise<void> => Promise.resolve(),
      disconnect: (): Promise<void> => Promise.resolve(),
    };

    return Object.freeze(queueReference) as unknown as VexoBullQueue;
  }

  private async closeQueue(queue: VexoBullQueue): Promise<void> {
    await queue.close();

    const connectionStatus = (
      queue as unknown as {
        readonly connection?: {
          readonly status?: string;
        };
      }
    ).connection?.status;

    if (connectionStatus !== 'closed') {
      await queue.disconnect();
    }
  }

  private assertKnownQueue(queueName: QueueName): void {
    if (!ALL_QUEUE_NAMES.includes(queueName)) {
      throw new BadRequestException(`Unknown queue: ${String(queueName)}`);
    }
  }
}
