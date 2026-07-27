import { createHash } from 'node:crypto';

import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Job, JobType, Queue } from 'bullmq';

import {
  ALL_QUEUE_NAMES,
  QUEUE_DEFAULTS,
  QUEUE_JOB_NAMES,
  QUEUE_NAMES,
} from '../constants/queue.constants';
import {
  QUEUE_EXECUTION_CANCELLATION_VERSION,
  QUEUE_METRICS_AGGREGATION_VERSION,
  QUEUE_OPERATIONAL_HEALTH_VERSION,
} from '../types/queue.types';
import type {
  DeadLetterQueueJobData,
  EnqueuedJobResult,
  QueueExecutionCancellation,
  QueueJobName,
  QueueJobResult,
  QueueMetricsAggregate,
  QueueName,
  QueueOperationalHealthSummary,
  QueueOperationalMetrics,
  QueueOperationalQueueHealth,
  VexoQueueJobData,
} from '../types/queue.types';

import { QueueExecutionCancellationUtil } from '../utils/queue-execution-cancellation.util';
import { QueueOperationalHealthUtil } from '../utils/queue-operational-health.util';

import { QueueConfigService } from './queue-config.service';
import { QueueProducerService } from './queue-producer.service';

type VexoBullQueue = Queue<VexoQueueJobData, QueueJobResult, QueueJobName>;

export type QueueJobStatusFilter =
  | 'waiting'
  | 'active'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'paused'
  | 'prioritized'
  | 'waiting-children'
  | 'all';

export interface QueueStatusItem extends QueueOperationalMetrics {
  readonly health: QueueOperationalQueueHealth;
}

export interface QueueStatusReport {
  readonly version: typeof QUEUE_METRICS_AGGREGATION_VERSION;
  readonly healthVersion: typeof QUEUE_OPERATIONAL_HEALTH_VERSION;
  readonly checkedAt: string;
  readonly queues: readonly QueueStatusItem[];
  readonly aggregate: QueueMetricsAggregate;
  readonly health: QueueOperationalHealthSummary;
}

export interface QueueJobsQuery {
  readonly status?: string;
  readonly start?: number | string;
  readonly end?: number | string;
  readonly asc?: boolean | string;
}

export interface QueueJobSummary {
  readonly id: string;
  readonly name: string;
  readonly queueName: QueueName;
  readonly state: string;
  readonly attemptsMade: number;
  readonly attemptsStarted: number;
  readonly progress: unknown;
  readonly timestamp: number;
  readonly processedOn?: number;
  readonly finishedOn?: number;
  readonly failedReason?: string;
  readonly data: unknown;
  readonly returnValue: unknown;
}

export interface QueueJobsReport {
  readonly queueName: QueueName;
  readonly status: QueueJobStatusFilter;
  readonly start: number;
  readonly end: number;
  readonly asc: boolean;
  readonly total: number;
  readonly jobs: readonly QueueJobSummary[];
}

export interface QueueJobDetails extends QueueJobSummary {
  readonly stacktrace: readonly string[];
  readonly opts: Record<string, unknown>;
}

export interface QueueActionResult {
  readonly success: true;
  readonly message: string;
  readonly queueName: QueueName;
  readonly jobId?: string;
  readonly executedAt: string;
}

export const QUEUE_DEAD_LETTER_REPLAY_VERSION = '1.0.0';

export interface QueueDeadLetterReplayResult {
  readonly version: typeof QUEUE_DEAD_LETTER_REPLAY_VERSION;
  readonly success: true;
  readonly message: string;
  readonly source: {
    readonly queueName: typeof QUEUE_NAMES.DEAD_LETTER;
    readonly jobId: string;
    readonly state: string;
    readonly retained: true;
  };
  readonly target: EnqueuedJobResult & {
    readonly originalJobId?: string;
    readonly attempts: number;
    readonly idempotentJobId: true;
    readonly alreadyExisted: boolean;
  };
  readonly audit: {
    readonly actorId: string;
    readonly replayedAt: string;
    readonly replayJobId: string;
  };
}

export interface QueueAiExecutionCancellationResult {
  readonly version: typeof QUEUE_EXECUTION_CANCELLATION_VERSION;
  readonly success: true;
  readonly message: string;
  readonly queueName: typeof QUEUE_NAMES.AI;
  readonly jobId: string;
  readonly stateAtRequest: string;
  readonly stateAfterRequest: string;
  readonly idempotent: boolean;
  readonly activeSignalDispatched: boolean;
  readonly evidenceRetained: true;
  readonly cancellation: QueueExecutionCancellation;
}

