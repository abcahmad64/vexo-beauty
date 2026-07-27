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

import { AdminEnterpriseDashboardQueryDto } from './dto/admin-enterprise-dashboard-query.dto';
import { AdminEnterpriseDashboardService } from './services/admin-enterprise-dashboard.service';

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

@ApiTags('Admin Enterprise Dashboard')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/enterprise-dashboard')
@UseGuards(JwtAuthGuard)
export class AdminEnterpriseDashboardController {
  constructor(
    private readonly enterpriseDashboardService: AdminEnterpriseDashboardService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت داشبورد جامع مدیریتی فروشگاه',
    description:
      'خلاصه Enterprise از سفارش‌ها، پرداخت‌ها، بازگشت وجه، فاکتورها، محصولات، کاربران، موجودی، اعلان‌ها، Audit، نمودارها و ریسک عملیاتی را برمی‌گرداند.',
  })
  getEnterpriseDashboard(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminEnterpriseDashboardQueryDto,
  ) {
    this.assertEnterpriseDashboardReader(req);

    return this.enterpriseDashboardService.getEnterpriseDashboard(
      query,
      this.getUserId(req),
    );
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احراز هویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertEnterpriseDashboardReader(req: AuthenticatedRequest): void {
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
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده داشبورد جامع مدیریتی را ندارید.',
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
