import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { PaymentEventType } from '../../payment/events/payment.event.types';

import {
  OrderPaymentSyncedEventPayload,
  PaymentCompletedEventPayload,
  PaymentCreatedEventPayload,
  PaymentDeletedEventPayload,
  PaymentFailedEventPayload,
  PaymentRefundedEventPayload,
  PaymentStatusChangedEventPayload,
  PaymentUpdatedEventPayload,
} from '../../payment/events/payment.event.payloads';

import { AuditService } from '../services/audit.service';

type PaymentAuditInput = {
  action: string;
  title: string;
  description: string;
  entityId?: string;
  actorId?: string;
  severity: 'info' | 'success' | 'warning' | 'error' | 'critical';
  metadata: Record<string, unknown>;
};

@Injectable()
export class PaymentAuditEventHandler {
  private readonly logger = new Logger(PaymentAuditEventHandler.name);

  constructor(private readonly auditService: AuditService) {}

  @OnEvent(PaymentEventType.CREATED)
  async handlePaymentCreated(
    payload: PaymentCreatedEventPayload,
  ): Promise<void> {
    await this.writePaymentAudit({
      action: 'payment.created',
      title: 'پرداخت ایجاد شد',
      description: `پرداخت جدید برای سفارش ${payload.orderId} ایجاد شد.`,
      entityId: payload.paymentId,
      actorId: payload.actorId,
      severity: 'info',
      metadata: {
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        userId: payload.userId,
        amount: payload.amount,
        currency: payload.currency,
        paymentMethod: payload.paymentMethod,
        paymentStatus: payload.paymentStatus,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(PaymentEventType.UPDATED)
  async handlePaymentUpdated(
    payload: PaymentUpdatedEventPayload,
  ): Promise<void> {
    await this.writePaymentAudit({
      action: 'payment.updated',
      title: 'پرداخت ویرایش شد',
      description: `اطلاعات پرداخت ${payload.paymentId} ویرایش شد.`,
      entityId: payload.paymentId,
      actorId: payload.actorId,
      severity: 'info',
      metadata: {
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        userId: payload.userId,
        changedFields: payload.changedFields,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(PaymentEventType.COMPLETED)
  async handlePaymentCompleted(
    payload: PaymentCompletedEventPayload,
  ): Promise<void> {
    await this.writePaymentAudit({
      action: 'payment.completed',
      title: 'پرداخت با موفقیت تکمیل شد',
      description: `پرداخت ${payload.paymentId} برای سفارش ${payload.orderId} با موفقیت تکمیل شد.`,
      entityId: payload.paymentId,
      actorId: payload.actorId,
      severity: 'success',
      metadata: {
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        userId: payload.userId,
        amount: payload.amount,
        currency: payload.currency,
        transactionId: payload.transactionId,
        gateway: payload.gateway,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(PaymentEventType.FAILED)
  async handlePaymentFailed(payload: PaymentFailedEventPayload): Promise<void> {
    await this.writePaymentAudit({
      action: 'payment.failed',
      title: 'پرداخت ناموفق شد',
      description: payload.reason ?? `پرداخت ${payload.paymentId} ناموفق شد.`,
      entityId: payload.paymentId,
      actorId: payload.actorId,
      severity: 'warning',
      metadata: {
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        userId: payload.userId,
        reason: payload.reason ?? null,
        transactionId: payload.transactionId,
        gateway: payload.gateway,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(PaymentEventType.REFUNDED)
  async handlePaymentRefunded(
    payload: PaymentRefundedEventPayload,
  ): Promise<void> {
    await this.writePaymentAudit({
      action: 'payment.refunded',
      title: 'بازگشت وجه پرداخت ثبت شد',
      description: `برای پرداخت ${payload.paymentId} بازگشت وجه ثبت شد.`,
      entityId: payload.paymentId,
      actorId: payload.actorId,
      severity: 'warning',
      metadata: {
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        userId: payload.userId,
        refundedAmount: payload.refundedAmount,
        currentPaymentStatus: payload.currentPaymentStatus,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(PaymentEventType.STATUS_CHANGED)
  async handlePaymentStatusChanged(
    payload: PaymentStatusChangedEventPayload,
  ): Promise<void> {
    await this.writePaymentAudit({
      action: 'payment.status_changed',
      title: 'وضعیت پرداخت تغییر کرد',
      description: `وضعیت پرداخت ${payload.paymentId} از ${payload.previousStatus} به ${payload.currentStatus} تغییر کرد.`,
      entityId: payload.paymentId,
      actorId: payload.actorId,
      severity: 'info',
      metadata: {
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        userId: payload.userId,
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(PaymentEventType.DELETED)
  async handlePaymentDeleted(
    payload: PaymentDeletedEventPayload,
  ): Promise<void> {
    await this.writePaymentAudit({
      action: 'payment.deleted',
      title: 'پرداخت حذف نرم شد',
      description: `پرداخت ${payload.paymentId} به‌صورت نرم حذف شد.`,
      entityId: payload.paymentId,
      actorId: payload.actorId,
      severity: 'warning',
      metadata: {
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        userId: payload.userId,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(PaymentEventType.ORDER_PAYMENT_SYNCED)
  async handleOrderPaymentSynced(
    payload: OrderPaymentSyncedEventPayload,
  ): Promise<void> {
    await this.writePaymentAudit({
      action: 'order.payment_synced',
      title: 'وضعیت پرداخت سفارش همگام‌سازی شد',
      description: `وضعیت پرداخت سفارش ${payload.orderId} به ${payload.paymentStatus} همگام‌سازی شد.`,
      entityId: payload.orderId,
      actorId: payload.actorId,
      severity: 'info',
      metadata: {
        orderId: payload.orderId,
        userId: payload.userId,
        paymentStatus: payload.paymentStatus,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  private async writePaymentAudit(input: PaymentAuditInput): Promise<void> {
    try {
      await this.auditService.createAuditLog(
        {
          action: input.action,
          entityType:
            input.action === 'order.payment_synced' ? 'order' : 'payment',
          entityId: input.entityId,
          title: input.title,
          description: input.description,
          category: 'payment',
          severity: input.severity,
          actorId: input.actorId,
          metadata: input.metadata,
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
