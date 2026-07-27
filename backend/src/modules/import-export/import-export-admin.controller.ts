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

import { AdminCreateExportJobDto } from './dto/admin-create-export-job.dto';

import { AdminCreateImportJobDto } from './dto/admin-create-import-job.dto';

import { AdminImportExportNoteDto } from './dto/admin-import-export-note.dto';

import { AdminImportExportQueryDto } from './dto/admin-import-export-query.dto';

import { AdminImportExportService } from './services/admin-import-export.service';

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

@ApiTags('Admin Import Export')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/import-export')
@UseGuards(JwtAuthGuard)
export class ImportExportAdminController {
  constructor(
    private readonly adminImportExportService: AdminImportExportService,
  ) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'دریافت داشبورد مرکز ورود و خروج داده',
  })
  getDashboard(@Req() req: AuthenticatedRequest) {
    this.assertImportExportReader(req);

    return this.adminImportExportService.getDashboard();
  }

  @Get('imports')
  findImportJobs(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminImportExportQueryDto,
  ) {
    this.assertImportExportReader(req);

    return this.adminImportExportService.findImportJobs(query);
  }

  @Post('imports')
  createImportJob(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateImportJobDto,
  ) {
    this.assertImportExportManager(req);

    return this.adminImportExportService.createImportJob(
      dto,
      this.getUserId(req),
    );
  }

  @Get('imports/:jobId')
  findImportJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertImportExportReader(req);

    return this.adminImportExportService.findImportJob(
      jobId,
      this.toBoolean(includeDeleted),
    );
  }

  @Post('imports/:jobId/preview')
  previewImportJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    this.assertImportExportManager(req);

    return this.adminImportExportService.previewImportJob(
      jobId,
      this.getUserId(req),
    );
  }

  @Post('imports/:jobId/run')
  runImportJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    this.assertImportExportManager(req);

    return this.adminImportExportService.runImportJob(
      jobId,
      this.getUserId(req),
    );
  }

  @Patch('imports/:jobId/cancel')
  cancelImportJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    this.assertImportExportManager(req);

    return this.adminImportExportService.cancelImportJob(
      jobId,
      this.getUserId(req),
    );
  }

  @Post('imports/:jobId/notes')
  createImportNote(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Body() dto: AdminImportExportNoteDto,
  ) {
    this.assertImportExportManager(req);

    return this.adminImportExportService.createImportNote(
      jobId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('imports/:jobId/restore')
  restoreImportJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    this.assertImportExportManager(req);

    return this.adminImportExportService.restoreImportJob(
      jobId,
      this.getUserId(req),
    );
  }

  @Delete('imports/:jobId')
  deleteImportJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    this.assertImportExportManager(req);

    return this.adminImportExportService.deleteImportJob(
      jobId,
      this.getUserId(req),
    );
  }

  @Get('exports')
  findExportJobs(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminImportExportQueryDto,
  ) {
    this.assertImportExportReader(req);

    return this.adminImportExportService.findExportJobs(query);
  }

  @Post('exports')
  createExportJob(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateExportJobDto,
  ) {
    this.assertImportExportManager(req);

    return this.adminImportExportService.createExportJob(
      dto,
      this.getUserId(req),
    );
  }

  @Get('exports/:jobId')
  findExportJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertImportExportReader(req);

    return this.adminImportExportService.findExportJob(
      jobId,
      this.toBoolean(includeDeleted),
    );
  }

  @Post('exports/:jobId/run')
  runExportJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    this.assertImportExportManager(req);

    return this.adminImportExportService.runExportJob(
      jobId,
      this.getUserId(req),
    );
  }

  @Patch('exports/:jobId/cancel')
  cancelExportJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    this.assertImportExportManager(req);

    return this.adminImportExportService.cancelExportJob(
      jobId,
      this.getUserId(req),
    );
  }

  @Get('exports/:jobId/download')
  async downloadExportJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ) {
    this.assertImportExportReader(req);

    const result = await this.adminImportExportService.downloadExportJob(jobId);

    res.setHeader('Content-Type', result.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return res.send(result.content);
  }

  @Post('exports/:jobId/notes')
  createExportNote(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Body() dto: AdminImportExportNoteDto,
  ) {
    this.assertImportExportManager(req);

    return this.adminImportExportService.createExportNote(
      jobId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('exports/:jobId/restore')
  restoreExportJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    this.assertImportExportManager(req);

    return this.adminImportExportService.restoreExportJob(
      jobId,
      this.getUserId(req),
    );
  }

  @Delete('exports/:jobId')
  deleteExportJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    this.assertImportExportManager(req);

    return this.adminImportExportService.deleteExportJob(
      jobId,
      this.getUserId(req),
    );
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertImportExportReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'import-export:*',
        'import-export:read',
        'import-export:manage',
        'import:*',
        'import:read',
        'export:*',
        'export:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده مرکز ورود و خروج داده را ندارید.',
    );
  }

  private assertImportExportManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'import-export:*',
        'import-export:manage',
        'import-export:run',
        'import:*',
        'import:manage',
        'import:run',
        'export:*',
        'export:manage',
        'export:run',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مدیریت مرکز ورود و خروج داده را ندارید.',
    );
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
