import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import {
  InvoiceCancelledEventPayload,
  InvoiceCreatedEventPayload,
  InvoiceDeletedEventPayload,
  InvoiceIssuedEventPayload,
  InvoiceUpdatedEventPayload,
} from '../../../modules/invoice/events/invoice.event.payloads';
import { InvoiceEventType } from '../../../modules/invoice/events/invoice.event.types';
import { AnalyticsOrchestrator } from '../orchestrators/analytics.orchestrator';
import { CacheOrchestrator } from '../orchestrators/cache.orchestrator';
import { NotificationOrchestrator } from '../orchestrators/notification.orchestrator';

@Injectable()
export class InvoiceIntegrationHandler {
  private readonly logger = new Logger(InvoiceIntegrationHandler.name);

  constructor(
    private readonly notificationOrchestrator: NotificationOrchestrator,
    private readonly analyticsOrchestrator: AnalyticsOrchestrator,
    private readonly cacheOrchestrator: CacheOrchestrator,
  ) {}

  @OnEvent(InvoiceEventType.INVOICE_CREATED)
  async onInvoiceCreated(payload: InvoiceCreatedEventPayload): Promise<void> {
    await this.safeHandle(
      InvoiceEventType.INVOICE_CREATED,
      payload.invoiceId,
      async () => {
        await this.notificationOrchestrator.notifyInvoice({
          userId: payload.userId,
          orderId: payload.orderId,
          orderNumber: payload.orderNumber ?? null,
          invoiceId: payload.invoiceId,
          invoiceNumber: payload.invoiceNumber,
          title: 'فاکتور سفارش ایجاد شد',
          message: `فاکتور شماره ${this.resolveInvoiceLabel(
            payload.invoiceNumber,
            payload.invoiceId,
          )} برای سفارش شما ایجاد شد.`,
          actorId: payload.actorId,
          metadata: {
            event: InvoiceEventType.INVOICE_CREATED,
            paymentId: payload.paymentId,
            amount: payload.amount,
            currency: payload.currency,
            status: payload.status,
          },
        });

        await this.analyticsOrchestrator.record({
          name: 'invoice.created',
          description: 'Invoice was created',
          category: 'invoice',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            invoiceId: payload.invoiceId,
            invoiceNumber: payload.invoiceNumber,
            orderId: payload.orderId,
            orderNumber: payload.orderNumber ?? null,
            paymentId: payload.paymentId,
            amount: payload.amount,
            currency: payload.currency,
            status: payload.status,
          },
        });

        this.cacheOrchestrator.invalidatePaymentCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(InvoiceEventType.INVOICE_UPDATED)
  async onInvoiceUpdated(payload: InvoiceUpdatedEventPayload): Promise<void> {
    await this.safeHandle(
      InvoiceEventType.INVOICE_UPDATED,
      payload.invoiceId,
      async () => {
        await this.analyticsOrchestrator.record({
          name: 'invoice.updated',
          description: 'Invoice was updated',
          category: 'invoice',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            invoiceId: payload.invoiceId,
            invoiceNumber: payload.invoiceNumber,
            orderId: payload.orderId,
            paymentId: payload.paymentId,
            amount: payload.amount,
            currency: payload.currency,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
            previousPdfUrl: payload.previousPdfUrl ?? null,
            currentPdfUrl: payload.currentPdfUrl ?? null,
            previousDueDate: payload.previousDueDate ?? null,
            currentDueDate: payload.currentDueDate ?? null,
          },
        });

        this.cacheOrchestrator.invalidatePaymentCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(InvoiceEventType.INVOICE_ISSUED)
  async onInvoiceIssued(payload: InvoiceIssuedEventPayload): Promise<void> {
    await this.safeHandle(
      InvoiceEventType.INVOICE_ISSUED,
      payload.invoiceId,
      async () => {
        await this.notificationOrchestrator.notifyInvoice({
          userId: payload.userId,
          orderId: payload.orderId,
          invoiceId: payload.invoiceId,
          invoiceNumber: payload.invoiceNumber,
          title: 'فاکتور سفارش صادر شد',
          message: `فاکتور شماره ${this.resolveInvoiceLabel(
            payload.invoiceNumber,
            payload.invoiceId,
          )} صادر شد و اکنون قابل مشاهده است.`,
          actorId: payload.actorId,
          metadata: {
            event: InvoiceEventType.INVOICE_ISSUED,
            paymentId: payload.paymentId,
            amount: payload.amount,
            currency: payload.currency,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
            issuedAt: payload.issuedAt,
            pdfUrl: payload.pdfUrl ?? null,
          },
        });

        await this.analyticsOrchestrator.record({
          name: 'invoice.issued',
          description: 'Invoice was issued',
          category: 'invoice',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            invoiceId: payload.invoiceId,
            invoiceNumber: payload.invoiceNumber,
            orderId: payload.orderId,
            paymentId: payload.paymentId,
            amount: payload.amount,
            currency: payload.currency,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
            issuedAt: payload.issuedAt,
            pdfUrl: payload.pdfUrl ?? null,
          },
        });

        this.cacheOrchestrator.invalidatePaymentCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(InvoiceEventType.INVOICE_CANCELLED)
  async onInvoiceCancelled(
    payload: InvoiceCancelledEventPayload,
  ): Promise<void> {
    await this.safeHandle(
      InvoiceEventType.INVOICE_CANCELLED,
      payload.invoiceId,
      async () => {
        await this.notificationOrchestrator.notifyInvoice({
          userId: payload.userId,
          orderId: payload.orderId,
          invoiceId: payload.invoiceId,
          invoiceNumber: payload.invoiceNumber,
          title: 'فاکتور سفارش لغو شد',
          message: `فاکتور شماره ${this.resolveInvoiceLabel(
            payload.invoiceNumber,
            payload.invoiceId,
          )} لغو شد.`,
          actorId: payload.actorId,
          metadata: {
            event: InvoiceEventType.INVOICE_CANCELLED,
            paymentId: payload.paymentId,
            amount: payload.amount,
            currency: payload.currency,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
            reason: payload.reason ?? null,
          },
        });

        await this.analyticsOrchestrator.record({
          name: 'invoice.cancelled',
          description: 'Invoice was cancelled',
          category: 'invoice',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            invoiceId: payload.invoiceId,
            invoiceNumber: payload.invoiceNumber,
            orderId: payload.orderId,
            paymentId: payload.paymentId,
            amount: payload.amount,
            currency: payload.currency,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
            reason: payload.reason ?? null,
          },
        });

        this.cacheOrchestrator.invalidatePaymentCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(InvoiceEventType.INVOICE_DELETED)
  async onInvoiceDeleted(payload: InvoiceDeletedEventPayload): Promise<void> {
    await this.safeHandle(
      InvoiceEventType.INVOICE_DELETED,
      payload.invoiceId,
      async () => {
        await this.analyticsOrchestrator.record({
          name: 'invoice.deleted',
          description: 'Invoice was soft deleted',
          category: 'invoice',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            invoiceId: payload.invoiceId,
            invoiceNumber: payload.invoiceNumber,
            orderId: payload.orderId,
            paymentId: payload.paymentId,
            amount: payload.amount,
            currency: payload.currency,
            status: payload.status,
          },
        });

        this.cacheOrchestrator.invalidatePaymentCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  private async safeHandle(
    eventType: string,
    entityId: string | null | undefined,
    handler: () => Promise<void>,
  ): Promise<void> {
    try {
      await handler();
    } catch (error) {
      this.logger.error(
        `پردازش integration فاکتور ناموفق بود: ${eventType} ${entityId ?? ''}`.trim(),
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private resolveInvoiceLabel(
    invoiceNumber: string | null | undefined,
    invoiceId: string,
  ): string {
    return (
      this.normalizeOptionalString(invoiceNumber) ??
      this.normalizeOptionalString(invoiceId) ??
      'سفارش'
    );
  }

  private normalizeOptionalString(
    value: string | null | undefined,
  ): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }
}
