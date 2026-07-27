import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../../core/interfaces/authenticated-request.interface';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import {
  AnyPermissions,
  Permissions,
} from '../rbac/decorators/permissions.decorator';

import { RbacGuard } from '../rbac/guards/rbac.guard';

import { AttachProductImageDto } from './dto/attach-product-image.dto';

import { QueryProductImageDto } from './dto/query-product-image.dto';

import { ReorderProductImagesDto } from './dto/reorder-product-images.dto';

import { SetEntityImageDto } from './dto/set-entity-image.dto';

import { UpdateProductImageDto } from './dto/update-product-image.dto';

import { UploadMediaDto } from './dto/upload-media.dto';

import { MediaService } from './services/media.service';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @RateLimit('public')
  @Get('products/:productId/images')
  @ApiOperation({
    summary: 'دریافت تصاویر محصول',
    description:
      'لیست تصاویر ثبت‌شده برای محصول را بر اساس شناسه محصول برمی‌گرداند.',
  })
  findProductImages(
    @Param('productId') productId: string,
    @Query() query: QueryProductImageDto,
  ) {
    return this.mediaService.findProductImages(productId, query);
  }

  @RateLimit('public')
  @Get('products/:productId/images/primary')
  @ApiOperation({
    summary: 'دریافت تصویر اصلی محصول',
    description: 'تصویر اصلی محصول را بر اساس شناسه محصول برمی‌گرداند.',
  })
  findPrimaryProductImage(@Param('productId') productId: string) {
    return this.mediaService.findPrimaryProductImage(productId);
  }

  @RateLimit('upload')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Post('admin/upload')
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'بارگذاری فایل عمومی توسط مدیر',
    description:
      'یک فایل عمومی را در فضای ذخیره‌سازی فعال پروژه بارگذاری می‌کند.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        folder: {
          type: 'string',
          example: 'general',
        },
        entityId: {
          type: 'string',
          example: 'entity-id',
        },
        altText: {
          type: 'string',
          example: 'متن جایگزین تصویر',
        },
        isPrimary: {
          type: 'boolean',
          example: false,
        },
      },
    },
  })
  @AnyPermissions('media:manage', 'catalog:manage', 'products:manage')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
  ) {
    return this.mediaService.upload(file, dto, this.getUserId(req));
  }

  @RateLimit('upload')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Post('admin/products/:productId/images/upload')
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'بارگذاری تصویر محصول',
    description:
      'تصویر محصول را بارگذاری کرده و همان تصویر را به محصول متصل می‌کند.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        altText: {
          type: 'string',
          example: 'تصویر اصلی محصول',
        },
        isPrimary: {
          type: 'boolean',
          example: true,
        },
      },
    },
  })
  @Permissions('products:manage')
  @UseInterceptors(FileInterceptor('file'))
  uploadProductImage(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
  ) {
    return this.mediaService.uploadProductImage(
      productId,
      file,
      dto,
      this.getUserId(req),
    );
  }

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Post('admin/products/:productId/images')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'اتصال تصویر موجود به محصول',
    description: 'یک آدرس تصویر موجود را به محصول متصل می‌کند.',
  })
  @Permissions('products:manage')
  attachProductImage(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: AttachProductImageDto,
  ) {
    return this.mediaService.attachProductImage(
      productId,
      dto,
      this.getUserId(req),
    );
  }

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Patch('admin/products/:productId/images/reorder')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'مرتب‌سازی تصاویر محصول',
    description: 'ترتیب نمایش تصاویر محصول را به‌روزرسانی می‌کند.',
  })
  @Permissions('products:manage')
  reorderProductImages(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() dto: ReorderProductImagesDto,
  ) {
    return this.mediaService.reorderProductImages(
      productId,
      dto,
      this.getUserId(req),
    );
  }

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Patch('admin/products/images/:imageId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'ویرایش تصویر محصول',
    description:
      'اطلاعات تصویر محصول مانند متن جایگزین، ترتیب و وضعیت تصویر اصلی را ویرایش می‌کند.',
  })
  @Permissions('products:manage')
  updateProductImage(
    @Req() req: AuthenticatedRequest,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateProductImageDto,
  ) {
    return this.mediaService.updateProductImage(
      imageId,
      dto,
      this.getUserId(req),
    );
  }

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Patch('admin/products/images/:imageId/primary')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'انتخاب تصویر اصلی محصول',
    description:
      'یک تصویر محصول را به‌عنوان تصویر اصلی همان محصول تنظیم می‌کند.',
  })
  @Permissions('products:manage')
  setPrimaryProductImage(
    @Req() req: AuthenticatedRequest,
    @Param('imageId') imageId: string,
  ) {
    return this.mediaService.setPrimaryProductImage(
      imageId,
      this.getUserId(req),
    );
  }

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Delete('admin/products/images/:imageId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'حذف تصویر محصول',
    description:
      'تصویر محصول را حذف می‌کند. در صورت ارسال deleteFile=true فایل فیزیکی نیز حذف می‌شود.',
  })
  @Permissions('products:manage')
  deleteProductImage(
    @Req() req: AuthenticatedRequest,
    @Param('imageId') imageId: string,
    @Query('deleteFile') deleteFile?: string,
  ) {
    return this.mediaService.deleteProductImage(imageId, {
      deleteFile: deleteFile === 'true',
      actorId: this.getUserId(req),
    });
  }

  @RateLimit('upload')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Patch('admin/brands/:brandId/logo/upload')
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'بارگذاری لوگوی برند',
    description: 'لوگوی برند را بارگذاری کرده و روی برند تنظیم می‌کند.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Permissions('catalog:manage')
  @UseInterceptors(FileInterceptor('file'))
  uploadBrandLogo(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.mediaService.uploadBrandLogo(
      brandId,
      file,
      this.getUserId(req),
    );
  }

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Patch('admin/brands/:brandId/logo')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'تنظیم لوگوی برند',
    description: 'آدرس لوگوی برند را بدون بارگذاری فایل جدید تنظیم می‌کند.',
  })
  @Permissions('catalog:manage')
  setBrandLogo(
    @Req() req: AuthenticatedRequest,
    @Param('brandId') brandId: string,
    @Body() dto: SetEntityImageDto,
  ) {
    return this.mediaService.setBrandLogo(brandId, dto, this.getUserId(req));
  }

  @RateLimit('upload')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Patch('admin/categories/:categoryId/image/upload')
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'بارگذاری تصویر دسته‌بندی',
    description:
      'تصویر دسته‌بندی را بارگذاری کرده و روی دسته‌بندی تنظیم می‌کند.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Permissions('catalog:manage')
  @UseInterceptors(FileInterceptor('file'))
  uploadCategoryImage(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.mediaService.uploadCategoryImage(
      categoryId,
      file,
      this.getUserId(req),
    );
  }

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Patch('admin/categories/:categoryId/image')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'تنظیم تصویر دسته‌بندی',
    description:
      'آدرس تصویر دسته‌بندی را بدون بارگذاری فایل جدید تنظیم می‌کند.',
  })
  @Permissions('catalog:manage')
  setCategoryImage(
    @Req() req: AuthenticatedRequest,
    @Param('categoryId') categoryId: string,
    @Body() dto: SetEntityImageDto,
  ) {
    return this.mediaService.setCategoryImage(
      categoryId,
      dto,
      this.getUserId(req),
    );
  }

  @RateLimit('upload')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Patch('admin/variants/:variantId/image/upload')
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'بارگذاری تصویر تنوع محصول',
    description:
      'تصویر Variant محصول را بارگذاری کرده و روی همان Variant تنظیم می‌کند.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Permissions('products:manage')
  @UseInterceptors(FileInterceptor('file'))
  uploadVariantImage(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.mediaService.uploadVariantImage(
      variantId,
      file,
      this.getUserId(req),
    );
  }

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Patch('admin/variants/:variantId/image')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'تنظیم تصویر تنوع محصول',
    description:
      'آدرس تصویر Variant محصول را بدون بارگذاری فایل جدید تنظیم می‌کند.',
  })
  @Permissions('products:manage')
  setVariantImage(
    @Req() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
    @Body() dto: SetEntityImageDto,
  ) {
    return this.mediaService.setVariantImage(
      variantId,
      dto,
      this.getUserId(req),
    );
  }

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard)
  @Get('me/avatar')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'دریافت آواتار کاربر فعلی',
    description: 'آواتار کاربر احرازهویت‌شده فعلی را برمی‌گرداند.',
  })
  getMyAvatar(@Req() req: AuthenticatedRequest) {
    return this.mediaService.getUserAvatar(this.getUserId(req));
  }

  @RateLimit('upload')
  @UseGuards(JwtAuthGuard)
  @Patch('me/avatar/upload')
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'بارگذاری آواتار کاربر فعلی',
    description:
      'تصویر آواتار کاربر احرازهویت‌شده فعلی را بارگذاری و تنظیم می‌کند.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadMyAvatar(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = this.getUserId(req);

    return this.mediaService.uploadUserAvatar(userId, file, userId);
  }

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard)
  @Patch('me/avatar')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'تنظیم آواتار کاربر فعلی',
    description:
      'آدرس آواتار کاربر فعلی را بدون بارگذاری فایل جدید تنظیم می‌کند.',
  })
  setMyAvatar(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SetEntityImageDto,
  ) {
    const userId = this.getUserId(req);

    return this.mediaService.setUserAvatar(userId, dto, userId);
  }

  @RateLimit('upload')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Patch('admin/users/:userId/avatar/upload')
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'بارگذاری آواتار کاربر توسط مدیر',
    description: 'آواتار یک کاربر را توسط مدیر بارگذاری و تنظیم می‌کند.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Permissions('users:manage')
  @UseInterceptors(FileInterceptor('file'))
  uploadUserAvatarForAdmin(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.mediaService.uploadUserAvatar(
      userId,
      file,
      this.getUserId(req),
    );
  }

  @RateLimit('sensitive')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Patch('admin/users/:userId/avatar')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'تنظیم آواتار کاربر توسط مدیر',
    description:
      'آدرس آواتار یک کاربر را توسط مدیر بدون بارگذاری فایل جدید تنظیم می‌کند.',
  })
  @Permissions('users:manage')
  setUserAvatarForAdmin(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() dto: SetEntityImageDto,
  ) {
    return this.mediaService.setUserAvatar(userId, dto, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }
}
