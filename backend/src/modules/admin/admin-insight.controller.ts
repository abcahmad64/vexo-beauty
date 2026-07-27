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

import { AdminInsightQueryDto } from './dto/admin-insight-query.dto';
import { AdminInsightService } from './services/admin-insight.service';

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

@ApiTags('Admin Smart Insights')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/insights')
@UseGuards(JwtAuthGuard)
export class AdminInsightController {
  constructor(private readonly adminInsightService: AdminInsightService) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت تحلیل هوشمند مدیریتی فروشگاه',
    description:
      'تحلیل Rule-Based از وضعیت سفارش‌ها، پرداخت‌ها، بازگشت وجه، موجودی، فاکتور، اعلان‌ها و Audit را همراه با پیشنهاد اقدام مدیریتی برمی‌گرداند.',
  })
  getInsights(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminInsightQueryDto,
  ) {
    this.assertInsightReader(req);

    return this.adminInsightService.getInsights(query, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احراز هویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertInsightReader(req: AuthenticatedRequest): void {
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
      'شما مجوز مشاهده تحلیل هوشمند مدیریتی را ندارید.',
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
