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

import { AdminBrandSeoDto } from '../dto/admin-brand-seo.dto';

import { AdminCreateBrandDto } from '../dto/admin-create-brand.dto';

import { AdminQueryBrandDto } from '../dto/admin-query-brand.dto';

import { AdminUpdateBrandDto } from '../dto/admin-update-brand.dto';

type CountRow = {
  count: number | bigint;
};

type BrandRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  isActive: boolean;
  productCount: number | bigint;
  activeProductCount: number | bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type BrandSeoEventRow = {
  data: Prisma.JsonValue | null;
  timestamp: Date;
};

type BrandResponse = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  isActive: boolean;
  productCount: number;
  activeProductCount: number;
  createdAt: string;
  createdAtFa: string;
  updatedAt: string;
  updatedAtFa: string;
  deletedAt: string | null;
  deletedAtFa: string | null;
};

@Injectable()
export class AdminBrandService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminQueryBrandDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildBrandWhere(query, 'b');

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<BrandRow[]>(
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
              (
                SELECT
                  COUNT(*)::int
                FROM "Product" p
                WHERE
                  p."brandId" = b."id"
                  AND p."deleted_at" IS NULL
                  AND p."isActive" = TRUE
                  AND p."status"::text = 'ACTIVE'
              ) AS "activeProductCount",
              b."createdAt",
              b."updatedAt",
              b."deleted_at" AS "deletedAt"
            FROM "Brand" b
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolveSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              b."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
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

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapBrand(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(brandId: string) {
    const brand = await this.findBrandRow(brandId, true);

    return this.mapBrand(brand);
  }

  async create(dto: AdminCreateBrandDto, actorId?: string) {
    const brandId = randomUUID();

    const now = new Date();

    const name = dto.name.trim();

    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(name);

    if (!slug) {
      throw new BadRequestException('امکان ساخت اسلاگ برند وجود ندارد.');
    }

    await this.assertNameUnique(name);

    await this.assertSlugUnique(slug);

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Brand" (
          "id",
          "name",
          "slug",
          "description",
          "logoUrl",
          "website",
          "isActive",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${brandId},
          ${name},
          ${slug},
          ${dto.description ?? null},
          ${dto.logoUrl ?? null},
          ${dto.website ?? null},
          ${dto.isActive ?? true},
          ${now},
          ${now}
        )
      `,
    );

    return {
      brand: await this.findOne(brandId),
      audit: {
        actorId: actorId ?? null,
        action: 'brand.admin_created',
      },
    };
  }

  async update(brandId: string, dto: AdminUpdateBrandDto, actorId?: string) {
    await this.findBrandRow(brandId, true);

    const normalizedDto: AdminUpdateBrandDto = {
      ...dto,
    };

    if (normalizedDto.name !== undefined) {
      normalizedDto.name = normalizedDto.name.trim();

      await this.assertNameUnique(normalizedDto.name, brandId);
    }

    if (normalizedDto.slug !== undefined) {
      normalizedDto.slug = this.slugify(normalizedDto.slug);

      if (!normalizedDto.slug) {
        throw new BadRequestException('اسلاگ برند معتبر نیست.');
      }

      await this.assertSlugUnique(normalizedDto.slug, brandId);
    }

    const assignments = this.buildUpdateAssignments(normalizedDto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی برند ارسال نشده است.',
      );
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Brand"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = ${now}
        WHERE
          "id" = ${brandId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      brand: await this.findOne(brandId),
      audit: {
        actorId: actorId ?? null,
        action: 'brand.admin_updated',
      },
    };
  }

  async activate(brandId: string, actorId?: string) {
    await this.findBrandRow(brandId, true);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Brand"
        SET
          "isActive" = TRUE,
          "updatedAt" = ${now}
        WHERE
          "id" = ${brandId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      brand: await this.findOne(brandId),
      audit: {
        actorId: actorId ?? null,
        action: 'brand.admin_activated',
      },
    };
  }

  async deactivate(brandId: string, actorId?: string) {
    await this.findBrandRow(brandId, true);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Brand"
        SET
          "isActive" = FALSE,
          "updatedAt" = ${now}
        WHERE
          "id" = ${brandId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      brand: await this.findOne(brandId),
      audit: {
        actorId: actorId ?? null,
        action: 'brand.admin_deactivated',
      },
    };
  }

  async delete(brandId: string, actorId?: string) {
    await this.findBrandRow(brandId, true);

    const productCount = await this.countProducts(brandId);

    if (productCount > 0) {
      throw new BadRequestException(
        'این برند دارای محصول است و قابل حذف نیست.',
      );
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Brand"
        SET
          "deleted_at" = ${now},
          "isActive" = FALSE,
          "updatedAt" = ${now}
        WHERE
          "id" = ${brandId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      deletedAt: now.toISOString(),
      deletedAtFa: this.formatDateTimeFaNullable(now),
      audit: {
        actorId: actorId ?? null,
        action: 'brand.admin_deleted',
      },
    };
  }

  async restore(brandId: string, actorId?: string) {
    const brand = await this.findBrandRow(brandId, true);

    if (!brand.deletedAt) {
      return {
        brand: await this.findOne(brandId),
        audit: {
          actorId: actorId ?? null,
          action: 'brand.admin_restore_skipped',
        },
      };
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Brand"
        SET
          "deleted_at" = NULL,
          "isActive" = TRUE,
          "updatedAt" = ${now}
        WHERE
          "id" = ${brandId}
      `,
    );

    return {
      brand: await this.findOne(brandId),
      audit: {
        actorId: actorId ?? null,
        action: 'brand.admin_restored',
      },
    };
  }

  async getSeo(brandId: string) {
    const brand = await this.findBrandRow(brandId, true);

    const rows = await this.prisma.$queryRaw<BrandSeoEventRow[]>(
      Prisma.sql`
          SELECT
            e."data",
            e."timestamp"
          FROM "Event" e
          WHERE
            e."deleted_at" IS NULL
            AND e."name" = 'brand.seo.updated'
            AND e."data" #>> '{brandId}' = ${brandId}
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
      brandId,
      brand: {
        name: brand.name,
        slug: brand.slug,
      },
      seo: {
        metaTitle: seo.metaTitle ?? brand.name,
        metaDescription: seo.metaDescription ?? brand.description ?? null,
        keywords: Array.isArray(seo.keywords) ? seo.keywords : [],
        canonicalUrl: seo.canonicalUrl ?? null,
        ogTitle: seo.ogTitle ?? seo.metaTitle ?? brand.name,
        ogDescription:
          seo.ogDescription ?? seo.metaDescription ?? brand.description ?? null,
        ogImage: seo.ogImage ?? brand.logoUrl,
        noIndex: seo.noIndex ?? false,
        noFollow: seo.noFollow ?? false,
      },
      updatedAt: latest ? latest.timestamp.toISOString() : null,
      updatedAtFa: latest
        ? this.formatDateTimeFaNullable(latest.timestamp)
        : null,
    };
  }

  async updateSeo(brandId: string, dto: AdminBrandSeoDto, actorId?: string) {
    await this.findBrandRow(brandId, true);

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
          'brand.seo.updated',
          'تنظیمات سئوی برند توسط ادمین به‌روزرسانی شد.',
          'brand',
          ${now},
          ${actorId ?? null},
          ${JSON.stringify({
            brandId,
            seo,
          })}::jsonb,
          ${now},
          ${now}
        )
      `,
    );

    return {
      brandId,
      seo,
      updatedAt: now.toISOString(),
      updatedAtFa: this.formatDateTimeFaNullable(now),
      audit: {
        actorId: actorId ?? null,
        action: 'brand.seo_updated',
      },
    };
  }

  async findBrandRow(
    brandId: string,
    includeDeleted: boolean,
  ): Promise<BrandRow> {
    const where: Prisma.Sql[] = [Prisma.sql`b."id" = ${brandId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`b."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<BrandRow[]>(
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
            (
              SELECT
                COUNT(*)::int
              FROM "Product" p
              WHERE
                p."brandId" = b."id"
                AND p."deleted_at" IS NULL
                AND p."isActive" = TRUE
                AND p."status"::text = 'ACTIVE'
            ) AS "activeProductCount",
            b."createdAt",
            b."updatedAt",
            b."deleted_at" AS "deletedAt"
          FROM "Brand" b
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const brand = rows[0];

    if (!brand) {
      throw new NotFoundException('برند موردنظر یافت نشد.');
    }

    return brand;
  }

  private buildBrandWhere(
    query: AdminQueryBrandDto,
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
          OR ${table}."website" ILIKE ${`%${query.q}%`}
        )`,
      );
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

  private buildUpdateAssignments(dto: AdminUpdateBrandDto): Prisma.Sql[] {
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

    if (dto.logoUrl !== undefined) {
      assignments.push(Prisma.sql`"logoUrl" = ${dto.logoUrl}`);
    }

    if (dto.website !== undefined) {
      assignments.push(Prisma.sql`"website" = ${dto.website}`);
    }

    if (dto.isActive !== undefined) {
      assignments.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    return assignments;
  }

  private async assertNameUnique(
    name: string,
    exceptBrandId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [Prisma.sql`LOWER("name") = LOWER(${name})`];

    if (exceptBrandId) {
      where.push(Prisma.sql`"id" <> ${exceptBrandId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Brand"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('نام برند تکراری است.');
    }
  }

  private async assertSlugUnique(
    slug: string,
    exceptBrandId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [Prisma.sql`LOWER("slug") = LOWER(${slug})`];

    if (exceptBrandId) {
      where.push(Prisma.sql`"id" <> ${exceptBrandId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Brand"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('اسلاگ برند تکراری است.');
    }
  }

  private async countProducts(brandId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Product"
          WHERE
            "brandId" = ${brandId}
            AND "deleted_at" IS NULL
        `,
    );

    return this.toNumber(rows[0]?.count);
  }

  private cleanSeoPayload(dto: AdminBrandSeoDto): Record<string, unknown> {
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

  private mapBrand(row: BrandRow): BrandResponse {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      logoUrl: row.logoUrl,
      website: row.website,
      isActive: row.isActive,
      productCount: this.toNumber(row.productCount),
      activeProductCount: this.toNumber(row.activeProductCount),
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
      return Prisma.sql`b."updatedAt"`;
    }

    if (sortBy === 'name') {
      return Prisma.sql`b."name"`;
    }

    if (sortBy === 'slug') {
      return Prisma.sql`b."slug"`;
    }

    if (sortBy === 'isActive') {
      return Prisma.sql`b."isActive"`;
    }

    if (sortBy === 'productCount') {
      return Prisma.sql`"productCount"`;
    }

    return Prisma.sql`b."createdAt"`;
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
