import { BadRequestException } from '@nestjs/common';

import { Processor, WorkerHost } from '@nestjs/bullmq';

import type { Job } from 'bullmq';

import {
  QUEUE_JOB_NAMES,
  QUEUE_NAMES,
} from '../../../core/queue/constants/queue.constants';

import { QueueProcessorBase } from '../../../core/queue/processors/queue-processor.base';

import { QueueDeadLetterService } from '../../../core/queue/services/queue-dead-letter.service';

import { QueueProducerService } from '../../../core/queue/services/queue-producer.service';

import type {
  AiQueueJobData,
  QueueExecutionCancellation,
  QueueExecutionEnvelope,
  QueueJobName,
  QueueJobResult,
} from '../../../core/queue/types/queue.types';

import { QueueExecutionCancellationUtil } from '../../../core/queue/utils/queue-execution-cancellation.util';
import { QueueExecutionEnvelopeUtil } from '../../../core/queue/utils/queue-execution-envelope.util';

import { AiBudgetEnforcementException } from '../errors/ai-budget-enforcement.exception';

import { AiBudgetEnforcementService } from '../services/ai-budget-enforcement.service';

import { AiContextService } from '../services/ai-context.service';

import { CatalogResearchBootstrapService } from '../services/catalog-research-bootstrap.service';

import { CatalogWebResearchService } from '../services/catalog-web-research.service';

type AiCatalogSearchPayload = {
  readonly query?: string;
  readonly productIds?: string[];
  readonly categoryId?: string;
  readonly brandId?: string;
  readonly budgetMin?: number;
  readonly budgetMax?: number;
  readonly limit?: number;
};

@Processor(QUEUE_NAMES.AI)
export class AiQueueProcessor extends WorkerHost {
  constructor(
    private readonly aiContextService: AiContextService,
    private readonly budgetEnforcement: AiBudgetEnforcementService,
    private readonly catalogResearchBootstrapService: CatalogResearchBootstrapService,
    private readonly catalogWebResearchService: CatalogWebResearchService,
    private readonly queueProducer: QueueProducerService,
    private readonly deadLetterService: QueueDeadLetterService,
  ) {
    super();
  }

  async process(
    job: Job<AiQueueJobData, QueueJobResult, QueueJobName>,
    _token?: string,
    signal?: AbortSignal,
  ): Promise<QueueJobResult> {
    const handler = new AiQueueProcessorHandler(
      this.aiContextService,
      this.budgetEnforcement,
      this.catalogResearchBootstrapService,
      this.catalogWebResearchService,
      this.queueProducer,
      this.deadLetterService,
    );

    return handler.process(job, signal);
  }

  cancelActiveJob(
    jobId: string,
    cancellation: QueueExecutionCancellation,
  ): boolean {
    return this.worker.cancelJob(
      jobId,
      QueueExecutionCancellationUtil.serializeSignalReason(cancellation),
    );
  }
}

class AiQueueProcessorHandler extends QueueProcessorBase {
  constructor(
    private readonly aiContextService: AiContextService,
    private readonly budgetEnforcement: AiBudgetEnforcementService,
    private readonly catalogResearchBootstrapService: CatalogResearchBootstrapService,
    private readonly catalogWebResearchService: CatalogWebResearchService,
    private readonly queueProducer: QueueProducerService,
    private readonly deadLetterService: QueueDeadLetterService,
  ) {
    super();
  }

