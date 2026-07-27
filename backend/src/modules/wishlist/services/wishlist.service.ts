import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AddWishlistItemDto } from '../dto/add-wishlist-item.dto';

import { QueryWishlistDto } from '../dto/query-wishlist.dto';

import { WishlistEventPublisher } from '../events/wishlist.event.publisher';

type WishlistRow = {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

type WishlistItemRow = {
  id: string;
  wishlistId: string;
  productId: string;
  createdAt: Date;
  updatedAt: Date;
};

type CountRow = {
  count: number | bigint;
};

type WishlistProductRow = {
  wishlist_item_id: string;
  wishlist_id: string;
  product_id: string;
  wishlist_created_at: Date;
  wishlist_updated_at: Date;
  product_name: string;
  product_slug: string;
  product_sku: string;
  product_short_description: string | null;
  product_description: string | null;
  price: unknown;
  compare_price: unknown;
  is_active: boolean;
  status: string;
  brand_id: string | null;
  brand_name: string | null;
  brand_slug: string | null;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  average_rating: unknown;
  review_count: number | bigint;
  view_count: number | bigint;
  image_url: string | null;
  image_alt: string | null;
  available_stock: number | bigint | null;
};

type WishlistMergeDto = {
  productIds: string[];
};

type WishlistProductContext = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  is_active: boolean;
  status: string;
};

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: WishlistEventPublisher,
  ) {}

  private readonly wishlistSelect = {
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.WishlistSelect;

  private readonly wishlistItemSelect = {
    id: true,
    wishlistId: true,
    productId: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.WishlistItemSelect;

  async getOrCreateWishlist(
    userId: string,
    actorId?: string,
  ): Promise<WishlistRow> {
    const existing = await this.prisma.wishlist.findUnique({
      where: {
        userId,
      },
      select: this.wishlistSelect,
    });

    if (existing) {
      return existing;
    }

    const wishlist = await this.prisma.wishlist.create({
      data: {
        userId,
      },
      select: this.wishlistSelect,
    });

    this.eventPublisher.publishCreated({
      wishlistId: wishlist.id,
      userId: wishlist.userId,
      actorId,
      occurredAt: new Date(),
    });

    return wishlist;
  }

  async getMyWishlist(
    userId: string,
    query: QueryWishlistDto = {},
  ): Promise<unknown> {
    const wishlist = await this.getOrCreateWishlist(userId, userId);

    return this.hydrateWishlist(wishlist, query);
  }

  async addItem(
    userId: string,
    dto: AddWishlistItemDto,
    actorId?: string,
  ): Promise<unknown> {
    const wishlist = await this.getOrCreateWishlist(userId, actorId ?? userId);

    const product = await this.getProductForWishlist(dto.productId, true);

    this.assertProductCanBeWishlisted(product);

    const existing = await this.prisma.wishlistItem.findFirst({
      where: {
        wishlistId: wishlist.id,
        productId: dto.productId,
      },
      select: this.wishlistItemSelect,
    });

    if (existing) {
      return {
        item: this.mapWishlistItem(existing),
        wishlist: await this.getMyWishlist(userId),
        alreadyExists: true,
      };
    }

    const item = await this.prisma.$transaction(async (tx) => {
      const created = await tx.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          productId: dto.productId,
        },
        select: this.wishlistItemSelect,
      });

      await tx.wishlist.update({
        where: {
          id: wishlist.id,
        },
        data: {
          updatedAt: new Date(),
        },
        select: {
          id: true,
        },
      });

      return created;
    });

    this.eventPublisher.publishItemAdded({
      wishlistId: wishlist.id,
      userId: wishlist.userId,
      wishlistItemId: item.id,
      productId: item.productId,
      actorId: actorId ?? userId,
      occurredAt: new Date(),
    });

    return {
      item: this.mapWishlistItem(item),
      wishlist: await this.getMyWishlist(userId),
      alreadyExists: false,
    };
  }

  async removeItem(
    userId: string,
    wishlistItemId: string,
    actorId?: string,
  ): Promise<unknown> {
    const wishlist = await this.getOrCreateWishlist(userId, actorId ?? userId);

    const item = await this.prisma.wishlistItem.findFirst({
      where: {
        id: wishlistItemId,
        wishlistId: wishlist.id,
      },
      select: this.wishlistItemSelect,
    });

    if (!item) {
      throw new NotFoundException('آیتم علاقه‌مندی یافت نشد.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.wishlistItem.delete({
        where: {
          id: item.id,
        },
      });

      await tx.wishlist.update({
        where: {
          id: wishlist.id,
        },
        data: {
          updatedAt: new Date(),
        },
        select: {
          id: true,
        },
      });
    });

    this.eventPublisher.publishItemRemoved({
      wishlistId: wishlist.id,
      userId: wishlist.userId,
      wishlistItemId: item.id,
      productId: item.productId,
      actorId: actorId ?? userId,
      occurredAt: new Date(),
    });

    return this.getMyWishlist(userId);
  }

  async removeProduct(
    userId: string,
    productId: string,
    actorId?: string,
  ): Promise<unknown> {
    const wishlist = await this.getOrCreateWishlist(userId, actorId ?? userId);

    const item = await this.prisma.wishlistItem.findFirst({
      where: {
        wishlistId: wishlist.id,
        productId,
      },
      select: this.wishlistItemSelect,
    });

    if (!item) {
      throw new NotFoundException('آیتم علاقه‌مندی یافت نشد.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.wishlistItem.delete({
        where: {
          id: item.id,
        },
      });

      await tx.wishlist.update({
        where: {
          id: wishlist.id,
        },
        data: {
          updatedAt: new Date(),
        },
        select: {
          id: true,
        },
      });
    });

    this.eventPublisher.publishItemRemoved({
      wishlistId: wishlist.id,
      userId: wishlist.userId,
      wishlistItemId: item.id,
      productId: item.productId,
      actorId: actorId ?? userId,
      occurredAt: new Date(),
    });

    return this.getMyWishlist(userId);
  }

  async clearWishlist(userId: string, actorId?: string): Promise<unknown> {
    const wishlist = await this.getOrCreateWishlist(userId, actorId ?? userId);

    const deleted = await this.prisma.$transaction(async (tx) => {
      const result = await tx.wishlistItem.deleteMany({
        where: {
          wishlistId: wishlist.id,
        },
      });

      await tx.wishlist.update({
        where: {
          id: wishlist.id,
        },
        data: {
          updatedAt: new Date(),
        },
        select: {
          id: true,
        },
      });

      return result;
    });

    this.eventPublisher.publishCleared({
      wishlistId: wishlist.id,
      userId: wishlist.userId,
      removedItemsCount: deleted.count,
      actorId: actorId ?? userId,
      occurredAt: new Date(),
    });

    return this.getMyWishlist(userId);
  }

  async isProductInWishlist(
    userId: string,
    productId: string,
  ): Promise<unknown> {
    const wishlist = await this.getOrCreateWishlist(userId, userId);

    const item = await this.prisma.wishlistItem.findFirst({
      where: {
        wishlistId: wishlist.id,
        productId,
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      productId,
      inWishlist: Boolean(item),
      wishlistItemId: item?.id ?? null,
      createdAt: item?.createdAt ?? null,
      createdAtFa: formatPersianDateTime(item?.createdAt ?? null),
      updatedAt: item?.updatedAt ?? null,
      updatedAtFa: formatPersianDateTime(item?.updatedAt ?? null),
    };
  }

  async mergeWishlist(
    userId: string,
    dto: WishlistMergeDto,
    actorId?: string,
  ): Promise<unknown> {
    if (!Array.isArray(dto.productIds)) {
      throw new BadRequestException(
        'لیست محصولات برای ادغام علاقه‌مندی‌ها معتبر نیست.',
      );
    }

    const wishlist = await this.getOrCreateWishlist(userId, actorId ?? userId);

    const uniqueProductIds = [
      ...new Set(dto.productIds.map((id) => id.trim()).filter(Boolean)),
    ];

    let mergedItemsCount = 0;

    for (const productId of uniqueProductIds) {
      const product = await this.getProductForWishlist(productId, false);

      if (!product) {
        continue;
      }

      if (product.status !== 'ACTIVE' || product.is_active !== true) {
        continue;
      }

      const existing = await this.prisma.wishlistItem.findFirst({
        where: {
          wishlistId: wishlist.id,
          productId,
        },
        select: {
          id: true,
        },
      });

      if (existing) {
        continue;
      }

      await this.prisma.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          productId,
        },
      });

      mergedItemsCount += 1;
    }

    if (mergedItemsCount > 0) {
      await this.touchWishlist(wishlist.id);
    }

    this.eventPublisher.publishMerged({
      wishlistId: wishlist.id,
      userId: wishlist.userId,
      mergedItemsCount,
      actorId: actorId ?? userId,
      occurredAt: new Date(),
    });

    return this.getMyWishlist(userId);
  }

  private async hydrateWishlist(
    wishlist: WishlistRow,
    query: QueryWishlistDto,
  ): Promise<unknown> {
    const { page, limit, skip } = this.buildPagination(query);

    const whereSql = this.buildWishlistProductWhereSql(wishlist.id, query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<WishlistProductRow[]>(
        Prisma.sql`
            SELECT
              wi."id" AS wishlist_item_id,
              wi."wishlistId" AS wishlist_id,
              wi."productId" AS product_id,
              wi."createdAt" AS wishlist_created_at,
              wi."updatedAt" AS wishlist_updated_at,
              p."name" AS product_name,
              p."slug" AS product_slug,
              p."sku" AS product_sku,
              p."shortDescription" AS product_short_description,
              p."description" AS product_description,
              p."price" AS price,
              p."comparePrice" AS compare_price,
              p."isActive" AS is_active,
              p."status"::text AS status,
              b."id" AS brand_id,
              b."name" AS brand_name,
              b."slug" AS brand_slug,
              c."id" AS category_id,
              c."name" AS category_name,
              c."slug" AS category_slug,
              p."averageRating" AS average_rating,
              p."reviewCount" AS review_count,
              p."viewCount" AS view_count,
              image."url" AS image_url,
              image."altText" AS image_alt,
              COALESCE(stock.available_stock, 0)::int AS available_stock
            FROM "WishlistItem" wi
            INNER JOIN "Product" p ON p."id" = wi."productId"
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
            ORDER BY wi."createdAt" DESC, wi."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),

      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS count
            FROM "WishlistItem" wi
            INNER JOIN "Product" p ON p."id" = wi."productId"
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
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    const totalPages = Math.ceil(total / limit);

    const items = rows.map((row) => this.mapWishlistProductRow(row));

    return {
      id: wishlist.id,
      userId: wishlist.userId,
      items,
      summary: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
      createdAt: wishlist.createdAt,
      createdAtFa: formatPersianDateTime(wishlist.createdAt),
      updatedAt: wishlist.updatedAt,
      updatedAtFa: formatPersianDateTime(wishlist.updatedAt),
    };
  }

  private async getProductForWishlist(
    productId: string,
    throwIfNotFound: boolean,
  ): Promise<WishlistProductContext | null> {
    const rows = await this.prisma.$queryRaw<WishlistProductContext[]>(
      Prisma.sql`
          SELECT
            "id",
            "name",
            "slug",
            "sku",
            "isActive" AS is_active,
            "status"::text AS status
          FROM "Product"
          WHERE "id" = ${productId}
            AND "deleted_at" IS NULL
          LIMIT 1
        `,
    );

    const product = rows[0] ?? null;

    if (!product && throwIfNotFound) {
      throw new NotFoundException('محصول یافت نشد.');
    }

    return product;
  }

  private assertProductCanBeWishlisted(
    product: {
      is_active: boolean;
      status: string;
    } | null,
  ): void {
    if (!product) {
      throw new NotFoundException('محصول یافت نشد.');
    }

    if (product.is_active !== true || product.status !== 'ACTIVE') {
      throw new BadRequestException(
        'این محصول برای افزودن به علاقه‌مندی‌ها در دسترس نیست.',
      );
    }
  }

  private buildWishlistProductWhereSql(
    wishlistId: string,
    query: QueryWishlistDto,
  ): Prisma.Sql {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`wi."wishlistId" = ${wishlistId}`,
      Prisma.sql`p."deleted_at" IS NULL`,
    ];

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

  private mapWishlistProductRow(row: WishlistProductRow) {
    const price = this.toDecimalString(row.price);

    const comparePrice = this.toNullableDecimalString(row.compare_price);

    return {
      id: row.wishlist_item_id,
      wishlistId: row.wishlist_id,
      productId: row.product_id,
      product: {
        id: row.product_id,
        name: row.product_name,
        slug: row.product_slug,
        sku: row.product_sku,
        shortDescription: row.product_short_description,
        description: row.product_description,
        price,
        comparePrice,
        discountPercent: this.calculateDiscountPercent(price, comparePrice),
        isActive: row.is_active,
        status: row.status,
        brand: row.brand_id
          ? {
              id: row.brand_id,
              name: row.brand_name,
              slug: row.brand_slug,
            }
          : null,
        category: row.category_id
          ? {
              id: row.category_id,
              name: row.category_name,
              slug: row.category_slug,
            }
          : null,
        rating: {
          average: this.toNullableDecimalString(row.average_rating),
          count: this.toNumber(row.review_count),
        },
        viewCount: this.toNumber(row.view_count),
        image: row.image_url
          ? {
              url: row.image_url,
              alt: row.image_alt,
            }
          : null,
        inventory: {
          availableStock: this.toNumber(row.available_stock),
          inStock: this.toNumber(row.available_stock) > 0,
        },
      },
      createdAt: row.wishlist_created_at,
      createdAtFa: formatPersianDateTime(row.wishlist_created_at),
      updatedAt: row.wishlist_updated_at,
      updatedAtFa: formatPersianDateTime(row.wishlist_updated_at),
    };
  }

  private mapWishlistItem(item: WishlistItemRow) {
    return {
      id: item.id,
      wishlistId: item.wishlistId,
      productId: item.productId,
      createdAt: item.createdAt,
      createdAtFa: formatPersianDateTime(item.createdAt),
      updatedAt: item.updatedAt,
      updatedAtFa: formatPersianDateTime(item.updatedAt),
    };
  }

  private async touchWishlist(wishlistId: string): Promise<void> {
    await this.prisma.wishlist.update({
      where: {
        id: wishlistId,
      },
      data: {
        updatedAt: new Date(),
      },
      select: {
        id: true,
      },
    });
  }

  private buildPagination(query: QueryWishlistDto) {
    const page = Math.max(1, Number(query.page ?? 1));

    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 24)));

    const skip = (page - 1) * limit;

    return {
      page,
      limit,
      skip,
    };
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

  private toDecimalString(value: unknown): string {
    if (value === null || value === undefined) {
      return '0';
    }

    if (value instanceof Prisma.Decimal) {
      return value.toString();
    }

    switch (typeof value) {
      case 'string':
        return value;
      case 'number':
      case 'bigint':
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

  private toNumber(value: number | bigint | null | undefined): number {
    if (value === null || value === undefined) {
      return 0;
    }

    return Number(value);
  }
}
