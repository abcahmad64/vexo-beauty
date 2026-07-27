import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import {
  OrderDeliveredEventPayload,
  OrderShippedEventPayload,
  ShipmentCancelledEventPayload,
  ShipmentCreatedEventPayload,
  ShipmentTrackingUpdatedEventPayload,
  ShipmentUpdatedEventPayload,
} from '../../../modules/shipment/events/shipment.event.payloads';
import { ShipmentEventType } from '../../../modules/shipment/events/shipment.event.types';
import { AnalyticsOrchestrator } from '../orchestrators/analytics.orchestrator';
import { CacheOrchestrator } from '../orchestrators/cache.orchestrator';
import { NotificationOrchestrator } from '../orchestrators/notification.orchestrator';

@Injectable()
export class ShipmentIntegrationHandler {
  private readonly logger = new Logger(ShipmentIntegrationHandler.name);

  constructor(
    private readonly notificationOrchestrator: NotificationOrchestrator,
    private readonly analyticsOrchestrator: AnalyticsOrchestrator,
    private readonly cacheOrchestrator: CacheOrchestrator,
  ) {}

  @OnEvent(ShipmentEventType.SHIPMENT_CREATED)
  async onShipmentCreated(payload: ShipmentCreatedEventPayload): Promise<void> {
    await this.safeHandle(
      ShipmentEventType.SHIPMENT_CREATED,
      payload.orderId,
      async () => {
        await this.analyticsOrchestrator.record({
          name: 'shipment.created',
          description: 'Shipment was created',
          category: 'shipment',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            orderId: payload.orderId,
            orderNumber: payload.orderNumber,
            status: payload.status,
            shippingMethod: payload.shippingMethod ?? null,
            trackingNumber: payload.trackingNumber ?? null,
          },
        });

        this.cacheOrchestrator.invalidateOrderCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(ShipmentEventType.SHIPMENT_UPDATED)
  async onShipmentUpdated(payload: ShipmentUpdatedEventPayload): Promise<void> {
    await this.safeHandle(
      ShipmentEventType.SHIPMENT_UPDATED,
      payload.orderId,
      async () => {
        await this.analyticsOrchestrator.record({
          name: 'shipment.updated',
          description: 'Shipment was updated',
          category: 'shipment',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            orderId: payload.orderId,
            orderNumber: payload.orderNumber,
            previousShippingMethod: payload.previousShippingMethod ?? null,
            currentShippingMethod: payload.currentShippingMethod ?? null,
            previousTrackingNumber: payload.previousTrackingNumber ?? null,
            currentTrackingNumber: payload.currentTrackingNumber ?? null,
            previousStatus: payload.previousStatus ?? null,
            currentStatus: payload.currentStatus ?? null,
          },
        });

        this.cacheOrchestrator.invalidateOrderCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(ShipmentEventType.ORDER_SHIPPED)
  async onOrderShipped(payload: OrderShippedEventPayload): Promise<void> {
    await this.safeHandle(
      ShipmentEventType.ORDER_SHIPPED,
      payload.orderId,
      async () => {
        const orderLabel = this.resolveOrderLabel(
          payload.orderNumber,
          payload.orderId,
        );

        await this.notificationOrchestrator.notifyShipment({
          userId: payload.userId,
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          trackingNumber: payload.trackingNumber ?? null,
          title: 'سفارش شما ارسال شد',
          message: payload.trackingNumber
            ? `سفارش ${orderLabel} ارسال شد. کد رهگیری: ${payload.trackingNumber}`
            : `سفارش ${orderLabel} ارسال شد.`,
          actorId: payload.actorId,
          metadata: {
            event: ShipmentEventType.ORDER_SHIPPED,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
            shippingMethod: payload.shippingMethod ?? null,
            trackingNumber: payload.trackingNumber ?? null,
            shippedAt: payload.shippedAt,
          },
        });

        await this.analyticsOrchestrator.record({
          name: 'shipment.order_shipped',
          description: 'Order was shipped',
          category: 'shipment',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            orderId: payload.orderId,
            orderNumber: payload.orderNumber,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
            shippingMethod: payload.shippingMethod ?? null,
            trackingNumber: payload.trackingNumber ?? null,
            shippedAt: payload.shippedAt,
          },
        });

        this.cacheOrchestrator.invalidateOrderCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(ShipmentEventType.TRACKING_UPDATED)
  async onTrackingUpdated(
    payload: ShipmentTrackingUpdatedEventPayload,
  ): Promise<void> {
    await this.safeHandle(
      ShipmentEventType.TRACKING_UPDATED,
      payload.orderId,
      async () => {
        const orderLabel = this.resolveOrderLabel(
          payload.orderNumber,
          payload.orderId,
        );

        await this.notificationOrchestrator.notifyShipment({
          userId: payload.userId,
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          trackingNumber: payload.currentTrackingNumber ?? null,
          title: 'اطلاعات ارسال به‌روزرسانی شد',
          message: payload.currentTrackingNumber
            ? `کد رهگیری سفارش ${orderLabel} به‌روزرسانی شد: ${payload.currentTrackingNumber}`
            : `اطلاعات ارسال سفارش ${orderLabel} به‌روزرسانی شد.`,
          actorId: payload.actorId,
          metadata: {
            event: ShipmentEventType.TRACKING_UPDATED,
            previousShippingMethod: payload.previousShippingMethod ?? null,
            currentShippingMethod: payload.currentShippingMethod ?? null,
            previousTrackingNumber: payload.previousTrackingNumber ?? null,
            currentTrackingNumber: payload.currentTrackingNumber ?? null,
          },
        });

        await this.analyticsOrchestrator.record({
          name: 'shipment.tracking_updated',
          description: 'Shipment tracking was updated',
          category: 'shipment',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            orderId: payload.orderId,
            orderNumber: payload.orderNumber,
            previousShippingMethod: payload.previousShippingMethod ?? null,
            currentShippingMethod: payload.currentShippingMethod ?? null,
            previousTrackingNumber: payload.previousTrackingNumber ?? null,
            currentTrackingNumber: payload.currentTrackingNumber ?? null,
          },
        });

        this.cacheOrchestrator.invalidateOrderCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(ShipmentEventType.ORDER_DELIVERED)
  async onOrderDelivered(payload: OrderDeliveredEventPayload): Promise<void> {
    await this.safeHandle(
      ShipmentEventType.ORDER_DELIVERED,
      payload.orderId,
      async () => {
        const orderLabel = this.resolveOrderLabel(
          payload.orderNumber,
          payload.orderId,
        );

        await this.notificationOrchestrator.notifyShipment({
          userId: payload.userId,
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          title: 'سفارش شما تحویل داده شد',
          message: `سفارش ${orderLabel} با موفقیت تحویل داده شد.`,
          actorId: payload.actorId,
          metadata: {
            event: ShipmentEventType.ORDER_DELIVERED,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
            deliveredAt: payload.deliveredAt,
          },
        });

        await this.analyticsOrchestrator.record({
          name: 'shipment.order_delivered',
          description: 'Order was delivered',
          category: 'shipment',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            orderId: payload.orderId,
            orderNumber: payload.orderNumber,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
            deliveredAt: payload.deliveredAt,
          },
        });

        this.cacheOrchestrator.invalidateOrderCache(
          payload.userId,
          payload.actorId,
        );
      },
    );
  }

  @OnEvent(ShipmentEventType.SHIPMENT_CANCELLED)
  async onShipmentCancelled(
    payload: ShipmentCancelledEventPayload,
  ): Promise<void> {
    await this.safeHandle(
      ShipmentEventType.SHIPMENT_CANCELLED,
      payload.orderId,
      async () => {
        const orderLabel = this.resolveOrderLabel(
          payload.orderNumber,
          payload.orderId,
        );

        await this.notificationOrchestrator.notifyShipment({
          userId: payload.userId,
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          title: 'ارسال سفارش لغو شد',
          message: `ارسال سفارش ${orderLabel} لغو شد.`,
          actorId: payload.actorId,
          metadata: {
            event: ShipmentEventType.SHIPMENT_CANCELLED,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
            reason: payload.reason ?? null,
          },
        });

        await this.analyticsOrchestrator.record({
          name: 'shipment.cancelled',
          description: 'Shipment was cancelled',
          category: 'shipment',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            orderId: payload.orderId,
            orderNumber: payload.orderNumber,
            previousStatus: payload.previousStatus,
            currentStatus: payload.currentStatus,
            reason: payload.reason ?? null,
          },
        });

        this.cacheOrchestrator.invalidateOrderCache(
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
        `پردازش integration ارسال سفارش ناموفق بود: ${eventType} ${entityId ?? ''}`.trim(),
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private resolveOrderLabel(
    orderNumber: string | null | undefined,
    orderId: string,
  ): string {
    return (
      this.normalizeOptionalString(orderNumber) ??
      this.normalizeOptionalString(orderId) ??
      'شما'
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
