import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import {
  AiCatalogSearchResult,
  AiInventoryContext,
  AiProductAttributeContext,
  AiProductContext,
  AiProductImageContext,
  AiProductSnapshot,
  AiProductVariantContext,
  AiReviewSummaryContext,
  AiUserBehaviorContext,
} from '../interfaces/ai-context.interface';

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  short_description: string | null;
  price: unknown;
  compare_price: unknown;
  brand_name: string | null;
  category_name: string | null;
  average_rating: unknown;
  review_count: number | bigint;
  view_count: number | bigint;
  is_active: boolean;
  status: string;
};

type VariantRow = {
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
};

type ImageRow = {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
};

type AttributeRow = {
  name: string;
  value: string;
};

type InventoryRow = {
  variant_id: string;
  quantity: number | bigint;
  reserved_quantity: number | bigint;
};

type ReviewCommentRow = {
  rating: number;
  title: string | null;
  comment: string | null;
  is_verified: boolean;
  created_at: Date;
};

@Injectable()
export class AiContextService {
  constructor(private readonly prisma: PrismaService) {}

  async searchCatalog(params: {
    query?: string;
    productIds?: string[];
    categoryId?: string;
    brandId?: string;
    budgetMin?: number;
    budgetMax?: number;
    limit?: number;
  }): Promise<AiCatalogSearchResult> {
    const limit = Math.min(20, Math.max(1, Number(params.limit ?? 8)));

    const searchTokens = this.buildSearchTokens(params.query);

    const overFetchLimit = Math.min(80, Math.max(limit * 4, limit));

    const rows = await this.prisma.$queryRaw<ProductRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."name",
            p."slug",
            p."sku",
            p."description",
            p."shortDescription" AS short_description,
            p."price",
            p."comparePrice" AS compare_price,
            b."name" AS brand_name,
            c."name" AS category_name,
            p."averageRating" AS average_rating,
            p."reviewCount" AS review_count,
            p."viewCount" AS view_count,
            p."isActive" AS is_active,
            p."status"::text AS status
          FROM "Product" p
          LEFT JOIN "Brand" b ON b."id" = p."brandId"
          LEFT JOIN "Category" c ON c."id" = p."categoryId"
          WHERE p."deleted_at" IS NULL
            AND p."isActive" = true
            AND p."status"::text = 'ACTIVE'
            ${this.buildSearchCondition(searchTokens)}
            ${
              params.productIds?.length
                ? Prisma.sql`AND p."id" IN (${Prisma.join(params.productIds)})`
                : Prisma.empty
            }
            ${
              params.categoryId
                ? Prisma.sql`AND p."categoryId" = ${params.categoryId}`
                : Prisma.empty
            }
            ${
              params.brandId
                ? Prisma.sql`AND p."brandId" = ${params.brandId}`
                : Prisma.empty
            }
            ${
              params.budgetMin !== undefined
                ? Prisma.sql`AND p."price" >= ${params.budgetMin}`
                : Prisma.empty
            }
            ${
              params.budgetMax !== undefined
                ? Prisma.sql`AND p."price" <= ${params.budgetMax}`
                : Prisma.empty
            }
          ORDER BY
            CASE
              WHEN ${searchTokens.length > 0} THEN
                (
                  SELECT COUNT(*)::int
                  FROM unnest(ARRAY[${Prisma.join(searchTokens.length > 0 ? searchTokens : [''])}]::text[]) AS token(value)
                  WHERE
                    p."name" ILIKE '%' || token.value || '%'
                    OR p."sku" ILIKE '%' || token.value || '%'
                    OR COALESCE(p."description", '') ILIKE '%' || token.value || '%'
                    OR COALESCE(p."shortDescription", '') ILIKE '%' || token.value || '%'
                    OR COALESCE(b."name", '') ILIKE '%' || token.value || '%'
                    OR COALESCE(c."name", '') ILIKE '%' || token.value || '%'
                )
              ELSE 0
            END DESC,
            p."averageRating" DESC NULLS LAST,
            p."reviewCount" DESC,
            p."viewCount" DESC,
            p."createdAt" DESC
          LIMIT ${overFetchLimit}
        `,
    );

    const products = rows
      .map((row) => this.mapProduct(row))
      .filter((product) => this.isAiUsableProduct(product))
      .slice(0, limit);

    return {
      products,
      total: products.length,
    };
  }

  async getProductSnapshot(identifier: string): Promise<AiProductSnapshot> {
    const rows = await this.prisma.$queryRaw<ProductRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."name",
            p."slug",
            p."sku",
            p."description",
            p."shortDescription" AS short_description,
            p."price",
            p."comparePrice" AS compare_price,
            b."name" AS brand_name,
            c."name" AS category_name,
            p."averageRating" AS average_rating,
            p."reviewCount" AS review_count,
            p."viewCount" AS view_count,
            p."isActive" AS is_active,
            p."status"::text AS status
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

    const row = rows[0];

    if (!row) {
      throw new NotFoundException('محصول موردنظر یافت نشد.');
    }

    const product = this.mapProduct(row);

    const [variants, images, attributes, inventory, reviews] =
      await Promise.all([
        this.getProductVariants(product.id),
        this.getProductImages(product.id),
        this.getProductAttributes(product.id),
        this.getProductInventory(product.id),
        this.getProductReviewSummary(product.id),
      ]);

    return {
      product,
      variants,
      images,
      attributes,
      inventory,
      reviews,
    };
  }

  async getProductSnapshots(
    productIds: string[],
  ): Promise<AiProductSnapshot[]> {
    const uniqueIds = [
      ...new Set(productIds.map((id) => id.trim()).filter(Boolean)),
    ];

    const snapshots: AiProductSnapshot[] = [];

    for (const productId of uniqueIds) {
      snapshots.push(await this.getProductSnapshot(productId));
    }

    return snapshots;
  }

  async getUserBehaviorContext(userId: string): Promise<AiUserBehaviorContext> {
    const [cartItems, wishlistItems, recentPurchasedProducts] =
      await Promise.all([
        this.prisma.$queryRaw<
          Array<{
            product_id: string;
            variant_id: string | null;
            product_name: string;
            sku: string;
            quantity: number;
            price: unknown;
          }>
        >(
          Prisma.sql`
            SELECT
              ci."productId" AS product_id,
              ci."variantId" AS variant_id,
              p."name" AS product_name,
              p."sku" AS sku,
              ci."quantity" AS quantity,
              ci."price" AS price
            FROM "Cart" c
            INNER JOIN "CartItem" ci ON ci."cartId" = c."id"
            INNER JOIN "Product" p ON p."id" = ci."productId"
            WHERE c."userId" = ${userId}
              AND p."deleted_at" IS NULL
              AND p."isActive" = true
              AND p."status"::text = 'ACTIVE'
            ORDER BY ci."updatedAt" DESC
            LIMIT 20
          `,
        ),

        this.prisma.$queryRaw<
          Array<{
            product_id: string;
            product_name: string;
            sku: string;
          }>
        >(
          Prisma.sql`
            SELECT
              wi."productId" AS product_id,
              p."name" AS product_name,
              p."sku" AS sku
            FROM "Wishlist" w
            INNER JOIN "WishlistItem" wi ON wi."wishlistId" = w."id"
            INNER JOIN "Product" p ON p."id" = wi."productId"
            WHERE w."userId" = ${userId}
              AND p."deleted_at" IS NULL
              AND p."isActive" = true
              AND p."status"::text = 'ACTIVE'
            ORDER BY wi."createdAt" DESC
            LIMIT 20
          `,
        ),

        this.prisma.$queryRaw<
          Array<{
            product_id: string;
            product_name: string;
            sku: string;
            quantity: number;
            price: unknown;
            created_at: Date;
          }>
        >(
          Prisma.sql`
            SELECT
              oi."productId" AS product_id,
              oi."productName" AS product_name,
              oi."sku" AS sku,
              oi."quantity" AS quantity,
              oi."price" AS price,
              oi."createdAt" AS created_at
            FROM "Order" o
            INNER JOIN "OrderItem" oi ON oi."orderId" = o."id"
            WHERE o."userId" = ${userId}
              AND o."deleted_at" IS NULL
            ORDER BY oi."createdAt" DESC
            LIMIT 30
          `,
        ),
      ]);

    return {
      cartItems: cartItems
        .filter(
          (item) =>
            this.isReadableText(item.product_name) &&
            !this.isLikelyTestData(item.product_name, item.sku),
        )
        .map((item) => ({
          productId: item.product_id,
          variantId: item.variant_id,
          productName: item.product_name,
          sku: item.sku,
          quantity: item.quantity,
          price: this.toStringValue(item.price),
        })),
      wishlistItems: wishlistItems
        .filter(
          (item) =>
            this.isReadableText(item.product_name) &&
            !this.isLikelyTestData(item.product_name, item.sku),
        )
        .map((item) => ({
          productId: item.product_id,
          productName: item.product_name,
          sku: item.sku,
        })),
      recentPurchasedProducts: recentPurchasedProducts
        .filter(
          (item) =>
            this.isReadableText(item.product_name) &&
            !this.isLikelyTestData(item.product_name, item.sku),
        )
        .map((item) => ({
          productId: item.product_id,
          productName: item.product_name,
          sku: item.sku,
          quantity: item.quantity,
          price: this.toStringValue(item.price),
          createdAt: item.created_at,
        })),
    };
  }

  async getStoreSnapshot() {
    const [categories, brands, topProducts] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          slug: string;
        }>
      >(
        Prisma.sql`
            SELECT "id", "name", "slug"
            FROM "Category"
            WHERE "deleted_at" IS NULL
              AND "isActive" = true
            ORDER BY "sortOrder" ASC, "name" ASC
            LIMIT 50
          `,
      ),

      this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          slug: string;
        }>
      >(
        Prisma.sql`
            SELECT "id", "name", "slug"
            FROM "Brand"
            WHERE "deleted_at" IS NULL
              AND "isActive" = true
            ORDER BY "name" ASC
            LIMIT 50
          `,
      ),

      this.searchCatalog({
        limit: 10,
      }),
    ]);

    return {
      language: 'fa',
      categories: categories
        .filter(
          (item) =>
            this.isReadableText(item.name) &&
            !this.isLikelyTestData(item.name, item.slug),
        )
        .slice(0, 30),
      brands: brands
        .filter(
          (item) =>
            this.isReadableText(item.name) &&
            !this.isLikelyTestData(item.name, item.slug),
        )
        .slice(0, 30),
      topProducts: topProducts.products,
    };
  }

  private async getProductVariants(
    productId: string,
  ): Promise<AiProductVariantContext[]> {
    const rows = await this.prisma.$queryRaw<VariantRow[]>(
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
            "isActive" AS is_active
          FROM "ProductVariant"
          WHERE "productId" = ${productId}
            AND "deleted_at" IS NULL
            AND "isActive" = true
          ORDER BY "createdAt" ASC
        `,
    );