  async process(
    job: Job<AiQueueJobData, QueueJobResult, QueueJobName>,
    signal?: AbortSignal,
  ): Promise<QueueJobResult> {
    this.logJobStarted(QUEUE_NAMES.AI, job);

    try {
      QueueExecutionCancellationUtil.throwIfCancellationRequested(
        job.data,
        signal,
      );

      if (job.name !== QUEUE_JOB_NAMES.AI_PROCESS) {
        throw new BadRequestException('نوع Job هوش مصنوعی معتبر نیست.');
      }

      const envelope = QueueExecutionEnvelopeUtil.assertAiJob(job.data, {
        queueName: QUEUE_NAMES.AI,
        jobName: job.name,
        jobId: job.id,
      });

      await this.budgetEnforcement.preflightQueue({
        taskType: job.data.task,
        userId: job.data.metadata.actorId,
        metadata: {
          ...job.data.metadata,
          executionId: envelope.executionId,
          correlationId: envelope.correlationId,
          requestId: envelope.requestId,
        },
      });

      const result = await this.processAiTask(job.data, envelope, signal);

      QueueExecutionCancellationUtil.throwIfCancellationRequested(
        job.data,
        signal,
      );

      this.logJobCompleted(QUEUE_NAMES.AI, job);

      return this.success('Job هوش مصنوعی با موفقیت پردازش شد.', {
        ...result,
        queueExecution: this.toExecutionSummary(envelope),
      });
    } catch (error) {
      if (QueueExecutionCancellationUtil.isCancellation(error, signal)) {
        return this.completeCancellation(job, error, signal);
      }

      if (AiBudgetEnforcementException.isBudgetEnforcementException(error)) {
        return this.completeBudgetBlock(job, error);
      }

      const failureInput = this.buildFailureInput(QUEUE_NAMES.AI, job, error);

      this.logJobFailed(QUEUE_NAMES.AI, job, error, failureInput);

      if (failureInput.retryDecision.shouldCaptureDeadLetter) {
        this.logJobDeadLetter(QUEUE_NAMES.AI, job, failureInput);
        await this.deadLetterService.captureFailure(failureInput);
      } else {
        this.logJobRetryScheduled(QUEUE_NAMES.AI, job, failureInput);
      }

      throw error;
    }
  }

  private completeBudgetBlock(
    job: Job<AiQueueJobData, QueueJobResult, QueueJobName>,
    error: AiBudgetEnforcementException,
  ): QueueJobResult {
    const failureInput = this.buildFailureInput(QUEUE_NAMES.AI, job, error);

    this.logJobFailed(QUEUE_NAMES.AI, job, error, failureInput);

    return this.failed('Job هوش مصنوعی به دلیل سیاست بودجه اجرا نشد.', {
      budgetBlocked: true,
      reason: error.reason,
      details: error.details,
      retryScheduled: false,
      deadLetterCaptured: false,
    });
  }

  private async completeCancellation(
    job: Job<AiQueueJobData, QueueJobResult, QueueJobName>,
    error: unknown,
    signal?: AbortSignal,
  ): Promise<QueueJobResult> {
    const cancellationError =
      QueueExecutionCancellationUtil.toCancellationError(
        error,
        job.data,
        signal,
      );
    const outcome = signal?.aborted
      ? 'CANCELLED_DURING_EXECUTION'
      : 'CANCELLED_BEFORE_START';
    const cancellation = QueueExecutionCancellationUtil.complete(
      cancellationError.cancellation,
      outcome,
    );

    job.discard();
    await job.updateData(
      QueueExecutionCancellationUtil.applyToData(job.data, cancellation),
    );
    await job.updateProgress(
      QueueExecutionCancellationUtil.applyToProgress(
        job.progress,
        cancellation,
      ),
    );
    this.logJobCancelled(QUEUE_NAMES.AI, job, cancellation);

    return this.failed('Job هوش مصنوعی با درخواست مدیر لغو شد.', {
      cancelled: true,
      cancellation,
      retryScheduled: false,
      deadLetterCaptured: false,
    });
  }

  private async processAiTask(
    data: AiQueueJobData,
    envelope: QueueExecutionEnvelope,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    QueueExecutionCancellationUtil.throwIfAborted(signal);
    const task = this.normalizeTask(data.task);

    if (task === 'catalog.research.bootstrap') {
      return this.processCatalogResearchBootstrap(data, envelope, signal);
    }

    if (task === 'catalog.research.web') {
      return this.processCatalogWebResearch(data, signal);
    }

    if (task === 'catalog.search') {
      return this.processCatalogSearch(data, signal);
    }

    if (task === 'product.snapshot') {
      return this.processProductSnapshot(data, signal);
    }

    if (task === 'product.snapshots') {
      return this.processProductSnapshots(data, signal);
    }

    if (task === 'user.behavior') {
      return this.processUserBehavior(data, signal);
    }

    throw new BadRequestException(
      `Task هوش مصنوعی پشتیبانی نمی‌شود: ${data.task}`,
    );
  }

