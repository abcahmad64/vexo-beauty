import type {
  QueueOperationalHealthSignal,
  QueueOperationalSignalLevel,
} from '../../../core/queue/types/queue.types';

import { NotificationDeliveryChannel } from '../../notification/delivery/notification-delivery.channel';

import { NOTIFICATION_DELIVERY_OUTBOX_TYPE } from '../../notification/services/notification-delivery-outbox.types';

export const ADMIN_OPERATIONS_QUEUE_ALERT_LIFECYCLE_VERSION = '1.0.0';
export const ADMIN_OPERATIONS_QUEUE_ALERT_SOURCE =
  'admin.operations_queue_health';
export const ADMIN_OPERATIONS_QUEUE_ALERT_OUTBOX_TYPE =
  NOTIFICATION_DELIVERY_OUTBOX_TYPE;
export const ADMIN_OPERATIONS_QUEUE_ALERT_ACTION_URL = '/admin/queues';

export type AdminOperationsQueueAlertLifecycleStatus = 'ACTIVE' | 'RECOVERED';

export type AdminOperationsQueueAlertTransition =
  | 'ACTIVATED'
  | 'OBSERVED'
  | 'ESCALATED'
  | 'DEESCALATED'
  | 'REACTIVATED'
  | 'RECOVERED'
  | 'UNCHANGED';

export type AdminOperationsQueueAlertSeverity =
  'info' | 'warning' | 'error' | 'critical';

export interface AdminOperationsQueueAlertExistingState {
  readonly status: AdminOperationsQueueAlertLifecycleStatus;
  readonly level: QueueOperationalSignalLevel | null;
  readonly cycle: number;
  readonly transitionVersion: number;
  readonly deliveryVersion: number;
  readonly observationCount: number;
  readonly acknowledgedBy?: string;
  readonly acknowledgedAt?: string;
}

export interface AdminOperationsQueueAlertTransitionDecision {
  readonly transition: AdminOperationsQueueAlertTransition;
  readonly status: AdminOperationsQueueAlertLifecycleStatus;
  readonly level: QueueOperationalSignalLevel | null;
  readonly severity: AdminOperationsQueueAlertSeverity;
  readonly cycle: number;
  readonly transitionVersion: number;
  readonly deliveryVersion: number;
  readonly observationCount: number;
  readonly deliveryRequired: boolean;
  readonly reopenAcknowledgement: boolean;
}

export interface AdminOperationsQueueAlertMetadataInput {
  readonly existingMetadata?: Record<string, unknown>;
  readonly lifecycleKey: string;
  readonly signal: QueueOperationalHealthSignal | null;
  readonly decision: AdminOperationsQueueAlertTransitionDecision;
  readonly observedAt: string;
  readonly actorId: string;
}

export interface AdminOperationsQueueAlertLifecycleSnapshot {
  readonly version: typeof ADMIN_OPERATIONS_QUEUE_ALERT_LIFECYCLE_VERSION;
  readonly source: typeof ADMIN_OPERATIONS_QUEUE_ALERT_SOURCE;
  readonly persistence: 'NOTIFICATION_METADATA';
  readonly concurrencyControl: 'POSTGRES_ADVISORY_XACT_LOCK';
  readonly deliveryOutbox: 'EVENT_OUTBOX';
  readonly acknowledgementStorage: 'NOTIFICATION_READ_STATE_AND_METADATA';
  readonly recoveryMode: 'IN_PLACE_LIFECYCLE_TRANSITION';
  readonly databaseMigrationRequired: false;
  readonly defaultExternalChannels: readonly NotificationDeliveryChannel[];
}

export class AdminOperationsQueueAlertLifecycleUtil {
  static buildLifecycleKey(signal: QueueOperationalHealthSignal): string {
    return `queue-health:${signal.queueName}:${signal.code}`;
  }

