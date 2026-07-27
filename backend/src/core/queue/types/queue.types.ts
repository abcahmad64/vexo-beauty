import type { QueueJobName, QueueName } from '../constants/queue.constants';

export type { QueueJobName, QueueName } from '../constants/queue.constants';

export type QueueBackoffType = 'fixed' | 'exponential';

export type QueuePayload = Readonly<Record<string, unknown>>;

export const QUEUE_EXECUTION_ENVELOPE_VERSION = '1.0.0';
export const QUEUE_FAILURE_TAXONOMY_VERSION = '1.0.0';
export const QUEUE_RETRY_POLICY_VERSION = '1.0.0';
export const QUEUE_EXECUTION_OBSERVABILITY_VERSION = '1.0.0';
export const QUEUE_METRICS_AGGREGATION_VERSION = '1.0.0';
export const QUEUE_OPERATIONAL_HEALTH_VERSION = '1.0.0';
export const QUEUE_EXECUTION_CANCELLATION_VERSION = '1.0.0';

export type QueueIdempotencyMode = 'EXPLICIT' | 'JOB_ID' | 'EXECUTION_ID';

export type QueueFailureCategory =
  | 'VALIDATION'
  | 'AUTHORIZATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'TRANSIENT_NETWORK'
  | 'CIRCUIT_OPEN'
  | 'PERMANENT'
  | 'UNKNOWN';

export type QueueFailureSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface QueueExecutionEnvelope {
  readonly version: typeof QUEUE_EXECUTION_ENVELOPE_VERSION;
  readonly queueName: QueueName;
  readonly jobName: string;
  readonly task: string;
  readonly executionId: string;
  readonly executionContextVersion?: string;
  readonly agentId?: string;
  readonly agentVersion?: string;
  readonly agentTaskType?: string;
  readonly agentExecutionMode?: string;
  readonly agentCapabilities?: readonly string[];
  readonly agentSupportsHumanHandoff?: boolean;
  readonly agentModelRequirements?: QueuePayload;
  readonly parentExecutionId?: string;
  readonly correlationId: string;
  readonly requestId: string;
  readonly source: string;
  readonly producer: string;
  readonly enqueuedAt: string;
  readonly idempotencyKey: string;
  readonly idempotencyMode: QueueIdempotencyMode;
  readonly payloadHash: string;
}

export interface QueueFailureClassification {
  readonly version: typeof QUEUE_FAILURE_TAXONOMY_VERSION;
  readonly category: QueueFailureCategory;
  readonly code: string;
  readonly retryable: boolean;
  readonly severity: QueueFailureSeverity;
  readonly message: string;
  readonly statusCode?: number;
  readonly classifiedAt: string;
}

export type QueueRetryAction =
  'RETRY' | 'DEAD_LETTER_NON_RETRYABLE' | 'DEAD_LETTER_EXHAUSTED';

export type QueueRetryReason =
  | 'RETRY_ATTEMPTS_REMAIN'
  | 'NON_RETRYABLE_FAILURE'
  | 'RETRY_ATTEMPTS_EXHAUSTED';

export interface QueueAttemptContext {
  readonly attemptsMade: number;
  readonly attemptsStarted: number;
  readonly currentAttempt: number;
  readonly maxAttempts: number;
  readonly attemptsRemaining: number;
  readonly finalAttempt: boolean;
}

export interface QueueRetryDecision {
  readonly version: typeof QUEUE_RETRY_POLICY_VERSION;
  readonly action: QueueRetryAction;
  readonly reason: QueueRetryReason;
  readonly retryable: boolean;
  readonly shouldRetry: boolean;
  readonly shouldDiscard: boolean;
  readonly shouldCaptureDeadLetter: boolean;
  readonly attempt: QueueAttemptContext;
  readonly decidedAt: string;
}

export type QueueExecutionPhase =
  | 'STARTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRY_SCHEDULED'
  | 'DEAD_LETTER'
  | 'CANCELLED';

export interface QueueExecutionObservation {
  readonly version: typeof QUEUE_EXECUTION_OBSERVABILITY_VERSION;
  readonly queueName: QueueName;
  readonly jobName: string;
  readonly jobId?: string;
  readonly phase: QueueExecutionPhase;
  readonly observedAt: string;
  readonly attempt: QueueAttemptContext;
  readonly execution: {
    readonly executionId?: string;
    readonly parentExecutionId?: string;
    readonly correlationId?: string;
    readonly requestId?: string;
    readonly agentId?: string;
    readonly agentTaskType?: string;
  };
  readonly failure?: QueueFailureClassification;
  readonly retryDecision?: QueueRetryDecision;
}

export type QueueOperationalHealthLevel =
  'HEALTHY' | 'WARNING' | 'DEGRADED' | 'CRITICAL';

export type QueueOperationalSignalCode =
  'BACKLOG' | 'FAILED' | 'DELAYED' | 'FAILURE_RATE' | 'PAUSED_WITH_BACKLOG';

