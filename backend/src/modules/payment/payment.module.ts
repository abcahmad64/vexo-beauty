import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

import { CoreQueueModule } from '../../core/queue/queue.module';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { NotificationModule } from '../notification/notification.module';

import { ZarinpalGateway } from './gateways/zarinpal.gateway';

import { PaymentController } from './payment.controller';

import { PaymentGatewayController } from './payment-gateway.controller';

import { PaymentEventHandler } from './events/payment.event.handler';

import { PaymentEventPublisher } from './events/payment.event.publisher';

import { PaymentGatewayService } from './services/payment-gateway.service';

import { PaymentService } from './services/payment.service';

@Module({
  imports: [ConfigModule, PrismaModule, CoreQueueModule, NotificationModule],
  controllers: [PaymentController, PaymentGatewayController],
  providers: [
    PaymentService,
    PaymentGatewayService,
    ZarinpalGateway,
    PaymentEventPublisher,
    PaymentEventHandler,
  ],
  exports: [PaymentService, PaymentGatewayService, PaymentEventPublisher],
})
export class PaymentModule {}