  static buildLockKey(userId: string, lifecycleKey: string): string {
    return `${ADMIN_OPERATIONS_QUEUE_ALERT_SOURCE}:${userId}:${lifecycleKey}`;
  }

  static buildDeliveryJobId(outboxId: string): string {
    return `notification-delivery-${outboxId}`;
  }

  static buildOutboxAggregateId(input: {
    readonly notificationId: string;
    readonly deliveryVersion: number;
    readonly channel: NotificationDeliveryChannel;
  }): string {
    return [
      'admin-queue-alert-delivery',
      input.notificationId,
      input.deliveryVersion,
      input.channel,
    ].join(':');
  }

  static decideSignal(
    existing: AdminOperationsQueueAlertExistingState | null,
    signal: QueueOperationalHealthSignal,
  ): AdminOperationsQueueAlertTransitionDecision {
    if (!existing) {
      return this.createDecision({
        transition: 'ACTIVATED',
        status: 'ACTIVE',
        level: signal.level,
        severity: this.resolveSeverity(signal.level),
        cycle: 1,
        transitionVersion: 1,
        deliveryVersion: 1,
        observationCount: 1,
        deliveryRequired: true,
        reopenAcknowledgement: true,
      });
    }

    if (existing.status === 'RECOVERED') {
      return this.createDecision({
        transition: 'REACTIVATED',
        status: 'ACTIVE',
        level: signal.level,
        severity: this.resolveSeverity(signal.level),
        cycle: existing.cycle + 1,
        transitionVersion: existing.transitionVersion + 1,
        deliveryVersion: existing.deliveryVersion + 1,
        observationCount: existing.observationCount + 1,
        deliveryRequired: true,
        reopenAcknowledgement: true,
      });
    }

    if (existing.level === signal.level) {
      return this.createDecision({
        transition: 'OBSERVED',
        status: 'ACTIVE',
        level: signal.level,
        severity: this.resolveSeverity(signal.level),
        cycle: existing.cycle,
        transitionVersion: existing.transitionVersion,
        deliveryVersion: existing.deliveryVersion,
        observationCount: existing.observationCount + 1,
        deliveryRequired: false,
        reopenAcknowledgement: false,
      });
    }

    const escalation =
      this.levelWeight(signal.level) > this.levelWeight(existing.level);

    return this.createDecision({
      transition: escalation ? 'ESCALATED' : 'DEESCALATED',
      status: 'ACTIVE',
      level: signal.level,
      severity: this.resolveSeverity(signal.level),
      cycle: existing.cycle,
      transitionVersion: existing.transitionVersion + 1,
      deliveryVersion: existing.deliveryVersion + 1,
      observationCount: existing.observationCount + 1,
      deliveryRequired: true,
      reopenAcknowledgement: escalation,
    });
  }

  static decideRecovery(
    existing: AdminOperationsQueueAlertExistingState,
  ): AdminOperationsQueueAlertTransitionDecision {
    if (existing.status === 'RECOVERED') {
      return this.createDecision({
        transition: 'UNCHANGED',
        status: 'RECOVERED',
        level: null,
        severity: 'info',
        cycle: existing.cycle,
        transitionVersion: existing.transitionVersion,
        deliveryVersion: existing.deliveryVersion,
        observationCount: existing.observationCount,
        deliveryRequired: false,
        reopenAcknowledgement: false,
      });
    }

    return this.createDecision({
      transition: 'RECOVERED',
      status: 'RECOVERED',
      level: null,
      severity: 'info',
      cycle: existing.cycle,
      transitionVersion: existing.transitionVersion + 1,
      deliveryVersion: existing.deliveryVersion + 1,
      observationCount: existing.observationCount,
      deliveryRequired: true,
      reopenAcknowledgement: false,
    });
  }

