import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
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

import { AdminBulkUpdateProductsDto } from './dto/admin-bulk-update-products.dto';

import {
  AdminProductAiContentApplyDto,
  AdminProductAiContentDraftDto,
  AdminProductAiSeoApplyDto,
  AdminProductAiSeoDraftDto,
  AdminProductAiQualityAuditDto,
  AdminProductAiRegistrationAssistDto,
} from './dto/admin-product-ai.dto';

import { AdminProductExportQueryDto } from './dto/admin-product-export-query.dto';

import {
  AdminAddProductMediaDto,
  AdminReorderProductMediaDto,
  AdminUpdateProductMediaDto,
} from './dto/admin-product-media.dto';

import { AdminProductSeoDto } from './dto/admin-product-seo.dto';

import { AdminCreateProductDto } from './dto/admin-create-product.dto';

import { AdminQueryProductDto } from './dto/admin-query-product.dto';

import { AdminUpdateProductStatusDto } from './dto/admin-update-product-status.dto';

import { AdminUpdateProductDto } from './dto/admin-update-product.dto';

import { AdminProductAiService } from './services/admin-product-ai.service';

import { AdminProductRegistrationAiService } from './services/admin-product-registration-ai.service';

import { AdminProductBulkService } from './services/admin-product-bulk.service';

import { AdminProductExportService } from './services/admin-product-export.service';

import { AdminProductSeoService } from './services/admin-product-seo.service';

import { AdminProductService } from './services/admin-product.service';

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

@ApiTags('Product Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/products')
@UseGuards(JwtAuthGuard)
export class ProductAdminController {
  constructor(
    private readonly adminProductService: AdminProductService,
    private readonly adminProductAiService: AdminProductAiService,
    private readonly adminProductRegistrationAiService: AdminProductRegistrationAiService,
    private readonly adminProductBulkService: AdminProductBulkService,
    private readonly adminProductSeoService: AdminProductSeoService,
    private readonly adminProductExportService: AdminProductExportService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی محصولات',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryProductDto,
  ): unknown {
    this.assertProductReader(req);

    return this.adminProductService.findAll(query);
  }