    return rows
      .map((row) => ({
        id: row.id,
        productId: row.product_id,
        sku: row.sku,
        name: this.cleanNullableText(row.name),
        slug: row.slug,
        price: this.toNullableStringValue(row.price),
        comparePrice: this.toNullableStringValue(row.compare_price),
        weight: row.weight,
        imageUrl: row.image_url,
        isActive: row.is_active,
      }))
      .filter(
        (variant) =>
          !variant.name ||
          (this.isReadableText(variant.name) &&
            !this.isLikelyTestData(variant.name, variant.sku)),
      );
  }

  private async getProductImages(
    productId: string,
  ): Promise<AiProductImageContext[]> {
    const rows = await this.prisma.$queryRaw<ImageRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "productId" AS product_id,
            "url",
            "altText" AS alt_text,
            "sortOrder" AS sort_order,
            "isPrimary" AS is_primary
          FROM "ProductImage"
          WHERE "productId" = ${productId}
          ORDER BY "isPrimary" DESC, "sortOrder" ASC
        `,
    );

    return rows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      url: row.url,
      altText: this.cleanNullableText(row.alt_text),
      sortOrder: row.sort_order,
      isPrimary: row.is_primary,
    }));
  }

  private async getProductAttributes(
    productId: string,
  ): Promise<AiProductAttributeContext[]> {
    const rows = await this.prisma.$queryRaw<AttributeRow[]>(
      Prisma.sql`
          SELECT
            a."name" AS name,
            av."value" AS value
          FROM "ProductAttribute" pa
          INNER JOIN "AttributeValue" av ON av."id" = pa."attributeValueId"
          INNER JOIN "Attribute" a ON a."id" = av."attributeId"
          WHERE pa."productId" = ${productId}
          ORDER BY a."name" ASC, av."value" ASC
        `,
    );

    return rows
      .filter(
        (row) =>
          this.isReadableText(row.name) &&
          this.isReadableText(row.value) &&
          !this.isLikelyTestData(row.name, row.value),
      )
      .map((row) => ({
        name: row.name,
        value: row.value,
      }));
  }

  private async getProductInventory(
    productId: string,
  ): Promise<AiInventoryContext[]> {
    const rows = await this.prisma.$queryRaw<InventoryRow[]>(
      Prisma.sql`
          SELECT
            pv."id" AS variant_id,
            COALESCE(SUM(i."quantity"), 0)::int AS quantity,
            COALESCE(SUM(i."reservedQuantity"), 0)::int AS reserved_quantity
          FROM "ProductVariant" pv
          LEFT JOIN "Inventory" i ON i."variantId" = pv."id"
          WHERE pv."productId" = ${productId}
            AND pv."deleted_at" IS NULL
          GROUP BY pv."id"
        `,
    );

    return rows.map((row) => {
      const quantity = this.toNumber(row.quantity);

      const reservedQuantity = this.toNumber(row.reserved_quantity);

      return {
        variantId: row.variant_id,
        quantity,
        reservedQuantity,
        availableQuantity: Math.max(0, quantity - reservedQuantity),
      };
    });
  }

  private async getProductReviewSummary(
    productId: string,
  ): Promise<AiReviewSummaryContext> {
    const comments = await this.prisma.$queryRaw<ReviewCommentRow[]>(
      Prisma.sql`
          SELECT
            "rating",
            "title",
            "comment",
            "isVerified" AS is_verified,
            "createdAt" AS created_at
          FROM "ProductReview"
          WHERE "productId" = ${productId}
          ORDER BY "createdAt" DESC
          LIMIT 10
        `,
    );

    const aggregate = await this.prisma.$queryRaw<
      Array<{
        average_rating: unknown;
        review_count: number | bigint;
      }>
    >(
      Prisma.sql`
          SELECT
            AVG("rating") AS average_rating,
            COUNT(*)::int AS review_count
          FROM "ProductReview"
          WHERE "productId" = ${productId}
        `,
    );

    const summary = aggregate[0];

    return {
      averageRating: this.toNullableStringValue(summary?.average_rating),
      reviewCount: this.toNumber(summary?.review_count),
      latestComments: comments
        .filter(
          (item) =>
            (!item.title || this.isReadableText(item.title)) &&
            (!item.comment || this.isReadableText(item.comment)),
        )
        .map((item) => ({
          rating: item.rating,
          title: this.cleanNullableText(item.title),
          comment: this.cleanNullableText(item.comment),
          isVerified: item.is_verified,
          createdAt: item.created_at,
        })),
    };
  }

  private mapProduct(row: ProductRow): AiProductContext {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      description: this.cleanNullableText(row.description),
      shortDescription: this.cleanNullableText(row.short_description),
      price: this.toStringValue(row.price),
      comparePrice: this.toNullableStringValue(row.compare_price),
      brandName: this.cleanNullableText(row.brand_name),
      categoryName: this.cleanNullableText(row.category_name),
      averageRating: this.toNullableStringValue(row.average_rating),
      reviewCount: this.toNumber(row.review_count),
      viewCount: this.toNumber(row.view_count),
      isActive: row.is_active,
      status: row.status,
    };
  }

  private buildSearchCondition(searchTokens: string[]) {
    if (searchTokens.length === 0) {
      return Prisma.empty;
    }

    return Prisma.sql`
      AND EXISTS (
        SELECT 1
        FROM unnest(ARRAY[${Prisma.join(searchTokens)}]::text[]) AS token(value)
        WHERE
          p."name" ILIKE '%' || token.value || '%'
          OR p."sku" ILIKE '%' || token.value || '%'
          OR COALESCE(p."description", '') ILIKE '%' || token.value || '%'
          OR COALESCE(p."shortDescription", '') ILIKE '%' || token.value || '%'
          OR COALESCE(b."name", '') ILIKE '%' || token.value || '%'
          OR COALESCE(c."name", '') ILIKE '%' || token.value || '%'
      )
    `;
  }

  private buildSearchTokens(value?: string): string[] {
    if (!value) {
      return [];
    }

    const normalized = value
      .replace(/[^\u0600-\u06FFa-zA-Z0-9\s_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (!normalized) {
      return [];
    }

    const stopWords = new Set([
      'سلام',
      'لطفا',
      'لطفاً',
      'برای',
      'یک',
      'یه',
      'من',
      'میخوام',
      'می‌خوام',
      'میخواهم',
      'می‌خواهم',
      'کوتاه',
      'فارسی',
      'جواب',
      'بده',
      'روتین',
      'ساده',
      'محصول',
      'محصولات',
      'خرید',
      'مناسب',
      'است',
      'هست',
      'های',
      'را',
      'و',
      'یا',
      'با',
      'از',
      'به',
      'در',
      'the',
      'and',
      'for',
      'with',
    ]);

    return [
      ...new Set(
        normalized
          .split(' ')
          .map((token) => token.trim())
          .filter((token) => token.length >= 3 && !stopWords.has(token)),
      ),
    ].slice(0, 8);
  }

  private isAiUsableProduct(product: AiProductContext): boolean {
    return (
      product.isActive === true &&
      product.status === 'ACTIVE' &&
      this.isReadableText(product.name) &&
      this.isReadableText(product.sku) &&
      !this.isLikelyTestData(
        product.name,
        product.slug,
        product.sku,
        product.brandName,
        product.categoryName,
      ) &&
      Number(product.price) > 0
    );
  }

  private cleanNullableText(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    if (!this.isReadableText(trimmed)) {
      return null;
    }

    return trimmed;
  }

  private isReadableText(value: string | null | undefined): boolean {
    if (!value) {
      return false;
    }

    const mojibakeMarkers = ['Ø', 'Ù', 'Ú', 'Û', '�', 'â€'];

    return !mojibakeMarkers.some((marker) => value.includes(marker));
  }

  private isLikelyTestData(
    ...values: Array<string | null | undefined>
  ): boolean {
    const joined = values.filter(Boolean).join(' ').toLowerCase();

    return (
      joined.includes('test') ||
      joined.includes('تست') ||
      joined.includes('آزمایشی') ||
      joined.includes('sample') ||
      joined.includes('demo')
    );
  }

  private toStringValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '0';
    }

    if (
      typeof value === 'object' &&
      typeof (
        value as {
          toString?: unknown;
        }
      ).toString === 'function'
    ) {
      return (
        value as {
          toString: () => string;
        }
      ).toString();
    }

    switch (typeof value) {
      case 'string':
        return value;
      case 'number':
      case 'bigint':
      case 'boolean':
        return String(value);
      default:
        return '0';
    }
  }

  private toNullableStringValue(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return this.toStringValue(value);
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (
      typeof value === 'object' &&
      typeof (
        value as {
          toString?: unknown;
        }
      ).toString === 'function'
    ) {
      return Number(
        (
          value as {
            toString: () => string;
          }
        ).toString(),
      );
    }

    switch (typeof value) {
      case 'number':
        return value;
      case 'bigint':
      case 'string':
      case 'boolean':
        return Number(value);
      default:
        return 0;
    }
  }
}
