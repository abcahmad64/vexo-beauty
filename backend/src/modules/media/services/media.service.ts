import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import {
  MediaConstants,
  MediaFileKind,
  MediaFolder,
} from '../constants/media.constants';

import { AttachProductImageDto } from '../dto/attach-product-image.dto';

import { QueryProductImageDto } from '../dto/query-product-image.dto';

import { ReorderProductImagesDto } from '../dto/reorder-product-images.dto';

import { SetEntityImageDto } from '../dto/set-entity-image.dto';

import { UpdateProductImageDto } from '../dto/update-product-image.dto';

import { UploadMediaDto } from '../dto/upload-media.dto';

import { MediaEventPublisher } from '../events/media.event.publisher';

import { MediaStorageService } from './media-storage.service';

type ProductContextRow = {
  id: string;
  name: string;
  sku: string;
  deleted_at: Date | null;
};

type VariantContextRow = {
  id: string;
  product_id: string;
  sku: string;
  deleted_at: Date | null;
  product_deleted_at: Date | null;
};

type UserContextRow = {
  id: string;
  avatar_url: string | null;
  deleted_at: Date | null;
  status: string;
};

const AVATAR_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const AVATAR_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const MEDIA_SERVICE_MESSAGES = {
  NO_UPDATE_FIELDS: 'هیچ فیلدی برای ویرایش تصویر ارسال نشده است.',
  PRODUCT_IMAGE_NOT_FOUND: 'تصویر محصول یافت نشد.',
  PRODUCT_NOT_FOUND: 'محصول یافت نشد.',
  VARIANT_NOT_FOUND: 'تنوع محصول یافت نشد.',
  USER_NOT_FOUND: 'کاربر یافت نشد.',
  AVATAR_UPLOAD_REQUIRED:
    'آواتار مشتری فقط از مسیر بارگذاری امن قابل تنظیم است.',
  AVATAR_TYPE_NOT_ALLOWED: 'فرمت آواتار باید JPEG، PNG یا WebP باشد.',
  AVATAR_FILE_INVALID: 'محتوای فایل آواتار با فرمت اعلام‌شده مطابقت ندارد.',
  AVATAR_FILE_TOO_LARGE: 'حجم آواتار نباید بیشتر از ۵ مگابایت باشد.',
  BRAND_NOT_FOUND: 'برند یافت نشد.',
  CATEGORY_NOT_FOUND: 'دسته‌بندی یافت نشد.',
  IMAGES_DO_NOT_BELONG_TO_PRODUCT: 'یک یا چند تصویر متعلق به این محصول نیستند.',
  PRODUCT_IMAGE_DELETED: 'تصویر محصول با موفقیت حذف شد.',
} as const;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService,
    private readonly eventPublisher: MediaEventPublisher,
  ) {}

  async upload(
    file: Express.Multer.File,
    dto: UploadMediaDto,
    actorId?: string,
  ) {
    const result = await this.storage.uploadFile(file, {
      folder: dto.folder ?? MediaFolder.GENERAL,
      entityId: dto.entityId,
    });

    this.eventPublisher.publishFileUploaded({
      url: result.url,
      key: result.key,
      driver: result.driver,
      mimeType: result.mimeType,
      size: result.size,
      kind: result.kind,
      actorId,
      occurredAt: new Date(),
    });

    return result;
  }

  async uploadImage(
    file: Express.Multer.File,
    options: {
      readonly folder: MediaFolder;
      readonly entityId?: string;
      readonly actorId?: string;
    },
  ) {
    const result = await this.storage.uploadFile(file, {
      folder: options.folder,
      entityId: options.entityId,
      allowedKinds: [MediaFileKind.IMAGE],
    });

    this.eventPublisher.publishFileUploaded({
      url: result.url,
      key: result.key,
      driver: result.driver,
      mimeType: result.mimeType,
      size: result.size,
      kind: result.kind,
      actorId: options.actorId,
      occurredAt: new Date(),
    });

    return result;
  }

  async findProductImages(productId: string, query: QueryProductImageDto = {}) {
    await this.assertProductExists(productId);

    const images = await this.prisma.productImage.findMany({
      where: {
        productId,
        ...(query.primaryOnly === true
          ? {
              isPrimary: true,
            }
          : {}),
      },
      select: {
        id: true,
        productId: true,
        url: true,
        altText: true,
        sortOrder: true,
        isPrimary: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        {
          isPrimary: 'desc',
        },
        {
          sortOrder: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    return images.map((image) => this.mapProductImageEntity(image));
  }

  async findPrimaryProductImage(productId: string) {
    await this.assertProductExists(productId);

    const image = await this.prisma.productImage.findFirst({
      where: {
        productId,
        isPrimary: true,
      },
      select: {
        id: true,
        productId: true,
        url: true,
        altText: true,
        sortOrder: true,
        isPrimary: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    return image ? this.mapProductImageEntity(image) : null;
  }

  async uploadProductImage(
    productId: string,
    file: Express.Multer.File,
    dto: UploadMediaDto,
    actorId?: string,
  ) {
    await this.assertProductExists(productId);

    const uploaded = await this.uploadImage(file, {
      folder: MediaFolder.PRODUCTS,
      entityId: productId,
      actorId,
    });

    return this.attachProductImage(
      productId,
      {
        url: uploaded.url,
        altText: dto.altText,
        isPrimary: dto.isPrimary,
      },
      actorId,
    );
  }

  async attachProductImage(
    productId: string,
    dto: AttachProductImageDto,
    actorId?: string,
  ) {
    await this.assertProductExists(productId);

    const sortOrder =
      dto.sortOrder ?? (await this.getNextProductImageSortOrder(productId));

    const shouldBePrimary =
      dto.isPrimary === true ||
      (await this.countProductImages(productId)) === 0;

    const image = await this.prisma.$transaction(async (tx) => {
      if (shouldBePrimary) {
        await tx.productImage.updateMany({
          where: {
            productId,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      return tx.productImage.create({
        data: {
          productId,
          url: dto.url,
          altText: dto.altText ?? null,
          sortOrder,
          isPrimary: shouldBePrimary,
        },
        select: {
          id: true,
          productId: true,
          url: true,
          altText: true,
          sortOrder: true,
          isPrimary: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    this.eventPublisher.publishProductImageAttached({
      productId: image.productId,
      imageId: image.id,
      url: image.url,
      isPrimary: image.isPrimary,
      actorId,
      occurredAt: new Date(),
    });

    return this.mapProductImageEntity(image);
  }

  async updateProductImage(
    imageId: string,
    dto: UpdateProductImageDto,
    actorId?: string,
  ) {
    const changedFields = this.getChangedFields(dto);

    if (changedFields.length === 0) {
      throw new BadRequestException(MEDIA_SERVICE_MESSAGES.NO_UPDATE_FIELDS);
    }

    const current = await this.findProductImageEntity(imageId);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary === true) {
        await tx.productImage.updateMany({
          where: {
            productId: current.productId,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      return tx.productImage.update({
        where: {
          id: imageId,
        },
        data: {
          ...(dto.url !== undefined
            ? {
                url: dto.url,
              }
            : {}),
          ...(dto.altText !== undefined
            ? {
                altText: dto.altText,
              }
            : {}),
          ...(dto.sortOrder !== undefined
            ? {
                sortOrder: dto.sortOrder,
              }
            : {}),
          ...(dto.isPrimary !== undefined
            ? {
                isPrimary: dto.isPrimary,
              }
            : {}),
        },
        select: {
          id: true,
          productId: true,
          url: true,
          altText: true,
          sortOrder: true,
          isPrimary: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    if (current.isPrimary && dto.isPrimary === false) {
      await this.ensureProductHasPrimaryImage(current.productId);
    }

    this.eventPublisher.publishProductImageUpdated({
      productId: updated.productId,
      imageId: updated.id,
      changedFields,
      actorId,
      occurredAt: new Date(),
    });

    return this.mapProductImageEntity(updated);
  }

  async setPrimaryProductImage(imageId: string, actorId?: string) {
    const image = await this.findProductImageEntity(imageId);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.productImage.updateMany({
        where: {
          productId: image.productId,
        },
        data: {
          isPrimary: false,
        },
      });

      return tx.productImage.update({
        where: {
          id: image.id,
        },
        data: {
          isPrimary: true,
        },
        select: {
          id: true,
          productId: true,
          url: true,
          altText: true,
          sortOrder: true,
          isPrimary: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    this.eventPublisher.publishProductImagePrimarySet({
      productId: updated.productId,
      imageId: updated.id,
      actorId,
      occurredAt: new Date(),
    });

    return this.mapProductImageEntity(updated);
  }

  async reorderProductImages(
    productId: string,
    dto: ReorderProductImagesDto,
    actorId?: string,
  ) {
    await this.assertProductExists(productId);

    const imageIds = dto.images.map((image) => image.id);

    const existingCount = await this.prisma.productImage.count({
      where: {
        productId,
        id: {
          in: imageIds,
        },
      },
    });

    if (existingCount !== imageIds.length) {
      throw new BadRequestException(
        MEDIA_SERVICE_MESSAGES.IMAGES_DO_NOT_BELONG_TO_PRODUCT,
      );
    }

    await this.prisma.$transaction(
      dto.images.map((image) =>
        this.prisma.productImage.update({
          where: {
            id: image.id,
          },
          data: {
            sortOrder: image.sortOrder,
          },
        }),
      ),
    );

    this.eventPublisher.publishProductImagesReordered({
      productId,
      imageIds,
      actorId,
      occurredAt: new Date(),
    });

    return this.findProductImages(productId);
  }

  async deleteProductImage(
    imageId: string,
    options: {
      readonly deleteFile?: boolean;
      readonly actorId?: string;
    } = {},
  ) {
    const image = await this.findProductImageEntity(imageId);

    await this.prisma.productImage.delete({
      where: {
        id: image.id,
      },
    });

    if (options.deleteFile === true) {
      await this.storage.deleteByUrl(image.url);

      this.eventPublisher.publishFileDeleted({
        url: image.url,
        actorId: options.actorId,
        occurredAt: new Date(),
      });
    }

    await this.ensureProductHasPrimaryImage(image.productId);

    this.eventPublisher.publishProductImageDeleted({
      productId: image.productId,
      imageId: image.id,
      url: image.url,
      actorId: options.actorId,
      occurredAt: new Date(),
    });

    return {
      success: true,
      message: MEDIA_SERVICE_MESSAGES.PRODUCT_IMAGE_DELETED,
    };
  }

  async setBrandLogo(
    brandId: string,
    dto: SetEntityImageDto,
    actorId?: string,
  ) {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id: brandId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!brand) {
      throw new NotFoundException(MEDIA_SERVICE_MESSAGES.BRAND_NOT_FOUND);
    }

    const updated = await this.prisma.brand.update({
      where: {
        id: brandId,
      },
      data: {
        logoUrl: dto.url,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        updatedAt: true,
      },
    });

    this.eventPublisher.publishBrandLogoUpdated({
      brandId: updated.id,
      logoUrl: updated.logoUrl,
      actorId,
      occurredAt: new Date(),
    });

    return updated;
  }

  async uploadBrandLogo(
    brandId: string,
    file: Express.Multer.File,
    actorId?: string,
  ) {
    const uploaded = await this.uploadImage(file, {
      folder: MediaFolder.BRANDS,
      entityId: brandId,
      actorId,
    });

    return this.setBrandLogo(
      brandId,
      {
        url: uploaded.url,
      },
      actorId,
    );
  }

  async setCategoryImage(
    categoryId: string,
    dto: SetEntityImageDto,
    actorId?: string,
  ) {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      throw new NotFoundException(MEDIA_SERVICE_MESSAGES.CATEGORY_NOT_FOUND);
    }

    const updated = await this.prisma.category.update({
      where: {
        id: categoryId,
      },
      data: {
        image: dto.url,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        updatedAt: true,
      },
    });

    this.eventPublisher.publishCategoryImageUpdated({
      categoryId: updated.id,
      imageUrl: updated.image,
      actorId,
      occurredAt: new Date(),
    });

    return updated;
  }

  async uploadCategoryImage(
    categoryId: string,
    file: Express.Multer.File,
    actorId?: string,
  ) {
    const uploaded = await this.uploadImage(file, {
      folder: MediaFolder.CATEGORIES,
      entityId: categoryId,
      actorId,
    });

    return this.setCategoryImage(
      categoryId,
      {
        url: uploaded.url,
      },
      actorId,
    );
  }

  async setUserAvatar(
    userId: string,
    dto: SetEntityImageDto,
    actorId?: string,
  ) {
    if (actorId === userId) {
      throw new BadRequestException(
        MEDIA_SERVICE_MESSAGES.AVATAR_UPLOAD_REQUIRED,
      );
    }

    const currentUser = await this.assertUserExists(userId);

    return this.updateUserAvatar(currentUser, dto.url, actorId);
  }

  async uploadUserAvatar(
    userId: string,
    file: Express.Multer.File,
    actorId?: string,
  ) {
    this.validateAvatarFile(file);

    const currentUser = await this.assertUserExists(userId);
    const uploaded = await this.uploadImage(file, {
      folder: MediaFolder.USERS,
      entityId: userId,
      actorId,
    });

    try {
      return await this.updateUserAvatar(currentUser, uploaded.url, actorId);
    } catch (error) {
      await this.deleteAvatarFileSafely(uploaded.url, userId, 'rollback');

      throw error;
    }
  }

  async removeUserAvatar(userId: string, actorId?: string) {
    const currentUser = await this.assertUserExists(userId);

    if (!currentUser.avatar_url) {
      return {
        userId,
        avatarUrl: null,
      };
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          "avatarUrl" = NULL,
          "updatedAt" = ${now}
        WHERE "id" = ${userId}
          AND "deleted_at" IS NULL
          AND "status"::text <> 'DELETED'
      `,
    );

    this.eventPublisher.publishUserAvatarUpdated({
      userId,
      avatarUrl: null,
      actorId: actorId ?? userId,
      occurredAt: now,
    });

    await this.deleteAvatarFileSafely(currentUser.avatar_url, userId, 'remove');

    return {
      userId,
      avatarUrl: null,
    };
  }

  async getUserAvatar(userId: string) {
    const user = await this.assertUserExists(userId);

    return {
      userId: user.id,
      avatarUrl: user.avatar_url,
    };
  }

  async setVariantImage(
    variantId: string,
    dto: SetEntityImageDto,
    actorId?: string,
  ) {
    const variant = await this.assertVariantExists(variantId);

    const updated = await this.prisma.productVariant.update({
      where: {
        id: variant.id,
      },
      data: {
        imageUrl: dto.url,
      },
      select: {
        id: true,
        productId: true,
        sku: true,
        imageUrl: true,
        updatedAt: true,
      },
    });

    this.eventPublisher.publishVariantImageUpdated({
      variantId: updated.id,
      productId: updated.productId,
      imageUrl: updated.imageUrl,
      actorId,
      occurredAt: new Date(),
    });

    return updated;
  }

  async uploadVariantImage(
    variantId: string,
    file: Express.Multer.File,
    actorId?: string,
  ) {
    const variant = await this.assertVariantExists(variantId);

    const uploaded = await this.uploadImage(file, {
      folder: MediaFolder.VARIANTS,
      entityId: variant.id,
      actorId,
    });

    return this.setVariantImage(
      variantId,
      {
        url: uploaded.url,
      },
      actorId,
    );
  }

  private async findProductImageEntity(imageId: string) {
    const image = await this.prisma.productImage.findUnique({
      where: {
        id: imageId,
      },
      select: {
        id: true,
        productId: true,
        url: true,
        altText: true,
        sortOrder: true,
        isPrimary: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!image) {
      throw new NotFoundException(
        MEDIA_SERVICE_MESSAGES.PRODUCT_IMAGE_NOT_FOUND,
      );
    }

    return image;
  }

  private async getNextProductImageSortOrder(
    productId: string,
  ): Promise<number> {
    const last = await this.prisma.productImage.findFirst({
      where: {
        productId,
      },
      select: {
        sortOrder: true,
      },
      orderBy: {
        sortOrder: 'desc',
      },
    });

    return (last?.sortOrder ?? -1) + 1;
  }

  private async countProductImages(productId: string): Promise<number> {
    return this.prisma.productImage.count({
      where: {
        productId,
      },
    });
  }

  private async ensureProductHasPrimaryImage(productId: string): Promise<void> {
    const currentPrimary = await this.prisma.productImage.findFirst({
      where: {
        productId,
        isPrimary: true,
      },
      select: {
        id: true,
      },
    });

    if (currentPrimary) {
      return;
    }

    const firstImage = await this.prisma.productImage.findFirst({
      where: {
        productId,
      },
      select: {
        id: true,
      },
      orderBy: [
        {
          sortOrder: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    if (!firstImage) {
      return;
    }

    await this.prisma.productImage.update({
      where: {
        id: firstImage.id,
      },
      data: {
        isPrimary: true,
      },
    });
  }

  private async assertProductExists(
    productId: string,
  ): Promise<ProductContextRow> {
    const rows = await this.prisma.$queryRaw<ProductContextRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "name",
            "sku",
            "deleted_at" AS deleted_at
          FROM "Product"
          WHERE "id" = ${productId}
          LIMIT 1
        `,
    );

    const product = rows[0];

    if (!product || product.deleted_at !== null) {
      throw new NotFoundException(MEDIA_SERVICE_MESSAGES.PRODUCT_NOT_FOUND);
    }

    return product;
  }

  private async assertVariantExists(
    variantId: string,
  ): Promise<VariantContextRow> {
    const rows = await this.prisma.$queryRaw<VariantContextRow[]>(
      Prisma.sql`
          SELECT
            pv."id",
            pv."productId" AS product_id,
            pv."sku",
            pv."deleted_at" AS deleted_at,
            p."deleted_at" AS product_deleted_at
          FROM "ProductVariant" pv
          INNER JOIN "Product" p
            ON p."id" = pv."productId"
          WHERE pv."id" = ${variantId}
          LIMIT 1
        `,
    );

    const variant = rows[0];

    if (
      !variant ||
      variant.deleted_at !== null ||
      variant.product_deleted_at !== null
    ) {
      throw new NotFoundException(MEDIA_SERVICE_MESSAGES.VARIANT_NOT_FOUND);
    }

    return variant;
  }

  private validateAvatarFile(
    file: Express.Multer.File | undefined,
  ): asserts file is Express.Multer.File {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException(MEDIA_SERVICE_MESSAGES.AVATAR_FILE_INVALID);
    }

    if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.mimetype as never)) {
      throw new BadRequestException(
        MEDIA_SERVICE_MESSAGES.AVATAR_TYPE_NOT_ALLOWED,
      );
    }

    if (Math.max(file.size, file.buffer.length) > AVATAR_MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        MEDIA_SERVICE_MESSAGES.AVATAR_FILE_TOO_LARGE,
      );
    }

    if (!this.hasValidAvatarSignature(file)) {
      throw new BadRequestException(MEDIA_SERVICE_MESSAGES.AVATAR_FILE_INVALID);
    }
  }

  private hasValidAvatarSignature(file: Express.Multer.File): boolean {
    const buffer = file.buffer;

    if (file.mimetype === 'image/jpeg') {
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    }

    if (file.mimetype === 'image/png') {
      const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

      return (
        buffer.length >= signature.length &&
        signature.every((value, index) => buffer[index] === value)
      );
    }

    if (file.mimetype === 'image/webp') {
      return (
        buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
      );
    }

    return false;
  }

  private async updateUserAvatar(
    currentUser: UserContextRow,
    avatarUrl: string,
    actorId?: string,
  ) {
    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          "avatarUrl" = ${avatarUrl},
          "updatedAt" = ${now}
        WHERE "id" = ${currentUser.id}
          AND "deleted_at" IS NULL
          AND "status"::text <> 'DELETED'
      `,
    );

    this.eventPublisher.publishUserAvatarUpdated({
      userId: currentUser.id,
      avatarUrl,
      actorId,
      occurredAt: now,
    });

    if (currentUser.avatar_url && currentUser.avatar_url !== avatarUrl) {
      await this.deleteAvatarFileSafely(
        currentUser.avatar_url,
        currentUser.id,
        'replace',
      );
    }

    return {
      userId: currentUser.id,
      avatarUrl,
    };
  }

  private isManagedUserAvatarUrl(url: string, userId: string): boolean {
    const normalizedUrl = url.trim();
    const userKeyPrefix = `users/${userId}/`;

    if (!normalizedUrl || normalizedUrl.includes('..')) {
      return false;
    }

    if (normalizedUrl.replace(/^\/+/, '').startsWith(userKeyPrefix)) {
      return true;
    }

    const managedBaseUrls = [
      MediaConstants.PUBLIC_BASE_URL,
      MediaConstants.BUNNY_CDN_URL,
    ]
      .map((baseUrl) => baseUrl.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    return managedBaseUrls.some((baseUrl) =>
      normalizedUrl.startsWith(`${baseUrl}/${userKeyPrefix}`),
    );
  }

  private async deleteAvatarFileSafely(
    url: string,
    userId: string,
    operation: 'replace' | 'remove' | 'rollback',
  ): Promise<void> {
    if (!this.isManagedUserAvatarUrl(url, userId)) {
      return;
    }

    try {
      await this.storage.deleteByUrl(url);
    } catch (error) {
      this.logger.warn(
        `Avatar file cleanup failed: user=${userId}; operation=${operation}; error=${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async assertUserExists(userId: string): Promise<UserContextRow> {
    const rows = await this.prisma.$queryRaw<UserContextRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "avatarUrl" AS avatar_url,
            "deleted_at" AS deleted_at,
            "status"::text AS status
          FROM "User"
          WHERE "id" = ${userId}
          LIMIT 1
        `,
    );

    const user = rows[0];

    if (!user || user.deleted_at !== null || user.status === 'DELETED') {
      throw new NotFoundException(MEDIA_SERVICE_MESSAGES.USER_NOT_FOUND);
    }

    return user;
  }

  private mapProductImageEntity(image: {
    id: string;
    productId: string;
    url: string;
    altText: string | null;
    sortOrder: number;
    isPrimary: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: image.id,
      productId: image.productId,
      url: image.url,
      altText: image.altText,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary,
      createdAt: image.createdAt.toISOString(),
      createdAtFa: this.formatDateTimeFa(image.createdAt),
      updatedAt: image.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTimeFa(image.updatedAt),
    };
  }

  private formatDateTimeFa(date: Date): string {
    return formatPersianDateTime(date) ?? '';
  }

  private getChangedFields(dto: UpdateProductImageDto): string[] {
    return Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
  }
}
