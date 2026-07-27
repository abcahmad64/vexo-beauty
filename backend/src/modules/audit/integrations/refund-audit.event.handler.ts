import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { RefundEventType } from '../../refund/events/refund.event.types';

import {
  RefundCompletedEventPayload,
  RefundCreatedEventPayload,
  RefundDeletedEventPayload,
  RefundFailedEventPayload,
  RefundProcessingEventPayload,
  RefundUpdatedEventPayload,
} from '../../refund/events/refund.event.payloads';

import { AuditService } from '../services/audit.service';

type RefundAuditSeverity =
  'info' | 'success' | 'warning' | 'error' | 'critical';

type RefundAuditInput = {
  action: string;
  title: string;
  description: string;
  entityId: string;
  actorId?: string;
  severity: RefundAuditSeverity;
  metadata: Record<string, unknown>;
};

@Injectable()
export class RefundAuditEventHandler {
  private readonly logger = new Logger(RefundAuditEventHandler.name);

  constructor(private readonly auditService: AuditService) {}

  @OnEvent(RefundEventType.REFUND_CREATED)
  async handleRefundCreated(payload: RefundCreatedEventPayload): Promise<void> {
    await this.writeRefundAudit({
      action: 'refund.created',
      title: 'درخواست بازگشت وجه ایجاد شد',
      description: `درخواست بازگشت وجه ${payload.refundId} برای پرداخت ${payload.paymentId} ایجاد شد.`,
      entityId: payload.refundId,
      actorId: payload.actorId,
      severity: 'info',
      metadata: {
        refundId: payload.refundId,
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        orderNumber: payload.orderNumber ?? null,
        userId: payload.userId,
        amount: payload.amount,
        currency: payload.currency,
        status: payload.status,
        reason: payload.reason ?? null,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(RefundEventType.REFUND_UPDATED)
  async handleRefundUpdated(payload: RefundUpdatedEventPayload): Promise<void> {
    await this.writeRefundAudit({
      action: 'refund.updated',
      title: 'درخواست بازگشت وجه ویرایش شد',
      description: `اطلاعات بازگشت وجه ${payload.refundId} ویرایش شد.`,
      entityId: payload.refundId,
      actorId: payload.actorId,
      severity: 'info',
      metadata: {
        refundId: payload.refundId,
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        userId: payload.userId,
        amount: payload.amount,
        currency: payload.currency,
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        previousAmount: payload.previousAmount,
        currentAmount: payload.currentAmount,
        previousReason: payload.previousReason ?? null,
        currentReason: payload.currentReason ?? null,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(RefundEventType.REFUND_PROCESSING)
  async handleRefundProcessing(
    payload: RefundProcessingEventPayload,
  ): Promise<void> {
    await this.writeRefundAudit({
      action: 'refund.processing',
      title: 'بازگشت وجه وارد پردازش شد',
      description: `بازگشت وجه ${payload.refundId} وارد مرحله پردازش شد.`,
      entityId: payload.refundId,
      actorId: payload.actorId,
      severity: 'info',
      metadata: {
        refundId: payload.refundId,
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        userId: payload.userId,
        amount: payload.amount,
        currency: payload.currency,
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(RefundEventType.REFUND_COMPLETED)
  async handleRefundCompleted(
    payload: RefundCompletedEventPayload,
  ): Promise<void> {
    await this.writeRefundAudit({
      action: 'refund.completed',
      title: 'بازگشت وجه با موفقیت تکمیل شد',
      description: `بازگشت وجه ${payload.refundId} برای سفارش ${payload.orderNumber ?? payload.orderId} با موفقیت تکمیل شد.`,
      entityId: payload.refundId,
      actorId: payload.actorId,
      severity: 'success',
      metadata: {
        refundId: payload.refundId,
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        orderNumber: payload.orderNumber ?? null,
        userId: payload.userId,
        amount: payload.amount,
        currency: payload.currency,
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        paymentStatus: payload.paymentStatus,
        processedAt: payload.processedAt.toISOString(),
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(RefundEventType.REFUND_FAILED)
  async handleRefundFailed(payload: RefundFailedEventPayload): Promise<void> {
    await this.writeRefundAudit({
      action: 'refund.failed',
      title: 'بازگشت وجه ناموفق شد',
      description:
        payload.reason ?? `پردازش بازگشت وجه ${payload.refundId} ناموفق شد.`,
      entityId: payload.refundId,
      actorId: payload.actorId,
      severity: 'warning',
      metadata: {
        refundId: payload.refundId,
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        userId: payload.userId,
        amount: payload.amount,
        currency: payload.currency,
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        reason: payload.reason ?? null,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(RefundEventType.REFUND_DELETED)
  async handleRefundDeleted(payload: RefundDeletedEventPayload): Promise<void> {
    await this.writeRefundAudit({
      action: 'refund.deleted',
      title: 'بازگشت وجه حذف نرم شد',
      description: `رکورد بازگشت وجه ${payload.refundId} به‌صورت نرم حذف شد.`,
      entityId: payload.refundId,
      actorId: payload.actorId,
      severity: 'warning',
      metadata: {
        refundId: payload.refundId,
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        userId: payload.userId,
        amount: payload.amount,
        currency: payload.currency,
        status: payload.status,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  private async writeRefundAudit(input: RefundAuditInput): Promise<void> {
    try {
      await this.auditService.createAuditLog(
        {
          action: input.action,
          entityType: 'refund',
          entityId: input.entityId,
          title: input.title,
          description: input.description,
          category: 'refund',
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
