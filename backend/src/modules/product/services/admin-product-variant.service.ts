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

import { AdminCreateProductVariantDto } from '../dto/admin-create-product-variant.dto';

import { AdminQueryProductVariantDto } from '../dto/admin-query-product-variant.dto';

import { AdminUpdateProductVariantDto } from '../dto/admin-update-product-variant.dto';

import { AdminUpdateVariantStockDto } from '../dto/admin-update-variant-stock.dto';

type CountRow = {
  count: number | bigint;
};

type ProductVariantRow = {
  id: string;
  productId: string;
  productName: string | null;
  productSlug: string | null;
  productSku: string | null;
  sku: string;
  name: string | null;
  slug: string | null;
  barcode: string | null;
  gtin: string | null;
  mpn: string | null;
  price: Prisma.Decimal | number | string | null;
  comparePrice: Prisma.Decimal | number | string | null;
  weight: number | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  totalQuantity: number | bigint | null;
  reservedQuantity: number | bigint | null;
  availableStock: number | bigint | null;
  lowStockThreshold: number | bigint | null;
};

type VariantAttributeRow = {
  attributeId: string;
  attributeName: string;
  attributeValueId: string;
  value: string;
};

type VariantInventoryRow = {
  inventoryId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  quantity: number | bigint;
  reservedQuantity: number | bigint;
  availableQuantity: number | bigint;
  lowStockThreshold: number | bigint;
  createdAt: Date;
  updatedAt: Date;
};

type ProductVariantResponse = {
  id: string;
  product: {
    id: string;
    name: string | null;
    slug: string | null;
    sku: string | null;
  };
  sku: string;
  name: string | null;
  slug: string | null;
  barcode: string | null;
  gtin: string | null;
  mpn: string | null;
  price: string | null;
  comparePrice: string | null;
  weight: number | null;
  imageUrl: string | null;
  isActive: boolean;
  stock: {
    totalQuantity: number;
    reservedQuantity: number;
    availableStock: number;
    lowStockThreshold: number;
  };
  createdAt: string;
  createdAtFa: string;
  updatedAt: string;
  updatedAtFa: string;
  deletedAt: string | null;
  deletedAtFa: string | null;
};

