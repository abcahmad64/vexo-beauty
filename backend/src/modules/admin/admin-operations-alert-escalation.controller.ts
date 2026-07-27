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

import { RunAdminOperationsAlertEscalationDto } from './dto/run-admin-operations-alert-escalation.dto';
import { AdminOperationsAlertEscalationService } from './services/admin-operations-alert-escalation.service';

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

@ApiTags('Admin Operations Alert Escalation')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/operations-alerts/escalation')
@UseGuards(JwtAuthGuard)
export class AdminOperationsAlertEscalationController {
  constructor(
    private readonly escalationService: AdminOperationsAlertEscalationService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'دریافت وضعیت Escalation هشدارهای عملیاتی',
    description:
      'وضعیت فعال بودن Escalation، تنظیمات، آخرین اجرا و آخرین نتیجه را برمی‌گرداند.',
  })
  getStatus(@Req() req: AuthenticatedRequest) {
    this.assertEscalationReader(req);

    return this.escalationService.getStatus();
  }

  @Post('run-now')
  @ApiOperation({
    summary: 'اجرای دستی Escalation هشدارهای عملیاتی',
    description:
      'هشدارهای عملیاتی خوانده‌نشده را بررسی کرده و در صورت نیاز، اعلان Escalation برای مدیرها ارسال می‌کند.',
  })
  runNow(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RunAdminOperationsAlertEscalationDto,
  ) {
    this.assertEscalationManager(req);

    return this.escalationService.runNow(dto, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احراز هویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertEscalationReader(req: AuthenticatedRequest): void {
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
      'شما مجوز مشاهده وضعیت Escalation هشدارهای عملیاتی را ندارید.',
    );
  }

  private assertEscalationManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'dashboard:*',
        'dashboard:read',
        'notifications:*',
        'notifications:manage',
        'reports:*',
        'reports:manage',
        'scheduler:*',
        'scheduler:manage',
        'scheduler:run',
        'audit:*',
        'audit:read',
        'audits:*',
        'audits:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز اجرای Escalation هشدارهای عملیاتی را ندارید.',
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
