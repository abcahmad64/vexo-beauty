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

import { ApproveRefundDto } from './dto/approve-refund.dto';

import { CreateRefundDto } from './dto/create-refund.dto';

import { ProcessRefundDto } from './dto/process-refund.dto';

import { RejectRefundDto } from './dto/reject-refund.dto';

import { UpdateRefundDto } from './dto/update-refund.dto';

import { AdminRefundExportQueryDto } from './dto/admin-refund-export-query.dto';

import { AdminRefundNoteDto } from './dto/admin-refund-note.dto';

import { AdminQueryRefundDto } from './dto/admin-query-refund.dto';

import { AdminRefundExportService } from './services/admin-refund-export.service';

import { AdminRefundService } from './services/admin-refund.service';

import { RefundDecisionService } from './services/refund-decision.service';

import { RefundService } from './services/refund.service';

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

@ApiTags('Refund Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/refunds')
@UseGuards(JwtAuthGuard)
export class RefundAdminController {
  constructor(
    private readonly refundService: RefundService,
    private readonly refundDecisionService: RefundDecisionService,
    private readonly adminRefundService: AdminRefundService,
    private readonly adminRefundExportService: AdminRefundExportService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی بازگشت وجه‌ها',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryRefundDto,
  ) {
    this.assertRefundReader(req);

    return this.adminRefundService.findAll(query);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'دریافت داشبورد مدیریتی بازگشت وجه',
  })
  getDashboard(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryRefundDto,
  ) {
    this.assertRefundReader(req);

    return this.adminRefundService.getDashboard(query);
  }

  @Get('export')
  @ApiOperation({
    summary: 'خروجی گرفتن از بازگشت وجه‌ها',
  })
  async exportRefunds(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminRefundExportQueryDto,
    @Res() res: Response,
  ) {
    this.assertRefundReader(req);

    const result = await this.adminRefundExportService.exportRefunds(query);

    res.setHeader('Content-Type', result.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return res.send(result.content);
  }

  @Post()
  @ApiOperation({
    summary: 'ایجاد بازگشت وجه توسط ادمین',
  })
  createRefund(@Req() req: AuthenticatedRequest, @Body() dto: CreateRefundDto) {
    this.assertRefundManager(req);

    return this.refundService.createRefund(dto, {
      actorId: this.getUserId(req),
    });
  }

  @Get(':refundId')
  @ApiOperation({
    summary: 'دریافت جزئیات مدیریتی بازگشت وجه',
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertRefundReader(req);

    return this.adminRefundService.findOne(
      refundId,
      this.toBoolean(includeDeleted),
    );
  }

  @Get(':refundId/timeline')
  @ApiOperation({
    summary: 'دریافت تایم‌لاین بازگشت وجه',
  })
  getTimeline(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Query('limit') limit?: string,
  ) {
    this.assertRefundReader(req);

    const parsedLimit = limit ? Number(limit) : 100;

    return this.adminRefundService.getTimeline(
      refundId,
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 100,
    );
  }

  @Get(':refundId/notes')
  @ApiOperation({
    summary: 'دریافت یادداشت‌های مدیریتی بازگشت وجه',
  })
  getNotes(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Query('limit') limit?: string,
  ) {
    this.assertRefundReader(req);

    const parsedLimit = limit ? Number(limit) : 50;

    return this.adminRefundService.getNotes(
      refundId,
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 50,
    );
  }

  @Post(':refundId/notes')
  @ApiOperation({
    summary: 'ثبت یادداشت مدیریتی برای بازگشت وجه',
  })
  createNote(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Body() dto: AdminRefundNoteDto,
  ) {
    this.assertRefundManager(req);

    return this.adminRefundService.createNote(
      refundId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':refundId')
  @ApiOperation({
    summary: 'به‌روزرسانی بازگشت وجه',
  })
  updateRefund(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Body() dto: UpdateRefundDto,
  ) {
    this.assertRefundManager(req);

    return this.refundService.updateRefund(refundId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @Patch(':refundId/process')
  @ApiOperation({
    summary: 'پردازش وضعیت بازگشت وجه',
  })
  processRefund(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Body() dto: ProcessRefundDto,
  ) {
    this.assertRefundManager(req);

    return this.refundService.processRefund(refundId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @Patch(':refundId/approve')
  @ApiOperation({
    summary: 'تأیید بازگشت وجه',
  })
  approveRefund(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Body() dto: ApproveRefundDto,
  ) {
    this.assertRefundManager(req);

    return this.refundDecisionService.approveRefund(refundId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @Patch(':refundId/reject')
  @ApiOperation({
    summary: 'رد بازگشت وجه',
  })
  rejectRefund(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Body() dto: RejectRefundDto,
  ) {
    this.assertRefundManager(req);

    return this.refundDecisionService.rejectRefund(refundId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @Patch(':refundId/complete')
  @ApiOperation({
    summary: 'تکمیل بازگشت وجه',
  })
  completeRefund(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Body() dto: Partial<ProcessRefundDto>,
  ) {
    this.assertRefundManager(req);

    return this.refundService.completeRefund(refundId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @Patch(':refundId/fail')
  @ApiOperation({
    summary: 'ناموفق کردن بازگشت وجه',
  })
  failRefund(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
    @Body() dto: Partial<ProcessRefundDto>,
  ) {
    this.assertRefundManager(req);

    return this.refundService.failRefund(refundId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @Patch(':refundId/restore')
  @ApiOperation({
    summary: 'بازگردانی بازگشت وجه حذف‌شده',
  })
  restoreRefund(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
  ) {
    this.assertRefundManager(req);

    return this.adminRefundService.restore(refundId, this.getUserId(req));
  }

  @Delete(':refundId')
  @ApiOperation({
    summary: 'حذف نرم بازگشت وجه',
  })
  deleteRefund(
    @Req() req: AuthenticatedRequest,
    @Param('refundId') refundId: string,
  ) {
    this.assertRefundManager(req);

    return this.refundService.deleteRefund(refundId, {
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

  private assertRefundReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'refund:*',
        'refund:read',
        'refund:manage',
        'refunds:*',
        'refunds:read',
        'refunds:manage',
        'payment:*',
        'payment:read',
        'payments:*',
        'payments:read',
        'finance:read',
        'finance:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده مدیریت بازگشت وجه را ندارید.',
    );
  }

  private assertRefundManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'refund:*',
        'refund:manage',
        'refund:create',
        'refund:update',
        'refund:delete',
        'refunds:*',
        'refunds:manage',
        'refunds:create',
        'refunds:update',
        'refunds:delete',
        'payment:*',
        'payment:manage',
        'payments:*',
        'payments:manage',
        'finance:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت بازگشت وجه را ندارید.');
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
