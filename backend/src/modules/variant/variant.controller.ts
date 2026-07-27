import {
  Body,
  Controller,
  Delete,
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

import {
  AnyPermissions,
  Permissions,
} from '../rbac/decorators/permissions.decorator';

import { RbacGuard } from '../rbac/guards/rbac.guard';

import { CreateVariantDto } from './dto/create-variant.dto';

import { QueryVariantDto } from './dto/query-variant.dto';

import { UpdateVariantDto } from './dto/update-variant.dto';

import { VariantService } from './services/variant.service';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
  };
};

@Controller('variants')
export class VariantController {
  constructor(private readonly variantService: VariantService) {}

  @Get('products/:productId')
  findPublicByProduct(
    @Param('productId') productId: string,
    @Query() query: QueryVariantDto,
  ) {
    return this.variantService.findPublicByProduct(productId, query);
  }

  @Get('sku/:sku')
  findBySkuPublic(@Param('sku') sku: string) {
    return this.variantService.findBySkuPublic(sku);
  }

  @Get(':variantId')
  findOnePublic(@Param('variantId') variantId: string) {
    return this.variantService.findOnePublic(variantId);
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Post('admin/products/:productId')
  @Permissions('products:manage')
  create(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.variantService.create(productId, dto, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Get('admin')
  @AnyPermissions(
    'products:read',
    'products:manage',
    'inventory:read',
    'inventory:manage',
  )
  findAllForAdmin(@Query() query: QueryVariantDto) {
    return this.variantService.findAllForAdmin(query);
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Get('admin/products/:productId')
  @AnyPermissions(
    'products:read',
    'products:manage',
    'inventory:read',
    'inventory:manage',
  )
  findByProductForAdmin(
    @Param('productId') productId: string,
    @Query() query: QueryVariantDto,
  ) {
    return this.variantService.findByProductForAdmin(productId, query);
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Get('admin/sku/:sku')
  @AnyPermissions(
    'products:read',
    'products:manage',
    'inventory:read',
    'inventory:manage',
  )
  findBySkuForAdmin(
    @Param('sku') sku: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.variantService.findBySkuForAdmin(
      sku,
      includeDeleted === 'true',
    );
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Get('admin/:variantId')
  @AnyPermissions(
    'products:read',
    'products:manage',
    'inventory:read',
    'inventory:manage',
  )
  findOneForAdmin(
    @Param('variantId') variantId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.variantService.findOneForAdmin(
      variantId,
      includeDeleted === 'true',
    );
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Patch('admin/:variantId')
  @Permissions('products:manage')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.variantService.update(variantId, dto, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Patch('admin/:variantId/activate')
  @Permissions('products:manage')
  activate(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
  ) {
    return this.variantService.activate(variantId, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Patch('admin/:variantId/deactivate')
  @Permissions('products:manage')
  deactivate(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
  ) {
    return this.variantService.deactivate(variantId, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Patch('admin/:variantId/restore')
  @Permissions('products:manage')
  restore(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
  ) {
    return this.variantService.restore(variantId, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Delete('admin/:variantId')
  @Permissions('products:manage')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
  ) {
    return this.variantService.remove(variantId, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    return userId;
  }
}
