export enum OrderEventType {
  CREATED = 'order.created',
  UPDATED = 'order.updated',
  STATUS_CHANGED = 'order.status_changed',
  CANCELLED = 'order.cancelled',
  DELETED = 'order.deleted',
  STOCK_RESERVED = 'order.stock_reserved',
  STOCK_RELEASED = 'order.stock_released',
  STOCK_COMMITTED = 'order.stock_committed',
}
