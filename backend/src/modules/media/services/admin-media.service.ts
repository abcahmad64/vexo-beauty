import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { MediaFileKind, MediaFolder } from '../constants/media.constants';

import { AdminAttachProductImageDto } from '../dto/admin-attach-product-image.dto';

import { AdminMediaNoteDto } from '../dto/admin-media-note.dto';

import { AdminQueryMediaDto } from '../dto/admin-query-media.dto';

import { AdminReorderProductMediaDto } from '../dto/admin-reorder-product-media.dto';

import { AdminSetEntityMediaDto } from '../dto/admin-set-entity-media.dto';

import { AdminUpdateProductImageDto } from '../dto/admin-update-product-image.dto';

import { AdminUploadMediaDto } from '../dto/admin-upload-media.dto';

import { MediaStorageService } from './media-storage.service';

type CountRow = {
  count: number | bigint;
};

type ProductContextRow = {
  id: string;
  name: string;
  sku: string;
  deletedAt: Date | null;
};

type BrandContextRow = {
  id: string;
  name: string;
  logoUrl: string | null;
  deletedAt: Date | null;
};

type CategoryContextRow = {
  id: string;
  name: string;
  image: string | null;
  deletedAt: Date | null;
};

type VariantContextRow = {
  id: string;
  productId: string;
  sku: string;
  imageUrl: string | null;
  deletedAt: Date | null;
  productDeletedAt: Date | null;
};

type UserContextRow = {
  id: string;
  email: string;
  avatarUrl: string | null;
  status: string;
  deletedAt: Date | null;
};

