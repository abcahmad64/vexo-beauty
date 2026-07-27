import { createHash } from 'node:crypto';

import { QUEUE_NAMES } from '../constants/queue.constants';
import {
  QUEUE_EXECUTION_CANCELLATION_VERSION,
  type QueueExecutionCancellation,
  type QueueExecutionCancellationOutcome,
  type QueuePayload,
  type VexoQueueJobData,
} from '../types/queue.types';

const SIGNAL_KIND = 'VEXO_QUEUE_EXECUTION_CANCELLATION';
const DEFAULT_REASON = 'لغو اجرای هوش مصنوعی توسط مدیر درخواست شد.';
const MAX_REASON_LENGTH = 500;

interface CancellationSignalPayload {
  readonly kind: typeof SIGNAL_KIND;
  readonly cancellation: QueueExecutionCancellation;
}

export interface LinkedAbortSignal {
  readonly signal: AbortSignal;
  readonly didTimeout: () => boolean;
  readonly cleanup: () => void;
}

export class QueueExecutionCancelledError extends Error {
  readonly code = 'QUEUE_EXECUTION_CANCELLED';

  constructor(readonly cancellation: QueueExecutionCancellation) {
    super(cancellation.reason);
    this.name = 'QueueExecutionCancelledError';
  }
}

export class QueueExecutionCancellationUtil {
  static createRequest(input: {
    readonly jobId: string;
    readonly actorId: string;
    readonly reason?: string;
    readonly stateAtRequest: string;
    readonly data: VexoQueueJobData;
    readonly requestedAt?: string;
  }): QueueExecutionCancellation {
    const metadata = this.toRecord(input.data.metadata);
    const envelope = this.toRecord(
      'envelope' in input.data ? input.data.envelope : undefined,
    );
    const jobId = this.requiredString(input.jobId, 'شناسه Job معتبر نیست.');
    const requestedBy = this.requiredString(
      input.actorId,
      'شناسه درخواست‌کننده لغو معتبر نیست.',
    );
    const requestedAt = input.requestedAt ?? new Date().toISOString();
    const reason = this.normalizeReason(input.reason);
    const cancellationId = `ai-cancel-${createHash('sha256')
      .update(jobId)
      .digest('hex')
      .slice(0, 32)}`;

    return {
      version: QUEUE_EXECUTION_CANCELLATION_VERSION,
      status: 'REQUESTED',
      queueName: QUEUE_NAMES.AI,
      jobId,
      cancellationId,
      requestedAt,
      requestedBy,
      reason,
      source: 'admin.queue.ai-execution-cancellation',
      stateAtRequest: this.requiredString(
        input.stateAtRequest,
        'وضعیت Job هنگام درخواست لغو معتبر نیست.',
      ),
      activeSignalDispatched: false,
      ...this.optionalExecutionMetadata(metadata, envelope),
    };
  }

  static readFromData(
    data: VexoQueueJobData,
  ): QueueExecutionCancellation | undefined {
    return this.parseCancellation(this.toRecord(data.metadata).cancellation);
  }

  static readFromProgress(
    progress: unknown,
  ): QueueExecutionCancellation | undefined {
    return this.parseCancellation(this.toRecord(progress).cancellation);
  }

  static applyToData<TData extends VexoQueueJobData>(
    data: TData,
    cancellation: QueueExecutionCancellation,
  ): TData {
    return {
      ...data,
      metadata: {
        ...data.metadata,
        cancellation,
      },
    };
  }

  static applyToProgress(
    progress: unknown,
    cancellation: QueueExecutionCancellation,
  ): QueuePayload {
    return {
      ...this.toRecord(progress),
      cancellation,
    };
  }

  static markSignalDispatched(
    cancellation: QueueExecutionCancellation,
    dispatched: boolean,
  ): QueueExecutionCancellation {
    return {
      ...cancellation,
      activeSignalDispatched: cancellation.activeSignalDispatched || dispatched,
    };
  }

  static complete(
    cancellation: QueueExecutionCancellation,
    outcome: QueueExecutionCancellationOutcome,
    completedAt = new Date().toISOString(),
  ): QueueExecutionCancellation {
    return {
      ...cancellation,
      status: 'CANCELLED',
      completedAt,
      outcome,
    };
  }

  static supersede(
    cancellation: QueueExecutionCancellation,
    outcome: 'COMPLETED_BEFORE_CANCELLATION' | 'FAILED_BEFORE_CANCELLATION',
    completedAt = new Date().toISOString(),
  ): QueueExecutionCancellation {
    return {
      ...cancellation,
      status: 'SUPERSEDED',
      completedAt,
      outcome,
    };
  }

  static serializeSignalReason(
    cancellation: QueueExecutionCancellation,
  ): string {
    return JSON.stringify({
      kind: SIGNAL_KIND,
      cancellation,
    } satisfies CancellationSignalPayload);
  }

