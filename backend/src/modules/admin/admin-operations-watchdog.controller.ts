import {
  Body,
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

import { RunAdminOperationsWatchdogDto } from './dto/run-admin-operations-watchdog.dto';
import { AdminOperationsWatchdogService } from './services/admin-operations-watchdog.service';

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

@ApiTags('Admin Operations Watchdog')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/operations-watchdog')
@UseGuards(JwtAuthGuard)
export class AdminOperationsWatchdogController {
  constructor(
    private readonly operationsWatchdogService: AdminOperationsWatchdogService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'دریافت وضعیت Watchdog عملیاتی فروشگاه',
    description:
      'وضعیت فعال بودن Watchdog، آخرین اجرا، آخرین هشدار و آخرین نتیجه را برمی‌گرداند.',
  })
  getStatus(@Req() req: AuthenticatedRequest) {
    this.assertWatchdogReader(req);

    return this.operationsWatchdogService.getStatus();
  }

  @Post('run-now')
  @ApiOperation({
    summary: 'اجرای دستی Watchdog عملیاتی فروشگاه',
    description:
      'سلامت عملیاتی سیستم را بررسی می‌کند و در صورت نیاز برای مدیرها هشدار ارسال می‌کند.',
  })
  runNow(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RunAdminOperationsWatchdogDto,
  ) {
    this.assertWatchdogManager(req);

    return this.operationsWatchdogService.runNow(dto, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احراز هویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertWatchdogReader(req: AuthenticatedRequest): void {
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
        'queue:*',
        'queue:read',
        'scheduler:*',
        'scheduler:read',
        'notifications:*',
        'notifications:read',
        'audit:*',
        'audit:read',
        'audits:*',
        'audits:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده وضعیت Watchdog عملیاتی را ندارید.',
    );
  }

  private assertWatchdogManager(req: AuthenticatedRequest): void {
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
        'queue:*',
        'queue:read',
        'scheduler:*',
        'scheduler:manage',
        'scheduler:run',
        'notifications:*',
        'notifications:manage',
        'audit:*',
        'audit:read',
        'audits:*',
        'audits:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز اجرای Watchdog عملیاتی را ندارید.');
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
