import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { InvoiceEventType } from './invoice.event.types';

import {
  InvoiceCancelledEventPayload,
  InvoiceCreatedEventPayload,
  InvoiceDeletedEventPayload,
  InvoiceIssuedEventPayload,
  InvoiceUpdatedEventPayload,
} from './invoice.event.payloads';

@Injectable()
export class InvoiceEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishInvoiceCreated(payload: InvoiceCreatedEventPayload): void {
    this.eventEmitter.emit(InvoiceEventType.INVOICE_CREATED, payload);
  }

  publishInvoiceUpdated(payload: InvoiceUpdatedEventPayload): void {
    this.eventEmitter.emit(InvoiceEventType.INVOICE_UPDATED, payload);
  }

  publishInvoiceIssued(payload: InvoiceIssuedEventPayload): void {
    this.eventEmitter.emit(InvoiceEventType.INVOICE_ISSUED, payload);
  }

  publishInvoiceCancelled(payload: InvoiceCancelledEventPayload): void {
    this.eventEmitter.emit(InvoiceEventType.INVOICE_CANCELLED, payload);
  }

  publishInvoiceDeleted(payload: InvoiceDeletedEventPayload): void {
    this.eventEmitter.emit(InvoiceEventType.INVOICE_DELETED, payload);
  }
}
