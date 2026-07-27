import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { PaymentStatus } from '../../../generated/prisma';
import {
  OrderPaymentSyncedEventPayload,
  PaymentCompletedEventPayload,
  PaymentCreatedEventPayload,
  PaymentDeletedEventPayload,
  PaymentFailedEventPayload,
  PaymentRefundedEventPayload,
  PaymentStatusChangedEventPayload,
  PaymentUpdatedEventPayload,
} from '../../../modules/payment/events/payment.event.payloads';
import { PaymentEventType } from '../../../modules/payment/events/payment.event.types';
import { QueueProducerService } from '../../queue/services/queue-producer.service';
import { QueueJobMetadataUtil } from '../../queue/utils/queue-job-metadata.util';
import { AnalyticsOrchestrator } from '../orchestrators/analytics.orchestrator';
import { CacheOrchestrator } from '../orchestrators/cache.orchestrator';
import { NotificationOrchestrator } from '../orchestrators/notification.orchestrator';

@Injectable()
export class PaymentIntegrationHandler {
  private readonly logger = new Logger(PaymentIntegrationHandler.name);

  constructor(
    private readonly notificationOrchestrator: NotificationOrchestrator,
    private readonly analyticsOrchestrator: AnalyticsOrchestrator,
    private readonly cacheOrchestrator: CacheOrchestrator,
    private readonly queueProducerService: QueueProducerService,
  ) {}

