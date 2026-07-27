import type { OrderStatus } from '../../../generated/prisma';

export interface ShipmentBaseEventPayload {
  orderId: string;
  userId: string;
  orderNumber: string;
  actorId?: string;
  notifyCustomer?: boolean;
  occurredAt: Date;
}

export interface ShipmentCreatedEventPayload extends ShipmentBaseEventPayload {
  status: OrderStatus;
  shippingMethod?: string | null;
  trackingNumber?: string | null;
}

export interface ShipmentUpdatedEventPayload extends ShipmentBaseEventPayload {
  previousShippingMethod?: string | null;
  currentShippingMethod?: string | null;
  previousTrackingNumber?: string | null;
  currentTrackingNumber?: string | null;
  previousStatus?: OrderStatus;
  currentStatus?: OrderStatus;
}

export interface OrderShippedEventPayload extends ShipmentBaseEventPayload {
  previousStatus: OrderStatus;
  currentStatus: OrderStatus;
  shippingMethod?: string | null;
  trackingNumber?: string | null;
  shippedAt: Date;
}

export interface ShipmentTrackingUpdatedEventPayload extends ShipmentBaseEventPayload {
  previousShippingMethod?: string | null;
  currentShippingMethod?: string | null;
  previousTrackingNumber?: string | null;
  currentTrackingNumber?: string | null;
}

export interface OrderDeliveredEventPayload extends ShipmentBaseEventPayload {
  previousStatus: OrderStatus;
  currentStatus: OrderStatus;
  deliveredAt: Date;
}

export interface ShipmentCancelledEventPayload extends ShipmentBaseEventPayload {
  previousStatus: OrderStatus;
  currentStatus: OrderStatus;
  reason?: string | null;
}
