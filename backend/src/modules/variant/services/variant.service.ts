import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, ProductVariant } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { CreateVariantDto } from '../dto/create-variant.dto';

import { QueryVariantDto } from '../dto/query-variant.dto';

import { UpdateVariantDto } from '../dto/update-variant.dto';

import { VariantEventPublisher } from '../events/variant.event.publisher';

type ProductContextRow = {
  id: string;
  name: string;
  sku: string;
  price: Prisma.Decimal;
  status: string;
  is_active: boolean;
  deleted_at: Date | null;
};

type InventorySummaryRow = {
  total_stock: number | bigint;
  reserved_stock: number | bigint;
  available_stock: number | bigint;
  warehouse_count: number | bigint;
};

type VariantWithExtras = ProductVariant & {
  product?: {
    id: string;
    name: string;
    sku: string;
    price: string;
    status: string;
    isActive: boolean;
  };
  effectivePrice?: string;
  inventorySummary?: {
    totalStock: number;
    reservedStock: number;
    availableStock: number;
    warehouseCount: number;
  };
};

@Injectable()
export class VariantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: VariantEventPublisher,
  ) {}

  private readonly variantSelect = {
    id: true,
    productId: true,
    sku: true,
    barcode: true,
    gtin: true,
    mpn: true,
    name: true,
    slug: true,
    price: true,
    comparePrice: true,
    weight: true,
    imageUrl: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
  } satisfies Prisma.ProductVariantSelect;

  async create(productId: string, dto: CreateVariantDto, actorId?: string) {
    const product = await this.assertProductExists(productId, false);

    const sku = this.normalizeSku(dto.sku);

    await this.assertSkuUnique(sku);

    this.assertPrices(dto.price, dto.comparePrice, product.price.toString());

    const slug = dto.slug
      ? this.normalizeSlug(dto.slug)
      : this.generateSlugFromVariant(dto.name, sku);

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        sku,
        name: dto.name ?? null,
        slug,
        price: dto.price === undefined ? null : new Prisma.Decimal(dto.price),
        comparePrice:
          dto.comparePrice === undefined
            ? null
            : new Prisma.Decimal(dto.comparePrice),
        weight: dto.weight ?? null,
        imageUrl: dto.imageUrl ?? null,
        isActive: dto.isActive ?? true,
      },
      select: this.variantSelect,
    });

    this.eventPublisher.publishCreated({
      variantId: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      actorId,
      occurredAt: new Date(),
    });

    return this.mapVariant(variant, product);
  }

  async findPublicByProduct(productId: string, query: QueryVariantDto = {}) {
    const product = await this.assertProductExists(productId, true);

    return this.findAll(
      {
        ...query,
        productId,
        isActive: true,
        includeDeleted: false,
        includeProduct: query.includeProduct ?? true,
      },
      {
        publicProduct: product,
      },
    );
  }

  async findAllForAdmin(query: QueryVariantDto) {
    return this.findAll(query);
  }

  async findByProductForAdmin(productId: string, query: QueryVariantDto = {}) {
    await this.assertProductExists(productId, false);

    return this.findAll({
      ...query,
      productId,
    });
  }

  async findOnePublic(variantId: string) {
    const variant = await this.findVariantEntity(variantId, false);

    if (!variant.isActive) {
      throw new NotFoundException('Variant not found');
    }

    const product = await this.assertProductExists(variant.productId, true);

    return this.mapVariant(
      variant,
      product,
      await this.getInventorySummary(variant.id),
    );
  }

  async findBySkuPublic(sku: string) {
    const variant = await this.findVariantBySku(sku, false);

    if (!variant.isActive) {
      throw new NotFoundException('Variant not found');
    }

    const product = await this.assertProductExists(variant.productId, true);

    return this.mapVariant(
      variant,
      product,
      await this.getInventorySummary(variant.id),
    );
  }

  async findOneForAdmin(variantId: string, includeDeleted = false) {
    const variant = await this.findVariantEntity(variantId, includeDeleted);

    const product = await this.assertProductExists(
      variant.productId,
      true,
      true,
    );

    return this.mapVariant(
      variant,
      product,
      await this.getInventorySummary(variant.id),
    );
  }

  async findBySkuForAdmin(sku: string, includeDeleted = false) {
    const variant = await this.findVariantBySku(sku, includeDeleted);

    const product = await this.assertProductExists(
      variant.productId,
      true,
      true,
    );

    return this.mapVariant(
      variant,
      product,
      await this.getInventorySummary(variant.id),
    );
  }

  async update(variantId: string, dto: UpdateVariantDto, actorId?: string) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('No fields provided for variant update');
    }

    const current = await this.findVariantEntity(variantId, false);

    const product = await this.assertProductExists(current.productId, false);

    if (dto.sku !== undefined && dto.sku !== null) {
      const sku = this.normalizeSku(dto.sku);

      if (sku !== current.sku) {
        await this.assertSkuUnique(sku, variantId);
      }
    }

    const nextPrice =
      dto.price === undefined ? (current.price?.toString() ?? null) : dto.price;

    const nextComparePrice =
      dto.comparePrice === undefined
        ? (current.comparePrice?.toString() ?? null)
        : dto.comparePrice;

    this.assertPrices(nextPrice, nextComparePrice, product.price.toString());

    const data: Prisma.ProductVariantUpdateInput = {};

    if (dto.sku !== undefined) {
      data.sku = dto.sku ? this.normalizeSku(dto.sku) : current.sku;
    }

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.slug !== undefined) {
      data.slug = dto.slug
        ? this.normalizeSlug(dto.slug)
        : this.generateSlugFromVariant(
            dto.name ?? current.name,
            dto.sku ?? current.sku,
          );
    }

    if (dto.price !== undefined) {
      data.price = dto.price ? new Prisma.Decimal(dto.price) : null;
    }

    if (dto.comparePrice !== undefined) {
      data.comparePrice = dto.comparePrice
        ? new Prisma.Decimal(dto.comparePrice)
        : null;
    }

    if (dto.weight !== undefined) {
      data.weight = dto.weight;
    }

    if (dto.imageUrl !== undefined) {
      data.imageUrl = dto.imageUrl;
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    const updated = await this.prisma.productVariant.update({
      where: {
        id: variantId,
      },
      data,
      select: this.variantSelect,
    });

    this.eventPublisher.publishUpdated({
      variantId: updated.id,
      productId: updated.productId,
      sku: updated.sku,
      changedFields: Object.keys(dto),
      actorId,
      occurredAt: new Date(),
    });

    if (dto.price !== undefined || dto.comparePrice !== undefined) {
      this.eventPublisher.publishPriceChanged({
        variantId: updated.id,
        productId: updated.productId,
        sku: updated.sku,
        previousPrice: current.price?.toString() ?? null,
        currentPrice: updated.price?.toString() ?? null,
        previousComparePrice: current.comparePrice?.toString() ?? null,
        currentComparePrice: updated.comparePrice?.toString() ?? null,
        actorId,
        occurredAt: new Date(),
      });
    }

    if (dto.imageUrl !== undefined) {
      this.eventPublisher.publishImageUpdated({
        variantId: updated.id,
        productId: updated.productId,
        sku: updated.sku,
        imageUrl: updated.imageUrl,
        actorId,
        occurredAt: new Date(),
      });
    }

    return this.mapVariant(
      updated,
      product,
      await this.getInventorySummary(updated.id),
    );
  }

  async activate(variantId: string, actorId?: string) {
    const variant = await this.findVariantEntity(variantId, false);

    await this.assertProductExists(variant.productId, false);

    const updated = await this.prisma.productVariant.update({
      where: {
        id: variant.id,
      },
      data: {
        isActive: true,
      },
      select: this.variantSelect,
    });

    this.eventPublisher.publishActivated({
      variantId: updated.id,
      productId: updated.productId,
      sku: updated.sku,
      actorId,
      occurredAt: new Date(),
    });

    return this.findOneForAdmin(updated.id);
  }

  async deactivate(variantId: string, actorId?: string) {
    const variant = await this.findVariantEntity(variantId, false);

    const updated = await this.prisma.productVariant.update({
      where: {
        id: variant.id,
      },
      data: {
        isActive: false,
      },
      select: this.variantSelect,
    });

    this.eventPublisher.publishDeactivated({
      variantId: updated.id,
      productId: updated.productId,
      sku: updated.sku,
      actorId,
      occurredAt: new Date(),
    });

    return this.findOneForAdmin(updated.id);
  }

  async remove(variantId: string, actorId?: string) {
    const variant = await this.findVariantEntity(variantId, false);

    const updated = await this.prisma.productVariant.update({
      where: {
        id: variant.id,
      },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
      select: this.variantSelect,
    });

    this.eventPublisher.publishDeleted({
      variantId: updated.id,
      productId: updated.productId,
      sku: updated.sku,
      actorId,
      occurredAt: new Date(),
    });

    return {
      success: true,
      message: 'Variant deleted successfully',
    };
  }

  async restore(variantId: string, actorId?: string) {
    const variant = await this.findVariantEntity(variantId, true);

    await this.assertProductExists(variant.productId, false);

    if (!variant.deletedAt) {
      return this.findOneForAdmin(variant.id);
    }

    const restored = await this.prisma.productVariant.update({
      where: {
        id: variant.id,
      },
      data: {
        deletedAt: null,
        isActive: true,
      },
      select: this.variantSelect,
    });

    this.eventPublisher.publishRestored({
      variantId: restored.id,
      productId: restored.productId,
      sku: restored.sku,
      actorId,
      occurredAt: new Date(),
    });

    return this.findOneForAdmin(restored.id);
  }

  async getInventorySummary(variantId: string) {
    const rows = await this.prisma.$queryRaw<InventorySummaryRow[]>(
      Prisma.sql`
          SELECT
            COALESCE(SUM(i."quantity"), 0)::int AS total_stock,
            COALESCE(SUM(i."reservedQuantity"), 0)::int AS reserved_stock,
            COALESCE(SUM(i."quantity" - i."reservedQuantity"), 0)::int AS available_stock,
            COUNT(DISTINCT i."warehouseId")::int AS warehouse_count
          FROM "Inventory" i
          WHERE i."variantId" = ${variantId}
            AND i."deleted_at" IS NULL
        `,
    );

    return {
      totalStock: this.toNumber(rows[0]?.total_stock),
      reservedStock: this.toNumber(rows[0]?.reserved_stock),
      availableStock: this.toNumber(rows[0]?.available_stock),
      warehouseCount: this.toNumber(rows[0]?.warehouse_count),
    };
  }

  private async findAll(
    query: QueryVariantDto,
    context?: {
      publicProduct?: ProductContextRow;
    },
  ) {
    const { page, limit, skip } = this.buildPagination(query);

    const where = this.buildWhere(query);

    const [variants, total] = await this.prisma.$transaction([
      this.prisma.productVariant.findMany({
        where,
        select: this.variantSelect,
        orderBy: [
          {
            isActive: 'desc',
          },
          {
            createdAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],
        skip,
        take: limit,
      }),
      this.prisma.productVariant.count({
        where,
      }),
    ]);

    const data = await Promise.all(
      variants.map(async (variant) => {
        const product =
          context?.publicProduct ??
          (query.includeProduct !== false
            ? await this.assertProductExists(variant.productId, true, true)
            : undefined);

        const inventorySummary =
          query.includeInventorySummary === true
            ? await this.getInventorySummary(variant.id)
            : undefined;

        return this.mapVariant(variant, product, inventorySummary);
      }),
    );

    return this.buildPaginatedResult(data, total, page, limit);
  }

  private buildWhere(query: QueryVariantDto): Prisma.ProductVariantWhereInput {
    const where: Prisma.ProductVariantWhereInput = {};

    if (query.includeDeleted !== true) {
      where.deletedAt = null;
    }

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.q) {
      where.OR = [
        {
          sku: {
            contains: query.q,
            mode: 'insensitive',
          },
        },
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
      ];
    }

    if (query.sku) {
      where.sku = {
        contains: this.normalizeSku(query.sku),
        mode: 'insensitive',
      };
    }

    if (query.slug) {
      where.slug = {
        contains: this.normalizeSlug(query.slug),
        mode: 'insensitive',
      };
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

  private async findVariantEntity(variantId: string, includeDeleted: boolean) {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        ...(includeDeleted
          ? {}
          : {
              deletedAt: null,
            }),
      },
      select: this.variantSelect,
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return variant;
  }

  private async findVariantBySku(sku: string, includeDeleted: boolean) {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        sku: this.normalizeSku(sku),
        ...(includeDeleted
          ? {}
          : {
              deletedAt: null,
            }),
      },
      select: this.variantSelect,
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return variant;
  }

  private async assertProductExists(
    productId: string,
    publicOnly: boolean,
    includeDeleted = false,
  ): Promise<ProductContextRow> {
    const deletedSql = includeDeleted
      ? Prisma.empty
      : Prisma.sql`AND p."deleted_at" IS NULL`;

    const publicSql = publicOnly
      ? Prisma.sql`
            AND p."isActive" = true
            AND p."status"::text = 'ACTIVE'
          `
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<ProductContextRow[]>(
      Prisma.sql`
          SELECT
            p."id",
            p."name",
            p."sku",
            p."price",
            p."status"::text AS status,
            p."isActive" AS is_active,
            p."deleted_at" AS deleted_at
          FROM "Product" p
          WHERE p."id" = ${productId}
          ${deletedSql}
          ${publicSql}
          LIMIT 1
        `,
    );

    const product = rows[0];

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private async assertSkuUnique(sku: string, excludeVariantId?: string) {
    const existing = await this.prisma.productVariant.findFirst({
      where: {
        sku: this.normalizeSku(sku),
        ...(excludeVariantId
          ? {
              id: {
                not: excludeVariantId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException('Variant SKU already exists');
    }
  }

  private assertPrices(
    price?: string | null,
    comparePrice?: string | null,
    productBasePrice?: string | null,
  ) {
    const resolvedPrice = price
      ? new Prisma.Decimal(price)
      : productBasePrice
        ? new Prisma.Decimal(productBasePrice)
        : null;

    const resolvedComparePrice = comparePrice
      ? new Prisma.Decimal(comparePrice)
      : null;

    if (resolvedPrice && resolvedPrice.lessThan(0)) {
      throw new BadRequestException('Variant price cannot be negative');
    }

    if (resolvedComparePrice && resolvedComparePrice.lessThan(0)) {
      throw new BadRequestException('Variant comparePrice cannot be negative');
    }

    if (
      resolvedPrice &&
      resolvedComparePrice &&
      resolvedComparePrice.lessThan(resolvedPrice)
    ) {
      throw new BadRequestException('comparePrice cannot be less than price');
    }
  }

  private mapVariant(
    variant: ProductVariant,
    product?: ProductContextRow,
    inventorySummary?: {
      totalStock: number;
      reservedStock: number;
      availableStock: number;
      warehouseCount: number;
    },
  ): VariantWithExtras {
    const effectivePrice =
      variant.price?.toString() ?? product?.price?.toString() ?? null;

    return {
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      barcode: variant.barcode,
      gtin: variant.gtin,
      mpn: variant.mpn,
      name: variant.name,
      slug: variant.slug,
      price: variant.price,
      comparePrice: variant.comparePrice,
      weight: variant.weight,
      imageUrl: variant.imageUrl,
      isActive: variant.isActive,
      effectivePrice: effectivePrice ?? undefined,
      product: product
        ? {
            id: product.id,
            name: product.name,
            sku: product.sku,
            price: product.price.toString(),
            status: product.status,
            isActive: product.is_active,
          }
        : undefined,
      inventorySummary: inventorySummary ?? undefined,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
      deletedAt: variant.deletedAt,
    };
  }

  private normalizeSku(value: string) {
    return value.trim().toUpperCase();
  }

  private normalizeSlug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private generateSlugFromVariant(
    name: string | null | undefined,
    sku: string,
  ) {
    const source = name && name.trim().length > 0 ? name : sku;

    return this.normalizeSlug(source);
  }

  private buildPagination(query: QueryVariantDto) {
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
      throw new BadRequestException('Invalid date value');
    }

    return date;
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (value instanceof Prisma.Decimal) {
      return value.toNumber();
    }

    return Number(value);
  }
}
