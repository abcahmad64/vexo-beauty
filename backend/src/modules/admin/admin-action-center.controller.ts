import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AdminActionCenterQueryDto } from './dto/admin-action-center-query.dto';
import { AdminActionCenterService } from './services/admin-action-center.service';

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

@ApiTags('Admin Action Center')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/action-center')
@UseGuards(JwtAuthGuard)
export class AdminActionCenterController {
  constructor(private readonly actionCenterService: AdminActionCenterService) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت مرکز اقدام فوری مدیریت',
    description:
      'فهرست اقدام‌های فوری مانند سفارش‌های معطل، پرداخت‌های ناموفق، بازگشت وجه‌های در انتظار، موجودی بحرانی، رویدادهای حساس Audit و اعلان‌های سیستمی خوانده‌نشده را برمی‌گرداند.',
  })
  getActionCenter(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminActionCenterQueryDto,
  ) {
    this.assertActionCenterReader(req);

    return this.actionCenterService.getActionCenter(query, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احراز هویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertActionCenterReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'dashboard:*',
        'dashboard:read',
        'analytics:*',
        'analytics:read',
        'reports:*',
        'reports:read',
        'audit:*',
        'audit:read',
        'audits:*',
        'audits:read',
        'activity:*',
        'activity:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده مرکز اقدام فوری مدیریت را ندارید.',
    );
  }

  private hasAdminRole(req: AuthenticatedRequest): boolean {
    const role =
      req.user?.roleName ??
      (typeof req.user?.role === 'string'
        ? req.user.role
        : req.user?.role?.name) ??
      null;

    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  }

  private hasAnyPermission(
    req: AuthenticatedRequest,
    permissions: string[],
  ): boolean {
    const userPermissions = req.user?.permissions ?? [];

    return permissions.some((permission) =>
      userPermissions.includes(permission),
    );
  }
}