  @Get('export')
  @ApiOperation({
    summary: 'خروجی گرفتن از محصولات',
  })
  async exportProducts(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminProductExportQueryDto,
    @Res() res: Response,
  ): Promise<unknown> {
    this.assertProductReader(req);

    const result = await this.adminProductExportService.exportProducts(query);

    res.setHeader('Content-Type', result.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return res.send(result.content);
  }

  @Post()
  @ApiOperation({
    summary: 'ایجاد محصول مدیریتی',
  })
  create(
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: AdminCreateProductDto,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductService.create(
      dto,
      this.getUserId(req),
      idempotencyKey,
    );
  }

  @Patch('bulk')
  @ApiOperation({
    summary: 'به‌روزرسانی گروهی محصولات',
  })
  bulkUpdate(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminBulkUpdateProductsDto,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductBulkService.bulkUpdate(dto, this.getUserId(req));
  }

  @Post(':productId/ai/registration-assist')
  @ApiOperation({
    summary: 'تحلیل زمینه‌ای و منبع‌محور مرحله ثبت محصول',
  })
  generateRegistrationAssistance(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: AdminProductAiRegistrationAssistDto,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductRegistrationAiService.generateAssistance(
      productId,
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post(':productId/ai/content-draft')
  @ApiOperation({
    summary: 'تولید پیش‌نویس محتوای محصول با هوش مصنوعی',
  })
  generateAiContentDraft(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: AdminProductAiContentDraftDto,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductAiService.generateContentDraft(
      productId,
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post(':productId/ai/content-apply')
  @ApiOperation({
    summary: 'اعمال محتوای تولیدشده هوشمند روی محصول با تأیید ادمین',
  })
  applyAiContent(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: AdminProductAiContentApplyDto,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductAiService.applyGeneratedContent(
      productId,
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post(':productId/ai/seo-draft')
  @ApiOperation({
    summary: 'تولید پیش‌نویس SEO محصول با هوش مصنوعی',
  })
  generateAiSeoDraft(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: AdminProductAiSeoDraftDto,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductAiService.generateSeoDraft(
      productId,
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post(':productId/ai/seo-apply')
  @ApiOperation({
    summary: 'اعمال SEO تولیدشده هوشمند روی محصول با تأیید ادمین',
  })
  applyAiSeo(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: AdminProductAiSeoApplyDto,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductAiService.applySeoDraft(
      productId,
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post(':productId/ai/quality-audit')
  @ApiOperation({
    summary: 'ارزیابی کیفیت، کامل‌بودن و ایمنی محتوای محصول با AI',
  })
  auditAiProductQuality(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: AdminProductAiQualityAuditDto,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductAiService.auditProductQuality(
      productId,
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Get(':productId')
  @ApiOperation({
    summary: 'دریافت جزئیات مدیریتی محصول',
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
  ): unknown {
    this.assertProductReader(req);

    return this.adminProductService.findOne(productId);
  }

  @Patch(':productId')
  @ApiOperation({
    summary: 'به‌روزرسانی محصول',
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: AdminUpdateProductDto,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductService.update(productId, dto, this.getUserId(req));
  }

  @Patch(':productId/status')
  @ApiOperation({
    summary: 'به‌روزرسانی وضعیت محصول',
  })
  updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: AdminUpdateProductStatusDto,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductService.updateStatus(
      productId,
      dto,
      this.getUserId(req),
    );
  }

  @Delete(':productId')
  @ApiOperation({
    summary: 'حذف نرم محصول',
  })
  delete(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductService.delete(productId, this.getUserId(req));
  }

  @Get(':productId/seo')
  @ApiOperation({
    summary: 'دریافت تنظیمات SEO محصول',
  })
  getSeo(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
  ): unknown {
    this.assertProductReader(req);

    return this.adminProductSeoService.getSeo(productId);
  }

  @Patch(':productId/seo')
  @ApiOperation({
    summary: 'به‌روزرسانی SEO محصول',
  })
  updateSeo(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: AdminProductSeoDto,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductSeoService.updateSeo(
      productId,
      dto,
      this.getUserId(req),
    );
  }

  @Get(':productId/media')
  @ApiOperation({
    summary: 'دریافت رسانه‌های محصول',
  })
  findMedia(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
  ): unknown {
    this.assertProductReader(req);

    return this.adminProductService.findMedia(productId);
  }

  @Post(':productId/media')
  @ApiOperation({
    summary: 'افزودن رسانه به محصول',
  })
  addMedia(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: AdminAddProductMediaDto,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductService.addMedia(
      productId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':productId/media/reorder')
  @ApiOperation({
    summary: 'مرتب‌سازی رسانه‌های محصول',
  })
  reorderMedia(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: AdminReorderProductMediaDto,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductService.reorderMedia(
      productId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':productId/media/:imageId')
  @ApiOperation({
    summary: 'به‌روزرسانی رسانه محصول',
  })
  updateMedia(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
    @Body() dto: AdminUpdateProductMediaDto,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductService.updateMedia(
      productId,
      imageId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch(':productId/media/:imageId/primary')
  @ApiOperation({
    summary: 'انتخاب تصویر اصلی محصول',
  })
  setPrimaryMedia(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductService.setPrimaryMedia(
      productId,
      imageId,
      this.getUserId(req),
    );
  }

  @Delete(':productId/media/:imageId')
  @ApiOperation({
    summary: 'حذف رسانه محصول',
  })
  deleteMedia(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ): unknown {
    this.assertProductManager(req);

    return this.adminProductService.deleteMedia(
      productId,
      imageId,
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

  private getAiPermissionContext(req: AuthenticatedRequest) {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName ?? null);

    return {
      userId: this.getUserId(req),
      role,
      roleName:
        req.user?.roleName ??
        (typeof req.user?.role === 'object'
          ? (req.user.role?.name ?? null)
          : role),
      permissions: req.user?.permissions ?? [],
    };
  }

  private assertProductReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'product:*',
        'product:read',
        'products:*',
        'products:read',
        'catalog:*',
        'catalog:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت محصولات را ندارید.');
  }

  private assertProductManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'product:*',
        'product:manage',
        'products:*',
        'products:manage',
        'catalog:*',
        'catalog:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت محصولات را ندارید.');
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
}
