import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { InventoryAdminController } from './inventory-admin.controller';

import { InventoryController } from './inventory.controller';

import { InventoryEventHandler } from './events/inventory.event.handler';

import { InventoryEventPublisher } from './events/inventory.event.publisher';

import { AdminInventoryExportService } from './services/admin-inventory-export.service';

import { AdminInventoryService } from './services/admin-inventory.service';

import { AdminStockAdjustmentService } from './services/admin-stock-adjustment.service';

import { AdminStockTransferService } from './services/admin-stock-transfer.service';

import { InventoryService } from './services/inventory.service';

@Module({
  imports: [PrismaModule],
  controllers: [InventoryController, InventoryAdminController],
  providers: [
    InventoryService,
    AdminInventoryService,
    AdminStockAdjustmentService,
    AdminStockTransferService,
    AdminInventoryExportService,
    InventoryEventPublisher,
    InventoryEventHandler,
  ],
  exports: [
    InventoryService,
    AdminInventoryService,
    AdminStockAdjustmentService,
    AdminStockTransferService,
    AdminInventoryExportService,
    InventoryEventPublisher,
  ],
})
export class InventoryModule {}
