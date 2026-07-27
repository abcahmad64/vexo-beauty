import {
  Body,
  Controller,
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

import { AdminPrepareShipmentDto } from './dto/admin-prepare-shipment.dto';

import { AdminQueryShipmentDto } from './dto/admin-query-shipment.dto';

import { AdminShipmentExportQueryDto } from './dto/admin-shipment-export-query.dto';

import { AdminShipmentNoteDto } from './dto/admin-shipment-note.dto';

import { AdminUpdateShipmentDto } from './dto/admin-update-shipment.dto';

import { AdminUpdateShipmentStatusDto } from './dto/admin-update-shipment-status.dto';

import { AdminShipmentExportService } from './services/admin-shipment-export.service';

import { AdminShipmentService } from './services/admin-shipment.service';

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

@ApiTags('Shipment Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/shipments')
@UseGuards(JwtAuthGuard)
export class ShipmentAdminController {
  constructor(
    private readonly adminShipmentService: AdminShipmentService,
    private readonly adminShipmentExportService: AdminShipmentExportService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی ارسال‌ها',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryShipmentDto,
  ) {
    this.assertShipmentReader(req);

    return this.adminShipmentService.findAll(query);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'دریافت داشبورد مدیریتی ارسال‌ها',
  })
  getDashboard(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryShipmentDto,
  ) {
    this.assertShipmentReader(req);

    return this.adminShipmentService.getDashboard(query);
  }

  @Get('export')
  @ApiOperation({
    summary: 'خروجی گرفتن از ارسال‌ها',
  })
  async exportShipments(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminShipmentExportQueryDto,
    @Res() res: Response,
  ) {
    this.assertShipmentReader(req);

    const result = await this.adminShipmentExportService.exportShipments(query);

    res.setHeader('Content-Type', result.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return res.send(result.content);
  }

  @Get(':orderId')
  @ApiOperation({
    summary: 'دریافت جزئیات مدیریتی ارسال سفارش',
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertShipmentReader(req);

    return this.adminShipmentService.findOne(
      orderId,
      this.toBoolean(includeDeleted),
    );
  }

  @Get(':orderId/tracking')
  @ApiOperation({
    summary: 'دریافت وضعیت رهگیری ارسال سفارش',
  })
  getTracking(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    this.assertShipmentReader(req);

    return this.adminShipmentService.getTracking(orderId);
  }

  @Get(':orderId/timeline')
  @ApiOperation({
    summary: 'دریافت تایم‌لاین ارسال سفارش',
  })
  getTimeline(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Query('limit') limit?: string,
  ) {
    this.assertShipmentReader(req);

    const parsedLimit = limit ? Number(limit) : 100;

    return this.adminShipmentService.getTimeline(
      orderId,
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 100,
    );
  }

  @Get(':orderId/notes')
  @ApiOperation({
    summary: 'دریافت یادداشت‌های مدیریتی ارسال سفارش',
  })
  getNotes(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Query('limit') limit?: string,
  ) {
    this.assertShipmentReader(req);

    const parsedLimit = limit ? Number(limit) : 50;

    return this.adminShipmentService.getNotes(
      orderId,
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 50,
    );
  }

  @Post(':orderId/notes')
  @ApiOperation({
    summary: 'ثبت یادداشت مدیریتی برای ارسال سفارش',
  })
  createNote(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: AdminShipmentNoteDto,
  ) {
    this.assertShipmentManager(req);

    return this.adminShipmentService.createNote(
      orderId,
      dto,
      this.getUserId(req),
    );
  }

  @Post('orders/:orderId/prepare')
  @ApiOperation({
    summary: 'آماده‌سازی ارسال سفارش',
  })
  prepareShipment(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: AdminPrepareShipmentDto,
  ) {
    this.assertShipmentManager(req);

    return this.adminShipmentService.prepareShipment(
      orderId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('orders/:orderId')
  @ApiOperation({
    summary: 'به‌روزرسانی اطلاعات ارسال سفارش',
  })
  updateShipment(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: AdminUpdateShipmentDto,
  ) {
    this.assertShipmentManager(req);

    return this.adminShipmentService.updateShipment(
      orderId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('orders/:orderId/status')
  @ApiOperation({
    summary: 'به‌روزرسانی وضعیت ارسال سفارش',
  })
  updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: AdminUpdateShipmentStatusDto,
  ) {
    this.assertShipmentManager(req);

    return this.adminShipmentService.updateStatus(
      orderId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('orders/:orderId/ship')
  @ApiOperation({
    summary: 'ثبت ارسال‌شدن سفارش',
  })
  markAsShipped(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: Partial<AdminUpdateShipmentStatusDto>,
  ) {
    this.assertShipmentManager(req);

    return this.adminShipmentService.markAsShipped(
      orderId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('orders/:orderId/deliver')
  @ApiOperation({
    summary: 'ثبت تحویل سفارش',
  })
  markAsDelivered(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: Partial<AdminUpdateShipmentStatusDto>,
  ) {
    this.assertShipmentManager(req);

    return this.adminShipmentService.markAsDelivered(
      orderId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('orders/:orderId/cancel')
  @ApiOperation({
    summary: 'لغو ارسال سفارش',
  })
  cancelShipment(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: Partial<AdminUpdateShipmentStatusDto>,
  ) {
    this.assertShipmentManager(req);

    return this.adminShipmentService.cancelShipment(
      orderId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('orders/:orderId/restore')
  @ApiOperation({
    summary: 'بازگردانی سفارش حذف‌شده مرتبط با ارسال',
  })
  restore(@Req() req: AuthenticatedRequest, @Param('orderId') orderId: string) {
    this.assertShipmentManager(req);

    return this.adminShipmentService.restore(orderId, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertShipmentReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'shipment:*',
        'shipment:read',
        'shipment:manage',
        'shipments:*',
        'shipments:read',
        'shipments:manage',
        'orders:*',
        'orders:read',
        'orders:manage',
        'order:*',
        'order:read',
        'order:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت ارسال‌ها را ندارید.');
  }

  private assertShipmentManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'shipment:*',
        'shipment:manage',
        'shipment:update',
        'shipments:*',
        'shipments:manage',
        'shipments:update',
        'orders:*',
        'orders:manage',
        'orders:update',
        'order:*',
        'order:manage',
        'order:update',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت ارسال‌ها را ندارید.');
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
