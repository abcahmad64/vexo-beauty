import { Injectable } from '@nestjs/common';

import { Prisma, ProductStatus } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { SearchQueryDto } from '../dto/search-query.dto';

import {
  buildPersianLikePattern,
  normalizePersianText,
} from '../utils/persian-normalizer.util';

type PersianProductSearchRow = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  price: Prisma.Decimal | string | number;
  comparePrice: Prisma.Decimal | string | number | null;
  currency: string;
  status: ProductStatus;
  isActive: boolean;
  viewCount: number;
  reviewCount: number;
  averageRating: Prisma.Decimal | string | number | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  brandId: string | null;
  brandName: string | null;
  brandSlug: string | null;
  primaryImageUrl: string | null;
  availableStock: number | bigint | null;
  createdAt: Date;
  updatedAt: Date;
};

type CountRow = {
  count: number | bigint;
};

type SerializedPersianProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  price: string;
  comparePrice: string | null;
  currency: string;
  status: ProductStatus;
  isActive: boolean;
  viewCount: number;
  reviewCount: number;
  averageRating: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  brand: {
    id: string;
    name: string;
    slug: string;
  } | null;
  primaryImageUrl: string | null;
  inventory: {
    availableStock: number;
    inStock: boolean;
  };
  createdAt: string;
  createdAtFa: string | null;
  updatedAt: string;
  updatedAtFa: string | null;
};

type PersianSearchResult = {
  data: SerializedPersianProduct[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
    query: string;
    normalizedQuery: string;
    language: 'fa';
  };
};

@Injectable()
export class PersianSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchProducts(query: SearchQueryDto): Promise<PersianSearchResult> {
    const rawQuery = typeof query.q === 'string' ? query.q : '';

    const normalizedQuery = normalizePersianText(rawQuery);

    const hasSearch = normalizedQuery.length > 0;

    const pattern = hasSearch ? buildPersianLikePattern(normalizedQuery) : '%%';

    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);

    const page = Math.max(Number(query.page ?? 1), 1);

    const offset = (page - 1) * limit;

    const rows = await this.prisma.$queryRaw<PersianProductSearchRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."name",
            p."slug",
            p."sku",
            p."description",
            p."price",
            p."comparePrice",
            'IRR'::text AS "currency",
            p."status",
            p."isActive",
            p."viewCount",
            p."reviewCount",
            p."averageRating",
            p."categoryId",
            c."name" AS "categoryName",
            c."slug" AS "categorySlug",
            p."brandId",
            b."name" AS "brandName",
            b."slug" AS "brandSlug",
            (
              SELECT pi."url"
              FROM "ProductImage" pi
              WHERE pi."productId" = p."id"
              ORDER BY
                pi."isPrimary" DESC,
                pi."sortOrder" ASC,
                pi."createdAt" ASC
              LIMIT 1
            ) AS "primaryImageUrl",
            COALESCE(
              (
                SELECT
                  SUM(
                    GREATEST(
                      i."quantity" - i."reservedQuantity",
                      0
                    )
                  )
                FROM "Inventory" AS i
                INNER JOIN "ProductVariant" AS v
                  ON v."id" = i."variantId"
                WHERE
                  v."productId" = p."id"
                  AND v."deleted_at" IS NULL
                  AND i."deleted_at" IS NULL
              ),
              0
            ) AS "availableStock",
            p."createdAt",
            p."updatedAt"
          FROM "Product" AS p
          LEFT JOIN "Category" AS c
            ON c."id" = p."categoryId"
          LEFT JOIN "Brand" AS b
            ON b."id" = p."brandId"
          WHERE
            p."deleted_at" IS NULL
            AND p."isActive" = true
            AND p."status" = 'ACTIVE'::"ProductStatus"
            AND (
              ${hasSearch}::boolean = false
              OR p."name" ILIKE ${pattern}::text
              OR p."slug" ILIKE ${pattern}::text
              OR p."sku" ILIKE ${pattern}::text
              OR COALESCE(p."description", '') ILIKE ${pattern}::text
              OR COALESCE(c."name", '') ILIKE ${pattern}::text
              OR COALESCE(b."name", '') ILIKE ${pattern}::text
            )
          ORDER BY
            p."isActive" DESC,
            p."updatedAt" DESC,
            p."createdAt" DESC
          LIMIT ${limit}::integer
          OFFSET ${offset}::integer
        `,
    );

    const countRows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::integer AS "count"
          FROM "Product" AS p
          LEFT JOIN "Category" AS c
            ON c."id" = p."categoryId"
          LEFT JOIN "Brand" AS b
            ON b."id" = p."brandId"
          WHERE
            p."deleted_at" IS NULL
            AND p."isActive" = true
            AND p."status" = 'ACTIVE'::"ProductStatus"
            AND (
              ${hasSearch}::boolean = false
              OR p."name" ILIKE ${pattern}::text
              OR p."slug" ILIKE ${pattern}::text
              OR p."sku" ILIKE ${pattern}::text
              OR COALESCE(p."description", '') ILIKE ${pattern}::text
              OR COALESCE(c."name", '') ILIKE ${pattern}::text
              OR COALESCE(b."name", '') ILIKE ${pattern}::text
            )
        `,
    );

    const total = Number(countRows[0]?.count ?? 0);

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return {
      data: rows.map((row) => this.serializeProduct(row)),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
        query: rawQuery,
        normalizedQuery,
        language: 'fa',
      },
    };
  }

  private serializeProduct(
    row: PersianProductSearchRow,
  ): SerializedPersianProduct {
    const availableStock = Number(row.availableStock ?? 0);

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      description: row.description,
      price: this.serializeDecimal(row.price) ?? '0',
      comparePrice: this.serializeDecimal(row.comparePrice),
      currency: row.currency,
      status: row.status,
      isActive: row.isActive,
      viewCount: row.viewCount,
      reviewCount: row.reviewCount,
      averageRating: this.serializeDecimal(row.averageRating),
      category: this.serializeCategory(row),
      brand: this.serializeBrand(row),
      primaryImageUrl: row.primaryImageUrl,
      inventory: {
        availableStock,
        inStock: availableStock > 0,
      },
      createdAt: row.createdAt.toISOString(),
      createdAtFa: formatPersianDateTime(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: formatPersianDateTime(row.updatedAt),
    };
  }

  private serializeCategory(
    row: PersianProductSearchRow,
  ): SerializedPersianProduct['category'] {
    if (!row.categoryId || !row.categoryName || !row.categorySlug) {
      return null;
    }

    return {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug,
    };
  }

  private serializeBrand(
    row: PersianProductSearchRow,
  ): SerializedPersianProduct['brand'] {
    if (!row.brandId || !row.brandName || !row.brandSlug) {
      return null;
    }

    return {
      id: row.brandId,
      name: row.brandName,
      slug: row.brandSlug,
    };
  }

  private serializeDecimal(
    value: Prisma.Decimal | string | number | null,
  ): string | null {
    if (value === null) {
      return null;
    }

    return value.toString();
  }
}