export type QueueOperationalSignalLevel = 'WARNING' | 'DEGRADED' | 'CRITICAL';

export interface QueueOperationalHealthThresholds {
  readonly backlogWarningThreshold: number;
  readonly backlogCriticalThreshold: number;
  readonly failedWarningThreshold: number;
  readonly failedCriticalThreshold: number;
  readonly delayedWarningThreshold: number;
  readonly delayedCriticalThreshold: number;
  readonly failureRateWarningPercent: number;
  readonly failureRateCriticalPercent: number;
  readonly failureRateMinSample: number;
}

export interface QueueHistoricalMetrics {
  readonly completed: number;
  readonly failed: number;
  readonly sampleSize: number;
  readonly failureRatePercent: number | null;
  readonly sufficientSample: boolean;
}

export interface QueueOperationalMetrics {
  readonly name: QueueName;
  readonly waiting: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
  readonly delayed: number;
  readonly paused: number;
  readonly prioritized: number;
  readonly waitingChildren: number;
  readonly workersCount: number;
  readonly queuePaused: boolean;
  readonly backlog: number;
  readonly historical: QueueHistoricalMetrics;
}

export interface QueueOperationalHealthSignal {
  readonly queueName: QueueName;
  readonly code: QueueOperationalSignalCode;
  readonly level: QueueOperationalSignalLevel;
  readonly actual: number;
  readonly threshold: number;
  readonly message: string;
}

export interface QueueOperationalQueueHealth {
  readonly level: QueueOperationalHealthLevel;
  readonly ready: boolean;
  readonly degraded: boolean;
  readonly critical: boolean;
  readonly signals: readonly QueueOperationalHealthSignal[];
  readonly workersCountEnforced: false;
  readonly workersCountPolicy: 'INFORMATIONAL_ONLY';
}

export interface QueueMetricsAggregate {
  readonly version: typeof QUEUE_METRICS_AGGREGATION_VERSION;
  readonly queueCount: number;
  readonly waiting: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
  readonly delayed: number;
  readonly paused: number;
  readonly prioritized: number;
  readonly waitingChildren: number;
  readonly backlog: number;
  readonly workersCount: number;
  readonly pausedQueues: number;
  readonly historical: QueueHistoricalMetrics;
}

export interface QueueOperationalHealthSummary {
  readonly version: typeof QUEUE_OPERATIONAL_HEALTH_VERSION;
  readonly level: QueueOperationalHealthLevel;
  readonly ready: boolean;
  readonly degraded: boolean;
  readonly critical: boolean;
  readonly thresholds: QueueOperationalHealthThresholds;
  readonly queueLevels: Readonly<Record<QueueOperationalHealthLevel, number>>;
  readonly affectedQueues: readonly QueueName[];
  readonly signals: readonly QueueOperationalHealthSignal[];
  readonly workersCountEnforced: false;
  readonly workersCountPolicy: 'INFORMATIONAL_ONLY';
}

export interface QueueConfig {
  readonly enabled: boolean;
  readonly redisRequired: boolean;
  readonly prefix: string;
  readonly defaultAttempts: number;
  readonly defaultBackoffDelayMs: number;
  readonly defaultTimeoutMs: number;
  readonly removeOnCompleteCount: number;
  readonly removeOnFailCount: number;
  readonly workerConcurrency: number;
  readonly stalledIntervalMs: number;
  readonly maxStalledCount: number;
  readonly operationalHealth: QueueOperationalHealthThresholds;
}

export interface QueueRedisConnectionConfig {
  readonly url?: string;
  readonly host: string;
  readonly port: number;
  readonly db: number;
  readonly password?: string;
  readonly tls: boolean;
  readonly connectTimeoutMs: number;
  readonly maxRetriesPerRequest: number;
}

export type QueueExecutionCancellationStatus =
  'REQUESTED' | 'CANCELLED' | 'SUPERSEDED';

export type QueueExecutionCancellationOutcome =
  | 'CANCELLED_BEFORE_START'
  | 'CANCELLED_DURING_EXECUTION'
  | 'COMPLETED_BEFORE_CANCELLATION'
  | 'FAILED_BEFORE_CANCELLATION';

export interface QueueExecutionCancellation {
  readonly version: typeof QUEUE_EXECUTION_CANCELLATION_VERSION;
  readonly status: QueueExecutionCancellationStatus;
  readonly queueName: 'ai';
  readonly jobId: string;
  readonly cancellationId: string;
  readonly requestedAt: string;
  readonly requestedBy: string;
  readonly reason: string;
  readonly source: 'admin.queue.ai-execution-cancellation';
  readonly stateAtRequest: string;
  readonly activeSignalDispatched: boolean;
  readonly executionId?: string;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly completedAt?: string;
  readonly outcome?: QueueExecutionCancellationOutcome;
}

