export enum NotificationEventType {
  NOTIFICATION_CREATED = 'notification.created',
  NOTIFICATION_BULK_CREATED = 'notification.bulk_created',
  NOTIFICATION_UPDATED = 'notification.updated',
  NOTIFICATION_SENT = 'notification.sent',
  NOTIFICATION_READ = 'notification.read',
  NOTIFICATION_MANY_READ = 'notification.many_read',
  NOTIFICATION_ALL_READ = 'notification.all_read',
  NOTIFICATION_UNREAD = 'notification.unread',
  NOTIFICATION_DELETED = 'notification.deleted',

  ORDER_NOTIFICATION_CREATED = 'notification.order.created',
  PAYMENT_NOTIFICATION_CREATED = 'notification.payment.created',
  SHIPMENT_NOTIFICATION_CREATED = 'notification.shipment.created',
  REFUND_NOTIFICATION_CREATED = 'notification.refund.created',
  SYSTEM_NOTIFICATION_CREATED = 'notification.system.created',

  PROMOTION_NOTIFICATION_CREATED = 'notification.promotion.created',
  NEWSLETTER_NOTIFICATION_CREATED = 'notification.newsletter.created',
  CUSTOMER_SERVICE_NOTIFICATION_CREATED = 'notification.customer_service.created',
}
