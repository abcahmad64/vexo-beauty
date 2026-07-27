import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { WarehouseAdminController } from './warehouse-admin.controller';

import { AdminWarehouseService } from './services/admin-warehouse.service';

@Module({
  imports: [PrismaModule],
  controllers: [WarehouseAdminController],
  providers: [AdminWarehouseService],
  exports: [AdminWarehouseService],
})
export class WarehouseModule {}
