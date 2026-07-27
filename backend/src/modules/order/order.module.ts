import { Module } from '@nestjs/common';

import { CoreQueueModule } from '../../core/queue/queue.module';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { NotificationModule } from '../notification/notification.module';

import { OrderAdminController } from './order-admin.controller';

import { OrderController } from './order.controller';

import { OrderEventHandler } from './events/order.event.handler';

import { OrderEventPublisher } from './events/order.event.publisher';

import { OrderQueueProcessor } from './processors/order-queue.processor';

import { AdminOrderService } from './services/admin-order.service';

import { OrderOrchestrationService } from './services/order-orchestration.service';

import { OrderService } from './services/order.service';

@Module({
  imports: [PrismaModule, CoreQueueModule, NotificationModule],
  controllers: [OrderController, OrderAdminController],
  providers: [
    OrderService,
    AdminOrderService,
    OrderOrchestrationService,
    OrderEventPublisher,
    OrderEventHandler,
    OrderQueueProcessor,
  ],
  exports: [
    OrderService,
    AdminOrderService,
    OrderOrchestrationService,
    OrderEventPublisher,
  ],
})
export class OrderModule {}