@Injectable()
export class QueueMonitorService {
  private readonly cancellationLocks = new Map<string, Promise<void>>();

  constructor(
    private readonly queueConfigService: QueueConfigService,

    @InjectQueue(QUEUE_NAMES.NOTIFICATION)
    private readonly notificationQueue: VexoBullQueue,

    @InjectQueue(QUEUE_NAMES.EMAIL)
    private readonly emailQueue: VexoBullQueue,

    @InjectQueue(QUEUE_NAMES.SMS)
    private readonly smsQueue: VexoBullQueue,

    @InjectQueue(QUEUE_NAMES.INVOICE)
    private readonly invoiceQueue: VexoBullQueue,

    @InjectQueue(QUEUE_NAMES.ORDER)
    private readonly orderQueue: VexoBullQueue,

    @InjectQueue(QUEUE_NAMES.AI)
    private readonly aiQueue: VexoBullQueue,

    @InjectQueue(QUEUE_NAMES.MEDIA)
    private readonly mediaQueue: VexoBullQueue,

    @InjectQueue(QUEUE_NAMES.ANALYTICS)
    private readonly analyticsQueue: VexoBullQueue,

    @InjectQueue(QUEUE_NAMES.DEAD_LETTER)
    private readonly deadLetterQueue: VexoBullQueue,

    private readonly queueProducerService: QueueProducerService,
  ) {}

  async getStatus(): Promise<QueueStatusReport> {
    this.assertEnabled();

    const thresholds = this.queueConfigService.getConfig().operationalHealth;

    const queues = await Promise.all(
      ALL_QUEUE_NAMES.map((queueName) =>
        this.getQueueStatus(queueName, thresholds.failureRateMinSample),
      ),
    );

    const assessedQueues = queues.map((queue) => ({
      ...queue,
      health: QueueOperationalHealthUtil.assessQueue(queue, thresholds),
    }));

    return {
      version: QUEUE_METRICS_AGGREGATION_VERSION,
      healthVersion: QUEUE_OPERATIONAL_HEALTH_VERSION,
      checkedAt: new Date().toISOString(),
      queues: assessedQueues,
      aggregate: QueueOperationalHealthUtil.aggregate(
        assessedQueues,
        thresholds.failureRateMinSample,
      ),
      health: QueueOperationalHealthUtil.summarize(assessedQueues, thresholds),
    };
  }

  async getJobs(
    queueNameInput: string,
    query: QueueJobsQuery,
  ): Promise<QueueJobsReport> {
    this.assertEnabled();

    const queueName = this.normalizeQueueName(queueNameInput);
    const queue = this.resolveQueue(queueName);
    const status = this.normalizeStatus(query.status);
    const start = this.normalizeRangeValue(query.start, 0);
    const end = this.normalizeRangeValue(query.end, 49);
    const asc = this.normalizeBoolean(query.asc, false);

    if (end < start) {
      throw new BadRequestException('محدوده دریافت Jobهای صف معتبر نیست.');
    }

    const jobs = await queue.getJobs(
      this.resolveJobTypes(status),
      start,
      end,
      asc,
    );

    const summaries = await Promise.all(
      jobs.map((job) => this.mapJobSummary(queueName, job)),
    );

    return {
      queueName,
      status,
      start,
      end,
      asc,
      total: summaries.length,
      jobs: summaries,
    };
  }

  async getJobDetails(
    queueNameInput: string,
    jobId: string,
  ): Promise<QueueJobDetails> {
    this.assertEnabled();

    const queueName = this.normalizeQueueName(queueNameInput);
    const job = await this.findJobOrFail(queueName, jobId);
    const summary = await this.mapJobSummary(queueName, job);

    return {
      ...summary,
      stacktrace: job.stacktrace ?? [],
      opts: this.toRecord(job.opts),
    };
  }

