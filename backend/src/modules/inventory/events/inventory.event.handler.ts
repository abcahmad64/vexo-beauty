import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { InventoryEventType } from './inventory.event.types';

import {
  InventoryCreatedEventPayload,
  InventoryLowStockDetectedEventPayload,
  InventoryOutOfStockDetectedEventPayload,
  InventoryUpdatedEventPayload,
  ReservedStockCommittedEventPayload,
  StockAdjustedEventPayload,
  StockReleasedEventPayload,
  StockReservedEventPayload,
  WarehouseCreatedEventPayload,
  WarehouseUpdatedEventPayload,
} from './inventory.event.payloads';

@Injectable()
export class InventoryEventHandler {
  private readonly logger = new Logger(InventoryEventHandler.name);

  @OnEvent(InventoryEventType.WAREHOUSE_CREATED)
  handleWarehouseCreated(payload: WarehouseCreatedEventPayload): void {
    this.logger.log(`Warehouse created: ${payload.code}; name=${payload.name}`);
  }

  @OnEvent(InventoryEventType.WAREHOUSE_UPDATED)
  handleWarehouseUpdated(payload: WarehouseUpdatedEventPayload): void {
    this.logger.log(
      `Warehouse updated: ${payload.warehouseId}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(InventoryEventType.INVENTORY_CREATED)
  handleInventoryCreated(payload: InventoryCreatedEventPayload): void {
    this.logger.log(
      `Inventory created: ${payload.inventoryId}; variant=${payload.variantId}; warehouse=${payload.warehouseId}`,
    );
  }

  @OnEvent(InventoryEventType.INVENTORY_UPDATED)
  handleInventoryUpdated(payload: InventoryUpdatedEventPayload): void {
    this.logger.log(
      `Inventory updated: ${payload.inventoryId}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(InventoryEventType.STOCK_ADJUSTED)
  handleStockAdjusted(payload: StockAdjustedEventPayload): void {
    this.logger.log(
      `Stock adjusted: ${payload.inventoryId}; type=${payload.type}; ${payload.previousQuantity} -> ${payload.currentQuantity}`,
    );
  }

  @OnEvent(InventoryEventType.STOCK_RESERVED)
  handleStockReserved(payload: StockReservedEventPayload): void {
    this.logger.log(
      `Stock reserved: ${payload.inventoryId}; quantity=${payload.quantity}`,
    );
  }

  @OnEvent(InventoryEventType.STOCK_RELEASED)
  handleStockReleased(payload: StockReleasedEventPayload): void {
    this.logger.log(
      `Stock released: ${payload.inventoryId}; quantity=${payload.quantity}`,
    );
  }

  @OnEvent(InventoryEventType.RESERVED_STOCK_COMMITTED)
  handleReservedStockCommitted(
    payload: ReservedStockCommittedEventPayload,
  ): void {
    this.logger.log(
      `Reserved stock committed: ${payload.inventoryId}; quantity=${payload.quantity}`,
    );
  }

  @OnEvent(InventoryEventType.LOW_STOCK_DETECTED)
  handleLowStockDetected(payload: InventoryLowStockDetectedEventPayload): void {
    this.logger.warn(
      `Low stock detected: inventory=${payload.inventoryId}; available=${payload.availableQuantity}; threshold=${payload.lowStockThreshold}`,
    );
  }

  @OnEvent(InventoryEventType.OUT_OF_STOCK_DETECTED)
  handleOutOfStockDetected(
    payload: InventoryOutOfStockDetectedEventPayload,
  ): void {
    this.logger.warn(`Out of stock detected: inventory=${payload.inventoryId}`);
  }
}
