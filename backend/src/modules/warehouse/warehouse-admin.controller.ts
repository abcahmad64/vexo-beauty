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

import { AdminCreateWarehouseDto } from './dto/admin-create-warehouse.dto';

import { AdminQueryWarehouseDto } from './dto/admin-query-warehouse.dto';

import { AdminUpdateWarehouseDto } from './dto/admin-update-warehouse.dto';

import { AdminWarehouseService } from './services/admin-warehouse.service';

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

@ApiTags('Warehouse Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/warehouses')
@UseGuards(JwtAuthGuard)
export class WarehouseAdminController {
  constructor(private readonly adminWarehouseService: AdminWarehouseService) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی انبارها',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryWarehouseDto,
  ) {
    this.assertWarehouseReader(req);

    return this.adminWarehouseService.findAll(query);
  }

  @Post()
  @ApiOperation({
    summary: 'ایجاد انبار مدیریتی',
  })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateWarehouseDto,
  ) {
    this.assertWarehouseManager(req);

    return this.adminWarehouseService.create(dto, this.getUserId(req));
  }

  @Get(':warehouseId')
  @ApiOperation({
    summary: 'دریافت جزئیات مدیریتی انبار',
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('warehouseId') warehouseId: string,
  ) {
    this.assertWarehouseReader(req);

    return this.adminWarehouseService.findOne(warehouseId);
  }

  @Patch(':warehouseId')
  @ApiOperation({
    summary: 'به‌روزرسانی انبار',
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('warehouseId') warehouseId: string,
    @Body() dto: AdminUpdateWarehouseDto,
  ) {
    this.assertWarehouseManager(req);

    return this.adminWarehouseService.update(
      warehouseId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':warehouseId/activate')
  @ApiOperation({
    summary: 'فعال‌سازی انبار',
  })
  activate(
    @Req() req: AuthenticatedRequest,
    @Param('warehouseId') warehouseId: string,
  ) {
    this.assertWarehouseManager(req);

    return this.adminWarehouseService.activate(
      warehouseId,
      this.getUserId(req),
    );
  }

  @Patch(':warehouseId/deactivate')
  @ApiOperation({
    summary: 'غیرفعال‌سازی انبار',
  })
  deactivate(
    @Req() req: AuthenticatedRequest,
    @Param('warehouseId') warehouseId: string,
  ) {
    this.assertWarehouseManager(req);

    return this.adminWarehouseService.deactivate(
      warehouseId,
      this.getUserId(req),
    );
  }

  @Delete(':warehouseId')
  @ApiOperation({
    summary: 'حذف انبار بدون موجودی',
  })
  delete(
    @Req() req: AuthenticatedRequest,
    @Param('warehouseId') warehouseId: string,
  ) {
    this.assertWarehouseManager(req);

    return this.adminWarehouseService.delete(warehouseId, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertWarehouseReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'warehouse:*',
        'warehouse:read',
        'warehouses:*',
        'warehouses:read',
        'inventory:*',
        'inventory:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت انبارها را ندارید.');
  }

  private assertWarehouseManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'warehouse:*',
        'warehouse:manage',
        'warehouses:*',
        'warehouses:manage',
        'inventory:*',
        'inventory:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت انبارها را ندارید.');
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
