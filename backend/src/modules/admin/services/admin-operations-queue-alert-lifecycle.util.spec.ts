import type { QueueOperationalHealthSignal } from '../../../core/queue/types/queue.types';

import { NotificationDeliveryChannel } from '../../notification/delivery/notification-delivery.channel';

import {
  ADMIN_OPERATIONS_QUEUE_ALERT_SOURCE,
  AdminOperationsQueueAlertLifecycleUtil,
} from './admin-operations-queue-alert-lifecycle.util';

const WARNING_SIGNAL: QueueOperationalHealthSignal = {
  queueName: 'ai',
  code: 'BACKLOG',
  level: 'WARNING',
  actual: 25,
  threshold: 25,
  message: 'backlog warning',
};

const CRITICAL_SIGNAL: QueueOperationalHealthSignal = {
  ...WARNING_SIGNAL,
  level: 'CRITICAL',
  actual: 100,
  threshold: 100,
};

describe('AdminOperationsQueueAlertLifecycleUtil', () => {
  it('creates a deterministic lifecycle and delivery identity', () => {
    const lifecycleKey =
      AdminOperationsQueueAlertLifecycleUtil.buildLifecycleKey(WARNING_SIGNAL);
    const lockKey = AdminOperationsQueueAlertLifecycleUtil.buildLockKey(
      'admin-1',
      lifecycleKey,
    );
    const aggregateId =
      AdminOperationsQueueAlertLifecycleUtil.buildOutboxAggregateId({
        notificationId: 'notification-1',
        deliveryVersion: 2,
        channel: NotificationDeliveryChannel.PUSH,
      });

    expect(lifecycleKey).toBe('queue-health:ai:BACKLOG');
    expect(lockKey).toBe(
      `${ADMIN_OPERATIONS_QUEUE_ALERT_SOURCE}:admin-1:queue-health:ai:BACKLOG`,
    );
    expect(aggregateId).toBe(
      'admin-queue-alert-delivery:notification-1:2:push',
    );
    expect(
      AdminOperationsQueueAlertLifecycleUtil.buildDeliveryJobId('outbox-1'),
    ).toBe('notification-delivery-outbox-1');
  });

  it('creates, observes, escalates, recovers and reactivates one lifecycle', () => {
    const activated = AdminOperationsQueueAlertLifecycleUtil.decideSignal(
      null,
      WARNING_SIGNAL,
    );

    expect(activated).toMatchObject({
      transition: 'ACTIVATED',
      status: 'ACTIVE',
      cycle: 1,
      transitionVersion: 1,
      deliveryVersion: 1,
      deliveryRequired: true,
      reopenAcknowledgement: true,
    });

    const observed = AdminOperationsQueueAlertLifecycleUtil.decideSignal(
      {
        status: 'ACTIVE',
        level: 'WARNING',
        cycle: 1,
        transitionVersion: 1,
        deliveryVersion: 1,
        observationCount: 1,
      },
      WARNING_SIGNAL,
    );

    expect(observed).toMatchObject({
      transition: 'OBSERVED',
      deliveryRequired: false,
      transitionVersion: 1,
      deliveryVersion: 1,
      observationCount: 2,
    });

    const escalated = AdminOperationsQueueAlertLifecycleUtil.decideSignal(
      {
        status: 'ACTIVE',
        level: 'WARNING',
        cycle: 1,
        transitionVersion: 1,
        deliveryVersion: 1,
        observationCount: 2,
        acknowledgedBy: 'admin-1',
        acknowledgedAt: '2026-07-23T00:00:00.000Z',
      },
      CRITICAL_SIGNAL,
    );

    expect(escalated).toMatchObject({
      transition: 'ESCALATED',
      severity: 'critical',
      transitionVersion: 2,
      deliveryVersion: 2,
      deliveryRequired: true,
      reopenAcknowledgement: true,
    });

    const recovered = AdminOperationsQueueAlertLifecycleUtil.decideRecovery({
      status: 'ACTIVE',
      level: 'CRITICAL',
      cycle: 1,
      transitionVersion: 2,
      deliveryVersion: 2,
      observationCount: 3,
    });

    expect(recovered).toMatchObject({
      transition: 'RECOVERED',
      status: 'RECOVERED',
      severity: 'info',
      transitionVersion: 3,
      deliveryVersion: 3,
      deliveryRequired: true,
    });

    const reactivated = AdminOperationsQueueAlertLifecycleUtil.decideSignal(
      {
        status: 'RECOVERED',
        level: null,
        cycle: 1,
        transitionVersion: 3,
        deliveryVersion: 3,
        observationCount: 3,
      },
      WARNING_SIGNAL,
    );

    expect(reactivated).toMatchObject({
      transition: 'REACTIVATED',
      status: 'ACTIVE',
      cycle: 2,
      transitionVersion: 4,
      deliveryVersion: 4,
      reopenAcknowledgement: true,
    });
  });

  it('preserves the previous acknowledgement when escalation reopens an alert', () => {
    const decision = AdminOperationsQueueAlertLifecycleUtil.decideSignal(
      {
        status: 'ACTIVE',
        level: 'WARNING',
        cycle: 1,
        transitionVersion: 1,
        deliveryVersion: 1,
        observationCount: 1,
        acknowledgedBy: 'admin-1',
        acknowledgedAt: '2026-07-23T00:00:00.000Z',
      },
      CRITICAL_SIGNAL,
    );
    const metadata = AdminOperationsQueueAlertLifecycleUtil.buildMetadata({
      existingMetadata: {
        acknowledgedBy: 'admin-1',
        acknowledgedAt: '2026-07-23T00:00:00.000Z',
      },
      lifecycleKey: 'queue-health:ai:BACKLOG',
      signal: CRITICAL_SIGNAL,
      decision,
      observedAt: '2026-07-23T01:00:00.000Z',
      actorId: 'system:test',
    });

    expect(metadata).not.toHaveProperty('acknowledgedBy');
    expect(metadata).not.toHaveProperty('acknowledgedAt');
    expect(metadata).toHaveProperty('previousAcknowledgement', {
      acknowledgedBy: 'admin-1',
      acknowledgedAt: '2026-07-23T00:00:00.000Z',
    });
    expect(metadata).toMatchObject({
      lifecycleStatus: 'ACTIVE',
      transition: 'ESCALATED',
      healthLevel: 'critical',
      acknowledgementPolicy: 'REOPEN_ON_ESCALATION_OR_REACTIVATION',
    });
  });

  it('documents a migration-free Notification metadata lifecycle', () => {
    expect(AdminOperationsQueueAlertLifecycleUtil.getSnapshot()).toEqual({
      version: '1.0.0',
      source: 'admin.operations_queue_health',
      persistence: 'NOTIFICATION_METADATA',
      concurrencyControl: 'POSTGRES_ADVISORY_XACT_LOCK',
      deliveryOutbox: 'EVENT_OUTBOX',
      acknowledgementStorage: 'NOTIFICATION_READ_STATE_AND_METADATA',
      recoveryMode: 'IN_PLACE_LIFECYCLE_TRANSITION',
      databaseMigrationRequired: false,
      defaultExternalChannels: [],
    });
  });
});
