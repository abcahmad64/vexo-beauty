import { Injectable, Logger } from '@nestjs/common';

import { QueueConfigService } from '../../queue/services/queue-config.service';
import { QueueMonitorService } from '../../queue/services/queue-monitor.service';
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
export class QueueHealthScheduler {
  private readonly logger = new Logger(QueueHealthScheduler.name);

  constructor(
    private readonly schedulerConfigService: SchedulerConfigService,
    private readonly taskRunner: SchedulerTaskRunnerService,
    private readonly queueConfigService: QueueConfigService,
    private readonly queueMonitorService: QueueMonitorService,
  ) {}

  async runOnce(
    trigger: SchedulerTrigger = 'manual',
  ): Promise<SchedulerTaskResult> {
    const config = this.schedulerConfigService.getConfig();
    const queueConfig = this.queueConfigService.getConfig();
    const normalizedTrigger = this.normalizeTrigger(trigger);

    const result = await this.taskRunner.execute({
      taskName: SCHEDULER_TASK_NAMES.QUEUE_HEALTH,
      lockKey: SCHEDULER_LOCK_KEYS.QUEUE_HEALTH,
      enabled:
        config.enabled && config.queueHealth.enabled && queueConfig.enabled,
      run: async (): Promise<SchedulerTaskDetails> => {
        const status = await this.queueMonitorService.getStatus();
        const failedQueues = status.queues
          .filter((queue) => queue.failed > 0)
          .map((queue) => ({
            name: queue.name,
            failed: queue.failed,
            level: queue.health.level,
          }));

        if (status.health.level === 'CRITICAL') {
          this.logger.error(
            `سلامت صف‌ها بحرانی است: ${status.health.affectedQueues.length} صف تحت تأثیر قرار گرفته‌اند.`,
          );
        } else if (
          status.health.level === 'DEGRADED' ||
          status.health.level === 'WARNING'
        ) {
          this.logger.warn(
            `سلامت صف‌ها نیازمند توجه است: level=${status.health.level} affected=${status.health.affectedQueues.length}.`,
          );
        }

        return {
          trigger: normalizedTrigger,
          checkedAt: status.checkedAt,
          metricsVersion: status.version,
          healthVersion: status.healthVersion,
          healthLevel: status.health.level,
          ready: status.health.ready,
          degraded: status.health.degraded,
          critical: status.health.critical,
          thresholds: status.health.thresholds,
          queuesCount: status.queues.length,
          affectedQueuesCount: status.health.affectedQueues.length,
          affectedQueues: status.health.affectedQueues,
          signalsCount: status.health.signals.length,
          signals: status.health.signals,
          aggregate: status.aggregate,
          failedWarningThreshold:
            status.health.thresholds.failedWarningThreshold,
          failedQueuesCount: failedQueues.length,
          failedQueues,
          workersCountEnforced: status.health.workersCountEnforced,
          workersCountPolicy: status.health.workersCountPolicy,
        };
      },
    });

    if (!result.success) {
      this.logger.error(
        `${SCHEDULER_TASK_NAMES.QUEUE_HEALTH} failed: ${result.message}`,
      );
    }

    return result;
  }

  private normalizeTrigger(trigger: SchedulerTrigger): SchedulerTrigger {
    return trigger === 'cron' ? 'cron' : 'manual';
  }
}
