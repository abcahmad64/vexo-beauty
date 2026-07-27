import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { NotificationModule } from '../notification/notification.module';

import { RefundAdminController } from './refund-admin.controller';

import { RefundController } from './refund.controller';

import { RefundEventHandler } from './events/refund.event.handler';

import { RefundEventPublisher } from './events/refund.event.publisher';

import { AdminRefundExportService } from './services/admin-refund-export.service';

import { AdminRefundService } from './services/admin-refund.service';

import { RefundDecisionService } from './services/refund-decision.service';

import { RefundInventoryService } from './services/refund-inventory.service';

import { RefundRequestService } from './services/refund-request.service';

import { RefundService } from './services/refund.service';

import { RefundSummaryService } from './services/refund-summary.service';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [RefundController, RefundAdminController],
  providers: [
    RefundService,
    RefundRequestService,
    RefundDecisionService,
    RefundInventoryService,
    RefundSummaryService,
    AdminRefundService,
    AdminRefundExportService,
    RefundEventPublisher,
    RefundEventHandler,
  ],
  exports: [
    RefundService,
    RefundRequestService,
    RefundDecisionService,
    RefundInventoryService,
    RefundSummaryService,
    AdminRefundService,
    AdminRefundExportService,
    RefundEventPublisher,
  ],
})
export class RefundModule {}