  async retryJob(
    queueNameInput: string,
    jobId: string,
  ): Promise<QueueActionResult> {
    this.assertEnabled();

    const queueName = this.normalizeQueueName(queueNameInput);
    const job = await this.findJobOrFail(queueName, jobId);
    const state = await job.getState();

    if (state !== 'failed') {
      throw new BadRequestException('فقط Job شکست‌خورده قابل اجرای مجدد است.');
    }

    await job.retry('failed');

    return {
      success: true,
      message: 'Job با موفقیت برای اجرای مجدد ارسال شد.',
      queueName,
      jobId: String(job.id),
      executedAt: new Date().toISOString(),
    };
  }

  async replayDeadLetterJob(
    jobIdInput: string,
    actorIdInput: string,
  ): Promise<QueueDeadLetterReplayResult> {
    this.assertEnabled();

    const actorId = this.normalizeRequiredString(
      actorIdInput,
      'شناسه مدیر اجراکننده Replay معتبر نیست.',
    );
    const sourceJob = await this.findJobOrFail(
      QUEUE_NAMES.DEAD_LETTER,
      jobIdInput,
    );
    const sourceJobId = String(sourceJob.id ?? '').trim();
    const sourceState = await sourceJob.getState();

    if (sourceJob.name !== QUEUE_JOB_NAMES.DEAD_LETTER_CAPTURE) {
      throw new BadRequestException(
        'فقط Jobهای ثبت خطای Dead Letter قابل Replay هستند.',
      );
    }

    if (!['completed', 'failed'].includes(sourceState)) {
      throw new BadRequestException(
        'Job مربوط به Dead Letter هنوز به وضعیت نهایی نرسیده است.',
      );
    }

    if (!this.isDeadLetterQueueJobData(sourceJob.data)) {
      throw new BadRequestException(
        'ساختار داده Job مربوط به Dead Letter معتبر نیست.',
      );
    }

    const originalQueue = this.normalizeReplayQueue(
      sourceJob.data.originalQueue,
    );
    const originalJobName = this.normalizeReplayJobName(
      originalQueue,
      sourceJob.data.originalJobName,
    );
    const replayJobId = this.buildDeadLetterReplayJobId(sourceJobId);
    const targetQueue = this.resolveQueue(originalQueue);
    const existingReplayJob = await targetQueue.getJob(replayJobId);
    const replayedAt = new Date().toISOString();
    const attempts = this.resolveReplayAttempts(sourceJob.data);
    const replayData = this.buildDeadLetterReplayData({
      sourceJobId,
      replayJobId,
      replayedAt,
      actorId,
      data: sourceJob.data,
    });

    const enqueued = await this.queueProducerService.enqueue({
      queueName: originalQueue,
      jobName: originalJobName,
      data: replayData,
      options: {
        jobId: replayJobId,
        attempts,
        backoffType: 'exponential',
        backoffDelayMs: QUEUE_DEFAULTS.DEFAULT_BACKOFF_DELAY_MS,
        removeOnCompleteCount: QUEUE_DEFAULTS.REMOVE_ON_COMPLETE_COUNT,
        removeOnFailCount: QUEUE_DEFAULTS.REMOVE_ON_FAIL_COUNT,
      },
    });

    return {
      version: QUEUE_DEAD_LETTER_REPLAY_VERSION,
      success: true,
      message: existingReplayJob
        ? 'Replay این Dead Letter قبلاً با همین شناسه ثبت شده است.'
        : 'Job اصلی با موفقیت و با شناسه قطعی برای Replay وارد صف شد.',
      source: {
        queueName: QUEUE_NAMES.DEAD_LETTER,
        jobId: sourceJobId,
        state: sourceState,
        retained: true,
      },
      target: {
        ...enqueued,
        ...(sourceJob.data.originalJobId
          ? {
              originalJobId: sourceJob.data.originalJobId,
            }
          : {}),
        attempts,
        idempotentJobId: true,
        alreadyExisted: Boolean(existingReplayJob),
      },
      audit: {
        actorId,
        replayedAt,
        replayJobId,
      },
    };
  }

