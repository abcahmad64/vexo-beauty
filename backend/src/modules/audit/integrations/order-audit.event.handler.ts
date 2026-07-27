import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { OrderEventType } from '../../order/events/order.event.types';

import {
  OrderCancelledEventPayload,
  OrderCreatedEventPayload,
  OrderDeletedEventPayload,
  OrderStatusChangedEventPayload,
  OrderStockCommittedEventPayload,
  OrderStockReleasedEventPayload,
  OrderStockReservedEventPayload,
  OrderUpdatedEventPayload,
} from '../../order/events/order.event.payloads';

import { AuditService } from '../services/audit.service';

type OrderAuditSeverity = 'info' | 'success' | 'warning' | 'error' | 'critical';

type OrderAuditInput = {
  action: string;
  title: string;
  description: string;
  entityId: string;
  actorId?: string;
  severity: OrderAuditSeverity;
  metadata: Record<string, unknown>;
};

@Injectable()
export class OrderAuditEventHandler {
  private readonly logger = new Logger(OrderAuditEventHandler.name);

  constructor(private readonly auditService: AuditService) {}

  @OnEvent(OrderEventType.CREATED)
  async handleOrderCreated(payload: OrderCreatedEventPayload): Promise<void> {
    await this.writeOrderAudit({
      action: 'order.created',
      title: 'سفارش ایجاد شد',
      description: `سفارش ${payload.orderNumber} با مبلغ ${payload.totalAmount} ${payload.currency} ایجاد شد.`,
      entityId: payload.orderId,
      actorId: payload.actorId,
      severity: 'info',
      metadata: {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        userId: payload.userId,
        totalAmount: payload.totalAmount,
        currency: payload.currency,
        itemsCount: payload.itemsCount,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(OrderEventType.UPDATED)
  async handleOrderUpdated(payload: OrderUpdatedEventPayload): Promise<void> {
    await this.writeOrderAudit({
      action: 'order.updated',
      title: 'سفارش ویرایش شد',
      description: `اطلاعات سفارش ${payload.orderNumber} ویرایش شد.`,
      entityId: payload.orderId,
      actorId: payload.actorId,
      severity: 'info',
      metadata: {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        userId: payload.userId,
        changedFields: payload.changedFields,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(OrderEventType.STATUS_CHANGED)
  async handleOrderStatusChanged(
    payload: OrderStatusChangedEventPayload,
  ): Promise<void> {
    await this.writeOrderAudit({
      action: 'order.status_changed',
      title: 'وضعیت سفارش تغییر کرد',
      description: `وضعیت سفارش ${payload.orderNumber} از ${payload.previousStatus} به ${payload.currentStatus} تغییر کرد.`,
      entityId: payload.orderId,
      actorId: payload.actorId,
      severity: 'info',
      metadata: {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        userId: payload.userId,
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        reason: payload.reason ?? null,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(OrderEventType.CANCELLED)
  async handleOrderCancelled(
    payload: OrderCancelledEventPayload,
  ): Promise<void> {
    await this.writeOrderAudit({
      action: 'order.cancelled',
      title: 'سفارش لغو شد',
      description: payload.reason ?? `سفارش ${payload.orderNumber} لغو شد.`,
      entityId: payload.orderId,
      actorId: payload.actorId,
      severity: 'warning',
      metadata: {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        userId: payload.userId,
        previousStatus: payload.previousStatus,
        currentStatus: 'CANCELLED',
        reason: payload.reason ?? null,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(OrderEventType.DELETED)
  async handleOrderDeleted(payload: OrderDeletedEventPayload): Promise<void> {
    await this.writeOrderAudit({
      action: 'order.deleted',
      title: 'سفارش حذف نرم شد',
      description: `سفارش ${payload.orderNumber} به‌صورت نرم حذف شد.`,
      entityId: payload.orderId,
      actorId: payload.actorId,
      severity: 'warning',
      metadata: {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        userId: payload.userId,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(OrderEventType.STOCK_RESERVED)
  async handleOrderStockReserved(
    payload: OrderStockReservedEventPayload,
  ): Promise<void> {
    await this.writeOrderAudit({
      action: 'order.stock_reserved',
      title: 'موجودی سفارش رزرو شد',
      description: `موجودی ${payload.itemsCount} آیتم برای سفارش ${payload.orderNumber} رزرو شد.`,
      entityId: payload.orderId,
      actorId: payload.actorId,
      severity: 'info',
      metadata: {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        userId: payload.userId,
        itemsCount: payload.itemsCount,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(OrderEventType.STOCK_RELEASED)
  async handleOrderStockReleased(
    payload: OrderStockReleasedEventPayload,
  ): Promise<void> {
    await this.writeOrderAudit({
      action: 'order.stock_released',
      title: 'موجودی رزروشده سفارش آزاد شد',
      description: `موجودی رزروشده ${payload.itemsCount} آیتم برای سفارش ${payload.orderNumber} آزاد شد.`,
      entityId: payload.orderId,
      actorId: payload.actorId,
      severity: 'warning',
      metadata: {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        userId: payload.userId,
        itemsCount: payload.itemsCount,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(OrderEventType.STOCK_COMMITTED)
  async handleOrderStockCommitted(
    payload: OrderStockCommittedEventPayload,
  ): Promise<void> {
    await this.writeOrderAudit({
      action: 'order.stock_committed',
      title: 'موجودی سفارش قطعی شد',
      description: `موجودی ${payload.itemsCount} آیتم برای سفارش ${payload.orderNumber} قطعی شد.`,
      entityId: payload.orderId,
      actorId: payload.actorId,
      severity: 'success',
      metadata: {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        userId: payload.userId,
        itemsCount: payload.itemsCount,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  private async writeOrderAudit(input: OrderAuditInput): Promise<void> {
    try {
      await this.auditService.createAuditLog(
        {
          action: input.action,
          entityType: 'order',
          entityId: input.entityId,
          title: input.title,
          description: input.description,
          category: 'order',
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
