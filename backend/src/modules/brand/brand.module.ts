import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { RbacModule } from '../rbac/rbac.module';

import { BrandAdminController } from './brand-admin.controller';

import { BrandController } from './brand.controller';

import { BrandEventHandler } from './events/brand.event.handler';

import { BrandEventPublisher } from './events/brand.event.publisher';

import { AdminBrandService } from './services/admin-brand.service';

import { BrandService } from './services/brand.service';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [BrandController, BrandAdminController],
  providers: [
    BrandService,
    AdminBrandService,
    BrandEventPublisher,
    BrandEventHandler,
  ],
  exports: [BrandService, AdminBrandService, BrandEventPublisher],
})
export class BrandModule {}