  async cancelAiExecution(
    jobIdInput: string,
    actorIdInput: string,
    reasonInput: string | undefined,
    cancelActiveJob: (
      jobId: string,
      cancellation: QueueExecutionCancellation,
    ) => boolean,
  ): Promise<QueueAiExecutionCancellationResult> {
    this.assertEnabled();

    const jobId = this.normalizeRequiredString(
      jobIdInput,
      'شناسه Job هوش مصنوعی معتبر نیست.',
    );

    return this.withCancellationLock(jobId, async () => {
      const actorId = this.normalizeRequiredString(
        actorIdInput,
        'شناسه مدیر درخواست‌کننده لغو معتبر نیست.',
      );
      const job = await this.findJobOrFail(QUEUE_NAMES.AI, jobId);

      if (job.name !== QUEUE_JOB_NAMES.AI_PROCESS) {
        throw new BadRequestException(
          'فقط Job اصلی پردازش هوش مصنوعی قابل لغو است.',
        );
      }

      const stateAtRequest = await job.getState();

      if (['completed', 'failed'].includes(stateAtRequest)) {
        throw new BadRequestException(
          'Job هوش مصنوعی به وضعیت نهایی رسیده و قابل لغو نیست.',
        );
      }

      const existing =
        QueueExecutionCancellationUtil.readFromData(job.data) ??
        QueueExecutionCancellationUtil.readFromProgress(job.progress);
      const requested =
        existing ??
        QueueExecutionCancellationUtil.createRequest({
          jobId,
          actorId,
          reason: reasonInput,
          stateAtRequest,
          data: job.data,
        });

      let cancellation = requested;
      const idempotent = existing !== undefined;

      if (!existing) {
        await this.persistAiCancellation(job, cancellation);
      }

      let stateAfterRequest = await job.getState();

      if (['completed', 'failed'].includes(stateAfterRequest)) {
        cancellation = QueueExecutionCancellationUtil.supersede(
          cancellation,
          stateAfterRequest === 'completed'
            ? 'COMPLETED_BEFORE_CANCELLATION'
            : 'FAILED_BEFORE_CANCELLATION',
        );
        await this.persistAiCancellation(job, cancellation);

        return {
          version: QUEUE_EXECUTION_CANCELLATION_VERSION,
          success: true,
          message:
            'درخواست لغو ثبت شد، اما Job هم‌زمان پیش از اعمال لغو به وضعیت نهایی رسید.',
          queueName: QUEUE_NAMES.AI,
          jobId,
          stateAtRequest,
          stateAfterRequest,
          idempotent,
          activeSignalDispatched: false,
          evidenceRetained: true,
          cancellation,
        };
      }

      const activeSignalDispatched =
        stateAfterRequest === 'active'
          ? cancelActiveJob(jobId, cancellation)
          : false;

      if (activeSignalDispatched) {
        cancellation = QueueExecutionCancellationUtil.markSignalDispatched(
          cancellation,
          true,
        );
        await this.persistAiCancellation(job, cancellation);
        stateAfterRequest = await job.getState();
      }

      return {
        version: QUEUE_EXECUTION_CANCELLATION_VERSION,
        success: true,
        message: idempotent
          ? 'درخواست لغو این Job قبلاً ثبت شده است.'
          : activeSignalDispatched
            ? 'درخواست لغو ثبت و سیگنال توقف به Worker فعال ارسال شد.'
            : 'درخواست لغو ثبت شد و هنگام شروع Job اعمال خواهد شد.',
        queueName: QUEUE_NAMES.AI,
        jobId,
        stateAtRequest,
        stateAfterRequest,
        idempotent,
        activeSignalDispatched,
        evidenceRetained: true,
        cancellation,
      };
    });
  }

  private async persistAiCancellation(
    job: Job<VexoQueueJobData, QueueJobResult, QueueJobName>,
    cancellation: QueueExecutionCancellation,
  ): Promise<void> {
    await job.updateData(
      QueueExecutionCancellationUtil.applyToData(job.data, cancellation),
    );
    await job.updateProgress(
      QueueExecutionCancellationUtil.applyToProgress(
        job.progress,
        cancellation,
      ),
    );
  }

  private async withCancellationLock<T>(
    jobId: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const previous = this.cancellationLocks.get(jobId) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(action);
    const completion = operation.then(
      () => undefined,
      () => undefined,
    );

    this.cancellationLocks.set(jobId, completion);

    try {
      return await operation;
    } finally {
      if (this.cancellationLocks.get(jobId) === completion) {
        this.cancellationLocks.delete(jobId);
      }
    }
  }

  async removeJob(
    queueNameInput: string,
    jobId: string,
  ): Promise<QueueActionResult> {
    this.assertEnabled();

    const queueName = this.normalizeQueueName(queueNameInput);
    const job = await this.findJobOrFail(queueName, jobId);

    await job.remove();

    return {
      success: true,
      message: 'Job با موفقیت از صف حذف شد.',
      queueName,
      jobId: String(job.id),
      executedAt: new Date().toISOString(),
    };
  }

