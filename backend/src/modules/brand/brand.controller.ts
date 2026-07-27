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

import { BrandService } from './services/brand.service';

import { CreateBrandDto } from './dto/create-brand.dto';

import { QueryBrandDto } from './dto/query-brand.dto';

import { UpdateBrandDto } from './dto/update-brand.dto';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
  };
};

@Controller('brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Post('admin')
  @Permissions('catalog:manage')
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateBrandDto,
  ): unknown {
    return this.brandService.create(dto, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Get('admin')
  @AnyPermissions('catalog:read', 'catalog:manage', 'products:manage')
  findAllForAdmin(@Query() query: QueryBrandDto): unknown {
    return this.brandService.findAllForAdmin(query);
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Get('admin/slug/:slug')
  @AnyPermissions('catalog:read', 'catalog:manage', 'products:manage')
  findBySlugForAdmin(
    @Param('slug') slug: string,
    @Query('includeDeleted') includeDeleted?: string,
  ): unknown {
    return this.brandService.findBySlugForAdmin(
      slug,
      includeDeleted === 'true',
    );
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Get('admin/:brandId')
  @AnyPermissions('catalog:read', 'catalog:manage', 'products:manage')
  findOneForAdmin(
    @Param('brandId') brandId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ): unknown {
    return this.brandService.findOneForAdmin(
      brandId,
      includeDeleted === 'true',
    );
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Patch('admin/:brandId')
  @Permissions('catalog:manage')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
    @Body() dto: UpdateBrandDto,
  ): unknown {
    return this.brandService.update(brandId, dto, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Patch('admin/:brandId/activate')
  @Permissions('catalog:manage')
  activate(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
  ): unknown {
    return this.brandService.activate(brandId, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Patch('admin/:brandId/deactivate')
  @Permissions('catalog:manage')
  deactivate(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
  ): unknown {
    return this.brandService.deactivate(brandId, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Patch('admin/:brandId/restore')
  @Permissions('catalog:manage')
  restore(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
  ): unknown {
    return this.brandService.restore(brandId, this.getUserId(req));
  }

  @UseGuards(AuthGuard('jwt'), RbacGuard)
  @Delete('admin/:brandId')
  @Permissions('catalog:manage')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
  ): unknown {
    return this.brandService.remove(brandId, this.getUserId(req));
  }

  @Get()
  findAllPublic(@Query() query: QueryBrandDto): unknown {
    return this.brandService.findAllPublic(query);
  }

  @Get('slug/:slug')
  findBySlugPublic(@Param('slug') slug: string): unknown {
    return this.brandService.findBySlugPublic(slug);
  }

  @Get(':brandId')
  findOnePublic(@Param('brandId') brandId: string): unknown {
    return this.brandService.findOnePublic(brandId);
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }
}
