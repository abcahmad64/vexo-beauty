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

import { AdminAttachInvoicePdfDto } from './dto/admin-attach-invoice-pdf.dto';

import { AdminCreateInvoiceDto } from './dto/admin-create-invoice.dto';

import { AdminGenerateInvoicePdfDto } from './dto/admin-generate-invoice-pdf.dto';

import { AdminInvoiceExportQueryDto } from './dto/admin-invoice-export-query.dto';

import { AdminInvoiceNoteDto } from './dto/admin-invoice-note.dto';

import { AdminQueryInvoiceDto } from './dto/admin-query-invoice.dto';

import { AdminUpdateInvoiceDto } from './dto/admin-update-invoice.dto';

import { AdminUpdateInvoiceStatusDto } from './dto/admin-update-invoice-status.dto';

import { AdminInvoiceExportService } from './services/admin-invoice-export.service';

import { AdminInvoiceService } from './services/admin-invoice.service';

import { InvoicePdfService } from './services/invoice-pdf.service';

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

@ApiTags('Invoice Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/invoices')
@UseGuards(JwtAuthGuard)
export class InvoiceAdminController {
  constructor(
    private readonly adminInvoiceService: AdminInvoiceService,
    private readonly adminInvoiceExportService: AdminInvoiceExportService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی فاکتورها',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryInvoiceDto,
  ) {
    this.assertInvoiceReader(req);

    return this.adminInvoiceService.findAll(query);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'دریافت داشبورد مدیریتی فاکتورها',
  })
  getDashboard(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryInvoiceDto,
  ) {
    this.assertInvoiceReader(req);

    return this.adminInvoiceService.getDashboard(query);
  }

  @Get('export')
  @ApiOperation({
    summary: 'خروجی گرفتن از فاکتورها',
  })
  async exportInvoices(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminInvoiceExportQueryDto,
    @Res() res: Response,
  ) {
    this.assertInvoiceReader(req);

    const result = await this.adminInvoiceExportService.exportInvoices(query);

    res.setHeader('Content-Type', result.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return res.send(result.content);
  }

  @Post()
  @ApiOperation({
    summary: 'ایجاد فاکتور توسط ادمین',
  })
  create(@Req() req: AuthenticatedRequest, @Body() dto: AdminCreateInvoiceDto) {
    this.assertInvoiceManager(req);

    return this.adminInvoiceService.create(dto, this.getUserId(req));
  }

  @Get(':invoiceId')
  @ApiOperation({
    summary: 'دریافت جزئیات مدیریتی فاکتور',
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertInvoiceReader(req);

    return this.adminInvoiceService.findOne(
      invoiceId,
      this.toBoolean(includeDeleted),
    );
  }

  @Get(':invoiceId/timeline')
  @ApiOperation({
    summary: 'دریافت تایم‌لاین فاکتور',
  })
  getTimeline(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Query('limit') limit?: string,
  ) {
    this.assertInvoiceReader(req);

    const parsedLimit = limit ? Number(limit) : 100;

    return this.adminInvoiceService.getTimeline(
      invoiceId,
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 100,
    );
  }

  @Get(':invoiceId/notes')
  @ApiOperation({
    summary: 'دریافت یادداشت‌های مدیریتی فاکتور',
  })
  getNotes(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Query('limit') limit?: string,
  ) {
    this.assertInvoiceReader(req);

    const parsedLimit = limit ? Number(limit) : 50;

    return this.adminInvoiceService.getNotes(
      invoiceId,
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 50,
    );
  }

  @Post(':invoiceId/notes')
  @ApiOperation({
    summary: 'ثبت یادداشت مدیریتی برای فاکتور',
  })
  createNote(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: AdminInvoiceNoteDto,
  ) {
    this.assertInvoiceManager(req);

    return this.adminInvoiceService.createNote(
      invoiceId,
      dto,
      this.getUserId(req),
    );
  }

  @Delete(':invoiceId/notes/:noteId')
  @ApiOperation({
    summary: 'حذف یادداشت مدیریتی فاکتور',
  })
  deleteNote(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Param('noteId') noteId: string,
  ) {
    this.assertInvoiceManager(req);

    return this.adminInvoiceService.deleteNote(
      invoiceId,
      noteId,
      this.getUserId(req),
    );
  }

  @Patch(':invoiceId')
  @ApiOperation({
    summary: 'به‌روزرسانی اطلاعات فاکتور',
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: AdminUpdateInvoiceDto,
  ) {
    this.assertInvoiceManager(req);

    return this.adminInvoiceService.update(invoiceId, dto, this.getUserId(req));
  }

  @Patch(':invoiceId/status')
  @ApiOperation({
    summary: 'به‌روزرسانی وضعیت فاکتور',
  })
  updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: AdminUpdateInvoiceStatusDto,
  ) {
    this.assertInvoiceManager(req);

    return this.adminInvoiceService.updateStatus(
      invoiceId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':invoiceId/issue')
  @ApiOperation({
    summary: 'صدور فاکتور',
  })
  issue(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ) {
    this.assertInvoiceManager(req);

    return this.adminInvoiceService.issue(invoiceId, this.getUserId(req));
  }

  @Patch(':invoiceId/cancel')
  @ApiOperation({
    summary: 'لغو فاکتور',
  })
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: Partial<AdminUpdateInvoiceStatusDto>,
  ) {
    this.assertInvoiceManager(req);

    return this.adminInvoiceService.cancel(
      invoiceId,
      dto.reason,
      this.getUserId(req),
    );
  }

  @Patch(':invoiceId/pdf')
  @ApiOperation({
    summary: 'ثبت لینک PDF فاکتور',
  })
  attachPdf(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: AdminAttachInvoicePdfDto,
  ) {
    this.assertInvoiceManager(req);

    return this.adminInvoiceService.attachPdf(
      invoiceId,
      dto,
      this.getUserId(req),
    );
  }

  @Post(':invoiceId/pdf/generate')
  @ApiOperation({
    summary: 'تولید یا بازتولید PDF فاکتور',
  })
  async generatePdf(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: AdminGenerateInvoicePdfDto,
  ) {
    this.assertInvoiceManager(req);

    await this.adminInvoiceService.findInvoiceRow(invoiceId, false);

    const result = await this.invoicePdfService.generatePdfForInvoice(
      invoiceId,
      dto.regenerate === true,
    );

    return {
      result,
      invoice: await this.adminInvoiceService.findOne(invoiceId, true),
      audit: {
        actorId: this.getUserId(req),
        action: 'invoice.pdf_generated',
      },
    };
  }

  @Patch(':invoiceId/restore')
  @ApiOperation({
    summary: 'بازگردانی فاکتور حذف‌شده',
  })
  restore(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ) {
    this.assertInvoiceManager(req);

    return this.adminInvoiceService.restore(invoiceId, this.getUserId(req));
  }

  @Delete(':invoiceId')
  @ApiOperation({
    summary: 'حذف نرم فاکتور',
  })
  delete(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ) {
    this.assertInvoiceManager(req);

    return this.adminInvoiceService.delete(invoiceId, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertInvoiceReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'invoice:*',
        'invoice:read',
        'invoice:manage',
        'invoices:*',
        'invoices:read',
        'invoices:manage',
        'orders:*',
        'orders:read',
        'order:*',
        'order:read',
        'finance:read',
        'finance:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت فاکتورها را ندارید.');
  }

  private assertInvoiceManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'invoice:*',
        'invoice:manage',
        'invoice:create',
        'invoice:update',
        'invoice:delete',
        'invoices:*',
        'invoices:manage',
        'invoices:create',
        'invoices:update',
        'invoices:delete',
        'finance:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت فاکتورها را ندارید.');
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
