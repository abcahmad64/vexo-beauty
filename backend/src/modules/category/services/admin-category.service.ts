import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminCategorySeoDto } from '../dto/admin-category-seo.dto';

import { AdminCreateCategoryDto } from '../dto/admin-create-category.dto';

import { AdminQueryCategoryDto } from '../dto/admin-query-category.dto';

import { AdminReorderCategoryDto } from '../dto/admin-reorder-category.dto';

import { AdminUpdateCategoryDto } from '../dto/admin-update-category.dto';

type CountRow = {
  count: number | bigint;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  parentSlug: string | null;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount: number | bigint;
  directChildrenCount: number | bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type CategorySeoEventRow = {
  data: Prisma.JsonValue | null;
  timestamp: Date;
};

type CategoryResponse = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent: {
    id: string | null;
    name: string | null;
    slug: string | null;
  };
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
  directChildrenCount: number;
  createdAt: string;
  createdAtFa: string;
  updatedAt: string;
  updatedAtFa: string;
  deletedAt: string | null;
  deletedAtFa: string | null;
};

@Injectable()
export class AdminCategoryService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminQueryCategoryDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildCategoryWhere(query, 'c');

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<CategoryRow[]>(
        Prisma.sql`
            SELECT
              c."id",
              c."name",
              c."slug",
              c."description",
              c."parent_id" AS "parentId",
              parent."name" AS "parentName",
              parent."slug" AS "parentSlug",
              c."image",
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
              (
                SELECT
                  COUNT(*)::int
                FROM "Category" child
                WHERE
                  child."parent_id" = c."id"
                  AND child."deleted_at" IS NULL
              ) AS "directChildrenCount",
              c."createdAt",
              c."updatedAt",
              c."deleted_at" AS "deletedAt"
            FROM "Category" c
            LEFT JOIN "Category" parent
              ON parent."id" = c."parent_id"
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
            FROM "Category" c
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapCategory(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(categoryId: string) {
    const category = await this.findCategoryRow(categoryId, true);

    const children = await this.findChildren(categoryId);

    return {
      ...this.mapCategory(category),
      children: children.map((child) => this.mapCategory(child)),
    };
  }

  async create(dto: AdminCreateCategoryDto, actorId?: string) {
    const categoryId = randomUUID();

    const now = new Date();

    const name = dto.name.trim();

    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(name);

    if (!slug) {
      throw new BadRequestException('امکان ساخت اسلاگ دسته‌بندی وجود ندارد.');
    }

    if (dto.parentId) {
      await this.assertParentValid(dto.parentId);
    }

    await this.assertNameUnique(name);

    await this.assertSlugUnique(slug);

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Category" (
          "id",
          "name",
          "slug",
          "description",
          "parent_id",
          "image",
          "isActive",
          "sortOrder",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${categoryId},
          ${name},
          ${slug},
          ${dto.description ?? null},
          ${dto.parentId ?? null},
          ${dto.image ?? null},
          ${dto.isActive ?? true},
          ${dto.sortOrder ?? 0},
          ${now},
          ${now}
        )
      `,
    );

    return {
      category: await this.findOne(categoryId),
      audit: {
        actorId: actorId ?? null,
        action: 'category.admin_created',
      },
    };
  }

  async update(
    categoryId: string,
    dto: AdminUpdateCategoryDto,
    actorId?: string,
  ) {
    await this.findCategoryRow(categoryId, true);

    const normalizedDto: AdminUpdateCategoryDto = {
      ...dto,
    };

    if (normalizedDto.name !== undefined) {
      normalizedDto.name = normalizedDto.name.trim();

      await this.assertNameUnique(normalizedDto.name, categoryId);
    }

    if (normalizedDto.slug !== undefined) {
      normalizedDto.slug = this.slugify(normalizedDto.slug);

      if (!normalizedDto.slug) {
        throw new BadRequestException('اسلاگ دسته‌بندی معتبر نیست.');
      }

      await this.assertSlugUnique(normalizedDto.slug, categoryId);
    }

    if (normalizedDto.parentId !== undefined) {
      if (normalizedDto.parentId !== null) {
        await this.assertParentValid(normalizedDto.parentId, categoryId);

        await this.assertNoCycle(categoryId, normalizedDto.parentId);
      }
    }

    const assignments = this.buildUpdateAssignments(normalizedDto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی دسته‌بندی ارسال نشده است.',
      );
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Category"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = ${now}
        WHERE
          "id" = ${categoryId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      category: await this.findOne(categoryId),
      audit: {
        actorId: actorId ?? null,
        action: 'category.admin_updated',
      },
    };
  }

  async reorder(dto: AdminReorderCategoryDto, actorId?: string) {
    const categoryIds = Array.from(
      new Set(dto.items.map((item) => item.categoryId)),
    );

    if (categoryIds.length !== dto.items.length) {
      throw new BadRequestException(
        'شناسه دسته‌بندی در لیست مرتب‌سازی تکراری است.',
      );
    }

    await this.assertCategoriesExist(categoryIds);

    for (const item of dto.items) {
      if (item.parentId !== undefined && item.parentId !== null) {
        await this.assertParentValid(item.parentId, item.categoryId);

        await this.assertNoCycle(item.categoryId, item.parentId);
      }
    }

    const now = new Date();

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.$executeRaw(
          Prisma.sql`
            UPDATE "Category"
            SET
              "sortOrder" = ${item.sortOrder},
              ${
                item.parentId !== undefined
                  ? Prisma.sql`"parent_id" = ${item.parentId}`
                  : Prisma.sql`"parent_id" = "parent_id"`
              },
              "updatedAt" = ${now}
            WHERE
              "id" = ${item.categoryId}
              AND "deleted_at" IS NULL
          `,
        ),
      ),
    );

    return {
      success: true,
      updatedCount: dto.items.length,
      audit: {
        actorId: actorId ?? null,
        action: 'category.admin_reordered',
      },
    };
  }

  async activate(categoryId: string, actorId?: string) {
    await this.findCategoryRow(categoryId, true);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Category"
        SET
          "isActive" = TRUE,
          "updatedAt" = ${now}
        WHERE
          "id" = ${categoryId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      category: await this.findOne(categoryId),
      audit: {
        actorId: actorId ?? null,
        action: 'category.admin_activated',
      },
    };
  }

  async deactivate(categoryId: string, actorId?: string) {
    await this.findCategoryRow(categoryId, true);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Category"
        SET
          "isActive" = FALSE,
          "updatedAt" = ${now}
        WHERE
          "id" = ${categoryId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      category: await this.findOne(categoryId),
      audit: {
        actorId: actorId ?? null,
        action: 'category.admin_deactivated',
      },
    };
  }

  async delete(categoryId: string, actorId?: string) {
    await this.findCategoryRow(categoryId, true);

    const childCount = await this.countActiveChildren(categoryId);

    if (childCount > 0) {
      throw new BadRequestException(
        'این دسته‌بندی دارای زیرمجموعه فعال است و قابل حذف نیست.',
      );
    }

    const productCount = await this.countProducts(categoryId);

    if (productCount > 0) {
      throw new BadRequestException(
        'این دسته‌بندی دارای محصول است و قابل حذف نیست.',
      );
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
      UPDATE "Category"
      SET
        "deleted_at" = ${now},
        "isActive" = FALSE,
        "updatedAt" = ${now}
      WHERE
        "id" = ${categoryId}
        AND "deleted_at" IS NULL
    `,
    );

    return {
      deletedAt: now.toISOString(),
      deletedAtFa: this.formatDateTimeFaNullable(now),
      audit: {
        actorId: actorId ?? null,
        action: 'category.admin_deleted',
      },
    };
  }

  async restore(categoryId: string, actorId?: string) {
    const category = await this.findCategoryRow(categoryId, true);

    if (!category.deletedAt) {
      return {
        category: await this.findOne(categoryId),
        audit: {
          actorId: actorId ?? null,
          action: 'category.admin_restore_skipped',
        },
      };
    }

    if (category.parentId) {
      await this.assertParentValid(category.parentId, categoryId);
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Category"
        SET
          "deleted_at" = NULL,
          "isActive" = TRUE,
          "updatedAt" = ${now}
        WHERE
          "id" = ${categoryId}
      `,
    );

    return {
      category: await this.findOne(categoryId),
      audit: {
        actorId: actorId ?? null,
        action: 'category.admin_restored',
      },
    };
  }

  async getSeo(categoryId: string) {
    const category = await this.findCategoryRow(categoryId, true);

    const rows = await this.prisma.$queryRaw<CategorySeoEventRow[]>(
      Prisma.sql`
          SELECT
            e."data",
            e."timestamp"
          FROM "Event" e
          WHERE
            e."deleted_at" IS NULL
            AND e."name" = 'category.seo.updated'
            AND e."data" #>> '{categoryId}' = ${categoryId}
          ORDER BY
            e."timestamp" DESC,
            e."createdAt" DESC
          LIMIT 1
        `,
    );

    const latest = rows[0];

    const data = this.toRecord(latest?.data ?? null);

    const seo = this.toRecord(data.seo);

    return {
      categoryId,
      category: {
        name: category.name,
        slug: category.slug,
      },
      seo: {
        metaTitle: seo.metaTitle ?? category.name,
        metaDescription: seo.metaDescription ?? category.description ?? null,
        keywords: Array.isArray(seo.keywords) ? seo.keywords : [],
        canonicalUrl: seo.canonicalUrl ?? null,
        ogTitle: seo.ogTitle ?? seo.metaTitle ?? category.name,
        ogDescription:
          seo.ogDescription ??
          seo.metaDescription ??
          category.description ??
          null,
        ogImage: seo.ogImage ?? category.image,
        noIndex: seo.noIndex ?? false,
        noFollow: seo.noFollow ?? false,
      },
      updatedAt: latest ? latest.timestamp.toISOString() : null,
      updatedAtFa: latest
        ? this.formatDateTimeFaNullable(latest.timestamp)
        : null,
    };
  }

  async updateSeo(
    categoryId: string,
    dto: AdminCategorySeoDto,
    actorId?: string,
  ) {
    await this.findCategoryRow(categoryId, true);

    const seo = this.cleanSeoPayload(dto);

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
          ${randomUUID()},
          'category.seo.updated',
          'تنظیمات سئوی دسته‌بندی توسط ادمین به‌روزرسانی شد.',
          'category',
          ${now},
          ${actorId ?? null},
          ${JSON.stringify({
            categoryId,
            seo,
          })}::jsonb,
          ${now},
          ${now}
        )
      `,
    );

    return {
      categoryId,
      seo,
      updatedAt: now.toISOString(),
      updatedAtFa: this.formatDateTimeFaNullable(now),
      audit: {
        actorId: actorId ?? null,
        action: 'category.seo_updated',
      },
    };
  }

  async findCategoryRow(
    categoryId: string,
    includeDeleted: boolean,
  ): Promise<CategoryRow> {
    const where: Prisma.Sql[] = [Prisma.sql`c."id" = ${categoryId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`c."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<CategoryRow[]>(
      Prisma.sql`
          SELECT
            c."id",
            c."name",
            c."slug",
            c."description",
            c."parent_id" AS "parentId",
            parent."name" AS "parentName",
            parent."slug" AS "parentSlug",
            c."image",
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
            (
              SELECT
                COUNT(*)::int
              FROM "Category" child
              WHERE
                child."parent_id" = c."id"
                AND child."deleted_at" IS NULL
            ) AS "directChildrenCount",
            c."createdAt",
            c."updatedAt",
            c."deleted_at" AS "deletedAt"
          FROM "Category" c
          LEFT JOIN "Category" parent
            ON parent."id" = c."parent_id"
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const category = rows[0];

    if (!category) {
      throw new NotFoundException('دسته‌بندی موردنظر یافت نشد.');
    }

    return category;
  }

  private findChildren(categoryId: string): Promise<CategoryRow[]> {
    return this.prisma.$queryRaw<CategoryRow[]>(
      Prisma.sql`
        SELECT
          c."id",
          c."name",
          c."slug",
          c."description",
          c."parent_id" AS "parentId",
          parent."name" AS "parentName",
          parent."slug" AS "parentSlug",
          c."image",
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
          (
            SELECT
              COUNT(*)::int
            FROM "Category" child
            WHERE
              child."parent_id" = c."id"
              AND child."deleted_at" IS NULL
          ) AS "directChildrenCount",
          c."createdAt",
          c."updatedAt",
          c."deleted_at" AS "deletedAt"
        FROM "Category" c
        LEFT JOIN "Category" parent
          ON parent."id" = c."parent_id"
        WHERE
          c."parent_id" = ${categoryId}
          AND c."deleted_at" IS NULL
        ORDER BY
          c."sortOrder" ASC,
          c."name" ASC
      `,
    );
  }

  private buildCategoryWhere(
    query: AdminQueryCategoryDto,
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
          ${table}."name" ILIKE ${`%${query.q}%`}
          OR ${table}."slug" ILIKE ${`%${query.q}%`}
          OR ${table}."description" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.parentId) {
      where.push(Prisma.sql`${table}."parent_id" = ${query.parentId}`);
    }

    if (query.rootOnly === true) {
      where.push(Prisma.sql`${table}."parent_id" IS NULL`);
    }

    if (query.isActive !== undefined) {
      where.push(Prisma.sql`${table}."isActive" = ${query.isActive}`);
    }

    if (query.createdFrom) {
      where.push(
        Prisma.sql`${table}."createdAt" >= ${this.parseDate(query.createdFrom)}`,
      );
    }

    if (query.createdTo) {
      where.push(
        Prisma.sql`${table}."createdAt" <= ${this.parseDate(query.createdTo)}`,
      );
    }

    return where;
  }

  private buildUpdateAssignments(dto: AdminUpdateCategoryDto): Prisma.Sql[] {
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

    if (dto.parentId !== undefined) {
      assignments.push(Prisma.sql`"parent_id" = ${dto.parentId}`);
    }

    if (dto.image !== undefined) {
      assignments.push(Prisma.sql`"image" = ${dto.image}`);
    }

    if (dto.isActive !== undefined) {
      assignments.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    if (dto.sortOrder !== undefined) {
      assignments.push(Prisma.sql`"sortOrder" = ${dto.sortOrder}`);
    }

    return assignments;
  }

  private async assertParentValid(
    parentId: string,
    currentCategoryId?: string,
  ): Promise<void> {
    if (currentCategoryId && parentId === currentCategoryId) {
      throw new BadRequestException('دسته‌بندی نمی‌تواند والد خودش باشد.');
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Category"
          WHERE
            "id" = ${parentId}
            AND "deleted_at" IS NULL
            AND "isActive" = TRUE
        `,
    );

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException('دسته‌بندی والد معتبر نیست.');
    }
  }

  private async assertNoCycle(
    categoryId: string,
    parentId: string,
  ): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          WITH RECURSIVE descendants AS (
            SELECT
              c."id"
            FROM "Category" c
            WHERE
              c."parent_id" = ${categoryId}
              AND c."deleted_at" IS NULL

            UNION ALL

            SELECT
              child."id"
            FROM "Category" child
            INNER JOIN descendants d
              ON child."parent_id" = d."id"
            WHERE child."deleted_at" IS NULL
          )
          SELECT
            COUNT(*)::int AS "count"
          FROM descendants
          WHERE "id" = ${parentId}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new BadRequestException(
        'انتخاب این والد باعث ایجاد چرخه در درخت دسته‌بندی می‌شود.',
      );
    }
  }

  private async assertCategoriesExist(categoryIds: string[]): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Category"
          WHERE
            "id" IN (${Prisma.join(categoryIds)})
            AND "deleted_at" IS NULL
        `,
    );

    if (this.toNumber(rows[0]?.count) !== categoryIds.length) {
      throw new BadRequestException(
        'برخی دسته‌بندی‌های انتخاب‌شده معتبر نیستند.',
      );
    }
  }

  private async assertNameUnique(
    name: string,
    exceptCategoryId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [Prisma.sql`LOWER("name") = LOWER(${name})`];

    if (exceptCategoryId) {
      where.push(Prisma.sql`"id" <> ${exceptCategoryId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Category"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('نام دسته‌بندی تکراری است.');
    }
  }

  private async assertSlugUnique(
    slug: string,
    exceptCategoryId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [Prisma.sql`LOWER("slug") = LOWER(${slug})`];

    if (exceptCategoryId) {
      where.push(Prisma.sql`"id" <> ${exceptCategoryId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Category"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('اسلاگ دسته‌بندی تکراری است.');
    }
  }

  private async countActiveChildren(categoryId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Category"
          WHERE
            "parent_id" = ${categoryId}
            AND "deleted_at" IS NULL
        `,
    );

    return this.toNumber(rows[0]?.count);
  }

  private async countProducts(categoryId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Product"
          WHERE
            "categoryId" = ${categoryId}
            AND "deleted_at" IS NULL
        `,
    );

    return this.toNumber(rows[0]?.count);
  }

  private cleanSeoPayload(dto: AdminCategorySeoDto): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (dto.metaTitle !== undefined) {
      payload.metaTitle = dto.metaTitle;
    }

    if (dto.metaDescription !== undefined) {
      payload.metaDescription = dto.metaDescription;
    }

    if (dto.keywords !== undefined) {
      payload.keywords = dto.keywords;
    }

    if (dto.canonicalUrl !== undefined) {
      payload.canonicalUrl = dto.canonicalUrl;
    }

    if (dto.ogTitle !== undefined) {
      payload.ogTitle = dto.ogTitle;
    }

    if (dto.ogDescription !== undefined) {
      payload.ogDescription = dto.ogDescription;
    }

    if (dto.ogImage !== undefined) {
      payload.ogImage = dto.ogImage;
    }

    if (dto.noIndex !== undefined) {
      payload.noIndex = dto.noIndex;
    }

    if (dto.noFollow !== undefined) {
      payload.noFollow = dto.noFollow;
    }

    return payload;
  }

  private mapCategory(row: CategoryRow): CategoryResponse {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      parent: {
        id: row.parentId,
        name: row.parentName,
        slug: row.parentSlug,
      },
      image: row.image,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      productCount: this.toNumber(row.productCount),
      directChildrenCount: this.toNumber(row.directChildrenCount),
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: this.formatDateTimeFaNullable(row.deletedAt),
    };
  }

  private resolveSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`c."updatedAt"`;
    }

    if (sortBy === 'name') {
      return Prisma.sql`c."name"`;
    }

    if (sortBy === 'slug') {
      return Prisma.sql`c."slug"`;
    }

    if (sortBy === 'isActive') {
      return Prisma.sql`c."isActive"`;
    }

    if (sortBy === 'productCount') {
      return Prisma.sql`"productCount"`;
    }

    if (sortBy === 'sortOrder') {
      return Prisma.sql`c."sortOrder"`;
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

  private parseDate(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('مقدار تاریخ نامعتبر است.');
    }

    return date;
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

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
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
}
