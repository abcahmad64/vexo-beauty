import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { ProductStatus, Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { CreateProductImageDto } from '../dto/create-product-image.dto';

import { CreateProductDto } from '../dto/create-product.dto';

import { CreateProductVariantDto } from '../dto/create-product-variant.dto';

import { QueryProductDto } from '../dto/query-product.dto';

import { UpdateProductDto } from '../dto/update-product.dto';

import { UpdateProductVariantDto } from '../dto/update-product-variant.dto';

import { ProductEventPublisher } from '../events/product.event.publisher';

type PrismaTx = Prisma.TransactionClient;

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  brand_id: string;
  brand_name: string | null;
  brand_slug: string | null;
  category_id: string;
  category_name: string | null;
  category_slug: string | null;
  sku: string;
  price: unknown;
  compare_price: unknown;
  weight: number | null;
  dimensions: unknown;
  is_active: boolean;
  status: ProductStatus;
  view_count: number | bigint;
  review_count: number | bigint;
  average_rating: unknown;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  primary_image_url?: string | null;
  primary_image_alt?: string | null;
  available_stock?: number | bigint;
};

type ProductVariantRow = {
  id: string;
  product_id: string;
  sku: string;
  name: string | null;
  slug: string | null;
  price: unknown;
  compare_price: unknown;
  weight: number | null;
  image_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

type ProductImageRow = {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: Date;
  updated_at: Date;
};

type ProductAttributeRow = {
  attribute_id: string;
  attribute_name: string;
  attribute_value_id: string;
  value: string;
};

type CountRow = {
  count: number | bigint;
};

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: ProductEventPublisher,
  ) {}

  async create(dto: CreateProductDto, actorId?: string) {
    const slug = dto.slug ?? this.slugify(dto.name);

    const dimensions = this.parseJsonField(dto.dimensions);

    this.assertValidPrices(dto.price, dto.comparePrice);

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      await this.assertBrandExists(tx, dto.brandId);

      await this.assertCategoryExists(tx, dto.categoryId);

      await this.assertProductUnique(tx, {
        sku: dto.sku,
        slug,
      });

      const productId = randomUUID();

      const rows = await tx.$queryRaw<ProductRow[]>(
        Prisma.sql`
                INSERT INTO "Product" (
                  "id",
                  "name",
                  "slug",
                  "description",
                  "shortDescription",
                  "brandId",
                  "categoryId",
                  "sku",
                  "price",
                  "comparePrice",
                  "weight",
                  "dimensions",
                  "isActive",
                  "status",
                  "viewCount",
                  "reviewCount",
                  "averageRating",
                  "createdAt",
                  "updatedAt"
                )
                VALUES (
                  ${productId},
                  ${dto.name},
                  ${slug},
                  ${dto.description ?? null},
                  ${dto.shortDescription ?? null},
                  ${dto.brandId},
                  ${dto.categoryId},
                  ${dto.sku},
                  ${new Prisma.Decimal(dto.price)},
                  ${
                    dto.comparePrice
                      ? new Prisma.Decimal(dto.comparePrice)
                      : null
                  },
                  ${dto.weight ?? null},
                  ${dimensions === undefined ? null : dimensions}::jsonb,
                  ${dto.isActive ?? true},
                  ${dto.status ?? ProductStatus.DRAFT}::"ProductStatus",
                  0,
                  0,
                  NULL,
                  ${now},
                  ${now}
                )
                RETURNING
                  "id",
                  "name",
                  "slug",
                  "description",
                  "shortDescription" AS short_description,
                  "brandId" AS brand_id,
                  NULL::text AS brand_name,
                  NULL::text AS brand_slug,
                  "categoryId" AS category_id,
                  NULL::text AS category_name,
                  NULL::text AS category_slug,
                  "sku",
                  "price",
                  "comparePrice" AS compare_price,
                  "weight",
                  "dimensions",
                  "isActive" AS is_active,
                  "status",
                  "viewCount" AS view_count,
                  "reviewCount" AS review_count,
                  "averageRating" AS average_rating,
                  "createdAt" AS created_at,
                  "updatedAt" AS updated_at,
                  "deleted_at" AS deleted_at
              `,
      );

      const product = rows[0];

      if (!product) {
        throw new BadRequestException('محصول ایجاد نشد.');
      }

      if (dto.attributeValueIds?.length) {
        await this.syncAttributesTx(tx, product.id, dto.attributeValueIds);
      }

      if (dto.images?.length) {
        for (const image of dto.images) {
          await this.addImageTx(tx, product.id, image);
        }
      }

      if (dto.variants?.length) {
        for (const variant of dto.variants) {
          await this.addVariantTx(tx, product.id, variant);
        }
      }

      return product;
    });

    this.eventPublisher.publishCreated({
      productId: result.id,
      name: result.name,
      slug: result.slug,
      sku: result.sku,
      status: result.status,
      actorId,
      occurredAt: now,
    });

    return this.findOne(result.id, {
      incrementView: false,
    });
  }

  async findAll(query: QueryProductDto) {
    this.assertPriceRange(query.minPrice, query.maxPrice);

    const { page, limit, skip } = this.buildPagination(query);

    const whereSql = this.buildProductWhereSql(query);

    const orderSql = this.buildOrderSql(query.sort);

    const rows = await this.prisma.$queryRaw<ProductRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."name",
            p."slug",
            p."description",
            p."shortDescription" AS short_description,
            p."brandId" AS brand_id,
            b."name" AS brand_name,
            b."slug" AS brand_slug,
            p."categoryId" AS category_id,
            c."name" AS category_name,
            c."slug" AS category_slug,
            p."sku",
            p."price",
            p."comparePrice" AS compare_price,
            p."weight",
            p."dimensions",
            p."isActive" AS is_active,
            p."status",
            p."viewCount" AS view_count,
            p."reviewCount" AS review_count,
            p."averageRating" AS average_rating,
            p."createdAt" AS created_at,
            p."updatedAt" AS updated_at,
            p."deleted_at" AS deleted_at,
            image."url" AS primary_image_url,
            image."altText" AS primary_image_alt,
            COALESCE(stock.available_stock, 0)::int AS available_stock
          FROM "Product" p
          LEFT JOIN "Brand" b ON b."id" = p."brandId"
          LEFT JOIN "Category" c ON c."id" = p."categoryId"
          LEFT JOIN LATERAL (
            SELECT
              pi."url",
              pi."altText"
            FROM "ProductImage" pi
            WHERE pi."productId" = p."id"
            ORDER BY pi."isPrimary" DESC, pi."sortOrder" ASC
            LIMIT 1
          ) image ON true
          LEFT JOIN LATERAL (
            SELECT
              COALESCE(
                SUM(
                  GREATEST(
                    COALESCE(i."quantity", 0) -
                    COALESCE(i."reservedQuantity", 0),
                    0
                  )
                ),
                0
              ) AS available_stock
            FROM "ProductVariant" pv
            LEFT JOIN "Inventory" i ON i."variantId" = pv."id"
            WHERE pv."productId" = p."id"
              AND pv."deleted_at" IS NULL
              AND pv."isActive" = true
          ) stock ON true
          ${whereSql}
          ${orderSql}
          LIMIT ${limit}
          OFFSET ${skip}
        `,
    );

    const countRows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS count
          FROM "Product" p
          LEFT JOIN "Brand" b ON b."id" = p."brandId"
          LEFT JOIN "Category" c ON c."id" = p."categoryId"
          LEFT JOIN LATERAL (
            SELECT
              COALESCE(
                SUM(
                  GREATEST(
                    COALESCE(i."quantity", 0) -
                    COALESCE(i."reservedQuantity", 0),
                    0
                  )
                ),
                0
              ) AS available_stock
            FROM "ProductVariant" pv
            LEFT JOIN "Inventory" i ON i."variantId" = pv."id"
            WHERE pv."productId" = p."id"
              AND pv."deleted_at" IS NULL
              AND pv."isActive" = true
          ) stock ON true
          ${whereSql}
        `,
    );

    const total = this.toNumber(countRows[0]?.count);

    return this.buildPaginatedResult(
      rows.map((row) => this.mapProductRow(row)),
      total,
      page,
      limit,
    );
  }

  async findOne(
    identifier: string,
    options?: {
      incrementView?: boolean;
      visitorId?: string;
      actorId?: string;
    },
  ) {
    const rows = await this.prisma.$queryRaw<ProductRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."name",
            p."slug",
            p."description",
            p."shortDescription" AS short_description,
            p."brandId" AS brand_id,
            b."name" AS brand_name,
            b."slug" AS brand_slug,
            p."categoryId" AS category_id,
            c."name" AS category_name,
            c."slug" AS category_slug,
            p."sku",
            p."price",
            p."comparePrice" AS compare_price,
            p."weight",
            p."dimensions",
            p."isActive" AS is_active,
            p."status",
            p."viewCount" AS view_count,
            p."reviewCount" AS review_count,
            p."averageRating" AS average_rating,
            p."createdAt" AS created_at,
            p."updatedAt" AS updated_at,
            p."deleted_at" AS deleted_at
          FROM "Product" p
          LEFT JOIN "Brand" b ON b."id" = p."brandId"
          LEFT JOIN "Category" c ON c."id" = p."categoryId"
          WHERE p."deleted_at" IS NULL
            AND (
              p."id" = ${identifier}
              OR p."slug" = ${identifier}
              OR p."sku" = ${identifier}
            )
          LIMIT 1
        `,
    );

    const product = rows[0];

    if (!product) {
      throw new NotFoundException('محصول موردنظر یافت نشد.');
    }

    if (options?.incrementView !== false) {
      await this.incrementView(
        product.id,
        options?.visitorId,
        options?.actorId,
      );
    }

    const [variants, images, attributes] = await Promise.all([
      this.getVariants(product.id),
      this.getImages(product.id),
      this.getAttributes(product.id),
    ]);

    return {
      ...this.mapProductRow(product),
      variants,
      images,
      attributes,
    };
  }

  async update(productId: string, dto: UpdateProductDto, actorId?: string) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی محصول ارسال نشده است.',
      );
    }

    const current = await this.findProductRowById(productId);

    const nextSlug =
      dto.slug === undefined
        ? undefined
        : (dto.slug ?? this.slugify(dto.name ?? current.name));

    this.assertValidPrices(
      dto.price ?? this.toDecimalString(current.price),
      dto.comparePrice === undefined
        ? (this.toNullableDecimalString(current.compare_price) ?? undefined)
        : (dto.comparePrice ?? undefined),
    );

    const updatedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (dto.brandId) {
        await this.assertBrandExists(tx, dto.brandId);
      }

      if (dto.categoryId) {
        await this.assertCategoryExists(tx, dto.categoryId);
      }

      await this.assertProductUnique(
        tx,
        {
          sku: dto.sku,
          slug: nextSlug,
        },
        productId,
      );

      const updates: Prisma.Sql[] = [];

      if (dto.name !== undefined) {
        updates.push(Prisma.sql`"name" = ${dto.name}`);
      }

      if (nextSlug !== undefined) {
        updates.push(Prisma.sql`"slug" = ${nextSlug}`);
      }

      if (dto.description !== undefined) {
        updates.push(Prisma.sql`"description" = ${dto.description}`);
      }

      if (dto.shortDescription !== undefined) {
        updates.push(Prisma.sql`"shortDescription" = ${dto.shortDescription}`);
      }

      if (dto.brandId !== undefined) {
        updates.push(Prisma.sql`"brandId" = ${dto.brandId}`);
      }

      if (dto.categoryId !== undefined) {
        updates.push(Prisma.sql`"categoryId" = ${dto.categoryId}`);
      }

      if (dto.sku !== undefined) {
        updates.push(Prisma.sql`"sku" = ${dto.sku}`);
      }

      if (dto.price !== undefined) {
        updates.push(Prisma.sql`"price" = ${new Prisma.Decimal(dto.price)}`);
      }

      if (dto.comparePrice !== undefined) {
        updates.push(
          Prisma.sql`
              "comparePrice" = ${
                dto.comparePrice ? new Prisma.Decimal(dto.comparePrice) : null
              }
            `,
        );
      }

      if (dto.weight !== undefined) {
        updates.push(Prisma.sql`"weight" = ${dto.weight}`);
      }

      if (dto.dimensions !== undefined) {
        updates.push(
          Prisma.sql`
              "dimensions" = ${
                dto.dimensions ? this.parseJsonField(dto.dimensions) : null
              }::jsonb
            `,
        );
      }

      if (dto.isActive !== undefined) {
        updates.push(Prisma.sql`"isActive" = ${dto.isActive}`);
      }

      if (dto.status !== undefined) {
        updates.push(Prisma.sql`"status" = ${dto.status}::"ProductStatus"`);
      }

      if (updates.length > 0) {
        await tx.$executeRaw(
          Prisma.sql`
              UPDATE "Product"
              SET
                ${Prisma.join(updates, ', ')},
                "updatedAt" = ${updatedAt}
              WHERE "id" = ${productId}
                AND "deleted_at" IS NULL
            `,
        );
      }

      if (dto.attributeValueIds) {
        await this.syncAttributesTx(tx, productId, dto.attributeValueIds);
      }
    });

    this.eventPublisher.publishUpdated({
      productId,
      changedFields: Object.keys(dto),
      actorId,
      occurredAt: updatedAt,
    });

    if (dto.status && dto.status !== current.status) {
      this.eventPublisher.publishStatusChanged({
        productId,
        previousStatus: current.status,
        currentStatus: dto.status,
        actorId,
        occurredAt: updatedAt,
      });
    }

    if (dto.attributeValueIds) {
      this.eventPublisher.publishAttributesSynced({
        productId,
        attributeValueIds: dto.attributeValueIds,
        actorId,
        occurredAt: updatedAt,
      });
    }

    return this.findOne(productId, {
      incrementView: false,
    });
  }

  async remove(productId: string, actorId?: string) {
    const product = await this.findProductRowById(productId);

    const deletedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
            UPDATE "Product"
            SET
              "deleted_at" = ${deletedAt},
              "isActive" = false,
              "updatedAt" = ${deletedAt}
            WHERE "id" = ${productId}
              AND "deleted_at" IS NULL
          `,
      );

      await tx.$executeRaw(
        Prisma.sql`
            UPDATE "ProductVariant"
            SET
              "deleted_at" = ${deletedAt},
              "isActive" = false,
              "updatedAt" = ${deletedAt}
            WHERE "productId" = ${productId}
              AND "deleted_at" IS NULL
          `,
      );
    });

    this.eventPublisher.publishDeleted({
      productId,
      name: product.name,
      slug: product.slug,
      actorId,
      occurredAt: deletedAt,
    });

    return {
      deletedAt: deletedAt.toISOString(),
      deletedAtFa: this.formatDateTimeFaNullable(deletedAt),
      audit: {
        actorId: actorId ?? null,
        action: 'product.deleted',
      },
    };
  }

  async addImage(
    productId: string,
    dto: CreateProductImageDto,
    actorId?: string,
  ) {
    await this.findProductRowById(productId);

    const image = await this.prisma.$transaction(async (tx) =>
      this.addImageTx(tx, productId, dto),
    );

    this.eventPublisher.publishImageAdded({
      productId,
      imageId: image.id,
      url: image.url,
      actorId,
      occurredAt: new Date(),
    });

    return image;
  }

  async addVariant(
    productId: string,
    dto: CreateProductVariantDto,
    actorId?: string,
  ) {
    await this.findProductRowById(productId);

    const variant = await this.prisma.$transaction(async (tx) =>
      this.addVariantTx(tx, productId, dto),
    );

    this.eventPublisher.publishVariantAdded({
      productId,
      variantId: variant.id,
      sku: variant.sku,
      actorId,
      occurredAt: new Date(),
    });

    return variant;
  }

  async updateVariant(
    variantId: string,
    dto: UpdateProductVariantDto,
    actorId?: string,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی واریانت ارسال نشده است.',
      );
    }

    const current = await this.findVariantRowById(variantId);

    if (dto.sku) {
      await this.assertVariantSkuUnique(this.prisma, dto.sku, variantId);
    }

    const updates: Prisma.Sql[] = [];

    if (dto.sku !== undefined) {
      updates.push(Prisma.sql`"sku" = ${dto.sku}`);
    }

    if (dto.name !== undefined) {
      updates.push(Prisma.sql`"name" = ${dto.name}`);
    }

    if (dto.slug !== undefined) {
      updates.push(Prisma.sql`"slug" = ${dto.slug}`);
    }

    if (dto.price !== undefined) {
      updates.push(
        Prisma.sql`
          "price" = ${dto.price ? new Prisma.Decimal(dto.price) : null}
        `,
      );
    }

    if (dto.comparePrice !== undefined) {
      updates.push(
        Prisma.sql`
          "comparePrice" = ${
            dto.comparePrice ? new Prisma.Decimal(dto.comparePrice) : null
          }
        `,
      );
    }

    if (dto.weight !== undefined) {
      updates.push(Prisma.sql`"weight" = ${dto.weight}`);
    }

    if (dto.imageUrl !== undefined) {
      updates.push(Prisma.sql`"imageUrl" = ${dto.imageUrl}`);
    }

    if (dto.isActive !== undefined) {
      updates.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    const updatedAt = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "ProductVariant"
        SET
          ${Prisma.join(updates, ', ')},
          "updatedAt" = ${updatedAt}
        WHERE "id" = ${variantId}
          AND "deleted_at" IS NULL
      `,
    );

    this.eventPublisher.publishVariantUpdated({
      productId: current.product_id,
      variantId,
      changedFields: Object.keys(dto),
      actorId,
      occurredAt: updatedAt,
    });

    return this.findVariantRowById(variantId);
  }

  async removeVariant(variantId: string, actorId?: string) {
    const variant = await this.findVariantRowById(variantId);

    const deletedAt = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "ProductVariant"
        SET
          "deleted_at" = ${deletedAt},
          "isActive" = false,
          "updatedAt" = ${deletedAt}
        WHERE "id" = ${variantId}
          AND "deleted_at" IS NULL
      `,
    );

    this.eventPublisher.publishVariantDeleted({
      productId: variant.product_id,
      variantId: variant.id,
      sku: variant.sku,
      actorId,
      occurredAt: deletedAt,
    });

    return {
      deletedAt: deletedAt.toISOString(),
      deletedAtFa: this.formatDateTimeFaNullable(deletedAt),
      audit: {
        actorId: actorId ?? null,
        action: 'product_variant.deleted',
      },
    };
  }

  async incrementView(productId: string, visitorId?: string, actorId?: string) {
    const viewedAt = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Product"
        SET
          "viewCount" = "viewCount" + 1,
          "updatedAt" = ${viewedAt}
        WHERE "id" = ${productId}
          AND "deleted_at" IS NULL
      `,
    );

    this.eventPublisher.publishViewed({
      productId,
      visitorId,
      actorId,
      occurredAt: viewedAt,
    });

    return {
      success: true,
    };
  }

  private async addImageTx(
    tx: PrismaTx,
    productId: string,
    dto: CreateProductImageDto,
  ): Promise<ProductImageRow> {
    if (dto.isPrimary === true) {
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "ProductImage"
          SET "isPrimary" = false
          WHERE "productId" = ${productId}
        `,
      );
    }

    const imageId = randomUUID();

    const now = new Date();

    const rows = await tx.$queryRaw<ProductImageRow[]>(
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
            ${dto.sortOrder ?? 0},
            ${dto.isPrimary ?? false},
            ${now},
            ${now}
          )
          RETURNING
            "id",
            "productId" AS product_id,
            "url",
            "altText" AS alt_text,
            "sortOrder" AS sort_order,
            "isPrimary" AS is_primary,
            "createdAt" AS created_at,
            "updatedAt" AS updated_at
        `,
    );

    return rows[0];
  }

  private async addVariantTx(
    tx: PrismaTx,
    productId: string,
    dto: CreateProductVariantDto,
  ): Promise<ProductVariantRow> {
    await this.assertVariantSkuUnique(tx, dto.sku);

    this.assertValidPrices(dto.price, dto.comparePrice, true);

    const variantId = randomUUID();

    const now = new Date();

    const rows = await tx.$queryRaw<ProductVariantRow[]>(
      Prisma.sql`
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
            "updatedAt"
          )
          VALUES (
            ${variantId},
            ${productId},
            ${dto.sku},
            ${dto.name ?? null},
            ${dto.slug ?? null},
            ${dto.price ? new Prisma.Decimal(dto.price) : null},
            ${dto.comparePrice ? new Prisma.Decimal(dto.comparePrice) : null},
            ${dto.weight ?? null},
            ${dto.imageUrl ?? null},
            ${dto.isActive ?? true},
            ${now},
            ${now}
          )
          RETURNING
            "id",
            "productId" AS product_id,
            "sku",
            "name",
            "slug",
            "price",
            "comparePrice" AS compare_price,
            "weight",
            "imageUrl" AS image_url,
            "isActive" AS is_active,
            "createdAt" AS created_at,
            "updatedAt" AS updated_at,
            "deleted_at" AS deleted_at
        `,
    );

    return rows[0];
  }

  private async syncAttributesTx(
    tx: PrismaTx,
    productId: string,
    attributeValueIds: string[],
  ) {
    const uniqueIds = [
      ...new Set(attributeValueIds.map((id) => id.trim()).filter(Boolean)),
    ];

    if (uniqueIds.length === 0) {
      await tx.$executeRaw(
        Prisma.sql`
          DELETE FROM "ProductAttribute"
          WHERE "productId" = ${productId}
        `,
      );

      return;
    }

    const countRows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "AttributeValue"
          WHERE "id" IN (${Prisma.join(uniqueIds)})
            AND "deleted_at" IS NULL
        `,
    );

    if (this.toNumber(countRows[0]?.count) !== uniqueIds.length) {
      throw new BadRequestException(
        'One or more attributeValueIds are invalid',
      );
    }

    await tx.$executeRaw(
      Prisma.sql`
        DELETE FROM "ProductAttribute"
        WHERE "productId" = ${productId}
      `,
    );

    const now = new Date();

    for (const attributeValueId of uniqueIds) {
      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO "ProductAttribute" (
            "id",
            "productId",
            "attributeValueId",
            "createdAt"
          )
          VALUES (
            ${randomUUID()},
            ${productId},
            ${attributeValueId},
            ${now}
          )
          ON CONFLICT ("productId", "attributeValueId")
          DO NOTHING
        `,
      );
    }
  }

  private async getVariants(productId: string) {
    const rows = await this.prisma.$queryRaw<ProductVariantRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "productId" AS product_id,
            "sku",
            "name",
            "slug",
            "price",
            "comparePrice" AS compare_price,
            "weight",
            "imageUrl" AS image_url,
            "isActive" AS is_active,
            "createdAt" AS created_at,
            "updatedAt" AS updated_at,
            "deleted_at" AS deleted_at
          FROM "ProductVariant"
          WHERE "productId" = ${productId}
            AND "deleted_at" IS NULL
          ORDER BY "createdAt" ASC
        `,
    );

    return rows.map((row) => this.mapVariantRow(row));
  }

  private async getImages(productId: string) {
    const rows = await this.prisma.$queryRaw<ProductImageRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "productId" AS product_id,
            "url",
            "altText" AS alt_text,
            "sortOrder" AS sort_order,
            "isPrimary" AS is_primary,
            "createdAt" AS created_at,
            "updatedAt" AS updated_at
          FROM "ProductImage"
          WHERE "productId" = ${productId}
          ORDER BY "isPrimary" DESC, "sortOrder" ASC
        `,
    );

    return rows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      url: row.url,
      altText: row.alt_text,
      sortOrder: row.sort_order,
      isPrimary: row.is_primary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private async getAttributes(productId: string) {
    const rows = await this.prisma.$queryRaw<ProductAttributeRow[]>(
      Prisma.sql`
          SELECT
            a."id" AS attribute_id,
            a."name" AS attribute_name,
            av."id" AS attribute_value_id,
            av."value" AS value
          FROM "ProductAttribute" pa
          INNER JOIN "AttributeValue" av ON av."id" = pa."attributeValueId"
          INNER JOIN "Attribute" a ON a."id" = av."attributeId"
          WHERE pa."productId" = ${productId}
            AND av."deleted_at" IS NULL
            AND a."deleted_at" IS NULL
          ORDER BY a."name" ASC, av."value" ASC
        `,
    );

    return rows.map((row) => ({
      attributeId: row.attribute_id,
      attributeName: row.attribute_name,
      attributeValueId: row.attribute_value_id,
      value: row.value,
    }));
  }

  private async findProductRowById(productId: string): Promise<ProductRow> {
    const rows = await this.prisma.$queryRaw<ProductRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."name",
            p."slug",
            p."description",
            p."shortDescription" AS short_description,
            p."brandId" AS brand_id,
            b."name" AS brand_name,
            b."slug" AS brand_slug,
            p."categoryId" AS category_id,
            c."name" AS category_name,
            c."slug" AS category_slug,
            p."sku",
            p."price",
            p."comparePrice" AS compare_price,
            p."weight",
            p."dimensions",
            p."isActive" AS is_active,
            p."status",
            p."viewCount" AS view_count,
            p."reviewCount" AS review_count,
            p."averageRating" AS average_rating,
            p."createdAt" AS created_at,
            p."updatedAt" AS updated_at,
            p."deleted_at" AS deleted_at
          FROM "Product" p
          LEFT JOIN "Brand" b ON b."id" = p."brandId"
          LEFT JOIN "Category" c ON c."id" = p."categoryId"
          WHERE p."id" = ${productId}
            AND p."deleted_at" IS NULL
          LIMIT 1
        `,
    );

    if (!rows[0]) {
      throw new NotFoundException('محصول موردنظر یافت نشد.');
    }

    return rows[0];
  }

  private async findVariantRowById(
    variantId: string,
  ): Promise<ProductVariantRow> {
    const rows = await this.prisma.$queryRaw<ProductVariantRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "productId" AS product_id,
            "sku",
            "name",
            "slug",
            "price",
            "comparePrice" AS compare_price,
            "weight",
            "imageUrl" AS image_url,
            "isActive" AS is_active,
            "createdAt" AS created_at,
            "updatedAt" AS updated_at,
            "deleted_at" AS deleted_at
          FROM "ProductVariant"
          WHERE "id" = ${variantId}
            AND "deleted_at" IS NULL
          LIMIT 1
        `,
    );

    if (!rows[0]) {
      throw new NotFoundException('Product variant not found');
    }

    return rows[0];
  }

  private async assertBrandExists(tx: PrismaTx, brandId: string) {
    const rows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "Brand"
          WHERE "id" = ${brandId}
            AND "deleted_at" IS NULL
            AND "isActive" = true
        `,
    );

    if (this.toNumber(rows[0]?.count) === 0) {
      throw new BadRequestException('Brand not found or inactive');
    }
  }

  private async assertCategoryExists(tx: PrismaTx, categoryId: string) {
    const rows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "Category"
          WHERE "id" = ${categoryId}
            AND "deleted_at" IS NULL
            AND "isActive" = true
        `,
    );

    if (this.toNumber(rows[0]?.count) === 0) {
      throw new BadRequestException('Category not found or inactive');
    }
  }

  private async assertProductUnique(
    tx: PrismaTx,
    data: {
      sku?: string;
      slug?: string;
    },
    excludeProductId?: string,
  ) {
    if (!data.sku && !data.slug) {
      return;
    }

    const conditions: Prisma.Sql[] = [];

    if (data.sku) {
      conditions.push(Prisma.sql`"sku" = ${data.sku}`);
    }

    if (data.slug) {
      conditions.push(Prisma.sql`"slug" = ${data.slug}`);
    }

    const rows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "Product"
          WHERE "deleted_at" IS NULL
            AND (
              ${Prisma.join(conditions, ' OR ')}
            )
            ${
              excludeProductId
                ? Prisma.sql`AND "id" <> ${excludeProductId}`
                : Prisma.empty
            }
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('Product sku or slug already exists');
    }
  }

  private async assertVariantSkuUnique(
    tx: PrismaTx | PrismaService,
    sku: string,
    excludeVariantId?: string,
  ) {
    const rows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "ProductVariant"
          WHERE "sku" = ${sku}
            AND "deleted_at" IS NULL
            ${
              excludeVariantId
                ? Prisma.sql`AND "id" <> ${excludeVariantId}`
                : Prisma.empty
            }
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('Product variant sku already exists');
    }
  }

  private buildProductWhereSql(query: QueryProductDto): Prisma.Sql {
    const conditions: Prisma.Sql[] = [Prisma.sql`p."deleted_at" IS NULL`];

    if (query.q) {
      conditions.push(
        Prisma.sql`
          (
            p."name" ILIKE ${`%${query.q}%`}
            OR p."sku" ILIKE ${`%${query.q}%`}
            OR p."description" ILIKE ${`%${query.q}%`}
            OR p."shortDescription" ILIKE ${`%${query.q}%`}
            OR b."name" ILIKE ${`%${query.q}%`}
            OR c."name" ILIKE ${`%${query.q}%`}
          )
        `,
      );
    }

    if (query.brandId) {
      conditions.push(Prisma.sql`p."brandId" = ${query.brandId}`);
    }

    if (query.brandSlug) {
      conditions.push(Prisma.sql`b."slug" = ${query.brandSlug}`);
    }

    if (query.categoryId) {
      conditions.push(Prisma.sql`p."categoryId" = ${query.categoryId}`);
    }

    if (query.categorySlug) {
      conditions.push(Prisma.sql`c."slug" = ${query.categorySlug}`);
    }

    if (query.status) {
      conditions.push(
        Prisma.sql`p."status" = ${query.status}::"ProductStatus"`,
      );
    }

    if (query.isActive !== undefined) {
      conditions.push(Prisma.sql`p."isActive" = ${query.isActive}`);
    }

    if (query.minPrice !== undefined) {
      conditions.push(Prisma.sql`p."price" >= ${query.minPrice}`);
    }

    if (query.maxPrice !== undefined) {
      conditions.push(Prisma.sql`p."price" <= ${query.maxPrice}`);
    }

    if (query.minRating !== undefined) {
      conditions.push(Prisma.sql`p."averageRating" >= ${query.minRating}`);
    }

    if (query.inStock === true) {
      conditions.push(Prisma.sql`COALESCE(stock.available_stock, 0) > 0`);
    }

    if (query.inStock === false) {
      conditions.push(Prisma.sql`COALESCE(stock.available_stock, 0) <= 0`);
    }

    if (query.hasDiscount === true) {
      conditions.push(
        Prisma.sql`
          p."comparePrice" IS NOT NULL
          AND p."comparePrice" > p."price"
        `,
      );
    }

    if (query.hasDiscount === false) {
      conditions.push(
        Prisma.sql`
          (
            p."comparePrice" IS NULL
            OR p."comparePrice" <= p."price"
          )
        `,
      );
    }

    return Prisma.sql`
      WHERE ${Prisma.join(conditions, ' AND ')}
    `;
  }

  private buildOrderSql(sort?: QueryProductDto['sort']): Prisma.Sql {
    if (sort === 'oldest') {
      return Prisma.sql`
        ORDER BY p."createdAt" ASC, p."id" ASC
      `;
    }

    if (sort === 'price_asc') {
      return Prisma.sql`
        ORDER BY p."price" ASC, p."id" DESC
      `;
    }

    if (sort === 'price_desc') {
      return Prisma.sql`
        ORDER BY p."price" DESC, p."id" DESC
      `;
    }

    if (sort === 'rating_desc') {
      return Prisma.sql`
        ORDER BY p."averageRating" DESC NULLS LAST,
                 p."reviewCount" DESC,
                 p."id" DESC
      `;
    }

    if (sort === 'popular') {
      return Prisma.sql`
        ORDER BY p."viewCount" DESC,
                 p."reviewCount" DESC,
                 p."id" DESC
      `;
    }

    if (sort === 'name_asc') {
      return Prisma.sql`
        ORDER BY p."name" ASC, p."id" DESC
      `;
    }

    if (sort === 'name_desc') {
      return Prisma.sql`
        ORDER BY p."name" DESC, p."id" DESC
      `;
    }

    return Prisma.sql`
      ORDER BY p."createdAt" DESC, p."id" DESC
    `;
  }

  private mapProductRow(row: ProductRow) {
    const price = this.toDecimalString(row.price);

    const comparePrice = this.toNullableDecimalString(row.compare_price);

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      shortDescription: row.short_description,
      brand: {
        id: row.brand_id,
        name: row.brand_name,
        slug: row.brand_slug,
      },
      category: {
        id: row.category_id,
        name: row.category_name,
        slug: row.category_slug,
      },
      sku: row.sku,
      price,
      comparePrice,
      discountPercent: this.calculateDiscountPercent(price, comparePrice),
      weight: row.weight,
      dimensions: row.dimensions,
      isActive: row.is_active,
      status: row.status,
      viewCount: this.toNumber(row.view_count),
      reviewCount: this.toNumber(row.review_count),
      averageRating: this.toNullableDecimalString(row.average_rating),
      primaryImage: row.primary_image_url
        ? {
            url: row.primary_image_url,
            altText: row.primary_image_alt,
          }
        : null,
      inventory:
        row.available_stock === undefined
          ? undefined
          : {
              availableStock: this.toNumber(row.available_stock),
              inStock: this.toNumber(row.available_stock) > 0,
            },
      createdAt: row.created_at.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.created_at),
      updatedAt: row.updated_at.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updated_at),
      deletedAt: this.toIsoStringNullable(row.deleted_at),
      deletedAtFa: this.formatDateTimeFaNullable(row.deleted_at),
    };
  }

  private mapVariantRow(row: ProductVariantRow) {
    return {
      id: row.id,
      productId: row.product_id,
      sku: row.sku,
      name: row.name,
      slug: row.slug,
      price: this.toNullableDecimalString(row.price),
      comparePrice: this.toNullableDecimalString(row.compare_price),
      weight: row.weight,
      imageUrl: row.image_url,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.created_at),
      updatedAt: row.updated_at.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updated_at),
      deletedAt: this.toIsoStringNullable(row.deleted_at),
      deletedAtFa: this.formatDateTimeFaNullable(row.deleted_at),
    };
  }

  private buildPagination(query: QueryProductDto) {
    const page = Math.max(1, Number(query.page ?? 1));

    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 24)));

    const skip = (page - 1) * limit;

    return {
      page,
      limit,
      skip,
    };
  }

  private buildPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ) {
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  private assertPriceRange(minPrice?: number, maxPrice?: number) {
    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      throw new BadRequestException('minPrice cannot be greater than maxPrice');
    }
  }

  private assertValidPrices(
    price?: string,
    comparePrice?: string,
    allowEmptyPrice = false,
  ) {
    if (!allowEmptyPrice && !price) {
      throw new BadRequestException('price is required');
    }

    if (price && new Prisma.Decimal(price).lessThan(0)) {
      throw new BadRequestException('price cannot be negative');
    }

    if (comparePrice && new Prisma.Decimal(comparePrice).lessThan(0)) {
      throw new BadRequestException('comparePrice cannot be negative');
    }

    if (
      price &&
      comparePrice &&
      new Prisma.Decimal(comparePrice).lessThan(new Prisma.Decimal(price))
    ) {
      throw new BadRequestException('comparePrice cannot be less than price');
    }
  }

  private calculateDiscountPercent(
    price: string,
    comparePrice: string | null,
  ): number {
    if (!comparePrice) {
      return 0;
    }

    const priceNumber = Number(price);

    const comparePriceNumber = Number(comparePrice);

    if (
      !Number.isFinite(priceNumber) ||
      !Number.isFinite(comparePriceNumber) ||
      priceNumber <= 0 ||
      comparePriceNumber <= priceNumber
    ) {
      return 0;
    }

    return Math.round(
      ((comparePriceNumber - priceNumber) / comparePriceNumber) * 100,
    );
  }

  private parseJsonField(
    value?: string | null,
  ): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    try {
      return JSON.parse(value) as Prisma.InputJsonValue;
    } catch {
      throw new BadRequestException('Invalid JSON value');
    }
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 220);
  }

  private toIsoStringNullable(date: Date | null): string | null {
    return date ? date.toISOString() : null;
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

  private toDecimalString(value: unknown): string {
    if (value === null || value === undefined) {
      return '0';
    }

    if (Prisma.Decimal.isDecimal(value)) {
      return value.toString();
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }

    throw new TypeError('Unsupported decimal value');
  }

  private toNullableDecimalString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return this.toDecimalString(value);
  }

  private toNumber(value: number | bigint | null | undefined): number {
    if (value === null || value === undefined) {
      return 0;
    }

    return Number(value);
  }
}
