import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import {
  SCHEDULER_TASK_NAMES,
  type SchedulerTaskName,
} from '../constants/scheduler.constants';
import { SchedulerConfigService } from './scheduler-config.service';
import { MediaCleanupScheduler } from '../tasks/media-cleanup.scheduler';
import { QueueHealthScheduler } from '../tasks/queue-health.scheduler';

interface RegisterCronJobInput {
  readonly name: SchedulerTaskName;
  readonly enabled: boolean;
  readonly cron: string;
  readonly timezone: string;
  readonly onTick: () => Promise<void>;
}

@Injectable()
export class SchedulerRegistryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerRegistryService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly schedulerConfigService: SchedulerConfigService,
    private readonly mediaCleanupScheduler: MediaCleanupScheduler,
    private readonly queueHealthScheduler: QueueHealthScheduler,
  ) {}

  onModuleInit(): void {
    this.registerConfiguredJobs();
  }

  onModuleDestroy(): void {
    this.deleteConfiguredJobs();
  }

  registerConfiguredJobs(): void {
    const config = this.schedulerConfigService.getConfig();

    this.deleteConfiguredJobs();

    if (!config.enabled) {
      this.logger.warn('Scheduler غیرفعال است؛ هیچ Cron Job ثبت نشد.');
      return;
    }

    this.registerCronJob({
      name: SCHEDULER_TASK_NAMES.MEDIA_CLEANUP,
      enabled: config.mediaCleanup.enabled,
      cron: config.mediaCleanup.cron,
      timezone: config.timezone,
      onTick: async () => {
        await this.mediaCleanupScheduler.runOnce('cron');
      },
    });

    this.registerCronJob({
      name: SCHEDULER_TASK_NAMES.QUEUE_HEALTH,
      enabled: config.queueHealth.enabled,
      cron: config.queueHealth.cron,
      timezone: config.timezone,
      onTick: async () => {
        await this.queueHealthScheduler.runOnce('cron');
      },
    });
  }

  isRegistered(name: string): boolean {
    const normalizedName = this.normalizeString(name);

    if (!normalizedName) {
      return false;
    }

    try {
      this.schedulerRegistry.getCronJob(normalizedName);
      return true;
    } catch {
      return false;
    }
  }

  private registerCronJob(input: RegisterCronJobInput): void {
    const name = this.normalizeString(input.name);
    const cron = this.normalizeString(input.cron);
    const timezone = this.normalizeString(input.timezone);

    if (!name || !cron || !timezone) {
      this.logger.warn(
        `ثبت Scheduler task انجام نشد؛ تنظیمات ناقص است: ${input.name}`,
      );
      return;
    }

    if (!input.enabled) {
      this.logger.warn(`Scheduler task غیرفعال است: ${name}`);
      return;
    }

    try {
      const job = new CronJob(
        cron,
        () => {
          void this.runCronJobSafely(name, input.onTick);
        },
        null,
        false,
        timezone,
      );

      this.schedulerRegistry.addCronJob(name, job);
      job.start();

      this.logger.log(
        `Scheduler task ثبت شد: ${name}; cron=${cron}; timezone=${timezone}`,
      );
    } catch (error) {
      this.logger.error(
        `ثبت Scheduler task ناموفق بود: ${name}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async runCronJobSafely(
    name: string,
    onTick: () => Promise<void>,
  ): Promise<void> {
    try {
      await onTick();
    } catch (error) {
      this.logger.error(
        `اجرای Scheduler task ناموفق بود: ${name}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private deleteConfiguredJobs(): void {
    this.deleteJobIfExists(SCHEDULER_TASK_NAMES.MEDIA_CLEANUP);
    this.deleteJobIfExists(SCHEDULER_TASK_NAMES.QUEUE_HEALTH);
  }

  private deleteJobIfExists(name: string): void {
    const normalizedName = this.normalizeString(name);

    if (!normalizedName) {
      return;
    }

    try {
      this.schedulerRegistry.deleteCronJob(normalizedName);

      this.logger.debug(`Scheduler task حذف شد: ${normalizedName}`);
    } catch {
      return;
    }
  }

  private normalizeString(value: string): string | null {
    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }
}
