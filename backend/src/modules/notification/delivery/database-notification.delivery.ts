import { Injectable } from '@nestjs/common';

import { NotificationDeliveryChannel } from './notification-delivery.channel';

import { NotificationDeliveryPort } from './notification-delivery.port';

import {
  NotificationDeliveryPayload,
  NotificationDeliveryResult,
} from './notification-delivery.types';

@Injectable()
export class DatabaseNotificationDelivery implements NotificationDeliveryPort {
  readonly channel = NotificationDeliveryChannel.DATABASE;

  deliver(
    payload: NotificationDeliveryPayload,
  ): Promise<NotificationDeliveryResult> {
    return Promise.resolve().then(() => ({
      channel: this.channel,
      delivered: true,
      provider: 'database',
      messageId: payload.notificationId,
      error: null,
    }));
  }
}
