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
  Res,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Request, Response } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AdminBulkUpdateStoreSettingsDto } from './dto/admin-bulk-update-store-settings.dto';

import { AdminCreateStoreSettingDto } from './dto/admin-create-store-setting.dto';

import { AdminQueryStoreSettingDto } from './dto/admin-query-store-setting.dto';

import { AdminStoreSettingExportQueryDto } from './dto/admin-store-setting-export-query.dto';

import { AdminStoreSettingNoteDto } from './dto/admin-store-setting-note.dto';

import { AdminUpdateStoreSettingDto } from './dto/admin-update-store-setting.dto';

import { AdminStoreSettingExportService } from './services/admin-store-setting-export.service';

import { AdminStoreSettingService } from './services/admin-store-setting.service';

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

@ApiTags('Store Settings Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/store-settings')
@UseGuards(JwtAuthGuard)
export class StoreSettingAdminController {
  constructor(
    private readonly adminStoreSettingService: AdminStoreSettingService,
    private readonly adminStoreSettingExportService: AdminStoreSettingExportService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی تنظیمات فروشگاه',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryStoreSettingDto,
  ) {
    this.assertSettingReader(req);

    return this.adminStoreSettingService.findAll(query);
  }

  @Get('dashboard')
  getDashboard(@Req() req: AuthenticatedRequest) {
    this.assertSettingReader(req);

    return this.adminStoreSettingService.getDashboard();
  }

  @Get('groups')
  getGroups(@Req() req: AuthenticatedRequest) {
    this.assertSettingReader(req);

    return this.adminStoreSettingService.getGroups();
  }

  @Get('public')
  getPublicSettings(@Req() req: AuthenticatedRequest) {
    this.assertSettingReader(req);

    return this.adminStoreSettingService.getPublicSettings();
  }

  @Get('export')
  async exportSettings(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminStoreSettingExportQueryDto,
    @Res() res: Response,
  ) {
    this.assertSettingReader(req);

    const result =
      await this.adminStoreSettingExportService.exportSettings(query);

    res.setHeader('Content-Type', result.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return res.send(result.content);
  }

  @Post('bootstrap-defaults')
  bootstrapDefaults(@Req() req: AuthenticatedRequest) {
    this.assertSettingManager(req);

    return this.adminStoreSettingService.bootstrapDefaults(this.getUserId(req));
  }

  @Patch('bulk')
  bulkUpdate(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminBulkUpdateStoreSettingsDto,
  ) {
    this.assertSettingManager(req);

    return this.adminStoreSettingService.bulkUpdate(dto, this.getUserId(req));
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateStoreSettingDto,
  ) {
    this.assertSettingManager(req);

    return this.adminStoreSettingService.create(dto, this.getUserId(req));
  }

  @Get('key/:key')
  findByKey(
    @Req() req: AuthenticatedRequest,
    @Param('key') key: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertSettingReader(req);

    return this.adminStoreSettingService.findByKey(
      key,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch('key/:key')
  updateByKey(
    @Req() req: AuthenticatedRequest,
    @Param('key') key: string,
    @Body() dto: AdminUpdateStoreSettingDto,
  ) {
    this.assertSettingManager(req);

    return this.adminStoreSettingService.updateByKey(
      key,
      dto,
      this.getUserId(req),
    );
  }

  @Get(':settingId')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('settingId') settingId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertSettingReader(req);

    return this.adminStoreSettingService.findOne(
      settingId,
      this.toBoolean(includeDeleted),
    );
  }

  @Get(':settingId/revisions')
  getRevisions(
    @Req() req: AuthenticatedRequest,
    @Param('settingId') settingId: string,
    @Query('limit') limit?: string,
  ) {
    this.assertSettingReader(req);

    const parsedLimit = limit ? Number(limit) : 50;

    return this.adminStoreSettingService.getRevisions(
      settingId,
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 50,
    );
  }

  @Get(':settingId/notes')
  getNotes(
    @Req() req: AuthenticatedRequest,
    @Param('settingId') settingId: string,
    @Query('limit') limit?: string,
  ) {
    this.assertSettingReader(req);

    const parsedLimit = limit ? Number(limit) : 50;

    return this.adminStoreSettingService.getNotes(
      settingId,
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 50,
    );
  }

  @Post(':settingId/notes')
  createNote(
    @Req() req: AuthenticatedRequest,
    @Param('settingId') settingId: string,
    @Body() dto: AdminStoreSettingNoteDto,
  ) {
    this.assertSettingManager(req);

    return this.adminStoreSettingService.createNote(
      settingId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':settingId')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('settingId') settingId: string,
    @Body() dto: AdminUpdateStoreSettingDto,
  ) {
    this.assertSettingManager(req);

    return this.adminStoreSettingService.update(
      settingId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':settingId/restore')
  restore(
    @Req() req: AuthenticatedRequest,
    @Param('settingId') settingId: string,
  ) {
    this.assertSettingManager(req);

    return this.adminStoreSettingService.restore(
      settingId,
      this.getUserId(req),
    );
  }

  @Delete(':settingId')
  delete(
    @Req() req: AuthenticatedRequest,
    @Param('settingId') settingId: string,
  ) {
    this.assertSettingManager(req);

    return this.adminStoreSettingService.delete(settingId, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertSettingReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'settings:*',
        'settings:read',
        'settings:manage',
        'store-settings:*',
        'store-settings:read',
        'store-settings:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده تنظیمات فروشگاه را ندارید.');
  }

  private assertSettingManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'settings:*',
        'settings:manage',
        'settings:update',
        'store-settings:*',
        'store-settings:manage',
        'store-settings:update',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت تنظیمات فروشگاه را ندارید.');
  }

  private hasAdminRole(req: AuthenticatedRequest): boolean {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName ?? null);

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

  private toBoolean(value?: string): boolean {
    return value === 'true' || value === '1';
  }
}
