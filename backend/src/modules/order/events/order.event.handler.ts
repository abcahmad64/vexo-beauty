import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { QueueProducerService } from '../../../core/queue/services/queue-producer.service';

import {
  OrderCancelledEventPayload,
  OrderCreatedEventPayload,
  OrderDeletedEventPayload,
  OrderStatusChangedEventPayload,
  OrderStockCommittedEventPayload,
  OrderStockReleasedEventPayload,
  OrderStockReservedEventPayload,
  OrderUpdatedEventPayload,
} from './order.event.payloads';

import { OrderEventType } from './order.event.types';

@Injectable()
export class OrderEventHandler {
  private readonly logger = new Logger(OrderEventHandler.name);

  constructor(private readonly queueProducerService: QueueProducerService) {}

  @OnEvent(OrderEventType.CREATED)
  async handleCreated(payload: OrderCreatedEventPayload): Promise<void> {
    this.logger.log(
      `Order created: ${payload.orderNumber}; total=${payload.totalAmount} ${payload.currency}`,
    );

    await this.enqueuePostCreated(payload);
  }

  @OnEvent(OrderEventType.UPDATED)
  handleUpdated(payload: OrderUpdatedEventPayload): void {
    this.logger.log(
      `Order updated: ${payload.orderNumber}; fields=${payload.changedFields.join(', ')}`,
    );
  }

  @OnEvent(OrderEventType.STATUS_CHANGED)
  handleStatusChanged(payload: OrderStatusChangedEventPayload): void {
    this.logger.log(
      `Order status changed: ${payload.orderNumber}; ${payload.previousStatus} -> ${payload.currentStatus}`,
    );
  }

  @OnEvent(OrderEventType.CANCELLED)
  handleCancelled(payload: OrderCancelledEventPayload): void {
    this.logger.warn(
      `Order cancelled: ${payload.orderNumber}; previous=${payload.previousStatus}`,
    );
  }

  @OnEvent(OrderEventType.DELETED)
  handleDeleted(payload: OrderDeletedEventPayload): void {
    this.logger.warn(`Order soft deleted: ${payload.orderNumber}`);
  }

  @OnEvent(OrderEventType.STOCK_RESERVED)
  handleStockReserved(payload: OrderStockReservedEventPayload): void {
    this.logger.log(
      `Order stock reserved: ${payload.orderNumber}; items=${payload.itemsCount}`,
    );
  }

  @OnEvent(OrderEventType.STOCK_RELEASED)
  handleStockReleased(payload: OrderStockReleasedEventPayload): void {
    this.logger.log(
      `Order stock released: ${payload.orderNumber}; items=${payload.itemsCount}`,
    );
  }

  @OnEvent(OrderEventType.STOCK_COMMITTED)
  handleStockCommitted(payload: OrderStockCommittedEventPayload): void {
    this.logger.log(
      `Order stock committed: ${payload.orderNumber}; items=${payload.itemsCount}`,
    );
  }

  private async enqueuePostCreated(
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
        metadata: {
          actorId: payload.actorId,
          source: 'order.created',
          correlationId: payload.orderId,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }
}