  private async processCatalogResearchBootstrap(
    data: AiQueueJobData,
    envelope: QueueExecutionEnvelope,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    QueueExecutionCancellationUtil.throwIfAborted(signal);
    const researchRunId = this.resolveRequiredString(
      data.payload,
      ['researchRunId'],
      'شناسه پرونده تحقیق کاتالوگ الزامی است.',
    );

    const productId = this.resolveRequiredString(
      data.payload,
      ['productId'],
      'شناسه محصول تحقیق کاتالوگ الزامی است.',
    );

    const bootstrapResult =
      await this.catalogResearchBootstrapService.bootstrap({
        researchRunId,
        productId,
      });

    QueueExecutionCancellationUtil.throwIfAborted(signal);

    const queued = await this.queueProducer.enqueue({
      queueName: QUEUE_NAMES.AI,
      jobName: QUEUE_JOB_NAMES.AI_PROCESS,
      data: {
        task: 'catalog.research.web',
        payload: {
          researchRunId,
          productId,
        },
        metadata: {
          source: 'catalog.research.bootstrap',
          producer: 'ai-queue-processor',
          createdAt: new Date().toISOString(),
          correlationId: envelope.correlationId,
          requestId: envelope.requestId,
          parentExecutionId: envelope.executionId,
          executionContextVersion: data.metadata.executionContextVersion,
          agentId: data.metadata.agentId,
          agentVersion: data.metadata.agentVersion,
          agentTaskType: data.metadata.agentTaskType,
          agentExecutionMode: data.metadata.agentExecutionMode,
          agentCapabilities: data.metadata.agentCapabilities,
          agentSupportsHumanHandoff: data.metadata.agentSupportsHumanHandoff,
          agentModelRequirements: data.metadata.agentModelRequirements,
          idempotencyKey: `catalog-web-research-${researchRunId}`,
          ...(data.metadata.actorId
            ? {
                actorId: data.metadata.actorId,
              }
            : {}),
        },
      },
      options: {
        jobId: `catalog-web-research-${researchRunId}`,
        attempts: 3,
        backoffDelayMs: 10_000,
        removeOnCompleteCount: 5_000,
        removeOnFailCount: 10_000,
      },
    });

    return {
      ...bootstrapResult,
      webResearchQueued: true,
      webResearchQueue: {
        queueName: queued.queueName,
        jobName: queued.jobName,
        jobId: queued.jobId,
        createdAt: queued.createdAt,
      },
    };
  }

  private async processCatalogWebResearch(
    data: AiQueueJobData,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    QueueExecutionCancellationUtil.throwIfAborted(signal);
    const researchRunId = this.resolveRequiredString(
      data.payload,
      ['researchRunId'],
      'شناسه پرونده تحقیق کاتالوگ الزامی است.',
    );

    const productId = this.resolveRequiredString(
      data.payload,
      ['productId'],
      'شناسه محصول تحقیق کاتالوگ الزامی است.',
    );

    return this.catalogWebResearchService.research(
      {
        researchRunId,
        productId,
      },
      { signal },
    );
  }

  private async processCatalogSearch(
    data: AiQueueJobData,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    QueueExecutionCancellationUtil.throwIfAborted(signal);
    const payload = this.resolveCatalogSearchPayload(data.payload);

    const result = await this.aiContextService.searchCatalog(payload);

    QueueExecutionCancellationUtil.throwIfAborted(signal);

    return {
      task: 'catalog.search',
      total: result.total,
      products: result.products,
      metadata: data.metadata,
    };
  }

