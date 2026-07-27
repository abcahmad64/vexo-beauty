import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';

import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../core/prisma/prisma.service';
import { formatPersianDateTime } from '../../core/date-time/persian-date-time.util';
import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminCustomerNoteDto } from './dto/admin-customer-note.dto';
import { AdminCustomerSegmentDto } from './dto/admin-customer-segment.dto';
import { AdminQueryUserDto } from './dto/admin-query-user.dto';
import { AdminUpdateUserStatusDto } from './dto/admin-update-user-status.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminCustomerActivityService } from './services/admin-customer-activity.service';
import { AdminCustomerProfileService } from './services/admin-customer-profile.service';
import { AdminUserService } from './services/admin-user.service';

type RequestUser = {
  readonly id?: string;
  readonly userId?: string;
  readonly sub?: string;
  readonly role?: string;
  readonly roleName?: string;
  readonly permissions?: string[];
};

type AuthenticatedRequest = Request & {
  readonly user?: RequestUser;
};

@ApiTags('User Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/users')
@UseGuards(JwtAuthGuard)
export class UserAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminUserService: AdminUserService,
    private readonly adminCustomerProfileService: AdminCustomerProfileService,
    private readonly adminCustomerActivityService: AdminCustomerActivityService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی کاربران',
  })
  findAll(@Req() req: AuthenticatedRequest, @Query() query: AdminQueryUserDto) {
    this.assertUserReader(req);

    return this.adminUserService.findAll(query);
  }

  @Get(':userId')
  @ApiOperation({
    summary: 'دریافت جزئیات مدیریتی کاربر',
  })
  findOne(@Req() req: AuthenticatedRequest, @Param('userId') userId: string) {
    this.assertUserReader(req);

    return this.adminUserService.findOne(userId);
  }

  @Get(':userId/profile')
  @ApiOperation({
    summary: 'دریافت پروفایل کامل مشتری',
  })
  getProfile(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ) {
    this.assertUserReader(req);

    return this.adminCustomerProfileService.getProfile(userId);
  }

  @Get(':userId/activity')
  @ApiOperation({
    summary: 'دریافت فعالیت‌های مشتری',
  })
  getActivity(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    this.assertUserReader(req);

    return this.adminCustomerActivityService.getActivity(
      userId,
      this.normalizeLimit(limit),
    );
  }

  @Patch(':userId')
  @ApiOperation({
    summary: 'به‌روزرسانی اطلاعات کاربر',
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    this.assertUserManager(req);

    return this.adminUserService.update(userId, dto, this.getUserId(req));
  }

  @Patch(':userId/status')
  @ApiOperation({
    summary: 'به‌روزرسانی وضعیت کاربر',
  })
  updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() dto: AdminUpdateUserStatusDto,
  ) {
    this.assertUserManager(req);

    return this.adminUserService.updateStatus(userId, dto, this.getUserId(req));
  }

  @Delete(':userId')
  @ApiOperation({
    summary: 'حذف نرم کاربر',
  })
  delete(@Req() req: AuthenticatedRequest, @Param('userId') userId: string) {
    this.assertUserManager(req);

    return this.adminUserService.delete(userId, this.getUserId(req));
  }

  @Patch(':userId/restore')
  @ApiOperation({
    summary: 'بازگردانی کاربر حذف‌شده',
  })
  restore(@Req() req: AuthenticatedRequest, @Param('userId') userId: string) {
    this.assertUserManager(req);

    return this.adminUserService.restore(userId, this.getUserId(req));
  }

  @Patch(':userId/sessions/revoke')
  @ApiOperation({
    summary: 'لغو تمام نشست‌های فعال کاربر',
  })
  revokeSessions(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ) {
    this.assertUserManager(req);

    return this.adminUserService.revokeSessions(userId, this.getUserId(req));
  }

  @Get(':userId/notes')
  @ApiOperation({
    summary: 'دریافت یادداشت‌های مشتری',
  })
  async getNotes(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    this.assertUserReader(req);

    const rows = await this.adminCustomerProfileService.getNotes(
      userId,
      this.normalizeLimit(limit),
    );

    return {
      data: rows.map((row) => {
        const data = this.toRecord(row.data);

        return {
          id: row.id,
          note: data.note ?? null,
          isImportant: data.isImportant ?? false,
          visibility: data.visibility ?? 'admin',
          actorId: row.userId,
          createdAt: row.timestamp.toISOString(),
          createdAtFa: formatPersianDateTime(row.timestamp),
        };
      }),
      meta: {
        userId,
        total: rows.length,
      },
    };
  }

  @Post(':userId/notes')
  @ApiOperation({
    summary: 'ثبت یادداشت مدیریتی برای مشتری',
  })
  async createNote(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() dto: AdminCustomerNoteDto,
  ) {
    this.assertUserManager(req);

    await this.adminUserService.findUserRow(userId, true);

    const actorId = this.getUserId(req);
    const noteId = randomUUID();
    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Event" (
          "id",
          "name",
          "description",
          "category",
          "timestamp",
          "userId",
          "data",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${noteId},
          'customer.note.created',
          'یادداشت مدیریتی برای مشتری ثبت شد.',
          'customer',
          ${now},
          ${actorId},
          ${JSON.stringify({
            customerId: userId,
            note: dto.note,
            isImportant: dto.isImportant ?? false,
            visibility: dto.visibility ?? 'admin',
          })}::jsonb,
          ${now},
          ${now}
        )
      `,
    );

    return {
      success: true,
      noteId,
      message: 'یادداشت مشتری با موفقیت ثبت شد.',
      createdAt: now.toISOString(),
      createdAtFa: formatPersianDateTime(now),
      audit: {
        actorId,
        action: 'customer.note.created',
      },
    };
  }

  @Delete(':userId/notes/:noteId')
  @ApiOperation({
    summary: 'حذف یادداشت مشتری',
  })
  async deleteNote(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Param('noteId') noteId: string,
  ) {
    this.assertUserManager(req);

    await this.adminUserService.findUserRow(userId, true);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Event"
        SET
          "deleted_at" = ${now},
          "updatedAt" = ${now}
        WHERE
          "id" = ${noteId}
          AND "name" = 'customer.note.created'
          AND "data" #>> '{customerId}' = ${userId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      success: true,
      message: 'یادداشت مشتری با موفقیت حذف شد.',
      deletedAt: now.toISOString(),
      deletedAtFa: formatPersianDateTime(now),
      audit: {
        actorId: this.getUserId(req),
        action: 'customer.note.deleted',
      },
    };
  }

  @Get(':userId/segment')
  @ApiOperation({
    summary: 'دریافت سگمنت مشتری',
  })
  getSegment(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ) {
    this.assertUserReader(req);

    return this.adminCustomerProfileService.getSegment(userId);
  }

  @Patch(':userId/segment')
  @ApiOperation({
    summary: 'به‌روزرسانی سگمنت مشتری',
  })
  async updateSegment(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() dto: AdminCustomerSegmentDto,
  ) {
    this.assertUserManager(req);

    await this.adminUserService.findUserRow(userId, true);

    const actorId = this.getUserId(req);
    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Event" (
          "id",
          "name",
          "description",
          "category",
          "timestamp",
          "userId",
          "data",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${randomUUID()},
          'customer.segment.updated',
          'سگمنت مشتری توسط ادمین به‌روزرسانی شد.',
          'customer',
          ${now},
          ${actorId},
          ${JSON.stringify({
            customerId: userId,
            segment: dto.segment ?? null,
            vipLevel: dto.vipLevel ?? 'none',
            tags: dto.tags ?? [],
            marketingAllowed: dto.marketingAllowed ?? null,
            highRisk: dto.highRisk ?? false,
            reason: dto.reason ?? null,
          })}::jsonb,
          ${now},
          ${now}
        )
      `,
    );

    return this.adminCustomerProfileService.getSegment(userId);
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertUserReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'customer:*',
        'customer:read',
        'customers:*',
        'customers:read',
        'user:*',
        'user:read',
        'users:*',
        'users:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت کاربران را ندارید.');
  }

  private assertUserManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'customer:*',
        'customer:manage',
        'customers:*',
        'customers:manage',
        'user:*',
        'user:manage',
        'users:*',
        'users:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت کاربران را ندارید.');
  }

  private hasAdminRole(req: AuthenticatedRequest): boolean {
    const role = req.user?.roleName ?? req.user?.role;

    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  }

  private hasAnyPermission(
    req: AuthenticatedRequest,
    permissions: readonly string[],
  ): boolean {
    const userPermissions = req.user?.permissions ?? [];

    return permissions.some((permission) =>
      userPermissions.includes(permission),
    );
  }

  private normalizeLimit(value: string | undefined): number {
    if (!value) {
      return 50;
    }

    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue) || parsedValue < 1) {
      return 50;
    }

    return Math.min(Math.trunc(parsedValue), 200);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
