import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { SearchAdminController } from './search-admin.controller';

import { AdminSearchExportService } from './services/admin-search-export.service';

import { AdminSearchService } from './services/admin-search.service';

@Module({
  imports: [PrismaModule],
  controllers: [SearchAdminController],
  providers: [AdminSearchService, AdminSearchExportService],
  exports: [AdminSearchService, AdminSearchExportService],
})
export class SearchAdminModule {}
