import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';

import { QueryWishlistDto } from './dto/query-wishlist.dto';

import { WishlistService } from './services/wishlist.service';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
  };
};

type MergeWishlistBody = {
  productIds: string[];
};

@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  getMyWishlist(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryWishlistDto,
  ): Promise<unknown> {
    return this.wishlistService.getMyWishlist(this.getUserId(req), query);
  }

  @Post('items')
  addItem(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AddWishlistItemDto,
  ): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.wishlistService.addItem(userId, dto, userId);
  }

  @Get('products/:productId/status')
  isProductInWishlist(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
  ): Promise<unknown> {
    return this.wishlistService.isProductInWishlist(
      this.getUserId(req),
      productId,
    );
  }

  @Delete('items/:wishlistItemId')
  removeItem(
    @Req() req: AuthenticatedRequest,
    @Param('wishlistItemId') wishlistItemId: string,
  ): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.wishlistService.removeItem(userId, wishlistItemId, userId);
  }

  @Delete('products/:productId')
  removeProduct(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
  ): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.wishlistService.removeProduct(userId, productId, userId);
  }

  @Delete()
  clearWishlist(@Req() req: AuthenticatedRequest): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.wishlistService.clearWishlist(userId, userId);
  }

  @Post('merge')
  mergeWishlist(
    @Req() req: AuthenticatedRequest,
    @Body() dto: MergeWishlistBody,
  ): Promise<unknown> {
    const userId = this.getUserId(req);

    return this.wishlistService.mergeWishlist(userId, dto, userId);
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }
}
