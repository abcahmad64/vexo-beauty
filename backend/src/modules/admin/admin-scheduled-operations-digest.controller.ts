import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AdminScheduledOperationsDigestService } from './services/admin-scheduled-operations-digest.service';

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

@ApiTags('Admin Scheduled Operations Digest')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/operations-digest/schedule')
@UseGuards(JwtAuthGuard)
export class AdminScheduledOperationsDigestController {
  constructor(
    private readonly scheduledDigestService: AdminScheduledOperationsDigestService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'دریافت وضعیت زمان‌بندی خلاصه مدیریتی عملیات',
    description:
      'وضعیت فعال بودن ارسال روزانه Operations Digest، کانال‌ها، آخرین اجرا و آخرین نتیجه را برمی‌گرداند.',
  })
  getStatus(@Req() req: AuthenticatedRequest) {
    this.assertScheduledDigestReader(req);

    return this.scheduledDigestService.getStatus();
  }

  @Post('run-now')
  @ApiOperation({
    summary: 'اجرای دستی ارسال زمان‌بندی‌شده خلاصه مدیریتی عملیات',
    description:
      'ارسال زمان‌بندی‌شده Operations Digest را به‌صورت دستی اجرا می‌کند و نتیجه آخرین اجرا را برمی‌گرداند.',
  })
  runNow(@Req() req: AuthenticatedRequest) {
    this.assertScheduledDigestManager(req);

    return this.scheduledDigestService.runNow(this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احراز هویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertScheduledDigestReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'dashboard:*',
        'dashboard:read',
        'reports:*',
        'reports:read',
        'scheduler:*',
        'scheduler:read',
        'notifications:*',
        'notifications:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده وضعیت زمان‌بندی خلاصه مدیریتی را ندارید.',
    );
  }

  private assertScheduledDigestManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'dashboard:*',
        'dashboard:read',
        'reports:*',
        'reports:manage',
        'scheduler:*',
        'scheduler:manage',
        'scheduler:run',
        'notifications:*',
        'notifications:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز اجرای زمان‌بندی خلاصه مدیریتی را ندارید.',
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
