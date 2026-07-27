export enum InventoryEventType {
  WAREHOUSE_CREATED = 'inventory.warehouse_created',
  WAREHOUSE_UPDATED = 'inventory.warehouse_updated',
  INVENTORY_CREATED = 'inventory.created',
  INVENTORY_UPDATED = 'inventory.updated',
  STOCK_ADJUSTED = 'inventory.stock_adjusted',
  STOCK_RESERVED = 'inventory.stock_reserved',
  STOCK_RELEASED = 'inventory.stock_released',
  RESERVED_STOCK_COMMITTED = 'inventory.reserved_stock_committed',
  LOW_STOCK_DETECTED = 'inventory.low_stock_detected',
  OUT_OF_STOCK_DETECTED = 'inventory.out_of_stock_detected',
}
