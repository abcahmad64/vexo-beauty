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

import { AdminCreateHomeSectionDto } from './dto/admin-create-home-section.dto';

import { AdminQueryHomeSectionDto } from './dto/admin-query-home-section.dto';

import {
  AdminHomeSectionProductsDto,
  AdminReorderHomeSectionDto,
} from './dto/admin-reorder-home-section.dto';

import { AdminUpdateHomeSectionDto } from './dto/admin-update-home-section.dto';

import { AdminHomeSectionService } from './services/admin-home-section.service';

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

@ApiTags('Homepage Section Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/home-sections')
@UseGuards(JwtAuthGuard)
export class HomeSectionAdminController {
  constructor(
    private readonly adminHomeSectionService: AdminHomeSectionService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی سکشن‌های صفحه اصلی',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryHomeSectionDto,
  ) {
    this.assertHomeSectionReader(req);

    return this.adminHomeSectionService.findAll(query);
  }

  @Post()
  @ApiOperation({
    summary: 'ایجاد سکشن صفحه اصلی',
  })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateHomeSectionDto,
  ) {
    this.assertHomeSectionManager(req);

    return this.adminHomeSectionService.create(dto, this.getUserId(req));
  }

  @Patch('reorder')
  @ApiOperation({
    summary: 'مرتب‌سازی سکشن‌های صفحه اصلی',
  })
  reorder(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminReorderHomeSectionDto,
  ) {
    this.assertHomeSectionManager(req);

    return this.adminHomeSectionService.reorder(dto, this.getUserId(req));
  }

  @Get(':sectionId')
  @ApiOperation({
    summary: 'دریافت جزئیات سکشن صفحه اصلی',
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('sectionId') sectionId: string,
  ) {
    this.assertHomeSectionReader(req);

    return this.adminHomeSectionService.findOne(sectionId);
  }

  @Patch(':sectionId')
  @ApiOperation({
    summary: 'به‌روزرسانی سکشن صفحه اصلی',
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('sectionId') sectionId: string,
    @Body() dto: AdminUpdateHomeSectionDto,
  ) {
    this.assertHomeSectionManager(req);

    return this.adminHomeSectionService.update(
      sectionId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':sectionId/products/replace')
  @ApiOperation({
    summary: 'جایگزینی محصولات دستی سکشن صفحه اصلی',
  })
  replaceProducts(
    @Req() req: AuthenticatedRequest,
    @Param('sectionId') sectionId: string,
    @Body() dto: AdminHomeSectionProductsDto,
  ) {
    this.assertHomeSectionManager(req);

    return this.adminHomeSectionService.replaceProducts(
      sectionId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':sectionId/products/add')
  @ApiOperation({
    summary: 'افزودن محصولات به سکشن صفحه اصلی',
  })
  addProducts(
    @Req() req: AuthenticatedRequest,
    @Param('sectionId') sectionId: string,
    @Body() dto: AdminHomeSectionProductsDto,
  ) {
    this.assertHomeSectionManager(req);

    return this.adminHomeSectionService.addProducts(
      sectionId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':sectionId/products/remove')
  @ApiOperation({
    summary: 'حذف محصولات از سکشن صفحه اصلی',
  })
  removeProducts(
    @Req() req: AuthenticatedRequest,
    @Param('sectionId') sectionId: string,
    @Body() dto: AdminHomeSectionProductsDto,
  ) {
    this.assertHomeSectionManager(req);

    return this.adminHomeSectionService.removeProducts(
      sectionId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':sectionId/activate')
  @ApiOperation({
    summary: 'فعال‌سازی سکشن صفحه اصلی',
  })
  activate(
    @Req() req: AuthenticatedRequest,
    @Param('sectionId') sectionId: string,
  ) {
    this.assertHomeSectionManager(req);

    return this.adminHomeSectionService.activate(
      sectionId,
      this.getUserId(req),
    );
  }

  @Patch(':sectionId/deactivate')
  @ApiOperation({
    summary: 'غیرفعال‌سازی سکشن صفحه اصلی',
  })
  deactivate(
    @Req() req: AuthenticatedRequest,
    @Param('sectionId') sectionId: string,
  ) {
    this.assertHomeSectionManager(req);

    return this.adminHomeSectionService.deactivate(
      sectionId,
      this.getUserId(req),
    );
  }

  @Delete(':sectionId')
  @ApiOperation({
    summary: 'حذف نرم سکشن صفحه اصلی',
  })
  delete(
    @Req() req: AuthenticatedRequest,
    @Param('sectionId') sectionId: string,
  ) {
    this.assertHomeSectionManager(req);

    return this.adminHomeSectionService.delete(sectionId, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertHomeSectionReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'homepage:*',
        'homepage:read',
        'content:*',
        'content:read',
        'catalog:*',
        'catalog:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت صفحه اصلی را ندارید.');
  }

  private assertHomeSectionManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'homepage:*',
        'homepage:manage',
        'content:*',
        'content:manage',
        'catalog:*',
        'catalog:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت صفحه اصلی را ندارید.');
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
