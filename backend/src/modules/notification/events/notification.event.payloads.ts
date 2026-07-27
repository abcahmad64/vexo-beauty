export type NotificationMetadata = Record<string, unknown>;

export interface NotificationBaseEventPayload {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  metadata?: NotificationMetadata | null;
  actorId?: string;
  occurredAt: Date;
}

export interface NotificationCreatedEventPayload extends NotificationBaseEventPayload {
  isRead: boolean;
}

export interface NotificationSentEventPayload extends NotificationBaseEventPayload {
  channel: 'database' | 'email' | 'sms' | 'push' | 'websocket';
}

export interface NotificationReadEventPayload {
  notificationId: string;
  userId: string;
  readAt: Date;
  actorId?: string;
  occurredAt: Date;
}

export interface NotificationAllReadEventPayload {
  userId: string;
  count: number;
  actorId?: string;
  occurredAt: Date;
}

export interface NotificationDeletedEventPayload {
  notificationId: string;
  userId: string;
  actorId?: string;
  occurredAt: Date;
}

export interface OrderNotificationCreatedEventPayload extends NotificationBaseEventPayload {
  orderId: string;
  orderNumber?: string | null;
}

export interface PaymentNotificationCreatedEventPayload extends NotificationBaseEventPayload {
  paymentId: string;
  orderId?: string | null;
  transactionId?: string | null;
}

export interface ShipmentNotificationCreatedEventPayload extends NotificationBaseEventPayload {
  orderId: string;
  orderNumber?: string | null;
  trackingNumber?: string | null;
}

export interface RefundNotificationCreatedEventPayload extends NotificationBaseEventPayload {
  refundId: string;
  paymentId?: string | null;
  orderId?: string | null;
}

export interface SystemNotificationCreatedEventPayload extends NotificationBaseEventPayload {
  severity?: 'info' | 'success' | 'warning' | 'error';
}
