import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { AiModule } from '../ai/ai.module';

import { ContentAdminController } from './content-admin.controller';

import { ContentPublicController } from './content-public.controller';

import { AdminContentExportService } from './services/admin-content-export.service';

import { AdminContentAiService } from './services/admin-content-ai.service';

import { AdminContentService } from './services/admin-content.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [ContentAdminController, ContentPublicController],
  providers: [
    AdminContentService,
    AdminContentExportService,
    AdminContentAiService,
  ],
  exports: [
    AdminContentService,
    AdminContentExportService,
    AdminContentAiService,
  ],
})
export class ContentModule {}