  static buildTitle(input: {
    readonly signal: QueueOperationalHealthSignal | null;
    readonly transition: AdminOperationsQueueAlertTransition;
  }): string {
    if (input.transition === 'RECOVERED') {
      return `بازیابی سلامت صف ${input.signal?.queueName ?? ''}`.trim();
    }

    const queueName = input.signal?.queueName ?? 'نامشخص';
    const level = input.signal?.level ?? 'WARNING';

    if (level === 'CRITICAL') {
      return `هشدار بحرانی صف ${queueName}`;
    }

    if (level === 'DEGRADED') {
      return `افت سلامت صف ${queueName}`;
    }

    return `هشدار سلامت صف ${queueName}`;
  }

  static buildMessage(input: {
    readonly signal: QueueOperationalHealthSignal | null;
    readonly transition: AdminOperationsQueueAlertTransition;
  }): string {
    if (input.transition === 'RECOVERED') {
      const queueName = input.signal?.queueName ?? 'مربوطه';

      return [
        `وضعیت عملیاتی صف ${queueName} به حالت سالم بازگشته است.`,
        'چرخه هشدار قبلی بسته شد و تاریخ بازیابی ثبت گردید.',
      ].join('\n');
    }

    if (!input.signal) {
      return 'سیگنال سلامت صف ثبت شد.';
    }

    return [
      input.signal.message,
      `صف: ${input.signal.queueName}`,
      `سیگنال: ${input.signal.code}`,
      `سطح: ${input.signal.level}`,
      `مقدار فعلی: ${input.signal.actual}`,
      `آستانه: ${input.signal.threshold}`,
    ].join('\n');
  }

  static buildMetadata(
    input: AdminOperationsQueueAlertMetadataInput,
  ): Record<string, unknown> {
    const existing = { ...(input.existingMetadata ?? {}) };
    const previousAcknowledgement = this.resolvePreviousAcknowledgement(
      existing,
      input.decision.reopenAcknowledgement,
    );

    if (input.decision.reopenAcknowledgement) {
      delete existing.acknowledgedBy;
      delete existing.acknowledgedAt;
    }

    const signal = input.signal;
    const firstObservedAt = this.readString(existing.firstObservedAt);
    const activatedAt =
      input.decision.transition === 'ACTIVATED' ||
      input.decision.transition === 'REACTIVATED'
        ? input.observedAt
        : (this.readString(existing.activatedAt) ?? input.observedAt);

    return {
      ...existing,
      source: ADMIN_OPERATIONS_QUEUE_ALERT_SOURCE,
      lifecycleVersion: ADMIN_OPERATIONS_QUEUE_ALERT_LIFECYCLE_VERSION,
      lifecycleKey: input.lifecycleKey,
      lifecycleStatus: input.decision.status,
      transition: input.decision.transition,
      transitionVersion: input.decision.transitionVersion,
      deliveryVersion: input.decision.deliveryVersion,
      cycle: input.decision.cycle,
      observationCount: input.decision.observationCount,
      severity: input.decision.severity,
      healthLevel: input.decision.level?.toLowerCase() ?? 'healthy',
      queueName: signal?.queueName ?? this.readString(existing.queueName),
      signalCode: signal?.code ?? this.readString(existing.signalCode),
      actual: signal?.actual ?? this.readNumber(existing.actual),
      threshold: signal?.threshold ?? this.readNumber(existing.threshold),
      signalMessage: signal?.message ?? this.readString(existing.signalMessage),
      firstObservedAt: firstObservedAt ?? input.observedAt,
      lastObservedAt: input.observedAt,
      activatedAt,
      recoveredAt:
        input.decision.status === 'RECOVERED' ? input.observedAt : null,
      lastTransitionAt:
        input.decision.transition === 'OBSERVED' ||
        input.decision.transition === 'UNCHANGED'
          ? (this.readString(existing.lastTransitionAt) ?? input.observedAt)
          : input.observedAt,
      requestedBy: input.actorId,
      acknowledgementPolicy: 'REOPEN_ON_ESCALATION_OR_REACTIVATION',
      ...(previousAcknowledgement
        ? {
            previousAcknowledgement,
          }
        : {}),
    };
  }

