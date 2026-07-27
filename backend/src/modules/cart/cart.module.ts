import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { CartController } from './cart.controller';

import { CartEventHandler } from './events/cart.event.handler';

import { CartEventPublisher } from './events/cart.event.publisher';

import { CartService } from './services/cart.service';

@Module({
  imports: [PrismaModule],
  controllers: [CartController],
  providers: [CartService, CartEventPublisher, CartEventHandler],
  exports: [CartService, CartEventPublisher],
})
export class CartModule {}
