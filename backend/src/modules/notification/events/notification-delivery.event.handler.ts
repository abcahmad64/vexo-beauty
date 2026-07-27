import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { NotificationDeliveryChannel } from '../delivery/notification-delivery.channel';

import { NotificationDeliveryService } from '../delivery/notification-delivery.service';

import { NotificationSentEventPayload } from './notification.event.payloads';

import { NotificationEventType } from './notification.event.types';

@Injectable()
export class NotificationDeliveryEventHandler {
  private readonly logger = new Logger(NotificationDeliveryEventHandler.name);

  constructor(private readonly deliveryService: NotificationDeliveryService) {}

  @OnEvent(NotificationEventType.NOTIFICATION_SENT)
  async handleNotificationSent(
    payload: NotificationSentEventPayload,
  ): Promise<void> {
    const result = await this.deliveryService.deliver({
      notificationId: payload.notificationId,
      userId: payload.userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      metadata: payload.metadata ?? null,
      actorId: payload.actorId,
      occurredAt: payload.occurredAt,
      channel: payload.channel as NotificationDeliveryChannel,
    });

    if (!result.delivered) {
      this.logger.warn(
        `Notification delivery not completed: ${payload.notificationId}; channel=${payload.channel}; error=${result.error ?? 'unknown'}`,
      );
    }
  }
}
