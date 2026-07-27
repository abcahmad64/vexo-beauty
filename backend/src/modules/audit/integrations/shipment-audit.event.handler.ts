import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { ShipmentEventType } from '../../shipment/events/shipment.event.types';

import {
  OrderDeliveredEventPayload,
  OrderShippedEventPayload,
  ShipmentCancelledEventPayload,
  ShipmentCreatedEventPayload,
  ShipmentTrackingUpdatedEventPayload,
  ShipmentUpdatedEventPayload,
} from '../../shipment/events/shipment.event.payloads';

import { AuditService } from '../services/audit.service';

type ShipmentAuditSeverity =
  'info' | 'success' | 'warning' | 'error' | 'critical';

type ShipmentAuditInput = {
  action: string;
  title: string;
  description: string;
  entityId: string;
  actorId?: string;
  severity: ShipmentAuditSeverity;
  metadata: Record<string, unknown>;
};

@Injectable()
export class ShipmentAuditEventHandler {
  private readonly logger = new Logger(ShipmentAuditEventHandler.name);

  constructor(private readonly auditService: AuditService) {}

  @OnEvent(ShipmentEventType.SHIPMENT_CREATED)
  async handleShipmentCreated(
    payload: ShipmentCreatedEventPayload,
  ): Promise<void> {
    await this.writeShipmentAudit({
      action: 'shipment.created',
      title: 'فرآیند ارسال سفارش ایجاد شد',
      description: `فرآیند ارسال برای سفارش ${payload.orderNumber} ایجاد شد.`,
      entityId: payload.orderId,
      actorId: payload.actorId,
      severity: 'info',
      metadata: {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        userId: payload.userId,
        status: payload.status,
        shippingMethod: payload.shippingMethod ?? null,
        trackingNumber: payload.trackingNumber ?? null,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(ShipmentEventType.SHIPMENT_UPDATED)
  async handleShipmentUpdated(
    payload: ShipmentUpdatedEventPayload,
  ): Promise<void> {
    await this.writeShipmentAudit({
      action: 'shipment.updated',
      title: 'اطلاعات ارسال سفارش ویرایش شد',
      description: `اطلاعات ارسال سفارش ${payload.orderNumber} ویرایش شد.`,
      entityId: payload.orderId,
      actorId: payload.actorId,
      severity: 'info',
      metadata: {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        userId: payload.userId,
        previousShippingMethod: payload.previousShippingMethod ?? null,
        currentShippingMethod: payload.currentShippingMethod ?? null,
        previousTrackingNumber: payload.previousTrackingNumber ?? null,
        currentTrackingNumber: payload.currentTrackingNumber ?? null,
        previousStatus: payload.previousStatus ?? null,
        currentStatus: payload.currentStatus ?? null,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(ShipmentEventType.ORDER_SHIPPED)
  async handleOrderShipped(payload: OrderShippedEventPayload): Promise<void> {
    await this.writeShipmentAudit({
      action: 'shipment.order_shipped',
      title: 'سفارش ارسال شد',
      description: `سفارش ${payload.orderNumber} ارسال شد.`,
      entityId: payload.orderId,
      actorId: payload.actorId,
      severity: 'success',
      metadata: {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        userId: payload.userId,
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        shippingMethod: payload.shippingMethod ?? null,
        trackingNumber: payload.trackingNumber ?? null,
        shippedAt: payload.shippedAt.toISOString(),
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(ShipmentEventType.TRACKING_UPDATED)
  async handleTrackingUpdated(
    payload: ShipmentTrackingUpdatedEventPayload,
  ): Promise<void> {
    await this.writeShipmentAudit({
      action: 'shipment.tracking_updated',
      title: 'اطلاعات رهگیری ارسال به‌روزرسانی شد',
      description: `اطلاعات رهگیری سفارش ${payload.orderNumber} به‌روزرسانی شد.`,
      entityId: payload.orderId,
      actorId: payload.actorId,
      severity: 'info',
      metadata: {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        userId: payload.userId,
        previousShippingMethod: payload.previousShippingMethod ?? null,
        currentShippingMethod: payload.currentShippingMethod ?? null,
        previousTrackingNumber: payload.previousTrackingNumber ?? null,
        currentTrackingNumber: payload.currentTrackingNumber ?? null,
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(ShipmentEventType.ORDER_DELIVERED)
  async handleOrderDelivered(
    payload: OrderDeliveredEventPayload,
  ): Promise<void> {
    await this.writeShipmentAudit({
      action: 'shipment.order_delivered',
      title: 'سفارش تحویل داده شد',
      description: `سفارش ${payload.orderNumber} با موفقیت تحویل داده شد.`,
      entityId: payload.orderId,
      actorId: payload.actorId,
      severity: 'success',
      metadata: {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        userId: payload.userId,
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        deliveredAt: payload.deliveredAt.toISOString(),
        occurredAt: payload.occurredAt.toISOString(),
      },
    });
  }

  @OnEvent(ShipmentEventType.SHIPMENT_CANCELLED)
  async handleShipmentCancelled(
    payload: ShipmentCancelledEventPayload,
  ): Promise<void> {
    await this.writeShipmentAudit({
      action: 'shipment.cancelled',
      title: 'ارسال سفارش لغو شد',
      description:
        payload.reason ?? `ارسال سفارش ${payload.orderNumber} لغو شد.`,
      entityId: payload.orderId,
      actorId: payload.actorId,
      severity: 'warning',
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

  private async writeShipmentAudit(input: ShipmentAuditInput): Promise<void> {
    try {
      await this.auditService.createAuditLog(
        {
          action: input.action,
          entityType: 'shipment',
          entityId: input.entityId,
          title: input.title,
          description: input.description,
          category: 'shipment',
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
