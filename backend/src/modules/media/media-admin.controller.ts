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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Request, Response } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AdminAttachProductImageDto } from './dto/admin-attach-product-image.dto';

import {
  AdminMediaAiAltTextApplyDto,
  AdminMediaAiAltTextDraftDto,
  AdminMediaAiBannerTextDto,
  AdminMediaAiImageDescriptionDto,
} from './dto/admin-media-ai.dto';

import { AdminMediaExportQueryDto } from './dto/admin-media-export-query.dto';

import { AdminMediaNoteDto } from './dto/admin-media-note.dto';

import { AdminQueryMediaDto } from './dto/admin-query-media.dto';

import { AdminReorderProductMediaDto } from './dto/admin-reorder-product-media.dto';

import { AdminSetEntityMediaDto } from './dto/admin-set-entity-media.dto';

import { AdminUpdateProductImageDto } from './dto/admin-update-product-image.dto';

import { AdminUploadMediaDto } from './dto/admin-upload-media.dto';

import { AdminMediaAiService } from './services/admin-media-ai.service';

import { AdminMediaExportService } from './services/admin-media-export.service';

import { AdminMediaService } from './services/admin-media.service';

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

@ApiTags('Media Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/media')
@UseGuards(JwtAuthGuard)
export class MediaAdminController {
  constructor(
    private readonly adminMediaService: AdminMediaService,
    private readonly adminMediaExportService: AdminMediaExportService,
    private readonly adminMediaAiService: AdminMediaAiService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست مدیریتی رسانه‌ها',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryMediaDto,
  ) {
    this.assertMediaReader(req);

    return this.adminMediaService.findAll(query);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'دریافت داشبورد مدیریتی رسانه‌ها',
  })
  getDashboard(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryMediaDto,
  ) {
    this.assertMediaReader(req);

    return this.adminMediaService.getDashboard(query);
  }

  @Get('export')
  @ApiOperation({
    summary: 'خروجی گرفتن از رسانه‌ها',
  })
  async exportMedia(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminMediaExportQueryDto,
    @Res() res: Response,
  ) {
    this.assertMediaReader(req);

    const result = await this.adminMediaExportService.exportMedia(query);

    res.setHeader('Content-Type', result.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return res.send(result.content);
  }

  @Post('ai/image-description')
  @ApiOperation({
    summary: 'تولید توضیح هوشمند تصویر محصول',
  })
  generateAiImageDescription(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminMediaAiImageDescriptionDto,
  ) {
    this.assertMediaReader(req);

    return this.adminMediaAiService.generateImageDescription(
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post('ai/alt-text-draft')
  @ApiOperation({
    summary: 'تولید پیشنویس alt text تصویر محصول',
  })
  generateAiAltTextDraft(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminMediaAiAltTextDraftDto,
  ) {
    this.assertMediaReader(req);

    return this.adminMediaAiService.generateAltTextDraft(
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post('ai/alt-text-apply')
  @ApiOperation({
    summary: 'اعمال alt text هوشمند با تأیید ادمین',
  })
  applyAiAltText(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminMediaAiAltTextApplyDto,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaAiService.applyAltText(
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post('ai/banner-text')
  @ApiOperation({
    summary: 'تولید متن هوشمند بنر',
  })
  generateAiBannerText(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminMediaAiBannerTextDto,
  ) {
    this.assertMediaReader(req);

    return this.adminMediaAiService.generateBannerText(
      dto,
      this.getAiPermissionContext(req),
    );
  }

  @Post('upload')
  @ApiOperation({
    summary: 'آپلود مدیریتی فایل رسانه‌ای',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AdminUploadMediaDto,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaService.upload(file, dto, this.getUserId(req));
  }

  @Get('product-images')
  @ApiOperation({
    summary: 'دریافت تصاویر محصولات',
  })
  findProductImages(
    @Req() req: AuthenticatedRequest,
    @Query('productId') productId?: string,
  ) {
    this.assertMediaReader(req);

    return this.adminMediaService.findProductImages(productId);
  }

  @Post('products/:productId/images')
  @ApiOperation({
    summary: 'اتصال تصویر به محصول',
  })
  attachProductImage(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: AdminAttachProductImageDto,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaService.attachProductImage(
      productId,
      dto,
      this.getUserId(req),
    );
  }

  @Post('products/:productId/images/upload')
  @ApiOperation({
    summary: 'آپلود و اتصال تصویر محصول',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadProductImage(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AdminUploadMediaDto,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaService.uploadProductImage(
      productId,
      file,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('products/:productId/images/reorder')
  @ApiOperation({
    summary: 'مرتب‌سازی تصاویر محصول',
  })
  reorderProductImages(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: AdminReorderProductMediaDto,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaService.reorderProductImages(
      productId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('product-images/:imageId')
  @ApiOperation({
    summary: 'به‌روزرسانی تصویر محصول',
  })
  updateProductImage(
    @Req() req: AuthenticatedRequest,
    @Param('imageId') imageId: string,
    @Body() dto: AdminUpdateProductImageDto,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaService.updateProductImage(
      imageId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('product-images/:imageId/primary')
  @ApiOperation({
    summary: 'انتخاب تصویر اصلی محصول',
  })
  setPrimaryProductImage(
    @Req() req: AuthenticatedRequest,
    @Param('imageId') imageId: string,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaService.setPrimaryProductImage(
      imageId,
      this.getUserId(req),
    );
  }

  @Delete('product-images/:imageId')
  @ApiOperation({
    summary: 'حذف تصویر محصول',
  })
  deleteProductImage(
    @Req() req: AuthenticatedRequest,
    @Param('imageId') imageId: string,
    @Query('deleteFile') deleteFile?: string,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaService.deleteProductImage(imageId, {
      deleteFile: this.toBoolean(deleteFile),
      actorId: this.getUserId(req),
    });
  }

  @Patch('brands/:brandId/logo/upload')
  @ApiOperation({
    summary: 'آپلود لوگوی برند',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadBrandLogo(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AdminUploadMediaDto,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaService.uploadBrandLogo(
      brandId,
      file,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('brands/:brandId/logo')
  @ApiOperation({
    summary: 'ثبت لینک لوگوی برند',
  })
  setBrandLogo(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
    @Body() dto: AdminSetEntityMediaDto,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaService.setBrandLogo(
      brandId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('categories/:categoryId/image/upload')
  @ApiOperation({
    summary: 'آپلود تصویر دسته‌بندی',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadCategoryImage(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AdminUploadMediaDto,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaService.uploadCategoryImage(
      categoryId,
      file,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('categories/:categoryId/image')
  @ApiOperation({
    summary: 'ثبت لینک تصویر دسته‌بندی',
  })
  setCategoryImage(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
    @Body() dto: AdminSetEntityMediaDto,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaService.setCategoryImage(
      categoryId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('variants/:variantId/image/upload')
  @ApiOperation({
    summary: 'آپلود تصویر تنوع محصول',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadVariantImage(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AdminUploadMediaDto,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaService.uploadVariantImage(
      variantId,
      file,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('variants/:variantId/image')
  @ApiOperation({
    summary: 'ثبت لینک تصویر تنوع محصول',
  })
  setVariantImage(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
    @Body() dto: AdminSetEntityMediaDto,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaService.setVariantImage(
      variantId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('users/:userId/avatar/upload')
  @ApiOperation({
    summary: 'آپلود تصویر پروفایل کاربر',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadUserAvatar(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AdminUploadMediaDto,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaService.uploadUserAvatar(
      userId,
      file,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('users/:userId/avatar')
  @ApiOperation({
    summary: 'ثبت لینک تصویر پروفایل کاربر',
  })
  setUserAvatar(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() dto: AdminSetEntityMediaDto,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaService.setUserAvatar(
      userId,
      dto,
      this.getUserId(req),
    );
  }

  @Get('notes/:mediaKey')
  @ApiOperation({
    summary: 'دریافت یادداشت‌های مدیریتی رسانه',
  })
  getNotes(
    @Req() req: AuthenticatedRequest,
    @Param('mediaKey') mediaKey: string,
    @Query('limit') limit?: string,
  ) {
    this.assertMediaReader(req);

    const parsedLimit = limit ? Number(limit) : 50;

    return this.adminMediaService.getNotes(
      mediaKey,
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 50,
    );
  }

  @Post('notes/:mediaKey')
  @ApiOperation({
    summary: 'ثبت یادداشت مدیریتی برای رسانه',
  })
  createNote(
    @Req() req: AuthenticatedRequest,
    @Param('mediaKey') mediaKey: string,
    @Body() dto: AdminMediaNoteDto,
  ) {
    this.assertMediaManager(req);

    return this.adminMediaService.createNote(
      mediaKey,
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

  private getAiPermissionContext(req: AuthenticatedRequest) {
    return {
      userId: this.getUserId(req),
      role: req.user?.role,
      roleName: req.user?.roleName,
      permissions: req.user?.permissions ?? [],
    };
  }

  private assertMediaReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'media:*',
        'media:read',
        'media:manage',
        'upload:*',
        'upload:read',
        'catalog:read',
        'catalog:manage',
        'products:read',
        'products:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت رسانه‌ها را ندارید.');
  }

  private assertMediaManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'media:*',
        'media:manage',
        'media:upload',
        'media:update',
        'media:delete',
        'upload:*',
        'upload:manage',
        'catalog:manage',
        'products:manage',
        'users:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت رسانه‌ها را ندارید.');
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
