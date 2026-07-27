import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

import { JwtModule } from '@nestjs/jwt';

import { CoreQueueModule } from '../../core/queue/queue.module';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { AiModule } from '../ai/ai.module';

import { DatabaseNotificationDelivery } from './delivery/database-notification.delivery';

import { EmailNotificationDelivery } from './delivery/email-notification.delivery';

import { NotificationDeliveryService } from './delivery/notification-delivery.service';

import { PushNotificationDelivery } from './delivery/push-notification.delivery';

import { SmsNotificationDelivery } from './delivery/sms-notification.delivery';

import { WebsocketNotificationDelivery } from './delivery/websocket-notification.delivery';

import { NotificationController } from './notification.controller';

import { NotificationPushSubscriptionController } from './notification-push-subscription.controller';

import { EmailQueueProcessor } from './processors/email-queue.processor';

import { NotificationQueueProcessor } from './processors/notification-queue.processor';

import { SmsQueueProcessor } from './processors/sms-queue.processor';

import { NotificationConnectionRegistry } from './realtime/notification-connection.registry';

import { NotificationGateway } from './realtime/notification.gateway';

import { NotificationDeliveryEventHandler } from './events/notification-delivery.event.handler';

import { NotificationEventHandler } from './events/notification.event.handler';

import { NotificationEventPublisher } from './events/notification.event.publisher';

import { AdminNotificationAiService } from './services/admin-notification-ai.service';

import { NotificationDeliveryOutboxService } from './services/notification-delivery-outbox.service';

import { NotificationService } from './services/notification.service';

import { PushSubscriptionService } from './services/push-subscription.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    PrismaModule,
    CoreQueueModule,
    AiModule,
  ],
  controllers: [NotificationController, NotificationPushSubscriptionController],
  providers: [
    NotificationService,
    AdminNotificationAiService,
    PushSubscriptionService,
    NotificationEventPublisher,
    NotificationEventHandler,
    NotificationDeliveryEventHandler,
    NotificationDeliveryService,
    NotificationDeliveryOutboxService,
    DatabaseNotificationDelivery,
    WebsocketNotificationDelivery,
    PushNotificationDelivery,
    EmailNotificationDelivery,
    SmsNotificationDelivery,
    NotificationConnectionRegistry,
    NotificationGateway,
    NotificationQueueProcessor,
    EmailQueueProcessor,
    SmsQueueProcessor,
  ],
  exports: [
    NotificationService,
    AdminNotificationAiService,
    NotificationEventPublisher,
    NotificationDeliveryService,
    NotificationDeliveryOutboxService,
    EmailNotificationDelivery,
    SmsNotificationDelivery,
    PushNotificationDelivery,
    WebsocketNotificationDelivery,
    NotificationGateway,
  ],
})
export class NotificationModule {}
