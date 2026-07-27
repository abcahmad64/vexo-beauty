import { NotificationDeliveryChannel } from './notification-delivery.channel';

export type NotificationDeliveryPayload = {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  channel: NotificationDeliveryChannel;
  metadata?: Record<string, unknown> | null;
  actorId?: string;
  occurredAt: Date;
};

export type NotificationDeliveryResult = {
  channel: NotificationDeliveryChannel;
  delivered: boolean;
  provider?: string;
  messageId?: string | null;
  error?: string | null;
};
