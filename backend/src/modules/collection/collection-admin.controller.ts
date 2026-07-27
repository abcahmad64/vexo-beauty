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

import { AdminCollectionProductsDto } from './dto/admin-collection-products.dto';

import { AdminCreateCollectionDto } from './dto/admin-create-collection.dto';

import { AdminQueryCollectionDto } from './dto/admin-query-collection.dto';

import { AdminUpdateCollectionDto } from './dto/admin-update-collection.dto';

import { AdminCollectionService } from './services/admin-collection.service';

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

@ApiTags('Collection Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/collections')
@UseGuards(JwtAuthGuard)
export class CollectionAdminController {
  constructor(
    private readonly adminCollectionService: AdminCollectionService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی کالکشن‌ها',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryCollectionDto,
  ) {
    this.assertCollectionReader(req);

    return this.adminCollectionService.findAll(query);
  }

  @Post()
  @ApiOperation({
    summary: 'ایجاد کالکشن مدیریتی',
  })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateCollectionDto,
  ) {
    this.assertCollectionManager(req);

    return this.adminCollectionService.create(dto, this.getUserId(req));
  }

  @Get(':collectionId')
  @ApiOperation({
    summary: 'دریافت جزئیات مدیریتی کالکشن',
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('collectionId') collectionId: string,
  ) {
    this.assertCollectionReader(req);

    return this.adminCollectionService.findOne(collectionId);
  }

  @Patch(':collectionId')
  @ApiOperation({
    summary: 'به‌روزرسانی کالکشن',
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('collectionId') collectionId: string,
    @Body() dto: AdminUpdateCollectionDto,
  ) {
    this.assertCollectionManager(req);

    return this.adminCollectionService.update(
      collectionId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':collectionId/products')
  @ApiOperation({
    summary: 'مدیریت محصولات داخل کالکشن',
  })
  updateProducts(
    @Req() req: AuthenticatedRequest,
    @Param('collectionId') collectionId: string,
    @Body() dto: AdminCollectionProductsDto,
  ) {
    this.assertCollectionManager(req);

    return this.adminCollectionService.updateProducts(
      collectionId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':collectionId/activate')
  @ApiOperation({
    summary: 'فعال‌سازی کالکشن',
  })
  activate(
    @Req() req: AuthenticatedRequest,
    @Param('collectionId') collectionId: string,
  ) {
    this.assertCollectionManager(req);

    return this.adminCollectionService.activate(
      collectionId,
      this.getUserId(req),
    );
  }

  @Patch(':collectionId/deactivate')
  @ApiOperation({
    summary: 'غیرفعال‌سازی کالکشن',
  })
  deactivate(
    @Req() req: AuthenticatedRequest,
    @Param('collectionId') collectionId: string,
  ) {
    this.assertCollectionManager(req);

    return this.adminCollectionService.deactivate(
      collectionId,
      this.getUserId(req),
    );
  }

  @Delete(':collectionId')
  @ApiOperation({
    summary: 'حذف نرم کالکشن',
  })
  delete(
    @Req() req: AuthenticatedRequest,
    @Param('collectionId') collectionId: string,
  ) {
    this.assertCollectionManager(req);

    return this.adminCollectionService.delete(
      collectionId,
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

  private assertCollectionReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'collection:*',
        'collection:read',
        'collections:*',
        'collections:read',
        'catalog:*',
        'catalog:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت کالکشن‌ها را ندارید.');
  }

  private assertCollectionManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'collection:*',
        'collection:manage',
        'collections:*',
        'collections:manage',
        'catalog:*',
        'catalog:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت کالکشن‌ها را ندارید.');
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