export interface QueueJobMetadata {
  readonly actorId?: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly source?: string;
  readonly locale?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly executionId?: string;
  readonly parentExecutionId?: string;
  readonly executionContextVersion?: string;
  readonly queueEnvelopeVersion?: string;
  readonly idempotencyKey?: string;
  readonly producer?: string;
  readonly agentId?: string;
  readonly agentVersion?: string;
  readonly agentTaskType?: string;
  readonly agentExecutionMode?: string;
  readonly agentCapabilities?: readonly string[];
  readonly agentSupportsHumanHandoff?: boolean;
  readonly agentModelRequirements?: QueuePayload;
  readonly cancellation?: QueueExecutionCancellation;
  readonly createdAt: string;
}

export interface BaseQueueJobData {
  readonly metadata: QueueJobMetadata;
}

export interface NotificationQueueJobData extends BaseQueueJobData {
  readonly notificationId?: string | null;
  readonly channel?: string | null;
  readonly userId?: string | null;
  readonly title: string;
  readonly message: string;
  readonly type: string;
  readonly payload?: QueuePayload;
}

export interface EmailQueueJobData extends BaseQueueJobData {
  readonly to: string;
  readonly subject: string;
  readonly template: string;
  readonly payload: QueuePayload;
}

export interface SmsQueueJobData extends BaseQueueJobData {
  readonly to: string;
  readonly template: string;
  readonly payload: QueuePayload;
}

export interface InvoiceQueueJobData extends BaseQueueJobData {
  readonly orderId: string;
  readonly invoiceId?: string | null;
  readonly regenerate: boolean;
}

export interface OrderQueueJobData extends BaseQueueJobData {
  readonly orderId: string;
  readonly event: string;
  readonly payload?: QueuePayload;
}

export interface AiQueueJobData extends BaseQueueJobData {
  readonly envelope?: QueueExecutionEnvelope;
  readonly task: string;
  readonly prompt?: string | null;
  readonly payload?: QueuePayload;
}

export interface MediaCleanupQueueJobData extends BaseQueueJobData {
  readonly olderThanMinutes: number;
  readonly dryRun: boolean;
}

export interface MediaImageOptimizationQueueJobData extends BaseQueueJobData {
  readonly mediaId: string;
  readonly sourcePath: string;
  readonly outputPath?: string | null;
  readonly payload?: QueuePayload;
}

export interface MediaThumbnailQueueJobData extends BaseQueueJobData {
  readonly mediaId: string;
  readonly sourcePath: string;
  readonly outputPath?: string | null;
  readonly width?: number;
  readonly height?: number;
  readonly payload?: QueuePayload;
}

export interface AnalyticsQueueJobData extends BaseQueueJobData {
  readonly event: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly payload?: QueuePayload;
}

export interface DeadLetterQueueJobData extends BaseQueueJobData {
  readonly originalQueue: QueueName;
  readonly originalJobName: string;
  readonly originalJobId?: string;
  readonly failureReason: string;
  readonly failedAt: string;
  readonly attemptsMade: number;
  readonly failure?: QueueFailureClassification;
  readonly retryDecision?: QueueRetryDecision;
  readonly envelope?: QueueExecutionEnvelope;
  readonly data: QueuePayload;
}

export type VexoQueueJobData =
  | NotificationQueueJobData
  | EmailQueueJobData
  | SmsQueueJobData
  | InvoiceQueueJobData
  | OrderQueueJobData
  | AiQueueJobData
  | MediaCleanupQueueJobData
  | MediaImageOptimizationQueueJobData
  | MediaThumbnailQueueJobData
  | AnalyticsQueueJobData
  | DeadLetterQueueJobData;

export interface QueueJobResult {
  readonly success: boolean;
  readonly message: string;
  readonly processedAt: string;
  readonly details?: QueuePayload;
}

export interface EnqueueJobOptions {
  readonly jobId?: string;
  readonly delayMs?: number;
  readonly priority?: number;
  readonly attempts?: number;
  readonly backoffType?: QueueBackoffType;
  readonly backoffDelayMs?: number;
  readonly timeoutMs?: number;
  readonly removeOnCompleteCount?: number;
  readonly removeOnFailCount?: number;
}

export interface EnqueueJobInput<TData extends VexoQueueJobData> {
  readonly queueName: QueueName;
  readonly jobName: QueueJobName;
  readonly data: TData;
  readonly options?: EnqueueJobOptions;
}

export interface EnqueuedJobResult {
  readonly queueName: QueueName;
  readonly jobName: QueueJobName;
  readonly jobId: string;
  readonly createdAt: string;
}

export interface QueueFailureInput {
  readonly queueName: QueueName;
  readonly jobName: string;
  readonly jobId?: string;
  readonly attemptsMade: number;
  readonly failureReason: string;
  readonly failure: QueueFailureClassification;
  readonly retryDecision: QueueRetryDecision;
  readonly envelope?: QueueExecutionEnvelope;
  readonly data: QueuePayload;
}
