import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { JobsOptions, Queue } from 'bullmq';

import { QUEUE_JOB_NAMES, QUEUE_NAMES } from '../constants/queue.constants';
import type {
  AiQueueJobData,
  AnalyticsQueueJobData,
  DeadLetterQueueJobData,
  EmailQueueJobData,
  EnqueueJobInput,
  EnqueuedJobResult,
  InvoiceQueueJobData,
  MediaCleanupQueueJobData,
  MediaImageOptimizationQueueJobData,
  MediaThumbnailQueueJobData,
  NotificationQueueJobData,
  OrderQueueJobData,
  QueueJobName,
  QueueJobResult,
  QueueName,
  SmsQueueJobData,
  VexoQueueJobData,
} from '../types/queue.types';
import { QueueExecutionEnvelopeUtil } from '../utils/queue-execution-envelope.util';
import { QueueConfigService } from './queue-config.service';

type VexoBullQueue = Queue<VexoQueueJobData, QueueJobResult, QueueJobName>;

@Injectable()
export class QueueProducerService {
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
  ) {}

  async enqueueNotificationDatabase(
    data: NotificationQueueJobData,
  ): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.NOTIFICATION,
      jobName: QUEUE_JOB_NAMES.NOTIFICATION_DATABASE,
      data,
    });
  }

  async enqueueNotificationPush(
    data: NotificationQueueJobData,
  ): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.NOTIFICATION,
      jobName: QUEUE_JOB_NAMES.NOTIFICATION_PUSH,
      data,
    });
  }

  async enqueueEmail(data: EmailQueueJobData): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.EMAIL,
      jobName: QUEUE_JOB_NAMES.EMAIL_SEND,
      data,
    });
  }

  async enqueueSms(data: SmsQueueJobData): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.SMS,
      jobName: QUEUE_JOB_NAMES.SMS_SEND,
      data,
    });
  }

  async enqueueInvoiceGeneration(
    data: InvoiceQueueJobData,
  ): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.INVOICE,
      jobName: QUEUE_JOB_NAMES.INVOICE_GENERATE,
      data,
    });
  }

  async enqueueOrderPostCreated(
    data: OrderQueueJobData,
  ): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.ORDER,
      jobName: QUEUE_JOB_NAMES.ORDER_POST_CREATED,
      data,
    });
  }

  async enqueueOrderPostPaid(
    data: OrderQueueJobData,
  ): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.ORDER,
      jobName: QUEUE_JOB_NAMES.ORDER_POST_PAID,
      data,
    });
  }

  async enqueueAiProcess(data: AiQueueJobData): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_PROCESS,
      data,
    });
  }

  async enqueueAiProductContentGenerate(
    data: AiQueueJobData,
  ): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_PRODUCT_CONTENT_GENERATE,
      data,
    });
  }

  async enqueueAiMarketingContentGenerate(
    data: AiQueueJobData,
  ): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_MARKETING_CONTENT_GENERATE,
      data,
    });
  }

  async enqueueAiSemanticIndexProduct(
    data: AiQueueJobData,
  ): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_SEMANTIC_INDEX_PRODUCT,
      data,
    });
  }

  async enqueueAiSearchContextBuild(
    data: AiQueueJobData,
  ): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_SEARCH_CONTEXT_BUILD,
      data,
    });
  }

  async enqueueAiSalesAdviceGenerate(
    data: AiQueueJobData,
  ): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_SALES_ADVICE_GENERATE,
      data,
    });
  }

  async enqueueTemporaryMediaCleanup(
    data: MediaCleanupQueueJobData,
  ): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.MEDIA,
      jobName: QUEUE_JOB_NAMES.MEDIA_CLEANUP_TEMPORARY,
      data,
    });
  }

  async enqueueMediaImageOptimization(
    data: MediaImageOptimizationQueueJobData,
  ): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.MEDIA,
      jobName: QUEUE_JOB_NAMES.MEDIA_OPTIMIZE_IMAGE,
      data,
    });
  }

  async enqueueMediaThumbnailGeneration(
    data: MediaThumbnailQueueJobData,
  ): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.MEDIA,
      jobName: QUEUE_JOB_NAMES.MEDIA_GENERATE_THUMBNAIL,
      data,
    });
  }

  async enqueueAnalyticsCaptureEvent(
    data: AnalyticsQueueJobData,
  ): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.ANALYTICS,
      jobName: QUEUE_JOB_NAMES.ANALYTICS_CAPTURE_EVENT,
      data,
    });
  }

  async enqueueDeadLetterCapture(
    data: DeadLetterQueueJobData,
  ): Promise<EnqueuedJobResult> {
    return this.enqueue({
      queueName: QUEUE_NAMES.DEAD_LETTER,
      jobName: QUEUE_JOB_NAMES.DEAD_LETTER_CAPTURE,
      data,
      options: {
        attempts: 1,
        removeOnFailCount: 10_000,
        removeOnCompleteCount: 10_000,
      },
    });
  }

  async enqueue<TData extends VexoQueueJobData>(
    input: EnqueueJobInput<TData>,
  ): Promise<EnqueuedJobResult> {
    const config = this.queueConfigService.getConfig();

    if (!config.enabled) {
      throw new ServiceUnavailableException(
        'سیستم صف در حال حاضر غیرفعال است.',
      );
    }

    const preparedInput = this.prepareInput(input);
    const queue = this.resolveQueue(preparedInput.queueName);
    const job = await queue.add(
      preparedInput.jobName,
      preparedInput.data,
      this.createJobOptions(preparedInput),
    );

    return {
      queueName: preparedInput.queueName,
      jobName: preparedInput.jobName,
      jobId: String(job.id),
      createdAt: new Date().toISOString(),
    };
  }

  private prepareInput<TData extends VexoQueueJobData>(
    input: EnqueueJobInput<TData>,
  ): EnqueueJobInput<TData> {
    if (input.queueName !== QUEUE_NAMES.AI) {
      return input;
    }

    return QueueExecutionEnvelopeUtil.prepareAiJob(
      input as EnqueueJobInput<AiQueueJobData>,
    ) as EnqueueJobInput<TData>;
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

  private createJobOptions<TData extends VexoQueueJobData>(
    input: EnqueueJobInput<TData>,
  ): JobsOptions {
    const config = this.queueConfigService.getConfig();
    const options = input.options;

    const attempts = this.normalizeInteger(
      options?.attempts,
      config.defaultAttempts,
      1,
      20,
    );

    const backoffDelayMs = this.normalizeInteger(
      options?.backoffDelayMs,
      config.defaultBackoffDelayMs,
      100,
      3_600_000,
    );

    const removeOnCompleteCount = this.normalizeInteger(
      options?.removeOnCompleteCount,
      config.removeOnCompleteCount,
      1,
      100_000,
    );

    const removeOnFailCount = this.normalizeInteger(
      options?.removeOnFailCount,
      config.removeOnFailCount,
      1,
      100_000,
    );

    const jobOptions: JobsOptions = {
      attempts,
      backoff: {
        type: options?.backoffType ?? 'exponential',
        delay: backoffDelayMs,
      },
      removeOnComplete: {
        count: removeOnCompleteCount,
      },
      removeOnFail: {
        count: removeOnFailCount,
      },
    };

    const jobId = this.normalizeString(options?.jobId);

    if (jobId) {
      jobOptions.jobId = jobId;
    }

    const delayMs = this.normalizeOptionalInteger(
      options?.delayMs,
      0,
      2_592_000_000,
    );

    if (delayMs !== undefined) {
      jobOptions.delay = delayMs;
    }

    const priority = this.normalizeOptionalInteger(
      options?.priority,
      1,
      2_097_152,
    );

    if (priority !== undefined) {
      jobOptions.priority = priority;
    }

    return jobOptions;
  }

  private normalizeInteger(
    value: number | undefined,
    fallback: number,
    min: number,
    max: number,
  ): number {
    if (typeof value !== 'number') {
      return fallback;
    }

    if (!Number.isInteger(value) || value < min || value > max) {
      return fallback;
    }

    return value;
  }

  private normalizeOptionalInteger(
    value: number | undefined,
    min: number,
    max: number,
  ): number | undefined {
    if (typeof value !== 'number') {
      return undefined;
    }

    if (!Number.isInteger(value) || value < min || value > max) {
      return undefined;
    }

    return value;
  }

  private normalizeString(value: string | undefined): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }

  private assertNeverQueue(queueName: never): never {
    throw new ServiceUnavailableException(
      `صف ناشناخته است: ${String(queueName)}`,
    );
  }
}
