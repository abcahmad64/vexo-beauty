import { QUEUE_JOB_NAMES } from '../../../core/queue/constants/queue.constants';

import { ADMIN_OPERATIONS_ALERT_SOURCES } from '../dto/admin-operations-alert-query.dto';

import {
  NOTIFICATION_DELIVERY_OUTBOX_TYPE,
  NOTIFICATION_DELIVERY_OUTBOX_VERSION,
} from '../../notification/services/notification-delivery-outbox.types';

import {
  ADMIN_OPERATIONS_QUEUE_ALERT_SOURCE,
  AdminOperationsQueueAlertLifecycleUtil,
} from './admin-operations-queue-alert-lifecycle.util';

describe('Admin operations queue alert lifecycle contract', () => {
  it('extends the existing alert inbox and reliable notification queue', () => {
    expect(ADMIN_OPERATIONS_ALERT_SOURCES).toContain('operations_queue_health');
    expect(ADMIN_OPERATIONS_QUEUE_ALERT_SOURCE).toBe(
      'admin.operations_queue_health',
    );
    expect(NOTIFICATION_DELIVERY_OUTBOX_VERSION).toBe('1.0.0');
    expect(NOTIFICATION_DELIVERY_OUTBOX_TYPE).toBe(
      'notification.delivery.requested',
    );
    expect(QUEUE_JOB_NAMES.NOTIFICATION_DELIVERY).toBe('notification.delivery');
  });

  it('uses existing Notification and EventOutbox persistence without migration', () => {
    expect(AdminOperationsQueueAlertLifecycleUtil.getSnapshot()).toMatchObject({
      version: '1.0.0',
      persistence: 'NOTIFICATION_METADATA',
      concurrencyControl: 'POSTGRES_ADVISORY_XACT_LOCK',
      deliveryOutbox: 'EVENT_OUTBOX',
      acknowledgementStorage: 'NOTIFICATION_READ_STATE_AND_METADATA',
      recoveryMode: 'IN_PLACE_LIFECYCLE_TRANSITION',
      databaseMigrationRequired: false,
    });
  });
});
