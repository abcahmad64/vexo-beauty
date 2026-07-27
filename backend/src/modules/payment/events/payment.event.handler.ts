import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { OrderStatus } from '../../../generated/prisma';

import { QueueProducerService } from '../../../core/queue/services/queue-producer.service';

import { NotificationService } from '../../notification/services/notification.service';

import { PaymentEventType } from './payment.event.types';

import {
  OrderPaymentSyncedEventPayload,
  PaymentCompletedEventPayload,
  PaymentCreatedEventPayload,
  PaymentDeletedEventPayload,
  PaymentFailedEventPayload,
  PaymentRefundedEventPayload,
  PaymentStatusChangedEventPayload,
  PaymentUpdatedEventPayload,
} from './payment.event.payloads';

@Injectable()
export class PaymentEventHandler {
  private readonly logger = new Logger(PaymentEventHandler.name);

  constructor(
    private readonly queueProducerService: QueueProducerService,
    private readonly notificationService: NotificationService,
  ) {}

  @OnEvent(PaymentEventType.CREATED)
  handleCreated(payload: PaymentCreatedEventPayload): void {
    this.logger.log(
      `Payment created: ${payload.paymentId}; amount=${payload.amount} ${payload.currency}`,
    );
  }

  @OnEvent(PaymentEventType.UPDATED)
  handleUpdated(payload: PaymentUpdatedEventPayload): void {
    this.logger.log(
      `Payment updated: ${payload.paymentId}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(PaymentEventType.COMPLETED)
  async handleCompleted(payload: PaymentCompletedEventPayload): Promise<void> {
    this.logger.log(
      `Payment completed: ${payload.paymentId}; transaction=${payload.transactionId ?? 'N/A'}`,
    );

    await this.enqueueOrderPostPaid(payload);

    await this.enqueueInvoiceGeneration(payload);

    await this.notifyPaymentCompleted(payload);
  }

  @OnEvent(PaymentEventType.FAILED)
  async handleFailed(payload: PaymentFailedEventPayload): Promise<void> {
    this.logger.warn(
      `Payment failed: ${payload.paymentId}; reason=${payload.reason ?? 'N/A'}`,
    );

    await this.notifyPaymentFailed(payload);
  }

  @OnEvent(PaymentEventType.REFUNDED)
  async handleRefunded(payload: PaymentRefundedEventPayload): Promise<void> {
    this.logger.warn(
      `Payment refunded: ${payload.paymentId}; status=${payload.currentPaymentStatus}`,
    );

    await this.notifyPaymentRefunded(payload);
  }

  @OnEvent(PaymentEventType.STATUS_CHANGED)
  handleStatusChanged(payload: PaymentStatusChangedEventPayload): void {
    this.logger.log(
      `Payment status changed: ${payload.paymentId}; ${payload.previousStatus} -> ${payload.currentStatus}`,
    );
  }

  @OnEvent(PaymentEventType.DELETED)
  handleDeleted(payload: PaymentDeletedEventPayload): void {
    this.logger.warn(`Payment soft deleted: ${payload.paymentId}`);
  }

  @OnEvent(PaymentEventType.ORDER_PAYMENT_SYNCED)
  handleOrderPaymentSynced(payload: OrderPaymentSyncedEventPayload): void {
    this.logger.log(
      `Order payment status synced: order=${payload.orderId}; status=${payload.paymentStatus}`,
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
          transactionId: payload.transactionId,
          gateway: payload.gateway,
          nextStatus: OrderStatus.PROCESSING,
          reason: 'پرداخت موفق؛ سفارش آماده پردازش است.',
        },
        metadata: {
          actorId: payload.actorId,
          source: 'payment.completed',
          correlationId: payload.paymentId,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async enqueueInvoiceGeneration(
    payload: PaymentCompletedEventPayload,
  ): Promise<void> {
    try {
      await this.queueProducerService.enqueueInvoiceGeneration({
        orderId: payload.orderId,
        regenerate: false,
        metadata: {
          actorId: payload.actorId,
          source: 'payment.completed',
          correlationId: payload.paymentId,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async notifyPaymentCompleted(
    payload: PaymentCompletedEventPayload,
  ): Promise<void> {
    try {
      await this.notificationService.sendNotification({
        userId: payload.userId,
        title: 'پرداخت شما با موفقیت انجام شد',
        message: `پرداخت سفارش شما با مبلغ ${payload.amount} ${payload.currency} با موفقیت ثبت شد.`,
        type: 'ORDER_UPDATE',
        channels: ['database', 'websocket', 'push'],
        saveToDatabase: true,
        metadata: {
          paymentId: payload.paymentId,
          orderId: payload.orderId,
          transactionId: payload.transactionId,
          gateway: payload.gateway,
          amount: payload.amount,
          currency: payload.currency,
        },
      });
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async notifyPaymentFailed(
    payload: PaymentFailedEventPayload,
  ): Promise<void> {
    try {
      await this.notificationService.sendNotification({
        userId: payload.userId,
        title: 'پرداخت ناموفق بود',
        message: payload.reason ?? 'پرداخت سفارش شما با موفقیت انجام نشد.',
        type: 'ORDER_UPDATE',
        channels: ['database', 'websocket', 'push'],
        saveToDatabase: true,
        metadata: {
          paymentId: payload.paymentId,
          orderId: payload.orderId,
          transactionId: payload.transactionId,
          gateway: payload.gateway,
          reason: payload.reason,
        },
      });
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async notifyPaymentRefunded(
    payload: PaymentRefundedEventPayload,
  ): Promise<void> {
    try {
      await this.notificationService.sendNotification({
        userId: payload.userId,
        title: 'بازگشت وجه ثبت شد',
        message: 'وضعیت بازگشت وجه پرداخت شما در سیستم ثبت شد.',
        type: 'ORDER_UPDATE',
        channels: ['database', 'websocket', 'push'],
        saveToDatabase: true,
        metadata: {
          paymentId: payload.paymentId,
          orderId: payload.orderId,
          refundedAmount: payload.refundedAmount,
          currentPaymentStatus: payload.currentPaymentStatus,
        },
      });
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }
}
