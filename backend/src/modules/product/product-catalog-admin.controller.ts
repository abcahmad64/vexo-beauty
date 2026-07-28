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

import {
  AdminAttributeTemplateFieldDto,
  AdminCreateProductAttributeDto,
  AdminCreateProductAttributeTemplateDto,
  AdminCreateProductAttributeValueDto,
  AdminCreateProductModelDto,
  AdminCreateProductTypeDto,
  AdminResolveProductAttributeTemplateDto,
  AdminUpdateProductAttributeDto,
  AdminUpdateProductAttributeTemplateDto,
  AdminUpdateProductAttributeValueDto,
  AdminUpdateProductModelDto,
  AdminUpdateProductTypeDto,
} from './dto/admin-product-catalog.dto';

import { AdminProductCatalogService } from './services/admin-product-catalog.service';

type RequestUser = {
  id?: string;
  userId?: string;
  sub?: string;
  role?:
    | string
    | {
        name?: string | null;
      };
  roleName?: string | null;
  permissions?: string[];
};

type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

@ApiTags('Product Catalog Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/product-catalog')
@UseGuards(JwtAuthGuard)
export class ProductCatalogAdminController {
  constructor(
    private readonly adminProductCatalogService: AdminProductCatalogService,
  ) {}

  @Get('bootstrap')
  @ApiOperation({
    summary: 'دریافت داده‌های اولیه فرم هوشمند ثبت محصول',
  })
  getBootstrap(
    @Req() req: AuthenticatedRequest,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('productTypeId') productTypeId?: string,
    @Query('includeInactive') includeInactive?: string,
  ): unknown {
    this.assertCatalogReader(req);

    return this.adminProductCatalogService.getBootstrap({
      categoryId,
      brandId,
      productTypeId,
      includeInactive,
    });
  }

  @Get('product-types')
  @ApiOperation({
    summary: 'دریافت نوع‌های محصول برای داشبورد ادمین',
  })
  findProductTypes(
    @Req() req: AuthenticatedRequest,
    @Query('categoryId') categoryId?: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ): unknown {
    this.assertCatalogReader(req);

    return this.adminProductCatalogService.findProductTypes({
      categoryId,
      includeInactive: this.toBoolean(includeInactive),
      includeDeleted: this.toBoolean(includeDeleted),
    });
  }

  @Post('product-types')
  @ApiOperation({
    summary: 'افزودن نوع محصول از داخل داشبورد ادمین',
  })
  createProductType(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateProductTypeDto,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.createProductType(dto);
  }

  @Patch('product-types/:productTypeId')
  @ApiOperation({
    summary: 'ویرایش نوع محصول از داخل داشبورد ادمین',
  })
  updateProductType(
    @Req() req: AuthenticatedRequest,
    @Param('productTypeId') productTypeId: string,
    @Body() dto: AdminUpdateProductTypeDto,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.updateProductType(
      productTypeId,
      dto,
    );
  }

  @Patch('product-types/:productTypeId/restore')
  @ApiOperation({
    summary: 'بازگردانی نوع محصول حذف‌شده',
  })
  restoreProductType(
    @Req() req: AuthenticatedRequest,
    @Param('productTypeId') productTypeId: string,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.restoreProductType(productTypeId);
  }

  @Delete('product-types/:productTypeId')
  @ApiOperation({
    summary: 'حذف نرم و وابستگی‌امن نوع محصول',
  })
  deleteProductType(
    @Req() req: AuthenticatedRequest,
    @Param('productTypeId') productTypeId: string,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.deleteProductType(productTypeId);
  }

  @Get('product-models')
  @ApiOperation({
    summary: 'دریافت مدل‌های محصول برای داشبورد ادمین',
  })
  findProductModels(
    @Req() req: AuthenticatedRequest,
    @Query('brandId') brandId?: string,
    @Query('productTypeId') productTypeId?: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ): unknown {
    this.assertCatalogReader(req);

    return this.adminProductCatalogService.findProductModels({
      brandId,
      productTypeId,
      includeInactive: this.toBoolean(includeInactive),
      includeDeleted: this.toBoolean(includeDeleted),
    });
  }

  @Post('product-models')
  @ApiOperation({
    summary: 'افزودن مدل کالا از داخل داشبورد ادمین',
  })
  createProductModel(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateProductModelDto,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.createProductModel(dto);
  }

