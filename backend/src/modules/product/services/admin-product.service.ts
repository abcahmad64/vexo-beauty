import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { createHash, randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminCreateProductDto } from '../dto/admin-create-product.dto';

import { AdminProductAttributeValueDto } from '../dto/admin-product-attribute-value.dto';

import {
  AdminAddProductMediaDto,
  AdminReorderProductMediaDto,
  AdminUpdateProductMediaDto,
} from '../dto/admin-product-media.dto';

import { AdminQueryProductDto } from '../dto/admin-query-product.dto';

import { AdminUpdateProductStatusDto } from '../dto/admin-update-product-status.dto';

import { AdminUpdateProductDto } from '../dto/admin-update-product.dto';

import { ProductEventPublisher } from '../events/product.event.publisher';

type CountRow = {
  count: number | bigint;
};

type PrismaTx = Prisma.TransactionClient;

type ProductCreateRequestRecord = {
  actorId: string;
  productId: string;
  payloadFingerprint: string;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  schemaJson: Prisma.JsonValue | null;
  brandId: string;
  brandName: string | null;
  brandSlug: string | null;
  categoryId: string;
  categoryName: string | null;
  categorySlug: string | null;
  productTypeId: string | null;
  productTypeName: string | null;
  productTypeSlug: string | null;
  productModelId: string | null;
  productModelName: string | null;
  productModelSlug: string | null;
  productModelCode: string | null;
  sku: string;
  price: Prisma.Decimal | number | string;
  comparePrice: Prisma.Decimal | number | string | null;
  purchasePrice: Prisma.Decimal | number | string | null;
  salePrice: Prisma.Decimal | number | string | null;
  discountPercent: Prisma.Decimal | number | string | null;
  finalPrice: Prisma.Decimal | number | string | null;
  minAllowedPrice: Prisma.Decimal | number | string | null;
  grossMarginAmount: Prisma.Decimal | number | string | null;
  grossMarginPercent: Prisma.Decimal | number | string | null;
  weight: number | null;
  dimensions: Prisma.JsonValue | null;
  isActive: boolean;
  status: string;
  aiContentStatus: string;
  aiQualityScore: Prisma.Decimal | number | string | null;
  viewCount: number | bigint;
  reviewCount: number | bigint;
  averageRating: Prisma.Decimal | number | string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  primaryImageUrl: string | null;
  primaryImageAlt: string | null;
  variantCount: number | bigint | null;
  warehouseCount: number | bigint | null;
  totalQuantity: number | bigint | null;
  reservedQuantity: number | bigint | null;
  availableStock: number | bigint | null;
  lowStockThreshold: number | bigint | null;
};

type ProductImageRow = {
  id: string;
  productId: string;
  type: string;
  url: string;
  thumbnailUrl: string | null;
  altText: string | null;
  title: string | null;
  caption: string | null;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  sortOrder: number;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ProductAttributeRow = {
  attributeId: string | null;
  attributeCode: string | null;
  attributeName: string | null;
  attributeLabel: string | null;
  attributeValueId: string | null;
  predefinedValue: string | null;
  valueText: string | null;
  valueNumber: Prisma.Decimal | number | string | null;
  valueBoolean: boolean | null;
  valueJson: Prisma.JsonValue | null;
  unit: string | null;
};

type PricingSnapshot = {
  price: Prisma.Decimal;
  comparePrice: Prisma.Decimal | null;
  purchasePrice: Prisma.Decimal | null;
  salePrice: Prisma.Decimal | null;
  discountPercent: Prisma.Decimal | null;
  finalPrice: Prisma.Decimal | null;
  minAllowedPrice: Prisma.Decimal | null;
  grossMarginAmount: Prisma.Decimal | null;
  grossMarginPercent: Prisma.Decimal | null;
};

type ProductResponse = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  seo: {
    title: string | null;
    description: string | null;
    canonicalUrl: string | null;
    schemaJson: Prisma.JsonValue | null;
  };
  brand: {
    id: string;
    name: string | null;
    slug: string | null;
  };
  category: {
    id: string;
    name: string | null;
    slug: string | null;
  };
  productType: {
    id: string | null;
    name: string | null;
    slug: string | null;
  };
  productModel: {
    id: string | null;
    name: string | null;
    slug: string | null;
    modelCode: string | null;
  };
  sku: string;
  price: string;
  comparePrice: string | null;
  pricing: {
    purchasePrice: string | null;
    salePrice: string | null;
    discountPercent: string | null;
    finalPrice: string | null;
    minAllowedPrice: string | null;
    grossMarginAmount: string | null;
    grossMarginPercent: string | null;
  };
  weight: number | null;
  dimensions: Prisma.JsonValue | null;
  isActive: boolean;
  status: string;
  ai: {
    contentStatus: string;
    qualityScore: string | null;
  };
  viewCount: number;
  reviewCount: number;
  averageRating: string | null;
  primaryImage: {
    url: string | null;
    altText: string | null;
  };
  stock: {
    variantCount: number;
    warehouseCount: number;
    totalQuantity: number;
    reservedQuantity: number;
    availableStock: number;
    lowStockThreshold: number;
    isLowStock: boolean;
    isOutOfStock: boolean;
  };
  createdAt: string;
  createdAtFa: string;
  updatedAt: string;
  updatedAtFa: string;
  deletedAt: string | null;
  deletedAtFa: string | null;
};