type ProductImageRow = {
  id: string;
  productId: string;
  productName: string | null;
  productSku: string | null;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminMediaAssetRow = {
  id: string;
  mediaKey: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  url: string;
  altText: string | null;
  sortOrder: number | null;
  isPrimary: boolean;
  sourceTable: string;
  sourceColumn: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type EventRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  userId: string | null;
  data: unknown;
  timestamp: Date;
  createdAt: Date;
};

@Injectable()
export class AdminMediaService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService,
  ) {}

  async findAll(query: AdminQueryMediaDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildMediaWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AdminMediaAssetRow[]>(
        Prisma.sql`
            WITH media AS (
              ${this.mediaUnionSql()}
            )
            SELECT *
            FROM media m
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolveMediaSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              m."mediaKey" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            WITH media AS (
              ${this.mediaUnionSql()}
            )
            SELECT
              COUNT(*)::int AS "count"
            FROM media m
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapMedia(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDashboard(query: AdminQueryMediaDto) {
    const where = this.buildMediaWhere(query);

    const rows = await this.prisma.$queryRaw<
      Array<{
        total: number | bigint;
        productImages: number | bigint;
        brandLogos: number | bigint;
        categoryImages: number | bigint;
        variantImages: number | bigint;
        userAvatars: number | bigint;
        primaryProductImages: number | bigint;
        withoutAltText: number | bigint;
      }>
    >(
      Prisma.sql`
          WITH media AS (
            ${this.mediaUnionSql()}
          )
          SELECT
            COUNT(*)::int AS "total",
            COUNT(*) FILTER (WHERE m."entityType" = 'PRODUCT_IMAGE')::int AS "productImages",
            COUNT(*) FILTER (WHERE m."entityType" = 'BRAND_LOGO')::int AS "brandLogos",
            COUNT(*) FILTER (WHERE m."entityType" = 'CATEGORY_IMAGE')::int AS "categoryImages",
            COUNT(*) FILTER (WHERE m."entityType" = 'VARIANT_IMAGE')::int AS "variantImages",
            COUNT(*) FILTER (WHERE m."entityType" = 'USER_AVATAR')::int AS "userAvatars",
            COUNT(*) FILTER (
              WHERE m."entityType" = 'PRODUCT_IMAGE'
                AND m."isPrimary" = TRUE
            )::int AS "primaryProductImages",
            COUNT(*) FILTER (
              WHERE m."altText" IS NULL OR m."altText" = ''
            )::int AS "withoutAltText"
          FROM media m
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    const row = rows[0];

    return {
      total: this.toNumber(row?.total),
      productImages: this.toNumber(row?.productImages),
      brandLogos: this.toNumber(row?.brandLogos),
      categoryImages: this.toNumber(row?.categoryImages),
      variantImages: this.toNumber(row?.variantImages),
      userAvatars: this.toNumber(row?.userAvatars),
      primaryProductImages: this.toNumber(row?.primaryProductImages),
      withoutAltText: this.toNumber(row?.withoutAltText),
    };
  }

  async upload(
    file: Express.Multer.File,
    dto: AdminUploadMediaDto,
    actorId?: string,
  ) {
    const upload = await this.storage.uploadFile(file, {
      folder: dto.folder ?? this.resolveFolderByEntityType(dto.entityType),
      entityId: dto.entityId,
      allowedKinds: dto.kind ? [dto.kind] : undefined,
    });

    await this.createSystemEvent(
      'media.admin_uploaded',
      'فایل رسانه‌ای توسط مدیر آپلود شد.',
      upload.key,
      actorId,
      {
        url: upload.url,
        key: upload.key,
        driver: upload.driver,
        folder: upload.folder,
        mimeType: upload.mimeType,
        size: upload.size,
        kind: upload.kind,
        entityType: dto.entityType ?? null,
        entityId: dto.entityId ?? null,
      },
    );

    const attachment =
      dto.attachToEntity === true
        ? await this.attachUploadedFileToEntity(upload.url, dto, actorId)
        : null;

    return {
      upload,
      attachment,
    };
  }

  async uploadProductImage(
    productId: string,
    file: Express.Multer.File,
    dto: AdminUploadMediaDto,
    actorId?: string,
  ) {
    const upload = await this.storage.uploadFile(file, {
      folder: dto.folder ?? MediaFolder.PRODUCTS,
      entityId: productId,
      allowedKinds: [MediaFileKind.IMAGE],
    });

    const image = await this.attachProductImage(
      productId,
      {
        url: upload.url,
        altText: dto.altText,
        isPrimary: dto.isPrimary,
      },
      actorId,
    );

    return {
      upload,
      image,
    };
  }

  async findProductImages(productId?: string) {
    const where: Prisma.Sql[] = [];

    if (productId) {
      await this.assertProductExists(productId);

      where.push(Prisma.sql`pi."productId" = ${productId}`);
    } else {
      where.push(Prisma.sql`TRUE`);
    }

    const rows = await this.prisma.$queryRaw<ProductImageRow[]>(
      Prisma.sql`
          SELECT
            pi."id",
            pi."productId",
            p."name" AS "productName",
            p."sku" AS "productSku",
            pi."url",
            pi."altText",
            pi."sortOrder",
            pi."isPrimary",
            pi."createdAt",
            pi."updatedAt"
          FROM "ProductImage" pi
          LEFT JOIN "Product" p
            ON p."id" = pi."productId"
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            pi."isPrimary" DESC,
            pi."sortOrder" ASC,
            pi."createdAt" ASC
        `,
    );

    return {
      data: rows.map((row) => this.mapProductImage(row)),
      meta: {
        total: rows.length,
      },
    };
  }

  async attachProductImage(
    productId: string,
    dto: AdminAttachProductImageDto,
    actorId?: string,
  ) {
    const now = new Date();

    await this.assertProductExists(productId);

    const imageId = randomUUID();

    const sortOrder =
      dto.sortOrder ?? (await this.getNextProductImageSortOrder(productId));

    await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary === true) {
        await tx.$executeRaw(
          Prisma.sql`
              UPDATE "ProductImage"
              SET
                "isPrimary" = FALSE,
                "updatedAt" = ${now}
              WHERE "productId" = ${productId}
            `,
        );
      }

      await tx.$executeRaw(
        Prisma.sql`
            INSERT INTO "ProductImage" (
              "id",
              "productId",
              "url",
              "altText",
              "sortOrder",
              "isPrimary",
              "createdAt",
              "updatedAt"
            )
            VALUES (
              ${imageId},
              ${productId},
              ${dto.url},
              ${dto.altText ?? null},
              ${sortOrder},
              ${dto.isPrimary ?? false},
              ${now},
              ${now}
            )
          `,
      );

      await this.ensureProductHasPrimaryImageTx(tx, productId);
    });

    await this.createSystemEvent(
      'media.product_image.attached',
      'تصویر محصول توسط مدیر ثبت شد.',
      imageId,
      actorId,
      {
        productId,
        url: dto.url,
        isPrimary: dto.isPrimary ?? false,
      },
    );

    return {
      image: await this.findProductImage(imageId),
      audit: {
        actorId: actorId ?? null,
        action: 'media.product_image_attached',
      },
    };
  }

  async updateProductImage(
    imageId: string,
    dto: AdminUpdateProductImageDto,
    actorId?: string,
  ) {
    const now = new Date();

    const current = await this.findProductImageRow(imageId);

    const assignments = this.buildProductImageAssignments(dto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی تصویر محصول ارسال نشده است.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary === true) {
        await tx.$executeRaw(
          Prisma.sql`
              UPDATE "ProductImage"
              SET
                "isPrimary" = FALSE,
                "updatedAt" = ${now}
              WHERE "productId" = ${current.productId}
            `,
        );
      }

      await tx.$executeRaw(
        Prisma.sql`
            UPDATE "ProductImage"
            SET
              ${Prisma.join(assignments, ', ')},
              "updatedAt" = ${now}
            WHERE "id" = ${imageId}
          `,
      );

      await this.ensureProductHasPrimaryImageTx(tx, current.productId);
    });

    await this.createSystemEvent(
      'media.product_image.updated',
      'تصویر محصول توسط مدیر به‌روزرسانی شد.',
      imageId,
      actorId,
      {
        productId: current.productId,
        changedFields: Object.keys(dto),
      },
    );

    return {
      image: await this.findProductImage(imageId),
      audit: {
        actorId: actorId ?? null,
        action: 'media.product_image_updated',
      },
    };
  }

  async setPrimaryProductImage(imageId: string, actorId?: string) {
    const now = new Date();

    const image = await this.findProductImageRow(imageId);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
            UPDATE "ProductImage"
            SET
              "isPrimary" = FALSE,
              "updatedAt" = ${now}
            WHERE "productId" = ${image.productId}
          `,
      );

      await tx.$executeRaw(
        Prisma.sql`
            UPDATE "ProductImage"
            SET
              "isPrimary" = TRUE,
              "updatedAt" = ${now}
            WHERE "id" = ${imageId}
          `,
      );
    });

    await this.createSystemEvent(
      'media.product_image.primary_set',
      'تصویر اصلی محصول توسط مدیر انتخاب شد.',
      imageId,
      actorId,
      {
        productId: image.productId,
      },
    );

    return {
      image: await this.findProductImage(imageId),
      audit: {
        actorId: actorId ?? null,
        action: 'media.product_image_primary_set',
      },
    };
  }

  async reorderProductImages(
    productId: string,
    dto: AdminReorderProductMediaDto,
    actorId?: string,
  ) {
    const now = new Date();

    await this.assertProductExists(productId);

    if (dto.items.length === 0) {
      throw new BadRequestException('لیست مرتب‌سازی تصاویر محصول خالی است.');
    }

    const imageIds = Array.from(new Set(dto.items.map((item) => item.imageId)));

    const countRows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "ProductImage"
          WHERE
            "productId" = ${productId}
            AND "id" IN (${Prisma.join(imageIds)})
        `,
    );

    if (this.toNumber(countRows[0]?.count) !== imageIds.length) {
      throw new BadRequestException('برخی تصاویر برای این محصول معتبر نیستند.');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        await tx.$executeRaw(
          Prisma.sql`
              UPDATE "ProductImage"
              SET
                "sortOrder" = ${item.sortOrder},
                "updatedAt" = ${now}
              WHERE
                "id" = ${item.imageId}
                AND "productId" = ${productId}
            `,
        );
      }
    });

    await this.createSystemEvent(
      'media.product_images.reordered',
      'ترتیب تصاویر محصول توسط مدیر تغییر کرد.',
      productId,
      actorId,
      {
        imageCount: dto.items.length,
      },
    );

    return this.findProductImages(productId);
  }

  async deleteProductImage(
    imageId: string,
    options: {
      deleteFile?: boolean;
      actorId?: string;
    },
  ) {
    const image = await this.findProductImageRow(imageId);

    await this.prisma.$executeRaw(
      Prisma.sql`
        DELETE FROM "ProductImage"
        WHERE "id" = ${imageId}
      `,
    );

    if (options.deleteFile === true) {
      await this.storage.deleteByUrl(image.url);
    }

    await this.ensureProductHasPrimaryImage(image.productId);

    await this.createSystemEvent(
      'media.product_image.deleted',
      'تصویر محصول توسط مدیر حذف شد.',
      imageId,
      options.actorId,
      {
        productId: image.productId,
        url: image.url,
        fileDeleted: options.deleteFile === true,
      },
    );

    return {
      success: true,
      message: 'تصویر محصول با موفقیت حذف شد.',
      audit: {
        actorId: options.actorId ?? null,
        action: 'media.product_image_deleted',
      },
    };
  }

  async uploadBrandLogo(
    brandId: string,
    file: Express.Multer.File,
    dto: AdminUploadMediaDto,
    actorId?: string,
  ) {
    const upload = await this.storage.uploadFile(file, {
      folder: dto.folder ?? MediaFolder.BRANDS,
      entityId: brandId,
      allowedKinds: [MediaFileKind.IMAGE],
    });

    const result = await this.setBrandLogo(
      brandId,
      {
        url: upload.url,
        deleteOldFile: dto.deleteOldFile,
      },
      actorId,
    );

    return {
      upload,
      result,
    };
  }

  async setBrandLogo(
    brandId: string,
    dto: AdminSetEntityMediaDto,
    actorId?: string,
  ) {
    const now = new Date();

    const brand = await this.assertBrandExists(brandId);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Brand"
        SET
          "logoUrl" = ${dto.url},
          "updatedAt" = ${now}
        WHERE
          "id" = ${brandId}
          AND "deleted_at" IS NULL
      `,
    );

    if (dto.deleteOldFile === true) {
      await this.storage.deleteByUrl(brand.logoUrl);
    }

    await this.createSystemEvent(
      'media.brand_logo.updated',
      'لوگوی برند توسط مدیر به‌روزرسانی شد.',
      brandId,
      actorId,
      {
        url: dto.url,
        oldUrl: brand.logoUrl,
      },
    );

    return {
      brandId,
      logoUrl: dto.url,
    };
  }

  async uploadCategoryImage(
    categoryId: string,
    file: Express.Multer.File,
    dto: AdminUploadMediaDto,
    actorId?: string,
  ) {
    const upload = await this.storage.uploadFile(file, {
      folder: dto.folder ?? MediaFolder.CATEGORIES,
      entityId: categoryId,
      allowedKinds: [MediaFileKind.IMAGE],
    });

    const result = await this.setCategoryImage(
      categoryId,
      {
        url: upload.url,
        deleteOldFile: dto.deleteOldFile,
      },
      actorId,
    );

    return {
      upload,
      result,
    };
  }

  async setCategoryImage(
    categoryId: string,
    dto: AdminSetEntityMediaDto,
    actorId?: string,
  ) {
    const now = new Date();

    const category = await this.assertCategoryExists(categoryId);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Category"
        SET
          "image" = ${dto.url},
          "updatedAt" = ${now}
        WHERE
          "id" = ${categoryId}
          AND "deleted_at" IS NULL
      `,
    );

    if (dto.deleteOldFile === true) {
      await this.storage.deleteByUrl(category.image);
    }

    await this.createSystemEvent(
      'media.category_image.updated',
      'تصویر دسته‌بندی توسط مدیر به‌روزرسانی شد.',
      categoryId,
      actorId,
      {
        url: dto.url,
        oldUrl: category.image,
      },
    );

    return {
      categoryId,
      image: dto.url,
    };
  }

  async uploadVariantImage(
    variantId: string,
    file: Express.Multer.File,
    dto: AdminUploadMediaDto,
    actorId?: string,
  ) {
    const upload = await this.storage.uploadFile(file, {
      folder: dto.folder ?? MediaFolder.VARIANTS,
      entityId: variantId,
      allowedKinds: [MediaFileKind.IMAGE],
    });

    const result = await this.setVariantImage(
      variantId,
      {
        url: upload.url,
        deleteOldFile: dto.deleteOldFile,
      },
      actorId,
    );

    return {
      upload,
      result,
    };
  }

  async setVariantImage(
    variantId: string,
    dto: AdminSetEntityMediaDto,
    actorId?: string,
  ) {
    const now = new Date();

    const variant = await this.assertVariantExists(variantId);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "ProductVariant"
        SET
          "imageUrl" = ${dto.url},
          "updatedAt" = ${now}
        WHERE
          "id" = ${variantId}
          AND "deleted_at" IS NULL
      `,
    );

    if (dto.deleteOldFile === true) {
      await this.storage.deleteByUrl(variant.imageUrl);
    }

    await this.createSystemEvent(
      'media.variant_image.updated',
      'تصویر تنوع محصول توسط مدیر به‌روزرسانی شد.',
      variantId,
      actorId,
      {
        productId: variant.productId,
        url: dto.url,
        oldUrl: variant.imageUrl,
      },
    );

    return {
      variantId,
      imageUrl: dto.url,
    };
  }

  async uploadUserAvatar(
    userId: string,
    file: Express.Multer.File,
    dto: AdminUploadMediaDto,
    actorId?: string,
  ) {
    const upload = await this.storage.uploadFile(file, {
      folder: dto.folder ?? MediaFolder.USERS,
      entityId: userId,
      allowedKinds: [MediaFileKind.IMAGE],
    });

    const result = await this.setUserAvatar(
      userId,
      {
        url: upload.url,
        deleteOldFile: dto.deleteOldFile,
      },
      actorId,
    );

    return {
      upload,
      result,
    };
  }

  async setUserAvatar(
    userId: string,
    dto: AdminSetEntityMediaDto,
    actorId?: string,
  ) {
    const now = new Date();

    const user = await this.assertUserExists(userId);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          "avatarUrl" = ${dto.url},
          "updatedAt" = ${now}
        WHERE
          "id" = ${userId}
          AND "deleted_at" IS NULL
          AND "status"::text <> 'DELETED'
      `,
    );

    if (dto.deleteOldFile === true) {
      await this.storage.deleteByUrl(user.avatarUrl);
    }

    await this.createSystemEvent(
      'media.user_avatar.updated',
      'تصویر پروفایل کاربر توسط مدیر به‌روزرسانی شد.',
      userId,
      actorId,
      {
        url: dto.url,
        oldUrl: user.avatarUrl,
      },
    );

    return {
      userId,
      avatarUrl: dto.url,
    };
  }

  async getNotes(mediaKey: string, limit = 50) {
    const notes = await this.findMediaNotes(mediaKey, limit);

    return {
      data: notes.map((note) => this.mapNote(note)),
      meta: {
        mediaKey,
        total: notes.length,
      },
    };
  }

  async createNote(mediaKey: string, dto: AdminMediaNoteDto, actorId?: string) {
    const noteId = await this.createSystemEvent(
      'media.note.created',
      'یادداشت مدیریتی برای رسانه ثبت شد.',
      mediaKey,
      actorId,
      {
        mediaKey,
        note: dto.note,
        isImportant: dto.isImportant ?? false,
        visibility: dto.visibility ?? 'admin',
      },
    );

    return {
      success: true,
      noteId,
      message: 'یادداشت رسانه با موفقیت ثبت شد.',
    };
  }

  async findForExport(query: AdminQueryMediaDto) {
    const where = this.buildMediaWhere(query);

    const rows = await this.prisma.$queryRaw<AdminMediaAssetRow[]>(
      Prisma.sql`
          WITH media AS (
            ${this.mediaUnionSql()}
          )
          SELECT *
          FROM media m
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            m."createdAt" DESC,
            m."mediaKey" DESC
          LIMIT 5000
        `,
    );

    return rows.map((row) => this.mapMedia(row));
  }

  private async attachUploadedFileToEntity(
    url: string,
    dto: AdminUploadMediaDto,
    actorId?: string,
  ) {
    if (!dto.entityType || !dto.entityId) {
      throw new BadRequestException(
        'برای اتصال فایل به موجودیت، entityType و entityId الزامی است.',
      );
    }

    if (dto.entityType === 'PRODUCT_IMAGE') {
      return this.attachProductImage(
        dto.entityId,
        {
          url,
          altText: dto.altText,
          isPrimary: dto.isPrimary,
        },
        actorId,
      );
    }

    if (dto.entityType === 'BRAND_LOGO') {
      return this.setBrandLogo(
        dto.entityId,
        {
          url,
          deleteOldFile: dto.deleteOldFile,
        },
        actorId,
      );
    }

    if (dto.entityType === 'CATEGORY_IMAGE') {
      return this.setCategoryImage(
        dto.entityId,
        {
          url,
          deleteOldFile: dto.deleteOldFile,
        },
        actorId,
      );
    }

    if (dto.entityType === 'VARIANT_IMAGE') {
      return this.setVariantImage(
        dto.entityId,
        {
          url,
          deleteOldFile: dto.deleteOldFile,
        },
        actorId,
      );
    }

    return this.setUserAvatar(
      dto.entityId,
      {
        url,
        deleteOldFile: dto.deleteOldFile,
      },
      actorId,
    );
  }

  private mediaUnionSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        pi."id" AS "id",
        CONCAT('product_image:', pi."id") AS "mediaKey",
        'PRODUCT_IMAGE'::text AS "entityType",
        pi."productId" AS "entityId",
        p."name" AS "entityLabel",
        pi."url",
        pi."altText",
        pi."sortOrder",
        pi."isPrimary",
        'ProductImage'::text AS "sourceTable",
        'url'::text AS "sourceColumn",
        pi."createdAt",
        pi."updatedAt",
        p."deleted_at" AS "deletedAt"
      FROM "ProductImage" pi
      LEFT JOIN "Product" p
        ON p."id" = pi."productId"

      UNION ALL

      SELECT
        b."id" AS "id",
        CONCAT('brand_logo:', b."id") AS "mediaKey",
        'BRAND_LOGO'::text AS "entityType",
        b."id" AS "entityId",
        b."name" AS "entityLabel",
        b."logoUrl" AS "url",
        b."name" AS "altText",
        NULL::int AS "sortOrder",
        TRUE AS "isPrimary",
        'Brand'::text AS "sourceTable",
        'logoUrl'::text AS "sourceColumn",
        b."createdAt",
        b."updatedAt",
        b."deleted_at" AS "deletedAt"
      FROM "Brand" b
      WHERE b."logoUrl" IS NOT NULL

      UNION ALL

      SELECT
        c."id" AS "id",
        CONCAT('category_image:', c."id") AS "mediaKey",
        'CATEGORY_IMAGE'::text AS "entityType",
        c."id" AS "entityId",
        c."name" AS "entityLabel",
        c."image" AS "url",
        c."name" AS "altText",
        c."sortOrder" AS "sortOrder",
        TRUE AS "isPrimary",
        'Category'::text AS "sourceTable",
        'image'::text AS "sourceColumn",
        c."createdAt",
        c."updatedAt",
        c."deleted_at" AS "deletedAt"
      FROM "Category" c
      WHERE c."image" IS NOT NULL

      UNION ALL

      SELECT
        pv."id" AS "id",
        CONCAT('variant_image:', pv."id") AS "mediaKey",
        'VARIANT_IMAGE'::text AS "entityType",
        pv."id" AS "entityId",
        pv."sku" AS "entityLabel",
        pv."imageUrl" AS "url",
        pv."sku" AS "altText",
        NULL::int AS "sortOrder",
        TRUE AS "isPrimary",
        'ProductVariant'::text AS "sourceTable",
        'imageUrl'::text AS "sourceColumn",
        pv."createdAt",
        pv."updatedAt",
        pv."deleted_at" AS "deletedAt"
      FROM "ProductVariant" pv
      WHERE pv."imageUrl" IS NOT NULL

      UNION ALL

      SELECT
        u."id" AS "id",
        CONCAT('user_avatar:', u."id") AS "mediaKey",
        'USER_AVATAR'::text AS "entityType",
        u."id" AS "entityId",
        u."email" AS "entityLabel",
        u."avatarUrl" AS "url",
        CONCAT(u."firstName", ' ', u."lastName") AS "altText",
        NULL::int AS "sortOrder",
        TRUE AS "isPrimary",
        'User'::text AS "sourceTable",
        'avatarUrl'::text AS "sourceColumn",
        u."createdAt",
        u."updatedAt",
        u."deleted_at" AS "deletedAt"
      FROM "User" u
      WHERE u."avatarUrl" IS NOT NULL
    `;
  }

  private buildMediaWhere(query: AdminQueryMediaDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeletedEntities !== true) {
      where.push(Prisma.sql`m."deletedAt" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          m."mediaKey" ILIKE ${`%${query.q}%`}
          OR m."entityId" ILIKE ${`%${query.q}%`}
          OR m."entityLabel" ILIKE ${`%${query.q}%`}
          OR m."url" ILIKE ${`%${query.q}%`}
          OR m."altText" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.mediaKey) {
      where.push(Prisma.sql`m."mediaKey" = ${query.mediaKey}`);
    }

    if (query.entityId) {
      where.push(Prisma.sql`m."entityId" = ${query.entityId}`);
    }

    if (query.entityType) {
      where.push(Prisma.sql`m."entityType" = ${query.entityType}`);
    }

    if (query.isPrimary !== undefined) {
      where.push(Prisma.sql`m."isPrimary" = ${query.isPrimary}`);
    }

    if (query.hasAltText === true) {
      where.push(Prisma.sql`m."altText" IS NOT NULL`);
    }

    if (query.hasAltText === false) {
      where.push(Prisma.sql`m."altText" IS NULL`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`m."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`m."createdAt" <= ${new Date(query.createdTo)}`);
    }

    return where;
  }

  private async findProductImage(imageId: string) {
    return this.mapProductImage(await this.findProductImageRow(imageId));
  }

  private async findProductImageRow(imageId: string): Promise<ProductImageRow> {
    const rows = await this.prisma.$queryRaw<ProductImageRow[]>(
      Prisma.sql`
          SELECT
            pi."id",
            pi."productId",
            p."name" AS "productName",
            p."sku" AS "productSku",
            pi."url",
            pi."altText",
            pi."sortOrder",
            pi."isPrimary",
            pi."createdAt",
            pi."updatedAt"
          FROM "ProductImage" pi
          LEFT JOIN "Product" p
            ON p."id" = pi."productId"
          WHERE pi."id" = ${imageId}
          LIMIT 1
        `,
    );

    const image = rows[0];

    if (!image) {
      throw new NotFoundException('تصویر محصول موردنظر یافت نشد.');
    }

    return image;
  }

  private buildProductImageAssignments(
    dto: AdminUpdateProductImageDto,
  ): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.url !== undefined) {
      assignments.push(Prisma.sql`"url" = ${dto.url}`);
    }

    if (dto.altText !== undefined) {
      assignments.push(Prisma.sql`"altText" = ${dto.altText}`);
    }

    if (dto.sortOrder !== undefined) {
      assignments.push(Prisma.sql`"sortOrder" = ${dto.sortOrder}`);
    }

    if (dto.isPrimary !== undefined) {
      assignments.push(Prisma.sql`"isPrimary" = ${dto.isPrimary}`);
    }

    return assignments;
  }

  private async getNextProductImageSortOrder(
    productId: string,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        sortOrder: number | null;
      }>
    >(
      Prisma.sql`
          SELECT
            MAX("sortOrder") AS "sortOrder"
          FROM "ProductImage"
          WHERE "productId" = ${productId}
        `,
    );

    return (rows[0]?.sortOrder ?? -1) + 1;
  }

  private async ensureProductHasPrimaryImage(productId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.ensureProductHasPrimaryImageTx(tx, productId);
    });
  }

  private async ensureProductHasPrimaryImageTx(
    tx: Prisma.TransactionClient,
    productId: string,
  ): Promise<void> {
    const now = new Date();

    const primaryRows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "ProductImage"
          WHERE
            "productId" = ${productId}
            AND "isPrimary" = TRUE
        `,
    );

    if (this.toNumber(primaryRows[0]?.count) > 0) {
      return;
    }

    const rows = await tx.$queryRaw<
      Array<{
        id: string;
      }>
    >(
      Prisma.sql`
          SELECT "id"
          FROM "ProductImage"
          WHERE "productId" = ${productId}
          ORDER BY
            "sortOrder" ASC,
            "createdAt" ASC
          LIMIT 1
        `,
    );

    const firstImageId = rows[0]?.id;

    if (!firstImageId) {
      return;
    }

    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "ProductImage"
        SET
          "isPrimary" = TRUE,
          "updatedAt" = ${now}
        WHERE "id" = ${firstImageId}
      `,
    );
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
            "deleted_at" AS "deletedAt"
          FROM "Product"
          WHERE "id" = ${productId}
          LIMIT 1
        `,
    );

    const product = rows[0];

    if (!product || product.deletedAt !== null) {
      throw new NotFoundException('محصول موردنظر یافت نشد.');
    }

    return product;
  }

  private async assertBrandExists(brandId: string): Promise<BrandContextRow> {
    const rows = await this.prisma.$queryRaw<BrandContextRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "name",
            "logoUrl",
            "deleted_at" AS "deletedAt"
          FROM "Brand"
          WHERE "id" = ${brandId}
          LIMIT 1
        `,
    );

    const brand = rows[0];

    if (!brand || brand.deletedAt !== null) {
      throw new NotFoundException('برند موردنظر یافت نشد.');
    }

    return brand;
  }

  private async assertCategoryExists(
    categoryId: string,
  ): Promise<CategoryContextRow> {
    const rows = await this.prisma.$queryRaw<CategoryContextRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "name",
            "image",
            "deleted_at" AS "deletedAt"
          FROM "Category"
          WHERE "id" = ${categoryId}
          LIMIT 1
        `,
    );

    const category = rows[0];

    if (!category || category.deletedAt !== null) {
      throw new NotFoundException('دسته‌بندی موردنظر یافت نشد.');
    }

    return category;
  }

  private async assertVariantExists(
    variantId: string,
  ): Promise<VariantContextRow> {
    const rows = await this.prisma.$queryRaw<VariantContextRow[]>(
      Prisma.sql`
          SELECT
            pv."id",
            pv."productId",
            pv."sku",
            pv."imageUrl",
            pv."deleted_at" AS "deletedAt",
            p."deleted_at" AS "productDeletedAt"
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
      variant.deletedAt !== null ||
      variant.productDeletedAt !== null
    ) {
      throw new NotFoundException('تنوع محصول موردنظر یافت نشد.');
    }

    return variant;
  }

  private async assertUserExists(userId: string): Promise<UserContextRow> {
    const rows = await this.prisma.$queryRaw<UserContextRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "email",
            "avatarUrl",
            "status"::text AS "status",
            "deleted_at" AS "deletedAt"
          FROM "User"
          WHERE "id" = ${userId}
          LIMIT 1
        `,
    );

    const user = rows[0];

    if (!user || user.deletedAt !== null || user.status === 'DELETED') {
      throw new NotFoundException('کاربر موردنظر یافت نشد.');
    }

    return user;
  }

  private findMediaNotes(mediaKey: string, limit: number): Promise<EventRow[]> {
    return this.prisma.$queryRaw<EventRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "name",
          "description",
          "category",
          "userId",
          "data",
          "timestamp",
          "createdAt"
        FROM "Event"
        WHERE
          "deleted_at" IS NULL
          AND "name" = 'media.note.created'
          AND "data" #>> '{mediaKey}' = ${mediaKey}
        ORDER BY
          "timestamp" DESC,
          "createdAt" DESC
        LIMIT ${Math.min(Math.max(limit, 1), 200)}
      `,
    );
  }

  private async createSystemEvent(
    name: string,
    description: string,
    mediaKey: string,
    actorId: string | undefined,
    data: Record<string, unknown>,
  ): Promise<string> {
    const eventId = randomUUID();

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Event" (
          "id",
          "name",
          "description",
          "category",
          "timestamp",
          "userId",
          "data",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${eventId},
          ${name},
          ${description},
          'media',
          ${now},
          ${actorId ?? null},
          ${JSON.stringify({
            mediaKey,
            ...data,
          })}::jsonb,
          ${now},
          ${now}
        )
      `,
    );

    return eventId;
  }

  private resolveFolderByEntityType(entityType?: string): MediaFolder {
    if (entityType === 'PRODUCT_IMAGE') {
      return MediaFolder.PRODUCTS;
    }

    if (entityType === 'BRAND_LOGO') {
      return MediaFolder.BRANDS;
    }

    if (entityType === 'CATEGORY_IMAGE') {
      return MediaFolder.CATEGORIES;
    }

    if (entityType === 'VARIANT_IMAGE') {
      return MediaFolder.VARIANTS;
    }

    if (entityType === 'USER_AVATAR') {
      return MediaFolder.USERS;
    }

    return MediaFolder.GENERAL;
  }

  private mapMedia(row: AdminMediaAssetRow) {
    return {
      id: row.id,
      mediaKey: row.mediaKey,
      entityType: row.entityType,
      entityId: row.entityId,
      entityLabel: row.entityLabel,
      url: row.url,
      altText: row.altText,
      sortOrder: row.sortOrder,
      isPrimary: row.isPrimary,
      source: {
        table: row.sourceTable,
        column: row.sourceColumn,
      },
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: this.formatDateTimeFaNullable(row.deletedAt),
    };
  }

  private mapProductImage(row: ProductImageRow) {
    return {
      id: row.id,
      product: {
        id: row.productId,
        name: row.productName,
        sku: row.productSku,
      },
      url: row.url,
      altText: row.altText,
      sortOrder: row.sortOrder,
      isPrimary: row.isPrimary,
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updatedAt),
    };
  }

  private mapNote(row: EventRow) {
    const data = this.toRecord(row.data);

    return {
      id: row.id,
      note: data.note ?? null,
      isImportant: data.isImportant ?? false,
      visibility: data.visibility ?? 'admin',
      actorId: row.userId,
      createdAt: row.timestamp.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.timestamp),
    };
  }

  private resolveMediaSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`m."updatedAt"`;
    }

    if (sortBy === 'entityType') {
      return Prisma.sql`m."entityType"`;
    }

    if (sortBy === 'entityLabel') {
      return Prisma.sql`m."entityLabel"`;
    }

    if (sortBy === 'sortOrder') {
      return Prisma.sql`m."sortOrder"`;
    }

    if (sortBy === 'isPrimary') {
      return Prisma.sql`m."isPrimary"`;
    }

    return Prisma.sql`m."createdAt"`;
  }

  private resolveSortDirection(sortDirection?: string): Prisma.Sql {
    return sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  }

  private normalizePage(page?: number): number {
    if (!page || page < 1) {
      return this.defaultPage;
    }

    return page;
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || limit < 1) {
      return this.defaultLimit;
    }

    return Math.min(limit, this.maxLimit);
  }

  private formatDateTimeFa(date: Date): string {
    return formatPersianDateTime(date) ?? '';
  }

  private formatDateTimeFaNullable(date: Date | null): string | null {
    if (!date) {
      return null;
    }

    return formatPersianDateTime(date) ?? null;
  }

  private toNumber(value: unknown): number {
    if (value === undefined || value === null) {
      return 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    return Number(value);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
