import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminCreateHomeSectionDto } from '../dto/admin-create-home-section.dto';

import { AdminQueryHomeSectionDto } from '../dto/admin-query-home-section.dto';

import {
  AdminHomeSectionProductsDto,
  AdminReorderHomeSectionDto,
} from '../dto/admin-reorder-home-section.dto';

import { AdminUpdateHomeSectionDto } from '../dto/admin-update-home-section.dto';

type CountRow = {
  count: number | bigint;
};

type HomeSectionRow = {
  id: string;
  sectionKey: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  sectionType: string;
  sourceType: string;
  sourceConfig: Prisma.JsonValue | null;
  imageUrl: string | null;
  actionLabel: string | null;
  actionUrl: string | null;
  displayMode: string;
  maxItems: number;
  isActive: boolean;
  isCurrentlyVisible: boolean;
  sortOrder: number;
  startsAt: Date | null;
  endsAt: Date | null;
  metadata: Prisma.JsonValue | null;
  productCount: number | bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type HomeSectionProductRow = {
  productId: string;
  productName: string;
  productSlug: string;
  productSku: string;
  productPrice: Prisma.Decimal | number | string;
  productStatus: string;
  productIsActive: boolean;
  imageUrl: string | null;
  sortOrder: number;
  isPinned: boolean;
  createdAt: Date;
};

@Injectable()
export class AdminHomeSectionService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminQueryHomeSectionDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildHomeSectionWhere(query, 'hs');

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<HomeSectionRow[]>(
        Prisma.sql`
            SELECT
              hs."id",
              hs."sectionKey",
              hs."title",
              hs."slug",
              hs."subtitle",
              hs."description",
              hs."sectionType",
              hs."sourceType",
              hs."sourceConfig",
              hs."imageUrl",
              hs."actionLabel",
              hs."actionUrl",
              hs."displayMode",
              hs."maxItems",
              hs."isActive",
              (
                hs."isActive" = TRUE
                AND (hs."startsAt" IS NULL OR hs."startsAt" <= NOW())
                AND (hs."endsAt" IS NULL OR hs."endsAt" >= NOW())
              ) AS "isCurrentlyVisible",
              hs."sortOrder",
              hs."startsAt",
              hs."endsAt",
              hs."metadata",
              (
                SELECT
                  COUNT(*)::int
                FROM "HomeSectionProduct" hsp
                INNER JOIN "Product" p
                  ON p."id" = hsp."productId"
                WHERE
                  hsp."sectionId" = hs."id"
                  AND p."deleted_at" IS NULL
              ) AS "productCount",
              hs."createdAt",
              hs."updatedAt",
              hs."deleted_at" AS "deletedAt"
            FROM "HomeSection" hs
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolveSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              hs."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "HomeSection" hs
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapHomeSection(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(sectionId: string) {
    const section = await this.findHomeSectionRow(sectionId, true);

    const products = await this.findSectionProducts(sectionId);

    return {
      ...this.mapHomeSection(section),
      products: products.map((product) => this.mapHomeSectionProduct(product)),
    };
  }

  async create(dto: AdminCreateHomeSectionDto, actorId?: string) {
    this.assertValidPeriod(dto.startsAt, dto.endsAt);

    const sectionId = randomUUID();

    const sectionKey = dto.sectionKey ?? this.keyify(dto.title);

    const slug = dto.slug ?? this.slugify(dto.title);

    await this.assertSectionKeyUnique(sectionKey);

    await this.assertSlugUnique(slug);

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "HomeSection" (
          "id",
          "sectionKey",
          "title",
          "slug",
          "subtitle",
          "description",
          "sectionType",
          "sourceType",
          "sourceConfig",
          "imageUrl",
          "actionLabel",
          "actionUrl",
          "displayMode",
          "maxItems",
          "isActive",
          "sortOrder",
          "startsAt",
          "endsAt",
          "metadata",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${sectionId},
          ${sectionKey},
          ${dto.title},
          ${slug},
          ${dto.subtitle ?? null},
          ${dto.description ?? null},
          ${dto.sectionType},
          ${dto.sourceType},
          ${this.toJsonb(dto.sourceConfig)},
          ${dto.imageUrl ?? null},
          ${dto.actionLabel ?? null},
          ${dto.actionUrl ?? null},
          ${dto.displayMode ?? 'grid'},
          ${dto.maxItems ?? 8},
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
      section: await this.findOne(sectionId),
      audit: {
        actorId: actorId ?? null,
        action: 'home_section.admin_created',
      },
    };
  }

  async update(
    sectionId: string,
    dto: AdminUpdateHomeSectionDto,
    actorId?: string,
  ) {
    await this.findHomeSectionRow(sectionId, true);

    this.assertValidPeriod(dto.startsAt, dto.endsAt);

    if (dto.sectionKey !== undefined) {
      await this.assertSectionKeyUnique(dto.sectionKey, sectionId);
    }

    if (dto.slug !== undefined) {
      await this.assertSlugUnique(dto.slug, sectionId);
    }

    const assignments = this.buildUpdateAssignments(dto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی سکشن صفحه اصلی ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "HomeSection"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = NOW()
        WHERE
          "id" = ${sectionId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      section: await this.findOne(sectionId),
      audit: {
        actorId: actorId ?? null,
        action: 'home_section.admin_updated',
      },
    };
  }

  async reorder(dto: AdminReorderHomeSectionDto, actorId?: string) {
    const sectionIds = Array.from(
      new Set(dto.items.map((item) => item.sectionId)),
    );

    if (sectionIds.length !== dto.items.length) {
      throw new BadRequestException('شناسه سکشن در لیست مرتب‌سازی تکراری است.');
    }

    await this.assertSectionsExist(sectionIds);

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        await tx.$executeRaw(
          Prisma.sql`
              UPDATE "HomeSection"
              SET
                "sortOrder" = ${item.sortOrder},
                "updatedAt" = NOW()
              WHERE
                "id" = ${item.sectionId}
                AND "deleted_at" IS NULL
            `,
        );
      }
    });

    return {
      success: true,
      updatedCount: dto.items.length,
      audit: {
        actorId: actorId ?? null,
        action: 'home_section.admin_reordered',
      },
    };
  }

  async replaceProducts(
    sectionId: string,
    dto: AdminHomeSectionProductsDto,
    actorId?: string,
  ) {
    await this.findHomeSectionRow(sectionId, true);

    const uniqueItems = this.uniqueProductItems(dto.items);

    await this.assertProductsExist(uniqueItems.map((item) => item.productId));

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
            DELETE FROM "HomeSectionProduct"
            WHERE "sectionId" = ${sectionId}
          `,
      );

      for (const item of uniqueItems) {
        await tx.$executeRaw(
          Prisma.sql`
              INSERT INTO "HomeSectionProduct" (
                "sectionId",
                "productId",
                "sortOrder",
                "isPinned",
                "createdAt"
              )
              VALUES (
                ${sectionId},
                ${item.productId},
                ${item.sortOrder ?? 0},
                ${item.isPinned ?? false},
                NOW()
              )
            `,
        );
      }
    });

    return {
      section: await this.findOne(sectionId),
      audit: {
        actorId: actorId ?? null,
        action: 'home_section.products_replaced',
      },
    };
  }

  async addProducts(
    sectionId: string,
    dto: AdminHomeSectionProductsDto,
    actorId?: string,
  ) {
    await this.findHomeSectionRow(sectionId, true);

    const uniqueItems = this.uniqueProductItems(dto.items);

    await this.assertProductsExist(uniqueItems.map((item) => item.productId));

    await this.prisma.$transaction(async (tx) => {
      for (const item of uniqueItems) {
        await tx.$executeRaw(
          Prisma.sql`
              INSERT INTO "HomeSectionProduct" (
                "sectionId",
                "productId",
                "sortOrder",
                "isPinned",
                "createdAt"
              )
              VALUES (
                ${sectionId},
                ${item.productId},
                ${item.sortOrder ?? 0},
                ${item.isPinned ?? false},
                NOW()
              )
              ON CONFLICT ("sectionId", "productId")
              DO UPDATE SET
                "sortOrder" = EXCLUDED."sortOrder",
                "isPinned" = EXCLUDED."isPinned"
            `,
        );
      }
    });

    return {
      section: await this.findOne(sectionId),
      audit: {
        actorId: actorId ?? null,
        action: 'home_section.products_added',
      },
    };
  }

  async removeProducts(
    sectionId: string,
    dto: AdminHomeSectionProductsDto,
    actorId?: string,
  ) {
    await this.findHomeSectionRow(sectionId, true);

    const productIds = Array.from(
      new Set(dto.items.map((item) => item.productId)),
    );

    await this.prisma.$executeRaw(
      Prisma.sql`
        DELETE FROM "HomeSectionProduct"
        WHERE
          "sectionId" = ${sectionId}
          AND "productId" IN (${Prisma.join(productIds)})
      `,
    );

    return {
      section: await this.findOne(sectionId),
      audit: {
        actorId: actorId ?? null,
        action: 'home_section.products_removed',
      },
    };
  }

  async activate(sectionId: string, actorId?: string) {
    await this.findHomeSectionRow(sectionId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "HomeSection"
        SET
          "isActive" = TRUE,
          "updatedAt" = NOW()
        WHERE
          "id" = ${sectionId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      section: await this.findOne(sectionId),
      audit: {
        actorId: actorId ?? null,
        action: 'home_section.admin_activated',
      },
    };
  }

  async deactivate(sectionId: string, actorId?: string) {
    await this.findHomeSectionRow(sectionId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "HomeSection"
        SET
          "isActive" = FALSE,
          "updatedAt" = NOW()
        WHERE
          "id" = ${sectionId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      section: await this.findOne(sectionId),
      audit: {
        actorId: actorId ?? null,
        action: 'home_section.admin_deactivated',
      },
    };
  }

  async delete(sectionId: string, actorId?: string) {
    await this.findHomeSectionRow(sectionId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "HomeSection"
        SET
          "deleted_at" = NOW(),
          "isActive" = FALSE,
          "updatedAt" = NOW()
        WHERE
          "id" = ${sectionId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      success: true,
      message: 'سکشن صفحه اصلی با موفقیت حذف شد.',
      audit: {
        actorId: actorId ?? null,
        action: 'home_section.admin_deleted',
      },
    };
  }

  async findHomeSectionRow(
    sectionId: string,
    includeDeleted: boolean,
  ): Promise<HomeSectionRow> {
    const where: Prisma.Sql[] = [Prisma.sql`hs."id" = ${sectionId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`hs."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<HomeSectionRow[]>(
      Prisma.sql`
          SELECT
            hs."id",
            hs."sectionKey",
            hs."title",
            hs."slug",
            hs."subtitle",
            hs."description",
            hs."sectionType",
            hs."sourceType",
            hs."sourceConfig",
            hs."imageUrl",
            hs."actionLabel",
            hs."actionUrl",
            hs."displayMode",
            hs."maxItems",
            hs."isActive",
            (
              hs."isActive" = TRUE
              AND (hs."startsAt" IS NULL OR hs."startsAt" <= NOW())
              AND (hs."endsAt" IS NULL OR hs."endsAt" >= NOW())
            ) AS "isCurrentlyVisible",
            hs."sortOrder",
            hs."startsAt",
            hs."endsAt",
            hs."metadata",
            (
              SELECT
                COUNT(*)::int
              FROM "HomeSectionProduct" hsp
              INNER JOIN "Product" p
                ON p."id" = hsp."productId"
              WHERE
                hsp."sectionId" = hs."id"
                AND p."deleted_at" IS NULL
            ) AS "productCount",
            hs."createdAt",
            hs."updatedAt",
            hs."deleted_at" AS "deletedAt"
          FROM "HomeSection" hs
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const section = rows[0];

    if (!section) {
      throw new NotFoundException('سکشن صفحه اصلی موردنظر یافت نشد.');
    }

    return section;
  }

  private findSectionProducts(
    sectionId: string,
  ): Promise<HomeSectionProductRow[]> {
    return this.prisma.$queryRaw<HomeSectionProductRow[]>(
      Prisma.sql`
        SELECT
          p."id" AS "productId",
          p."name" AS "productName",
          p."slug" AS "productSlug",
          p."sku" AS "productSku",
          p."price" AS "productPrice",
          p."status"::text AS "productStatus",
          p."isActive" AS "productIsActive",
          image."url" AS "imageUrl",
          hsp."sortOrder",
          hsp."isPinned",
          hsp."createdAt"
        FROM "HomeSectionProduct" hsp
        INNER JOIN "Product" p
          ON p."id" = hsp."productId"
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
          hsp."sectionId" = ${sectionId}
          AND p."deleted_at" IS NULL
        ORDER BY
          hsp."isPinned" DESC,
          hsp."sortOrder" ASC,
          hsp."createdAt" ASC
      `,
    );
  }

  private buildHomeSectionWhere(
    query: AdminQueryHomeSectionDto,
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
          OR ${table}."sectionKey" ILIKE ${`%${query.q}%`}
          OR ${table}."subtitle" ILIKE ${`%${query.q}%`}
          OR ${table}."description" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.sectionKey) {
      where.push(Prisma.sql`${table}."sectionKey" = ${query.sectionKey}`);
    }

    if (query.sectionType) {
      where.push(Prisma.sql`${table}."sectionType" = ${query.sectionType}`);
    }

    if (query.sourceType) {
      where.push(Prisma.sql`${table}."sourceType" = ${query.sourceType}`);
    }

    if (query.isActive !== undefined) {
      where.push(Prisma.sql`${table}."isActive" = ${query.isActive}`);
    }

    if (query.activeNow === true) {
      where.push(
        Prisma.sql`(
          ${table}."isActive" = TRUE
          AND (${table}."startsAt" IS NULL OR ${table}."startsAt" <= NOW())
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

  private buildUpdateAssignments(dto: AdminUpdateHomeSectionDto): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.sectionKey !== undefined) {
      assignments.push(Prisma.sql`"sectionKey" = ${dto.sectionKey}`);
    }

    if (dto.title !== undefined) {
      assignments.push(Prisma.sql`"title" = ${dto.title}`);
    }

    if (dto.slug !== undefined) {
      assignments.push(Prisma.sql`"slug" = ${dto.slug}`);
    }

    if (dto.subtitle !== undefined) {
      assignments.push(Prisma.sql`"subtitle" = ${dto.subtitle}`);
    }

    if (dto.description !== undefined) {
      assignments.push(Prisma.sql`"description" = ${dto.description}`);
    }

    if (dto.sectionType !== undefined) {
      assignments.push(Prisma.sql`"sectionType" = ${dto.sectionType}`);
    }

    if (dto.sourceType !== undefined) {
      assignments.push(Prisma.sql`"sourceType" = ${dto.sourceType}`);
    }

    if (dto.sourceConfig !== undefined) {
      assignments.push(
        Prisma.sql`"sourceConfig" = ${this.toJsonb(dto.sourceConfig)}`,
      );
    }

    if (dto.imageUrl !== undefined) {
      assignments.push(Prisma.sql`"imageUrl" = ${dto.imageUrl}`);
    }

    if (dto.actionLabel !== undefined) {
      assignments.push(Prisma.sql`"actionLabel" = ${dto.actionLabel}`);
    }

    if (dto.actionUrl !== undefined) {
      assignments.push(Prisma.sql`"actionUrl" = ${dto.actionUrl}`);
    }

    if (dto.displayMode !== undefined) {
      assignments.push(Prisma.sql`"displayMode" = ${dto.displayMode}`);
    }

    if (dto.maxItems !== undefined) {
      assignments.push(Prisma.sql`"maxItems" = ${dto.maxItems}`);
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

  private async assertSectionKeyUnique(
    sectionKey: string,
    exceptSectionId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [
      Prisma.sql`LOWER("sectionKey") = LOWER(${sectionKey})`,
    ];

    if (exceptSectionId) {
      where.push(Prisma.sql`"id" <> ${exceptSectionId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "HomeSection"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('کلید سکشن صفحه اصلی تکراری است.');
    }
  }

  private async assertSlugUnique(
    slug: string,
    exceptSectionId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [Prisma.sql`LOWER("slug") = LOWER(${slug})`];

    if (exceptSectionId) {
      where.push(Prisma.sql`"id" <> ${exceptSectionId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "HomeSection"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('اسلاگ سکشن صفحه اصلی تکراری است.');
    }
  }

  private async assertSectionsExist(sectionIds: string[]): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "HomeSection"
          WHERE
            "id" IN (${Prisma.join(sectionIds)})
            AND "deleted_at" IS NULL
        `,
    );

    if (this.toNumber(rows[0]?.count) !== sectionIds.length) {
      throw new BadRequestException('برخی سکشن‌های انتخاب‌شده معتبر نیستند.');
    }
  }

  private async assertProductsExist(productIds: string[]): Promise<void> {
    const uniqueProductIds = Array.from(new Set(productIds));

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
        'زمان شروع سکشن نمی‌تواند بعد از زمان پایان باشد.',
      );
    }
  }

  private uniqueProductItems(
    items: AdminHomeSectionProductsDto['items'],
  ): AdminHomeSectionProductsDto['items'] {
    const map = new Map<string, AdminHomeSectionProductsDto['items'][number]>();

    for (const item of items) {
      map.set(item.productId, item);
    }

    return Array.from(map.values());
  }

  private mapHomeSection(row: HomeSectionRow) {
    return {
      id: row.id,
      sectionKey: row.sectionKey,
      title: row.title,
      slug: row.slug,
      subtitle: row.subtitle,
      description: row.description,
      sectionType: row.sectionType,
      sourceType: row.sourceType,
      sourceConfig: this.toRecord(row.sourceConfig),
      imageUrl: row.imageUrl,
      actionLabel: row.actionLabel,
      actionUrl: row.actionUrl,
      displayMode: row.displayMode,
      maxItems: row.maxItems,
      isActive: row.isActive,
      isCurrentlyVisible: row.isCurrentlyVisible,
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

  private mapHomeSectionProduct(row: HomeSectionProductRow) {
    return {
      productId: row.productId,
      name: row.productName,
      slug: row.productSlug,
      sku: row.productSku,
      price: this.toDecimalString(row.productPrice),
      status: row.productStatus,
      isActive: row.productIsActive,
      imageUrl: row.imageUrl,
      sortOrder: row.sortOrder,
      isPinned: row.isPinned,
      addedAt: row.createdAt.toISOString(),
    };
  }

  private resolveSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`hs."updatedAt"`;
    }

    if (sortBy === 'title') {
      return Prisma.sql`hs."title"`;
    }

    if (sortBy === 'sectionKey') {
      return Prisma.sql`hs."sectionKey"`;
    }

    if (sortBy === 'sectionType') {
      return Prisma.sql`hs."sectionType"`;
    }

    if (sortBy === 'sourceType') {
      return Prisma.sql`hs."sourceType"`;
    }

    if (sortBy === 'sortOrder') {
      return Prisma.sql`hs."sortOrder"`;
    }

    if (sortBy === 'productCount') {
      return Prisma.sql`"productCount"`;
    }

    if (sortBy === 'isActive') {
      return Prisma.sql`hs."isActive"`;
    }

    return Prisma.sql`hs."createdAt"`;
  }

  private resolveSortDirection(sortDirection?: string): Prisma.Sql {
    return sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  }

  private keyify(value: string): string {
    return this.slugify(value).replace(/-/g, '_').slice(0, 120);
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
