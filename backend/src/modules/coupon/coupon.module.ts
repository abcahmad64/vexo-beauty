import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { AiModule } from '../ai/ai.module';

import { CouponAdminController } from './coupon-admin.controller';

import { CouponController } from './coupon.controller';

import { CouponEventHandler } from './events/coupon.event.handler';

import { CouponEventPublisher } from './events/coupon.event.publisher';

import { AdminCouponAiService } from './services/admin-coupon-ai.service';

import { AdminCouponExportService } from './services/admin-coupon-export.service';

import { AdminCouponService } from './services/admin-coupon.service';

import { CouponService } from './services/coupon.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [CouponController, CouponAdminController],
  providers: [
    CouponService,
    AdminCouponService,
    AdminCouponAiService,
    AdminCouponExportService,
    CouponEventPublisher,
    CouponEventHandler,
  ],
  exports: [
    CouponService,
    AdminCouponService,
    AdminCouponAiService,
    AdminCouponExportService,
    CouponEventPublisher,
  ],
})
export class CouponModule {}