  @Patch('product-models/:productModelId')
  @ApiOperation({
    summary: 'ویرایش مدل کالا از داخل داشبورد ادمین',
  })
  updateProductModel(
    @Req() req: AuthenticatedRequest,
    @Param('productModelId') productModelId: string,
    @Body() dto: AdminUpdateProductModelDto,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.updateProductModel(
      productModelId,
      dto,
    );
  }

  @Patch('product-models/:productModelId/restore')
  @ApiOperation({
    summary: 'بازگردانی مدل محصول حذف‌شده',
  })
  restoreProductModel(
    @Req() req: AuthenticatedRequest,
    @Param('productModelId') productModelId: string,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.restoreProductModel(productModelId);
  }

  @Delete('product-models/:productModelId')
  @ApiOperation({
    summary: 'حذف نرم و وابستگی‌امن مدل محصول',
  })
  deleteProductModel(
    @Req() req: AuthenticatedRequest,
    @Param('productModelId') productModelId: string,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.deleteProductModel(productModelId);
  }

  @Get('attributes')
  @ApiOperation({
    summary: 'دریافت تعریف ویژگی‌های محصول برای Workspace مدیریت',
  })
  findAttributes(
    @Req() req: AuthenticatedRequest,
    @Query('q') q?: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ): unknown {
    this.assertCatalogReader(req);

    return this.adminProductCatalogService.findAttributes({
      q,
      includeInactive: this.toBoolean(includeInactive),
      includeDeleted: this.toBoolean(includeDeleted),
    });
  }

  @Post('attributes')
  @ApiOperation({
    summary: 'ایجاد تعریف ویژگی محصول',
  })
  createAttribute(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateProductAttributeDto,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.createAttribute(dto);
  }

  @Patch('attributes/:attributeId')
  @ApiOperation({
    summary: 'ویرایش تعریف ویژگی محصول',
  })
  updateAttribute(
    @Req() req: AuthenticatedRequest,
    @Param('attributeId') attributeId: string,
    @Body() dto: AdminUpdateProductAttributeDto,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.updateAttribute(attributeId, dto);
  }

  @Patch('attributes/:attributeId/restore')
  @ApiOperation({
    summary: 'بازگردانی تعریف ویژگی حذف‌شده',
  })
  restoreAttribute(
    @Req() req: AuthenticatedRequest,
    @Param('attributeId') attributeId: string,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.restoreAttribute(attributeId);
  }

  @Delete('attributes/:attributeId')
  @ApiOperation({
    summary: 'حذف نرم و وابستگی‌امن تعریف ویژگی',
  })
  deleteAttribute(
    @Req() req: AuthenticatedRequest,
    @Param('attributeId') attributeId: string,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.deleteAttribute(attributeId);
  }

  @Get('attributes/:attributeId/values')
  @ApiOperation({
    summary: 'دریافت مقادیر ازپیش‌تعریف‌شده یک ویژگی',
  })
  findAttributeValues(
    @Req() req: AuthenticatedRequest,
    @Param('attributeId') attributeId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ): unknown {
    this.assertCatalogReader(req);

    return this.adminProductCatalogService.findAttributeValues(attributeId, {
      includeDeleted: this.toBoolean(includeDeleted),
    });
  }

  @Post('attributes/:attributeId/values')
  @ApiOperation({
    summary: 'افزودن مقدار ازپیش‌تعریف‌شده برای ویژگی',
  })
  createAttributeValue(
    @Req() req: AuthenticatedRequest,
    @Param('attributeId') attributeId: string,
    @Body() dto: AdminCreateProductAttributeValueDto,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.createAttributeValue(
      attributeId,
      dto,
    );
  }

  @Patch('attribute-values/:attributeValueId')
  @ApiOperation({
    summary: 'ویرایش مقدار ازپیش‌تعریف‌شده ویژگی',
  })
  updateAttributeValue(
    @Req() req: AuthenticatedRequest,
    @Param('attributeValueId') attributeValueId: string,
    @Body() dto: AdminUpdateProductAttributeValueDto,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.updateAttributeValue(
      attributeValueId,
      dto,
    );
  }

  @Patch('attribute-values/:attributeValueId/restore')
  @ApiOperation({
    summary: 'بازگردانی مقدار حذف‌شده ویژگی',
  })
  restoreAttributeValue(
    @Req() req: AuthenticatedRequest,
    @Param('attributeValueId') attributeValueId: string,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.restoreAttributeValue(
      attributeValueId,
    );
  }

