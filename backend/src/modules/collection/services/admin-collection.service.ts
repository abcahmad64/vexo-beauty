import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminCollectionProductsDto } from '../dto/admin-collection-products.dto';

import { AdminCreateCollectionDto } from '../dto/admin-create-collection.dto';

import { AdminQueryCollectionDto } from '../dto/admin-query-collection.dto';

import { AdminUpdateCollectionDto } from '../dto/admin-update-collection.dto';

type CountRow = {
  count: number | bigint;
};

type CollectionRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  startsAt: Date | null;
  endsAt: Date | null;
  metadata: Prisma.JsonValue | null;
  productCount: number | bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type CollectionProductRow = {
  productId: string;
  productName: string;
  productSlug: string;
  productSku: string;
  productPrice: Prisma.Decimal | number | string;
  productStatus: string;
  productIsActive: boolean;
  productImageUrl: string | null;
  sortOrder: number;
  createdAt: Date;
};

@Injectable()
export class AdminCollectionService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminQueryCollectionDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildCollectionWhere(query, 'c');

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<CollectionRow[]>(
        Prisma.sql`
            SELECT
              c."id",
              c."title",
              c."slug",
              c."description",
              c."imageUrl",
              c."isActive",
              c."sortOrder",
              c."startsAt",
              c."endsAt",
              c."metadata",
              (
                SELECT
                  COUNT(*)::int
                FROM "CollectionProduct" cp
                INNER JOIN "Product" p
                  ON p."id" = cp."productId"
                WHERE
                  cp."collectionId" = c."id"
                  AND p."deleted_at" IS NULL
              ) AS "productCount",
              c."createdAt",
              c."updatedAt",
              c."deleted_at" AS "deletedAt"
            FROM "Collection" c
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolveSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              c."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Collection" c
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapCollection(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(collectionId: string) {
    const collection = await this.findCollectionRow(collectionId, true);

    const products = await this.findCollectionProducts(collectionId);

    return {
      ...this.mapCollection(collection),
      products: products.map((product) => this.mapCollectionProduct(product)),
    };
  }

  async create(dto: AdminCreateCollectionDto, actorId?: string) {
    this.assertValidPeriod(dto.startsAt, dto.endsAt);

    const collectionId = randomUUID();

    const slug = dto.slug ?? this.slugify(dto.title);

    await this.assertSlugUnique(slug);

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Collection" (
          "id",
          "title",
          "slug",
          "description",
          "imageUrl",
          "isActive",
          "sortOrder",
          "startsAt",
          "endsAt",
          "metadata",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${collectionId},
          ${dto.title},
          ${slug},
          ${dto.description ?? null},
          ${dto.imageUrl ?? null},
          ${dto.isActive ?? true},
          ${dto.sortOrder ?? 0},
          ${dto.startsAt ? new Date(dto.startsAt) : null},
          ${dto.endsAt ? new Date(dto.endsAt) : null},
          ${this.toJsonb(dto.metadata)},
          NOW(),
          NOW()
        )
      `,
    );

    return {
      collection: await this.findOne(collectionId),
      audit: {
        actorId: actorId ?? null,
        action: 'collection.admin_created',
      },
    };
  }

  async update(
    collectionId: string,
    dto: AdminUpdateCollectionDto,
    actorId?: string,
  ) {
    await this.findCollectionRow(collectionId, true);

    this.assertValidPeriod(dto.startsAt, dto.endsAt);

    if (dto.slug !== undefined) {
      await this.assertSlugUnique(dto.slug, collectionId);
    }

    const assignments = this.buildUpdateAssignments(dto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی کالکشن ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Collection"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = NOW()
        WHERE
          "id" = ${collectionId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      collection: await this.findOne(collectionId),
      audit: {
        actorId: actorId ?? null,
        action: 'collection.admin_updated',
      },
    };
  }

  async updateProducts(
    collectionId: string,
    dto: AdminCollectionProductsDto,
    actorId?: string,
  ) {
    await this.findCollectionRow(collectionId, true);

    const uniqueItems = this.uniqueProductItems(dto.items);

    await this.assertProductsExist(uniqueItems.map((item) => item.productId));

    await this.prisma.$transaction(async (tx) => {
      if (dto.mode === 'replace') {
        await tx.$executeRaw(
          Prisma.sql`
              DELETE FROM "CollectionProduct"
              WHERE "collectionId" = ${collectionId}
            `,
        );
      }

      if (dto.mode === 'remove') {
        await tx.$executeRaw(
          Prisma.sql`
              DELETE FROM "CollectionProduct"
              WHERE
                "collectionId" = ${collectionId}
                AND "productId" IN (${Prisma.join(
                  uniqueItems.map((item) => item.productId),
                )})
            `,
        );

        return;
      }

      for (const item of uniqueItems) {
        await tx.$executeRaw(
          Prisma.sql`
              INSERT INTO "CollectionProduct" (
                "collectionId",
                "productId",
                "sortOrder",
                "createdAt"
              )
              VALUES (
                ${collectionId},
                ${item.productId},
                ${item.sortOrder ?? 0},
                NOW()
              )
              ON CONFLICT ("collectionId", "productId")
              DO UPDATE SET
                "sortOrder" = EXCLUDED."sortOrder"
            `,
        );
      }
    });

    return {
      collection: await this.findOne(collectionId),
      audit: {
        actorId: actorId ?? null,
        action: `collection.products_${dto.mode}`,
      },
    };
  }

  async activate(collectionId: string, actorId?: string) {
    await this.findCollectionRow(collectionId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Collection"
        SET
          "isActive" = TRUE,
          "updatedAt" = NOW()
        WHERE
          "id" = ${collectionId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      collection: await this.findOne(collectionId),
      audit: {
        actorId: actorId ?? null,
        action: 'collection.admin_activated',
      },
    };
  }

  async deactivate(collectionId: string, actorId?: string) {
    await this.findCollectionRow(collectionId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Collection"
        SET
          "isActive" = FALSE,
          "updatedAt" = NOW()
        WHERE
          "id" = ${collectionId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      collection: await this.findOne(collectionId),
      audit: {
        actorId: actorId ?? null,
        action: 'collection.admin_deactivated',
      },
    };
  }

  async delete(collectionId: string, actorId?: string) {
    await this.findCollectionRow(collectionId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Collection"
        SET
          "deleted_at" = NOW(),
          "isActive" = FALSE,
          "updatedAt" = NOW()
        WHERE
          "id" = ${collectionId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      success: true,
      message: 'کالکشن با موفقیت حذف شد.',
      audit: {
        actorId: actorId ?? null,
        action: 'collection.admin_deleted',
      },
    };
  }

  async findCollectionRow(
    collectionId: string,
    includeDeleted: boolean,
  ): Promise<CollectionRow> {
    const where: Prisma.Sql[] = [Prisma.sql`c."id" = ${collectionId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`c."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<CollectionRow[]>(
      Prisma.sql`
          SELECT
            c."id",
            c."title",
            c."slug",
            c."description",
            c."imageUrl",
            c."isActive",
            c."sortOrder",
            c."startsAt",
            c."endsAt",
            c."metadata",
            (
              SELECT
                COUNT(*)::int
              FROM "CollectionProduct" cp
              INNER JOIN "Product" p
                ON p."id" = cp."productId"
              WHERE
                cp."collectionId" = c."id"
                AND p."deleted_at" IS NULL
            ) AS "productCount",
            c."createdAt",
            c."updatedAt",
            c."deleted_at" AS "deletedAt"
          FROM "Collection" c
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const collection = rows[0];

    if (!collection) {
      throw new NotFoundException('کالکشن موردنظر یافت نشد.');
    }

    return collection;
  }

  private findCollectionProducts(
    collectionId: string,
  ): Promise<CollectionProductRow[]> {
    return this.prisma.$queryRaw<CollectionProductRow[]>(
      Prisma.sql`
        SELECT
          p."id" AS "productId",
          p."name" AS "productName",
          p."slug" AS "productSlug",
          p."sku" AS "productSku",
          p."price" AS "productPrice",
          p."status"::text AS "productStatus",
          p."isActive" AS "productIsActive",
          image."url" AS "productImageUrl",
          cp."sortOrder",
          cp."createdAt"
        FROM "CollectionProduct" cp
        INNER JOIN "Product" p
          ON p."id" = cp."productId"
        LEFT JOIN LATERAL (
          SELECT
            pi."url"
          FROM "ProductImage" pi
          WHERE pi."productId" = p."id"
          ORDER BY
            pi."isPrimary" DESC,
            pi."sortOrder" ASC,
            pi."createdAt" ASC
          LIMIT 1
        ) image ON TRUE
        WHERE
          cp."collectionId" = ${collectionId}
          AND p."deleted_at" IS NULL
        ORDER BY
          cp."sortOrder" ASC,
          cp."createdAt" ASC
      `,
    );
  }

  private buildCollectionWhere(
    query: AdminQueryCollectionDto,
    alias: string,
  ): Prisma.Sql[] {
    const table = Prisma.raw(alias);

    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`${table}."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          ${table}."title" ILIKE ${`%${query.q}%`}
          OR ${table}."slug" ILIKE ${`%${query.q}%`}
          OR ${table}."description" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.isActive !== undefined) {
      where.push(Prisma.sql`${table}."isActive" = ${query.isActive}`);
    }

    if (query.activeNow === true) {
      where.push(
        Prisma.sql`(
          (${table}."startsAt" IS NULL OR ${table}."startsAt" <= NOW())
          AND (${table}."endsAt" IS NULL OR ${table}."endsAt" >= NOW())
        )`,
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

  private buildUpdateAssignments(dto: AdminUpdateCollectionDto): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.title !== undefined) {
      assignments.push(Prisma.sql`"title" = ${dto.title}`);
    }

    if (dto.slug !== undefined) {
      assignments.push(Prisma.sql`"slug" = ${dto.slug}`);
    }

    if (dto.description !== undefined) {
      assignments.push(Prisma.sql`"description" = ${dto.description}`);
    }

    if (dto.imageUrl !== undefined) {
      assignments.push(Prisma.sql`"imageUrl" = ${dto.imageUrl}`);
    }

    if (dto.isActive !== undefined) {
      assignments.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    if (dto.sortOrder !== undefined) {
      assignments.push(Prisma.sql`"sortOrder" = ${dto.sortOrder}`);
    }

    if (dto.startsAt !== undefined) {
      assignments.push(Prisma.sql`"startsAt" = ${new Date(dto.startsAt)}`);
    }

    if (dto.endsAt !== undefined) {
      assignments.push(Prisma.sql`"endsAt" = ${new Date(dto.endsAt)}`);
    }

    if (dto.metadata !== undefined) {
      assignments.push(Prisma.sql`"metadata" = ${this.toJsonb(dto.metadata)}`);
    }

    return assignments;
  }

  private async assertSlugUnique(
    slug: string,
    exceptCollectionId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [Prisma.sql`LOWER("slug") = LOWER(${slug})`];

    if (exceptCollectionId) {
      where.push(Prisma.sql`"id" <> ${exceptCollectionId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Collection"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('اسلاگ کالکشن تکراری است.');
    }
  }

  private async assertProductsExist(productIds: string[]): Promise<void> {
    const uniqueProductIds = Array.from(new Set(productIds));

    if (uniqueProductIds.length === 0) {
      throw new BadRequestException('هیچ محصولی برای کالکشن ارسال نشده است.');
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Product"
          WHERE
            "id" IN (${Prisma.join(uniqueProductIds)})
            AND "deleted_at" IS NULL
        `,
    );

    if (this.toNumber(rows[0]?.count) !== uniqueProductIds.length) {
      throw new BadRequestException('برخی محصولات انتخاب‌شده معتبر نیستند.');
    }
  }

  private assertValidPeriod(startsAt?: string, endsAt?: string): void {
    if (
      startsAt &&
      endsAt &&
      new Date(startsAt).getTime() > new Date(endsAt).getTime()
    ) {
      throw new BadRequestException(
        'زمان شروع کالکشن نمی‌تواند بعد از زمان پایان باشد.',
      );
    }
  }

  private uniqueProductItems(
    items: AdminCollectionProductsDto['items'],
  ): AdminCollectionProductsDto['items'] {
    const map = new Map<string, AdminCollectionProductsDto['items'][number]>();

    for (const item of items) {
      map.set(item.productId, item);
    }

    return Array.from(map.values());
  }

  private mapCollection(row: CollectionRow) {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description,
      imageUrl: row.imageUrl,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      startsAt: row.startsAt ? row.startsAt.toISOString() : null,
      endsAt: row.endsAt ? row.endsAt.toISOString() : null,
      metadata: this.toRecord(row.metadata),
      productCount: this.toNumber(row.productCount),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }

  private mapCollectionProduct(row: CollectionProductRow) {
    return {
      productId: row.productId,
      name: row.productName,
      slug: row.productSlug,
      sku: row.productSku,
      price: this.toDecimalString(row.productPrice),
      status: row.productStatus,
      isActive: row.productIsActive,
      imageUrl: row.productImageUrl,
      sortOrder: row.sortOrder,
      addedAt: row.createdAt.toISOString(),
    };
  }

  private resolveSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`c."updatedAt"`;
    }

    if (sortBy === 'title') {
      return Prisma.sql`c."title"`;
    }

    if (sortBy === 'slug') {
      return Prisma.sql`c."slug"`;
    }

    if (sortBy === 'sortOrder') {
      return Prisma.sql`c."sortOrder"`;
    }

    if (sortBy === 'productCount') {
      return Prisma.sql`"productCount"`;
    }

    if (sortBy === 'isActive') {
      return Prisma.sql`c."isActive"`;
    }

    if (sortBy === 'startsAt') {
      return Prisma.sql`c."startsAt"`;
    }

    if (sortBy === 'endsAt') {
      return Prisma.sql`c."endsAt"`;
    }

    return Prisma.sql`c."createdAt"`;
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

  private toJsonb(value?: Record<string, unknown>): Prisma.Sql {
    if (value === undefined) {
      return Prisma.sql`NULL`;
    }

    return Prisma.sql`${JSON.stringify(value)}::jsonb`;
  }

  private toRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }

    return {};
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

  private toNumber(value: unknown): number {
    if (value === undefined || value === null) {
      return 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    return Number(value);
  }

  private toDecimalString(value: Prisma.Decimal | number | string): string {
    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    return new Prisma.Decimal(value).toFixed(2);
  }
}
