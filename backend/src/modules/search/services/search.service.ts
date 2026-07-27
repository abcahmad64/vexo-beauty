import { Injectable } from '@nestjs/common';

import { Prisma, ProductStatus } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { SearchQueryDto } from '../dto/search-query.dto';

import { SearchSuggestionDto } from '../dto/search-suggestion.dto';

import { SearchEventPublisher } from '../events/search.event.publisher';

type CountRow = {
  count: number;
};

type ProductSearchRow = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  price: Prisma.Decimal;
  comparePrice: Prisma.Decimal | null;
  currency: string;
  status: ProductStatus;
  isActive: boolean;
  viewCount: number;
  reviewCount: number;
  averageRating: Prisma.Decimal | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  brandId: string | null;
  brandName: string | null;
  brandSlug: string | null;
  primaryImageUrl: string | null;
  availableStock: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type CategorySearchRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type BrandSearchRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  isActive: boolean;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type SuggestionRow = {
  id: string;
  type: 'product' | 'category' | 'brand';
  label: string;
  slug: string | null;
  sku: string | null;
  imageUrl: string | null;
};

type PaginatedResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

type SearchOptions = {
  actorId?: string;
  userId?: string;
  admin?: boolean;
};

@Injectable()
export class SearchService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: SearchEventPublisher,
  ) {}

  async searchProducts(
    query: SearchQueryDto,
    options: SearchOptions = {},
  ): Promise<PaginatedResponse<unknown>> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const offset = (page - 1) * limit;

    const where = this.buildProductWhere(query, options.admin === true);

    const orderBy = this.buildProductOrderBy(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<ProductSearchRow[]>(
        Prisma.sql`
            ${this.productSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ${orderBy}
            LIMIT ${limit}
            OFFSET ${offset}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Product" p
            LEFT JOIN "Category" c
              ON c."id" = p."categoryId"
            LEFT JOIN "Brand" b
              ON b."id" = p."brandId"
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = countRows[0]?.count ?? 0;

    this.events.publishSearchPerformed({
      query: query.q ?? null,
      scope: options.admin === true ? 'admin_products' : 'products',
      filters: this.safeFilters(query),
      resultCount: total,
      userId: options.userId,
      actorId: options.actorId,
      occurredAt: new Date(),
    });

    return {
      data: rows.map((row) => this.mapProduct(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrevious: page > 1,
      },
    };
  }

  async searchCategories(
    query: SearchQueryDto,
    options: SearchOptions = {},
  ): Promise<PaginatedResponse<unknown>> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const offset = (page - 1) * limit;

    const where = this.buildCategoryWhere(query, options.admin === true);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<CategorySearchRow[]>(
        Prisma.sql`
            SELECT
              c."id",
              c."name",
              c."slug",
              c."description",
              c."image",
              c."parent_id" AS "parentId",
              c."isActive",
              c."sortOrder",
              (
                SELECT
                  COUNT(*)::int
                FROM "Product" p
                WHERE
                  p."categoryId" = c."id"
                  AND p."deleted_at" IS NULL
              ) AS "productCount",
              c."createdAt",
              c."updatedAt",
              c."deleted_at" AS "deletedAt"
            FROM "Category" c
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              c."sortOrder" ASC,
              c."name" ASC
            LIMIT ${limit}
            OFFSET ${offset}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Category" c
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = countRows[0]?.count ?? 0;

    this.events.publishSearchPerformed({
      query: query.q ?? null,
      scope: 'categories',
      filters: this.safeFilters(query),
      resultCount: total,
      userId: options.userId,
      actorId: options.actorId,
      occurredAt: new Date(),
    });

    return {
      data: rows.map((row) => this.mapCategory(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrevious: page > 1,
      },
    };
  }

  async searchBrands(
    query: SearchQueryDto,
    options: SearchOptions = {},
  ): Promise<PaginatedResponse<unknown>> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const offset = (page - 1) * limit;

    const where = this.buildBrandWhere(query, options.admin === true);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<BrandSearchRow[]>(
        Prisma.sql`
            SELECT
              b."id",
              b."name",
              b."slug",
              b."description",
              b."logoUrl",
              b."website",
              b."isActive",
              (
                SELECT
                  COUNT(*)::int
                FROM "Product" p
                WHERE
                  p."brandId" = b."id"
                  AND p."deleted_at" IS NULL
              ) AS "productCount",
              b."createdAt",
              b."updatedAt",
              b."deleted_at" AS "deletedAt"
            FROM "Brand" b
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              b."name" ASC
            LIMIT ${limit}
            OFFSET ${offset}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Brand" b
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = countRows[0]?.count ?? 0;

    this.events.publishSearchPerformed({
      query: query.q ?? null,
      scope: 'brands',
      filters: this.safeFilters(query),
      resultCount: total,
      userId: options.userId,
      actorId: options.actorId,
      occurredAt: new Date(),
    });

    return {
      data: rows.map((row) => this.mapBrand(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrevious: page > 1,
      },
    };
  }

  async globalSearch(query: SearchQueryDto, options: SearchOptions = {}) {
    const productLimit = Math.min(this.normalizeLimit(query.limit), 12);

    const scopedQuery = {
      ...query,
      page: 1,
      limit: productLimit,
    };

    const [products, categories, brands] = await Promise.all([
      this.searchProducts(scopedQuery, options),
      this.searchCategories(scopedQuery, options),
      this.searchBrands(scopedQuery, options),
    ]);

    const resultCount =
      products.meta.total + categories.meta.total + brands.meta.total;

    this.events.publishSearchPerformed({
      query: query.q ?? null,
      scope: options.admin === true ? 'admin_global' : 'global',
      filters: this.safeFilters(query),
      resultCount,
      userId: options.userId,
      actorId: options.actorId,
      occurredAt: new Date(),
    });

    return {
      products,
      categories,
      brands,
      meta: {
        total: resultCount,
      },
    };
  }

  async suggestions(query: SearchSuggestionDto, options: SearchOptions = {}) {
    const q = query.q?.trim();

    if (!q) {
      return {
        data: [],
      };
    }

    const limit = Math.min(Math.max(query.limit ?? 10, 1), 20);

    const rows = await this.prisma.$queryRaw<SuggestionRow[]>(
      Prisma.sql`
          (
            SELECT
              p."id",
              'product'::text AS "type",
              p."name" AS "label",
              p."slug",
              p."sku",
              (
                SELECT pi."url"
                FROM "ProductImage" pi
                WHERE pi."productId" = p."id"
                ORDER BY
                  pi."isPrimary" DESC,
                  pi."sortOrder" ASC,
                  pi."createdAt" ASC
                LIMIT 1
              ) AS "imageUrl"
            FROM "Product" p
            WHERE
              p."deleted_at" IS NULL
              AND p."isActive" = TRUE
              AND p."status" = 'ACTIVE'::"ProductStatus"
              AND (
                p."name" ILIKE ${`%${q}%`}
                OR p."sku" ILIKE ${`%${q}%`}
              )
            ORDER BY
              CASE
                WHEN p."name" ILIKE ${`${q}%`} THEN 0
                WHEN p."sku" ILIKE ${`${q}%`} THEN 1
                ELSE 2
              END,
              p."viewCount" DESC
            LIMIT ${limit}
          )
          UNION ALL
          (
            SELECT
              c."id",
              'category'::text AS "type",
              c."name" AS "label",
              c."slug",
              NULL::text AS "sku",
              c."image" AS "imageUrl"
            FROM "Category" c
            WHERE
              c."deleted_at" IS NULL
              AND c."isActive" = TRUE
              AND (
                c."name" ILIKE ${`%${q}%`}
                OR c."slug" ILIKE ${`%${q}%`}
              )
            ORDER BY
              c."sortOrder" ASC,
              c."name" ASC
            LIMIT ${limit}
          )
          UNION ALL
          (
            SELECT
              b."id",
              'brand'::text AS "type",
              b."name" AS "label",
              b."slug",
              NULL::text AS "sku",
              b."logoUrl" AS "imageUrl"
            FROM "Brand" b
            WHERE
              b."deleted_at" IS NULL
              AND b."isActive" = TRUE
              AND (
                b."name" ILIKE ${`%${q}%`}
                OR b."slug" ILIKE ${`%${q}%`}
              )
            ORDER BY
              b."name" ASC
            LIMIT ${limit}
          )
          LIMIT ${limit}
        `,
    );

    this.events.publishSearchSuggestionsGenerated({
      query: q,
      resultCount: rows.length,
      userId: options.userId,
      actorId: options.actorId,
      occurredAt: new Date(),
    });

    return {
      data: rows,
    };
  }

  private productSelectSql(): Prisma.Sql {
    return Prisma.sql`
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
        (
          SELECT
            COALESCE(SUM(i."quantity" - i."reservedQuantity"), 0)::int
          FROM "ProductVariant" v
          LEFT JOIN "Inventory" i
            ON i."variantId" = v."id"
            AND i."deleted_at" IS NULL
          WHERE
            v."productId" = p."id"
            AND v."deleted_at" IS NULL
        ) AS "availableStock",
        p."createdAt",
        p."updatedAt",
        p."deleted_at" AS "deletedAt"
      FROM "Product" p
      LEFT JOIN "Category" c
        ON c."id" = p."categoryId"
      LEFT JOIN "Brand" b
        ON b."id" = p."brandId"
    `;
  }

  private buildProductWhere(
    query: SearchQueryDto,
    admin: boolean,
  ): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (admin && query.includeDeleted) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(Prisma.sql`p."deleted_at" IS NULL`);
    }

    if (!admin || !query.includeInactive) {
      where.push(Prisma.sql`p."isActive" = TRUE`);
    }

    if (!admin) {
      where.push(Prisma.sql`p."status" = 'ACTIVE'::"ProductStatus"`);
    }

    if (admin && query.status) {
      where.push(Prisma.sql`p."status" = ${query.status}::"ProductStatus"`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`
          (
            p."name" ILIKE ${`%${query.q}%`}
            OR p."sku" ILIKE ${`%${query.q}%`}
            OR p."description" ILIKE ${`%${query.q}%`}
            OR c."name" ILIKE ${`%${query.q}%`}
            OR b."name" ILIKE ${`%${query.q}%`}
            OR EXISTS (
              SELECT 1
              FROM "ProductVariant" v
              WHERE
                v."productId" = p."id"
                AND v."deleted_at" IS NULL
                AND (
                  v."sku" ILIKE ${`%${query.q}%`}
                  OR v."name" ILIKE ${`%${query.q}%`}
                )
            )
          )
        `,
      );
    }

    if (query.productId) {
      where.push(Prisma.sql`p."id" = ${query.productId}`);
    }

    if (query.categoryId) {
      where.push(Prisma.sql`p."categoryId" = ${query.categoryId}`);
    }

    if (query.categorySlug) {
      where.push(Prisma.sql`c."slug" = ${query.categorySlug}`);
    }

    if (query.brandId) {
      where.push(Prisma.sql`p."brandId" = ${query.brandId}`);
    }

    if (query.brandSlug) {
      where.push(Prisma.sql`b."slug" = ${query.brandSlug}`);
    }

    if (query.minPrice) {
      where.push(
        Prisma.sql`p."price" >= ${new Prisma.Decimal(query.minPrice)}`,
      );
    }

    if (query.maxPrice) {
      where.push(
        Prisma.sql`p."price" <= ${new Prisma.Decimal(query.maxPrice)}`,
      );
    }

    if (query.hasDiscount === true) {
      where.push(
        Prisma.sql`
          p."comparePrice" IS NOT NULL
          AND p."comparePrice" > p."price"
        `,
      );
    }

    if (query.hasDiscount === false) {
      where.push(
        Prisma.sql`
          (
            p."comparePrice" IS NULL
            OR p."comparePrice" <= p."price"
          )
        `,
      );
    }

    if (query.inStock === true) {
      where.push(
        Prisma.sql`
          (
            SELECT
              COALESCE(SUM(i."quantity" - i."reservedQuantity"), 0)::int
            FROM "ProductVariant" v
            LEFT JOIN "Inventory" i
              ON i."variantId" = v."id"
              AND i."deleted_at" IS NULL
            WHERE
              v."productId" = p."id"
              AND v."deleted_at" IS NULL
          ) > 0
        `,
      );
    }

    if (query.inStock === false) {
      where.push(
        Prisma.sql`
          (
            SELECT
              COALESCE(SUM(i."quantity" - i."reservedQuantity"), 0)::int
            FROM "ProductVariant" v
            LEFT JOIN "Inventory" i
              ON i."variantId" = v."id"
              AND i."deleted_at" IS NULL
            WHERE
              v."productId" = p."id"
              AND v."deleted_at" IS NULL
          ) <= 0
        `,
      );
    }

    return where;
  }

  private buildCategoryWhere(
    query: SearchQueryDto,
    admin: boolean,
  ): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (admin && query.includeDeleted) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(Prisma.sql`c."deleted_at" IS NULL`);
    }

    if (!admin || !query.includeInactive) {
      where.push(Prisma.sql`c."isActive" = TRUE`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`
          (
            c."name" ILIKE ${`%${query.q}%`}
            OR c."slug" ILIKE ${`%${query.q}%`}
            OR c."description" ILIKE ${`%${query.q}%`}
          )
        `,
      );
    }

    if (query.categoryId) {
      where.push(Prisma.sql`c."id" = ${query.categoryId}`);
    }

    if (query.categorySlug) {
      where.push(Prisma.sql`c."slug" = ${query.categorySlug}`);
    }

    return where;
  }

  private buildBrandWhere(query: SearchQueryDto, admin: boolean): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (admin && query.includeDeleted) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(Prisma.sql`b."deleted_at" IS NULL`);
    }

    if (!admin || !query.includeInactive) {
      where.push(Prisma.sql`b."isActive" = TRUE`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`
          (
            b."name" ILIKE ${`%${query.q}%`}
            OR b."slug" ILIKE ${`%${query.q}%`}
            OR b."description" ILIKE ${`%${query.q}%`}
          )
        `,
      );
    }

    if (query.brandId) {
      where.push(Prisma.sql`b."id" = ${query.brandId}`);
    }

    if (query.brandSlug) {
      where.push(Prisma.sql`b."slug" = ${query.brandSlug}`);
    }

    return where;
  }

  private buildProductOrderBy(query: SearchQueryDto): Prisma.Sql {
    if (query.sortBy === 'price_asc') {
      return Prisma.sql`ORDER BY p."price" ASC`;
    }

    if (query.sortBy === 'price_desc') {
      return Prisma.sql`ORDER BY p."price" DESC`;
    }

    if (query.sortBy === 'name_asc') {
      return Prisma.sql`ORDER BY p."name" ASC`;
    }

    if (query.sortBy === 'name_desc') {
      return Prisma.sql`ORDER BY p."name" DESC`;
    }

    if (query.sortBy === 'oldest') {
      return Prisma.sql`ORDER BY p."createdAt" ASC`;
    }

    if (query.sortBy === 'rating') {
      return Prisma.sql`
        ORDER BY
          p."averageRating" DESC NULLS LAST,
          p."reviewCount" DESC
      `;
    }

    if (query.sortBy === 'views') {
      return Prisma.sql`
        ORDER BY
          p."viewCount" DESC,
          p."updatedAt" DESC
      `;
    }

    if (query.q) {
      return Prisma.sql`
        ORDER BY
          CASE
            WHEN p."name" ILIKE ${`${query.q}%`} THEN 0
            WHEN p."sku" ILIKE ${`${query.q}%`} THEN 1
            WHEN c."name" ILIKE ${`${query.q}%`} THEN 2
            WHEN b."name" ILIKE ${`${query.q}%`} THEN 3
            ELSE 4
          END ASC,
          p."viewCount" DESC,
          p."updatedAt" DESC
      `;
    }

    return Prisma.sql`
      ORDER BY
        p."createdAt" DESC
    `;
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

  private toDecimalString(
    value: Prisma.Decimal | number | string | null,
  ): string {
    if (value === null) {
      return '0.00';
    }

    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    return new Prisma.Decimal(value).toFixed(2);
  }

  private mapProduct(row: ProductSearchRow) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      description: row.description,
      price: this.toDecimalString(row.price),
      comparePrice: row.comparePrice
        ? this.toDecimalString(row.comparePrice)
        : null,
      currency: row.currency,
      status: row.status,
      isActive: row.isActive,
      viewCount: row.viewCount,
      reviewCount: row.reviewCount,
      averageRating: row.averageRating
        ? this.toDecimalString(row.averageRating)
        : '0.00',
      primaryImageUrl: row.primaryImageUrl,
      availableStock: row.availableStock,
      category: {
        id: row.categoryId,
        name: row.categoryName,
        slug: row.categorySlug,
      },
      brand: {
        id: row.brandId,
        name: row.brandName,
        slug: row.brandSlug,
      },
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDateTime(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTime(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: this.formatDateTime(row.deletedAt),
    };
  }

  private mapCategory(row: CategorySearchRow) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      image: row.image,
      parentId: row.parentId,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      productCount: row.productCount,
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDateTime(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTime(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: this.formatDateTime(row.deletedAt),
    };
  }

  private mapBrand(row: BrandSearchRow) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      logoUrl: row.logoUrl,
      website: row.website,
      isActive: row.isActive,
      productCount: row.productCount,
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDateTime(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTime(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: this.formatDateTime(row.deletedAt),
    };
  }

  private formatDateTime(value: Date | null | undefined): string | null {
    return formatPersianDateTime(value ?? null);
  }

  private safeFilters(query: SearchQueryDto): Record<string, unknown> {
    return {
      categoryId: query.categoryId,
      categorySlug: query.categorySlug,
      brandId: query.brandId,
      brandSlug: query.brandSlug,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      inStock: query.inStock,
      hasDiscount: query.hasDiscount,
      status: query.status,
      sortBy: query.sortBy,
      page: query.page,
      limit: query.limit,
      includeInactive: query.includeInactive,
      includeDeleted: query.includeDeleted,
    };
  }
}
