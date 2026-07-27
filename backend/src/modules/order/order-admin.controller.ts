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

import { Request } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AdminOrderNoteDto } from './dto/admin-order-note.dto';

import { AdminQueryOrderDto } from './dto/admin-query-order.dto';

import { AdminUpdateOrderDto } from './dto/admin-update-order.dto';

import { AdminUpdateOrderPaymentStatusDto } from './dto/admin-update-order-payment-status.dto';

import { AdminUpdateOrderStatusDto } from './dto/admin-update-order-status.dto';

import { AdminOrderService } from './services/admin-order.service';

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

@ApiTags('Order Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/orders')
@UseGuards(JwtAuthGuard)
export class OrderAdminController {
  constructor(private readonly adminOrderService: AdminOrderService) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی سفارش‌ها',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryOrderDto,
  ) {
    this.assertOrderReader(req);

    return this.adminOrderService.findAll(query);
  }

  @Get(':orderId')
  @ApiOperation({
    summary: 'دریافت جزئیات مدیریتی سفارش',
  })
  findOne(@Req() req: AuthenticatedRequest, @Param('orderId') orderId: string) {
    this.assertOrderReader(req);

    return this.adminOrderService.findOne(orderId);
  }

  @Get(':orderId/timeline')
  @ApiOperation({
    summary: 'دریافت تایم‌لاین سفارش',
  })
  getTimeline(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Query('limit') limit?: string,
  ) {
    this.assertOrderReader(req);

    const parsedLimit = limit ? Number(limit) : 100;

    return this.adminOrderService.getTimeline(
      orderId,
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 100,
    );
  }

  @Get(':orderId/notes')
  @ApiOperation({
    summary: 'دریافت یادداشت‌های مدیریتی سفارش',
  })
  getNotes(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Query('limit') limit?: string,
  ) {
    this.assertOrderReader(req);

    const parsedLimit = limit ? Number(limit) : 50;

    return this.adminOrderService.getNotes(
      orderId,
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 50,
    );
  }

  @Post(':orderId/notes')
  @ApiOperation({
    summary: 'ثبت یادداشت مدیریتی برای سفارش',
  })
  createNote(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: AdminOrderNoteDto,
  ) {
    this.assertOrderManager(req);

    return this.adminOrderService.createNote(orderId, dto, this.getUserId(req));
  }

  @Patch(':orderId')
  @ApiOperation({
    summary: 'به‌روزرسانی اطلاعات سفارش',
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: AdminUpdateOrderDto,
  ) {
    this.assertOrderManager(req);

    return this.adminOrderService.update(orderId, dto, this.getUserId(req));
  }

  @Patch(':orderId/status')
  @ApiOperation({
    summary: 'به‌روزرسانی وضعیت سفارش',
  })
  updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: AdminUpdateOrderStatusDto,
  ) {
    this.assertOrderManager(req);

    return this.adminOrderService.updateStatus(
      orderId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':orderId/payment-status')
  @ApiOperation({
    summary: 'به‌روزرسانی وضعیت پرداخت سفارش',
  })
  updatePaymentStatus(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: AdminUpdateOrderPaymentStatusDto,
  ) {
    this.assertOrderManager(req);

    return this.adminOrderService.updatePaymentStatus(
      orderId,
      dto,
      this.getUserId(req),
    );
  }

  @Delete(':orderId')
  @ApiOperation({
    summary: 'حذف نرم سفارش',
  })
  delete(@Req() req: AuthenticatedRequest, @Param('orderId') orderId: string) {
    this.assertOrderManager(req);

    return this.adminOrderService.delete(orderId, this.getUserId(req));
  }

  @Patch(':orderId/restore')
  @ApiOperation({
    summary: 'بازگردانی سفارش حذف‌شده',
  })
  restore(@Req() req: AuthenticatedRequest, @Param('orderId') orderId: string) {
    this.assertOrderManager(req);

    return this.adminOrderService.restore(orderId, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertOrderReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'orders:*',
        'orders:read',
        'orders:manage',
        'order:*',
        'order:read',
        'order:manage',
        'sales:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت سفارش‌ها را ندارید.');
  }

  private assertOrderManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'orders:*',
        'orders:manage',
        'order:*',
        'order:manage',
        'sales:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت سفارش‌ها را ندارید.');
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
}
