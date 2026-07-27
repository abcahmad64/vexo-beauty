import type { QueueJobMetadata } from '../types/queue.types';

type QueueJobMetadataInput = {
  readonly actorId?: string | null;
  readonly requestId?: string | null;
  readonly correlationId?: string | null;
  readonly source?: string | null;
  readonly locale?: string | null;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  readonly executionId?: string | null;
  readonly parentExecutionId?: string | null;
  readonly executionContextVersion?: string | null;
  readonly queueEnvelopeVersion?: string | null;
  readonly idempotencyKey?: string | null;
  readonly producer?: string | null;
  readonly agentId?: string | null;
  readonly agentVersion?: string | null;
  readonly agentTaskType?: string | null;
  readonly agentExecutionMode?: string | null;
};

type MutableQueueJobMetadata = {
  -readonly [Key in keyof QueueJobMetadata]: QueueJobMetadata[Key];
};

export class QueueJobMetadataUtil {
  static create(input?: QueueJobMetadataInput): QueueJobMetadata {
    const metadata: MutableQueueJobMetadata = {
      createdAt: new Date().toISOString(),
    };

    const actorId = this.normalizeOptionalString(input?.actorId);
    const requestId = this.normalizeOptionalString(input?.requestId);
    const correlationId = this.normalizeOptionalString(input?.correlationId);
    const source = this.normalizeOptionalString(input?.source);
    const locale = this.normalizeOptionalString(input?.locale);
    const ipAddress = this.normalizeOptionalString(input?.ipAddress);
    const userAgent = this.normalizeOptionalString(input?.userAgent);
    const executionId = this.normalizeOptionalString(input?.executionId);
    const parentExecutionId = this.normalizeOptionalString(
      input?.parentExecutionId,
    );
    const executionContextVersion = this.normalizeOptionalString(
      input?.executionContextVersion,
    );
    const queueEnvelopeVersion = this.normalizeOptionalString(
      input?.queueEnvelopeVersion,
    );
    const idempotencyKey = this.normalizeOptionalString(input?.idempotencyKey);
    const producer = this.normalizeOptionalString(input?.producer);
    const agentId = this.normalizeOptionalString(input?.agentId);
    const agentVersion = this.normalizeOptionalString(input?.agentVersion);
    const agentTaskType = this.normalizeOptionalString(input?.agentTaskType);
    const agentExecutionMode = this.normalizeOptionalString(
      input?.agentExecutionMode,
    );

    if (actorId) {
      metadata.actorId = actorId;
    }

    if (requestId) {
      metadata.requestId = requestId;
    }

    if (correlationId) {
      metadata.correlationId = correlationId;
    }

    if (source) {
      metadata.source = source;
    }

    if (locale) {
      metadata.locale = locale;
    }

    if (ipAddress) {
      metadata.ipAddress = ipAddress;
    }

    if (userAgent) {
      metadata.userAgent = userAgent;
    }

    if (executionId) {
      metadata.executionId = executionId;
    }

    if (parentExecutionId) {
      metadata.parentExecutionId = parentExecutionId;
    }

    if (executionContextVersion) {
      metadata.executionContextVersion = executionContextVersion;
    }

    if (queueEnvelopeVersion) {
      metadata.queueEnvelopeVersion = queueEnvelopeVersion;
    }

    if (idempotencyKey) {
      metadata.idempotencyKey = idempotencyKey;
    }

    if (producer) {
      metadata.producer = producer;
    }

    if (agentId) {
      metadata.agentId = agentId;
    }

    if (agentVersion) {
      metadata.agentVersion = agentVersion;
    }

    if (agentTaskType) {
      metadata.agentTaskType = agentTaskType;
    }

    if (agentExecutionMode) {
      metadata.agentExecutionMode = agentExecutionMode;
    }

    return metadata;
  }

  private static normalizeOptionalString(
    value: string | null | undefined,
  ): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }
}