  static readExistingState(
    metadata: Record<string, unknown>,
    isRead: boolean,
  ): AdminOperationsQueueAlertExistingState {
    const status =
      metadata.lifecycleStatus === 'RECOVERED' ? 'RECOVERED' : 'ACTIVE';
    const rawLevel = this.readString(metadata.healthLevel)?.toUpperCase();
    const level = this.isSignalLevel(rawLevel) ? rawLevel : null;

    return {
      status,
      level,
      cycle: this.readPositiveInteger(metadata.cycle, 1),
      transitionVersion: this.readPositiveInteger(
        metadata.transitionVersion,
        1,
      ),
      deliveryVersion: this.readNonNegativeInteger(metadata.deliveryVersion, 0),
      observationCount: this.readPositiveInteger(metadata.observationCount, 1),
      ...(isRead && this.readString(metadata.acknowledgedBy)
        ? {
            acknowledgedBy: this.readString(metadata.acknowledgedBy),
          }
        : {}),
      ...(isRead && this.readString(metadata.acknowledgedAt)
        ? {
            acknowledgedAt: this.readString(metadata.acknowledgedAt),
          }
        : {}),
    };
  }

  static getSnapshot(): AdminOperationsQueueAlertLifecycleSnapshot {
    return {
      version: ADMIN_OPERATIONS_QUEUE_ALERT_LIFECYCLE_VERSION,
      source: ADMIN_OPERATIONS_QUEUE_ALERT_SOURCE,
      persistence: 'NOTIFICATION_METADATA',
      concurrencyControl: 'POSTGRES_ADVISORY_XACT_LOCK',
      deliveryOutbox: 'EVENT_OUTBOX',
      acknowledgementStorage: 'NOTIFICATION_READ_STATE_AND_METADATA',
      recoveryMode: 'IN_PLACE_LIFECYCLE_TRANSITION',
      databaseMigrationRequired: false,
      defaultExternalChannels: [],
    };
  }

  private static createDecision(
    decision: AdminOperationsQueueAlertTransitionDecision,
  ): AdminOperationsQueueAlertTransitionDecision {
    return decision;
  }

  private static resolveSeverity(
    level: QueueOperationalSignalLevel,
  ): AdminOperationsQueueAlertSeverity {
    if (level === 'CRITICAL') {
      return 'critical';
    }

    if (level === 'DEGRADED') {
      return 'error';
    }

    return 'warning';
  }

  private static levelWeight(
    level: QueueOperationalSignalLevel | null,
  ): number {
    if (level === 'CRITICAL') {
      return 3;
    }

    if (level === 'DEGRADED') {
      return 2;
    }

    if (level === 'WARNING') {
      return 1;
    }

    return 0;
  }

  private static resolvePreviousAcknowledgement(
    metadata: Record<string, unknown>,
    reopen: boolean,
  ): Record<string, string> | null {
    if (!reopen) {
      const existing = metadata.previousAcknowledgement;

      if (
        existing &&
        typeof existing === 'object' &&
        !Array.isArray(existing)
      ) {
        return existing as Record<string, string>;
      }

      return null;
    }

    const acknowledgedBy = this.readString(metadata.acknowledgedBy);
    const acknowledgedAt = this.readString(metadata.acknowledgedAt);

    if (!acknowledgedBy || !acknowledgedAt) {
      return null;
    }

    return {
      acknowledgedBy,
      acknowledgedAt,
    };
  }

  private static isSignalLevel(
    value: string | undefined,
  ): value is QueueOperationalSignalLevel {
    return value === 'WARNING' || value === 'DEGRADED' || value === 'CRITICAL';
  }

  private static readString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized : undefined;
  }

  private static readNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private static readPositiveInteger(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0
      ? value
      : fallback;
  }

  private static readNonNegativeInteger(
    value: unknown,
    fallback: number,
  ): number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0
      ? value
      : fallback;
  }
}
