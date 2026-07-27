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

import { AdminCreateProductVariantDto } from './dto/admin-create-product-variant.dto';

import { AdminQueryProductVariantDto } from './dto/admin-query-product-variant.dto';

import { AdminUpdateProductVariantDto } from './dto/admin-update-product-variant.dto';

import { AdminUpdateVariantPriceDto } from './dto/admin-update-variant-price.dto';

import { AdminUpdateVariantStockDto } from './dto/admin-update-variant-stock.dto';

import { AdminProductVariantPriceService } from './services/admin-product-variant-price.service';

import { AdminProductVariantService } from './services/admin-product-variant.service';

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

@ApiTags('Product Variant Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/product-variants')
@UseGuards(JwtAuthGuard)
export class ProductVariantAdminController {
  constructor(
    private readonly adminProductVariantService: AdminProductVariantService,
    private readonly adminProductVariantPriceService: AdminProductVariantPriceService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی واریانت‌های محصول',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryProductVariantDto,
  ): unknown {
    this.assertVariantReader(req);

    return this.adminProductVariantService.findAll(query);
  }

  @Post()
  @ApiOperation({
    summary: 'ایجاد واریانت محصول',
  })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateProductVariantDto,
  ): unknown {
    this.assertVariantManager(req);

    return this.adminProductVariantService.create(dto, this.getUserId(req));
  }

  @Get(':variantId')
  @ApiOperation({
    summary: 'دریافت جزئیات واریانت محصول',
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
  ): unknown {
    this.assertVariantReader(req);

    return this.adminProductVariantService.findOne(variantId);
  }

  @Patch(':variantId')
  @ApiOperation({
    summary: 'به‌روزرسانی واریانت محصول',
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
    @Body() dto: AdminUpdateProductVariantDto,
  ): unknown {
    this.assertVariantManager(req);

    return this.adminProductVariantService.update(
      variantId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':variantId/price')
  @ApiOperation({
    summary: 'به‌روزرسانی قیمت واریانت محصول',
  })
  updatePrice(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
    @Body() dto: AdminUpdateVariantPriceDto,
  ): unknown {
    this.assertVariantManager(req);

    return this.adminProductVariantPriceService.updatePrice(
      variantId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':variantId/stock')
  @ApiOperation({
    summary: 'به‌روزرسانی موجودی واریانت محصول',
  })
  updateStock(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
    @Body() dto: AdminUpdateVariantStockDto,
  ): unknown {
    this.assertVariantManager(req);

    return this.adminProductVariantService.updateStock(
      variantId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':variantId/activate')
  @ApiOperation({
    summary: 'فعال‌سازی واریانت محصول',
  })
  activate(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
  ): unknown {
    this.assertVariantManager(req);

    return this.adminProductVariantService.activate(
      variantId,
      this.getUserId(req),
    );
  }

  @Patch(':variantId/deactivate')
  @ApiOperation({
    summary: 'غیرفعال‌سازی واریانت محصول',
  })
  deactivate(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
  ): unknown {
    this.assertVariantManager(req);

    return this.adminProductVariantService.deactivate(
      variantId,
      this.getUserId(req),
    );
  }

  @Delete(':variantId')
  @ApiOperation({
    summary: 'حذف نرم واریانت محصول',
  })
  delete(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
  ): unknown {
    this.assertVariantManager(req);

    return this.adminProductVariantService.delete(
      variantId,
      this.getUserId(req),
    );
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertVariantReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'product:*',
        'product:read',
        'products:*',
        'products:read',
        'catalog:*',
        'catalog:read',
        'inventory:*',
        'inventory:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده مدیریت واریانت‌های محصول را ندارید.',
    );
  }

  private assertVariantManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'product:*',
        'product:manage',
        'products:*',
        'products:manage',
        'catalog:*',
        'catalog:manage',
        'inventory:*',
        'inventory:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مدیریت واریانت‌های محصول را ندارید.',
    );
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
}
