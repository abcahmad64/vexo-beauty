import { Injectable, Logger } from '@nestjs/common';

import { SchedulerLockService } from './scheduler-lock.service';
import type {
  SchedulerTaskDetails,
  SchedulerTaskExecutionInput,
  SchedulerTaskResult,
} from '../types/scheduler.types';

interface BuildSchedulerTaskResultInput {
  readonly taskName: string;
  readonly success: boolean;
  readonly skipped: boolean;
  readonly message: string;
  readonly startedAtDate: Date;
  readonly details?: SchedulerTaskDetails;
}

@Injectable()
export class SchedulerTaskRunnerService {
  private readonly logger = new Logger(SchedulerTaskRunnerService.name);

  constructor(private readonly lockService: SchedulerLockService) {}

  async execute(
    input: SchedulerTaskExecutionInput,
  ): Promise<SchedulerTaskResult> {
    const startedAtDate = new Date();
    const taskName = this.normalizeTaskName(input.taskName);

    if (!input.enabled) {
      return this.buildResult({
        taskName,
        success: true,
        skipped: true,
        message: 'Task زمان‌بندی‌شده غیرفعال است.',
        startedAtDate,
        details: {
          reason: 'disabled',
        },
      });
    }

    try {
      const lockResult = await this.lockService.executeWithLock(
        input.lockKey,
        async () => input.run(),
      );

      if (!lockResult.locked) {
        return this.buildResult({
          taskName,
          success: true,
          skipped: true,
          message:
            'Task زمان‌بندی‌شده به دلیل Lock فعال در instance دیگر اجرا نشد.',
          startedAtDate,
          details: {
            reason: 'lock_not_acquired',
          },
        });
      }

      const result = this.buildResult({
        taskName,
        success: true,
        skipped: false,
        message: 'Task زمان‌بندی‌شده با موفقیت اجرا شد.',
        startedAtDate,
        details: this.normalizeDetails(lockResult.result),
      });

      this.logger.log(`${taskName} completed in ${result.durationMs}ms`);

      return result;
    } catch (error) {
      const result = this.buildResult({
        taskName,
        success: false,
        skipped: false,
        message: this.resolveErrorMessage(error),
        startedAtDate,
        details: this.resolveErrorDetails(error),
      });

      this.logger.error(
        `${taskName} failed`,
        error instanceof Error ? error.stack : String(error),
      );

      return result;
    }
  }

  private buildResult(
    input: BuildSchedulerTaskResultInput,
  ): SchedulerTaskResult {
    const finishedAtDate = new Date();
    const details = this.normalizeDetails(input.details);

    const result: {
      taskName: string;
      success: boolean;
      skipped: boolean;
      message: string;
      startedAt: string;
      finishedAt: string;
      durationMs: number;
      details?: SchedulerTaskDetails;
    } = {
      taskName: input.taskName,
      success: input.success,
      skipped: input.skipped,
      message: this.normalizeMessage(input.message),
      startedAt: input.startedAtDate.toISOString(),
      finishedAt: finishedAtDate.toISOString(),
      durationMs: Math.max(
        0,
        finishedAtDate.getTime() - input.startedAtDate.getTime(),
      ),
    };

    if (details) {
      result.details = details;
    }

    return result;
  }

  private normalizeTaskName(value: string): string {
    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : 'scheduler.unknown';
  }

  private normalizeMessage(value: string): string {
    const normalizedValue = value.trim();

    return normalizedValue.length > 0
      ? normalizedValue
      : 'نتیجه اجرای Task زمان‌بندی‌شده ثبت شد.';
  }

  private normalizeDetails(
    value: SchedulerTaskDetails | void | undefined,
  ): SchedulerTaskDetails | undefined {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0
    ) {
      return value;
    }

    return undefined;
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message.trim();
    }

    if (typeof error === 'string' && error.trim().length > 0) {
      return error.trim();
    }

    return 'اجرای Task زمان‌بندی‌شده ناموفق بود.';
  }

  private resolveErrorDetails(error: unknown): SchedulerTaskDetails {
    if (error instanceof Error) {
      return {
        error: error.name || 'Error',
      };
    }

    return {
      error: 'UnknownError',
    };
  }
}
