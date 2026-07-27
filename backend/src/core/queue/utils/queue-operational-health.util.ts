import {
  QUEUE_METRICS_AGGREGATION_VERSION,
  QUEUE_OPERATIONAL_HEALTH_VERSION,
} from '../types/queue.types';
import type {
  QueueHistoricalMetrics,
  QueueMetricsAggregate,
  QueueOperationalHealthSignal,
  QueueOperationalHealthSummary,
  QueueOperationalHealthThresholds,
  QueueOperationalMetrics,
  QueueOperationalQueueHealth,
  QueueOperationalSignalLevel,
} from '../types/queue.types';

export interface QueueOperationalHealthSnapshot {
  readonly version: typeof QUEUE_OPERATIONAL_HEALTH_VERSION;
  readonly metricsVersion: typeof QUEUE_METRICS_AGGREGATION_VERSION;
  readonly workerCountPolicy: 'INFORMATIONAL_ONLY';
  readonly workerCountEnforced: false;
  readonly degradationLevels: readonly ['WARNING', 'DEGRADED', 'CRITICAL'];
  readonly signalCodes: readonly [
    'BACKLOG',
    'FAILED',
    'DELAYED',
    'FAILURE_RATE',
    'PAUSED_WITH_BACKLOG',
  ];
}

export class QueueOperationalHealthUtil {
  static buildHistoricalMetrics(
    completed: number,
    failed: number,
    minSample: number,
  ): QueueHistoricalMetrics {
    const normalizedCompleted = this.normalizeCount(completed);
    const normalizedFailed = this.normalizeCount(failed);
    const sampleSize = normalizedCompleted + normalizedFailed;
    const normalizedMinSample = Math.max(1, this.normalizeCount(minSample));
    const sufficientSample = sampleSize >= normalizedMinSample;

    return {
      completed: normalizedCompleted,
      failed: normalizedFailed,
      sampleSize,
      failureRatePercent:
        sufficientSample && sampleSize > 0
          ? this.roundPercent((normalizedFailed / sampleSize) * 100)
          : null,
      sufficientSample,
    };
  }

  static assessQueue(
    metrics: QueueOperationalMetrics,
    thresholds: QueueOperationalHealthThresholds,
  ): QueueOperationalQueueHealth {
    const signals: QueueOperationalHealthSignal[] = [];

    this.pushThresholdSignal(signals, {
      queueName: metrics.name,
      code: 'BACKLOG',
      actual: metrics.backlog,
      warningThreshold: thresholds.backlogWarningThreshold,
      criticalThreshold: thresholds.backlogCriticalThreshold,
      warningMessage:
        'انباشت Jobهای آماده پردازش از آستانه هشدار عبور کرده است.',
      criticalMessage: 'انباشت Jobهای آماده پردازش به سطح بحرانی رسیده است.',
    });

    this.pushThresholdSignal(signals, {
      queueName: metrics.name,
      code: 'FAILED',
      actual: metrics.failed,
      warningThreshold: thresholds.failedWarningThreshold,
      criticalThreshold: thresholds.failedCriticalThreshold,
      warningMessage: 'تعداد Jobهای شکست‌خورده از آستانه هشدار عبور کرده است.',
      criticalMessage: 'تعداد Jobهای شکست‌خورده به سطح بحرانی رسیده است.',
    });

    this.pushThresholdSignal(signals, {
      queueName: metrics.name,
      code: 'DELAYED',
      actual: metrics.delayed,
      warningThreshold: thresholds.delayedWarningThreshold,
      criticalThreshold: thresholds.delayedCriticalThreshold,
      warningMessage: 'تعداد Jobهای تأخیردار از آستانه هشدار عبور کرده است.',
      criticalMessage: 'تعداد Jobهای تأخیردار به سطح بحرانی رسیده است.',
    });

    if (
      metrics.historical.sufficientSample &&
      metrics.historical.failureRatePercent !== null
    ) {
      this.pushThresholdSignal(signals, {
        queueName: metrics.name,
        code: 'FAILURE_RATE',
        actual: metrics.historical.failureRatePercent,
        warningThreshold: thresholds.failureRateWarningPercent,
        criticalThreshold: thresholds.failureRateCriticalPercent,
        warningMessage: 'نرخ شکست تاریخی صف از آستانه هشدار عبور کرده است.',
        criticalMessage: 'نرخ شکست تاریخی صف به سطح بحرانی رسیده است.',
      });
    }

    if (metrics.queuePaused && metrics.backlog > 0) {
      signals.push({
        queueName: metrics.name,
        code: 'PAUSED_WITH_BACKLOG',
        level: 'DEGRADED',
        actual: metrics.backlog,
        threshold: 1,
        message: 'صف متوقف است و هم‌زمان Job آماده پردازش دارد.',
      });
    }

    const level = this.resolveQueueLevel(signals);

    return {
      level,
      ready: level === 'HEALTHY' || level === 'WARNING',
      degraded: level === 'DEGRADED' || level === 'CRITICAL',
      critical: level === 'CRITICAL',
      signals,
      workersCountEnforced: false,
      workersCountPolicy: 'INFORMATIONAL_ONLY',
    };
  }

