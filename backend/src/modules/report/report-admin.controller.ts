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

import { AiPermissionContext } from '../ai/services/ai-permission-guard.service';

import {
  AdminDemandAnalysisAiDto,
  AdminMarketingStrategyAiDto,
  AdminProductRecommendationAiDto,
  AdminSearchInsightAiDto,
} from './dto/admin-marketing-ai.dto';

import {
  AdminReportAiOrderSummaryDto,
  AdminReportAiSalesInsightDto,
  AdminReportAiStoreHealthDto,
} from './dto/admin-report-ai.dto';

import { AdminCreateReportSnapshotDto } from './dto/admin-create-report-snapshot.dto';

import { AdminQueryReportSnapshotDto } from './dto/admin-query-report-snapshot.dto';

import { AdminReportExportQueryDto } from './dto/admin-report-export-query.dto';

import { AdminReportNoteDto } from './dto/admin-report-note.dto';

import { AdminReportRequestDto } from './dto/admin-report-request.dto';

import { AdminMarketingAiService } from './services/admin-marketing-ai.service';

import { AdminReportAiService } from './services/admin-report-ai.service';

import { AdminReportExportService } from './services/admin-report-export.service';

import { AdminReportService } from './services/admin-report.service';

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

@ApiTags('Reports Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/reports')
@UseGuards(JwtAuthGuard)
export class ReportAdminController {
  constructor(
    private readonly adminReportService: AdminReportService,
    private readonly adminReportExportService: AdminReportExportService,
    private readonly adminReportAiService: AdminReportAiService,
    private readonly adminMarketingAiService: AdminMarketingAiService,
  ) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'دریافت داشبورد گزارش‌های مدیریتی',
  })
  getDashboard(@Req() req: AuthenticatedRequest) {
    this.assertReportReader(req);

    return this.adminReportService.getDashboard();
  }

  @Post('ai/store-health')
  @ApiOperation({
    summary: 'تولید گزارش هوشمند سلامت فروشگاه',
  })
  generateAiStoreHealth(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminReportAiStoreHealthDto,
  ) {
    this.assertReportReader(req);

    return this.adminReportAiService.generateStoreHealth(
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post('ai/sales-insight')
  @ApiOperation({
    summary: 'تولید تحلیل هوشمند فروش',
  })
  generateAiSalesInsight(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminReportAiSalesInsightDto,
  ) {
    this.assertReportReader(req);

    return this.adminReportAiService.generateSalesInsight(
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post('ai/order-summary')
  @ApiOperation({
    summary: 'تولید خلاصه هوشمند سفارش‌ها',
  })
  generateAiOrderSummary(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminReportAiOrderSummaryDto,
  ) {
    this.assertReportReader(req);

    return this.adminReportAiService.generateOrderSummary(
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post('ai/marketing-strategy')
  @ApiOperation({
    summary: 'تولید استراتژی هوشمند بازاریابی',
  })
  generateAiMarketingStrategy(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminMarketingStrategyAiDto,
  ) {
    this.assertReportReader(req);

    return this.adminMarketingAiService.generateMarketingStrategy(
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post('ai/demand-analysis')
  @ApiOperation({
    summary: 'تولید تحلیل هوشمند تقاضا',
  })
  generateAiDemandAnalysis(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminDemandAnalysisAiDto,
  ) {
    this.assertReportReader(req);

    return this.adminMarketingAiService.generateDemandAnalysis(
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post('ai/product-recommendations')
  @ApiOperation({
    summary: 'تولید پیشنهاد هوشمند محصول',
  })
  generateAiProductRecommendations(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminProductRecommendationAiDto,
  ) {
    this.assertReportReader(req);

    return this.adminMarketingAiService.generateProductRecommendations(
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post('ai/search-insight')
  @ApiOperation({
    summary: 'تولید تحلیل هوشمند جست‌وجو',
  })
  generateAiSearchInsight(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminSearchInsightAiDto,
  ) {
    this.assertReportReader(req);

    return this.adminMarketingAiService.generateSearchInsight(
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post('generate')
  @ApiOperation({
    summary: 'تولید گزارش مدیریتی',
  })
  generateReport(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminReportRequestDto,
  ) {
    this.assertReportReader(req);

    return this.adminReportService.generateReport(dto);
  }

  @Get('export')
  @ApiOperation({
    summary: 'خروجی گرفتن از گزارش',
  })
  async exportReport(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminReportExportQueryDto,
    @Res() res: Response,
  ) {
    this.assertReportReader(req);

    const result = await this.adminReportExportService.exportReport(
      query,
      this.getOptionalUserId(req),
    );

    res.setHeader('Content-Type', result.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return res.send(result.content);
  }

  @Get('snapshots')
  @ApiOperation({
    summary: 'دریافت اسنپ‌شات‌های گزارش',
  })
  findSnapshots(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryReportSnapshotDto,
  ) {
    this.assertReportReader(req);

    return this.adminReportService.findSnapshots(query);
  }

  @Post('snapshots')
  @ApiOperation({
    summary: 'ایجاد اسنپ‌شات گزارش',
  })
  createSnapshot(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateReportSnapshotDto,
  ) {
    this.assertReportManager(req);

    return this.adminReportService.createSnapshot(dto, this.getUserId(req));
  }

  @Get('snapshots/:snapshotId')
  @ApiOperation({
    summary: 'دریافت جزئیات اسنپ‌شات گزارش',
  })
  findSnapshot(
    @Req() req: AuthenticatedRequest,
    @Param('snapshotId') snapshotId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertReportReader(req);

    return this.adminReportService.findSnapshot(
      snapshotId,
      this.toBoolean(includeDeleted),
    );
  }

  @Post('snapshots/:snapshotId/notes')
  @ApiOperation({
    summary: 'ثبت یادداشت مدیریتی برای گزارش',
  })
  createNote(
    @Req() req: AuthenticatedRequest,
    @Param('snapshotId') snapshotId: string,
    @Body() dto: AdminReportNoteDto,
  ) {
    this.assertReportManager(req);

    return this.adminReportService.createNote(
      snapshotId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('snapshots/:snapshotId/restore')
  @ApiOperation({
    summary: 'بازگردانی اسنپ‌شات حذف‌شده',
  })
  restoreSnapshot(
    @Req() req: AuthenticatedRequest,
    @Param('snapshotId') snapshotId: string,
  ) {
    this.assertReportManager(req);

    return this.adminReportService.restoreSnapshot(
      snapshotId,
      this.getUserId(req),
    );
  }

  @Delete('snapshots/:snapshotId')
  @ApiOperation({
    summary: 'حذف نرم اسنپ‌شات گزارش',
  })
  deleteSnapshot(
    @Req() req: AuthenticatedRequest,
    @Param('snapshotId') snapshotId: string,
  ) {
    this.assertReportManager(req);

    return this.adminReportService.deleteSnapshot(
      snapshotId,
      this.getUserId(req),
    );
  }

  private getAiPermissionContext(
    req: AuthenticatedRequest,
  ): AiPermissionContext {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName ?? null);

    const roleName =
      req.user?.roleName ??
      (typeof req.user?.role === 'object'
        ? (req.user.role?.name ?? null)
        : role);

    return {
      userId: this.getUserId(req),
      role: role ?? undefined,
      roleName: roleName ?? undefined,
      permissions: req.user?.permissions ?? [],
    };
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = this.getOptionalUserId(req);

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private getOptionalUserId(req: AuthenticatedRequest): string | undefined {
    return req.user?.id ?? req.user?.userId ?? req.user?.sub;
  }

  private assertReportReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'reports:*',
        'reports:read',
        'reports:manage',
        'report:*',
        'report:read',
        'report:manage',
        'analytics:read',
        'analytics:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده گزارش‌های مدیریتی را ندارید.',
    );
  }

  private assertReportManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'reports:*',
        'reports:manage',
        'reports:create',
        'reports:update',
        'reports:delete',
        'report:*',
        'report:manage',
        'analytics:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت گزارش‌ها را ندارید.');
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
