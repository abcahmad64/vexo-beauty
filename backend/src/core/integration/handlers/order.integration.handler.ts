import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { OrderStatus } from '../../../generated/prisma';
import {
  OrderCancelledEventPayload,
  OrderCreatedEventPayload,
  OrderDeletedEventPayload,
  OrderStatusChangedEventPayload,
  OrderStockCommittedEventPayload,
  OrderStockReleasedEventPayload,
  OrderStockReservedEventPayload,
  OrderUpdatedEventPayload,
} from '../../../modules/order/events/order.event.payloads';
import { OrderEventType } from '../../../modules/order/events/order.event.types';
import { QueueProducerService } from '../../queue/services/queue-producer.service';
import { QueueJobMetadataUtil } from '../../queue/utils/queue-job-metadata.util';
import { AnalyticsOrchestrator } from '../orchestrators/analytics.orchestrator';
import { CacheOrchestrator } from '../orchestrators/cache.orchestrator';
import { NotificationOrchestrator } from '../orchestrators/notification.orchestrator';

type InventoryOrderPayload =
  | OrderStockReservedEventPayload
  | OrderStockReleasedEventPayload
  | OrderStockCommittedEventPayload;

@Injectable()
export class OrderIntegrationHandler {
  private readonly logger = new Logger(OrderIntegrationHandler.name);

  constructor(
    private readonly notificationOrchestrator: NotificationOrchestrator,
    private readonly analyticsOrchestrator: AnalyticsOrchestrator,
    private readonly cacheOrchestrator: CacheOrchestrator,
    private readonly queueProducerService: QueueProducerService,
  ) {}

  @OnEvent(OrderEventType.CREATED)
  async onOrderCreated(payload: OrderCreatedEventPayload): Promise<void> {
    await this.safeHandle(OrderEventType.CREATED, payload.orderId, async () => {
      await this.enqueueOrderPostCreated(payload);

      await this.notificationOrchestrator.notifyOrder({
        userId: payload.userId,
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        title: 'سفارش شما ثبت شد',
        message: `سفارش ${this.resolveOrderLabel(payload.orderNumber, payload.orderId)} با موفقیت ثبت شد و در انتظار بررسی است.`,
        actorId: payload.actorId,
        metadata: {
          event: OrderEventType.CREATED,
          totalAmount: payload.totalAmount,
          currency: payload.currency,
          itemsCount: payload.itemsCount,
        },
      });

      await this.analyticsOrchestrator.record({
        name: 'order.created',
        description: 'Order was created',
        category: 'order',
        userId: payload.userId,
        actorId: payload.actorId,
        data: {
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          totalAmount: payload.totalAmount,
          currency: payload.currency,
          itemsCount: payload.itemsCount,
        },
      });

      this.cacheOrchestrator.invalidateOrderCache(
        payload.userId,
        payload.actorId,
      );
    });
  }

  @OnEvent(OrderEventType.UPDATED)
  async onOrderUpdated(payload: OrderUpdatedEventPayload): Promise<void> {
    await this.safeHandle(OrderEventType.UPDATED, payload.orderId, async () => {
      await this.analyticsOrchestrator.record({
        name: 'order.updated',
        description: 'Order was updated',
        category: 'order',
        userId: payload.userId,
        actorId: payload.actorId,
        data: {
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          changedFields: payload.changedFields,
        },
      });

      this.cacheOrchestrator.invalidateOrderCache(
        payload.userId,
        payload.actorId,
      );
    });
  }

