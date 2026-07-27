import { createHash, randomUUID } from 'node:crypto';

import { BadRequestException } from '@nestjs/common';

import { QUEUE_NAMES } from '../constants/queue.constants';

import { QUEUE_EXECUTION_ENVELOPE_VERSION } from '../types/queue.types';

import type {
  AiQueueJobData,
  EnqueueJobInput,
  QueueExecutionEnvelope,
  QueueIdempotencyMode,
  QueueName,
  QueuePayload,
} from '../types/queue.types';

interface QueueEnvelopeValidationInput {
  readonly queueName: QueueName;
  readonly jobName: string;
  readonly jobId?: string | number | null;
}

export interface QueueEnvelopeSnapshot {
  readonly version: string;
  readonly appliedQueue: QueueName;
  readonly registryExecutionContextBridge: boolean;
  readonly correlationPropagation: boolean;
  readonly requestPropagation: boolean;
  readonly idempotencyContextPropagation: boolean;
  readonly bullJobIdRemainsDeduplicationAuthority: boolean;
  readonly payloadIntegrityHash: string;
  readonly validationMode: string;
}

type JsonSafeValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonSafeValue[]
  | { readonly [key: string]: JsonSafeValue };

export class QueueExecutionEnvelopeUtil {
  static prepareAiJob(
    input: EnqueueJobInput<AiQueueJobData>,
  ): EnqueueJobInput<AiQueueJobData> {
    if (input.queueName !== QUEUE_NAMES.AI) {
      return input;
    }

    const task = this.normalizeRequiredString(
      input.data.task,
      'AI queue task is required.',
    ).toLowerCase();

    const metadata = input.data.metadata;
    const executionId =
      this.normalizeOptionalString(metadata.executionId) ?? randomUUID();
    const correlationId =
      this.normalizeOptionalString(metadata.correlationId) ?? executionId;
    const requestId =
      this.normalizeOptionalString(metadata.requestId) ?? correlationId;
    const source =
      this.normalizeOptionalString(metadata.source) ?? 'queue-producer';
    const producer = this.normalizeOptionalString(metadata.producer) ?? source;
    const parentExecutionId = this.normalizeOptionalString(
      metadata.parentExecutionId,
    );
    const executionContextVersion = this.normalizeOptionalString(
      metadata.executionContextVersion,
    );
    const agentId = this.normalizeOptionalString(metadata.agentId);
    const agentVersion = this.normalizeOptionalString(metadata.agentVersion);
    const agentTaskType = this.normalizeOptionalString(metadata.agentTaskType);
    const agentExecutionMode = this.normalizeOptionalString(
      metadata.agentExecutionMode,
    );
    const agentCapabilities = this.normalizeStringArray(
      metadata.agentCapabilities,
    );
    const agentSupportsHumanHandoff =
      typeof metadata.agentSupportsHumanHandoff === 'boolean'
        ? metadata.agentSupportsHumanHandoff
        : undefined;
    const agentModelRequirements = this.normalizeOptionalRecord(
      metadata.agentModelRequirements,
    );

    const explicitIdempotencyKey = this.normalizeOptionalString(
      metadata.idempotencyKey,
    );
    const jobId = this.normalizeOptionalString(input.options?.jobId);

    const idempotencyMode: QueueIdempotencyMode = explicitIdempotencyKey
      ? 'EXPLICIT'
      : jobId
        ? 'JOB_ID'
        : 'EXECUTION_ID';

    const idempotencyKey = explicitIdempotencyKey ?? jobId ?? executionId;
    const enqueuedAt = new Date().toISOString();

    const envelope: QueueExecutionEnvelope = {
      version: QUEUE_EXECUTION_ENVELOPE_VERSION,
      queueName: input.queueName,
      jobName: input.jobName,
      task,
      executionId,
      ...(executionContextVersion
        ? {
            executionContextVersion,
          }
        : {}),
      ...(agentId
        ? {
            agentId,
          }
        : {}),
      ...(agentVersion
        ? {
            agentVersion,
          }
        : {}),
      ...(agentTaskType
        ? {
            agentTaskType,
          }
        : {}),
      ...(agentExecutionMode
        ? {
            agentExecutionMode,
          }
        : {}),
      ...(agentCapabilities.length > 0
        ? {
            agentCapabilities,
          }
        : {}),
      ...(agentSupportsHumanHandoff !== undefined
        ? {
            agentSupportsHumanHandoff,
          }
        : {}),
      ...(agentModelRequirements
        ? {
            agentModelRequirements,
          }
        : {}),
      ...(parentExecutionId
        ? {
            parentExecutionId,
          }
        : {}),
      correlationId,
      requestId,
      source,
      producer,
      enqueuedAt,
      idempotencyKey,
      idempotencyMode,
      payloadHash: this.buildPayloadHash({
        task,
        prompt: input.data.prompt ?? null,
        payload: input.data.payload ?? {},
      }),
    };

    return {
      ...input,
      data: {
        ...input.data,
        task,
        envelope,
        metadata: {
          ...metadata,
          executionId,
          ...(parentExecutionId
            ? {
                parentExecutionId,
              }
            : {}),
          correlationId,
          requestId,
          source,
          producer,
          queueEnvelopeVersion: QUEUE_EXECUTION_ENVELOPE_VERSION,
          idempotencyKey,
        },
      },
    };
  }

