import { StockMovementType } from '../../../generated/prisma';

export interface InventoryBaseEventPayload {
  actorId?: string;
  occurredAt: Date;
}

export interface WarehouseCreatedEventPayload extends InventoryBaseEventPayload {
  warehouseId: string;
  code: string;
  name: string;
}

export interface WarehouseUpdatedEventPayload extends InventoryBaseEventPayload {
  warehouseId: string;
  changedFields: string[];
}

export interface InventoryCreatedEventPayload extends InventoryBaseEventPayload {
  inventoryId: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  reservedQuantity: number;
}

export interface InventoryUpdatedEventPayload extends InventoryBaseEventPayload {
  inventoryId: string;
  variantId: string;
  warehouseId: string;
  changedFields: string[];
}

export interface StockAdjustedEventPayload extends InventoryBaseEventPayload {
  inventoryId: string;
  variantId: string;
  warehouseId: string;
  movementId: string;
  type: StockMovementType;
  quantity: number;
  previousQuantity: number;
  currentQuantity: number;
  reference?: string | null;
}

export interface StockReservedEventPayload extends InventoryBaseEventPayload {
  inventoryId: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  previousReservedQuantity: number;
  currentReservedQuantity: number;
  reference?: string | null;
}

export interface StockReleasedEventPayload extends InventoryBaseEventPayload {
  inventoryId: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  previousReservedQuantity: number;
  currentReservedQuantity: number;
  reference?: string | null;
}

export interface ReservedStockCommittedEventPayload extends InventoryBaseEventPayload {
  inventoryId: string;
  variantId: string;
  warehouseId: string;
  movementId: string;
  quantity: number;
  previousQuantity: number;
  currentQuantity: number;
  previousReservedQuantity: number;
  currentReservedQuantity: number;
  reference?: string | null;
}

export interface InventoryLowStockDetectedEventPayload extends InventoryBaseEventPayload {
  inventoryId: string;
  variantId: string;
  warehouseId: string;
  availableQuantity: number;
  lowStockThreshold: number;
}

export interface InventoryOutOfStockDetectedEventPayload extends InventoryBaseEventPayload {
  inventoryId: string;
  variantId: string;
  warehouseId: string;
}
