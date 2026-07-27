import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { NotificationModule } from '../notification/notification.module';

import { ShipmentAdminController } from './shipment-admin.controller';

import { ShipmentController } from './shipment.controller';

import { ShipmentEventHandler } from './events/shipment.event.handler';

import { ShipmentEventPublisher } from './events/shipment.event.publisher';

import { AdminShipmentExportService } from './services/admin-shipment-export.service';

import { AdminShipmentService } from './services/admin-shipment.service';

import { ShipmentService } from './services/shipment.service';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [ShipmentController, ShipmentAdminController],
  providers: [
    ShipmentService,
    AdminShipmentService,
    AdminShipmentExportService,
    ShipmentEventPublisher,
    ShipmentEventHandler,
  ],
  exports: [
    ShipmentService,
    AdminShipmentService,
    AdminShipmentExportService,
    ShipmentEventPublisher,
  ],
})
export class ShipmentModule {}