  @OnEvent(OrderEventType.STATUS_CHANGED)
  async onOrderStatusChanged(
    payload: OrderStatusChangedEventPayload,
  ): Promise<void> {
    await this.safeHandle(
      OrderEventType.STATUS_CHANGED,
      payload.orderId,
      async () => {
        if (payload.currentStatus !== OrderStatus.CANCELLED) {
          await this.notificationOrchestrator.notifyOrder({
            userId: payload.userId,
            orderId: payload.orderId,
            orderNumber: payload.orderNumber,
            title: 'وضعیت سفارش تغییر کرد',
            message: `وضعیت سفارش ${this.resolveOrderLabel(payload.orderNumber, payload.orderId)} به «${this.translateOrderStatus(payload.currentStatus)}» تغییر کرد.`,
            actorId: payload.actorId,
            metadata: {
              event: OrderEventType.STATUS_CHANGED,
              previousStatus: payload.previousStatus,
              currentStatus: payload.currentStatus,
              reason: payload.reason ?? null,
            },
          });
        }

        await this.analyticsOrchestrator.record({
          name: 'order.status_changed',
          description: 'Order status was changed',
          category: 'order',
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

  @OnEvent(OrderEventType.CANCELLED)
  async onOrderCancelled(payload: OrderCancelledEventPayload): Promise<void> {
    await this.safeHandle(
      OrderEventType.CANCELLED,
      payload.orderId,
      async () => {
        await this.notificationOrchestrator.notifyOrder({
          userId: payload.userId,
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
          title: 'سفارش شما لغو شد',
          message: `سفارش ${this.resolveOrderLabel(payload.orderNumber, payload.orderId)} لغو شد.`,
          actorId: payload.actorId,
          metadata: {
            event: OrderEventType.CANCELLED,
            previousStatus: payload.previousStatus,
            reason: payload.reason ?? null,
          },
        });

        await this.analyticsOrchestrator.record({
          name: 'order.cancelled',
          description: 'Order was cancelled',
          category: 'order',
          userId: payload.userId,
          actorId: payload.actorId,
          data: {
            orderId: payload.orderId,
            orderNumber: payload.orderNumber,
            previousStatus: payload.previousStatus,
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

  @OnEvent(OrderEventType.DELETED)
  async onOrderDeleted(payload: OrderDeletedEventPayload): Promise<void> {
    await this.safeHandle(OrderEventType.DELETED, payload.orderId, async () => {
      await this.analyticsOrchestrator.record({
        name: 'order.deleted',
        description: 'Order was soft deleted',
        category: 'order',
        userId: payload.userId,
        actorId: payload.actorId,
        data: {
          orderId: payload.orderId,
          orderNumber: payload.orderNumber,
        },
      });

      this.cacheOrchestrator.invalidateOrderCache(
        payload.userId,
        payload.actorId,
      );
    });
  }

  @OnEvent(OrderEventType.STOCK_RESERVED)
  async onStockReserved(
    payload: OrderStockReservedEventPayload,
  ): Promise<void> {
    await this.safeHandle(
      OrderEventType.STOCK_RESERVED,
      payload.orderId,
      async () => {
        await this.recordInventoryEvent(
          'order.stock_reserved',
          'Order stock was reserved',
          payload,
        );

        this.cacheOrchestrator.invalidateProductCache(payload.actorId);
      },
    );
  }

  @OnEvent(OrderEventType.STOCK_RELEASED)
  async onStockReleased(
    payload: OrderStockReleasedEventPayload,
  ): Promise<void> {
    await this.safeHandle(
      OrderEventType.STOCK_RELEASED,
      payload.orderId,
      async () => {
        await this.recordInventoryEvent(
          'order.stock_released',
          'Order reserved stock was released',
          payload,
        );

        this.cacheOrchestrator.invalidateProductCache(payload.actorId);
      },
    );
  }

  @OnEvent(OrderEventType.STOCK_COMMITTED)
  async onStockCommitted(
    payload: OrderStockCommittedEventPayload,
  ): Promise<void> {
    await this.safeHandle(
      OrderEventType.STOCK_COMMITTED,
      payload.orderId,
      async () => {
        await this.recordInventoryEvent(
          'order.stock_committed',
          'Order reserved stock was committed',
          payload,
        );

        this.cacheOrchestrator.invalidateProductCache(payload.actorId);
      },
    );
  }

  private async enqueueOrderPostCreated(
    payload: OrderCreatedEventPayload,
  ): Promise<void> {
    try {
      await this.queueProducerService.enqueueOrderPostCreated({
        orderId: payload.orderId,
        event: OrderEventType.CREATED,
        payload: {
          orderNumber: payload.orderNumber,
          userId: payload.userId,
          totalAmount: payload.totalAmount,
          currency: payload.currency,
          itemsCount: payload.itemsCount,
        },
        metadata: QueueJobMetadataUtil.create({
          actorId: this.normalizeOptionalString(payload.actorId),
          source: 'order-integration.created',
        }),
      });
    } catch (error) {
      this.logger.error(
        `ثبت job پس از ایجاد سفارش ناموفق بود: ${payload.orderId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async recordInventoryEvent(
    name: string,
    description: string,
    payload: InventoryOrderPayload,
  ): Promise<void> {
    await this.analyticsOrchestrator.record({
      name,
      description,
      category: 'inventory',
      userId: payload.userId,
      actorId: payload.actorId,
      data: {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        itemsCount: payload.itemsCount,
      },
    });
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
        `پردازش integration سفارش ناموفق بود: ${eventType} ${entityId ?? ''}`.trim(),
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

  private translateOrderStatus(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: 'در انتظار بررسی',
      [OrderStatus.CONFIRMED]: 'تأیید شده',
      [OrderStatus.PROCESSING]: 'در حال پردازش',
      [OrderStatus.SHIPPED]: 'ارسال شده',
      [OrderStatus.DELIVERED]: 'تحویل داده شده',
      [OrderStatus.CANCELLED]: 'لغو شده',
      [OrderStatus.REFUNDED]: 'مرجوع شده',
    };

    return labels[status] ?? status;
  }
}
