import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

import { CoreQueueModule } from '../../core/queue/queue.module';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { NotificationModule } from '../notification/notification.module';

import { InvoiceAdminController } from './invoice-admin.controller';

import { InvoiceController } from './invoice.controller';

import { InvoiceEventHandler } from './events/invoice.event.handler';

import { InvoiceEventPublisher } from './events/invoice.event.publisher';

import { InvoiceQueueProcessor } from './processors/invoice-queue.processor';

import { AdminInvoiceExportService } from './services/admin-invoice-export.service';

import { AdminInvoiceService } from './services/admin-invoice.service';

import { InvoicePdfService } from './services/invoice-pdf.service';

import { InvoiceService } from './services/invoice.service';

@Module({
  imports: [ConfigModule, PrismaModule, CoreQueueModule, NotificationModule],
  controllers: [InvoiceController, InvoiceAdminController],
  providers: [
    InvoiceService,
    InvoicePdfService,
    AdminInvoiceService,
    AdminInvoiceExportService,
    InvoiceEventPublisher,
    InvoiceEventHandler,
    InvoiceQueueProcessor,
  ],
  exports: [
    InvoiceService,
    InvoicePdfService,
    AdminInvoiceService,
    AdminInvoiceExportService,
    InvoiceEventPublisher,
  ],
})
export class InvoiceModule {}
