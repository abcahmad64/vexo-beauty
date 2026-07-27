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
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { Request } from 'express';

import { CreateOrderDto } from './dto/create-order.dto';

import { CreateOrderFromCartDto } from './dto/create-order-from-cart.dto';

import { QueryOrderDto } from './dto/query-order.dto';

import { UpdateOrderDto } from './dto/update-order.dto';

import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

import { OrderService } from './services/order.service';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
    role?:
      | string
      | {
          name?: string;
        };
    roleName?: string;
    permissions?: string[];
  };
};

@Controller('orders')
@UseGuards(AuthGuard('jwt'))
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    const userId = this.getUserId(req);

    return this.orderService.create(userId, dto, userId);
  }

  @Post('from-cart')
  createFromCart(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateOrderFromCartDto,
  ) {
    const userId = this.getUserId(req);

    return this.orderService.createFromCart(userId, dto, userId);
  }

  @Get('my')
  findMyOrders(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryOrderDto,
  ) {
    return this.orderService.findAllForUser(this.getUserId(req), query);
  }

  @Get('my/:orderId')
  findMyOrder(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    return this.orderService.findOneForUser(this.getUserId(req), orderId);
  }

  @Patch('my/:orderId/cancel')
  cancelMyOrder(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body()
    body: {
      reason?: string;
    },
  ) {
    const userId = this.getUserId(req);

    return this.orderService.cancelForUser(userId, orderId, body.reason);
  }

  @Get('admin')
  findAllForAdmin(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryOrderDto,
  ) {
    this.assertOrderManager(req);

    return this.orderService.findAllForAdmin(query);
  }

  @Get('admin/:orderId')
  findOneForAdmin(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
  ) {
    this.assertOrderManager(req);

    return this.orderService.findOneForAdmin(orderId);
  }

  @Patch('admin/:orderId')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderDto,
  ) {
    this.assertOrderManager(req);

    return this.orderService.update(orderId, dto, this.getUserId(req));
  }

  @Patch('admin/:orderId/status')
  updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    this.assertOrderManager(req);

    return this.orderService.updateStatus(orderId, dto, this.getUserId(req));
  }

  @Delete('admin/:orderId')
  remove(@Req() req: AuthenticatedRequest, @Param('orderId') orderId: string) {
    this.assertOrderManager(req);

    return this.orderService.remove(orderId, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    return userId;
  }

  private assertOrderManager(req: AuthenticatedRequest): void {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName);

    const normalizedRole = role?.toUpperCase();

    const permissions = new Set(req.user?.permissions ?? []);

    const allowed =
      normalizedRole === 'ADMIN' ||
      normalizedRole === 'SUPER_ADMIN' ||
      permissions.has('order:manage') ||
      permissions.has('orders:manage') ||
      permissions.has('sales:manage');

    if (!allowed) {
      throw new ForbiddenException(
        'You do not have permission to manage orders',
      );
    }
  }
}
