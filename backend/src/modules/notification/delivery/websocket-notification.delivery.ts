import { Injectable } from '@nestjs/common';

import { NotificationGateway } from '../realtime/notification.gateway';

import { NotificationDeliveryChannel } from './notification-delivery.channel';

import { NotificationDeliveryPort } from './notification-delivery.port';

import {
  NotificationDeliveryPayload,
  NotificationDeliveryResult,
} from './notification-delivery.types';

@Injectable()
export class WebsocketNotificationDelivery implements NotificationDeliveryPort {
  readonly channel = NotificationDeliveryChannel.WEBSOCKET;

  constructor(private readonly notificationGateway: NotificationGateway) {}

  deliver(
    payload: NotificationDeliveryPayload,
  ): Promise<NotificationDeliveryResult> {
    return Promise.resolve().then(() => {
      const deliveredConnections =
        this.notificationGateway.emitNotificationToUser(payload.userId, {
          notificationId: payload.notificationId,
          userId: payload.userId,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          metadata: payload.metadata ?? null,
          actorId: payload.actorId,
          occurredAt: payload.occurredAt.toISOString(),
        });

      return {
        channel: this.channel,
        delivered: deliveredConnections > 0,
        provider: 'socket.io',
        messageId: payload.notificationId,
        error:
          deliveredConnections > 0
            ? null
            : 'کاربر در حال حاضر اتصال WebSocket فعال ندارد.',
      };
    });
  }
}
