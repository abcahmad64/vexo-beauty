import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Request } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AdminSupportAiSummaryDto } from './dto/admin-support-ai.dto';

import { AdminSupportAiService } from './services/admin-support-ai.service';

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

@ApiTags('Support Admin AI')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/support/ai')
@UseGuards(JwtAuthGuard)
export class SupportAiAdminController {
  constructor(private readonly adminSupportAiService: AdminSupportAiService) {}

  @Post('summary')
  summarize(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminSupportAiSummaryDto,
  ) {
    this.assertSupportReader(req);

    return this.adminSupportAiService.summarize(dto, {
      userId: this.getUserId(req),
      role: this.getRole(req),
      permissions: req.user?.permissions ?? [],
    });
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private getRole(req: AuthenticatedRequest): string | null {
    return typeof req.user?.role === 'string'
      ? req.user.role
      : (req.user?.role?.name ?? req.user?.roleName ?? null);
  }

  private assertSupportReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'ai:*',
        'ai:read',
        'support:*',
        'support:read',
        'support:manage',
        'tickets:*',
        'tickets:read',
        'chat:*',
        'chat:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده خلاصه هوشمند پشتیبانی را ندارید.',
    );
  }

  private hasAdminRole(req: AuthenticatedRequest): boolean {
    const role = this.getRole(req);

    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  }

  private hasAnyPermission(
    req: AuthenticatedRequest,
    permissions: string[],
  ): boolean {
    const userPermissions = req.user?.permissions ?? [];

    return permissions.some((requiredPermission) =>
      this.permissionMatches(userPermissions, requiredPermission),
    );
  }

  private permissionMatches(
    userPermissions: string[],
    requiredPermission: string,
  ): boolean {
    const required = requiredPermission.toLowerCase();

    return userPermissions.some((permission) => {
      const owned = permission.toLowerCase();

      if (owned === '*' || owned === 'admin:*') {
        return true;
      }

      if (owned === required) {
        return true;
      }

      if (owned.endsWith(':*')) {
        const prefix = owned.slice(0, -1);

        return required.startsWith(prefix);
      }

      return false;
    });
  }
}
