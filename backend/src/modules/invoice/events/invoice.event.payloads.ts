import type { InvoiceStatus } from '../../../generated/prisma';

export type InvoiceCancelledStatus = 'CANCELLED';

export interface InvoiceBaseEventPayload {
  invoiceId: string;
  invoiceNumber: string;
  orderId: string;
  paymentId: string;
  userId: string;
  amount: string;
  currency: string;
  actorId?: string;
  notifyCustomer?: boolean;
  occurredAt: Date;
}

export interface InvoiceCreatedEventPayload extends InvoiceBaseEventPayload {
  status: InvoiceStatus;
  orderNumber?: string | null;
}

export interface InvoiceUpdatedEventPayload extends InvoiceBaseEventPayload {
  previousStatus: InvoiceStatus;
  currentStatus: InvoiceStatus;
  previousPdfUrl?: string | null;
  currentPdfUrl?: string | null;
  previousDueDate?: Date | null;
  currentDueDate?: Date | null;
}

export interface InvoiceIssuedEventPayload extends InvoiceBaseEventPayload {
  previousStatus: InvoiceStatus;
  currentStatus: InvoiceStatus;
  issuedAt: Date;
  pdfUrl?: string | null;
}

export interface InvoiceCancelledEventPayload extends InvoiceBaseEventPayload {
  previousStatus: InvoiceStatus;
  currentStatus: InvoiceCancelledStatus;
  reason?: string | null;
}

export interface InvoiceDeletedEventPayload extends InvoiceBaseEventPayload {
  status: InvoiceStatus;
}
