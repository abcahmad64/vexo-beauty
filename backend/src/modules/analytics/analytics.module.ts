import { Module } from '@nestjs/common';

import { CoreQueueModule } from '../../core/queue/queue.module';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { AnalyticsController } from './analytics.controller';

import { AnalyticsQueueProcessor } from './processors/analytics-queue.processor';

import { AnalyticsService } from './services/analytics.service';

import { AnalyticsEventPublisher } from './events/analytics.event.publisher';

import { AnalyticsEventHandler } from './events/analytics.event.handler';

@Module({
  imports: [PrismaModule, CoreQueueModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsEventPublisher,
    AnalyticsEventHandler,
    AnalyticsQueueProcessor,
  ],
  exports: [AnalyticsService, AnalyticsEventPublisher],
})
export class AnalyticsModule {}
