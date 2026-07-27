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

import { AdminCreateAttributeDto } from './dto/admin-create-attribute.dto';

import { AdminCreateAttributeValueDto } from './dto/admin-create-attribute-value.dto';

import { AdminQueryAttributeDto } from './dto/admin-query-attribute.dto';

import { AdminUpdateAttributeDto } from './dto/admin-update-attribute.dto';

import { AdminUpdateAttributeValueDto } from './dto/admin-update-attribute-value.dto';

import { SyncProductAttributesDto } from './dto/sync-product-attributes.dto';

import { SyncVariantAttributesDto } from './dto/sync-variant-attributes.dto';

import { AdminAttributeService } from './services/admin-attribute.service';

import { AdminAttributeValueService } from './services/admin-attribute-value.service';

import { AttributeService } from './services/attribute.service';

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

@ApiTags('Attribute Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/attributes')
@UseGuards(JwtAuthGuard)
export class AttributeAdminController {
  constructor(
    private readonly adminAttributeService: AdminAttributeService,
    private readonly adminAttributeValueService: AdminAttributeValueService,
    private readonly attributeService: AttributeService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی ویژگی‌ها',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryAttributeDto,
  ): unknown {
    this.assertAttributeReader(req);

    return this.adminAttributeService.findAll(query);
  }

  @Post()
  @ApiOperation({
    summary: 'ایجاد ویژگی مدیریتی',
  })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateAttributeDto,
  ): unknown {
    this.assertAttributeManager(req);

    return this.adminAttributeService.create(dto, this.getUserId(req));
  }

  @Get('values')
  @ApiOperation({
    summary: 'دریافت تمام مقادیر ویژگی‌ها',
  })
  findValues(
    @Req() req: AuthenticatedRequest,
    @Query('includeDeleted') includeDeleted?: string,
  ): unknown {
    this.assertAttributeReader(req);

    return this.adminAttributeValueService.findAll(
      this.toBoolean(includeDeleted),
    );
  }

  @Post('values')
  @ApiOperation({
    summary: 'ایجاد مقدار ویژگی با attributeId داخل Body',
  })
  createValueGlobal(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateAttributeValueDto,
  ): unknown {
    this.assertAttributeManager(req);

    return this.adminAttributeValueService.create(
      dto.attributeId ?? '',
      dto,
      this.getUserId(req),
    );
  }

  @Patch('products/:productId')
  @ApiOperation({
    summary: 'همگام‌سازی ویژگی‌های محصول',
  })
  syncProductAttributes(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: SyncProductAttributesDto,
  ): unknown {
    this.assertAttributeManager(req);

    return this.attributeService.syncProductAttributes(
      productId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('variants/:variantId')
  @ApiOperation({
    summary: 'همگام‌سازی ویژگی‌های تنوع محصول',
  })
  syncVariantAttributes(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
    @Body() dto: SyncVariantAttributesDto,
  ): unknown {
    this.assertAttributeManager(req);

    return this.attributeService.syncVariantAttributes(
      variantId,
      dto,
      this.getUserId(req),
    );
  }

  @Get(':attributeId')
  @ApiOperation({
    summary: 'دریافت جزئیات مدیریتی ویژگی',
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('attributeId') attributeId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ): unknown {
    this.assertAttributeReader(req);

    return this.adminAttributeService.findOne(
      attributeId,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch(':attributeId')
  @ApiOperation({
    summary: 'به‌روزرسانی ویژگی',
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('attributeId') attributeId: string,
    @Body() dto: AdminUpdateAttributeDto,
  ): unknown {
    this.assertAttributeManager(req);

    return this.adminAttributeService.update(
      attributeId,
      dto,
      this.getUserId(req),
    );
  }

  @Delete(':attributeId')
  @ApiOperation({
    summary: 'حذف نرم ویژگی',
  })
  delete(
    @Req() req: AuthenticatedRequest,
    @Param('attributeId') attributeId: string,
  ): unknown {
    this.assertAttributeManager(req);

    return this.adminAttributeService.delete(attributeId, this.getUserId(req));
  }

  @Patch(':attributeId/restore')
  @ApiOperation({
    summary: 'بازگردانی ویژگی حذف‌شده',
  })
  restore(
    @Req() req: AuthenticatedRequest,
    @Param('attributeId') attributeId: string,
  ): unknown {
    this.assertAttributeManager(req);

    return this.adminAttributeService.restore(attributeId, this.getUserId(req));
  }

  @Get(':attributeId/values')
  @ApiOperation({
    summary: 'دریافت مقادیر یک ویژگی',
  })
  findValuesByAttribute(
    @Req() req: AuthenticatedRequest,
    @Param('attributeId') attributeId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ): unknown {
    this.assertAttributeReader(req);

    return this.adminAttributeValueService.findByAttribute(
      attributeId,
      this.toBoolean(includeDeleted),
    );
  }

  @Post(':attributeId/values')
  @ApiOperation({
    summary: 'ایجاد مقدار برای یک ویژگی',
  })
  createValue(
    @Req() req: AuthenticatedRequest,
    @Param('attributeId') attributeId: string,
    @Body() dto: AdminCreateAttributeValueDto,
  ): unknown {
    this.assertAttributeManager(req);

    return this.adminAttributeValueService.create(
      attributeId,
      dto,
      this.getUserId(req),
    );
  }

  @Get('values/:attributeValueId')
  @ApiOperation({
    summary: 'دریافت جزئیات مقدار ویژگی',
  })
  findValue(
    @Req() req: AuthenticatedRequest,
    @Param('attributeValueId') attributeValueId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ): unknown {
    this.assertAttributeReader(req);

    return this.adminAttributeValueService.findOne(
      attributeValueId,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch('values/:attributeValueId')
  @ApiOperation({
    summary: 'به‌روزرسانی مقدار ویژگی',
  })
  updateValue(
    @Req() req: AuthenticatedRequest,
    @Param('attributeValueId') attributeValueId: string,
    @Body() dto: AdminUpdateAttributeValueDto,
  ): unknown {
    this.assertAttributeManager(req);

    return this.adminAttributeValueService.update(
      attributeValueId,
      dto,
      this.getUserId(req),
    );
  }

  @Delete('values/:attributeValueId')
  @ApiOperation({
    summary: 'حذف نرم مقدار ویژگی',
  })
  deleteValue(
    @Req() req: AuthenticatedRequest,
    @Param('attributeValueId') attributeValueId: string,
  ): unknown {
    this.assertAttributeManager(req);

    return this.adminAttributeValueService.delete(
      attributeValueId,
      this.getUserId(req),
    );
  }

  @Patch('values/:attributeValueId/restore')
  @ApiOperation({
    summary: 'بازگردانی مقدار ویژگی حذف‌شده',
  })
  restoreValue(
    @Req() req: AuthenticatedRequest,
    @Param('attributeValueId') attributeValueId: string,
  ): unknown {
    this.assertAttributeManager(req);

    return this.adminAttributeValueService.restore(
      attributeValueId,
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

  private assertAttributeReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'attribute:*',
        'attribute:read',
        'attributes:*',
        'attributes:read',
        'catalog:*',
        'catalog:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت ویژگی‌ها را ندارید.');
  }

  private assertAttributeManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'attribute:*',
        'attribute:manage',
        'attributes:*',
        'attributes:manage',
        'catalog:*',
        'catalog:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت ویژگی‌ها را ندارید.');
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

  private toBoolean(value?: string): boolean {
    return value === 'true' || value === '1';
  }
}
