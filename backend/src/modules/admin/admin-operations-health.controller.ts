import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AdminOperationsHealthService } from './services/admin-operations-health.service';

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

@ApiTags('Admin Operations Health')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/operations-health')
@UseGuards(JwtAuthGuard)
export class AdminOperationsHealthController {
  constructor(
    private readonly operationsHealthService: AdminOperationsHealthService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت وضعیت سلامت عملیاتی سیستم',
    description:
      'سلامت دیتابیس، صف‌ها، زمان‌بندی‌ها، سفارش‌های معطل، پرداخت‌های ناموفق، Refund، موجودی، اعلان‌ها و Audit را برای ادمین برمی‌گرداند.',
  })
  getOperationsHealth(@Req() req: AuthenticatedRequest) {
    this.assertOperationsHealthReader(req);

    return this.operationsHealthService.getOperationsHealth(
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

  private assertOperationsHealthReader(req: AuthenticatedRequest): void {
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
        'queue:*',
        'queue:read',
        'scheduler:*',
        'scheduler:read',
        'audit:*',
        'audit:read',
        'audits:*',
        'audits:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده وضعیت سلامت عملیاتی سیستم را ندارید.',
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
