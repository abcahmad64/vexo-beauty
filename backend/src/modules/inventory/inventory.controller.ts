import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AdjustStockDto } from './dto/adjust-stock.dto';

import { CommitReservedStockDto } from './dto/commit-reserved-stock.dto';

import { CreateInventoryDto } from './dto/create-inventory.dto';

import { CreateWarehouseDto } from './dto/create-warehouse.dto';

import { QueryInventoryDto } from './dto/query-inventory.dto';

import { QueryStockMovementDto } from './dto/query-stock-movement.dto';

import { ReserveStockDto } from './dto/reserve-stock.dto';

import { UpdateInventoryDto } from './dto/update-inventory.dto';

import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

import { InventoryService } from './services/inventory.service';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
    role?:
      | string
      | {
          name?: string;
        };
    roleName?: string;
    permissions?: string[];
  };
};

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('warehouses')
  createWarehouse(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateWarehouseDto,
  ): unknown {
    this.assertInventoryManager(req);

    return this.inventoryService.createWarehouse(dto, this.getUserId(req));
  }

  @Get('warehouses')
  findWarehouses(
    @Req() req: AuthenticatedRequest,
    @Query('q') q?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): unknown {
    this.assertInventoryReader(req);

    return this.inventoryService.findWarehouses({
      q,
      isActive:
        isActive === undefined
          ? undefined
          : isActive === 'true' || isActive === '1',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('warehouses/:warehouseId')
  findWarehouse(
    @Req() req: AuthenticatedRequest,
    @Param('warehouseId') warehouseId: string,
  ): unknown {
    this.assertInventoryReader(req);

    return this.inventoryService.findWarehouse(warehouseId);
  }

  @Patch('warehouses/:warehouseId')
  updateWarehouse(
    @Req() req: AuthenticatedRequest,
    @Param('warehouseId') warehouseId: string,
    @Body() dto: UpdateWarehouseDto,
  ): unknown {
    this.assertInventoryManager(req);

    return this.inventoryService.updateWarehouse(
      warehouseId,
      dto,
      this.getUserId(req),
    );
  }

  @Post()
  createInventory(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateInventoryDto,
  ): unknown {
    this.assertInventoryManager(req);

    return this.inventoryService.createInventory(dto, this.getUserId(req));
  }

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryInventoryDto,
  ): unknown {
    this.assertInventoryReader(req);

    return this.inventoryService.findAll(query);
  }

  @Get('low-stock')
  getLowStock(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryInventoryDto,
  ): unknown {
    this.assertInventoryReader(req);

    return this.inventoryService.getLowStock(query);
  }

  @Get('movements')
  findMovements(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryStockMovementDto,
  ): unknown {
    this.assertInventoryReader(req);

    return this.inventoryService.findMovements(query);
  }

  @Get('variant/:variantId')
  findByVariant(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
  ): unknown {
    this.assertInventoryReader(req);

    return this.inventoryService.findByVariant(variantId);
  }

  @Get(':inventoryId')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('inventoryId') inventoryId: string,
  ): unknown {
    this.assertInventoryReader(req);

    return this.inventoryService.findOne(inventoryId);
  }

  @Patch(':inventoryId')
  updateInventory(
    @Req() req: AuthenticatedRequest,
    @Param('inventoryId') inventoryId: string,
    @Body() dto: UpdateInventoryDto,
  ): unknown {
    this.assertInventoryManager(req);

    return this.inventoryService.updateInventory(
      inventoryId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':inventoryId/adjust')
  adjustStock(
    @Req() req: AuthenticatedRequest,
    @Param('inventoryId') inventoryId: string,
    @Body() dto: AdjustStockDto,
  ): unknown {
    this.assertInventoryManager(req);

    return this.inventoryService.adjustStock(
      inventoryId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':inventoryId/reserve')
  reserveStock(
    @Req() req: AuthenticatedRequest,
    @Param('inventoryId') inventoryId: string,
    @Body() dto: ReserveStockDto,
  ): unknown {
    this.assertInventoryManager(req);

    return this.inventoryService.reserveStock(
      inventoryId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':inventoryId/release')
  releaseStock(
    @Req() req: AuthenticatedRequest,
    @Param('inventoryId') inventoryId: string,
    @Body() dto: ReserveStockDto,
  ): unknown {
    this.assertInventoryManager(req);

    return this.inventoryService.releaseStock(
      inventoryId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':inventoryId/commit-reserved')
  commitReservedStock(
    @Req() req: AuthenticatedRequest,
    @Param('inventoryId') inventoryId: string,
    @Body() dto: CommitReservedStockDto,
  ): unknown {
    this.assertInventoryManager(req);

    return this.inventoryService.commitReservedStock(
      inventoryId,
      dto,
      this.getUserId(req),
    );
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertInventoryReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'inventory:*',
        'inventory:read',
        'inventory:manage',
        'warehouse:*',
        'warehouse:read',
        'products:manage',
        'catalog:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده موجودی را ندارید.');
  }

  private assertInventoryManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'inventory:*',
        'inventory:manage',
        'warehouse:*',
        'warehouse:manage',
        'products:manage',
        'catalog:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت موجودی را ندارید.');
  }

  private hasAdminRole(req: AuthenticatedRequest): boolean {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName);

    const normalizedRole = role?.toUpperCase();

    return normalizedRole === 'ADMIN' || normalizedRole === 'SUPER_ADMIN';
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
