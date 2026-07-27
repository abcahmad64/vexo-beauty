import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { Request } from 'express';

import { ApplyCouponDto } from './dto/apply-coupon.dto';

import { CreateCouponDto } from './dto/create-coupon.dto';

import { QueryCouponDto } from './dto/query-coupon.dto';

import { UpdateCouponDto } from './dto/update-coupon.dto';

import { ValidateCouponDto } from './dto/validate-coupon.dto';

import { CouponService } from './services/coupon.service';

type OptionalAuthenticatedRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
    role?:
      | string
      | {
          name?: string;
        };
    roleName?: string;
    permissions?: string[];
  };
};

@Controller('coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Post('validate')
  validateCoupon(
    @Req() req: OptionalAuthenticatedRequest,
    @Body() dto: ValidateCouponDto,
  ) {
    return this.couponService.validate(dto, this.getOptionalUserId(req));
  }

  @Post('apply')
  applyCouponPreview(
    @Req() req: OptionalAuthenticatedRequest,
    @Body() dto: ApplyCouponDto,
  ) {
    return this.couponService.applyPreview(dto, this.getOptionalUserId(req));
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('admin')
  create(
    @Req() req: OptionalAuthenticatedRequest,
    @Body() dto: CreateCouponDto,
  ) {
    this.assertCouponManager(req);

    return this.couponService.create(dto, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin')
  findAllForAdmin(
    @Req() req: OptionalAuthenticatedRequest,
    @Query() query: QueryCouponDto,
  ) {
    this.assertCouponReader(req);

    return this.couponService.findAllForAdmin(query);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/code/:code')
  findByCodeForAdmin(
    @Req() req: OptionalAuthenticatedRequest,
    @Param('code') code: string,
  ) {
    this.assertCouponReader(req);

    return this.couponService.findByCodeForAdmin(code);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/:couponId')
  findOneForAdmin(
    @Req() req: OptionalAuthenticatedRequest,
    @Param('couponId') couponId: string,
  ) {
    this.assertCouponReader(req);

    return this.couponService.findOneForAdmin(couponId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:couponId')
  update(
    @Req() req: OptionalAuthenticatedRequest,
    @Param('couponId') couponId: string,
    @Body() dto: UpdateCouponDto,
  ) {
    this.assertCouponManager(req);

    return this.couponService.update(couponId, dto, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:couponId/activate')
  activate(
    @Req() req: OptionalAuthenticatedRequest,
    @Param('couponId') couponId: string,
  ) {
    this.assertCouponManager(req);

    return this.couponService.activate(couponId, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:couponId/deactivate')
  deactivate(
    @Req() req: OptionalAuthenticatedRequest,
    @Param('couponId') couponId: string,
  ) {
    this.assertCouponManager(req);

    return this.couponService.deactivate(couponId, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:couponId/expire')
  expire(
    @Req() req: OptionalAuthenticatedRequest,
    @Param('couponId') couponId: string,
  ) {
    this.assertCouponManager(req);

    return this.couponService.expire(couponId, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('admin/:couponId')
  remove(
    @Req() req: OptionalAuthenticatedRequest,
    @Param('couponId') couponId: string,
  ) {
    this.assertCouponManager(req);

    return this.couponService.remove(couponId, this.getUserId(req));
  }

  private getOptionalUserId(
    req: OptionalAuthenticatedRequest,
  ): string | undefined {
    return req.user?.id ?? req.user?.userId ?? req.user?.sub;
  }

  private getUserId(req: OptionalAuthenticatedRequest): string {
    const userId = this.getOptionalUserId(req);

    if (!userId) {
      throw new UnauthorizedException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertCouponReader(req: OptionalAuthenticatedRequest): void {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName);

    const normalizedRole = role?.toUpperCase();

    const permissions = new Set(req.user?.permissions ?? []);

    const allowed =
      normalizedRole === 'ADMIN' ||
      normalizedRole === 'SUPER_ADMIN' ||
      permissions.has('coupon:read') ||
      permissions.has('coupon:manage') ||
      permissions.has('coupons:read') ||
      permissions.has('coupons:manage') ||
      permissions.has('marketing:read') ||
      permissions.has('marketing:manage');

    if (!allowed) {
      throw new ForbiddenException('شما اجازه مشاهده کدهای تخفیف را ندارید.');
    }
  }

  private assertCouponManager(req: OptionalAuthenticatedRequest): void {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName);

    const normalizedRole = role?.toUpperCase();

    const permissions = new Set(req.user?.permissions ?? []);

    const allowed =
      normalizedRole === 'ADMIN' ||
      normalizedRole === 'SUPER_ADMIN' ||
      permissions.has('coupon:manage') ||
      permissions.has('coupons:manage') ||
      permissions.has('marketing:manage');

    if (!allowed) {
      throw new ForbiddenException('شما اجازه مدیریت کدهای تخفیف را ندارید.');
    }
  }
}
