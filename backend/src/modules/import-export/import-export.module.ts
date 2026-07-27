import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { ImportExportAdminController } from './import-export-admin.controller';

import { AdminImportExportService } from './services/admin-import-export.service';

@Module({
  imports: [PrismaModule],
  controllers: [ImportExportAdminController],
  providers: [AdminImportExportService],
  exports: [AdminImportExportService],
})
export class ImportExportModule {}
