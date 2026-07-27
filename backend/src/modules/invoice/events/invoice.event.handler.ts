import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { NotificationService } from '../../notification/services/notification.service';

import { InvoiceEventType } from './invoice.event.types';

import {
  InvoiceCancelledEventPayload,
  InvoiceCreatedEventPayload,
  InvoiceDeletedEventPayload,
  InvoiceIssuedEventPayload,
  InvoiceUpdatedEventPayload,
} from './invoice.event.payloads';

@Injectable()
export class InvoiceEventHandler {
  private readonly logger = new Logger(InvoiceEventHandler.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent(InvoiceEventType.INVOICE_CREATED)
  async handleInvoiceCreated(
    payload: InvoiceCreatedEventPayload,
  ): Promise<void> {
    this.logger.log(
      `Invoice created: ${payload.invoiceNumber} for order ${payload.orderNumber ?? payload.orderId}`,
    );

    await this.notifyUser({
      userId: payload.userId,
      title: 'فاکتور سفارش شما ایجاد شد',
      message: `فاکتور ${payload.invoiceNumber} برای سفارش ${payload.orderNumber ?? payload.orderId} ایجاد شد.`,
      invoiceId: payload.invoiceId,
      invoiceNumber: payload.invoiceNumber,
      orderId: payload.orderId,
      paymentId: payload.paymentId,
      actorId: payload.actorId,
      notifyCustomer: payload.notifyCustomer,
      metadata: {
        amount: payload.amount,
        currency: payload.currency,
        status: payload.status,
        orderNumber: payload.orderNumber ?? null,
        source: InvoiceEventType.INVOICE_CREATED,
      },
    });
  }

  @OnEvent(InvoiceEventType.INVOICE_UPDATED)
  async handleInvoiceUpdated(
    payload: InvoiceUpdatedEventPayload,
  ): Promise<void> {
    this.logger.log(`Invoice updated: ${payload.invoiceNumber}`);

    await this.notifyUser({
      userId: payload.userId,
      title: 'فاکتور شما به‌روزرسانی شد',
      message: `اطلاعات فاکتور ${payload.invoiceNumber} به‌روزرسانی شد.`,
      invoiceId: payload.invoiceId,
      invoiceNumber: payload.invoiceNumber,
      orderId: payload.orderId,
      paymentId: payload.paymentId,
      actorId: payload.actorId,
      notifyCustomer: payload.notifyCustomer,
      metadata: {
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        previousDueDate: payload.previousDueDate?.toISOString() ?? null,
        currentDueDate: payload.currentDueDate?.toISOString() ?? null,
        source: InvoiceEventType.INVOICE_UPDATED,
      },
    });
  }

  @OnEvent(InvoiceEventType.INVOICE_ISSUED)
  async handleInvoiceIssued(payload: InvoiceIssuedEventPayload): Promise<void> {
    this.logger.log(`Invoice issued: ${payload.invoiceNumber}`);

    await this.notifyUser({
      userId: payload.userId,
      title: 'فاکتور شما آماده دریافت است',
      message: `فاکتور ${payload.invoiceNumber} صادر شد و از حساب کاربری قابل مشاهده است.`,
      invoiceId: payload.invoiceId,
      invoiceNumber: payload.invoiceNumber,
      orderId: payload.orderId,
      paymentId: payload.paymentId,
      actorId: payload.actorId,
      notifyCustomer: payload.notifyCustomer,
      metadata: {
        amount: payload.amount,
        currency: payload.currency,
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        issuedAt: payload.issuedAt.toISOString(),
        source: InvoiceEventType.INVOICE_ISSUED,
      },
    });
  }

  @OnEvent(InvoiceEventType.INVOICE_CANCELLED)
  async handleInvoiceCancelled(
    payload: InvoiceCancelledEventPayload,
  ): Promise<void> {
    this.logger.warn(
      `Invoice cancelled: ${payload.invoiceNumber}; reason=${payload.reason ?? 'N/A'}`,
    );

    await this.notifyUser({
      userId: payload.userId,
      title: 'فاکتور شما لغو شد',
      message: payload.reason ?? `فاکتور ${payload.invoiceNumber} لغو شد.`,
      invoiceId: payload.invoiceId,
      invoiceNumber: payload.invoiceNumber,
      orderId: payload.orderId,
      paymentId: payload.paymentId,
      actorId: payload.actorId,
      notifyCustomer: payload.notifyCustomer,
      metadata: {
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        reason: payload.reason ?? null,
        source: InvoiceEventType.INVOICE_CANCELLED,
      },
    });
  }

  @OnEvent(InvoiceEventType.INVOICE_DELETED)
  handleInvoiceDeleted(payload: InvoiceDeletedEventPayload): void {
    this.logger.warn(`Invoice deleted: ${payload.invoiceNumber}`);
  }

  private async notifyUser(input: {
    userId: string;
    title: string;
    message: string;
    invoiceId: string;
    invoiceNumber: string;
    orderId: string;
    paymentId: string;
    actorId?: string;
    notifyCustomer?: boolean;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    if (input.notifyCustomer === false) {
      this.logger.debug(
        `Customer invoice notification suppressed for invoice ${input.invoiceNumber}.`,
      );

      return;
    }

    try {
      await this.notificationService.sendNotification(
        {
          userId: input.userId,
          title: input.title,
          message: input.message,
          type: 'ORDER_UPDATE',
          actionUrl: `/account/post-purchase/invoices/${input.invoiceId}`,
          channels: ['database', 'websocket', 'push'],
          saveToDatabase: true,
          metadata: {
            ...input.metadata,
            invoiceId: input.invoiceId,
            invoiceNumber: input.invoiceNumber,
            orderId: input.orderId,
            paymentId: input.paymentId,
          },
        },
        {
          actorId: input.actorId,
        },
      );
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }
}
