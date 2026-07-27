import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { AiModule } from '../ai/ai.module';

import { ReportAdminController } from './report-admin.controller';

import { AdminReportExportService } from './services/admin-report-export.service';

import { AdminReportAiService } from './services/admin-report-ai.service';

import { AdminMarketingAiService } from './services/admin-marketing-ai.service';

import { AdminReportService } from './services/admin-report.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [ReportAdminController],
  providers: [
    AdminReportService,
    AdminReportExportService,
    AdminReportAiService,
    AdminMarketingAiService,
  ],
  exports: [
    AdminReportService,
    AdminReportExportService,
    AdminReportAiService,
    AdminMarketingAiService,
  ],
})
export class ReportModule {}
