import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { ReviewController } from './review.controller';

import { ReviewEventHandler } from './events/review.event.handler';

import { ReviewEventPublisher } from './events/review.event.publisher';

import { ReviewService } from './services/review.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReviewController],
  providers: [ReviewService, ReviewEventPublisher, ReviewEventHandler],
  exports: [ReviewService, ReviewEventPublisher],
})
export class ReviewModule {}
