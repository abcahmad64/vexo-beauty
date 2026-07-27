import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { NotificationModule } from '../notification/notification.module';

import { AuditController } from './audit.controller';

import { AuditExportService } from './services/audit-export.service';

import { AuditSecurityAlertService } from './services/audit-security-alert.service';

import { AuditService } from './services/audit.service';

import { AuditSummaryService } from './services/audit-summary.service';

import { AuditEventPublisher } from './events/audit.event.publisher';

import { AuditEventHandler } from './events/audit.event.handler';

import { AuditSecurityAlertEventHandler } from './integrations/audit-security-alert.event.handler';

import { OrderAuditEventHandler } from './integrations/order-audit.event.handler';

import { PaymentAuditEventHandler } from './integrations/payment-audit.event.handler';

import { RefundAuditEventHandler } from './integrations/refund-audit.event.handler';

import { ShipmentAuditEventHandler } from './integrations/shipment-audit.event.handler';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditSummaryService,
    AuditExportService,
    AuditSecurityAlertService,
    AuditEventPublisher,
    AuditEventHandler,
    AuditSecurityAlertEventHandler,
    OrderAuditEventHandler,
    PaymentAuditEventHandler,
    RefundAuditEventHandler,
    ShipmentAuditEventHandler,
  ],
  exports: [
    AuditService,
    AuditSummaryService,
    AuditExportService,
    AuditSecurityAlertService,
    AuditEventPublisher,
  ],
})
export class AuditModule {}