@Injectable()
export class AdminProductService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: ProductEventPublisher,
  ) {}

  async findAll(query: AdminQueryProductDto) {
    const page = this.normalizePage(query.page);
    const limit = this.normalizeLimit(query.limit);
    const skip = (page - 1) * limit;
    const where = this.buildProductWhere(query, 'p');

    const [products, countRows] = await Promise.all([
      this.prisma.$queryRaw<ProductRow[]>(Prisma.sql`
        SELECT
          p."id",
          p."name",
          p."slug",
          p."description",
          p."shortDescription",
          p."seoTitle",
          p."seoDescription",
          p."canonicalUrl",
          p."schemaJson",
          p."brandId",
          b."name" AS "brandName",
          b."slug" AS "brandSlug",
          p."categoryId",
          c."name" AS "categoryName",
          c."slug" AS "categorySlug",
          p."productTypeId",
          pt."name" AS "productTypeName",
          pt."slug" AS "productTypeSlug",
          p."productModelId",
          pm."name" AS "productModelName",
          pm."slug" AS "productModelSlug",
          pm."modelCode" AS "productModelCode",
          p."sku",
          p."price",
          p."comparePrice",
          p."purchasePrice",
          p."salePrice",
          p."discountPercent",
          p."finalPrice",
          p."minAllowedPrice",
          p."grossMarginAmount",
          p."grossMarginPercent",
          p."weight",
          p."dimensions",
          p."isActive",
          p."status"::text AS "status",
          p."aiContentStatus",
          p."aiQualityScore",
          p."viewCount",
          p."reviewCount",
          p."averageRating",
          p."createdAt",
          p."updatedAt",
          p."deleted_at" AS "deletedAt",
          pi."url" AS "primaryImageUrl",
          pi."altText" AS "primaryImageAlt",
          stock."variantCount",
          stock."warehouseCount",
          stock."totalQuantity",
          stock."reservedQuantity",
          stock."availableStock",
          stock."lowStockThreshold"
        FROM "Product" p
        LEFT JOIN "Brand" b
          ON b."id" = p."brandId"
        LEFT JOIN "Category" c
          ON c."id" = p."categoryId"
        LEFT JOIN "ProductType" pt
          ON pt."id" = p."productTypeId"
        LEFT JOIN "ProductModel" pm
          ON pm."id" = p."productModelId"
        LEFT JOIN LATERAL (
          SELECT
            image."url",
            image."altText"
          FROM "ProductImage" image
          WHERE
            image."productId" = p."id"
            AND image."isActive" = TRUE
          ORDER BY
            image."isPrimary" DESC,
            image."sortOrder" ASC,
            image."createdAt" ASC
          LIMIT 1
        ) pi ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            COUNT(DISTINCT pv."id")::int AS "variantCount",
            COUNT(DISTINCT i."warehouseId")::int AS "warehouseCount",
            COALESCE(SUM(i."quantity"), 0)::int AS "totalQuantity",
            COALESCE(SUM(i."reservedQuantity"), 0)::int AS "reservedQuantity",
            COALESCE(SUM(GREATEST(i."quantity" - i."reservedQuantity", 0)), 0)::int AS "availableStock",
            COALESCE(MAX(i."lowStockThreshold"), 0)::int AS "lowStockThreshold"
          FROM "ProductVariant" pv
          LEFT JOIN "Inventory" i
            ON i."variantId" = pv."id"
            AND i."deleted_at" IS NULL
          WHERE
            pv."productId" = p."id"
            AND pv."deleted_at" IS NULL
            AND pv."isActive" = TRUE
        ) stock ON TRUE
        WHERE ${Prisma.join(where, ' AND ')}
        ORDER BY
          ${this.resolveSortColumn(query.sortBy)}
          ${this.resolveSortDirection(query.sortDirection)},
          p."id" DESC
        LIMIT ${limit}
        OFFSET ${skip}
      `),
      this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT
          COUNT(*)::int AS "count"
        FROM "Product" p
        WHERE ${Prisma.join(where, ' AND ')}
      `),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: products.map((product) => this.mapProduct(product)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(productId: string) {
    const product = await this.findProductRow(productId, true);
    const [images, attributes] = await Promise.all([
      this.findImages(productId),
      this.findAttributes(productId),
    ]);

    return {
      ...this.mapProduct(product),
      images: images.map((image) => this.mapImage(image)),
      attributes: attributes.map((attribute) => this.mapAttribute(attribute)),
    };
  }

  async create(
    dto: AdminCreateProductDto,
    actorId?: string,
    idempotencyKey?: string,
  ) {
    const normalizedIdempotencyKey =
      this.normalizeProductCreateIdempotencyKey(idempotencyKey);
    const payloadFingerprint = this.createProductPayloadFingerprint(dto);

    if (normalizedIdempotencyKey) {
      if (!actorId) {
        throw new BadRequestException(
          'شناسه مدیر برای ثبت امن پیش‌نویس محصول لازم است.',
        );
      }

      const existingRequest = await this.findProductCreateRequest(
        normalizedIdempotencyKey,
      );

      if (existingRequest) {
        return this.buildProductCreateResponse({
          productId: existingRequest.productId,
          actorId,
          idempotencyKey: normalizedIdempotencyKey,
          replayed: true,
          payloadMatches:
            existingRequest.payloadFingerprint === payloadFingerprint,
          requestActorId: existingRequest.actorId,
        });
      }
    }

    const productId = randomUUID();
    const slug = dto.slug ?? this.slugify(dto.name);
    const pricing = this.resolveCreatePricing(dto);

    this.assertValidPricing(pricing);

    await this.assertBrandExists(dto.brandId);
    await this.assertCategoryExists(dto.categoryId);
    await this.assertProductTypeMatchesCategory(
      dto.productTypeId,
      dto.categoryId,
    );
    await this.assertProductModelMatches(
      dto.productModelId,
      dto.brandId,
      dto.productTypeId,
    );
    await this.assertSkuUnique(dto.sku);
    await this.assertVariantSkuUnique(dto.sku);
    await this.assertSlugUnique(slug);

    if (this.hasInitialInventoryRequest(dto)) {
      await this.assertWarehouseExists(dto.defaultWarehouseId);
    }

    const now = new Date();

    try {
      await this.prisma.$transaction(async (tx) => {
        if (normalizedIdempotencyKey && actorId) {
          await tx.adminProductCreateRequest.create({
            data: {
              idempotencyKey: normalizedIdempotencyKey,
              actorId,
              productId,
              payloadFingerprint,
            },
          });
        }

        await tx.$executeRaw(Prisma.sql`
        INSERT INTO "Product" (
          "id",
          "name",
          "slug",
          "description",
          "shortDescription",
          "seoTitle",
          "seoDescription",
          "canonicalUrl",
          "schemaJson",
          "brandId",
          "categoryId",
          "productTypeId",
          "productModelId",
          "sku",
          "price",
          "comparePrice",
          "purchasePrice",
          "salePrice",
          "discountPercent",
          "finalPrice",
          "minAllowedPrice",
          "grossMarginAmount",
          "grossMarginPercent",
          "weight",
          "dimensions",
          "isActive",
          "status",
          "aiQualityScore",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${productId},
          ${dto.name},
          ${slug},
          ${dto.description ?? null},
          ${dto.shortDescription ?? null},
          ${dto.seoTitle ?? null},
          ${dto.seoDescription ?? null},
          ${dto.canonicalUrl ?? null},
          ${this.toJsonb(dto.schemaJson)},
          ${dto.brandId},
          ${dto.categoryId},
          ${dto.productTypeId ?? null},
          ${dto.productModelId ?? null},
          ${dto.sku},
          ${pricing.price.toFixed(2)}::numeric,
          ${this.decimalToSql(pricing.comparePrice)},
          ${this.decimalToSql(pricing.purchasePrice)},
          ${this.decimalToSql(pricing.salePrice)},
          ${this.decimalToSql(pricing.discountPercent)},
          ${this.decimalToSql(pricing.finalPrice)},
          ${this.decimalToSql(pricing.minAllowedPrice)},
          ${this.decimalToSql(pricing.grossMarginAmount)},
          ${this.decimalToSql(pricing.grossMarginPercent)},
          ${dto.weight ?? null},
          ${this.toJsonb(dto.dimensions)},
          ${dto.isActive ?? true},
          ${dto.status ?? 'DRAFT'}::"ProductStatus",
          ${this.optionalDecimal(dto.aiQualityScore?.toString())},
          ${now},
          ${now}
        )
      `);

        const defaultVariantId = await this.createDefaultVariantTx(
          tx,
          productId,
          slug,
          dto,
          pricing,
          now,
        );

        if (this.hasInitialInventoryRequest(dto)) {
          await this.upsertInventoryTx(
            tx,
            defaultVariantId,
            dto.defaultWarehouseId!,
            dto.stockQuantity,
            dto.lowStockThreshold ?? 5,
            `product-create:${productId}`,
            actorId,
            now,
          );
        }

        if (dto.attributes?.length) {
          await this.syncProductAttributesTx(tx, productId, dto.attributes);
        }

        if (dto.media?.length) {
          for (const media of dto.media) {
            await this.insertMediaTx(tx, productId, media);
          }
        }
      });
    } catch (error) {
      if (normalizedIdempotencyKey && actorId) {
        const existingRequest = await this.findProductCreateRequest(
          normalizedIdempotencyKey,
        );

        if (existingRequest) {
          return this.buildProductCreateResponse({
            productId: existingRequest.productId,
            actorId,
            idempotencyKey: normalizedIdempotencyKey,
            replayed: true,
            payloadMatches:
              existingRequest.payloadFingerprint === payloadFingerprint,
            requestActorId: existingRequest.actorId,
          });
        }
      }

      throw error;
    }

    this.eventPublisher.publishCreated({
      productId,
      name: dto.name,
      slug,
      sku: dto.sku,
      status: dto.status ?? 'DRAFT',
      actorId,
      occurredAt: now,
    });

    return this.buildProductCreateResponse({
      productId,
      actorId: actorId ?? null,
      idempotencyKey: normalizedIdempotencyKey,
      replayed: false,
      payloadMatches: true,
      requestActorId: actorId ?? null,
    });
  }

  private findProductCreateRequest(
    idempotencyKey: string,
  ): Prisma.PrismaPromise<ProductCreateRequestRecord | null> {
    return this.prisma.adminProductCreateRequest.findUnique({
      where: {
        idempotencyKey,
      },
      select: {
        actorId: true,
        productId: true,
        payloadFingerprint: true,
      },
    });
  }

  private async buildProductCreateResponse(input: {
    productId: string;
    actorId: string | null;
    idempotencyKey: string | null;
    replayed: boolean;
    payloadMatches: boolean;
    requestActorId: string | null;
  }) {
    if (
      input.requestActorId !== null &&
      input.actorId !== null &&
      input.requestActorId !== input.actorId
    ) {
      throw new ConflictException(
        'کلید ثبت پیش‌نویس متعلق به نشست مدیریتی دیگری است.',
      );
    }

    return {
      product: await this.findOne(input.productId),
      idempotency: {
        key: input.idempotencyKey,
        replayed: input.replayed,
        payloadMatches: input.payloadMatches,
      },
      audit: {
        actorId: input.actorId,
        action: input.replayed
          ? 'product.admin_create_replayed'
          : 'product.admin_created',
      },
    };
  }

  private normalizeProductCreateIdempotencyKey(value?: string): string | null {
    const normalized = value?.trim();

    if (!normalized) {
      return null;
    }

    if (
      normalized.length < 16 ||
      normalized.length > 200 ||
      !/^[A-Za-z0-9:._-]+$/.test(normalized)
    ) {
      throw new BadRequestException('کلید ثبت امن پیش‌نویس محصول معتبر نیست.');
    }

    return normalized;
  }

  private createProductPayloadFingerprint(dto: AdminCreateProductDto): string {
    return createHash('sha256')
      .update(JSON.stringify(this.sortFingerprintValue(dto)))
      .digest('hex');
  }

  private sortFingerprintValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortFingerprintValue(item));
    }

    if (!this.isPlainRecord(value)) {
      return value;
    }

    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = this.sortFingerprintValue(value[key]);

        return result;
      }, {});
  }

  private isPlainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  async update(
    productId: string,
    dto: AdminUpdateProductDto,
    actorId?: string,
  ) {
    const current = await this.findProductRow(productId, true);

    if (dto.brandId !== undefined) {
      await this.assertBrandExists(dto.brandId);
    }

    if (dto.categoryId !== undefined) {
      await this.assertCategoryExists(dto.categoryId);
    }

    const effectiveBrandId = dto.brandId ?? current.brandId;
    const effectiveCategoryId = dto.categoryId ?? current.categoryId;
    const effectiveProductTypeId =
      dto.productTypeId ?? current.productTypeId ?? undefined;

    await this.assertProductTypeMatchesCategory(
      dto.productTypeId,
      effectiveCategoryId,
    );
    await this.assertProductModelMatches(
      dto.productModelId,
      effectiveBrandId,
      effectiveProductTypeId,
    );

    if (dto.sku !== undefined) {
      await this.assertSkuUnique(dto.sku, productId);
    }

    if (dto.slug !== undefined) {
      await this.assertSlugUnique(dto.slug, productId);
    }

    if (this.hasProductInventoryUpdate(dto)) {
      await this.assertWarehouseExists(dto.defaultWarehouseId);
    }

    const assignments = this.buildUpdateAssignments(dto, current);
    const hasAttributeChanges = dto.attributes !== undefined;
    const hasInventoryChanges = this.hasProductInventoryUpdate(dto);

    if (
      assignments.length === 0 &&
      !hasAttributeChanges &&
      !hasInventoryChanges
    ) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی محصول ارسال نشده است.',
      );
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (assignments.length > 0) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "Product" p
          SET
            ${Prisma.join(assignments, ', ')},
            "updatedAt" = ${now}
          WHERE
            p."id" = ${productId}
            AND p."deleted_at" IS NULL
        `);
      }

      if (hasAttributeChanges) {
        await this.syncProductAttributesTx(tx, productId, dto.attributes ?? []);
      }

      if (hasInventoryChanges) {
        const variantId = await this.findOrCreateDefaultVariantTx(
          tx,
          current,
          now,
        );

        await this.upsertInventoryTx(
          tx,
          variantId,
          dto.defaultWarehouseId!,
          dto.stockQuantity,
          dto.lowStockThreshold ?? 5,
          `product-update:${productId}`,
          actorId,
          now,
        );
      }
    });

    return {
      product: await this.findOne(productId),
      audit: {
        actorId: actorId ?? null,
        action: 'product.admin_updated',
      },
    };
  }

  async updateStatus(
    productId: string,
    dto: AdminUpdateProductStatusDto,
    actorId?: string,
  ) {
    await this.findProductRow(productId, true);
    const now = new Date();

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "Product" p
      SET
        "status" = ${dto.status}::"ProductStatus",
        "isActive" = ${dto.isActive ?? dto.status === 'ACTIVE'},
        "updatedAt" = ${now}
      WHERE
        p."id" = ${productId}
        AND p."deleted_at" IS NULL
    `);

    return {
      product: await this.findOne(productId),
      audit: {
        actorId: actorId ?? null,
        action: 'product.admin_status_updated',
        reason: dto.reason ?? null,
      },
    };
  }

  async delete(productId: string, actorId?: string) {
    await this.findProductRow(productId, true);
    const now = new Date();

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "Product" p
      SET
        "deleted_at" = ${now},
        "isActive" = FALSE,
        "status" = 'ARCHIVED'::"ProductStatus",
        "updatedAt" = ${now}
      WHERE
        p."id" = ${productId}
        AND p."deleted_at" IS NULL
    `);

    return {
      deletedAt: now.toISOString(),
      deletedAtFa: this.formatDateTimeFaNullable(now),
      audit: {
        actorId: actorId ?? null,
        action: 'product.admin_deleted',
      },
    };
  }

  async findMedia(productId: string) {
    await this.findProductRow(productId, true);
    const images = await this.findImages(productId);

    return {
      data: images.map((image) => this.mapImage(image)),
    };
  }

  async addMedia(
    productId: string,
    dto: AdminAddProductMediaDto,
    actorId?: string,
  ) {
    await this.findProductRow(productId, true);
    await this.insertMedia(productId, dto);

    return {
      media: await this.findMedia(productId),
      audit: {
        actorId: actorId ?? null,
        action: 'product.media_added',
      },
    };
  }

  async updateMedia(
    productId: string,
    imageId: string,
    dto: AdminUpdateProductMediaDto,
    actorId?: string,
  ) {
    await this.assertImageBelongsToProduct(productId, imageId);

    if (dto.isPrimary === true) {
      await this.clearPrimaryImage(productId);
    }

    const assignments: Prisma.Sql[] = [];

    if (dto.url !== undefined) {
      assignments.push(Prisma.sql`"url" = ${dto.url}`);
    }

    if (dto.type !== undefined) {
      assignments.push(Prisma.sql`"type" = ${dto.type}::"ProductMediaType"`);
    }

    if (dto.thumbnailUrl !== undefined) {
      assignments.push(Prisma.sql`"thumbnailUrl" = ${dto.thumbnailUrl}`);
    }

    if (dto.altText !== undefined) {
      assignments.push(Prisma.sql`"altText" = ${dto.altText}`);
    }

    if (dto.title !== undefined) {
      assignments.push(Prisma.sql`"title" = ${dto.title}`);
    }

    if (dto.caption !== undefined) {
      assignments.push(Prisma.sql`"caption" = ${dto.caption}`);
    }

    if (dto.mimeType !== undefined) {
      assignments.push(Prisma.sql`"mimeType" = ${dto.mimeType}`);
    }

    if (dto.size !== undefined) {
      assignments.push(Prisma.sql`"size" = ${dto.size}`);
    }

    if (dto.width !== undefined) {
      assignments.push(Prisma.sql`"width" = ${dto.width}`);
    }

    if (dto.height !== undefined) {
      assignments.push(Prisma.sql`"height" = ${dto.height}`);
    }

    if (dto.duration !== undefined) {
      assignments.push(Prisma.sql`"duration" = ${dto.duration}`);
    }

    if (dto.sortOrder !== undefined) {
      assignments.push(Prisma.sql`"sortOrder" = ${dto.sortOrder}`);
    }

    if (dto.isPrimary !== undefined) {
      assignments.push(Prisma.sql`"isPrimary" = ${dto.isPrimary}`);
    }

    if (dto.isActive !== undefined) {
      assignments.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی رسانه ارسال نشده است.',
      );
    }

    const now = new Date();

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "ProductImage"
      SET
        ${Prisma.join(assignments, ', ')},
        "updatedAt" = ${now}
      WHERE
        "id" = ${imageId}
        AND "productId" = ${productId}
    `);

    return {
      media: await this.findMedia(productId),
      audit: {
        actorId: actorId ?? null,
        action: 'product.media_updated',
      },
    };
  }

  async deleteMedia(productId: string, imageId: string, actorId?: string) {
    await this.assertImageBelongsToProduct(productId, imageId);
    const now = new Date();

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "ProductImage"
      SET
        "isActive" = FALSE,
        "isPrimary" = FALSE,
        "updatedAt" = ${now}
      WHERE
        "id" = ${imageId}
        AND "productId" = ${productId}
    `);

    return {
      media: await this.findMedia(productId),
      audit: {
        actorId: actorId ?? null,
        action: 'product.media_deleted',
      },
    };
  }

  async reorderMedia(
    productId: string,
    dto: AdminReorderProductMediaDto,
    actorId?: string,
  ) {
    await this.findProductRow(productId, true);
    const now = new Date();

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.$executeRaw(Prisma.sql`
          UPDATE "ProductImage"
          SET
            "sortOrder" = ${item.sortOrder},
            "updatedAt" = ${now}
          WHERE
            "id" = ${item.imageId}
            AND "productId" = ${productId}
        `),
      ),
    );

    return {
      media: await this.findMedia(productId),
      audit: {
        actorId: actorId ?? null,
        action: 'product.media_reordered',
      },
    };
  }

  async setPrimaryMedia(productId: string, imageId: string, actorId?: string) {
    await this.assertImageBelongsToProduct(productId, imageId);
    await this.clearPrimaryImage(productId);
    const now = new Date();

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "ProductImage"
      SET
        "isPrimary" = TRUE,
        "isActive" = TRUE,
        "updatedAt" = ${now}
      WHERE
        "id" = ${imageId}
        AND "productId" = ${productId}
    `);

    return {
      media: await this.findMedia(productId),
      audit: {
        actorId: actorId ?? null,
        action: 'product.media_primary_set',
      },
    };
  }

  async findProductRow(
    productId: string,
    includeDeleted: boolean,
  ): Promise<ProductRow> {
    const where: Prisma.Sql[] = [Prisma.sql`p."id" = ${productId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`p."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<ProductRow[]>(Prisma.sql`
      SELECT
        p."id",
        p."name",
        p."slug",
        p."description",
        p."shortDescription",
        p."seoTitle",
        p."seoDescription",
        p."canonicalUrl",
        p."schemaJson",
        p."brandId",
        b."name" AS "brandName",
        b."slug" AS "brandSlug",
        p."categoryId",
        c."name" AS "categoryName",
        c."slug" AS "categorySlug",
        p."productTypeId",
        pt."name" AS "productTypeName",
        pt."slug" AS "productTypeSlug",
        p."productModelId",
        pm."name" AS "productModelName",
        pm."slug" AS "productModelSlug",
        pm."modelCode" AS "productModelCode",
        p."sku",
        p."price",
        p."comparePrice",
        p."purchasePrice",
        p."salePrice",
        p."discountPercent",
        p."finalPrice",
        p."minAllowedPrice",
        p."grossMarginAmount",
        p."grossMarginPercent",
        p."weight",
        p."dimensions",
        p."isActive",
        p."status"::text AS "status",
        p."aiContentStatus",
        p."aiQualityScore",
        p."viewCount",
        p."reviewCount",
        p."averageRating",
        p."createdAt",
        p."updatedAt",
        p."deleted_at" AS "deletedAt",
        pi."url" AS "primaryImageUrl",
        pi."altText" AS "primaryImageAlt",
        stock."variantCount",
        stock."warehouseCount",
        stock."totalQuantity",
        stock."reservedQuantity",
        stock."availableStock",
        stock."lowStockThreshold"
      FROM "Product" p
      LEFT JOIN "Brand" b
        ON b."id" = p."brandId"
      LEFT JOIN "Category" c
        ON c."id" = p."categoryId"
      LEFT JOIN "ProductType" pt
        ON pt."id" = p."productTypeId"
      LEFT JOIN "ProductModel" pm
        ON pm."id" = p."productModelId"
      LEFT JOIN LATERAL (
        SELECT
          image."url",
          image."altText"
        FROM "ProductImage" image
        WHERE
          image."productId" = p."id"
          AND image."isActive" = TRUE
        ORDER BY
          image."isPrimary" DESC,
          image."sortOrder" ASC,
          image."createdAt" ASC
        LIMIT 1
      ) pi ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT pv."id")::int AS "variantCount",
          COUNT(DISTINCT i."warehouseId")::int AS "warehouseCount",
          COALESCE(SUM(i."quantity"), 0)::int AS "totalQuantity",
          COALESCE(SUM(i."reservedQuantity"), 0)::int AS "reservedQuantity",
          COALESCE(SUM(GREATEST(i."quantity" - i."reservedQuantity", 0)), 0)::int AS "availableStock",
          COALESCE(MAX(i."lowStockThreshold"), 0)::int AS "lowStockThreshold"
        FROM "ProductVariant" pv
        LEFT JOIN "Inventory" i
          ON i."variantId" = pv."id"
          AND i."deleted_at" IS NULL
        WHERE
          pv."productId" = p."id"
          AND pv."deleted_at" IS NULL
          AND pv."isActive" = TRUE
      ) stock ON TRUE
      WHERE ${Prisma.join(where, ' AND ')}
      LIMIT 1
    `);

    const product = rows[0];

    if (!product) {
      throw new NotFoundException('محصول موردنظر یافت نشد.');
    }

    return product;
  }

  private findImages(productId: string): Promise<ProductImageRow[]> {
    return this.prisma.$queryRaw<ProductImageRow[]>(Prisma.sql`
      SELECT
        "id",
        "productId",
        "type"::text AS "type",
        "url",
        "thumbnailUrl",
        "altText",
        "title",
        "caption",
        "mimeType",
        "size",
        "width",
        "height",
        "duration",
        "sortOrder",
        "isPrimary",
        "isActive",
        "createdAt",
        "updatedAt"
      FROM "ProductImage"
      WHERE
        "productId" = ${productId}
        AND "isActive" = TRUE
      ORDER BY
        "isPrimary" DESC,
        "sortOrder" ASC,
        "createdAt" ASC
    `);
  }

  private findAttributes(productId: string): Promise<ProductAttributeRow[]> {
    return this.prisma.$queryRaw<ProductAttributeRow[]>(Prisma.sql`
      SELECT
        COALESCE(pa."attributeId", av."attributeId") AS "attributeId",
        a."code" AS "attributeCode",
        a."name" AS "attributeName",
        a."label" AS "attributeLabel",
        pa."attributeValueId",
        av."value" AS "predefinedValue",
        pa."valueText",
        pa."valueNumber",
        pa."valueBoolean",
        pa."valueJson",
        pa."unit"
      FROM "ProductAttribute" pa
      LEFT JOIN "AttributeValue" av
        ON av."id" = pa."attributeValueId"
      LEFT JOIN "Attribute" a
        ON a."id" = COALESCE(pa."attributeId", av."attributeId")
      WHERE pa."productId" = ${productId}
      ORDER BY
        a."sortOrder" ASC,
        a."name" ASC,
        av."value" ASC
    `);
  }

  private buildProductWhere(
    query: AdminQueryProductDto,
    alias: string,
  ): Prisma.Sql[] {
    const table = Prisma.raw(alias);
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`${table}."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(Prisma.sql`(
        ${table}."name" ILIKE ${`%${query.q}%`}
        OR ${table}."slug" ILIKE ${`%${query.q}%`}
        OR ${table}."sku" ILIKE ${`%${query.q}%`}
        OR ${table}."description" ILIKE ${`%${query.q}%`}
      )`);
    }

    if (query.brandId) {
      where.push(Prisma.sql`${table}."brandId" = ${query.brandId}`);
    }

    if (query.categoryId) {
      where.push(Prisma.sql`${table}."categoryId" = ${query.categoryId}`);
    }

    if (query.productTypeId) {
      where.push(Prisma.sql`${table}."productTypeId" = ${query.productTypeId}`);
    }

    if (query.productModelId) {
      where.push(
        Prisma.sql`${table}."productModelId" = ${query.productModelId}`,
      );
    }

    if (query.attributeId) {
      where.push(Prisma.sql`EXISTS (
        SELECT 1
        FROM "ProductAttribute" pa
        WHERE
          pa."productId" = ${table}."id"
          AND pa."attributeId" = ${query.attributeId}
      )`);
    }

    if (query.attributeValueId) {
      where.push(Prisma.sql`EXISTS (
        SELECT 1
        FROM "ProductAttribute" pa
        WHERE
          pa."productId" = ${table}."id"
          AND pa."attributeValueId" = ${query.attributeValueId}
      )`);
    }

    if (query.sku) {
      where.push(Prisma.sql`${table}."sku" ILIKE ${`%${query.sku}%`}`);
    }

    if (query.status) {
      where.push(Prisma.sql`${table}."status"::text = ${query.status}`);
    }

    if (query.isActive !== undefined) {
      where.push(Prisma.sql`${table}."isActive" = ${query.isActive}`);
    }

    if (query.hasDiscount !== undefined) {
      if (query.hasDiscount) {
        where.push(
          Prisma.sql`${table}."discountPercent" IS NOT NULL AND ${table}."discountPercent" > 0`,
        );
      } else {
        where.push(
          Prisma.sql`(${table}."discountPercent" IS NULL OR ${table}."discountPercent" <= 0)`,
        );
      }
    }

    if (query.missingSeo === true) {
      where.push(Prisma.sql`(
        ${table}."seoTitle" IS NULL
        OR ${table}."seoTitle" = ''
        OR ${table}."seoDescription" IS NULL
        OR ${table}."seoDescription" = ''
      )`);
    }

    if (query.priceMin) {
      where.push(Prisma.sql`${table}."price" >= ${query.priceMin}::numeric`);
    }

    if (query.priceMax) {
      where.push(Prisma.sql`${table}."price" <= ${query.priceMax}::numeric`);
    }

    if (query.finalPriceMin) {
      where.push(
        Prisma.sql`${table}."finalPrice" >= ${query.finalPriceMin}::numeric`,
      );
    }

    if (query.finalPriceMax) {
      where.push(
        Prisma.sql`${table}."finalPrice" <= ${query.finalPriceMax}::numeric`,
      );
    }

    if (query.createdFrom) {
      where.push(
        Prisma.sql`${table}."createdAt" >= ${new Date(query.createdFrom)}`,
      );
    }

    if (query.createdTo) {
      where.push(
        Prisma.sql`${table}."createdAt" <= ${new Date(query.createdTo)}`,
      );
    }

    return where;
  }

  private buildUpdateAssignments(
    dto: AdminUpdateProductDto,
    current: ProductRow,
  ): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.name !== undefined) {
      assignments.push(Prisma.sql`"name" = ${dto.name}`);
    }

    if (dto.slug !== undefined) {
      assignments.push(Prisma.sql`"slug" = ${dto.slug}`);
    }

    if (dto.description !== undefined) {
      assignments.push(Prisma.sql`"description" = ${dto.description}`);
    }

    if (dto.shortDescription !== undefined) {
      assignments.push(
        Prisma.sql`"shortDescription" = ${dto.shortDescription}`,
      );
    }

    if (dto.seoTitle !== undefined) {
      assignments.push(Prisma.sql`"seoTitle" = ${dto.seoTitle}`);
    }

    if (dto.seoDescription !== undefined) {
      assignments.push(Prisma.sql`"seoDescription" = ${dto.seoDescription}`);
    }

    if (dto.canonicalUrl !== undefined) {
      assignments.push(Prisma.sql`"canonicalUrl" = ${dto.canonicalUrl}`);
    }

    if (dto.schemaJson !== undefined) {
      assignments.push(
        Prisma.sql`"schemaJson" = ${this.toJsonb(dto.schemaJson)}`,
      );
    }

    if (dto.brandId !== undefined) {
      assignments.push(Prisma.sql`"brandId" = ${dto.brandId}`);
    }

    if (dto.categoryId !== undefined) {
      assignments.push(Prisma.sql`"categoryId" = ${dto.categoryId}`);
    }

    if (dto.productTypeId !== undefined) {
      assignments.push(Prisma.sql`"productTypeId" = ${dto.productTypeId}`);
    }

    if (dto.productModelId !== undefined) {
      assignments.push(Prisma.sql`"productModelId" = ${dto.productModelId}`);
    }

    if (dto.sku !== undefined) {
      assignments.push(Prisma.sql`"sku" = ${dto.sku}`);
    }

    if (this.hasPricingUpdate(dto)) {
      const pricing = this.resolveUpdatePricing(dto, current);
      this.assertValidPricing(pricing);

      assignments.push(
        Prisma.sql`"price" = ${pricing.price.toFixed(2)}::numeric`,
      );
      assignments.push(
        Prisma.sql`"comparePrice" = ${this.decimalToSql(pricing.comparePrice)}`,
      );
      assignments.push(
        Prisma.sql`"purchasePrice" = ${this.decimalToSql(pricing.purchasePrice)}`,
      );
      assignments.push(
        Prisma.sql`"salePrice" = ${this.decimalToSql(pricing.salePrice)}`,
      );
      assignments.push(
        Prisma.sql`"discountPercent" = ${this.decimalToSql(pricing.discountPercent)}`,
      );
      assignments.push(
        Prisma.sql`"finalPrice" = ${this.decimalToSql(pricing.finalPrice)}`,
      );
      assignments.push(
        Prisma.sql`"minAllowedPrice" = ${this.decimalToSql(pricing.minAllowedPrice)}`,
      );
      assignments.push(
        Prisma.sql`"grossMarginAmount" = ${this.decimalToSql(pricing.grossMarginAmount)}`,
      );
      assignments.push(
        Prisma.sql`"grossMarginPercent" = ${this.decimalToSql(pricing.grossMarginPercent)}`,
      );
    }

    if (dto.weight !== undefined) {
      assignments.push(Prisma.sql`"weight" = ${dto.weight}`);
    }

    if (dto.dimensions !== undefined) {
      assignments.push(
        Prisma.sql`"dimensions" = ${this.toJsonb(dto.dimensions)}`,
      );
    }

    if (dto.isActive !== undefined) {
      assignments.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    if (dto.status !== undefined) {
      assignments.push(Prisma.sql`"status" = ${dto.status}::"ProductStatus"`);
    }

    if (dto.aiQualityScore !== undefined) {
      assignments.push(
        Prisma.sql`"aiQualityScore" = ${this.optionalDecimal(dto.aiQualityScore.toString())}`,
      );
    }

    return assignments;
  }

  private async syncProductAttributes(
    productId: string,
    attributes: AdminProductAttributeValueDto[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.syncProductAttributesTx(tx, productId, attributes);
    });
  }

  private async syncProductAttributesTx(
    tx: PrismaTx,
    productId: string,
    attributes: AdminProductAttributeValueDto[],
  ): Promise<void> {
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM "ProductAttribute"
      WHERE "productId" = ${productId}
    `);

    for (const attribute of attributes) {
      await this.assertAttributeExists(attribute.attributeId);

      if (attribute.attributeValueId) {
        await this.assertAttributeValueBelongsToAttribute(
          attribute.attributeValueId,
          attribute.attributeId,
        );
      }

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "ProductAttribute" (
          "id",
          "productId",
          "attributeId",
          "attributeValueId",
          "valueText",
          "valueNumber",
          "valueBoolean",
          "valueJson",
          "unit",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${randomUUID()},
          ${productId},
          ${attribute.attributeId},
          ${attribute.attributeValueId ?? null},
          ${attribute.valueText ?? null},
          ${this.optionalDecimal(attribute.valueNumber)},
          ${attribute.valueBoolean ?? null},
          ${this.toJsonb(attribute.valueJson)},
          ${attribute.unit ?? null},
          ${new Date()},
          ${new Date()}
        )
      `);
    }
  }

  private async insertMedia(
    productId: string,
    dto: AdminAddProductMediaDto,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.insertMediaTx(tx, productId, dto);
    });
  }

  private async insertMediaTx(
    tx: PrismaTx,
    productId: string,
    dto: AdminAddProductMediaDto,
  ): Promise<void> {
    if (dto.isPrimary === true) {
      await this.clearPrimaryImage(productId);
    }

    const now = new Date();

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "ProductImage" (
        "id",
        "productId",
        "type",
        "url",
        "thumbnailUrl",
        "altText",
        "title",
        "caption",
        "mimeType",
        "size",
        "width",
        "height",
        "duration",
        "sortOrder",
        "isPrimary",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${productId},
        ${dto.type ?? 'IMAGE'}::"ProductMediaType",
        ${dto.url},
        ${dto.thumbnailUrl ?? null},
        ${dto.altText ?? null},
        ${dto.title ?? null},
        ${dto.caption ?? null},
        ${dto.mimeType ?? null},
        ${dto.size ?? null},
        ${dto.width ?? null},
        ${dto.height ?? null},
        ${dto.duration ?? null},
        ${dto.sortOrder ?? 0},
        ${dto.isPrimary ?? false},
        ${dto.isActive ?? true},
        ${now},
        ${now}
      )
    `);
  }

  private async assertVariantSkuUnique(
    sku: string,
    exceptVariantId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [
      Prisma.sql`"sku" = ${sku}`,
      Prisma.sql`"deleted_at" IS NULL`,
    ];

    if (exceptVariantId) {
      where.push(Prisma.sql`"id" <> ${exceptVariantId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "ProductVariant"
      WHERE ${Prisma.join(where, ' AND ')}
    `);

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException(
        'SKU انتخاب‌شده قبلاً برای یک واریانت ثبت شده است.',
      );
    }
  }

  private async assertWarehouseExists(warehouseId?: string): Promise<void> {
    if (!warehouseId) {
      throw new BadRequestException(
        'برای ثبت موجودی اولیه باید انبار پیش‌فرض انتخاب شود.',
      );
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "Warehouse"
      WHERE
        "id" = ${warehouseId}
        AND "isActive" = TRUE
        AND "deleted_at" IS NULL
    `);

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException('انبار پیش‌فرض انتخاب‌شده معتبر نیست.');
    }
  }

  private async assertBrandExists(brandId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "Brand"
      WHERE
        "id" = ${brandId}
        AND "deleted_at" IS NULL
        AND "isActive" = TRUE
    `);

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException('برند انتخاب‌شده معتبر نیست.');
    }
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "Category"
      WHERE
        "id" = ${categoryId}
        AND "deleted_at" IS NULL
        AND "isActive" = TRUE
    `);

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException('دسته‌بندی انتخاب‌شده معتبر نیست.');
    }
  }

  private async assertProductTypeMatchesCategory(
    productTypeId: string | undefined,
    categoryId: string,
  ): Promise<void> {
    if (!productTypeId) {
      return;
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "ProductType"
      WHERE
        "id" = ${productTypeId}
        AND "categoryId" = ${categoryId}
        AND "deleted_at" IS NULL
        AND "isActive" = TRUE
    `);

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException(
        'نوع محصول انتخاب‌شده با دسته‌بندی محصول هماهنگ نیست.',
      );
    }
  }

  private async assertProductModelMatches(
    productModelId: string | undefined,
    brandId: string,
    productTypeId?: string,
  ): Promise<void> {
    if (!productModelId) {
      return;
    }

    const where: Prisma.Sql[] = [
      Prisma.sql`"id" = ${productModelId}`,
      Prisma.sql`"brandId" = ${brandId}`,
      Prisma.sql`"deleted_at" IS NULL`,
      Prisma.sql`"isActive" = TRUE`,
    ];

    if (productTypeId) {
      where.push(Prisma.sql`"productTypeId" = ${productTypeId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "ProductModel"
      WHERE ${Prisma.join(where, ' AND ')}
    `);

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException(
        'مدل کالا با برند یا نوع محصول انتخاب‌شده هماهنگ نیست.',
      );
    }
  }

  private async assertAttributeExists(attributeId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "Attribute"
      WHERE
        "id" = ${attributeId}
        AND "deleted_at" IS NULL
        AND "isActive" = TRUE
    `);

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException('ویژگی انتخاب‌شده معتبر نیست.');
    }
  }

  private async assertAttributeValueBelongsToAttribute(
    attributeValueId: string,
    attributeId: string,
  ): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "AttributeValue"
      WHERE
        "id" = ${attributeValueId}
        AND "attributeId" = ${attributeId}
        AND "deleted_at" IS NULL
    `);

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException(
        'مقدار ویژگی با ویژگی انتخاب‌شده هماهنگ نیست.',
      );
    }
  }

  private async assertSkuUnique(
    sku: string,
    exceptProductId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [Prisma.sql`"sku" = ${sku}`];

    if (exceptProductId) {
      where.push(Prisma.sql`"id" <> ${exceptProductId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "Product"
      WHERE ${Prisma.join(where, ' AND ')}
    `);

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('کد SKU محصول تکراری است.');
    }
  }

  private async assertSlugUnique(
    slug: string,
    exceptProductId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [Prisma.sql`"slug" = ${slug}`];

    if (exceptProductId) {
      where.push(Prisma.sql`"id" <> ${exceptProductId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "Product"
      WHERE ${Prisma.join(where, ' AND ')}
    `);

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('اسلاگ محصول تکراری است.');
    }
  }

  private async assertImageBelongsToProduct(
    productId: string,
    imageId: string,
  ): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "ProductImage"
      WHERE
        "id" = ${imageId}
        AND "productId" = ${productId}
        AND "isActive" = TRUE
    `);

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new NotFoundException('رسانه محصول یافت نشد.');
    }
  }

  private async clearPrimaryImage(productId: string): Promise<void> {
    const now = new Date();

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "ProductImage"
      SET
        "isPrimary" = FALSE,
        "updatedAt" = ${now}
      WHERE "productId" = ${productId}
    `);
  }

  private async createDefaultVariantTx(
    tx: PrismaTx,
    productId: string,
    slug: string,
    dto: AdminCreateProductDto,
    pricing: PricingSnapshot,
    now: Date,
  ): Promise<string> {
    const variantId = randomUUID();
    const variantPrice =
      pricing.finalPrice ?? pricing.salePrice ?? pricing.price;

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "ProductVariant" (
        "id",
        "productId",
        "sku",
        "name",
        "slug",
        "price",
        "comparePrice",
        "weight",
        "imageUrl",
        "isActive",
        "createdAt",
        "updatedAt",
        "deleted_at"
      )
      VALUES (
        ${variantId},
        ${productId},
        ${dto.sku},
        ${dto.name},
        ${slug},
        ${this.decimalToSql(variantPrice)},
        ${this.decimalToSql(pricing.comparePrice)},
        ${dto.weight ?? null},
        ${dto.media?.[0]?.url ?? null},
        ${dto.isActive ?? true},
        ${now},
        ${now},
        NULL
      )
    `);

    return variantId;
  }

  private async findOrCreateDefaultVariantTx(
    tx: PrismaTx,
    product: ProductRow,
    now: Date,
  ): Promise<string> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "ProductVariant"
      WHERE
        "productId" = ${product.id}
        AND "deleted_at" IS NULL
      ORDER BY
        "isActive" DESC,
        "createdAt" ASC,
        "id" ASC
      LIMIT 1
    `);

    const existingId = rows[0]?.id;

    if (existingId) {
      return existingId;
    }

    const variantSku = product.sku;
    await this.assertVariantSkuUnique(variantSku);

    const variantId = randomUUID();
    const variantPrice =
      this.toNullableDecimalFromUnknown(product.finalPrice) ??
      this.toNullableDecimalFromUnknown(product.salePrice) ??
      this.toDecimal(product.price.toString());

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "ProductVariant" (
        "id",
        "productId",
        "sku",
        "name",
        "slug",
        "price",
        "comparePrice",
        "weight",
        "imageUrl",
        "isActive",
        "createdAt",
        "updatedAt",
        "deleted_at"
      )
      VALUES (
        ${variantId},
        ${product.id},
        ${variantSku},
        ${product.name},
        ${product.slug},
        ${this.decimalToSql(variantPrice)},
        ${this.decimalToSql(this.toNullableDecimalFromUnknown(product.comparePrice))},
        ${product.weight ?? null},
        ${product.primaryImageUrl ?? null},
        TRUE,
        ${now},
        ${now},
        NULL
      )
    `);

    return variantId;
  }

  private async upsertInventoryTx(
    tx: PrismaTx,
    variantId: string,
    warehouseId: string,
    stockQuantity: number | undefined,
    lowStockThreshold: number,
    reference: string,
    actorId: string | undefined,
    now: Date,
  ): Promise<void> {
    const hasQuantityUpdate = stockQuantity !== undefined;
    const normalizedQuantity = hasQuantityUpdate
      ? Math.max(0, Math.trunc(stockQuantity))
      : 0;
    const normalizedLowStockThreshold = Math.max(
      0,
      Math.trunc(lowStockThreshold),
    );

    const rows = await tx.$queryRaw<
      Array<{ id: string; previousQuantity: number | bigint }>
    >(Prisma.sql`
      INSERT INTO "Inventory" (
        "id",
        "variantId",
        "warehouseId",
        "quantity",
        "reservedQuantity",
        "lowStockThreshold",
        "createdAt",
        "updatedAt",
        "deleted_at"
      )
      VALUES (
        ${randomUUID()},
        ${variantId},
        ${warehouseId},
        ${normalizedQuantity},
        0,
        ${normalizedLowStockThreshold},
        ${now},
        ${now},
        NULL
      )
      ON CONFLICT ("variantId", "warehouseId")
      DO UPDATE SET
        "quantity" = CASE
          WHEN ${hasQuantityUpdate} THEN EXCLUDED."quantity"
          ELSE "Inventory"."quantity"
        END,
        "lowStockThreshold" = EXCLUDED."lowStockThreshold",
        "updatedAt" = EXCLUDED."updatedAt",
        "deleted_at" = NULL
      RETURNING "id", 0 AS "previousQuantity"
    `);

    const inventoryId = rows[0]?.id;

    if (!inventoryId) {
      throw new BadRequestException('امکان ثبت موجودی اولیه محصول وجود ندارد.');
    }

    if (hasQuantityUpdate && normalizedQuantity > 0) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "StockMovement" (
          "id",
          "inventoryId",
          "type",
          "quantity",
          "reason",
          "reference",
          "createdAt"
        )
        VALUES (
          ${randomUUID()},
          ${inventoryId},
          'ADJUSTMENT'::"StockMovementType",
          ${normalizedQuantity},
          ${actorId ? `ثبت/ویرایش موجودی اولیه توسط ${actorId}` : 'ثبت/ویرایش موجودی اولیه محصول'},
          ${reference},
          ${now}
        )
      `);
    }
  }

  private hasInitialInventoryRequest(dto: AdminCreateProductDto): boolean {
    return (
      dto.defaultWarehouseId !== undefined ||
      dto.stockQuantity !== undefined ||
      dto.lowStockThreshold !== undefined
    );
  }

  private hasProductInventoryUpdate(dto: AdminUpdateProductDto): boolean {
    return (
      dto.defaultWarehouseId !== undefined ||
      dto.stockQuantity !== undefined ||
      dto.lowStockThreshold !== undefined
    );
  }

  private mapProductStock(row: ProductRow) {
    const totalQuantity = this.toNumber(row.totalQuantity);
    const reservedQuantity = this.toNumber(row.reservedQuantity);
    const availableStock = this.toNumber(row.availableStock);
    const lowStockThreshold = this.toNumber(row.lowStockThreshold);

    return {
      variantCount: this.toNumber(row.variantCount),
      warehouseCount: this.toNumber(row.warehouseCount),
      totalQuantity,
      reservedQuantity,
      availableStock,
      lowStockThreshold,
      isLowStock: availableStock > 0 && availableStock <= lowStockThreshold,
      isOutOfStock: availableStock <= 0,
    };
  }

  private resolveCreatePricing(dto: AdminCreateProductDto): PricingSnapshot {
    const price = this.toDecimal(dto.price);
    const comparePrice = this.toNullableDecimal(dto.comparePrice);
    const purchasePrice = this.toNullableDecimal(dto.purchasePrice);
    const salePrice = this.toNullableDecimal(dto.salePrice) ?? price;
    const discountPercent = this.toNullableDecimal(dto.discountPercent);
    const explicitFinalPrice = this.toNullableDecimal(dto.finalPrice);
    const finalPrice =
      explicitFinalPrice ??
      this.calculateFinalPrice(salePrice, discountPercent);
    const minAllowedPrice =
      this.toNullableDecimal(dto.minAllowedPrice) ?? purchasePrice;

    return this.enrichPricing({
      price,
      comparePrice,
      purchasePrice,
      salePrice,
      discountPercent,
      finalPrice,
      minAllowedPrice,
      grossMarginAmount: null,
      grossMarginPercent: null,
    });
  }

  private resolveUpdatePricing(
    dto: AdminUpdateProductDto,
    current: ProductRow,
  ): PricingSnapshot {
    const price = this.toDecimal(
      dto.price ?? this.toDecimalString(current.price),
    );
    const comparePrice =
      dto.comparePrice !== undefined
        ? this.toNullableDecimal(dto.comparePrice)
        : this.toNullableDecimalFromUnknown(current.comparePrice);
    const purchasePrice =
      dto.purchasePrice !== undefined
        ? this.toNullableDecimal(dto.purchasePrice)
        : this.toNullableDecimalFromUnknown(current.purchasePrice);
    const salePrice =
      dto.salePrice !== undefined
        ? this.toNullableDecimal(dto.salePrice)
        : (this.toNullableDecimalFromUnknown(current.salePrice) ?? price);
    const discountPercent =
      dto.discountPercent !== undefined
        ? this.toNullableDecimal(dto.discountPercent)
        : this.toNullableDecimalFromUnknown(current.discountPercent);
    const finalPrice =
      dto.finalPrice !== undefined
        ? this.toNullableDecimal(dto.finalPrice)
        : this.calculateFinalPrice(salePrice, discountPercent);
    const minAllowedPrice =
      dto.minAllowedPrice !== undefined
        ? this.toNullableDecimal(dto.minAllowedPrice)
        : (this.toNullableDecimalFromUnknown(current.minAllowedPrice) ??
          purchasePrice);

    return this.enrichPricing({
      price,
      comparePrice,
      purchasePrice,
      salePrice,
      discountPercent,
      finalPrice,
      minAllowedPrice,
      grossMarginAmount: null,
      grossMarginPercent: null,
    });
  }

  private enrichPricing(pricing: PricingSnapshot): PricingSnapshot {
    const grossMarginAmount =
      pricing.finalPrice && pricing.purchasePrice
        ? pricing.finalPrice.minus(pricing.purchasePrice)
        : null;
    const grossMarginPercent =
      grossMarginAmount && pricing.finalPrice && !pricing.finalPrice.isZero()
        ? grossMarginAmount.dividedBy(pricing.finalPrice).times(100)
        : null;

    return {
      ...pricing,
      grossMarginAmount,
      grossMarginPercent,
    };
  }

  private assertValidPricing(pricing: PricingSnapshot): void {
    if (pricing.comparePrice && pricing.comparePrice.lessThan(pricing.price)) {
      throw new BadRequestException(
        'قیمت قبل از تخفیف نمی‌تواند کمتر از قیمت فروش باشد.',
      );
    }

    if (pricing.discountPercent && pricing.discountPercent.greaterThan(100)) {
      throw new BadRequestException('درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.');
    }

    if (
      pricing.finalPrice &&
      pricing.minAllowedPrice &&
      pricing.finalPrice.lessThan(pricing.minAllowedPrice)
    ) {
      throw new BadRequestException(
        'قیمت نهایی نمی‌تواند کمتر از حداقل قیمت مجاز یا قیمت خرید باشد.',
      );
    }
  }

  private hasPricingUpdate(dto: AdminUpdateProductDto): boolean {
    return (
      dto.price !== undefined ||
      dto.comparePrice !== undefined ||
      dto.purchasePrice !== undefined ||
      dto.salePrice !== undefined ||
      dto.discountPercent !== undefined ||
      dto.finalPrice !== undefined ||
      dto.minAllowedPrice !== undefined
    );
  }

  private calculateFinalPrice(
    salePrice: Prisma.Decimal | null,
    discountPercent: Prisma.Decimal | null,
  ): Prisma.Decimal | null {
    if (!salePrice) {
      return null;
    }

    if (!discountPercent || discountPercent.isZero()) {
      return salePrice;
    }

    return salePrice.minus(salePrice.times(discountPercent).dividedBy(100));
  }

  private optionalDecimal(value?: string): Prisma.Sql {
    if (value === undefined || value === null) {
      return Prisma.sql`NULL`;
    }

    return Prisma.sql`${value}::numeric`;
  }

  private decimalToSql(value: Prisma.Decimal | null): Prisma.Sql {
    if (value === null) {
      return Prisma.sql`NULL`;
    }

    return Prisma.sql`${value.toFixed(4)}::numeric`;
  }

  private toJsonb(value?: Record<string, unknown>): Prisma.Sql {
    if (value === undefined || value === null) {
      return Prisma.sql`NULL`;
    }

    return Prisma.sql`${JSON.stringify(value)}::jsonb`;
  }

  private mapProduct(row: ProductRow): ProductResponse {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      shortDescription: row.shortDescription,
      seo: {
        title: row.seoTitle,
        description: row.seoDescription,
        canonicalUrl: row.canonicalUrl,
        schemaJson: row.schemaJson,
      },
      brand: {
        id: row.brandId,
        name: row.brandName,
        slug: row.brandSlug,
      },
      category: {
        id: row.categoryId,
        name: row.categoryName,
        slug: row.categorySlug,
      },
      productType: {
        id: row.productTypeId,
        name: row.productTypeName,
        slug: row.productTypeSlug,
      },
      productModel: {
        id: row.productModelId,
        name: row.productModelName,
        slug: row.productModelSlug,
        modelCode: row.productModelCode,
      },
      sku: row.sku,
      price: this.toDecimalString(row.price),
      comparePrice: this.toDecimalStringNullable(row.comparePrice),
      pricing: {
        purchasePrice: this.toDecimalStringNullable(row.purchasePrice),
        salePrice: this.toDecimalStringNullable(row.salePrice),
        discountPercent: this.toDecimalStringNullable(row.discountPercent),
        finalPrice: this.toDecimalStringNullable(row.finalPrice),
        minAllowedPrice: this.toDecimalStringNullable(row.minAllowedPrice),
        grossMarginAmount: this.toDecimalStringNullable(row.grossMarginAmount),
        grossMarginPercent: this.toDecimalStringNullable(
          row.grossMarginPercent,
        ),
      },
      weight: row.weight,
      dimensions: row.dimensions,
      isActive: row.isActive,
      status: row.status,
      ai: {
        contentStatus: row.aiContentStatus,
        qualityScore: this.toDecimalStringNullable(row.aiQualityScore),
      },
      viewCount: this.toNumber(row.viewCount),
      reviewCount: this.toNumber(row.reviewCount),
      averageRating: this.toDecimalStringNullable(row.averageRating),
      primaryImage: {
        url: row.primaryImageUrl,
        altText: row.primaryImageAlt,
      },
      stock: this.mapProductStock(row),
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: this.formatDateTimeFaNullable(row.deletedAt),
    };
  }

  private mapImage(row: ProductImageRow) {
    return {
      id: row.id,
      productId: row.productId,
      type: row.type,
      url: row.url,
      thumbnailUrl: row.thumbnailUrl,
      altText: row.altText,
      title: row.title,
      caption: row.caption,
      mimeType: row.mimeType,
      size: row.size,
      width: row.width,
      height: row.height,
      duration: row.duration,
      sortOrder: row.sortOrder,
      isPrimary: row.isPrimary,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updatedAt),
    };
  }

  private mapAttribute(row: ProductAttributeRow) {
    return {
      attributeId: row.attributeId,
      code: row.attributeCode,
      name: row.attributeName,
      label: row.attributeLabel,
      attributeValueId: row.attributeValueId,
      predefinedValue: row.predefinedValue,
      valueText: row.valueText,
      valueNumber: this.toDecimalStringNullable(row.valueNumber),
      valueBoolean: row.valueBoolean,
      valueJson: row.valueJson,
      unit: row.unit,
    };
  }

  private resolveSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`p."updatedAt"`;
    }

    if (sortBy === 'name') {
      return Prisma.sql`p."name"`;
    }

    if (sortBy === 'price') {
      return Prisma.sql`p."price"`;
    }

    if (sortBy === 'finalPrice') {
      return Prisma.sql`p."finalPrice"`;
    }

    if (sortBy === 'status') {
      return Prisma.sql`p."status"`;
    }

    if (sortBy === 'viewCount') {
      return Prisma.sql`p."viewCount"`;
    }

    if (sortBy === 'averageRating') {
      return Prisma.sql`p."averageRating"`;
    }

    if (sortBy === 'discountPercent') {
      return Prisma.sql`p."discountPercent"`;
    }

    return Prisma.sql`p."createdAt"`;
  }

  private resolveSortDirection(sortDirection?: string): Prisma.Sql {
    return sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180);
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

    if (value instanceof Prisma.Decimal) {
      return value.toNumber();
    }

    return Number(value);
  }

  private toDecimal(value: string | number | Prisma.Decimal): Prisma.Decimal {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }

  private toNullableDecimal(value?: string): Prisma.Decimal | null {
    if (value === undefined || value === null) {
      return null;
    }

    return new Prisma.Decimal(value);
  }

  private toNullableDecimalFromUnknown(
    value: Prisma.Decimal | number | string | null,
  ): Prisma.Decimal | null {
    if (value === null || value === undefined) {
      return null;
    }

    return this.toDecimal(value);
  }

  private toDecimalString(value: Prisma.Decimal | number | string): string {
    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    return new Prisma.Decimal(value).toFixed(2);
  }

  private toDecimalStringNullable(
    value: Prisma.Decimal | number | string | null,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return this.toDecimalString(value);
  }
}
