import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { AiModule } from '../ai/ai.module';

import { SupportAdminController } from './support-admin.controller';

import { SupportController } from './support.controller';

import { SupportAiAdminController } from './support-ai-admin.controller';

import { AdminSupportExportService } from './services/admin-support-export.service';

import { AdminSupportService } from './services/admin-support.service';

import { CustomerSupportService } from './services/customer-support.service';

import { AdminSupportAiService } from './services/admin-support-ai.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [
    SupportController,
    SupportAdminController,
    SupportAiAdminController,
  ],
  providers: [
    CustomerSupportService,
    AdminSupportService,
    AdminSupportExportService,
    AdminSupportAiService,
  ],
  exports: [
    CustomerSupportService,
    AdminSupportService,
    AdminSupportExportService,
    AdminSupportAiService,
  ],
})
export class SupportModule {}
