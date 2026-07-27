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
  Res,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Request, Response } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AiPermissionContext } from '../ai/services/ai-permission-guard.service';

import {
  AdminCouponAiCreateDto,
  AdminCouponAiDiscountSuggestDto,
  AdminCouponAiDraftDto,
} from './dto/admin-coupon-ai.dto';

import { AdminCouponExportQueryDto } from './dto/admin-coupon-export-query.dto';

import { AdminCouponNoteDto } from './dto/admin-coupon-note.dto';

import { AdminCreateCouponDto } from './dto/admin-create-coupon.dto';

import { AdminQueryCouponUsageDto } from './dto/admin-query-coupon-usage.dto';

import { AdminQueryCouponDto } from './dto/admin-query-coupon.dto';

import { AdminUpdateCouponStatusDto } from './dto/admin-update-coupon-status.dto';

import { AdminUpdateCouponDto } from './dto/admin-update-coupon.dto';

import { AdminValidateCouponDto } from './dto/admin-validate-coupon.dto';

import { AdminCouponAiService } from './services/admin-coupon-ai.service';

import { AdminCouponExportService } from './services/admin-coupon-export.service';

import { AdminCouponService } from './services/admin-coupon.service';

type RequestUser = {
  id?: string;
  userId?: string;
  sub?: string;
  role?:
    | string
    | {
        name?: string | null;
      };
  roleName?: string | null;
  permissions?: string[];
};

type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