  static aggregate(
    queues: readonly QueueOperationalMetrics[],
    minSample: number,
  ): QueueMetricsAggregate {
    const completedHistorical = queues.reduce(
      (total, queue) => total + queue.historical.completed,
      0,
    );
    const failedHistorical = queues.reduce(
      (total, queue) => total + queue.historical.failed,
      0,
    );

    return {
      version: QUEUE_METRICS_AGGREGATION_VERSION,
      queueCount: queues.length,
      waiting: this.sum(queues, 'waiting'),
      active: this.sum(queues, 'active'),
      completed: this.sum(queues, 'completed'),
      failed: this.sum(queues, 'failed'),
      delayed: this.sum(queues, 'delayed'),
      paused: this.sum(queues, 'paused'),
      prioritized: this.sum(queues, 'prioritized'),
      waitingChildren: this.sum(queues, 'waitingChildren'),
      backlog: this.sum(queues, 'backlog'),
      workersCount: this.sum(queues, 'workersCount'),
      pausedQueues: queues.filter((queue) => queue.queuePaused).length,
      historical: this.buildHistoricalMetrics(
        completedHistorical,
        failedHistorical,
        minSample,
      ),
    };
  }

  static summarize(
    queues: readonly (QueueOperationalMetrics & {
      readonly health: QueueOperationalQueueHealth;
    })[],
    thresholds: QueueOperationalHealthThresholds,
  ): QueueOperationalHealthSummary {
    const signals = queues.flatMap((queue) => queue.health.signals);
    const queueLevels = {
      HEALTHY: queues.filter((queue) => queue.health.level === 'HEALTHY')
        .length,
      WARNING: queues.filter((queue) => queue.health.level === 'WARNING')
        .length,
      DEGRADED: queues.filter((queue) => queue.health.level === 'DEGRADED')
        .length,
      CRITICAL: queues.filter((queue) => queue.health.level === 'CRITICAL')
        .length,
    } as const;

    const level = this.resolveOverallLevel(queueLevels);
    const affectedQueues = queues
      .filter((queue) => queue.health.level !== 'HEALTHY')
      .map((queue) => queue.name);

    return {
      version: QUEUE_OPERATIONAL_HEALTH_VERSION,
      level,
      ready: level === 'HEALTHY' || level === 'WARNING',
      degraded: level === 'DEGRADED' || level === 'CRITICAL',
      critical: level === 'CRITICAL',
      thresholds,
      queueLevels,
      affectedQueues,
      signals,
      workersCountEnforced: false,
      workersCountPolicy: 'INFORMATIONAL_ONLY',
    };
  }

  static getSnapshot(): QueueOperationalHealthSnapshot {
    return {
      version: QUEUE_OPERATIONAL_HEALTH_VERSION,
      metricsVersion: QUEUE_METRICS_AGGREGATION_VERSION,
      workerCountPolicy: 'INFORMATIONAL_ONLY',
      workerCountEnforced: false,
      degradationLevels: ['WARNING', 'DEGRADED', 'CRITICAL'],
      signalCodes: [
        'BACKLOG',
        'FAILED',
        'DELAYED',
        'FAILURE_RATE',
        'PAUSED_WITH_BACKLOG',
      ],
    };
  }

  private static pushThresholdSignal(
    target: QueueOperationalHealthSignal[],
    input: {
      readonly queueName: QueueOperationalMetrics['name'];
      readonly code: Exclude<
        QueueOperationalHealthSignal['code'],
        'PAUSED_WITH_BACKLOG'
      >;
      readonly actual: number;
      readonly warningThreshold: number;
      readonly criticalThreshold: number;
      readonly warningMessage: string;
      readonly criticalMessage: string;
    },
  ): void {
    const level = this.resolveThresholdLevel(
      input.actual,
      input.warningThreshold,
      input.criticalThreshold,
    );

    if (!level) {
      return;
    }

    target.push({
      queueName: input.queueName,
      code: input.code,
      level,
      actual: input.actual,
      threshold:
        level === 'CRITICAL' ? input.criticalThreshold : input.warningThreshold,
      message:
        level === 'CRITICAL' ? input.criticalMessage : input.warningMessage,
    });
  }

  private static resolveThresholdLevel(
    actual: number,
    warningThreshold: number,
    criticalThreshold: number,
  ): Extract<QueueOperationalSignalLevel, 'WARNING' | 'CRITICAL'> | null {
    if (actual >= criticalThreshold) {
      return 'CRITICAL';
    }

    if (actual >= warningThreshold) {
      return 'WARNING';
    }

    return null;
  }

  private static resolveQueueLevel(
    signals: readonly QueueOperationalHealthSignal[],
  ): QueueOperationalQueueHealth['level'] {
    if (signals.some((signal) => signal.level === 'CRITICAL')) {
      return 'CRITICAL';
    }

    if (signals.some((signal) => signal.level === 'DEGRADED')) {
      return 'DEGRADED';
    }

    if (signals.filter((signal) => signal.level === 'WARNING').length >= 2) {
      return 'DEGRADED';
    }

    if (signals.length > 0) {
      return 'WARNING';
    }

    return 'HEALTHY';
  }

  private static resolveOverallLevel(queueLevels: {
    readonly HEALTHY: number;
    readonly WARNING: number;
    readonly DEGRADED: number;
    readonly CRITICAL: number;
  }): QueueOperationalHealthSummary['level'] {
    if (queueLevels.CRITICAL > 0) {
      return 'CRITICAL';
    }

    if (queueLevels.DEGRADED > 0) {
      return 'DEGRADED';
    }

    if (queueLevels.WARNING > 0) {
      return 'WARNING';
    }

    return 'HEALTHY';
  }

  private static sum(
    queues: readonly QueueOperationalMetrics[],
    key:
      | 'waiting'
      | 'active'
      | 'completed'
      | 'failed'
      | 'delayed'
      | 'paused'
      | 'prioritized'
      | 'waitingChildren'
      | 'backlog'
      | 'workersCount',
  ): number {
    return queues.reduce((total, queue) => total + queue[key], 0);
  }

  private static normalizeCount(value: number): number {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  private static roundPercent(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
