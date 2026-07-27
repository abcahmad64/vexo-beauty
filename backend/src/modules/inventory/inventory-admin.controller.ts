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
  Res,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Request, Response } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AdminAdjustStockDto } from './dto/admin-adjust-stock.dto';

import { AdminInventoryExportQueryDto } from './dto/admin-inventory-export-query.dto';

import { AdminLowStockRuleDto } from './dto/admin-low-stock-rule.dto';

import { AdminQueryInventoryDto } from './dto/admin-query-inventory.dto';

import { AdminTransferStockDto } from './dto/admin-transfer-stock.dto';

import { AdminInventoryExportService } from './services/admin-inventory-export.service';

import { AdminInventoryService } from './services/admin-inventory.service';

import { AdminStockAdjustmentService } from './services/admin-stock-adjustment.service';

import { AdminStockTransferService } from './services/admin-stock-transfer.service';

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

@ApiTags('Inventory Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/inventory')
@UseGuards(JwtAuthGuard)
export class InventoryAdminController {
  constructor(
    private readonly adminInventoryService: AdminInventoryService,
    private readonly adminStockAdjustmentService: AdminStockAdjustmentService,
    private readonly adminStockTransferService: AdminStockTransferService,
    private readonly adminInventoryExportService: AdminInventoryExportService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی موجودی',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryInventoryDto,
  ): unknown {
    this.assertInventoryReader(req);

    return this.adminInventoryService.findAll(query);
  }

  @Get('low-stock')
  @ApiOperation({
    summary: 'دریافت موجودی‌های کم',
  })
  findLowStock(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryInventoryDto,
  ): unknown {
    this.assertInventoryReader(req);

    return this.adminInventoryService.findLowStock(query);
  }

  @Get('export')
  @ApiOperation({
    summary: 'خروجی گرفتن از موجودی',
  })
  async exportInventory(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminInventoryExportQueryDto,
    @Res() res: Response,
  ): Promise<unknown> {
    this.assertInventoryReader(req);

    const result =
      await this.adminInventoryExportService.exportInventory(query);

    res.setHeader('Content-Type', result.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return res.send(result.content);
  }

  @Post('adjust')
  @ApiOperation({
    summary: 'اصلاح موجودی انبار',
  })
  adjustStock(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminAdjustStockDto,
  ): unknown {
    this.assertInventoryManager(req);

    return this.adminStockAdjustmentService.adjustStock(
      dto,
      this.getUserId(req),
    );
  }

  @Post('transfer')
  @ApiOperation({
    summary: 'انتقال موجودی بین انبارها',
  })
  transferStock(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminTransferStockDto,
  ): unknown {
    this.assertInventoryManager(req);

    return this.adminStockTransferService.transferStock(
      dto,
      this.getUserId(req),
    );
  }

  @Patch('low-stock-rule')
  @ApiOperation({
    summary: 'تنظیم حداقل موجودی',
  })
  updateLowStockRule(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminLowStockRuleDto,
  ): unknown {
    this.assertInventoryManager(req);

    return this.adminInventoryService.updateLowStockRule(
      dto,
      this.getUserId(req),
    );
  }

  @Get(':inventoryId')
  @ApiOperation({
    summary: 'دریافت جزئیات مدیریتی موجودی',
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('inventoryId') inventoryId: string,
  ): unknown {
    this.assertInventoryReader(req);

    return this.adminInventoryService.findOne(inventoryId);
  }

  @Get(':inventoryId/movements')
  @ApiOperation({
    summary: 'دریافت گردش موجودی',
  })
  findMovements(
    @Req() req: AuthenticatedRequest,
    @Param('inventoryId') inventoryId: string,
    @Query('limit') limit?: string,
  ): unknown {
    this.assertInventoryReader(req);

    const parsedLimit = limit ? Number(limit) : 100;

    return this.adminInventoryService.findMovements(
      inventoryId,
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 100,
    );
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
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
        'warehouse:*',
        'warehouse:read',
        'catalog:*',
        'catalog:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت موجودی را ندارید.');
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
        'catalog:*',
        'catalog:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت موجودی را ندارید.');
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