  static readFromSignal(
    signal?: AbortSignal,
  ): QueueExecutionCancellation | undefined {
    if (!signal?.aborted) {
      return undefined;
    }

    const reason: unknown = signal.reason;

    if (typeof reason === 'string') {
      try {
        const parsed: unknown = JSON.parse(reason);
        const record = this.toRecord(parsed);

        if (record.kind !== SIGNAL_KIND) {
          return undefined;
        }

        return this.parseCancellation(record.cancellation);
      } catch {
        return undefined;
      }
    }

    if (reason instanceof QueueExecutionCancelledError) {
      return reason.cancellation;
    }

    return undefined;
  }

  static resolve(
    data: VexoQueueJobData,
    signal?: AbortSignal,
  ): QueueExecutionCancellation | undefined {
    return this.readFromSignal(signal) ?? this.readFromData(data);
  }

  static throwIfCancellationRequested(
    data: VexoQueueJobData,
    signal?: AbortSignal,
  ): void {
    const cancellation = this.resolve(data, signal);

    if (cancellation?.status === 'REQUESTED') {
      throw new QueueExecutionCancelledError(cancellation);
    }
  }

  static throwIfAborted(signal?: AbortSignal): void {
    if (!signal?.aborted) {
      return;
    }

    const cancellation = this.readFromSignal(signal);

    if (cancellation) {
      throw new QueueExecutionCancelledError(cancellation);
    }

    const fallback = this.createRequest({
      jobId: 'unknown-active-job',
      actorId: 'system:abort-signal',
      reason:
        typeof signal.reason === 'string' ? signal.reason : DEFAULT_REASON,
      stateAtRequest: 'active',
      data: {
        task: 'unknown',
        metadata: {
          createdAt: new Date().toISOString(),
        },
      },
    });

    throw new QueueExecutionCancelledError(fallback);
  }

  static isCancellation(error: unknown, signal?: AbortSignal): boolean {
    return (
      error instanceof QueueExecutionCancelledError ||
      this.readFromSignal(signal) !== undefined
    );
  }

  static toCancellationError(
    error: unknown,
    data: VexoQueueJobData,
    signal?: AbortSignal,
  ): QueueExecutionCancelledError {
    if (error instanceof QueueExecutionCancelledError) {
      return error;
    }

    const cancellation = this.resolve(data, signal);

    if (cancellation) {
      return new QueueExecutionCancelledError(cancellation);
    }

    throw error;
  }

  static createLinkedTimeoutSignal(
    externalSignal: AbortSignal | undefined,
    timeoutMs: number,
  ): LinkedAbortSignal {
    const controller = new AbortController();
    let timedOut = false;

    const onExternalAbort = () => {
      controller.abort(externalSignal?.reason);
    };

    if (externalSignal?.aborted) {
      onExternalAbort();
    } else {
      externalSignal?.addEventListener('abort', onExternalAbort, {
        once: true,
      });
    }

    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort('QUEUE_OPERATION_TIMEOUT');
    }, timeoutMs);

    return {
      signal: controller.signal,
      didTimeout: () => timedOut,
      cleanup: () => {
        clearTimeout(timeout);
        externalSignal?.removeEventListener('abort', onExternalAbort);
      },
    };
  }

  private static parseCancellation(
    value: unknown,
  ): QueueExecutionCancellation | undefined {
    const record = this.toRecord(value);

    const status = record.status;

    if (
      record.version !== QUEUE_EXECUTION_CANCELLATION_VERSION ||
      typeof status !== 'string' ||
      !['REQUESTED', 'CANCELLED', 'SUPERSEDED'].includes(status) ||
      record.queueName !== QUEUE_NAMES.AI ||
      record.source !== 'admin.queue.ai-execution-cancellation'
    ) {
      return undefined;
    }

    const required = [
      'jobId',
      'cancellationId',
      'requestedAt',
      'requestedBy',
      'reason',
      'source',
      'stateAtRequest',
    ];

    if (
      required.some((key) => {
        const candidate = record[key];

        return typeof candidate !== 'string' || candidate.trim().length === 0;
      }) ||
      typeof record.activeSignalDispatched !== 'boolean'
    ) {
      return undefined;
    }

    return record as unknown as QueueExecutionCancellation;
  }

  private static optionalExecutionMetadata(
    metadata: Record<string, unknown>,
    envelope: Record<string, unknown>,
  ): Pick<
    QueueExecutionCancellation,
    'executionId' | 'correlationId' | 'requestId'
  > {
    const executionId = this.optionalString(
      envelope.executionId ?? metadata.executionId,
    );
    const correlationId = this.optionalString(
      envelope.correlationId ?? metadata.correlationId,
    );
    const requestId = this.optionalString(
      envelope.requestId ?? metadata.requestId,
    );

    return {
      ...(executionId ? { executionId } : {}),
      ...(correlationId ? { correlationId } : {}),
      ...(requestId ? { requestId } : {}),
    };
  }

  private static normalizeReason(value?: string): string {
    const normalized = value?.trim() || DEFAULT_REASON;

    return normalized.slice(0, MAX_REASON_LENGTH);
  }

  private static requiredString(value: string, message: string): string {
    const normalized = value.trim();

    if (!normalized) {
      throw new Error(message);
    }

    return normalized;
  }

  private static optionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();

    return normalized || undefined;
  }

  private static toRecord(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
