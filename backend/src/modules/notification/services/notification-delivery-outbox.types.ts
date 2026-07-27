import { NotificationDeliveryChannel } from '../delivery/notification-delivery.channel';

export const NOTIFICATION_DELIVERY_OUTBOX_VERSION = '1.0.0';
export const NOTIFICATION_DELIVERY_OUTBOX_TYPE =
  'notification.delivery.requested';

export interface NotificationDeliveryOutboxPayload {
  readonly version: typeof NOTIFICATION_DELIVERY_OUTBOX_VERSION;
  readonly notificationId: string;
  readonly userId: string;
  readonly title: string;
  readonly message: string;
  readonly type: string;
  readonly channel: NotificationDeliveryChannel;
  readonly actionUrl?: string | null;
  readonly metadata?: Record<string, unknown> | null;
  readonly actorId?: string;
  readonly requestedAt: string;
  readonly lifecycleKey?: string;
  readonly deliveryVersion?: number;
  readonly transition?: string;
}

export interface NotificationDeliveryOutboxSnapshot {
  readonly version: typeof NOTIFICATION_DELIVERY_OUTBOX_VERSION;
  readonly outboxType: typeof NOTIFICATION_DELIVERY_OUTBOX_TYPE;
  readonly deterministicJobId: true;
  readonly queueAttempts: 5;
  readonly queueBackoff: 'EXPONENTIAL';
  readonly marksProcessedOnlyAfterDelivery: true;
  readonly marksFailedOnlyAfterTerminalFailure: true;
  readonly payloadValidation: true;
}
