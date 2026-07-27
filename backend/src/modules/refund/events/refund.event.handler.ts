import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { NotificationService } from '../../notification/services/notification.service';

import { RefundInventoryService } from '../services/refund-inventory.service';

import { RefundEventType } from './refund.event.types';

import {
  RefundCompletedEventPayload,
  RefundCreatedEventPayload,
  RefundDeletedEventPayload,
  RefundFailedEventPayload,
  RefundProcessingEventPayload,
  RefundUpdatedEventPayload,
} from './refund.event.payloads';

@Injectable()
export class RefundEventHandler {
  private readonly logger = new Logger(RefundEventHandler.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly refundInventoryService: RefundInventoryService,
  ) {}

  @OnEvent(RefundEventType.REFUND_CREATED)
  async handleRefundCreated(payload: RefundCreatedEventPayload): Promise<void> {
    this.logger.log(
      `Refund created: ${payload.refundId} for payment ${payload.paymentId}`,
    );

    await this.notifyUser({
      userId: payload.userId,
      title: 'درخواست بازگشت وجه ثبت شد',
      message: `درخواست بازگشت وجه شما برای سفارش ${payload.orderNumber ?? payload.orderId} ثبت شد و در انتظار بررسی است.`,
      refundId: payload.refundId,
      paymentId: payload.paymentId,
      orderId: payload.orderId,
      actorId: payload.actorId,
      notifyCustomer: payload.notifyCustomer,
      metadata: {
        amount: payload.amount,
        currency: payload.currency,
        status: payload.status,
        reason: payload.reason,
        orderNumber: payload.orderNumber ?? null,
        source: RefundEventType.REFUND_CREATED,
      },
    });
  }

  @OnEvent(RefundEventType.REFUND_UPDATED)
  async handleRefundUpdated(payload: RefundUpdatedEventPayload): Promise<void> {
    this.logger.log(`Refund updated: ${payload.refundId}`);

    await this.notifyUser({
      userId: payload.userId,
      title: 'درخواست بازگشت وجه به‌روزرسانی شد',
      message: 'اطلاعات درخواست بازگشت وجه شما به‌روزرسانی شد.',
      refundId: payload.refundId,
      paymentId: payload.paymentId,
      orderId: payload.orderId,
      actorId: payload.actorId,
      notifyCustomer: payload.notifyCustomer,
      metadata: {
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        previousAmount: payload.previousAmount,
        currentAmount: payload.currentAmount,
        previousReason: payload.previousReason ?? null,
        currentReason: payload.currentReason ?? null,
        source: RefundEventType.REFUND_UPDATED,
      },
    });
  }

  @OnEvent(RefundEventType.REFUND_PROCESSING)
  async handleRefundProcessing(
    payload: RefundProcessingEventPayload,
  ): Promise<void> {
    this.logger.log(`Refund processing: ${payload.refundId}`);

    await this.notifyUser({
      userId: payload.userId,
      title: 'بازگشت وجه در حال پردازش است',
      message: 'درخواست بازگشت وجه شما وارد مرحله پردازش شد.',
      refundId: payload.refundId,
      paymentId: payload.paymentId,
      orderId: payload.orderId,
      actorId: payload.actorId,
      notifyCustomer: payload.notifyCustomer,
      metadata: {
        amount: payload.amount,
        currency: payload.currency,
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        source: RefundEventType.REFUND_PROCESSING,
      },
    });
  }

  @OnEvent(RefundEventType.REFUND_COMPLETED)
  async handleRefundCompleted(
    payload: RefundCompletedEventPayload,
  ): Promise<void> {
    this.logger.log(
      `Refund completed: ${payload.refundId}; paymentStatus=${payload.paymentStatus}`,
    );

    await this.restoreInventory(payload);

    await this.notifyUser({
      userId: payload.userId,
      title: 'بازگشت وجه با موفقیت انجام شد',
      message: `مبلغ ${payload.amount} ${payload.currency} برای سفارش ${payload.orderNumber ?? payload.orderId} به‌عنوان بازگشت وجه ثبت شد.`,
      refundId: payload.refundId,
      paymentId: payload.paymentId,
      orderId: payload.orderId,
      actorId: payload.actorId,
      notifyCustomer: payload.notifyCustomer,
      metadata: {
        amount: payload.amount,
        currency: payload.currency,
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        processedAt: payload.processedAt.toISOString(),
        paymentStatus: payload.paymentStatus,
        orderNumber: payload.orderNumber ?? null,
        source: RefundEventType.REFUND_COMPLETED,
      },
    });
  }

  @OnEvent(RefundEventType.REFUND_FAILED)
  async handleRefundFailed(payload: RefundFailedEventPayload): Promise<void> {
    this.logger.warn(
      `Refund failed: ${payload.refundId}; reason=${payload.reason ?? 'N/A'}`,
    );

    await this.notifyUser({
      userId: payload.userId,
      title: 'بازگشت وجه ناموفق بود',
      message: payload.reason ?? 'پردازش بازگشت وجه شما ناموفق بود.',
      refundId: payload.refundId,
      paymentId: payload.paymentId,
      orderId: payload.orderId,
      actorId: payload.actorId,
      notifyCustomer: payload.notifyCustomer,
      metadata: {
        amount: payload.amount,
        currency: payload.currency,
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        reason: payload.reason ?? null,
        source: RefundEventType.REFUND_FAILED,
      },
    });
  }

  @OnEvent(RefundEventType.REFUND_DELETED)
  handleRefundDeleted(payload: RefundDeletedEventPayload): void {
    this.logger.warn(`Refund deleted: ${payload.refundId}`);
  }

  private async restoreInventory(
    payload: RefundCompletedEventPayload,
  ): Promise<void> {
    try {
      const result =
        await this.refundInventoryService.restoreInventoryAfterRefundCompleted(
          payload,
        );

      if (result.skipped) {
        this.logger.log(
          `Refund inventory restoration skipped: refund=${result.refundId}; reason=${result.reason ?? 'N/A'}`,
        );
      }
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async notifyUser(input: {
    userId: string;
    title: string;
    message: string;
    refundId: string;
    paymentId: string;
    orderId: string;
    actorId?: string;
    notifyCustomer?: boolean;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    if (input.notifyCustomer === false) {
      this.logger.debug(
        `Customer refund notification suppressed for refund ${input.refundId}.`,
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
          actionUrl: `/account/post-purchase/refunds/${input.refundId}`,
          channels: ['database', 'websocket', 'push'],
          saveToDatabase: true,
          metadata: {
            ...input.metadata,
            refundId: input.refundId,
            paymentId: input.paymentId,
            orderId: input.orderId,
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
