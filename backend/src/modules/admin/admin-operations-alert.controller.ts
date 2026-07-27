import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AcknowledgeAdminOperationsAlertsDto } from './dto/acknowledge-admin-operations-alerts.dto';
import { AdminOperationsAlertQueryDto } from './dto/admin-operations-alert-query.dto';
import { AdminOperationsAlertService } from './services/admin-operations-alert.service';

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

@ApiTags('Admin Operations Alerts')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/operations-alerts')
@UseGuards(JwtAuthGuard)
export class AdminOperationsAlertController {
  constructor(
    private readonly operationsAlertService: AdminOperationsAlertService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت صندوق هشدارهای عملیاتی',
    description:
      'هشدارهای عملیاتی تولیدشده توسط Watchdog و Operations Digest را همراه با فیلتر و خلاصه برمی‌گرداند.',
  })
  findAlerts(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminOperationsAlertQueryDto,
  ) {
    this.assertAlertReader(req);

    return this.operationsAlertService.findAlerts(query, this.getUserId(req));
  }

  @Patch('acknowledge-all')
  @ApiOperation({
    summary: 'تأیید گروهی هشدارهای عملیاتی',
    description:
      'هشدارهای خوانده‌نشده عملیاتی را بر اساس فیلترهای ورودی به حالت خوانده‌شده تغییر می‌دهد.',
  })
  acknowledgeAll(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AcknowledgeAdminOperationsAlertsDto,
  ) {
    this.assertAlertManager(req);

    return this.operationsAlertService.acknowledgeMany(
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':notificationId/acknowledge')
  @ApiOperation({
    summary: 'تأیید یک هشدار عملیاتی',
    description:
      'یک هشدار عملیاتی را به حالت خوانده‌شده تغییر می‌دهد و اطلاعات Acknowledge را در metadata ذخیره می‌کند.',
  })
  acknowledgeOne(
    @Req() req: AuthenticatedRequest,
    @Param('notificationId') notificationId: string,
  ) {
    this.assertAlertManager(req);

    return this.operationsAlertService.acknowledgeOne(
      notificationId,
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

  private assertAlertReader(req: AuthenticatedRequest): void {
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
        'audit:*',
        'audit:read',
        'audits:*',
        'audits:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده هشدارهای عملیاتی را ندارید.');
  }

  private assertAlertManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'notifications:*',
        'notifications:manage',
        'dashboard:*',
        'dashboard:read',
        'reports:*',
        'reports:manage',
        'audit:*',
        'audit:read',
        'audits:*',
        'audits:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت هشدارهای عملیاتی را ندارید.');
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