@Injectable()
export class AdminProductVariantService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminQueryProductVariantDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildVariantWhere(query, 'pv');

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<ProductVariantRow[]>(
        Prisma.sql`
            SELECT
              pv."id",
              pv."productId",
              p."name" AS "productName",
              p."slug" AS "productSlug",
              p."sku" AS "productSku",
              pv."sku",
              pv."name",
              pv."slug",
              pv."barcode",
              pv."gtin",
              pv."mpn",
              pv."price",
              pv."comparePrice",
              pv."weight",
              pv."imageUrl",
              pv."isActive",
              pv."createdAt",
              pv."updatedAt",
              pv."deleted_at" AS "deletedAt",
              COALESCE(stock."totalQuantity", 0)::int AS "totalQuantity",
              COALESCE(stock."reservedQuantity", 0)::int AS "reservedQuantity",
              COALESCE(stock."availableStock", 0)::int AS "availableStock",
              COALESCE(stock."lowStockThreshold", 0)::int AS "lowStockThreshold"
            FROM "ProductVariant" pv
            INNER JOIN "Product" p
              ON p."id" = pv."productId"
            LEFT JOIN LATERAL (
              SELECT
                COALESCE(SUM(i."quantity"), 0) AS "totalQuantity",
                COALESCE(SUM(i."reservedQuantity"), 0) AS "reservedQuantity",
                COALESCE(SUM(GREATEST(i."quantity" - i."reservedQuantity", 0)), 0) AS "availableStock",
                COALESCE(MAX(i."lowStockThreshold"), 0) AS "lowStockThreshold"
              FROM "Inventory" i
              WHERE i."variantId" = pv."id"
            ) stock ON TRUE
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolveSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              pv."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "ProductVariant" pv
            INNER JOIN "Product" p
              ON p."id" = pv."productId"
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapVariant(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(variantId: string) {
    const variant = await this.findVariantRow(variantId, true);

    const [attributes, inventories] = await Promise.all([
      this.findVariantAttributes(variantId),
      this.findVariantInventories(variantId),
    ]);

    return {
      ...this.mapVariant(variant),
      attributes: attributes.map((attribute) => ({
        attributeId: attribute.attributeId,
        attributeName: attribute.attributeName,
        attributeValueId: attribute.attributeValueId,
        value: attribute.value,
      })),
      inventories: inventories.map((inventory) => ({
        inventoryId: inventory.inventoryId,
        warehouseId: inventory.warehouseId,
        warehouseName: inventory.warehouseName,
        warehouseCode: inventory.warehouseCode,
        quantity: this.toNumber(inventory.quantity),
        reservedQuantity: this.toNumber(inventory.reservedQuantity),
        availableQuantity: this.toNumber(inventory.availableQuantity),
        lowStockThreshold: this.toNumber(inventory.lowStockThreshold),
        createdAt: inventory.createdAt.toISOString(),
        createdAtFa: this.formatDateTimeFa(inventory.createdAt),
        updatedAt: inventory.updatedAt.toISOString(),
        updatedAtFa: this.formatDateTimeFa(inventory.updatedAt),
      })),
    };
  }

  async create(dto: AdminCreateProductVariantDto, actorId?: string) {
    await this.assertProductExists(dto.productId);

    const variantId = randomUUID();

    const slug = dto.slug ?? (dto.name ? this.slugify(dto.name) : null);

    const barcode = this.normalizeIdentifier(dto.barcode);

    const gtin = this.normalizeGtin(dto.gtin);

    const mpn = this.normalizeIdentifier(dto.mpn);

    this.assertValidGtin(gtin);

    this.assertValidPrices(dto.price, dto.comparePrice);

    await this.assertSkuUnique(dto.sku);

    await this.assertBarcodeUnique(barcode);

    await this.assertGtinUnique(gtin);

    if (slug) {
      await this.assertSlugUnique(slug);
    }

    await this.assertAttributeValuesExist(dto.attributeValueIds ?? []);

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`
            INSERT INTO "ProductVariant" (
              "id",
              "productId",
              "sku",
              "name",
              "slug",
              "barcode",
              "gtin",
              "mpn",
              "price",
              "comparePrice",
              "weight",
              "imageUrl",
              "isActive",
              "createdAt",
              "updatedAt",
              "deleted_at"
            )
            VALUES (
              ${variantId},
              ${dto.productId},
              ${dto.sku},
              ${dto.name ?? null},
              ${slug},
              ${barcode},
              ${gtin},
              ${mpn},
              ${this.optionalDecimal(dto.price)},
              ${this.optionalDecimal(dto.comparePrice)},
              ${dto.weight ?? null},
              ${dto.imageUrl ?? null},
              ${dto.isActive ?? true},
              ${now},
              ${now},
              NULL
            )
          `,
      );

      await this.syncVariantAttributesTx(
        tx,
        variantId,
        dto.attributeValueIds ?? [],
      );
    });

    return {
      variant: await this.findOne(variantId),
      audit: {
        actorId: actorId ?? null,
        action: 'product_variant.admin_created',
      },
    };
  }

  async update(
    variantId: string,
    dto: AdminUpdateProductVariantDto,
    actorId?: string,
  ) {
    await this.findVariantRow(variantId, true);

    if (dto.sku !== undefined) {
      await this.assertSkuUnique(dto.sku, variantId);
    }

    if (dto.barcode !== undefined) {
      await this.assertBarcodeUnique(
        this.normalizeIdentifier(dto.barcode),
        variantId,
      );
    }

    if (dto.gtin !== undefined) {
      const gtin = this.normalizeGtin(dto.gtin);

      this.assertValidGtin(gtin);

      await this.assertGtinUnique(gtin, variantId);
    }

    if (dto.slug !== undefined) {
      await this.assertSlugUnique(dto.slug, variantId);
    }

    if (dto.price !== undefined || dto.comparePrice !== undefined) {
      this.assertValidPrices(dto.price, dto.comparePrice);
    }

    if (dto.attributeValueIds !== undefined) {
      await this.assertAttributeValuesExist(dto.attributeValueIds);
    }

    const assignments = this.buildUpdateAssignments(dto);

    if (assignments.length === 0 && dto.attributeValueIds === undefined) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی واریانت ارسال نشده است.',
      );
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (assignments.length > 0) {
        await tx.$executeRaw(
          Prisma.sql`
              UPDATE "ProductVariant"
              SET
                ${Prisma.join(assignments, ', ')},
                "updatedAt" = ${now}
              WHERE
                "id" = ${variantId}
                AND "deleted_at" IS NULL
            `,
        );
      }

      if (dto.attributeValueIds !== undefined) {
        await this.syncVariantAttributesTx(
          tx,
          variantId,
          dto.attributeValueIds,
        );
      }
    });

    return {
      variant: await this.findOne(variantId),
      audit: {
        actorId: actorId ?? null,
        action: 'product_variant.admin_updated',
      },
    };
  }

  async updateStock(
    variantId: string,
    dto: AdminUpdateVariantStockDto,
    actorId?: string,
  ) {
    await this.findVariantRow(variantId, true);

    await this.assertWarehouseExists(dto.warehouseId);

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const inventoryId = await this.ensureInventoryTx(
        tx,
        variantId,
        dto.warehouseId,
        dto.lowStockThreshold,
      );

      const inventory = await this.findInventoryForUpdateTx(tx, inventoryId);

      const nextQuantity = this.calculateNextQuantity(
        this.toNumber(inventory.quantity),
        this.toNumber(inventory.reservedQuantity),
        dto,
      );

      await tx.$executeRaw(
        Prisma.sql`
            UPDATE "Inventory"
            SET
              "quantity" = ${nextQuantity},
              "lowStockThreshold" = ${
                dto.lowStockThreshold ??
                this.toNumber(inventory.lowStockThreshold)
              },
              "updatedAt" = ${now}
            WHERE "id" = ${inventoryId}
          `,
      );

      await tx.$executeRaw(
        Prisma.sql`
            INSERT INTO "StockMovement" (
              "id",
              "inventoryId",
              "type",
              "quantity",
              "reason",
              "reference",
              "createdAt"
            )
            VALUES (
              ${randomUUID()},
              ${inventoryId},
              ${dto.type}::"StockMovementType",
              ${dto.quantity},
              ${dto.reason ?? null},
              ${dto.reference ?? `variant-stock:${variantId}`},
              ${now}
            )
          `,
      );
    });

    return {
      variant: await this.findOne(variantId),
      audit: {
        actorId: actorId ?? null,
        action: 'product_variant.stock_updated',
        type: dto.type,
        reason: dto.reason ?? null,
      },
    };
  }

  async activate(variantId: string, actorId?: string) {
    await this.findVariantRow(variantId, true);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "ProductVariant"
        SET
          "isActive" = TRUE,
          "updatedAt" = ${now}
        WHERE
          "id" = ${variantId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      variant: await this.findOne(variantId),
      audit: {
        actorId: actorId ?? null,
        action: 'product_variant.activated',
      },
    };
  }

  async deactivate(variantId: string, actorId?: string) {
    await this.findVariantRow(variantId, true);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "ProductVariant"
        SET
          "isActive" = FALSE,
          "updatedAt" = ${now}
        WHERE
          "id" = ${variantId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      variant: await this.findOne(variantId),
      audit: {
        actorId: actorId ?? null,
        action: 'product_variant.deactivated',
      },
    };
  }

  async delete(variantId: string, actorId?: string) {
    /* ADMIN_VARIANT_SAFE_DELETE_V1 */

    const variant = await this.findVariantRow(
      variantId,
      true,
    );

    if (variant.deletedAt) {
      throw new BadRequestException(
        'واریانت قبلاً حذف شده است.',
      );
    }

    const reservationRows =
      await this.prisma.$queryRaw<
        Array<{
          reservedQuantity: number | bigint;
        }>
      >(
        Prisma.sql`
          SELECT
            COALESCE(
              SUM(i."reservedQuantity"),
              0
            )::int AS "reservedQuantity"
          FROM "Inventory" i
          WHERE i."variantId" = ${variantId}
        `,
      );

    const reservedQuantity = this.toNumber(
      reservationRows[0]?.reservedQuantity,
    );

    if (reservedQuantity > 0) {
      throw new ConflictException(
        'واریانت دارای موجودی رزروشده است و قابل حذف نیست.',
      );
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "ProductVariant"
        SET
          "isActive" = FALSE,
          "deleted_at" = ${now},
          "updatedAt" = ${now}
        WHERE
          "id" = ${variantId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      deletedAt: now.toISOString(),
      deletedAtFa: this.formatDateTimeFaNullable(now),
      audit: {
        actorId: actorId ?? null,
        action: 'product_variant.admin_deleted',
      },
    };
  }

  async findVariantRow(
    variantId: string,
    includeDeleted: boolean,
  ): Promise<ProductVariantRow> {
    const where: Prisma.Sql[] = [Prisma.sql`pv."id" = ${variantId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`pv."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<ProductVariantRow[]>(
      Prisma.sql`
          SELECT
            pv."id",
            pv."productId",
            p."name" AS "productName",
            p."slug" AS "productSlug",
            p."sku" AS "productSku",
            pv."sku",
            pv."name",
            pv."slug",
            pv."barcode",
            pv."gtin",
            pv."mpn",
            pv."price",
            pv."comparePrice",
            pv."weight",
            pv."imageUrl",
            pv."isActive",
            pv."createdAt",
            pv."updatedAt",
            pv."deleted_at" AS "deletedAt",
            COALESCE(stock."totalQuantity", 0)::int AS "totalQuantity",
            COALESCE(stock."reservedQuantity", 0)::int AS "reservedQuantity",
            COALESCE(stock."availableStock", 0)::int AS "availableStock",
            COALESCE(stock."lowStockThreshold", 0)::int AS "lowStockThreshold"
          FROM "ProductVariant" pv
          INNER JOIN "Product" p
            ON p."id" = pv."productId"
          LEFT JOIN LATERAL (
            SELECT
              COALESCE(SUM(i."quantity"), 0) AS "totalQuantity",
              COALESCE(SUM(i."reservedQuantity"), 0) AS "reservedQuantity",
              COALESCE(SUM(GREATEST(i."quantity" - i."reservedQuantity", 0)), 0) AS "availableStock",
              COALESCE(MAX(i."lowStockThreshold"), 0) AS "lowStockThreshold"
            FROM "Inventory" i
            WHERE i."variantId" = pv."id"
          ) stock ON TRUE
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const variant = rows[0];

    if (!variant) {
      throw new NotFoundException('واریانت محصول یافت نشد.');
    }

    return variant;
  }

  private buildVariantWhere(
    query: AdminQueryProductVariantDto,
    alias: string,
  ): Prisma.Sql[] {
    const table = Prisma.raw(alias);

    const where: Prisma.Sql[] = [Prisma.sql`p."deleted_at" IS NULL`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`${table}."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          ${table}."sku" ILIKE ${`%${query.q}%`}
          OR ${table}."barcode" ILIKE ${`%${query.q}%`}
          OR ${table}."gtin" ILIKE ${`%${query.q}%`}
          OR ${table}."mpn" ILIKE ${`%${query.q}%`}
          OR ${table}."name" ILIKE ${`%${query.q}%`}
          OR ${table}."slug" ILIKE ${`%${query.q}%`}
          OR p."name" ILIKE ${`%${query.q}%`}
          OR p."sku" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.productId) {
      where.push(Prisma.sql`${table}."productId" = ${query.productId}`);
    }

    if (query.sku) {
      where.push(Prisma.sql`${table}."sku" ILIKE ${`%${query.sku}%`}`);
    }

    if (query.barcode) {
      where.push(
        Prisma.sql`${table}."barcode" = ${this.normalizeIdentifier(query.barcode)}`,
      );
    }

    if (query.gtin) {
      where.push(
        Prisma.sql`${table}."gtin" = ${this.normalizeGtin(query.gtin)}`,
      );
    }

    if (query.mpn) {
      where.push(Prisma.sql`${table}."mpn" ILIKE ${`%${query.mpn}%`}`);
    }

    if (query.isActive !== undefined) {
      where.push(Prisma.sql`${table}."isActive" = ${query.isActive}`);
    }

    if (query.priceMin) {
      where.push(Prisma.sql`${table}."price" >= ${query.priceMin}::numeric`);
    }

    if (query.priceMax) {
      where.push(Prisma.sql`${table}."price" <= ${query.priceMax}::numeric`);
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

  private buildUpdateAssignments(
    dto: AdminUpdateProductVariantDto,
  ): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.sku !== undefined) {
      assignments.push(Prisma.sql`"sku" = ${dto.sku}`);
    }

    if (dto.barcode !== undefined) {
      assignments.push(
        Prisma.sql`"barcode" = ${this.normalizeIdentifier(dto.barcode)}`,
      );
    }

    if (dto.gtin !== undefined) {
      assignments.push(Prisma.sql`"gtin" = ${this.normalizeGtin(dto.gtin)}`);
    }

    if (dto.mpn !== undefined) {
      assignments.push(
        Prisma.sql`"mpn" = ${this.normalizeIdentifier(dto.mpn)}`,
      );
    }

    if (dto.name !== undefined) {
      assignments.push(Prisma.sql`"name" = ${dto.name}`);
    }

    if (dto.slug !== undefined) {
      assignments.push(Prisma.sql`"slug" = ${dto.slug}`);
    }

    if (dto.price !== undefined) {
      assignments.push(
        Prisma.sql`"price" = ${this.optionalDecimal(dto.price)}`,
      );
    }

    if (dto.comparePrice !== undefined) {
      assignments.push(
        Prisma.sql`"comparePrice" = ${this.optionalDecimal(dto.comparePrice)}`,
      );
    }

    if (dto.weight !== undefined) {
      assignments.push(Prisma.sql`"weight" = ${dto.weight}`);
    }

    if (dto.imageUrl !== undefined) {
      assignments.push(Prisma.sql`"imageUrl" = ${dto.imageUrl}`);
    }

    if (dto.isActive !== undefined) {
      assignments.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    return assignments;
  }

  private async assertProductExists(productId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "Product"
          WHERE
            "id" = ${productId}
            AND "deleted_at" IS NULL
        `,
    );

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException('محصول انتخاب‌شده معتبر نیست.');
    }
  }

  private async assertWarehouseExists(warehouseId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "Warehouse"
          WHERE
            "id" = ${warehouseId}
            AND "isActive" = TRUE
        `,
    );

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException('انبار انتخاب‌شده معتبر نیست.');
    }
  }

  private async assertSkuUnique(
    sku: string,
    exceptVariantId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [Prisma.sql`"sku" = ${sku}`];

    if (exceptVariantId) {
      where.push(Prisma.sql`"id" <> ${exceptVariantId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "ProductVariant"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('کد SKU واریانت تکراری است.');
    }
  }

  private async assertBarcodeUnique(
    barcode: string | null,
    exceptVariantId?: string,
  ): Promise<void> {
    if (!barcode) {
      return;
    }

    const where: Prisma.Sql[] = [Prisma.sql`"barcode" = ${barcode}`];

    if (exceptVariantId) {
      where.push(Prisma.sql`"id" <> ${exceptVariantId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "ProductVariant"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException(
        'بارکد واردشده قبلاً برای تنوع دیگری ثبت شده است.',
      );
    }
  }

  private async assertGtinUnique(
    gtin: string | null,
    exceptVariantId?: string,
  ): Promise<void> {
    if (!gtin) {
      return;
    }

    const where: Prisma.Sql[] = [Prisma.sql`"gtin" = ${gtin}`];

    if (exceptVariantId) {
      where.push(Prisma.sql`"id" <> ${exceptVariantId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "ProductVariant"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException(
        'GTIN واردشده قبلاً برای تنوع دیگری ثبت شده است.',
      );
    }
  }

  private async assertSlugUnique(
    slug: string,
    exceptVariantId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [Prisma.sql`"slug" = ${slug}`];

    if (exceptVariantId) {
      where.push(Prisma.sql`"id" <> ${exceptVariantId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "ProductVariant"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('اسلاگ واریانت تکراری است.');
    }
  }

  private async assertAttributeValuesExist(
    attributeValueIds: string[],
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(attributeValueIds));

    if (uniqueIds.length === 0) {
      return;
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "AttributeValue"
          WHERE
            "id" IN (${Prisma.join(uniqueIds)})
            AND "deleted_at" IS NULL
        `,
    );

    if (this.toNumber(rows[0]?.count) !== uniqueIds.length) {
      throw new BadRequestException(
        'برخی مقادیر ویژگی انتخاب‌شده معتبر نیستند.',
      );
    }
  }

  private async syncVariantAttributesTx(
    tx: Prisma.TransactionClient,
    variantId: string,
    attributeValueIds: string[],
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(attributeValueIds));

    await tx.$executeRaw(
      Prisma.sql`
        DELETE FROM "VariantAttribute"
        WHERE "variantId" = ${variantId}
      `,
    );

    const now = new Date();

    for (const attributeValueId of uniqueIds) {
      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO "VariantAttribute" (
            "id",
            "variantId",
            "attributeValueId",
            "createdAt"
          )
          VALUES (
            ${randomUUID()},
            ${variantId},
            ${attributeValueId},
            ${now}
          )
          ON CONFLICT ("variantId", "attributeValueId") DO NOTHING
        `,
      );
    }
  }

  private async findVariantAttributes(
    variantId: string,
  ): Promise<VariantAttributeRow[]> {
    return this.prisma.$queryRaw<VariantAttributeRow[]>(
      Prisma.sql`
        SELECT
          a."id" AS "attributeId",
          a."name" AS "attributeName",
          av."id" AS "attributeValueId",
          av."value"
        FROM "VariantAttribute" va
        INNER JOIN "AttributeValue" av
          ON av."id" = va."attributeValueId"
        INNER JOIN "Attribute" a
          ON a."id" = av."attributeId"
        WHERE va."variantId" = ${variantId}
        ORDER BY
          a."name" ASC,
          av."value" ASC
      `,
    );
  }

  private async findVariantInventories(
    variantId: string,
  ): Promise<VariantInventoryRow[]> {
    return this.prisma.$queryRaw<VariantInventoryRow[]>(
      Prisma.sql`
        SELECT
          i."id" AS "inventoryId",
          i."warehouseId",
          w."name" AS "warehouseName",
          w."code" AS "warehouseCode",
          i."quantity",
          i."reservedQuantity",
          GREATEST(i."quantity" - i."reservedQuantity", 0)::int AS "availableQuantity",
          i."lowStockThreshold",
          i."createdAt",
          i."updatedAt"
        FROM "Inventory" i
        INNER JOIN "Warehouse" w
          ON w."id" = i."warehouseId"
        WHERE i."variantId" = ${variantId}
        ORDER BY
          w."code" ASC,
          i."createdAt" ASC
      `,
    );
  }

  private async ensureInventoryTx(
    tx: Prisma.TransactionClient,
    variantId: string,
    warehouseId: string,
    lowStockThreshold?: number,
  ): Promise<string> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
      }>
    >(
      Prisma.sql`
          SELECT "id"
          FROM "Inventory"
          WHERE
            "variantId" = ${variantId}
            AND "warehouseId" = ${warehouseId}
          LIMIT 1
        `,
    );

    if (rows[0]) {
      return rows[0].id;
    }

    const inventoryId = randomUUID();

    const now = new Date();

    await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO "Inventory" (
          "id",
          "variantId",
          "warehouseId",
          "quantity",
          "reservedQuantity",
          "lowStockThreshold",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${inventoryId},
          ${variantId},
          ${warehouseId},
          0,
          0,
          ${lowStockThreshold ?? 5},
          ${now},
          ${now}
        )
      `,
    );

    return inventoryId;
  }

  private async findInventoryForUpdateTx(
    tx: Prisma.TransactionClient,
    inventoryId: string,
  ): Promise<{
    quantity: number | bigint;
    reservedQuantity: number | bigint;
    lowStockThreshold: number | bigint;
  }> {
    const rows = await tx.$queryRaw<
      Array<{
        quantity: number | bigint;
        reservedQuantity: number | bigint;
        lowStockThreshold: number | bigint;
      }>
    >(
      Prisma.sql`
          SELECT
            "quantity",
            "reservedQuantity",
            "lowStockThreshold"
          FROM "Inventory"
          WHERE "id" = ${inventoryId}
          FOR UPDATE
        `,
    );

    const inventory = rows[0];

    if (!inventory) {
      throw new NotFoundException('موجودی واریانت یافت نشد.');
    }

    return inventory;
  }

  private calculateNextQuantity(
    currentQuantity: number,
    reservedQuantity: number,
    dto: AdminUpdateVariantStockDto,
  ): number {
    if (dto.type === 'IN' || dto.type === 'RETURN') {
      return currentQuantity + dto.quantity;
    }

    if (dto.type === 'OUT') {
      const availableQuantity = currentQuantity - reservedQuantity;

      if (dto.quantity > availableQuantity) {
        throw new BadRequestException(
          'موجودی آزاد برای خروج از انبار کافی نیست.',
        );
      }

      return currentQuantity - dto.quantity;
    }

    return dto.quantity;
  }

  private assertValidPrices(price?: string, comparePrice?: string): void {
    if (
      price !== undefined &&
      comparePrice !== undefined &&
      new Prisma.Decimal(comparePrice).lessThan(new Prisma.Decimal(price))
    ) {
      throw new BadRequestException(
        'قیمت قبل از تخفیف نمی‌تواند کمتر از قیمت فروش باشد.',
      );
    }
  }

  private normalizeIdentifier(value?: string | null): string | null {
    const normalized = value?.trim().toUpperCase();

    return normalized ? normalized : null;
  }

  private normalizeGtin(value?: string | null): string | null {
    const normalized = value?.replace(/\s+/g, '').trim();

    return normalized ? normalized : null;
  }

  private assertValidGtin(gtin: string | null): void {
    if (!gtin) {
      return;
    }

    if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(gtin)) {
      throw new BadRequestException(
        'GTIN باید فقط شامل ۸، ۱۲، ۱۳ یا ۱۴ رقم باشد.',
      );
    }

    const digits = gtin.split('').map((digit) => Number(digit));

    const checkDigit = digits.pop();

    if (checkDigit === undefined) {
      throw new BadRequestException('GTIN معتبر نیست.');
    }

    const weightedSum = digits
      .reverse()
      .reduce(
        (sum, digit, index) => sum + digit * (index % 2 === 0 ? 3 : 1),
        0,
      );

    const expectedCheckDigit = (10 - (weightedSum % 10)) % 10;

    if (checkDigit !== expectedCheckDigit) {
      throw new BadRequestException('رقم کنترل GTIN معتبر نیست.');
    }
  }

  private optionalDecimal(value?: string): Prisma.Sql {
    if (value === undefined) {
      return Prisma.sql`NULL`;
    }

    return Prisma.sql`${value}::numeric`;
  }

  private mapVariant(row: ProductVariantRow): ProductVariantResponse {
    return {
      id: row.id,
      product: {
        id: row.productId,
        name: row.productName,
        slug: row.productSlug,
        sku: row.productSku,
      },
      sku: row.sku,
      name: row.name,
      slug: row.slug,
      barcode: row.barcode,
      gtin: row.gtin,
      mpn: row.mpn,
      price: row.price === null ? null : this.toDecimalString(row.price),
      comparePrice:
        row.comparePrice === null
          ? null
          : this.toDecimalString(row.comparePrice),
      weight: row.weight,
      imageUrl: row.imageUrl,
      isActive: row.isActive,
      stock: {
        totalQuantity: this.toNumber(row.totalQuantity),
        reservedQuantity: this.toNumber(row.reservedQuantity),
        availableStock: this.toNumber(row.availableStock),
        lowStockThreshold: this.toNumber(row.lowStockThreshold),
      },
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
      return Prisma.sql`pv."updatedAt"`;
    }

    if (sortBy === 'sku') {
      return Prisma.sql`pv."sku"`;
    }

    if (sortBy === 'name') {
      return Prisma.sql`pv."name"`;
    }

    if (sortBy === 'price') {
      return Prisma.sql`pv."price"`;
    }

    if (sortBy === 'isActive') {
      return Prisma.sql`pv."isActive"`;
    }

    if (sortBy === 'availableStock') {
      return Prisma.sql`stock."availableStock"`;
    }

    return Prisma.sql`pv."createdAt"`;
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
    if (value === undefined || value === null) {
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

  private toDecimalString(value: Prisma.Decimal | number | string): string {
    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    return new Prisma.Decimal(value).toFixed(2);
  }
}