  async pauseQueue(queueNameInput: string): Promise<QueueActionResult> {
    this.assertEnabled();

    const queueName = this.normalizeQueueName(queueNameInput);
    const queue = this.resolveQueue(queueName);

    await queue.pause();

    return {
      success: true,
      message: 'صف با موفقیت متوقف شد.',
      queueName,
      executedAt: new Date().toISOString(),
    };
  }

  async resumeQueue(queueNameInput: string): Promise<QueueActionResult> {
    this.assertEnabled();

    const queueName = this.normalizeQueueName(queueNameInput);
    const queue = this.resolveQueue(queueName);

    await queue.resume();

    return {
      success: true,
      message: 'صف با موفقیت از حالت توقف خارج شد.',
      queueName,
      executedAt: new Date().toISOString(),
    };
  }

  private assertEnabled(): void {
    if (!this.queueConfigService.getConfig().enabled) {
      throw new ServiceUnavailableException(
        'سیستم صف در حال حاضر غیرفعال است.',
      );
    }
  }

  private async getQueueStatus(
    queueName: QueueName,
    failureRateMinSample: number,
  ): Promise<QueueOperationalMetrics> {
    const queue = this.resolveQueue(queueName);

    const [counts, workersCount, queuePaused, completedMetrics, failedMetrics] =
      await Promise.all([
        queue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
          'paused',
          'prioritized',
          'waiting-children',
        ),
        queue.getWorkersCount(),
        queue.isPaused(),
        queue.getMetrics('completed', 0, 20),
        queue.getMetrics('failed', 0, 20),
      ]);

    const waiting = counts.waiting ?? 0;
    const prioritized = counts.prioritized ?? 0;
    const waitingChildren = counts['waiting-children'] ?? 0;

