import { OrderStatus } from '../../../generated/prisma';

export interface OrderBaseEventPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  actorId?: string;
  occurredAt: Date;
}

export interface OrderCreatedEventPayload extends OrderBaseEventPayload {
  totalAmount: string;
  currency: string;
  itemsCount: number;
}

export interface OrderUpdatedEventPayload extends OrderBaseEventPayload {
  changedFields: string[];
}

export interface OrderStatusChangedEventPayload extends OrderBaseEventPayload {
  previousStatus: OrderStatus;
  currentStatus: OrderStatus;
  reason?: string;
}

export interface OrderCancelledEventPayload extends OrderBaseEventPayload {
  previousStatus: OrderStatus;
  reason?: string;
}

export type OrderDeletedEventPayload = OrderBaseEventPayload;

export interface OrderStockReservedEventPayload extends OrderBaseEventPayload {
  itemsCount: number;
}

export interface OrderStockReleasedEventPayload extends OrderBaseEventPayload {
  itemsCount: number;
}

export interface OrderStockCommittedEventPayload extends OrderBaseEventPayload {
  itemsCount: number;
}
