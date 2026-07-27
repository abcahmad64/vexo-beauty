import type { PaymentStatus, RefundStatus } from '../../../generated/prisma';

export type RefundProcessingStatus = 'PROCESSING';
export type RefundCompletedStatus = 'COMPLETED';
export type RefundFailedStatus = 'FAILED';

export interface RefundBaseEventPayload {
  refundId: string;
  paymentId: string;
  orderId: string;
  userId: string;
  amount: string;
  currency: string;
  actorId?: string;
  notifyCustomer?: boolean;
  occurredAt: Date;
}

export interface RefundCreatedEventPayload extends RefundBaseEventPayload {
  status: RefundStatus;
  reason?: string | null;
  orderNumber?: string | null;
}

export interface RefundUpdatedEventPayload extends RefundBaseEventPayload {
  previousStatus: RefundStatus;
  currentStatus: RefundStatus;
  previousAmount: string;
  currentAmount: string;
  previousReason?: string | null;
  currentReason?: string | null;
}

export interface RefundProcessingEventPayload extends RefundBaseEventPayload {
  previousStatus: RefundStatus;
  currentStatus: RefundProcessingStatus;
}

export interface RefundCompletedEventPayload extends RefundBaseEventPayload {
  previousStatus: RefundStatus;
  currentStatus: RefundCompletedStatus;
  processedAt: Date;
  paymentStatus: PaymentStatus;
  orderNumber?: string | null;
}

export interface RefundFailedEventPayload extends RefundBaseEventPayload {
  previousStatus: RefundStatus;
  currentStatus: RefundFailedStatus;
  reason?: string | null;
}

export interface RefundDeletedEventPayload extends RefundBaseEventPayload {
  status: RefundStatus;
}
