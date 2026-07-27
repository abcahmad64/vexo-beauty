import { NotificationDeliveryChannel } from './notification-delivery.channel';

import {
  NotificationDeliveryPayload,
  NotificationDeliveryResult,
} from './notification-delivery.types';

export interface NotificationDeliveryPort {
  readonly channel: NotificationDeliveryChannel;

  deliver(
    payload: NotificationDeliveryPayload,
  ): Promise<NotificationDeliveryResult>;
}
