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

import { AdminOperationsAlertAnalyticsQueryDto } from './dto/admin-operations-alert-analytics-query.dto';
import { AdminOperationsAlertAnalyticsService } from './services/admin-operations-alert-analytics.service';

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

@ApiTags('Admin Operations Alert Analytics')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/operations-alerts/analytics')
@UseGuards(JwtAuthGuard)
export class AdminOperationsAlertAnalyticsController {
  constructor(
    private readonly alertAnalyticsService: AdminOperationsAlertAnalyticsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت تحلیل هشدارهای عملیاتی',
    description:
      'تحلیل هشدارهای Watchdog، Digest و Escalation را بر اساس وضعیت خوانده‌شدن، منبع، شدت و نمودار روزانه برمی‌گرداند.',
  })
  getAnalytics(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminOperationsAlertAnalyticsQueryDto,
  ) {
    this.assertAnalyticsReader(req);

    return this.alertAnalyticsService.getAnalytics(query, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احراز هویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertAnalyticsReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'dashboard:*',
        'dashboard:read',
        'notifications:*',
        'notifications:read',
        'reports:*',
        'reports:read',
        'analytics:*',
        'analytics:read',
        'audit:*',
        'audit:read',
        'audits:*',
        'audits:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده تحلیل هشدارهای عملیاتی را ندارید.',
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
