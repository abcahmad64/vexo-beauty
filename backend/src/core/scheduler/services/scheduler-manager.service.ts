import { BadRequestException, Injectable } from '@nestjs/common';

import { SCHEDULER_TASK_NAMES } from '../constants/scheduler.constants';
import type {
  SchedulerStatusReport,
  SchedulerTaskName,
  SchedulerTaskResult,
  SchedulerTaskStatusItem,
} from '../types/scheduler.types';
import { SchedulerConfigService } from './scheduler-config.service';
import { SchedulerRegistryService } from './scheduler-registry.service';
import { MediaCleanupScheduler } from '../tasks/media-cleanup.scheduler';
import { QueueHealthScheduler } from '../tasks/queue-health.scheduler';

interface BuildTaskStatusInput {
  readonly taskName: SchedulerTaskName;
  readonly enabled: boolean;
  readonly cron: string;
  readonly timezone: string;
  readonly description: string;
}

@Injectable()
export class SchedulerManagerService {
  private readonly allowedTasks: readonly SchedulerTaskName[] = [
    SCHEDULER_TASK_NAMES.MEDIA_CLEANUP,
    SCHEDULER_TASK_NAMES.QUEUE_HEALTH,
  ];

  constructor(
    private readonly schedulerConfigService: SchedulerConfigService,
    private readonly schedulerRegistryService: SchedulerRegistryService,
    private readonly mediaCleanupScheduler: MediaCleanupScheduler,
    private readonly queueHealthScheduler: QueueHealthScheduler,
  ) {}

  getStatus(): SchedulerStatusReport {
    const config = this.schedulerConfigService.getConfig();

    return {
      enabled: config.enabled,
      timezone: config.timezone,
      checkedAt: new Date().toISOString(),
      tasks: [
        this.buildTaskStatus({
          taskName: SCHEDULER_TASK_NAMES.MEDIA_CLEANUP,
          enabled: config.enabled && config.mediaCleanup.enabled,
          cron: config.mediaCleanup.cron,
          timezone: config.timezone,
          description: 'ارسال Job پاک‌سازی فایل‌های موقت رسانه به صف Media.',
        }),
        this.buildTaskStatus({
          taskName: SCHEDULER_TASK_NAMES.QUEUE_HEALTH,
          enabled: config.enabled && config.queueHealth.enabled,
          cron: config.queueHealth.cron,
          timezone: config.timezone,
          description: 'بررسی سلامت صف‌ها و هشدار درباره Jobهای شکست‌خورده.',
        }),
      ],
    };
  }

  async runTask(taskNameInput: string): Promise<SchedulerTaskResult> {
    const taskName = this.normalizeTaskName(taskNameInput);

    switch (taskName) {
      case SCHEDULER_TASK_NAMES.MEDIA_CLEANUP:
        return this.mediaCleanupScheduler.runOnce('manual');

      case SCHEDULER_TASK_NAMES.QUEUE_HEALTH:
        return this.queueHealthScheduler.runOnce('manual');

      default:
        return this.assertNeverTask(taskName);
    }
  }

  private buildTaskStatus(
    input: BuildTaskStatusInput,
  ): SchedulerTaskStatusItem {
    return {
      taskName: input.taskName,
      enabled: input.enabled,
      registered: this.schedulerRegistryService.isRegistered(input.taskName),
      cron: this.normalizeDisplayValue(input.cron),
      timezone: this.normalizeDisplayValue(input.timezone),
      description: this.normalizeDisplayValue(input.description),
    };
  }

  private normalizeTaskName(taskNameInput: string): SchedulerTaskName {
    if (typeof taskNameInput !== 'string') {
      throw new BadRequestException('Task زمان‌بندی‌شده معتبر نیست.');
    }

    const taskName = taskNameInput.trim();

    if (!this.allowedTasks.includes(taskName as SchedulerTaskName)) {
      throw new BadRequestException(
        `Task زمان‌بندی‌شده معتبر نیست: ${taskNameInput}`,
      );
    }

    return taskName as SchedulerTaskName;
  }

  private normalizeDisplayValue(value: string): string {
    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : '-';
  }

  private assertNeverTask(taskName: never): never {
    throw new BadRequestException(
      `Task زمان‌بندی‌شده معتبر نیست: ${String(taskName)}`,
    );
  }
}
