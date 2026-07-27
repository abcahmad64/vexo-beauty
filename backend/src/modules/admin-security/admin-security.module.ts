import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { AdminSecurityController } from './admin-security.controller';

import { AdminSecurityExportService } from './services/admin-security-export.service';

import { AdminSecurityService } from './services/admin-security.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminSecurityController],
  providers: [AdminSecurityService, AdminSecurityExportService],
  exports: [AdminSecurityService, AdminSecurityExportService],
})
export class AdminSecurityModule {}
