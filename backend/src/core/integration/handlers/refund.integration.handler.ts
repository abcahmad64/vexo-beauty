import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import {
  RefundCompletedEventPayload,
  RefundCreatedEventPayload,
  RefundDeletedEventPayload,
  RefundFailedEventPayload,
  RefundProcessingEventPayload,
  RefundUpdatedEventPayload,
} from '../../../modules/refund/events/refund.event.payloads';
import { RefundEventType } from '../../../modules/refund/events/refund.event.types';
import { AnalyticsOrchestrator } from '../orchestrators/analytics.orchestrator';
import { CacheOrchestrator } from '../orchestrators/cache.orchestrator';
import { NotificationOrchestrator } from '../orchestrators/notification.orchestrator';

@Injectable()
export class RefundIntegrationHandler {
  private readonly logger = new Logger(RefundIntegrationHandler.name);

  constructor(
    private readonly notificationOrchestrator: NotificationOrchestrator,
    private readonly analyticsOrchestrator: AnalyticsOrchestrator,
    private readonly cacheOrchestrator: CacheOrchestrator,
  ) {}

  @OnEvent(RefundEventType.REFUND_CREATED)
  async onRefundCreated(payload: RefundCreatedEventPayload): Promise<void> {
    await this.safeHandle(
      RefundEventType.REFUND_CREATED,
      payload.refundId,
      async () => {
        await this.notificationOrchestrator.notifyRefund({
          userId: payload.userId,
          orderId: payload.orderId,
          paymentId: payload.paymentId,
          refundId: payload.refundId,
          title: 'درخواست بازپرداخت ثبت شد',
          message: `درخواست بازپرداخت به مبلغ ${this.resolveMoneyLabel(
            payload.amount,
            payload.currency,
          )} ثبت شد.`,
          actorId: payload.actorId,
          metadata: {
            event: RefundEventType.REFUND_CREATED,
            amount: payload.amount,
            currency: payload.currency,
            status: payload.status,
            reason: payload.reason ?? null,
            orderNumber: payload.orderNumber ?? null,
          },
        });

        await this.analyticsOrchestrator.record({
          name: 'refund.created',
          description: 'Refund was created',
          category: 'refund',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            refundId: payload.refundId,
            paymentId: payload.paymentId,
            orderId: payload.orderId,
            amount: payload.amount,
            currency: payload.currency,
            status: payload.status,
            reason: payload.reason ?? null,
            orderNumber: payload.orderNumber ?? null,
          },
        });

        this.cacheOrchestrator.invalidatePaymentCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(RefundEventType.REFUND_UPDATED)
  async onRefundUpdated(payload: RefundUpdatedEventPayload): Promise<void> {
    await this.safeHandle(
      RefundEventType.REFUND_UPDATED,
      payload.refundId,
      async () => {
        await this.analyticsOrchestrator.record({
          name: 'refund.updated',
          description: 'Refund was updated',
          category: 'refund',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            refundId: payload.refundId,
            paymentId: payload.paymentId,
            orderId: payload.orderId,
            amount: payload.amount,
            currency: payload.currency,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
            previousAmount: payload.previousAmount,
            currentAmount: payload.currentAmount,
            previousReason: payload.previousReason ?? null,
            currentReason: payload.currentReason ?? null,
          },
        });

        this.cacheOrchestrator.invalidatePaymentCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(RefundEventType.REFUND_PROCESSING)
  async onRefundProcessing(
    payload: RefundProcessingEventPayload,
  ): Promise<void> {
    await this.safeHandle(
      RefundEventType.REFUND_PROCESSING,
      payload.refundId,
      async () => {
        await this.notificationOrchestrator.notifyRefund({
          userId: payload.userId,
          orderId: payload.orderId,
          paymentId: payload.paymentId,
          refundId: payload.refundId,
          title: 'بازپرداخت در حال پردازش است',
          message: `درخواست بازپرداخت شما به مبلغ ${this.resolveMoneyLabel(
            payload.amount,
            payload.currency,
          )} در حال پردازش است.`,
          actorId: payload.actorId,
          metadata: {
            event: RefundEventType.REFUND_PROCESSING,
            amount: payload.amount,
            currency: payload.currency,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
          },
        });

        await this.analyticsOrchestrator.record({
          name: 'refund.processing',
          description: 'Refund is processing',
          category: 'refund',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            refundId: payload.refundId,
            paymentId: payload.paymentId,
            orderId: payload.orderId,
            amount: payload.amount,
            currency: payload.currency,
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

  @OnEvent(RefundEventType.REFUND_COMPLETED)
  async onRefundCompleted(payload: RefundCompletedEventPayload): Promise<void> {
    await this.safeHandle(
      RefundEventType.REFUND_COMPLETED,
      payload.refundId,
      async () => {
        await this.notificationOrchestrator.notifyRefund({
          userId: payload.userId,
          orderId: payload.orderId,
          paymentId: payload.paymentId,
          refundId: payload.refundId,
          title: 'بازپرداخت انجام شد',
          message: `بازپرداخت مبلغ ${this.resolveMoneyLabel(
            payload.amount,
            payload.currency,
          )} با موفقیت انجام شد.`,
          actorId: payload.actorId,
          metadata: {
            event: RefundEventType.REFUND_COMPLETED,
            amount: payload.amount,
            currency: payload.currency,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
            processedAt: payload.processedAt,
            paymentStatus: payload.paymentStatus,
            orderNumber: payload.orderNumber ?? null,
          },
        });

        await this.analyticsOrchestrator.record({
          name: 'refund.completed',
          description: 'Refund was completed',
          category: 'refund',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            refundId: payload.refundId,
            paymentId: payload.paymentId,
            orderId: payload.orderId,
            amount: payload.amount,
            currency: payload.currency,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
            processedAt: payload.processedAt,
            paymentStatus: payload.paymentStatus,
            orderNumber: payload.orderNumber ?? null,
          },
        });

        this.cacheOrchestrator.invalidatePaymentCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(RefundEventType.REFUND_FAILED)
  async onRefundFailed(payload: RefundFailedEventPayload): Promise<void> {
    await this.safeHandle(
      RefundEventType.REFUND_FAILED,
      payload.refundId,
      async () => {
        await this.notificationOrchestrator.notifyRefund({
          userId: payload.userId,
          orderId: payload.orderId,
          paymentId: payload.paymentId,
          refundId: payload.refundId,
          title: 'بازپرداخت ناموفق بود',
          message:
            'پردازش بازپرداخت با خطا مواجه شد. تیم پشتیبانی موضوع را بررسی خواهد کرد.',
          actorId: payload.actorId,
          metadata: {
            event: RefundEventType.REFUND_FAILED,
            amount: payload.amount,
            currency: payload.currency,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
            reason: payload.reason ?? null,
          },
        });

        await this.analyticsOrchestrator.record({
          name: 'refund.failed',
          description: 'Refund was failed',
          category: 'refund',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            refundId: payload.refundId,
            paymentId: payload.paymentId,
            orderId: payload.orderId,
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

  @OnEvent(RefundEventType.REFUND_DELETED)
  async onRefundDeleted(payload: RefundDeletedEventPayload): Promise<void> {
    await this.safeHandle(
      RefundEventType.REFUND_DELETED,
      payload.refundId,
      async () => {
        await this.analyticsOrchestrator.record({
          name: 'refund.deleted',
          description: 'Refund was soft deleted',
          category: 'refund',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            refundId: payload.refundId,
            paymentId: payload.paymentId,
            orderId: payload.orderId,
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
        `پردازش integration بازپرداخت ناموفق بود: ${eventType} ${entityId ?? ''}`.trim(),
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private resolveMoneyLabel(amount: unknown, currency: unknown): string {
    const normalizedAmount = this.normalizeUnknownAsString(amount);
    const normalizedCurrency = this.normalizeUnknownAsString(currency);

    if (normalizedAmount && normalizedCurrency) {
      return `${normalizedAmount} ${normalizedCurrency}`;
    }

    return normalizedAmount ?? normalizedCurrency ?? 'درخواست شما';
  }

  private normalizeUnknownAsString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return this.normalizeOptionalString(value);
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
      return String(value);
    }

    return undefined;
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
