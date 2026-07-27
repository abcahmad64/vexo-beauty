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
  StreamableFile,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import type { Request, Response } from 'express';

import { CancelInvoiceDto } from './dto/cancel-invoice.dto';

import { CreateInvoiceDto } from './dto/create-invoice.dto';

import { IssueInvoiceDto } from './dto/issue-invoice.dto';

import { QueryInvoiceDto } from './dto/query-invoice.dto';

import { UpdateInvoiceDto } from './dto/update-invoice.dto';

import { InvoicePdfService } from './services/invoice-pdf.service';

import type { InvoicePdfFileResult } from './services/invoice-pdf.service';

import { InvoiceService } from './services/invoice.service';

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

@Controller('invoices')
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('admin')
  createInvoice(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateInvoiceDto,
  ) {
    this.assertInvoiceManager(req);

    return this.invoiceService.createInvoice(dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin')
  findAllForAdmin(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryInvoiceDto,
  ) {
    this.assertInvoiceReader(req);

    return this.invoiceService.findAllForAdmin(query);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/:invoiceId/pdf')
  async downloadInvoicePdfForAdmin(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Res({
      passthrough: true,
    })
    res: Response,
  ): Promise<StreamableFile> {
    this.assertInvoiceReader(req);

    await this.invoiceService.findOneForAdmin(invoiceId, false);

    const pdfFile = await this.invoicePdfService.getOrCreatePdfFile(invoiceId);

    return this.streamPdfFile(pdfFile, res);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/:invoiceId')
  findOneForAdmin(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertInvoiceReader(req);

    return this.invoiceService.findOneForAdmin(
      invoiceId,
      this.toBoolean(includeDeleted),
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:invoiceId')
  updateInvoice(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    this.assertInvoiceManager(req);

    return this.invoiceService.updateInvoice(invoiceId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:invoiceId/issue')
  issueInvoice(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: IssueInvoiceDto,
  ) {
    this.assertInvoiceManager(req);

    return this.invoiceService.issueInvoice(invoiceId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:invoiceId/cancel')
  cancelInvoice(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: CancelInvoiceDto,
  ) {
    this.assertInvoiceManager(req);

    return this.invoiceService.cancelInvoice(invoiceId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('admin/:invoiceId')
  deleteInvoice(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ) {
    this.assertInvoiceManager(req);

    return this.invoiceService.deleteInvoice(invoiceId, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my/by-number/:invoiceNumber')
  findMyInvoiceByNumber(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceNumber') invoiceNumber: string,
  ) {
    return this.invoiceService.findByInvoiceNumberForUser(
      this.getUserId(req),
      invoiceNumber,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my')
  findMyInvoices(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryInvoiceDto,
  ) {
    return this.invoiceService.findAllForUser(this.getUserId(req), query);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my/:invoiceId/pdf')
  async downloadMyInvoicePdf(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
    @Res({
      passthrough: true,
    })
    res: Response,
  ): Promise<StreamableFile> {
    await this.invoiceService.findOneForUser(this.getUserId(req), invoiceId);

    const pdfFile = await this.invoicePdfService.getOrCreatePdfFile(invoiceId);

    return this.streamPdfFile(pdfFile, res);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my/:invoiceId')
  findMyInvoice(
    @Req() req: AuthenticatedRequest,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.invoiceService.findOneForUser(this.getUserId(req), invoiceId);
  }

  private streamPdfFile(
    pdfFile: InvoicePdfFileResult,
    res: Response,
  ): StreamableFile {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdfFile.sizeBytes),
      'Content-Disposition': this.createContentDisposition(pdfFile.fileName),
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    });

    return new StreamableFile(
      this.invoicePdfService.createPdfReadStream(pdfFile.filePath),
    );
  }

  private createContentDisposition(fileName: string): string {
    const safeAsciiFileName = fileName.replace(/[^A-Za-z0-9_.-]/g, '_');

    return [
      `inline; filename="${safeAsciiFileName}"`,
      `filename*=UTF-8''${encodeURIComponent(fileName)}`,
    ].join('; ');
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
        'invoice:*',
        'invoice:read',
        'invoices:*',
        'invoices:read',
        'orders:*',
        'orders:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما اجازه مشاهده فاکتورها را ندارید.');
  }

  private assertInvoiceManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
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
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما اجازه مدیریت فاکتورها را ندارید.');
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
