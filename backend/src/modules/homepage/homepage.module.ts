import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { HomeSectionAdminController } from './home-section-admin.controller';

import { AdminHomeSectionService } from './services/admin-home-section.service';

@Module({
  imports: [PrismaModule],
  controllers: [HomeSectionAdminController],
  providers: [AdminHomeSectionService],
  exports: [AdminHomeSectionService],
})
export class HomepageModule {}
