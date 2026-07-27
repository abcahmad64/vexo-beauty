import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { WishlistController } from './wishlist.controller';

import { WishlistEventHandler } from './events/wishlist.event.handler';

import { WishlistEventPublisher } from './events/wishlist.event.publisher';

import { WishlistService } from './services/wishlist.service';

@Module({
  imports: [PrismaModule],
  controllers: [WishlistController],
  providers: [WishlistService, WishlistEventPublisher, WishlistEventHandler],
  exports: [WishlistService, WishlistEventPublisher],
})
export class WishlistModule {}
