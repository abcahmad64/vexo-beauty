import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { CreateBrandDto } from '../dto/create-brand.dto';

import { QueryBrandDto } from '../dto/query-brand.dto';

import { UpdateBrandDto } from '../dto/update-brand.dto';

import { BrandEventPublisher } from '../events/brand.event.publisher';

type ProductCountRow = {
  total_products: number | bigint;
  active_products: number | bigint;
};

type BrandEntity = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type BrandProductCount = {
  totalProducts: number;
  activeProducts: number;
};

type BrandRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  isActive: boolean;
  productCount?: BrandProductCount;
  createdAt: string;
  createdAtFa: string;
  updatedAt: string;
  updatedAtFa: string;
  deletedAt: string | null;
  deletedAtFa: string | null;
};

@Injectable()
export class BrandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: BrandEventPublisher,
  ) {}

  private readonly brandSelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    logoUrl: true,
    website: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
  } satisfies Prisma.BrandSelect;

  async create(dto: CreateBrandDto, actorId?: string) {
    const name = dto.name.trim();

    const slug = dto.slug
      ? this.normalizeSlug(dto.slug)
      : await this.generateUniqueSlug(name);

    if (!slug) {
      throw new BadRequestException('امکان ساخت اسلاگ برند وجود ندارد.');
    }

    await this.assertNameUnique(name);
    await this.assertSlugUnique(slug);

    const brand = await this.prisma.brand.create({
      data: {
        name,
        slug,
        description: dto.description ?? null,
        logoUrl: dto.logoUrl ?? null,
        website: dto.website ?? null,
        isActive: dto.isActive ?? true,
      },
      select: this.brandSelect,
    });

    const occurredAt = new Date();

    this.eventPublisher.publishCreated({
      brandId: brand.id,
      name: brand.name,
      slug: brand.slug,
      actorId,
      occurredAt,
    });

    return this.mapBrand(brand, {
      totalProducts: 0,
      activeProducts: 0,
    });
  }

  async findAllPublic(query: QueryBrandDto) {
    return this.findAll({
      ...query,
      isActive: query.isActive ?? true,
      includeDeleted: false,
    });
  }

  async findAllForAdmin(query: QueryBrandDto) {
    return this.findAll(query);
  }

  async findOnePublic(brandId: string) {
    const brand = await this.findBrandEntity(brandId, false);

    if (!brand.isActive) {
      throw new NotFoundException('برند موردنظر یافت نشد.');
    }

    const productCount = await this.getProductCount(brand.id);

    return this.mapBrand(brand, productCount);
  }

  async findBySlugPublic(slug: string) {
    const brand = await this.findBrandBySlug(slug, false);

    if (!brand.isActive) {
      throw new NotFoundException('برند موردنظر یافت نشد.');
    }

    const productCount = await this.getProductCount(brand.id);

    return this.mapBrand(brand, productCount);
  }

  async findOneForAdmin(brandId: string, includeDeleted = false) {
    const brand = await this.findBrandEntity(brandId, includeDeleted);

    const productCount = await this.getProductCount(brand.id);

    return this.mapBrand(brand, productCount);
  }

  async findBySlugForAdmin(slug: string, includeDeleted = false) {
    const brand = await this.findBrandBySlug(slug, includeDeleted);

    const productCount = await this.getProductCount(brand.id);

    return this.mapBrand(brand, productCount);
  }

  async update(brandId: string, dto: UpdateBrandDto, actorId?: string) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی برند ارسال نشده است.',
      );
    }

    const current = await this.findBrandEntity(brandId, false);

    const data: Prisma.BrandUpdateInput = {};

    if (dto.name !== undefined && dto.name !== current.name) {
      const name = dto.name.trim();

      await this.assertNameUnique(name, brandId);

      data.name = name;

      if (dto.slug === undefined) {
        data.slug = await this.generateUniqueSlug(name, brandId);
      }
    }

    if (dto.slug !== undefined) {
      const slug = dto.slug
        ? this.normalizeSlug(dto.slug)
        : await this.generateUniqueSlug(dto.name ?? current.name, brandId);

      if (!slug) {
        throw new BadRequestException('اسلاگ برند معتبر نیست.');
      }

      await this.assertSlugUnique(slug, brandId);

      data.slug = slug;
    }

    if (dto.description !== undefined) {
      data.description = dto.description;
    }

    if (dto.logoUrl !== undefined) {
      data.logoUrl = dto.logoUrl;
    }

    if (dto.website !== undefined) {
      data.website = dto.website;
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    const updated = await this.prisma.brand.update({
      where: {
        id: brandId,
      },
      data,
      select: this.brandSelect,
    });

    const occurredAt = new Date();

    this.eventPublisher.publishUpdated({
      brandId: updated.id,
      name: updated.name,
      slug: updated.slug,
      changedFields: Object.keys(dto),
      actorId,
      occurredAt,
    });

    const productCount = await this.getProductCount(updated.id);

    return this.mapBrand(updated, productCount);
  }

  async activate(brandId: string, actorId?: string) {
    const brand = await this.findBrandEntity(brandId, false);

    const updated = await this.prisma.brand.update({
      where: {
        id: brand.id,
      },
      data: {
        isActive: true,
      },
      select: this.brandSelect,
    });

    const occurredAt = new Date();

    this.eventPublisher.publishActivated({
      brandId: updated.id,
      name: updated.name,
      slug: updated.slug,
      actorId,
      occurredAt,
    });

    return this.mapBrand(updated, await this.getProductCount(updated.id));
  }

  async deactivate(brandId: string, actorId?: string) {
    const brand = await this.findBrandEntity(brandId, false);

    const updated = await this.prisma.brand.update({
      where: {
        id: brand.id,
      },
      data: {
        isActive: false,
      },
      select: this.brandSelect,
    });

    const occurredAt = new Date();

    this.eventPublisher.publishDeactivated({
      brandId: updated.id,
      name: updated.name,
      slug: updated.slug,
      actorId,
      occurredAt,
    });

    return this.mapBrand(updated, await this.getProductCount(updated.id));
  }

  async remove(brandId: string, actorId?: string) {
    const brand = await this.findBrandEntity(brandId, false);

    const productCount = await this.getProductCount(brand.id);

    if (productCount.totalProducts > 0) {
      throw new BadRequestException(
        'این برند دارای محصول است و قابل حذف نیست. ابتدا محصولات را به برند دیگری منتقل کنید یا برند را غیرفعال کنید.',
      );
    }

    const deletedAt = new Date();

    await this.prisma.brand.update({
      where: {
        id: brand.id,
      },
      data: {
        isActive: false,
        deletedAt,
      },
    });

    this.eventPublisher.publishDeleted({
      brandId: brand.id,
      name: brand.name,
      slug: brand.slug,
      actorId,
      occurredAt: deletedAt,
    });

    return {
      deletedAt: deletedAt.toISOString(),
      deletedAtFa: this.formatDateTimeFaNullable(deletedAt),
      audit: {
        actorId: actorId ?? null,
        action: 'brand.deleted',
      },
    };
  }

  async restore(brandId: string, actorId?: string) {
    const brand = await this.findBrandEntity(brandId, true);

    if (!brand.deletedAt) {
      return this.findOneForAdmin(brandId);
    }

    const restoredAt = new Date();

    const restored = await this.prisma.brand.update({
      where: {
        id: brand.id,
      },
      data: {
        deletedAt: null,
        isActive: true,
        updatedAt: restoredAt,
      },
      select: this.brandSelect,
    });

    this.eventPublisher.publishRestored({
      brandId: restored.id,
      name: restored.name,
      slug: restored.slug,
      actorId,
      occurredAt: restoredAt,
    });

    return this.mapBrand(restored, await this.getProductCount(restored.id));
  }

  async getProductCount(brandId: string) {
    const rows = await this.prisma.$queryRaw<ProductCountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS total_products,
            COUNT(*) FILTER (
              WHERE p."isActive" = true
                AND p."status"::text = 'ACTIVE'
            )::int AS active_products
          FROM "Product" p
          WHERE p."brandId" = ${brandId}
            AND p."deleted_at" IS NULL
        `,
    );

    return {
      totalProducts: this.toNumber(rows[0]?.total_products),
      activeProducts: this.toNumber(rows[0]?.active_products),
    };
  }

  private async findAll(query: QueryBrandDto) {
    const { page, limit, skip } = this.buildPagination(query);

    const where = this.buildWhere(query);

    const [brands, total] = await this.prisma.$transaction([
      this.prisma.brand.findMany({
        where,
        select: this.brandSelect,
        orderBy: [
          {
            isActive: 'desc',
          },
          {
            name: 'asc',
          },
          {
            id: 'asc',
          },
        ],
        skip,
        take: limit,
      }),
      this.prisma.brand.count({
        where,
      }),
    ]);

    const data =
      query.withProductCount === false
        ? brands.map((brand) => this.mapBrand(brand))
        : await Promise.all(
            brands.map(async (brand) =>
              this.mapBrand(brand, await this.getProductCount(brand.id)),
            ),
          );

    return this.buildPaginatedResult(data, total, page, limit);
  }

  private buildWhere(query: QueryBrandDto): Prisma.BrandWhereInput {
    const where: Prisma.BrandWhereInput = {};

    if (query.includeDeleted !== true) {
      where.deletedAt = null;
    }

    if (query.q) {
      where.OR = [
        {
          name: {
            contains: query.q,
            mode: 'insensitive',
          },
        },
        {
          slug: {
            contains: query.q,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: query.q,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.slug) {
      where.slug = this.normalizeSlug(query.slug);
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.createdFrom || query.createdTo) {
      where.createdAt = {
        ...(query.createdFrom
          ? {
              gte: this.parseDate(query.createdFrom),
            }
          : {}),
        ...(query.createdTo
          ? {
              lte: this.parseDate(query.createdTo),
            }
          : {}),
      };
    }

    return where;
  }

  private async findBrandEntity(
    brandId: string,
    includeDeleted: boolean,
  ): Promise<BrandEntity> {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id: brandId,
        ...(includeDeleted
          ? {}
          : {
              deletedAt: null,
            }),
      },
      select: this.brandSelect,
    });

    if (!brand) {
      throw new NotFoundException('برند موردنظر یافت نشد.');
    }

    return brand;
  }

  private async findBrandBySlug(
    slug: string,
    includeDeleted: boolean,
  ): Promise<BrandEntity> {
    const brand = await this.prisma.brand.findFirst({
      where: {
        slug: this.normalizeSlug(slug),
        ...(includeDeleted
          ? {}
          : {
              deletedAt: null,
            }),
      },
      select: this.brandSelect,
    });

    if (!brand) {
      throw new NotFoundException('برند موردنظر یافت نشد.');
    }

    return brand;
  }

  private async assertNameUnique(name: string, excludeBrandId?: string) {
    const existing = await this.prisma.brand.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
        ...(excludeBrandId
          ? {
              id: {
                not: excludeBrandId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException('نام برند تکراری است.');
    }
  }

  private async assertSlugUnique(slug: string, excludeBrandId?: string) {
    const existing = await this.prisma.brand.findFirst({
      where: {
        slug,
        ...(excludeBrandId
          ? {
              id: {
                not: excludeBrandId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException('اسلاگ برند تکراری است.');
    }
  }

  private async generateUniqueSlug(value: string, excludeBrandId?: string) {
    const base = this.normalizeSlug(value);

    if (!base) {
      throw new BadRequestException('امکان ساخت اسلاگ برند وجود ندارد.');
    }

    const rows = await this.prisma.brand.findMany({
      where: {
        slug: {
          startsWith: base,
        },
        ...(excludeBrandId
          ? {
              id: {
                not: excludeBrandId,
              },
            }
          : {}),
      },
      select: {
        slug: true,
      },
    });

    const used = new Set(rows.map((row) => row.slug));

    if (!used.has(base)) {
      return base;
    }

    let index = 2;

    while (used.has(`${base}-${index}`)) {
      index += 1;
    }

    return `${base}-${index}`;
  }

  private normalizeSlug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180);
  }

  private mapBrand(
    brand: BrandEntity,
    productCount?: BrandProductCount,
  ): BrandRecord {
    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      logoUrl: brand.logoUrl,
      website: brand.website,
      isActive: brand.isActive,
      productCount: productCount ?? undefined,
      createdAt: brand.createdAt.toISOString(),
      createdAtFa: this.formatDateTimeFa(brand.createdAt),
      updatedAt: brand.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTimeFa(brand.updatedAt),
      deletedAt: this.toIsoStringNullable(brand.deletedAt),
      deletedAtFa: this.formatDateTimeFaNullable(brand.deletedAt),
    };
  }

  private buildPagination(query: QueryBrandDto) {
    const page = Math.max(1, Number(query.page ?? 1));

    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));

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

  private parseDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('مقدار تاریخ نامعتبر است.');
    }

    return date;
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

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    return Number(value);
  }
}