  static assertAiJob(
    data: AiQueueJobData,
    expected: QueueEnvelopeValidationInput,
  ): QueueExecutionEnvelope {
    const envelope = data.envelope;

    if (!envelope) {
      throw new BadRequestException('AI queue execution envelope is missing.');
    }

    if (envelope.version !== QUEUE_EXECUTION_ENVELOPE_VERSION) {
      throw new BadRequestException(
        'AI queue execution envelope version is invalid.',
      );
    }

    const task = this.normalizeRequiredString(
      data.task,
      'AI queue task is required.',
    ).toLowerCase();

    this.assertEqual(
      envelope.queueName,
      expected.queueName,
      'AI queue envelope queue name does not match the worker queue.',
    );

    this.assertEqual(
      envelope.jobName,
      expected.jobName,
      'AI queue envelope job name does not match the BullMQ job.',
    );

    this.assertEqual(
      envelope.task,
      task,
      'AI queue envelope task does not match job data.',
    );

    this.assertEqual(
      data.metadata.executionContextVersion,
      envelope.executionContextVersion,
      'AI queue execution context version does not match the envelope.',
    );

    this.assertEqual(
      data.metadata.agentId,
      envelope.agentId,
      'AI queue agentId metadata does not match the envelope.',
    );

    this.assertEqual(
      data.metadata.agentVersion,
      envelope.agentVersion,
      'AI queue agentVersion metadata does not match the envelope.',
    );

    this.assertEqual(
      data.metadata.agentTaskType,
      envelope.agentTaskType,
      'AI queue agentTaskType metadata does not match the envelope.',
    );

    this.assertEqual(
      data.metadata.agentExecutionMode,
      envelope.agentExecutionMode,
      'AI queue agent execution mode does not match the envelope.',
    );

    this.assertJsonEqual(
      this.normalizeStringArray(data.metadata.agentCapabilities),
      envelope.agentCapabilities ?? [],
      'AI queue agent capabilities do not match the envelope.',
    );

    this.assertEqual(
      data.metadata.agentSupportsHumanHandoff,
      envelope.agentSupportsHumanHandoff,
      'AI queue human handoff policy does not match the envelope.',
    );

    this.assertJsonEqual(
      this.normalizeOptionalRecord(data.metadata.agentModelRequirements),
      envelope.agentModelRequirements,
      'AI queue model requirements do not match the envelope.',
    );

    this.assertEqual(
      data.metadata.executionId,
      envelope.executionId,
      'AI queue executionId metadata does not match the envelope.',
    );

    this.assertEqual(
      data.metadata.correlationId,
      envelope.correlationId,
      'AI queue correlationId metadata does not match the envelope.',
    );

    this.assertEqual(
      data.metadata.requestId,
      envelope.requestId,
      'AI queue requestId metadata does not match the envelope.',
    );

    this.assertEqual(
      data.metadata.idempotencyKey,
      envelope.idempotencyKey,
      'AI queue idempotencyKey metadata does not match the envelope.',
    );

    this.assertEqual(
      data.metadata.queueEnvelopeVersion,
      envelope.version,
      'AI queue envelope version metadata does not match the envelope.',
    );

    const payloadHash = this.buildPayloadHash({
      task,
      prompt: data.prompt ?? null,
      payload: data.payload ?? {},
    });

    this.assertEqual(
      envelope.payloadHash,
      payloadHash,
      'AI queue payload integrity hash does not match the envelope.',
    );

    const jobId = this.normalizeOptionalString(expected.jobId);

    if (envelope.idempotencyMode === 'JOB_ID' && jobId) {
      this.assertEqual(
        envelope.idempotencyKey,
        jobId,
        'AI queue idempotency key does not match the BullMQ job id.',
      );
    }

    return envelope;
  }

  static getSnapshot(): QueueEnvelopeSnapshot {
    return {
      version: QUEUE_EXECUTION_ENVELOPE_VERSION,
      appliedQueue: QUEUE_NAMES.AI,
      registryExecutionContextBridge: true,
      correlationPropagation: true,
      requestPropagation: true,
      idempotencyContextPropagation: true,
      bullJobIdRemainsDeduplicationAuthority: true,
      payloadIntegrityHash: 'SHA-256',
      validationMode: 'PRODUCER_ENRICHMENT_AND_WORKER_ASSERTION',
    };
  }

  private static buildPayloadHash(value: QueuePayload): string {
    return createHash('sha256')
      .update(JSON.stringify(this.toJsonSafeValue(value)))
      .digest('hex');
  }

  private static toJsonSafeValue(value: unknown): JsonSafeValue {
    if (value === null) {
      return null;
    }

    if (typeof value === 'string' || typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : String(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.toJsonSafeValue(item));
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right));
      const record: Record<string, JsonSafeValue> = {};

      for (const [key, item] of entries) {
        record[key] = this.toJsonSafeValue(item);
      }

      return record;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (typeof value === 'symbol') {
      return value.description ?? 'symbol';
    }

    if (typeof value === 'function') {
      return value.name || 'anonymous-function';
    }

    return null;
  }

  private static assertJsonEqual(
    actual: unknown,
    expected: unknown,
    message: string,
  ): void {
    const actualJson = JSON.stringify(this.toJsonSafeValue(actual));
    const expectedJson = JSON.stringify(this.toJsonSafeValue(expected));

    if (actualJson !== expectedJson) {
      throw new BadRequestException(message);
    }
  }

  private static normalizeStringArray(value: unknown): string[] {
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

  private static normalizeOptionalRecord(
    value: unknown,
  ): QueuePayload | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return value as QueuePayload;
  }

  private static assertEqual(
    actual: unknown,
    expected: unknown,
    message: string,
  ): void {
    if (actual !== expected) {
      throw new BadRequestException(message);
    }
  }

  private static normalizeRequiredString(
    value: unknown,
    message: string,
  ): string {
    const normalized = this.normalizeOptionalString(value);

    if (!normalized) {
      throw new BadRequestException(message);
    }

    return normalized;
  }

  private static normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized.slice(0, 500) : undefined;
  }
}
