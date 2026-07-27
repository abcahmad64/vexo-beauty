import type { SchedulerTaskName } from '../constants/scheduler.constants';

export type {
  SchedulerLockKey,
  SchedulerTaskName,
} from '../constants/scheduler.constants';

export type SchedulerTaskDetails = Readonly<Record<string, unknown>>;

export interface SchedulerConfig {
  readonly enabled: boolean;
  readonly timezone: string;

  readonly mediaCleanup: {
    readonly enabled: boolean;
    readonly cron: string;
    readonly olderThanMinutes: number;
    readonly dryRun: boolean;
  };

  readonly queueHealth: {
    readonly enabled: boolean;
    readonly cron: string;
    readonly failedWarningThreshold: number;
  };
}

export interface SchedulerTaskResult {
  readonly taskName: string;
  readonly success: boolean;
  readonly skipped: boolean;
  readonly message: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly details?: SchedulerTaskDetails;
}

export interface SchedulerTaskExecutionInput {
  readonly taskName: string;
  readonly lockKey: string;
  readonly enabled: boolean;
  readonly run: () => Promise<SchedulerTaskDetails | void>;
}

export interface SchedulerLockExecutionResult<T> {
  readonly locked: boolean;
  readonly result?: T;
}

export interface SchedulerTaskStatusItem {
  readonly taskName: SchedulerTaskName;
  readonly enabled: boolean;
  readonly registered: boolean;
  readonly cron: string;
  readonly timezone: string;
  readonly description: string;
}

export interface SchedulerStatusReport {
  readonly enabled: boolean;
  readonly timezone: string;
  readonly checkedAt: string;
  readonly tasks: readonly SchedulerTaskStatusItem[];
}
