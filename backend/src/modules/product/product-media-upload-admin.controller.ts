import {
  Body,
  Controller,
  ForbiddenException,
  Param,
  Post,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';

import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Request } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import {
  AdminBulkUploadProductMediaDto,
  AdminUploadProductMediaDto,
} from './dto/admin-product-media-upload.dto';

import { AdminProductMediaUploadService } from './services/admin-product-media-upload.service';

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

@ApiTags('Product Admin Media Upload')
@ApiBearerAuth('access-token')
@RateLimit('upload')
@Controller('admin/products')
@UseGuards(JwtAuthGuard)
export class ProductMediaUploadAdminController {
  constructor(
    private readonly mediaUploadService: AdminProductMediaUploadService,
  ) {}

  @Post(':productId/media/upload')
  @ApiOperation({
    summary: 'آپلود و اتصال عکس یا ویدئوی محصول',
    description:
      'یک فایل عکس یا ویدئو را در storage پروژه ذخیره می‌کند و همان فایل را به رسانه‌های محصول وصل می‌کند.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        type: {
          type: 'string',
          enum: ['IMAGE', 'VIDEO'],
        },
        thumbnailUrl: {
          type: 'string',
        },
        altText: {
          type: 'string',
        },
        title: {
          type: 'string',
        },
        caption: {
          type: 'string',
        },
        sortOrder: {
          type: 'integer',
        },
        isPrimary: {
          type: 'boolean',
        },
        isActive: {
          type: 'boolean',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadSingle(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AdminUploadProductMediaDto,
  ) {
    this.assertProductMediaManager(req);

    return this.mediaUploadService.uploadSingle(
      productId,
      file,
      dto,
      this.getUserId(req),
    );
  }

  @Post(':productId/media/bulk-upload')
  @ApiOperation({
    summary: 'آپلود گروهی عکس‌ها و ویدئوهای محصول',
    description:
      'چند فایل عکس یا ویدئو را به‌صورت گروهی ذخیره و به رسانه‌های همان محصول متصل می‌کند.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        type: {
          type: 'string',
          enum: ['IMAGE', 'VIDEO'],
        },
        primaryIndex: {
          type: 'integer',
          description:
            'اندیس فایل اصلی از صفر. اگر محصول رسانه اصلی نداشته باشد و مقدار ارسال نشود، فایل اول اصلی می‌شود.',
        },
        startSortOrder: {
          type: 'integer',
        },
        isActive: {
          type: 'boolean',
        },
        titlePrefix: {
          type: 'string',
        },
        altTextPrefix: {
          type: 'string',
        },
        caption: {
          type: 'string',
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 50))
  uploadBulk(
    @Req() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: AdminBulkUploadProductMediaDto,
  ) {
    this.assertProductMediaManager(req);

    return this.mediaUploadService.uploadBulk(
      productId,
      files,
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

  private assertProductMediaManager(req: AuthenticatedRequest): void {
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
        'media:*',
        'media:manage',
        'media:upload',
        'upload:*',
        'upload:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز آپلود رسانه محصول را ندارید.');
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
      const normalizedPermission = permission.toLowerCase();

      if (normalizedPermission === required) {
        return true;
      }

      if (normalizedPermission.endsWith(':*')) {
        const prefix = normalizedPermission.slice(0, -1);

        return required.startsWith(prefix);
      }

      return false;
    });
  }
}
