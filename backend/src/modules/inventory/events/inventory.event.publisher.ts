import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

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
export class InventoryEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishWarehouseCreated(payload: WarehouseCreatedEventPayload): void {
    this.eventEmitter.emit(InventoryEventType.WAREHOUSE_CREATED, payload);
  }

  publishWarehouseUpdated(payload: WarehouseUpdatedEventPayload): void {
    this.eventEmitter.emit(InventoryEventType.WAREHOUSE_UPDATED, payload);
  }

  publishInventoryCreated(payload: InventoryCreatedEventPayload): void {
    this.eventEmitter.emit(InventoryEventType.INVENTORY_CREATED, payload);
  }

  publishInventoryUpdated(payload: InventoryUpdatedEventPayload): void {
    this.eventEmitter.emit(InventoryEventType.INVENTORY_UPDATED, payload);
  }

  publishStockAdjusted(payload: StockAdjustedEventPayload): void {
    this.eventEmitter.emit(InventoryEventType.STOCK_ADJUSTED, payload);
  }

  publishStockReserved(payload: StockReservedEventPayload): void {
    this.eventEmitter.emit(InventoryEventType.STOCK_RESERVED, payload);
  }

  publishStockReleased(payload: StockReleasedEventPayload): void {
    this.eventEmitter.emit(InventoryEventType.STOCK_RELEASED, payload);
  }

  publishReservedStockCommitted(
    payload: ReservedStockCommittedEventPayload,
  ): void {
    this.eventEmitter.emit(
      InventoryEventType.RESERVED_STOCK_COMMITTED,
      payload,
    );
  }

  publishLowStockDetected(
    payload: InventoryLowStockDetectedEventPayload,
  ): void {
    this.eventEmitter.emit(InventoryEventType.LOW_STOCK_DETECTED, payload);
  }

  publishOutOfStockDetected(
    payload: InventoryOutOfStockDetectedEventPayload,
  ): void {
    this.eventEmitter.emit(InventoryEventType.OUT_OF_STOCK_DETECTED, payload);
  }
}
