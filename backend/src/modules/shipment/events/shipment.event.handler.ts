import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { NotificationService } from '../../notification/services/notification.service';

import { ShipmentEventType } from './shipment.event.types';

import {
  OrderDeliveredEventPayload,
  OrderShippedEventPayload,
  ShipmentCancelledEventPayload,
  ShipmentCreatedEventPayload,
  ShipmentTrackingUpdatedEventPayload,
  ShipmentUpdatedEventPayload,
} from './shipment.event.payloads';

@Injectable()
export class ShipmentEventHandler {
  private readonly logger = new Logger(ShipmentEventHandler.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent(ShipmentEventType.SHIPMENT_CREATED)
  async handleShipmentCreated(
    payload: ShipmentCreatedEventPayload,
  ): Promise<void> {
    this.logger.log(`Shipment created for order ${payload.orderNumber}`);

    await this.notifyUser({
      userId: payload.userId,
      title: 'ارسال سفارش در حال آماده‌سازی است',
      message: `فرآیند آماده‌سازی ارسال سفارش ${payload.orderNumber} آغاز شد.`,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      actorId: payload.actorId,
      notifyCustomer: payload.notifyCustomer,
      metadata: {
        shippingMethod: payload.shippingMethod,
        trackingNumber: payload.trackingNumber,
        status: payload.status,
        source: ShipmentEventType.SHIPMENT_CREATED,
      },
    });
  }

  @OnEvent(ShipmentEventType.SHIPMENT_UPDATED)
  handleShipmentUpdated(payload: ShipmentUpdatedEventPayload): void {
    this.logger.log(`Shipment updated for order ${payload.orderNumber}`);
  }

  @OnEvent(ShipmentEventType.ORDER_SHIPPED)
  async handleOrderShipped(payload: OrderShippedEventPayload): Promise<void> {
    this.logger.log(
      `Order shipped: ${payload.orderNumber}; tracking=${payload.trackingNumber ?? 'N/A'}`,
    );

    const trackingText = payload.trackingNumber
      ? ` کد رهگیری: ${payload.trackingNumber}`
      : '';

    await this.notifyUser({
      userId: payload.userId,
      title: 'سفارش شما ارسال شد',
      message: `سفارش ${payload.orderNumber} ارسال شد.${trackingText}`,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      actorId: payload.actorId,
      notifyCustomer: payload.notifyCustomer,
      metadata: {
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        shippingMethod: payload.shippingMethod,
        trackingNumber: payload.trackingNumber,
        shippedAt: payload.shippedAt.toISOString(),
        source: ShipmentEventType.ORDER_SHIPPED,
      },
    });
  }

  @OnEvent(ShipmentEventType.TRACKING_UPDATED)
  async handleTrackingUpdated(
    payload: ShipmentTrackingUpdatedEventPayload,
  ): Promise<void> {
    this.logger.log(
      `Shipment tracking updated for order ${payload.orderNumber}`,
    );

    await this.notifyUser({
      userId: payload.userId,
      title: 'اطلاعات رهگیری سفارش به‌روزرسانی شد',
      message: `اطلاعات ارسال سفارش ${payload.orderNumber} به‌روزرسانی شد.`,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      actorId: payload.actorId,
      notifyCustomer: payload.notifyCustomer,
      metadata: {
        previousShippingMethod: payload.previousShippingMethod,
        currentShippingMethod: payload.currentShippingMethod,
        previousTrackingNumber: payload.previousTrackingNumber,
        currentTrackingNumber: payload.currentTrackingNumber,
        source: ShipmentEventType.TRACKING_UPDATED,
      },
    });
  }

  @OnEvent(ShipmentEventType.ORDER_DELIVERED)
  async handleOrderDelivered(
    payload: OrderDeliveredEventPayload,
  ): Promise<void> {
    this.logger.log(`Order delivered: ${payload.orderNumber}`);

    await this.notifyUser({
      userId: payload.userId,
      title: 'سفارش شما تحویل داده شد',
      message: `سفارش ${payload.orderNumber} با موفقیت تحویل داده شد.`,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      actorId: payload.actorId,
      notifyCustomer: payload.notifyCustomer,
      metadata: {
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        deliveredAt: payload.deliveredAt.toISOString(),
        source: ShipmentEventType.ORDER_DELIVERED,
      },
    });
  }

  @OnEvent(ShipmentEventType.SHIPMENT_CANCELLED)
  async handleShipmentCancelled(
    payload: ShipmentCancelledEventPayload,
  ): Promise<void> {
    this.logger.warn(`Shipment cancelled for order ${payload.orderNumber}`);

    await this.notifyUser({
      userId: payload.userId,
      title: 'ارسال سفارش لغو شد',
      message: payload.reason ?? `ارسال سفارش ${payload.orderNumber} لغو شد.`,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      actorId: payload.actorId,
      notifyCustomer: payload.notifyCustomer,
      metadata: {
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        reason: payload.reason,
        source: ShipmentEventType.SHIPMENT_CANCELLED,
      },
    });
  }

  private async notifyUser(input: {
    userId: string;
    title: string;
    message: string;
    orderId: string;
    orderNumber: string;
    actorId?: string;
    notifyCustomer?: boolean;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    if (input.notifyCustomer === false) {
      this.logger.debug(
        `Customer shipment notification suppressed for order ${input.orderNumber}.`,
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
          actionUrl: `/account/post-purchase/shipments/${input.orderId}`,
          channels: ['database', 'websocket', 'push'],
          saveToDatabase: true,
          metadata: {
            ...input.metadata,
            orderId: input.orderId,
            orderNumber: input.orderNumber,
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
