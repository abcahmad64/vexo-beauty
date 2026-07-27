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

import { AdminOperationsDigestQueryDto } from './dto/admin-operations-digest-query.dto';
import { AdminOperationsDigestService } from './services/admin-operations-digest.service';

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
export class AdminOperationsDigestController {
  constructor(
    private readonly operationsDigestService: AdminOperationsDigestService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت خلاصه مدیریتی عملیات فروشگاه',
    description:
      'خلاصه وضعیت سفارش، پرداخت، بازگشت وجه، موجودی، Audit و پیشنهادهای مدیریتی را برای نمایش سریع در پنل ادمین برمی‌گرداند.',
  })
  getDigest(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminOperationsDigestQueryDto,
  ) {
    this.assertDigestReader(req);

    return this.operationsDigestService.getDigest(query, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احراز هویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertDigestReader(req: AuthenticatedRequest): void {
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
      'شما مجوز مشاهده خلاصه مدیریتی عملیات را ندارید.',
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
