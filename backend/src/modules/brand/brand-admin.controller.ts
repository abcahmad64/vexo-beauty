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

import { AdminBrandSeoDto } from './dto/admin-brand-seo.dto';

import { AdminCreateBrandDto } from './dto/admin-create-brand.dto';

import { AdminQueryBrandDto } from './dto/admin-query-brand.dto';

import { AdminUpdateBrandDto } from './dto/admin-update-brand.dto';

import { AdminBrandService } from './services/admin-brand.service';

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

@ApiTags('Brand Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/brands')
@UseGuards(JwtAuthGuard)
export class BrandAdminController {
  constructor(private readonly adminBrandService: AdminBrandService) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی برندها',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryBrandDto,
  ): unknown {
    this.assertBrandReader(req);

    return this.adminBrandService.findAll(query);
  }

  @Post()
  @ApiOperation({
    summary: 'ایجاد برند مدیریتی',
  })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateBrandDto,
  ): unknown {
    this.assertBrandManager(req);

    return this.adminBrandService.create(dto, this.getUserId(req));
  }

  @Get(':brandId')
  @ApiOperation({
    summary: 'دریافت جزئیات مدیریتی برند',
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
  ): unknown {
    this.assertBrandReader(req);

    return this.adminBrandService.findOne(brandId);
  }

  @Patch(':brandId')
  @ApiOperation({
    summary: 'به‌روزرسانی برند',
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
    @Body() dto: AdminUpdateBrandDto,
  ): unknown {
    this.assertBrandManager(req);

    return this.adminBrandService.update(brandId, dto, this.getUserId(req));
  }

  @Patch(':brandId/activate')
  @ApiOperation({
    summary: 'فعال‌سازی برند',
  })
  activate(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
  ): unknown {
    this.assertBrandManager(req);

    return this.adminBrandService.activate(brandId, this.getUserId(req));
  }

  @Patch(':brandId/deactivate')
  @ApiOperation({
    summary: 'غیرفعال‌سازی برند',
  })
  deactivate(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
  ): unknown {
    this.assertBrandManager(req);

    return this.adminBrandService.deactivate(brandId, this.getUserId(req));
  }

  @Patch(':brandId/restore')
  @ApiOperation({
    summary: 'بازیابی برند حذف‌شده',
  })
  restore(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
  ): unknown {
    this.assertBrandManager(req);

    return this.adminBrandService.restore(brandId, this.getUserId(req));
  }

  @Delete(':brandId')
  @ApiOperation({
    summary: 'حذف نرم برند',
  })
  delete(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
  ): unknown {
    this.assertBrandManager(req);

    return this.adminBrandService.delete(brandId, this.getUserId(req));
  }

  @Get(':brandId/seo')
  @ApiOperation({
    summary: 'دریافت تنظیمات SEO برند',
  })
  getSeo(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
  ): unknown {
    this.assertBrandReader(req);

    return this.adminBrandService.getSeo(brandId);
  }

  @Patch(':brandId/seo')
  @ApiOperation({
    summary: 'به‌روزرسانی SEO برند',
  })
  updateSeo(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
    @Body() dto: AdminBrandSeoDto,
  ): unknown {
    this.assertBrandManager(req);

    return this.adminBrandService.updateSeo(brandId, dto, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertBrandReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'brand:*',
        'brand:read',
        'brands:*',
        'brands:read',
        'catalog:*',
        'catalog:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت برندها را ندارید.');
  }

  private assertBrandManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'brand:*',
        'brand:manage',
        'brands:*',
        'brands:manage',
        'catalog:*',
        'catalog:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت برندها را ندارید.');
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
