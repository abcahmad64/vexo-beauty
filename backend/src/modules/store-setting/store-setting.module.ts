import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';
import { StoreSettingAdminController } from './store-setting-admin.controller';
import { StoreSettingPublicController } from './store-setting-public.controller';
import { AdminStoreSettingExportService } from './services/admin-store-setting-export.service';
import { AdminStoreSettingService } from './services/admin-store-setting.service';

@Module({
  imports: [PrismaModule],
  controllers: [StoreSettingAdminController, StoreSettingPublicController],
  providers: [AdminStoreSettingService, AdminStoreSettingExportService],
  exports: [AdminStoreSettingService, AdminStoreSettingExportService],
})
export class StoreSettingModule {}
