import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { NotifyAdminOperationsDigestDto } from './dto/notify-admin-operations-digest.dto';
import { AdminOperationsDigestNotificationService } from './services/admin-operations-digest-notification.service';

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

@ApiTags('Admin Operations Digest')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/operations-digest')
@UseGuards(JwtAuthGuard)
export class AdminOperationsDigestNotificationController {
  constructor(
    private readonly operationsDigestNotificationService: AdminOperationsDigestNotificationService,
  ) {}

  @Post('notify-admins')
  @ApiOperation({
    summary: 'ارسال خلاصه مدیریتی عملیات برای ادمین‌ها',
    description:
      'خلاصه وضعیت سفارش، پرداخت، بازگشت وجه، موجودی و Audit را تولید کرده و برای مدیران فروشگاه اعلان ارسال می‌کند.',
  })
  notifyAdmins(
    @Req() req: AuthenticatedRequest,
    @Body() dto: NotifyAdminOperationsDigestDto,
  ) {
    this.assertDigestNotifier(req);

    return this.operationsDigestNotificationService.notifyAdmins(
      dto,
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

  private assertDigestNotifier(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'dashboard:*',
        'dashboard:read',
        'analytics:*',
        'analytics:read',
        'reports:*',
        'reports:manage',
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

    throw new ForbiddenException(
      'شما مجوز ارسال خلاصه مدیریتی عملیات را ندارید.',
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
