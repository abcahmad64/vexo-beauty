import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { AiAdminController } from './ai-admin.controller';

import { AdminAiExportService } from './services/admin-ai-export.service';

import { AdminAiService } from './services/admin-ai.service';

@Module({
  imports: [PrismaModule],
  controllers: [AiAdminController],
  providers: [AdminAiService, AdminAiExportService],
  exports: [AdminAiService, AdminAiExportService],
})
export class AiAdminModule {}