  private async processProductSnapshot(
    data: AiQueueJobData,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    QueueExecutionCancellationUtil.throwIfAborted(signal);
    const identifier = this.resolveRequiredString(
      data.payload,
      ['identifier', 'productId', 'slug', 'sku'],
      'شناسه محصول برای دریافت Snapshot الزامی است.',
    );

    const snapshot = await this.aiContextService.getProductSnapshot(identifier);

    QueueExecutionCancellationUtil.throwIfAborted(signal);

    return {
      task: 'product.snapshot',
      identifier,
      snapshot,
      metadata: data.metadata,
    };
  }

  private async processProductSnapshots(
    data: AiQueueJobData,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    QueueExecutionCancellationUtil.throwIfAborted(signal);
    const productIds = this.resolveStringArray(data.payload?.productIds);

    if (productIds.length === 0) {
      throw new BadRequestException(
        'لیست شناسه محصولات برای دریافت Snapshotها الزامی است.',
      );
    }

    const snapshots =
      await this.aiContextService.getProductSnapshots(productIds);

    QueueExecutionCancellationUtil.throwIfAborted(signal);

    return {
      task: 'product.snapshots',
      count: snapshots.length,
      snapshots,
      metadata: data.metadata,
    };
  }

  private async processUserBehavior(
    data: AiQueueJobData,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    QueueExecutionCancellationUtil.throwIfAborted(signal);
    const userId =
      this.resolveOptionalString(data.payload?.userId) ?? data.metadata.actorId;

    if (!userId) {
      throw new BadRequestException(
        'شناسه کاربر برای دریافت Context رفتار کاربر الزامی است.',
      );
    }

    const context = await this.aiContextService.getUserBehaviorContext(userId);

    QueueExecutionCancellationUtil.throwIfAborted(signal);

    return {
      task: 'user.behavior',
      userId,
      context,
      metadata: data.metadata,
    };
  }

  private toExecutionSummary(
    envelope: QueueExecutionEnvelope,
  ): Record<string, unknown> {
    return {
      version: envelope.version,
      executionId: envelope.executionId,
      parentExecutionId: envelope.parentExecutionId ?? null,
      correlationId: envelope.correlationId,
      requestId: envelope.requestId,
      idempotencyKey: envelope.idempotencyKey,
      idempotencyMode: envelope.idempotencyMode,
      source: envelope.source,
      producer: envelope.producer,
      executionContextVersion: envelope.executionContextVersion ?? null,
      agentId: envelope.agentId ?? null,
      agentVersion: envelope.agentVersion ?? null,
      agentTaskType: envelope.agentTaskType ?? null,
      agentExecutionMode: envelope.agentExecutionMode ?? null,
      payloadHash: envelope.payloadHash,
    };
  }

  private resolveCatalogSearchPayload(
    payload?: Record<string, unknown>,
  ): AiCatalogSearchPayload {
    return {
      query: this.resolveOptionalString(payload?.query),
      productIds: this.resolveStringArray(payload?.productIds),
      categoryId: this.resolveOptionalString(payload?.categoryId),
      brandId: this.resolveOptionalString(payload?.brandId),
      budgetMin: this.resolveOptionalNumber(payload?.budgetMin),
      budgetMax: this.resolveOptionalNumber(payload?.budgetMax),
      limit: this.resolveOptionalNumber(payload?.limit),
    };
  }

  private normalizeTask(task: string): string {
    const normalized = task.trim().toLowerCase();

    if (normalized.length === 0) {
      throw new BadRequestException('نام Task هوش مصنوعی الزامی است.');
    }

    return normalized;
  }

  private resolveRequiredString(
    payload: Record<string, unknown> | undefined,
    keys: readonly string[],
    errorMessage: string,
  ): string {
    for (const key of keys) {
      const value = this.resolveOptionalString(payload?.[key]);

      if (value) {
        return value;
      }
    }

    throw new BadRequestException(errorMessage);
  }

  private resolveOptionalString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    return undefined;
  }

  private resolveOptionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : Number.NaN;

    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(
        'مقدار عددی ارسال‌شده برای Task هوش مصنوعی معتبر نیست.',
      );
    }

    return parsed;
  }

  private resolveStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return [
      ...new Set(
        value
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      ),
    ];
  }
}
