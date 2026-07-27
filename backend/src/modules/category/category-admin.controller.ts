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

import { AdminCategorySeoDto } from './dto/admin-category-seo.dto';

import { AdminCreateCategoryDto } from './dto/admin-create-category.dto';

import { AdminQueryCategoryDto } from './dto/admin-query-category.dto';

import { AdminReorderCategoryDto } from './dto/admin-reorder-category.dto';

import { AdminUpdateCategoryDto } from './dto/admin-update-category.dto';

import { AdminCategoryService } from './services/admin-category.service';

import { AdminCategoryTreeService } from './services/admin-category-tree.service';

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

@ApiTags('Category Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/categories')
@UseGuards(JwtAuthGuard)
export class CategoryAdminController {
  constructor(
    private readonly adminCategoryService: AdminCategoryService,
    private readonly adminCategoryTreeService: AdminCategoryTreeService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی دسته‌بندی‌ها',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryCategoryDto,
  ): unknown {
    this.assertCategoryReader(req);

    return this.adminCategoryService.findAll(query);
  }

  @Get('tree')
  @ApiOperation({
    summary: 'دریافت درخت مدیریتی دسته‌بندی‌ها',
  })
  getTree(
    @Req() req: AuthenticatedRequest,
    @Query('includeInactive') includeInactive?: string,
  ): unknown {
    this.assertCategoryReader(req);

    return this.adminCategoryTreeService.getTree(
      includeInactive === 'true' || includeInactive === '1',
    );
  }

  @Post()
  @ApiOperation({
    summary: 'ایجاد دسته‌بندی مدیریتی',
  })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateCategoryDto,
  ): unknown {
    this.assertCategoryManager(req);

    return this.adminCategoryService.create(dto, this.getUserId(req));
  }

  @Patch('reorder')
  @ApiOperation({
    summary: 'مرتب‌سازی دسته‌بندی‌ها',
  })
  reorder(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminReorderCategoryDto,
  ): unknown {
    this.assertCategoryManager(req);

    return this.adminCategoryService.reorder(dto, this.getUserId(req));
  }

  @Get(':categoryId')
  @ApiOperation({
    summary: 'دریافت جزئیات مدیریتی دسته‌بندی',
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
  ): unknown {
    this.assertCategoryReader(req);

    return this.adminCategoryService.findOne(categoryId);
  }

  @Patch(':categoryId')
  @ApiOperation({
    summary: 'به‌روزرسانی دسته‌بندی',
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
    @Body() dto: AdminUpdateCategoryDto,
  ): unknown {
    this.assertCategoryManager(req);

    return this.adminCategoryService.update(
      categoryId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':categoryId/activate')
  @ApiOperation({
    summary: 'فعال‌سازی دسته‌بندی',
  })
  activate(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
  ): unknown {
    this.assertCategoryManager(req);

    return this.adminCategoryService.activate(categoryId, this.getUserId(req));
  }

  @Patch(':categoryId/deactivate')
  @ApiOperation({
    summary: 'غیرفعال‌سازی دسته‌بندی',
  })
  deactivate(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
  ): unknown {
    this.assertCategoryManager(req);

    return this.adminCategoryService.deactivate(
      categoryId,
      this.getUserId(req),
    );
  }

  @Patch(':categoryId/restore')
  @ApiOperation({
    summary: 'بازیابی دسته‌بندی حذف‌شده',
  })
  restore(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
  ): unknown {
    this.assertCategoryManager(req);

    return this.adminCategoryService.restore(categoryId, this.getUserId(req));
  }

  @Delete(':categoryId')
  @ApiOperation({
    summary: 'حذف نرم دسته‌بندی',
  })
  delete(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
  ): unknown {
    this.assertCategoryManager(req);

    return this.adminCategoryService.delete(categoryId, this.getUserId(req));
  }

  @Get(':categoryId/seo')
  @ApiOperation({
    summary: 'دریافت تنظیمات SEO دسته‌بندی',
  })
  getSeo(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
  ): unknown {
    this.assertCategoryReader(req);

    return this.adminCategoryService.getSeo(categoryId);
  }

  @Patch(':categoryId/seo')
  @ApiOperation({
    summary: 'به‌روزرسانی SEO دسته‌بندی',
  })
  updateSeo(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
    @Body() dto: AdminCategorySeoDto,
  ): unknown {
    this.assertCategoryManager(req);

    return this.adminCategoryService.updateSeo(
      categoryId,
      dto,
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

  private assertCategoryReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'category:*',
        'category:read',
        'categories:*',
        'categories:read',
        'catalog:*',
        'catalog:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده مدیریت دسته‌بندی‌ها را ندارید.',
    );
  }

  private assertCategoryManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'category:*',
        'category:manage',
        'categories:*',
        'categories:manage',
        'catalog:*',
        'catalog:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت دسته‌بندی‌ها را ندارید.');
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
