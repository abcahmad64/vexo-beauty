import { Injectable } from '@nestjs/common';

import { ProductStatus, Prisma } from '../../../../generated/prisma';

import { CacheKeyBuilder } from '../../../../core/cache/cache-key.builder';

import { CacheService } from '../../../../core/cache/cache.service';

import { CACHE_TTL } from '../../../../core/cache/cache-ttl.constants';

import { PrismaService } from '../../../../core/prisma/prisma.service';

import { RecommendationQueryDto } from '../dto/recommendation-query.dto';

import {
  RecommendedProduct,
  RecommendationReason,
} from '../types/recommendation.types';

type RecommendationRow = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: unknown;
  compare_price: unknown;
  brand_id: string;
  brand_name: string | null;
  brand_slug: string | null;
  category_id: string;
  category_name: string | null;
  category_slug: string | null;
  image_url: string | null;
  image_alt: string | null;
  score: number | bigint | null;
};

@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async similarProducts(
    query: RecommendationQueryDto,
  ): Promise<RecommendedProduct[]> {
    const limit = this.normalizeLimit(query.limit);

    const cacheKey = CacheKeyBuilder.build(
      'recommendation:similar',
      query.productId ?? 'none',
      query.categoryId ?? 'none',
      query.brandId ?? 'none',
      query.q ?? 'none',
      limit,
    );

    return this.cacheService.remember(
      cacheKey,
      CACHE_TTL.PRODUCT_LIST,
      async () => {
        const rows = await this.prisma.$queryRaw<RecommendationRow[]>(
          Prisma.sql`
              SELECT
                p."id",
                p."name",
                p."slug",
                p."sku",
                p."price",
                p."comparePrice" AS compare_price,
                p."brandId" AS brand_id,
                b."name" AS brand_name,
                b."slug" AS brand_slug,
                p."categoryId" AS category_id,
                c."name" AS category_name,
                c."slug" AS category_slug,
                image."url" AS image_url,
                image."altText" AS image_alt,
                (
                  CASE
                    WHEN ${query.categoryId ?? null}::text IS NOT NULL
                      AND p."categoryId" = ${query.categoryId ?? null}::text
                      THEN 40
                    ELSE 0
                  END +
                  CASE
                    WHEN ${query.brandId ?? null}::text IS NOT NULL
                      AND p."brandId" = ${query.brandId ?? null}::text
                      THEN 25
                    ELSE 0
                  END +
                  LEAST(COALESCE(p."viewCount", 0), 1000) / 20 +
                  LEAST(COALESCE(p."reviewCount", 0), 500) / 10 +
                  COALESCE(p."averageRating", 0) * 5
                )::int AS score
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
              ) image ON TRUE
              WHERE p."deleted_at" IS NULL
                AND p."isActive" = TRUE
                AND p."status" = ${ProductStatus.ACTIVE}::"ProductStatus"
                AND (
                  ${query.productId ?? null}::text IS NULL
                  OR p."id" <> ${query.productId ?? null}::text
                )
                AND (
                  ${query.categoryId ?? null}::text IS NULL
                  OR p."categoryId" = ${query.categoryId ?? null}::text
                )
                AND (
                  ${query.brandId ?? null}::text IS NULL
                  OR p."brandId" = ${query.brandId ?? null}::text
                )
                AND (
                  ${query.q ?? null}::text IS NULL
                  OR p."name" ILIKE ${`%${query.q ?? ''}%`}
                  OR p."sku" ILIKE ${`%${query.q ?? ''}%`}
                  OR p."description" ILIKE ${`%${query.q ?? ''}%`}
                )
              ORDER BY score DESC, p."updatedAt" DESC
              LIMIT ${limit}
            `,
        );

        return rows.map((row) => this.mapRow(row, 'similar'));
      },
    );
  }

  async bestSellers(
    query: RecommendationQueryDto,
  ): Promise<RecommendedProduct[]> {
    const limit = this.normalizeLimit(query.limit);

    return this.cacheService.remember(
      CacheKeyBuilder.build(
        'recommendation:best-sellers',
        query.categoryId ?? 'all',
        limit,
      ),
      CACHE_TTL.PRODUCT_LIST,
      async () => {
        const rows = await this.prisma.$queryRaw<RecommendationRow[]>(
          Prisma.sql`
              SELECT
                p."id",
                p."name",
                p."slug",
                p."sku",
                p."price",
                p."comparePrice" AS compare_price,
                p."brandId" AS brand_id,
                b."name" AS brand_name,
                b."slug" AS brand_slug,
                p."categoryId" AS category_id,
                c."name" AS category_name,
                c."slug" AS category_slug,
                image."url" AS image_url,
                image."altText" AS image_alt,
                COALESCE(SUM(oi."quantity"), 0)::int AS score
              FROM "Product" p
              LEFT JOIN "OrderItem" oi ON oi."productId" = p."id"
              LEFT JOIN "Order" o ON o."id" = oi."orderId"
                AND o."deleted_at" IS NULL
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
              ) image ON TRUE
              WHERE p."deleted_at" IS NULL
                AND p."isActive" = TRUE
                AND p."status" = ${ProductStatus.ACTIVE}::"ProductStatus"
                AND (
                  ${query.categoryId ?? null}::text IS NULL
                  OR p."categoryId" = ${query.categoryId ?? null}::text
                )
              GROUP BY
                p."id",
                b."id",
                c."id",
                image."url",
                image."altText"
              ORDER BY score DESC, p."viewCount" DESC, p."updatedAt" DESC
              LIMIT ${limit}
            `,
        );

        return rows.map((row) => this.mapRow(row, 'best_seller'));
      },
    );
  }

  async trending(query: RecommendationQueryDto): Promise<RecommendedProduct[]> {
    const limit = this.normalizeLimit(query.limit);

    return this.cacheService.remember(
      CacheKeyBuilder.build(
        'recommendation:trending',
        query.categoryId ?? 'all',
        limit,
      ),
      CACHE_TTL.SHORT,
      async () => {
        const rows = await this.prisma.$queryRaw<RecommendationRow[]>(
          Prisma.sql`
              SELECT
                p."id",
                p."name",
                p."slug",
                p."sku",
                p."price",
                p."comparePrice" AS compare_price,
                p."brandId" AS brand_id,
                b."name" AS brand_name,
                b."slug" AS brand_slug,
                p."categoryId" AS category_id,
                c."name" AS category_name,
                c."slug" AS category_slug,
                image."url" AS image_url,
                image."altText" AS image_alt,
                (
                  COALESCE(p."viewCount", 0) +
                  COALESCE(p."reviewCount", 0) * 10 +
                  COALESCE(p."averageRating", 0) * 20
                )::int AS score
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
              ) image ON TRUE
              WHERE p."deleted_at" IS NULL
                AND p."isActive" = TRUE
                AND p."status" = ${ProductStatus.ACTIVE}::"ProductStatus"
                AND (
                  ${query.categoryId ?? null}::text IS NULL
                  OR p."categoryId" = ${query.categoryId ?? null}::text
                )
              ORDER BY score DESC, p."updatedAt" DESC
              LIMIT ${limit}
            `,
        );

        return rows.map((row) => this.mapRow(row, 'trending'));
      },
    );
  }

  async newArrivals(
    query: RecommendationQueryDto,
  ): Promise<RecommendedProduct[]> {
    const limit = this.normalizeLimit(query.limit);

    const rows = await this.prisma.$queryRaw<RecommendationRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."name",
            p."slug",
            p."sku",
            p."price",
            p."comparePrice" AS compare_price,
            p."brandId" AS brand_id,
            b."name" AS brand_name,
            b."slug" AS brand_slug,
            p."categoryId" AS category_id,
            c."name" AS category_name,
            c."slug" AS category_slug,
            image."url" AS image_url,
            image."altText" AS image_alt,
            100::int AS score
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
          ) image ON TRUE
          WHERE p."deleted_at" IS NULL
            AND p."isActive" = TRUE
            AND p."status" = ${ProductStatus.ACTIVE}::"ProductStatus"
            AND (
              ${query.categoryId ?? null}::text IS NULL
              OR p."categoryId" = ${query.categoryId ?? null}::text
            )
          ORDER BY p."createdAt" DESC
          LIMIT ${limit}
        `,
    );

    return rows.map((row) => this.mapRow(row, 'new_arrival'));
  }

  async cartRelated(
    userId: string,
    query: RecommendationQueryDto,
  ): Promise<RecommendedProduct[]> {
    const limit = this.normalizeLimit(query.limit);

    const rows = await this.prisma.$queryRaw<RecommendationRow[]>(
      Prisma.sql`
          WITH cart_context AS (
            SELECT DISTINCT
              ci."productId",
              p."categoryId",
              p."brandId"
            FROM "Cart" c
            INNER JOIN "CartItem" ci ON ci."cartId" = c."id"
            INNER JOIN "Product" p ON p."id" = ci."productId"
            WHERE c."userId" = ${userId}
          )
          SELECT
            p."id",
            p."name",
            p."slug",
            p."sku",
            p."price",
            p."comparePrice" AS compare_price,
            p."brandId" AS brand_id,
            b."name" AS brand_name,
            b."slug" AS brand_slug,
            p."categoryId" AS category_id,
            c."name" AS category_name,
            c."slug" AS category_slug,
            image."url" AS image_url,
            image."altText" AS image_alt,
            (
              CASE
                WHEN p."categoryId" IN (
                  SELECT "categoryId" FROM cart_context
                ) THEN 40
                ELSE 0
              END +
              CASE
                WHEN p."brandId" IN (
                  SELECT "brandId" FROM cart_context
                ) THEN 15
                ELSE 0
              END +
              LEAST(COALESCE(p."viewCount", 0), 1000) / 25
            )::int AS score
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
          ) image ON TRUE
          WHERE p."deleted_at" IS NULL
            AND p."isActive" = TRUE
            AND p."status" = ${ProductStatus.ACTIVE}::"ProductStatus"
            AND p."id" NOT IN (
              SELECT "productId" FROM cart_context
            )
          ORDER BY score DESC, p."updatedAt" DESC
          LIMIT ${limit}
        `,
    );

    return rows.map((row) => this.mapRow(row, 'cart_related'));
  }

  async personalized(
    userId: string,
    query: RecommendationQueryDto,
  ): Promise<RecommendedProduct[]> {
    const limit = this.normalizeLimit(query.limit);

    const rows = await this.prisma.$queryRaw<RecommendationRow[]>(
      Prisma.sql`
          WITH user_context AS (
            SELECT DISTINCT
              oi."productId",
              p."categoryId",
              p."brandId"
            FROM "Order" o
            INNER JOIN "OrderItem" oi ON oi."orderId" = o."id"
            INNER JOIN "Product" p ON p."id" = oi."productId"
            WHERE o."userId" = ${userId}
              AND o."deleted_at" IS NULL
          )
          SELECT
            p."id",
            p."name",
            p."slug",
            p."sku",
            p."price",
            p."comparePrice" AS compare_price,
            p."brandId" AS brand_id,
            b."name" AS brand_name,
            b."slug" AS brand_slug,
            p."categoryId" AS category_id,
            c."name" AS category_name,
            c."slug" AS category_slug,
            image."url" AS image_url,
            image."altText" AS image_alt,
            (
              CASE
                WHEN p."categoryId" IN (
                  SELECT "categoryId" FROM user_context
                ) THEN 45
                ELSE 0
              END +
              CASE
                WHEN p."brandId" IN (
                  SELECT "brandId" FROM user_context
                ) THEN 20
                ELSE 0
              END +
              COALESCE(p."averageRating", 0) * 10 +
              LEAST(COALESCE(p."viewCount", 0), 1000) / 30
            )::int AS score
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
          ) image ON TRUE
          WHERE p."deleted_at" IS NULL
            AND p."isActive" = TRUE
            AND p."status" = ${ProductStatus.ACTIVE}::"ProductStatus"
            AND p."id" NOT IN (
              SELECT "productId" FROM user_context
            )
          ORDER BY score DESC, p."updatedAt" DESC
          LIMIT ${limit}
        `,
    );

    return rows.map((row) => this.mapRow(row, 'personalized'));
  }

  private normalizeLimit(limit?: number): number {
    return Math.min(50, Math.max(1, Number(limit ?? 12)));
  }

  private mapRow(
    row: RecommendationRow,
    reason: RecommendationReason,
  ): RecommendedProduct {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      price: this.toDecimalString(row.price),
      comparePrice: this.toNullableDecimalString(row.compare_price),
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
      image: {
        url: row.image_url,
        alt: row.image_alt,
      },
      score: this.toNumber(row.score),
      reason,
    };
  }

  private toDecimalString(value: unknown): string {
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

  private toNullableDecimalString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return this.toDecimalString(value);
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
