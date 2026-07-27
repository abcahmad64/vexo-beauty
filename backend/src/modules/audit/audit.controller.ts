import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import type { Request, Response } from 'express';

import { AuditSummaryQueryDto } from './dto/audit-summary-query.dto';

import { CreateAuditLogDto } from './dto/create-audit-log.dto';

import { ExportAuditLogDto } from './dto/export-audit-log.dto';

import { QueryAuditLogDto } from './dto/query-audit-log.dto';

import { AuditExportService } from './services/audit-export.service';

import { AuditService } from './services/audit.service';

import { AuditSummaryService } from './services/audit-summary.service';

type RequestUser = {
  id?: string;
  userId?: string;
  sub?: string;
  role?: string;
  roleName?: string;
  permissions?: string[];
};

type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

@Controller('audit-logs')
@UseGuards(AuthGuard('jwt'))
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly auditSummaryService: AuditSummaryService,
    private readonly auditExportService: AuditExportService,
  ) {}

  @Post('admin')
  createAuditLog(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAuditLogDto,
  ) {
    this.assertAuditManager(req);

    return this.auditService.createAuditLog(dto, {
      actorId: this.getUserId(req),
    });
  }

  @Get('admin/summary')
  getAdminSummary(
    @Req() req: AuthenticatedRequest,
    @Query() query: AuditSummaryQueryDto,
  ) {
    this.assertAuditReader(req);

    return this.auditSummaryService.getAdminSummary(query);
  }

  @Get('admin/export')
  @Header('Cache-Control', 'no-store')
  async exportForAdmin(
    @Req() req: AuthenticatedRequest,
    @Query() query: ExportAuditLogDto,
    @Res() response: Response,
  ): Promise<void> {
    this.assertAuditReader(req);

    const result = await this.auditExportService.exportForAdmin(query);

    response.setHeader('Content-Type', result.contentType);

    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );

    response.send(result.content);
  }

  @Get('admin')
  findAllForAdmin(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryAuditLogDto,
  ) {
    this.assertAuditReader(req);

    return this.auditService.findAllForAdmin(query);
  }

  @Get('admin/:auditLogId')
  findOneForAdmin(
    @Req() req: AuthenticatedRequest,
    @Param('auditLogId') auditLogId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertAuditReader(req);

    return this.auditService.findOneForAdmin(
      auditLogId,
      this.toBoolean(includeDeleted),
    );
  }

  @Delete('admin/:auditLogId')
  deleteForAdmin(
    @Req() req: AuthenticatedRequest,
    @Param('auditLogId') auditLogId: string,
  ) {
    this.assertAuditManager(req);

    return this.auditService.deleteForAdmin(auditLogId, {
      actorId: this.getUserId(req),
    });
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertAuditReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'audit:*',
        'audit:read',
        'audit:export',
        'audits:*',
        'audits:read',
        'audits:export',
        'activity:*',
        'activity:read',
        'admin:*',
        'admin:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما اجازه مشاهده گزارش فعالیت‌ها را ندارید.');
  }

  private assertAuditManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'audit:*',
        'audit:manage',
        'audit:create',
        'audit:delete',
        'audits:*',
        'audits:manage',
        'activity:*',
        'activity:manage',
        'admin:*',
        'admin:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما اجازه مدیریت گزارش فعالیت‌ها را ندارید.');
  }

  private hasAdminRole(req: AuthenticatedRequest): boolean {
    const role = req.user?.roleName ?? req.user?.role;

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

  private toBoolean(value?: string): boolean {
    return value === 'true' || value === '1';
  }
}