  @OnEvent(PaymentEventType.CREATED)
  async onPaymentCreated(payload: PaymentCreatedEventPayload): Promise<void> {
    await this.safeHandle(
      PaymentEventType.CREATED,
      payload.paymentId,
      async () => {
        await this.notificationOrchestrator.notifyPayment({
          userId: payload.userId,
          orderId: payload.orderId,
          paymentId: payload.paymentId,
          title: 'درخواست پرداخت ایجاد شد',
          message: `درخواست پرداخت به مبلغ ${payload.amount} ${payload.currency} ایجاد شد.`,
          actorId: payload.actorId,
          metadata: {
            event: PaymentEventType.CREATED,
            amount: payload.amount,
            currency: payload.currency,
            paymentMethod: payload.paymentMethod,
            paymentStatus: payload.paymentStatus,
          },
        });

        await this.analyticsOrchestrator.record({
          name: 'payment.created',
          description: 'Payment was created',
          category: 'payment',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            paymentId: payload.paymentId,
            orderId: payload.orderId,
            amount: payload.amount,
            currency: payload.currency,
            paymentMethod: payload.paymentMethod,
            paymentStatus: payload.paymentStatus,
          },
        });

        this.cacheOrchestrator.invalidatePaymentCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(PaymentEventType.UPDATED)
  async onPaymentUpdated(payload: PaymentUpdatedEventPayload): Promise<void> {
    await this.safeHandle(
      PaymentEventType.UPDATED,
      payload.paymentId,
      async () => {
        await this.analyticsOrchestrator.record({
          name: 'payment.updated',
          description: 'Payment was updated',
          category: 'payment',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            paymentId: payload.paymentId,
            orderId: payload.orderId,
            changedFields: payload.changedFields,
          },
        });

        this.cacheOrchestrator.invalidatePaymentCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(PaymentEventType.COMPLETED)
  async onPaymentCompleted(
    payload: PaymentCompletedEventPayload,
  ): Promise<void> {
    await this.safeHandle(
      PaymentEventType.COMPLETED,
      payload.paymentId,
      async () => {
        await this.enqueueOrderPostPaid(payload);
        await this.enqueueInvoiceGeneration(payload);

        await this.notificationOrchestrator.notifyPayment({
          userId: payload.userId,
          orderId: payload.orderId,
          paymentId: payload.paymentId,
          transactionId: payload.transactionId ?? null,
          title: 'پرداخت موفق بود',
          message: 'پرداخت سفارش شما با موفقیت انجام شد.',
          actorId: payload.actorId,
          metadata: {
            event: PaymentEventType.COMPLETED,
            amount: payload.amount,
            currency: payload.currency,
            transactionId: payload.transactionId ?? null,
            gateway: payload.gateway ?? null,
          },
        });

        await this.analyticsOrchestrator.record({
          name: 'payment.completed',
          description: 'Payment was completed',
          category: 'payment',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            paymentId: payload.paymentId,
            orderId: payload.orderId,
            amount: payload.amount,
            currency: payload.currency,
            transactionId: payload.transactionId ?? null,
            gateway: payload.gateway ?? null,
          },
        });

        this.cacheOrchestrator.invalidatePaymentCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(PaymentEventType.FAILED)
  async onPaymentFailed(payload: PaymentFailedEventPayload): Promise<void> {
    await this.safeHandle(
      PaymentEventType.FAILED,
      payload.paymentId,
      async () => {
        await this.notificationOrchestrator.notifyPayment({
          userId: payload.userId,
          orderId: payload.orderId,
          paymentId: payload.paymentId,
          transactionId: payload.transactionId ?? null,
          title: 'پرداخت ناموفق بود',
          message:
            'پرداخت شما ناموفق بود. در صورت کسر وجه، نتیجه از طریق بانک پیگیری خواهد شد.',
          actorId: payload.actorId,
          metadata: {
            event: PaymentEventType.FAILED,
            reason: payload.reason ?? null,
            transactionId: payload.transactionId ?? null,
            gateway: payload.gateway ?? null,
          },
        });

        await this.analyticsOrchestrator.record({
          name: 'payment.failed',
          description: 'Payment was failed',
          category: 'payment',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            paymentId: payload.paymentId,
            orderId: payload.orderId,
            reason: payload.reason ?? null,
            transactionId: payload.transactionId ?? null,
            gateway: payload.gateway ?? null,
          },
        });

        this.cacheOrchestrator.invalidatePaymentCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(PaymentEventType.REFUNDED)
  async onPaymentRefunded(payload: PaymentRefundedEventPayload): Promise<void> {
    await this.safeHandle(
      PaymentEventType.REFUNDED,
      payload.paymentId,
      async () => {
        await this.notificationOrchestrator.notifyPayment({
          userId: payload.userId,
          orderId: payload.orderId,
          paymentId: payload.paymentId,
          title: 'بازپرداخت انجام شد',
          message: 'بازپرداخت پرداخت شما انجام شد.',
          actorId: payload.actorId,
          metadata: {
            event: PaymentEventType.REFUNDED,
            refundedAmount: payload.refundedAmount ?? null,
            currentPaymentStatus: payload.currentPaymentStatus,
          },
        });

        await this.analyticsOrchestrator.record({
          name: 'payment.refunded',
          description: 'Payment was refunded',
          category: 'payment',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            paymentId: payload.paymentId,
            orderId: payload.orderId,
            refundedAmount: payload.refundedAmount ?? null,
            currentPaymentStatus: payload.currentPaymentStatus,
          },
        });

        this.cacheOrchestrator.invalidatePaymentCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(PaymentEventType.STATUS_CHANGED)
  async onPaymentStatusChanged(
    payload: PaymentStatusChangedEventPayload,
  ): Promise<void> {
    await this.safeHandle(
      PaymentEventType.STATUS_CHANGED,
      payload.paymentId,
      async () => {
        if (this.shouldNotifyStatusChange(payload.currentStatus)) {
          await this.notificationOrchestrator.notifyPayment({
            userId: payload.userId,
            orderId: payload.orderId,
            paymentId: payload.paymentId,
            title: 'وضعیت پرداخت تغییر کرد',
            message: `وضعیت پرداخت شما به «${this.translatePaymentStatus(
              payload.currentStatus,
            )}» تغییر کرد.`,
            actorId: payload.actorId,
            metadata: {
              event: PaymentEventType.STATUS_CHANGED,
              previousStatus: payload.previousStatus,
              currentStatus: payload.currentStatus,
            },
          });
        }

        await this.analyticsOrchestrator.record({
          name: 'payment.status_changed',
          description: 'Payment status was changed',
          category: 'payment',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            paymentId: payload.paymentId,
            orderId: payload.orderId,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
          },
        });

        this.cacheOrchestrator.invalidatePaymentCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(PaymentEventType.DELETED)
  async onPaymentDeleted(payload: PaymentDeletedEventPayload): Promise<void> {
    await this.safeHandle(
      PaymentEventType.DELETED,
      payload.paymentId,
      async () => {
        await this.analyticsOrchestrator.record({
          name: 'payment.deleted',
          description: 'Payment was soft deleted',
          category: 'payment',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            paymentId: payload.paymentId,
            orderId: payload.orderId,
          },
        });

        this.cacheOrchestrator.invalidatePaymentCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(PaymentEventType.ORDER_PAYMENT_SYNCED)
  async onOrderPaymentSynced(
    payload: OrderPaymentSyncedEventPayload,
  ): Promise<void> {
    await this.safeHandle(
      PaymentEventType.ORDER_PAYMENT_SYNCED,
      payload.orderId,
      async () => {
        await this.analyticsOrchestrator.record({
          name: 'payment.order_payment_synced',
          description: 'Order payment status was synced',
          category: 'payment',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            orderId: payload.orderId,
            paymentStatus: payload.paymentStatus,
          },
        });

        this.cacheOrchestrator.invalidatePaymentCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  private async enqueueOrderPostPaid(
    payload: PaymentCompletedEventPayload,
  ): Promise<void> {
    try {
      await this.queueProducerService.enqueueOrderPostPaid({
        orderId: payload.orderId,
        event: PaymentEventType.COMPLETED,
        payload: {
          paymentId: payload.paymentId,
          userId: payload.userId,
          amount: payload.amount,
          currency: payload.currency,
          transactionId: payload.transactionId ?? null,
          gateway: payload.gateway ?? null,
        },
        metadata: QueueJobMetadataUtil.create({
          actorId: this.normalizeOptionalString(payload.actorId),
          source: 'payment-integration.completed.order-post-paid',
        }),
      });
    } catch (error) {
      this.logger.error(
        `ثبت job پس از پرداخت سفارش ناموفق بود: ${payload.orderId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async enqueueInvoiceGeneration(
    payload: PaymentCompletedEventPayload,
  ): Promise<void> {
    try {
      await this.queueProducerService.enqueueInvoiceGeneration({
        orderId: payload.orderId,
        regenerate: false,
        metadata: QueueJobMetadataUtil.create({
          actorId: this.normalizeOptionalString(payload.actorId),
          source: 'payment-integration.completed.invoice-generation',
        }),
      });
    } catch (error) {
      this.logger.error(
        `ثبت job تولید فاکتور برای سفارش ناموفق بود: ${payload.orderId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private shouldNotifyStatusChange(status: PaymentStatus): boolean {
    return (
      status !== PaymentStatus.COMPLETED &&
      status !== PaymentStatus.FAILED &&
      status !== PaymentStatus.REFUNDED &&
      status !== PaymentStatus.PARTIAL_REFUNDED
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
        `پردازش integration پرداخت ناموفق بود: ${eventType} ${entityId ?? ''}`.trim(),
        error instanceof Error ? error.stack : String(error),
      );
    }
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

  private translatePaymentStatus(status: PaymentStatus): string {
    const labels: Partial<Record<PaymentStatus, string>> = {
      [PaymentStatus.PENDING]: 'در انتظار پرداخت',
      [PaymentStatus.COMPLETED]: 'پرداخت موفق',
      [PaymentStatus.FAILED]: 'پرداخت ناموفق',
      [PaymentStatus.REFUNDED]: 'بازپرداخت شده',
      [PaymentStatus.PARTIAL_REFUNDED]: 'بازپرداخت جزئی',
    };

    return labels[status] ?? String(status);
  }
}
