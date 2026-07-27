import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { OrderEventType } from './order.event.types';

import {
  OrderCancelledEventPayload,
  OrderCreatedEventPayload,
  OrderDeletedEventPayload,
  OrderStatusChangedEventPayload,
  OrderStockCommittedEventPayload,
  OrderStockReleasedEventPayload,
  OrderStockReservedEventPayload,
  OrderUpdatedEventPayload,
} from './order.event.payloads';

@Injectable()
export class OrderEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishCreated(payload: OrderCreatedEventPayload): void {
    this.eventEmitter.emit(OrderEventType.CREATED, payload);
  }

  publishUpdated(payload: OrderUpdatedEventPayload): void {
    this.eventEmitter.emit(OrderEventType.UPDATED, payload);
  }

  publishStatusChanged(payload: OrderStatusChangedEventPayload): void {
    this.eventEmitter.emit(OrderEventType.STATUS_CHANGED, payload);
  }

  publishCancelled(payload: OrderCancelledEventPayload): void {
    this.eventEmitter.emit(OrderEventType.CANCELLED, payload);
  }

  publishDeleted(payload: OrderDeletedEventPayload): void {
    this.eventEmitter.emit(OrderEventType.DELETED, payload);
  }

  publishStockReserved(payload: OrderStockReservedEventPayload): void {
    this.eventEmitter.emit(OrderEventType.STOCK_RESERVED, payload);
  }

  publishStockReleased(payload: OrderStockReleasedEventPayload): void {
    this.eventEmitter.emit(OrderEventType.STOCK_RELEASED, payload);
  }

  publishStockCommitted(payload: OrderStockCommittedEventPayload): void {
    this.eventEmitter.emit(OrderEventType.STOCK_COMMITTED, payload);
  }
}
