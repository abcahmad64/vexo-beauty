export enum PaymentEventType {
  CREATED = 'payment.created',
  UPDATED = 'payment.updated',
  COMPLETED = 'payment.completed',
  FAILED = 'payment.failed',
  REFUNDED = 'payment.refunded',
  STATUS_CHANGED = 'payment.status_changed',
  DELETED = 'payment.deleted',
  ORDER_PAYMENT_SYNCED = 'payment.order_payment_synced',
}
