import { PaymentMethod, PaymentStatus } from '../../../generated/prisma';

export interface PaymentBaseEventPayload {
  paymentId: string;
  orderId: string;
  userId: string;
  actorId?: string;
  occurredAt: Date;
}

export interface PaymentCreatedEventPayload extends PaymentBaseEventPayload {
  amount: string;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
}

export interface PaymentUpdatedEventPayload extends PaymentBaseEventPayload {
  changedFields: string[];
}

export interface PaymentCompletedEventPayload extends PaymentBaseEventPayload {
  amount: string;
  currency: string;
  transactionId?: string | null;
  gateway?: string | null;
}

export interface PaymentFailedEventPayload extends PaymentBaseEventPayload {
  reason?: string;
  transactionId?: string | null;
  gateway?: string | null;
}

export interface PaymentRefundedEventPayload extends PaymentBaseEventPayload {
  refundedAmount?: string | null;
  currentPaymentStatus: PaymentStatus;
}

export interface PaymentStatusChangedEventPayload extends PaymentBaseEventPayload {
  previousStatus: PaymentStatus;
  currentStatus: PaymentStatus;
}

export type PaymentDeletedEventPayload = PaymentBaseEventPayload;

export interface OrderPaymentSyncedEventPayload {
  orderId: string;
  userId: string;
  paymentStatus: PaymentStatus;
  actorId?: string;
  occurredAt: Date;
}