@ApiTags('Coupon Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/coupons')
@UseGuards(JwtAuthGuard)
export class CouponAdminController {
  constructor(
    private readonly adminCouponService: AdminCouponService,
    private readonly adminCouponExportService: AdminCouponExportService,
    private readonly adminCouponAiService: AdminCouponAiService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی کدهای تخفیف',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryCouponDto,
  ) {
    this.assertCouponReader(req);

    return this.adminCouponService.findAll(query);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'دریافت داشبورد مدیریتی کدهای تخفیف',
  })
  getDashboard(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryCouponDto,
  ) {
    this.assertCouponReader(req);

    return this.adminCouponService.getDashboard(query);
  }

  @Get('export')
  @ApiOperation({
    summary: 'خروجی گرفتن از کدهای تخفیف',
  })
  async exportCoupons(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminCouponExportQueryDto,
    @Res() res: Response,
  ) {
    this.assertCouponReader(req);

    const result = await this.adminCouponExportService.exportCoupons(query);

    res.setHeader('Content-Type', result.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return res.send(result.content);
  }

  @Get('usages')
  @ApiOperation({
    summary: 'دریافت مصرف‌های کدهای تخفیف',
  })
  getUsages(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryCouponUsageDto,
  ) {
    this.assertCouponReader(req);

    return this.adminCouponService.getUsages(query);
  }

  @Post('validate')
  @ApiOperation({
    summary: 'اعتبارسنجی مدیریتی کد تخفیف',
  })
  validatePreview(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminValidateCouponDto,
  ) {
    this.assertCouponReader(req);

    return this.adminCouponService.validatePreview(dto);
  }

  @Post('ai/discount-suggestion')
  @ApiOperation({
    summary: 'پیشنهاد تخفیف امن توسط هوش مصنوعی',
  })
  suggestAiDiscount(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCouponAiDiscountSuggestDto,
  ) {
    this.assertCouponReader(req);

    return this.adminCouponAiService.suggestDiscount(
      dto,
      this.toAiPermissionContext(req),
    );
  }

  @Post('ai/coupon-draft')
  @ApiOperation({
    summary: 'تولید پیش‌نویس کوپن هوشمند بدون ساخت واقعی',
  })
  generateAiCouponDraft(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCouponAiDraftDto,
  ) {
    this.assertCouponManager(req);

    return this.adminCouponAiService.generateCouponDraft(
      dto,
      this.toAiPermissionContext(req),
    );
  }

  @Post('ai/coupon-create')
  @ApiOperation({
    summary: 'ساخت کوپن هوشمند فقط پس از تأیید ادمین',
  })
  createAiCouponApproved(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCouponAiCreateDto,
  ) {
    this.assertCouponManager(req);

    return this.adminCouponAiService.createApprovedCoupon(
      dto,
      this.toAiPermissionContext(req),
    );
  }

  @Post()
  @ApiOperation({
    summary: 'ایجاد کد تخفیف توسط ادمین',
  })
  create(@Req() req: AuthenticatedRequest, @Body() dto: AdminCreateCouponDto) {
    this.assertCouponManager(req);

    return this.adminCouponService.create(dto, this.getUserId(req));
  }

  @Get('code/:code')
  @ApiOperation({
    summary: 'دریافت کد تخفیف با کد',
  })
  findByCode(
    @Req() req: AuthenticatedRequest,
    @Param('code') code: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertCouponReader(req);

    return this.adminCouponService.findByCode(
      code,
      this.toBoolean(includeDeleted),
    );
  }

  @Get(':couponId')
  @ApiOperation({
    summary: 'دریافت جزئیات مدیریتی کد تخفیف',
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('couponId') couponId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertCouponReader(req);

    return this.adminCouponService.findOne(
      couponId,
      this.toBoolean(includeDeleted),
    );
  }

  @Get(':couponId/usages')
  @ApiOperation({
    summary: 'دریافت مصرف‌های یک کد تخفیف',
  })
  getCouponUsages(
    @Req() req: AuthenticatedRequest,
    @Param('couponId') couponId: string,
    @Query() query: AdminQueryCouponUsageDto,
  ) {
    this.assertCouponReader(req);

    return this.adminCouponService.getCouponUsages(couponId, query);
  }

  @Get(':couponId/notes')
  @ApiOperation({
    summary: 'دریافت یادداشت‌های مدیریتی کد تخفیف',
  })
  getNotes(
    @Req() req: AuthenticatedRequest,
    @Param('couponId') couponId: string,
    @Query('limit') limit?: string,
  ) {
    this.assertCouponReader(req);

    const parsedLimit = limit ? Number(limit) : 50;

    return this.adminCouponService.getNotes(
      couponId,
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 50,
    );
  }

  @Post(':couponId/notes')
  @ApiOperation({
    summary: 'ثبت یادداشت مدیریتی برای کد تخفیف',
  })
  createNote(
    @Req() req: AuthenticatedRequest,
    @Param('couponId') couponId: string,
    @Body() dto: AdminCouponNoteDto,
  ) {
    this.assertCouponManager(req);

    return this.adminCouponService.createNote(
      couponId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':couponId')
  @ApiOperation({
    summary: 'به‌روزرسانی کد تخفیف',
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('couponId') couponId: string,
    @Body() dto: AdminUpdateCouponDto,
  ) {
    this.assertCouponManager(req);

    return this.adminCouponService.update(couponId, dto, this.getUserId(req));
  }

  @Patch(':couponId/status')
  @ApiOperation({
    summary: 'به‌روزرسانی وضعیت کد تخفیف',
  })
  updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('couponId') couponId: string,
    @Body() dto: AdminUpdateCouponStatusDto,
  ) {
    this.assertCouponManager(req);

    return this.adminCouponService.updateStatus(
      couponId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':couponId/activate')
  @ApiOperation({
    summary: 'فعال‌سازی کد تخفیف',
  })
  activate(
    @Req() req: AuthenticatedRequest,
    @Param('couponId') couponId: string,
  ) {
    this.assertCouponManager(req);

    return this.adminCouponService.activate(couponId, this.getUserId(req));
  }

  @Patch(':couponId/deactivate')
  @ApiOperation({
    summary: 'غیرفعال‌سازی کد تخفیف',
  })
  deactivate(
    @Req() req: AuthenticatedRequest,
    @Param('couponId') couponId: string,
  ) {
    this.assertCouponManager(req);

    return this.adminCouponService.deactivate(couponId, this.getUserId(req));
  }

  @Patch(':couponId/expire')
  @ApiOperation({
    summary: 'منقضی‌کردن کد تخفیف',
  })
  expire(
    @Req() req: AuthenticatedRequest,
    @Param('couponId') couponId: string,
  ) {
    this.assertCouponManager(req);

    return this.adminCouponService.expire(couponId, this.getUserId(req));
  }

  @Patch(':couponId/restore')
  @ApiOperation({
    summary: 'بازگردانی کد تخفیف حذف‌شده',
  })
  restore(
    @Req() req: AuthenticatedRequest,
    @Param('couponId') couponId: string,
  ) {
    this.assertCouponManager(req);

    return this.adminCouponService.restore(couponId, this.getUserId(req));
  }

  @Delete(':couponId')
  @ApiOperation({
    summary: 'حذف نرم کد تخفیف',
  })
  delete(
    @Req() req: AuthenticatedRequest,
    @Param('couponId') couponId: string,
  ) {
    this.assertCouponManager(req);

    return this.adminCouponService.delete(couponId, this.getUserId(req));
  }

  private toAiPermissionContext(
    req: AuthenticatedRequest,
  ): AiPermissionContext {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName ?? undefined);

    return {
      userId: this.getUserId(req),
      role: role ?? undefined,
      permissions: req.user?.permissions ?? [],
    };
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertCouponReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'coupon:*',
        'coupon:read',
        'coupon:manage',
        'coupons:*',
        'coupons:read',
        'coupons:manage',
        'promotion:*',
        'promotion:read',
        'promotion:manage',
        'promotions:*',
        'promotions:read',
        'promotions:manage',
        'catalog:read',
        'catalog:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده مدیریت کدهای تخفیف را ندارید.',
    );
  }

  private assertCouponManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'coupon:*',
        'coupon:manage',
        'coupon:create',
        'coupon:update',
        'coupon:delete',
        'coupons:*',
        'coupons:manage',
        'coupons:create',
        'coupons:update',
        'coupons:delete',
        'promotion:*',
        'promotion:manage',
        'promotions:*',
        'promotions:manage',
        'catalog:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت کدهای تخفیف را ندارید.');
  }

  private hasAdminRole(req: AuthenticatedRequest): boolean {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName ?? null);

    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  }

  private hasAnyPermission(
    req: AuthenticatedRequest,
    permissions: string[],
  ): boolean {
    const userPermissions = req.user?.permissions ?? [];

    return permissions.some((requiredPermission) =>
      this.permissionMatches(userPermissions, requiredPermission),
    );
  }

  private permissionMatches(
    userPermissions: string[],
    requiredPermission: string,
  ): boolean {
    const required = requiredPermission.toLowerCase();

    return userPermissions.some((permission) => {
      const owned = permission.toLowerCase();

      if (owned === '*' || owned === 'admin:*') {
        return true;
      }

      if (owned === required) {
        return true;
      }

      if (owned.endsWith(':*')) {
        const prefix = owned.slice(0, -1);

        return required.startsWith(prefix);
      }

      return false;
    });
  }

  private toBoolean(value?: string): boolean {
    return value === 'true' || value === '1';
  }
}
