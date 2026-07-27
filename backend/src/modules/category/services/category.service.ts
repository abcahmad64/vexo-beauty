import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { CreateCategoryDto } from '../dto/create-category.dto';

import { QueryCategoryDto } from '../dto/query-category.dto';

import { UpdateCategoryDto } from '../dto/update-category.dto';

import { CategoryEventPublisher } from '../events/category.event.publisher';

type ProductCountRow = {
  total_products: number | bigint;
  active_products: number | bigint;
};

type CategoryParent = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  deletedAt: Date | null;
};

type CategoryEntity = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  parent?: CategoryParent | null;
};

type CategoryProductCount = {
  totalProducts: number;
  activeProducts: number;
};

type CategoryParentResponse = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  deletedAt: string | null;
  deletedAtFa: string | null;
};

type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  parent: CategoryParentResponse | null;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount?: CategoryProductCount;
  createdAt: string;
  createdAtFa: string;
  updatedAt: string;
  updatedAtFa: string;
  deletedAt: string | null;
  deletedAtFa: string | null;
  children?: CategoryRecord[];
};

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: CategoryEventPublisher,
  ) {}

  private readonly categorySelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    parentId: true,
    image: true,
    isActive: true,
    sortOrder: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    parent: {
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        deletedAt: true,
      },
    },
  } satisfies Prisma.CategorySelect;

  async create(dto: CreateCategoryDto, actorId?: string) {
    const name = dto.name.trim();

    const parentId = dto.parentId ?? null;

    if (parentId) {
      await this.assertParentExists(parentId);
    }

    const slug = dto.slug
      ? this.normalizeSlug(dto.slug)
      : await this.generateUniqueSlug(name);

    await this.assertNameUnique(name);
    await this.assertSlugUnique(slug);

    const category = await this.prisma.category.create({
      data: {
        name,
        slug,
        description: dto.description ?? null,
        parentId,
        image: dto.image ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      select: this.categorySelect,
    });

    this.eventPublisher.publishCreated({
      categoryId: category.id,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId,
      actorId,
      occurredAt: new Date(),
    });

    return this.mapCategory(category, {
      totalProducts: 0,
      activeProducts: 0,
    });
  }

  async findAllPublic(query: QueryCategoryDto) {
    const normalizedQuery = {
      ...query,
      isActive: query.isActive ?? true,
      includeDeleted: false,
    };

    if (normalizedQuery.tree === true) {
      return this.findTree(normalizedQuery);
    }

    return this.findAll(normalizedQuery);
  }

  async findAllForAdmin(query: QueryCategoryDto) {
    if (query.tree === true) {
      return this.findTree(query);
    }

    return this.findAll(query);
  }

  async findOnePublic(categoryId: string) {
    const category = await this.findCategoryEntity(categoryId, false);

    if (!category.isActive) {
      throw new NotFoundException('دسته‌بندی موردنظر یافت نشد.');
    }

    return this.mapCategory(category, await this.getProductCount(category.id));
  }

  async findBySlugPublic(slug: string) {
    const category = await this.findCategoryBySlug(slug, false);

    if (!category.isActive) {
      throw new NotFoundException('دسته‌بندی موردنظر یافت نشد.');
    }

    return this.mapCategory(category, await this.getProductCount(category.id));
  }

  async findOneForAdmin(categoryId: string, includeDeleted = false) {
    const category = await this.findCategoryEntity(categoryId, includeDeleted);

    return this.mapCategory(category, await this.getProductCount(category.id));
  }

  async findBySlugForAdmin(slug: string, includeDeleted = false) {
    const category = await this.findCategoryBySlug(slug, includeDeleted);

    return this.mapCategory(category, await this.getProductCount(category.id));
  }

  async update(categoryId: string, dto: UpdateCategoryDto, actorId?: string) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی دسته‌بندی ارسال نشده است.',
      );
    }

    const current = await this.findCategoryEntity(categoryId, false);

    const data: Prisma.CategoryUpdateInput = {};

    if (dto.name !== undefined && dto.name !== current.name) {
      const name = dto.name.trim();

      await this.assertNameUnique(name, categoryId);

      data.name = name;

      if (dto.slug === undefined) {
        data.slug = await this.generateUniqueSlug(name, categoryId);
      }
    }

    if (dto.slug !== undefined) {
      const slug = dto.slug
        ? this.normalizeSlug(dto.slug)
        : await this.generateUniqueSlug(dto.name ?? current.name, categoryId);

      await this.assertSlugUnique(slug, categoryId);

      data.slug = slug;
    }

    if (dto.description !== undefined) {
      data.description = dto.description;
    }

    if (dto.parentId !== undefined) {
      const nextParentId = dto.parentId ?? null;

      if (nextParentId === categoryId) {
        throw new BadRequestException('دسته‌بندی نمی‌تواند والد خودش باشد.');
      }

      if (nextParentId) {
        await this.assertParentExists(nextParentId);

        await this.assertNoCircularParent(categoryId, nextParentId);
      }

      data.parent = nextParentId
        ? {
            connect: {
              id: nextParentId,
            },
          }
        : {
            disconnect: true,
          };
    }

    if (dto.image !== undefined) {
      data.image = dto.image;
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
    }

    const updated = await this.prisma.category.update({
      where: {
        id: categoryId,
      },
      data,
      select: this.categorySelect,
    });

    this.eventPublisher.publishUpdated({
      categoryId: updated.id,
      name: updated.name,
      slug: updated.slug,
      changedFields: Object.keys(dto),
      actorId,
      occurredAt: new Date(),
    });

    if (dto.parentId !== undefined && current.parentId !== updated.parentId) {
      this.eventPublisher.publishMoved({
        categoryId: updated.id,
        name: updated.name,
        slug: updated.slug,
        previousParentId: current.parentId,
        currentParentId: updated.parentId,
        actorId,
        occurredAt: new Date(),
      });
    }

    return this.mapCategory(updated, await this.getProductCount(updated.id));
  }

  async activate(categoryId: string, actorId?: string) {
    const category = await this.findCategoryEntity(categoryId, false);

    const updated = await this.prisma.category.update({
      where: {
        id: category.id,
      },
      data: {
        isActive: true,
      },
      select: this.categorySelect,
    });

    this.eventPublisher.publishActivated({
      categoryId: updated.id,
      name: updated.name,
      slug: updated.slug,
      actorId,
      occurredAt: new Date(),
    });

    return this.mapCategory(updated, await this.getProductCount(updated.id));
  }

  async deactivate(categoryId: string, actorId?: string) {
    const category = await this.findCategoryEntity(categoryId, false);

    const updated = await this.prisma.category.update({
      where: {
        id: category.id,
      },
      data: {
        isActive: false,
      },
      select: this.categorySelect,
    });

    this.eventPublisher.publishDeactivated({
      categoryId: updated.id,
      name: updated.name,
      slug: updated.slug,
      actorId,
      occurredAt: new Date(),
    });

    return this.mapCategory(updated, await this.getProductCount(updated.id));
  }

  async remove(categoryId: string, actorId?: string) {
    const category = await this.findCategoryEntity(categoryId, false);

    const productCount = await this.getProductCount(category.id);

    if (productCount.totalProducts > 0) {
      throw new BadRequestException(
        'این دسته‌بندی دارای محصول است و قابل حذف نیست. ابتدا محصولات را منتقل کنید یا دسته‌بندی را غیرفعال کنید.',
      );
    }

    const childrenCount = await this.getActiveChildrenCount(category.id);

    if (childrenCount > 0) {
      throw new BadRequestException(
        'این دسته‌بندی دارای زیرمجموعه فعال است و قابل حذف نیست. ابتدا زیرمجموعه‌ها را منتقل یا حذف کنید.',
      );
    }

    const deletedAt = new Date();

    await this.prisma.category.update({
      where: {
        id: category.id,
      },
      data: {
        isActive: false,
        deletedAt,
      },
    });

    this.eventPublisher.publishDeleted({
      categoryId: category.id,
      name: category.name,
      slug: category.slug,
      actorId,
      occurredAt: deletedAt,
    });

    return {
      deletedAt: deletedAt.toISOString(),
      deletedAtFa: this.formatDateTimeFaNullable(deletedAt),
      audit: {
        actorId: actorId ?? null,
        action: 'category.deleted',
      },
    };
  }

  async restore(categoryId: string, actorId?: string) {
    const category = await this.findCategoryEntity(categoryId, true);

    if (!category.deletedAt) {
      return this.findOneForAdmin(categoryId);
    }

    if (category.parentId) {
      await this.assertParentExists(category.parentId);
    }

    const restoredAt = new Date();

    const restored = await this.prisma.category.update({
      where: {
        id: category.id,
      },
      data: {
        deletedAt: null,
        isActive: true,
        updatedAt: restoredAt,
      },
      select: this.categorySelect,
    });

    this.eventPublisher.publishRestored({
      categoryId: restored.id,
      name: restored.name,
      slug: restored.slug,
      actorId,
      occurredAt: restoredAt,
    });

    return this.mapCategory(restored, await this.getProductCount(restored.id));
  }

  async getProductCount(categoryId: string) {
    const rows = await this.prisma.$queryRaw<ProductCountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS total_products,
            COUNT(*) FILTER (
              WHERE p."isActive" = true
                AND p."status"::text = 'ACTIVE'
            )::int AS active_products
          FROM "Product" p
          WHERE p."categoryId" = ${categoryId}
            AND p."deleted_at" IS NULL
        `,
    );

    return {
      totalProducts: this.toNumber(rows[0]?.total_products),
      activeProducts: this.toNumber(rows[0]?.active_products),
    };
  }

  private async findAll(query: QueryCategoryDto) {
    const { page, limit, skip } = this.buildPagination(query);

    const where = this.buildWhere(query);

    const [categories, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        select: this.categorySelect,
        orderBy: [
          {
            sortOrder: 'asc',
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
      this.prisma.category.count({
        where,
      }),
    ]);

    const data =
      query.withProductCount === false
        ? categories.map((category) => this.mapCategory(category))
        : await Promise.all(
            categories.map(async (category) =>
              this.mapCategory(
                category,
                await this.getProductCount(category.id),
              ),
            ),
          );

    return this.buildPaginatedResult(data, total, page, limit);
  }

  private async findTree(query: QueryCategoryDto) {
    const where = this.buildWhere({
      ...query,
      rootOnly: false,
    });

    const categories = await this.prisma.category.findMany({
      where,
      select: this.categorySelect,
      orderBy: [
        {
          sortOrder: 'asc',
        },
        {
          name: 'asc',
        },
        {
          id: 'asc',
        },
      ],
    });

    const mapped =
      query.withProductCount === false
        ? categories.map((category) => this.mapCategory(category))
        : await Promise.all(
            categories.map(async (category) =>
              this.mapCategory(
                category,
                await this.getProductCount(category.id),
              ),
            ),
          );

    return this.buildTree(mapped);
  }

  private buildTree(categories: CategoryRecord[]) {
    const byId = new Map<string, CategoryRecord>();

    const roots: CategoryRecord[] = [];

    for (const category of categories) {
      byId.set(category.id, {
        ...category,
        children: [],
      });
    }

    for (const category of byId.values()) {
      if (category.parentId && byId.has(category.parentId)) {
        byId.get(category.parentId)?.children?.push(category);
      } else {
        roots.push(category);
      }
    }

    return roots;
  }

  private buildWhere(query: QueryCategoryDto): Prisma.CategoryWhereInput {
    const where: Prisma.CategoryWhereInput = {};

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

    if (query.parentId) {
      where.parentId = query.parentId;
    }

    if (query.rootOnly === true) {
      where.parentId = null;
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

  private async findCategoryEntity(
    categoryId: string,
    includeDeleted: boolean,
  ): Promise<CategoryEntity> {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        ...(includeDeleted
          ? {}
          : {
              deletedAt: null,
            }),
      },
      select: this.categorySelect,
    });

    if (!category) {
      throw new NotFoundException('دسته‌بندی موردنظر یافت نشد.');
    }

    return category;
  }

  private async findCategoryBySlug(
    slug: string,
    includeDeleted: boolean,
  ): Promise<CategoryEntity> {
    const category = await this.prisma.category.findFirst({
      where: {
        slug: this.normalizeSlug(slug),
        ...(includeDeleted
          ? {}
          : {
              deletedAt: null,
            }),
      },
      select: this.categorySelect,
    });

    if (!category) {
      throw new NotFoundException('دسته‌بندی موردنظر یافت نشد.');
    }

    return category;
  }

  private async assertParentExists(parentId: string) {
    const parent = await this.prisma.category.findFirst({
      where: {
        id: parentId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!parent) {
      throw new BadRequestException('دسته‌بندی والد یافت نشد.');
    }
  }

  private async assertNoCircularParent(
    categoryId: string,
    nextParentId: string,
  ) {
    let currentParentId: string | null = nextParentId;

    const visited = new Set<string>();

    while (currentParentId) {
      if (currentParentId === categoryId) {
        throw new BadRequestException(
          'انتخاب این والد باعث ایجاد چرخه در درخت دسته‌بندی می‌شود.',
        );
      }

      if (visited.has(currentParentId)) {
        throw new BadRequestException(
          'چرخه نامعتبر در درخت دسته‌بندی شناسایی شد.',
        );
      }

      visited.add(currentParentId);

      const parent = await this.prisma.category.findFirst({
        where: {
          id: currentParentId,
          deletedAt: null,
        },
        select: {
          parentId: true,
        },
      });

      const parentResult: unknown = parent;

      const parentRecord =
        parentResult !== null &&
        typeof parentResult === 'object' &&
        !Array.isArray(parentResult)
          ? (parentResult as Record<string, unknown>)
          : null;

      const parentId = parentRecord?.parentId;

      currentParentId = typeof parentId === 'string' ? parentId : null;
    }
  }

  private async assertNameUnique(name: string, excludeCategoryId?: string) {
    const existing = await this.prisma.category.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
        ...(excludeCategoryId
          ? {
              id: {
                not: excludeCategoryId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException('نام دسته‌بندی تکراری است.');
    }
  }

  private async assertSlugUnique(slug: string, excludeCategoryId?: string) {
    const existing = await this.prisma.category.findFirst({
      where: {
        slug,
        ...(excludeCategoryId
          ? {
              id: {
                not: excludeCategoryId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException('اسلاگ دسته‌بندی تکراری است.');
    }
  }

  private async generateUniqueSlug(value: string, excludeCategoryId?: string) {
    const base = this.normalizeSlug(value);

    if (!base) {
      throw new BadRequestException('امکان ساخت اسلاگ دسته‌بندی وجود ندارد.');
    }

    const rows = await this.prisma.category.findMany({
      where: {
        slug: {
          startsWith: base,
        },
        ...(excludeCategoryId
          ? {
              id: {
                not: excludeCategoryId,
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

  private async getActiveChildrenCount(categoryId: string) {
    const count = await this.prisma.category.count({
      where: {
        parentId: categoryId,
        deletedAt: null,
      },
    });

    return count;
  }

  private normalizeSlug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180);
  }

  private mapCategory(
    category: CategoryEntity,
    productCount?: CategoryProductCount,
  ): CategoryRecord {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
      parent: category.parent
        ? {
            id: category.parent.id,
            name: category.parent.name,
            slug: category.parent.slug,
            isActive: category.parent.isActive,
            deletedAt: this.toIsoStringNullable(category.parent.deletedAt),
            deletedAtFa: this.formatDateTimeFaNullable(
              category.parent.deletedAt,
            ),
          }
        : null,
      image: category.image,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      productCount: productCount ?? undefined,
      createdAt: category.createdAt.toISOString(),
      createdAtFa: this.formatDateTimeFa(category.createdAt),
      updatedAt: category.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTimeFa(category.updatedAt),
      deletedAt: this.toIsoStringNullable(category.deletedAt),
      deletedAtFa: this.formatDateTimeFaNullable(category.deletedAt),
    };
  }

  private buildPagination(query: QueryCategoryDto) {
    const page = Math.max(1, Number(query.page ?? 1));

    const limit = Math.min(200, Math.max(1, Number(query.limit ?? 20)));

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