    return {
      name: queueName,
      waiting,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: counts.paused ?? 0,
      prioritized,
      waitingChildren,
      workersCount: this.normalizeCount(workersCount),
      queuePaused,
      backlog: waiting + prioritized + waitingChildren,
      historical: QueueOperationalHealthUtil.buildHistoricalMetrics(
        this.extractMetricCount(completedMetrics),
        this.extractMetricCount(failedMetrics),
        failureRateMinSample,
      ),
    };
  }

  private extractMetricCount(metrics: unknown): number {
    const record = this.toRecord(metrics);
    const meta = this.toRecord(record.meta);
    const value = meta.count ?? record.count;

    return this.normalizeCount(value);
  }

  private normalizeCount(value: unknown): number {
    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  }

  private async findJobOrFail(
    queueName: QueueName,
    jobId: string,
  ): Promise<Job<VexoQueueJobData, QueueJobResult, QueueJobName>> {
    const normalizedJobId = this.normalizeRequiredString(
      jobId,
      'شناسه Job معتبر نیست.',
    );

    const queue = this.resolveQueue(queueName);
    const job = await queue.getJob(normalizedJobId);

    if (!job) {
      throw new NotFoundException('Job مورد نظر در صف یافت نشد.');
    }

    return job;
  }

  private async mapJobSummary(
    queueName: QueueName,
    job: Job<VexoQueueJobData, QueueJobResult, QueueJobName>,
  ): Promise<QueueJobSummary> {
    const state = await job.getState();

    return {
      id: String(job.id ?? ''),
      name: String(job.name),
      queueName,
      state,
      attemptsMade: job.attemptsMade,
      attemptsStarted: job.attemptsStarted,
      progress: job.progress,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      data: job.data,
      returnValue: job.returnvalue,
    };
  }

  private resolveJobTypes(status: QueueJobStatusFilter): JobType[] {
    if (status === 'all') {
      return [
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
        'paused',
        'prioritized',
        'waiting-children',
      ];
    }

    return [status];
  }

  private normalizeStatus(status: string | undefined): QueueJobStatusFilter {
    const normalizedStatus = String(status ?? 'all').trim();

    const allowedStatuses: readonly QueueJobStatusFilter[] = [
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
      'prioritized',
      'waiting-children',
      'all',
    ];

    if (!allowedStatuses.includes(normalizedStatus as QueueJobStatusFilter)) {
      throw new BadRequestException(
        `وضعیت Job معتبر نیست: ${normalizedStatus}`,
      );
    }

    return normalizedStatus as QueueJobStatusFilter;
  }

  private isDeadLetterQueueJobData(
    value: VexoQueueJobData,
  ): value is DeadLetterQueueJobData {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const record = this.toRecord(value);

    return (
      typeof record.originalQueue === 'string' &&
      typeof record.originalJobName === 'string' &&
      typeof record.failureReason === 'string' &&
      typeof record.failedAt === 'string' &&
      typeof record.attemptsMade === 'number' &&
      Boolean(this.toRecord(record.data).metadata)
    );
  }

  private normalizeReplayQueue(value: QueueName): QueueName {
    const queueName = this.normalizeQueueName(String(value));

    if (queueName === QUEUE_NAMES.DEAD_LETTER) {
      throw new BadRequestException(
        'Replay بازگشتی به Dead Letter Queue مجاز نیست.',
      );
    }

    return queueName;
  }

  private normalizeReplayJobName(
    queueName: QueueName,
    value: string,
  ): QueueJobName {
    const jobName = this.normalizeRequiredString(
      value,
      'نام Job اصلی برای Replay معتبر نیست.',
    );

    if (!this.isReplayableJobName(queueName, jobName)) {
      throw new BadRequestException(
        `Job ${jobName} برای صف ${queueName} قابل Replay نیست.`,
      );
    }

    return jobName;
  }

  private isReplayableJobName(
    queueName: QueueName,
    jobName: string,
  ): jobName is QueueJobName {
    switch (queueName) {
      case QUEUE_NAMES.NOTIFICATION:
        return [
          QUEUE_JOB_NAMES.NOTIFICATION_DATABASE,
          QUEUE_JOB_NAMES.NOTIFICATION_PUSH,
          QUEUE_JOB_NAMES.NOTIFICATION_DELIVERY,
        ].some((candidate) => candidate === jobName);
      case QUEUE_NAMES.EMAIL:
        return jobName === QUEUE_JOB_NAMES.EMAIL_SEND;
      case QUEUE_NAMES.SMS:
        return jobName === QUEUE_JOB_NAMES.SMS_SEND;
      case QUEUE_NAMES.INVOICE:
        return jobName === QUEUE_JOB_NAMES.INVOICE_GENERATE;
      case QUEUE_NAMES.ORDER:
        return [
          QUEUE_JOB_NAMES.ORDER_POST_CREATED,
          QUEUE_JOB_NAMES.ORDER_POST_PAID,
        ].some((candidate) => candidate === jobName);
      case QUEUE_NAMES.AI:
        return [
          QUEUE_JOB_NAMES.AI_PROCESS,
          QUEUE_JOB_NAMES.AI_PRODUCT_CONTENT_GENERATE,
          QUEUE_JOB_NAMES.AI_MARKETING_CONTENT_GENERATE,
          QUEUE_JOB_NAMES.AI_SEMANTIC_INDEX_PRODUCT,
          QUEUE_JOB_NAMES.AI_SEARCH_CONTEXT_BUILD,
          QUEUE_JOB_NAMES.AI_SALES_ADVICE_GENERATE,
        ].some((candidate) => candidate === jobName);
      case QUEUE_NAMES.MEDIA:
        return [
          QUEUE_JOB_NAMES.MEDIA_CLEANUP_TEMPORARY,
          QUEUE_JOB_NAMES.MEDIA_OPTIMIZE_IMAGE,
          QUEUE_JOB_NAMES.MEDIA_GENERATE_THUMBNAIL,
        ].some((candidate) => candidate === jobName);
      case QUEUE_NAMES.ANALYTICS:
        return jobName === QUEUE_JOB_NAMES.ANALYTICS_CAPTURE_EVENT;
      case QUEUE_NAMES.DEAD_LETTER:
        return false;
      default:
        return this.assertNeverQueue(queueName);
    }
  }

  private buildDeadLetterReplayJobId(sourceJobId: string): string {
    const normalizedSourceJobId = this.normalizeRequiredString(
      sourceJobId,
      'شناسه Dead Letter برای Replay معتبر نیست.',
    );
    const digest = createHash('sha256')
      .update(normalizedSourceJobId)
      .digest('hex')
      .slice(0, 32);

    return `dead-letter-replay-${digest}`;
  }

  private resolveReplayAttempts(data: DeadLetterQueueJobData): number {
    const retryDecision = this.toRecord(data.retryDecision);
    const attempt = this.toRecord(retryDecision.attempt);
    const parsed = Number(attempt.maxAttempts);

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
      return QUEUE_DEFAULTS.DEFAULT_ATTEMPTS;
    }

    return parsed;
  }

  private buildDeadLetterReplayData(input: {
    readonly sourceJobId: string;
    readonly replayJobId: string;
    readonly replayedAt: string;
    readonly actorId: string;
    readonly data: DeadLetterQueueJobData;
  }): VexoQueueJobData {
    const originalData = {
      ...this.toRecord(input.data.data),
    };
    const originalMetadata = this.toRecord(originalData.metadata);
    const originalEnvelope = this.toRecord(originalData.envelope);
    const correlationId =
      this.normalizeOptionalString(originalEnvelope.correlationId) ??
      this.normalizeOptionalString(originalMetadata.correlationId) ??
      input.replayJobId;
    const parentExecutionId =
      this.normalizeOptionalString(originalEnvelope.executionId) ??
      this.normalizeOptionalString(originalMetadata.executionId);
    const replayMetadata: Record<string, unknown> = {
      ...originalMetadata,
      createdAt: input.replayedAt,
      actorId: input.actorId,
      source: 'admin.queue.dead-letter-replay',
      producer: 'queue-monitor-service',
      executionId: input.replayJobId,
      correlationId,
      requestId: input.replayJobId,
      idempotencyKey: input.replayJobId,
      deadLetterReplay: {
        version: QUEUE_DEAD_LETTER_REPLAY_VERSION,
        sourceJobId: input.sourceJobId,
        originalQueue: input.data.originalQueue,
        originalJobName: input.data.originalJobName,
        originalJobId: input.data.originalJobId ?? null,
        failureReason: input.data.failureReason,
        failedAt: input.data.failedAt,
        replayedAt: input.replayedAt,
        replayedBy: input.actorId,
      },
    };

    if (parentExecutionId) {
      replayMetadata.parentExecutionId = parentExecutionId;
    }

    const replayData: Record<string, unknown> = {
      ...originalData,
      metadata: replayMetadata,
    };

    delete replayData.envelope;

    return replayData as unknown as VexoQueueJobData;
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }

  private normalizeQueueName(queueNameInput: string): QueueName {
    const queueName = this.normalizeRequiredString(
      queueNameInput,
      'نام صف معتبر نیست.',
    );

    if (!ALL_QUEUE_NAMES.includes(queueName as QueueName)) {
      throw new BadRequestException(`نام صف معتبر نیست: ${queueNameInput}`);
    }

    return queueName as QueueName;
  }

  private normalizeRangeValue(
    value: number | string | undefined,
    fallback: number,
  ): number {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    const parsedValue = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return fallback;
    }

    return Math.floor(parsedValue);
  }

  private normalizeBoolean(
    value: boolean | string | undefined,
    fallback: boolean,
  ): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value !== 'string') {
      return fallback;
    }

    const normalizedValue = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
      return false;
    }

    return fallback;
  }

  private normalizeRequiredString(value: string, message: string): string {
    const normalizedValue = value.trim();

    if (normalizedValue.length === 0) {
      throw new BadRequestException(message);
    }

    return normalizedValue;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private resolveQueue(queueName: QueueName): VexoBullQueue {
    switch (queueName) {
      case QUEUE_NAMES.NOTIFICATION:
        return this.notificationQueue;
      case QUEUE_NAMES.EMAIL:
        return this.emailQueue;
      case QUEUE_NAMES.SMS:
        return this.smsQueue;
      case QUEUE_NAMES.INVOICE:
        return this.invoiceQueue;
      case QUEUE_NAMES.ORDER:
        return this.orderQueue;
      case QUEUE_NAMES.AI:
        return this.aiQueue;
      case QUEUE_NAMES.MEDIA:
        return this.mediaQueue;
      case QUEUE_NAMES.ANALYTICS:
        return this.analyticsQueue;
      case QUEUE_NAMES.DEAD_LETTER:
        return this.deadLetterQueue;
      default:
        return this.assertNeverQueue(queueName);
    }
  }

  private assertNeverQueue(queueName: never): never {
    throw new BadRequestException(`صف ناشناخته است: ${String(queueName)}`);
  }
}
