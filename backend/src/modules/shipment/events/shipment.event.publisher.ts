import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { ShipmentEventType } from './shipment.event.types';

import {
  OrderDeliveredEventPayload,
  OrderShippedEventPayload,
  ShipmentCancelledEventPayload,
  ShipmentCreatedEventPayload,
  ShipmentTrackingUpdatedEventPayload,
  ShipmentUpdatedEventPayload,
} from './shipment.event.payloads';

@Injectable()
export class ShipmentEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishShipmentCreated(payload: ShipmentCreatedEventPayload): void {
    this.eventEmitter.emit(ShipmentEventType.SHIPMENT_CREATED, payload);
  }

  publishShipmentUpdated(payload: ShipmentUpdatedEventPayload): void {
    this.eventEmitter.emit(ShipmentEventType.SHIPMENT_UPDATED, payload);
  }

  publishOrderShipped(payload: OrderShippedEventPayload): void {
    this.eventEmitter.emit(ShipmentEventType.ORDER_SHIPPED, payload);
  }

  publishTrackingUpdated(payload: ShipmentTrackingUpdatedEventPayload): void {
    this.eventEmitter.emit(ShipmentEventType.TRACKING_UPDATED, payload);
  }

  publishOrderDelivered(payload: OrderDeliveredEventPayload): void {
    this.eventEmitter.emit(ShipmentEventType.ORDER_DELIVERED, payload);
  }

  publishShipmentCancelled(payload: ShipmentCancelledEventPayload): void {
    this.eventEmitter.emit(ShipmentEventType.SHIPMENT_CANCELLED, payload);
  }
}
