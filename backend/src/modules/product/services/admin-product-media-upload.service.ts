import { BadRequestException, Injectable } from '@nestjs/common';

import {
  MediaFileKind,
  MediaFolder,
} from '../../media/constants/media.constants';

import { MediaStorageService } from '../../media/services/media-storage.service';

import {
  AdminAddProductMediaDto,
  AdminProductMediaType,
} from '../dto/admin-product-media.dto';

import {
  AdminBulkUploadProductMediaDto,
  AdminUploadProductMediaDto,
} from '../dto/admin-product-media-upload.dto';

import { AdminProductService } from './admin-product.service';

type UploadedProductMediaItem = {
  index: number;
  originalName: string;
  url: string;
  type: AdminProductMediaType;
  mimeType: string;
  size: number;
  isPrimary: boolean;
};

@Injectable()
export class AdminProductMediaUploadService {
  private readonly maxBulkFiles = 50;

  constructor(
    private readonly storage: MediaStorageService,
    private readonly adminProductService: AdminProductService,
  ) {}

  async uploadSingle(
    productId: string,
    file: Express.Multer.File | undefined,
    dto: AdminUploadProductMediaDto,
    actorId?: string,
  ) {
    this.assertFile(file);

    const currentMedia = await this.adminProductService.findMedia(productId);
    const requestedPrimary = this.toOptionalBoolean(dto.isPrimary);
    const shouldBePrimary =
      requestedPrimary ?? !currentMedia.data.some((media) => media.isPrimary);

    const uploaded = await this.storage.uploadFile(file, {
      folder: MediaFolder.PRODUCTS,
      entityId: productId,
      allowedKinds: [MediaFileKind.IMAGE, MediaFileKind.VIDEO],
    });

    const mediaType = this.resolveMediaType(file, dto.type);

    await this.adminProductService.addMedia(
      productId,
      {
        url: uploaded.url,
        type: mediaType,
        thumbnailUrl: dto.thumbnailUrl,
        altText: dto.altText ?? this.safeOriginalName(file.originalname),
        title: dto.title ?? this.safeOriginalName(file.originalname),
        caption: dto.caption,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
        sortOrder: this.toOptionalInteger(dto.sortOrder),
        isPrimary: shouldBePrimary,
        isActive: this.toOptionalBoolean(dto.isActive) ?? true,
      },
      actorId,
    );

    return {
      uploaded: {
        originalName: file.originalname,
        url: uploaded.url,
        key: uploaded.key,
        driver: uploaded.driver,
        type: mediaType,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
        isPrimary: shouldBePrimary,
      },
      media: await this.adminProductService.findMedia(productId),
      audit: {
        actorId: actorId ?? null,
        action: 'product.media_file_uploaded',
      },
    };
  }

  async uploadBulk(
    productId: string,
    files: Express.Multer.File[] | undefined,
    dto: AdminBulkUploadProductMediaDto,
    actorId?: string,
  ) {
    this.assertFiles(files);

    const existingMedia = await this.adminProductService.findMedia(productId);
    const hasPrimary = existingMedia.data.some((media) => media.isPrimary);
    const primaryIndex = this.resolvePrimaryIndex(
      dto.primaryIndex,
      files.length,
      hasPrimary,
    );
    const startSortOrder =
      this.toOptionalInteger(dto.startSortOrder) ?? existingMedia.data.length;
    const uploadedItems: UploadedProductMediaItem[] = [];

    for (const [index, file] of files.entries()) {
      const uploaded = await this.storage.uploadFile(file, {
        folder: MediaFolder.PRODUCTS,
        entityId: productId,
        allowedKinds: [MediaFileKind.IMAGE, MediaFileKind.VIDEO],
      });

      const mediaType = this.resolveMediaType(file, dto.type);
      const safeName = this.safeOriginalName(file.originalname);
      const isPrimary = primaryIndex === index;

      const addDto: AdminAddProductMediaDto = {
        url: uploaded.url,
        type: mediaType,
        altText: dto.altTextPrefix
          ? `${dto.altTextPrefix} ${index + 1}`
          : safeName,
        title: dto.titlePrefix ? `${dto.titlePrefix} ${index + 1}` : safeName,
        caption: dto.caption,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
        sortOrder: startSortOrder + index,
        isPrimary,
        isActive: this.toOptionalBoolean(dto.isActive) ?? true,
      };

      await this.adminProductService.addMedia(productId, addDto, actorId);

      uploadedItems.push({
        index,
        originalName: file.originalname,
        url: uploaded.url,
        type: mediaType,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
        isPrimary,
      });
    }

    return {
      uploaded: uploadedItems,
      media: await this.adminProductService.findMedia(productId),
      audit: {
        actorId: actorId ?? null,
        action: 'product.media_files_bulk_uploaded',
        count: uploadedItems.length,
      },
    };
  }

  private assertFile(
    file: Express.Multer.File | undefined,
  ): asserts file is Express.Multer.File {
    if (!file) {
      throw new BadRequestException('فایل رسانه ارسال نشده است.');
    }
  }

  private assertFiles(
    files: Express.Multer.File[] | undefined,
  ): asserts files is Express.Multer.File[] {
    if (!files?.length) {
      throw new BadRequestException('هیچ فایل رسانه‌ای ارسال نشده است.');
    }

    if (files.length > this.maxBulkFiles) {
      throw new BadRequestException(
        'در هر درخواست حداکثر ۵۰ فایل قابل آپلود است.',
      );
    }
  }

  private resolveMediaType(
    file: Express.Multer.File,
    explicitType?: AdminProductMediaType,
  ): AdminProductMediaType {
    const detectedType = this.detectMediaType(file.mimetype);

    if (explicitType && explicitType !== detectedType) {
      throw new BadRequestException(
        'نوع رسانه انتخاب‌شده با نوع فایل آپلودشده هماهنگ نیست.',
      );
    }

    return detectedType;
  }

  private detectMediaType(mimeType: string): AdminProductMediaType {
    if (mimeType.startsWith('image/')) {
      return 'IMAGE';
    }

    if (mimeType.startsWith('video/')) {
      return 'VIDEO';
    }

    throw new BadRequestException(
      'فقط فایل عکس یا ویدئو برای رسانه محصول مجاز است.',
    );
  }

  private resolvePrimaryIndex(
    rawPrimaryIndex: number | string | undefined,
    fileCount: number,
    hasExistingPrimary: boolean,
  ): number | undefined {
    const primaryIndex = this.toOptionalInteger(rawPrimaryIndex);

    if (primaryIndex === undefined) {
      return hasExistingPrimary ? undefined : 0;
    }

    if (primaryIndex < 0 || primaryIndex >= fileCount) {
      throw new BadRequestException(
        'primaryIndex باید به یکی از فایل‌های ارسالی اشاره کند.',
      );
    }

    return primaryIndex;
  }

  private toOptionalBoolean(
    value: boolean | string | undefined,
  ): boolean | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }

    return undefined;
  }

  private toOptionalInteger(
    value: number | string | undefined,
  ): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    const parsed = Number(value.trim());

    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
  }

  private safeOriginalName(originalName: string | undefined): string {
    const name = originalName?.trim();

    return name && name.length > 0 ? name : 'product-media';
  }
}
