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
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import type { Request } from 'express';

import { CreateShipmentDto } from './dto/create-shipment.dto';

import { QueryShipmentDto } from './dto/query-shipment.dto';

import { TrackShipmentDto } from './dto/track-shipment.dto';

import { UpdateShipmentDto } from './dto/update-shipment.dto';

import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';

import { ShipmentService } from './services/shipment.service';

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

@Controller('shipments')
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('admin')
  findAllForAdmin(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryShipmentDto,
  ) {
    this.assertShipmentReader(req);

    return this.shipmentService.findAllForAdmin(query);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/:orderId')
  findOneForAdmin(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertShipmentReader(req);

    return this.shipmentService.findOneForAdmin(
      orderId,
      this.toBoolean(includeDeleted),
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('admin/orders/:orderId')
  createShipment(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: CreateShipmentDto,
  ) {
    this.assertShipmentManager(req);

    return this.shipmentService.createShipment(orderId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/orders/:orderId')
  updateShipment(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateShipmentDto,
  ) {
    this.assertShipmentManager(req);

    return this.shipmentService.updateShipment(orderId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/orders/:orderId/status')
  updateShipmentStatus(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateShipmentStatusDto,
  ) {
    this.assertShipmentManager(req);

    return this.shipmentService.updateShipmentStatus(orderId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/orders/:orderId/ship')
  markAsShipped(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: Partial<UpdateShipmentStatusDto>,
  ) {
    this.assertShipmentManager(req);

    return this.shipmentService.markAsShipped(orderId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/orders/:orderId/deliver')
  markAsDelivered(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: Partial<UpdateShipmentStatusDto>,
  ) {
    this.assertShipmentManager(req);

    return this.shipmentService.markAsDelivered(orderId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/orders/:orderId/cancel')
  cancelShipment(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: Partial<UpdateShipmentStatusDto>,
  ) {
    this.assertShipmentManager(req);

    return this.shipmentService.cancelShipment(orderId, dto, {
      actorId: this.getUserId(req),
    });
  }

  @Post('track')
  trackShipment(@Body() dto: TrackShipmentDto) {
    return this.shipmentService.trackShipment(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my')
  findMyShipments(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryShipmentDto,
  ) {
    return this.shipmentService.findAllForUser(this.getUserId(req), query);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my/:orderId')
  findMyShipment(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    return this.shipmentService.findOneForUser(this.getUserId(req), orderId);
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
        'shipment:*',
        'shipment:read',
        'shipments:*',
        'shipments:read',
        'orders:*',
        'orders:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما اجازه مشاهده اطلاعات ارسال سفارش‌ها را ندارید.',
    );
  }

  private assertShipmentManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'shipment:*',
        'shipment:manage',
        'shipment:update',
        'shipments:*',
        'shipments:manage',
        'shipments:update',
        'orders:*',
        'orders:manage',
        'orders:update',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما اجازه مدیریت ارسال سفارش‌ها را ندارید.');
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
