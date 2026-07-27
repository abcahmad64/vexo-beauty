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

import { AdminTimelineQueryDto } from './dto/admin-timeline-query.dto';
import { AdminTimelineService } from './services/admin-timeline.service';

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

@ApiTags('Admin Timeline')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/timeline')
@UseGuards(JwtAuthGuard)
export class AdminTimelineController {
  constructor(private readonly adminTimelineService: AdminTimelineService) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت تایم‌لاین یکپارچه مدیریتی',
    description:
      'آخرین فعالیت‌های سفارش، پرداخت، بازگشت وجه، فاکتور، اعلان و Audit را در یک تایم‌لاین واحد برمی‌گرداند.',
  })
  getTimeline(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminTimelineQueryDto,
  ) {
    this.assertTimelineReader(req);

    return this.adminTimelineService.getTimeline(query, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احراز هویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertTimelineReader(req: AuthenticatedRequest): void {
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
      'شما مجوز مشاهده تایم‌لاین مدیریتی را ندارید.',
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
