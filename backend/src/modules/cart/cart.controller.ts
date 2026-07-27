import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AddCartItemDto } from './dto/add-cart-item.dto';

import { MergeCartDto } from './dto/merge-cart.dto';

import { UpdateCartItemDto } from './dto/update-cart-item.dto';

import { CartService } from './services/cart.service';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
  };
};

@ApiTags('Cart')
@ApiBearerAuth('access-token')
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت سبد خرید کاربر',
  })
  getMyCart(@Req() req: AuthenticatedRequest): Promise<unknown> {
    return this.cartService.getMyCart(this.getUserId(req));
  }

  @Post('items')
  @ApiOperation({
    summary: 'افزودن آیتم به سبد خرید',
  })
  addItem(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AddCartItemDto,
  ): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.cartService.addItem(userId, dto, userId);
  }

  @Patch('items/:cartItemId')
  @ApiOperation({
    summary: 'به‌روزرسانی آیتم سبد خرید',
  })
  updateItem(
    @Req() req: AuthenticatedRequest,
    @Param('cartItemId') cartItemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.cartService.updateItem(userId, cartItemId, dto, userId);
  }

  @Delete('items/:cartItemId')
  @ApiOperation({
    summary: 'حذف آیتم از سبد خرید',
  })
  removeItem(
    @Req() req: AuthenticatedRequest,
    @Param('cartItemId') cartItemId: string,
  ): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.cartService.removeItem(userId, cartItemId, userId);
  }

  @Delete()
  @ApiOperation({
    summary: 'خالی‌کردن سبد خرید',
  })
  clearCart(@Req() req: AuthenticatedRequest): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.cartService.clearCart(userId, userId);
  }

  @Post('merge')
  @ApiOperation({
    summary: 'ادغام سبد خرید مهمان با سبد خرید کاربر',
  })
  mergeCart(
    @Req() req: AuthenticatedRequest,
    @Body() dto: MergeCartDto,
  ): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.cartService.mergeCart(userId, dto, userId);
  }

  @Patch('refresh-prices')
  @ApiOperation({
    summary: 'به‌روزرسانی قیمت‌های سبد خرید',
  })
  refreshPrices(@Req() req: AuthenticatedRequest): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.cartService.refreshPrices(userId, userId);
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }
}
