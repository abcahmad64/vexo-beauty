import { Injectable, Logger } from '@nestjs/common';

import { QueueProducerService } from '../../queue/services/queue-producer.service';
import { QueueJobMetadataUtil } from '../../queue/utils/queue-job-metadata.util';
import {
  SCHEDULER_LOCK_KEYS,
  SCHEDULER_TASK_NAMES,
} from '../constants/scheduler.constants';
import { SchedulerConfigService } from '../services/scheduler-config.service';
import { SchedulerTaskRunnerService } from '../services/scheduler-task-runner.service';
import type {
  SchedulerTaskDetails,
  SchedulerTaskResult,
} from '../types/scheduler.types';

type SchedulerTrigger = 'cron' | 'manual';

@Injectable()
export class MediaCleanupScheduler {
  private readonly logger = new Logger(MediaCleanupScheduler.name);

  constructor(
    private readonly schedulerConfigService: SchedulerConfigService,
    private readonly taskRunner: SchedulerTaskRunnerService,
    private readonly queueProducerService: QueueProducerService,
  ) {}

  async runOnce(
    trigger: SchedulerTrigger = 'manual',
  ): Promise<SchedulerTaskResult> {
    const config = this.schedulerConfigService.getConfig();
    const normalizedTrigger = this.normalizeTrigger(trigger);
    const olderThanMinutes = this.normalizeOlderThanMinutes(
      config.mediaCleanup.olderThanMinutes,
    );
    const dryRun = Boolean(config.mediaCleanup.dryRun);

    const result = await this.taskRunner.execute({
      taskName: SCHEDULER_TASK_NAMES.MEDIA_CLEANUP,
      lockKey: SCHEDULER_LOCK_KEYS.MEDIA_CLEANUP,
      enabled: config.enabled && config.mediaCleanup.enabled,
      run: async (): Promise<SchedulerTaskDetails> => {
        const enqueued =
          await this.queueProducerService.enqueueTemporaryMediaCleanup({
            olderThanMinutes,
            dryRun,
            metadata: QueueJobMetadataUtil.create({
              source: `scheduler.media-cleanup.${normalizedTrigger}`,
            }),
          });

        return {
          trigger: normalizedTrigger,
          queueName: enqueued.queueName,
          jobName: enqueued.jobName,
          jobId: enqueued.jobId,
          olderThanMinutes,
          dryRun,
        };
      },
    });

    if (!result.success) {
      this.logger.error(
        `${SCHEDULER_TASK_NAMES.MEDIA_CLEANUP} failed: ${result.message}`,
      );
    }

    return result;
  }

  private normalizeTrigger(trigger: SchedulerTrigger): SchedulerTrigger {
    return trigger === 'cron' ? 'cron' : 'manual';
  }

  private normalizeOlderThanMinutes(value: number): number {
    if (!Number.isInteger(value) || value < 1) {
      return 1_440;
    }

    return value;
  }
}
