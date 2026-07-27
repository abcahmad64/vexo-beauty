import { Injectable, Logger } from '@nestjs/common';

import { DatabaseNotificationDelivery } from './database-notification.delivery';

import { EmailNotificationDelivery } from './email-notification.delivery';

import { NotificationDeliveryChannel } from './notification-delivery.channel';

import { NotificationDeliveryPort } from './notification-delivery.port';

import {
  NotificationDeliveryPayload,
  NotificationDeliveryResult,
} from './notification-delivery.types';

import { PushNotificationDelivery } from './push-notification.delivery';

import { SmsNotificationDelivery } from './sms-notification.delivery';

import { WebsocketNotificationDelivery } from './websocket-notification.delivery';

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  private readonly drivers = new Map<
    NotificationDeliveryChannel,
    NotificationDeliveryPort
  >();

  constructor(
    databaseDelivery: DatabaseNotificationDelivery,
    websocketDelivery: WebsocketNotificationDelivery,
    pushDelivery: PushNotificationDelivery,
    emailDelivery: EmailNotificationDelivery,
    smsDelivery: SmsNotificationDelivery,
  ) {
    [
      databaseDelivery,
      websocketDelivery,
      pushDelivery,
      emailDelivery,
      smsDelivery,
    ].forEach((driver) => {
      this.drivers.set(driver.channel, driver);
    });
  }

  async deliver(
    payload: NotificationDeliveryPayload,
  ): Promise<NotificationDeliveryResult> {
    const driver = this.drivers.get(payload.channel);

    if (!driver) {
      return {
        channel: payload.channel,
        delivered: false,
        error: `Unsupported notification channel: ${payload.channel}`,
      };
    }

    try {
      return await driver.deliver(payload);
    } catch (error) {
      this.logger.error(
        `Notification delivery failed: ${payload.channel}:${payload.notificationId}`,
        error instanceof Error ? error.stack : String(error),
      );

      return {
        channel: payload.channel,
        delivered: false,
        provider: driver.channel,
        messageId: payload.notificationId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