  @Delete('attribute-values/:attributeValueId')
  @ApiOperation({
    summary: 'حذف نرم و وابستگی‌امن مقدار ویژگی',
  })
  deleteAttributeValue(
    @Req() req: AuthenticatedRequest,
    @Param('attributeValueId') attributeValueId: string,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.deleteAttributeValue(
      attributeValueId,
    );
  }

  @Get('attribute-templates/resolve')
  @ApiOperation({
    summary: 'تشخیص فیلدهای اختصاصی محصول براساس دسته، برند، نوع و مدل',
  })
  resolveAttributeTemplate(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminResolveProductAttributeTemplateDto,
  ): unknown {
    this.assertCatalogReader(req);

    return this.adminProductCatalogService.resolveAttributeTemplate(query);
  }

  /* ADMIN_VARIANT_ATTRIBUTE_MATRIX_ROUTE_V1 */

  @Get('variant-attributes')
  @ApiOperation({
    summary:
      'دریافت قالب و مقادیر ویژگی‌های قابل استفاده برای ساخت واریانت',
  })
  getVariantAttributes(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminResolveProductAttributeTemplateDto,
  ): unknown {
    this.assertCatalogReader(req);

    return this.adminProductCatalogService.getVariantAttributes(
      query,
    );
  }

  @Post('attribute-templates')
  @ApiOperation({
    summary: 'ساخت قالب ویژگی‌های اختصاصی محصول',
  })
  createAttributeTemplate(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateProductAttributeTemplateDto,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.createAttributeTemplate(dto);
  }

  @Patch('attribute-templates/:templateId')
  @ApiOperation({
    summary: 'ویرایش قالب ویژگی‌های اختصاصی محصول',
  })
  updateAttributeTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('templateId') templateId: string,
    @Body() dto: AdminUpdateProductAttributeTemplateDto,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.updateAttributeTemplate(
      templateId,
      dto,
    );
  }

  @Post('attribute-templates/:templateId/fields')
  @ApiOperation({
    summary: 'افزودن ویژگی به قالب اختصاصی محصول',
  })
  addTemplateField(
    @Req() req: AuthenticatedRequest,
    @Param('templateId') templateId: string,
    @Body() dto: AdminAttributeTemplateFieldDto,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.addTemplateField(templateId, dto);
  }

  @Delete('attribute-templates/:templateId/fields/:fieldId')
  @ApiOperation({
    summary: 'حذف ویژگی از قالب اختصاصی محصول',
  })
  removeTemplateField(
    @Req() req: AuthenticatedRequest,
    @Param('templateId') templateId: string,
    @Param('fieldId') fieldId: string,
  ): unknown {
    this.assertCatalogManager(req);

    return this.adminProductCatalogService.removeTemplateField(
      templateId,
      fieldId,
    );
  }

  private assertCatalogReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'catalog:*',
        'catalog:read',
        'product:*',
        'product:read',
        'products:*',
        'products:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده کاتالوگ محصولات را ندارید.');
  }

  private assertCatalogManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'catalog:*',
        'catalog:manage',
        'product:*',
        'product:manage',
        'products:*',
        'products:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت کاتالوگ محصولات را ندارید.');
  }

  private hasAdminRole(req: AuthenticatedRequest): boolean {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName ?? null);

    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  }

  private hasAnyPermission(
    req: AuthenticatedRequest,
    permissions: string[],
  ): boolean {
    const userPermissions = req.user?.permissions ?? [];

    return permissions.some((requiredPermission) =>
      this.permissionMatches(userPermissions, requiredPermission),
    );
  }

  private permissionMatches(
    userPermissions: string[],
    requiredPermission: string,
  ): boolean {
    const required = requiredPermission.toLowerCase();

    return userPermissions.some((permission) => {
      const owned = permission.toLowerCase();

      if (owned === '*' || owned === 'admin:*') {
        return true;
      }

      if (owned === required) {
        return true;
      }

      if (owned.endsWith(':*')) {
        const prefix = owned.slice(0, -1);

        return required.startsWith(prefix);
      }

      return false;
    });
  }

  private toBoolean(value?: string): boolean {
    return value === 'true' || value === '1';
  }
}
