import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminLowStockRuleDto } from '../dto/admin-low-stock-rule.dto';

import { AdminQueryInventoryDto } from '../dto/admin-query-inventory.dto';

type PrismaTx = Prisma.TransactionClient;

type CountRow = {
  count: number | bigint;
};

export type AdminInventoryRow = {
  id: string;
  variantId: string;
  warehouseId: string;
  quantity: number | bigint;
  reservedQuantity: number | bigint;
  availableQuantity: number | bigint;
  lowStockThreshold: number | bigint;
  createdAt: Date;
  updatedAt: Date;
  warehouseName: string | null;
  warehouseCode: string | null;
  warehouseCity: string | null;
  warehouseCountry: string | null;
  warehouseIsActive: boolean;
  productId: string | null;
  productName: string | null;
  productSlug: string | null;
  productSku: string | null;
  variantSku: string | null;
  variantName: string | null;
  variantSlug: string | null;
  variantIsActive: boolean | null;
};

type StockMovementRow = {
  id: string;
  inventoryId: string;
  type: string;
  quantity: number | bigint;
  reason: string | null;
  reference: string | null;
  createdAt: Date;
};

@Injectable()
export class AdminInventoryService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminQueryInventoryDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildInventoryWhere(query, 'i');

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AdminInventoryRow[]>(
        Prisma.sql`
            SELECT
              i."id",
              i."variantId",
              i."warehouseId",
              i."quantity",
              i."reservedQuantity",
              GREATEST(i."quantity" - i."reservedQuantity", 0)::int AS "availableQuantity",
              i."lowStockThreshold",
              i."createdAt",
              i."updatedAt",
              w."name" AS "warehouseName",
              w."code" AS "warehouseCode",
              w."city" AS "warehouseCity",
              w."country" AS "warehouseCountry",
              w."isActive" AS "warehouseIsActive",
              pv."productId",
              p."name" AS "productName",
              p."slug" AS "productSlug",
              p."sku" AS "productSku",
              pv."sku" AS "variantSku",
              pv."name" AS "variantName",
              pv."slug" AS "variantSlug",
              pv."isActive" AS "variantIsActive"
            FROM "Inventory" i
            INNER JOIN "Warehouse" w
              ON w."id" = i."warehouseId"
            INNER JOIN "ProductVariant" pv
              ON pv."id" = i."variantId"
            INNER JOIN "Product" p
              ON p."id" = pv."productId"
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolveSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              i."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Inventory" i
            INNER JOIN "Warehouse" w
              ON w."id" = i."warehouseId"
            INNER JOIN "ProductVariant" pv
              ON pv."id" = i."variantId"
            INNER JOIN "Product" p
              ON p."id" = pv."productId"
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapInventory(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(inventoryId: string) {
    const inventory = await this.findInventoryRow(inventoryId);

    const movements = await this.findMovementsByInventory(inventoryId, 50);

    return {
      ...this.mapInventory(inventory),
      movements: movements.map((movement) => this.mapMovement(movement)),
    };
  }

  async findLowStock(query: AdminQueryInventoryDto) {
    return this.findAll({
      ...query,
      stockStatus: 'low_stock',
      sortBy: query.sortBy ?? 'availableQuantity',
      sortDirection: query.sortDirection ?? 'asc',
    });
  }

  async findMovements(inventoryId: string, limit = 100) {
    await this.findInventoryRow(inventoryId);

    const safeLimit = Math.min(Math.max(limit, 1), 500);

    const rows = await this.findMovementsByInventory(inventoryId, safeLimit);

    return {
      data: rows.map((row) => this.mapMovement(row)),
      meta: {
        inventoryId,
        limit: safeLimit,
        total: rows.length,
      },
    };
  }

  async updateLowStockRule(dto: AdminLowStockRuleDto, actorId?: string) {
    const inventoryId = await this.resolveInventoryIdForRule(dto);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Inventory"
        SET
          "lowStockThreshold" = ${dto.lowStockThreshold},
          "updatedAt" = ${now}
        WHERE "id" = ${inventoryId}
      `,
    );

    return {
      inventory: await this.findOne(inventoryId),
      audit: {
        actorId: actorId ?? null,
        action: 'inventory.low_stock_rule_updated',
        reason: dto.reason ?? null,
      },
    };
  }

  async findInventoryRow(inventoryId: string): Promise<AdminInventoryRow> {
    const rows = await this.prisma.$queryRaw<AdminInventoryRow[]>(
      Prisma.sql`
          SELECT
            i."id",
            i."variantId",
            i."warehouseId",
            i."quantity",
            i."reservedQuantity",
            GREATEST(i."quantity" - i."reservedQuantity", 0)::int AS "availableQuantity",
            i."lowStockThreshold",
            i."createdAt",
            i."updatedAt",
            w."name" AS "warehouseName",
            w."code" AS "warehouseCode",
            w."city" AS "warehouseCity",
            w."country" AS "warehouseCountry",
            w."isActive" AS "warehouseIsActive",
            pv."productId",
            p."name" AS "productName",
            p."slug" AS "productSlug",
            p."sku" AS "productSku",
            pv."sku" AS "variantSku",
            pv."name" AS "variantName",
            pv."slug" AS "variantSlug",
            pv."isActive" AS "variantIsActive"
          FROM "Inventory" i
          INNER JOIN "Warehouse" w
            ON w."id" = i."warehouseId"
          INNER JOIN "ProductVariant" pv
            ON pv."id" = i."variantId"
          INNER JOIN "Product" p
            ON p."id" = pv."productId"
          WHERE
            i."id" = ${inventoryId}
            AND pv."deleted_at" IS NULL
            AND p."deleted_at" IS NULL
          LIMIT 1
        `,
    );

    const inventory = rows[0];

    if (!inventory) {
      throw new NotFoundException('رکورد موجودی موردنظر یافت نشد.');
    }

    return inventory;
  }

  async ensureInventoryForUpdateTx(
    tx: PrismaTx,
    variantId: string,
    warehouseId: string,
    lowStockThreshold?: number,
  ): Promise<{
    id: string;
    quantity: number | bigint;
    reservedQuantity: number | bigint;
    lowStockThreshold: number | bigint;
  }> {
    await this.assertVariantExistsTx(tx, variantId);

    await this.assertWarehouseExistsTx(tx, warehouseId);

    const existingRows = await tx.$queryRaw<
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

    let inventoryId = existingRows[0]?.id;

    if (!inventoryId) {
      inventoryId = randomUUID();

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
    }

    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        quantity: number | bigint;
        reservedQuantity: number | bigint;
        lowStockThreshold: number | bigint;
      }>
    >(
      Prisma.sql`
          SELECT
            "id",
            "quantity",
            "reservedQuantity",
            "lowStockThreshold"
          FROM "Inventory"
          WHERE "id" = ${inventoryId}
          LIMIT 1
          FOR UPDATE
        `,
    );

    const inventory = rows[0];

    if (!inventory) {
      throw new NotFoundException('رکورد موجودی برای عملیات انبار یافت نشد.');
    }

    return inventory;
  }

  async assertVariantExistsTx(tx: PrismaTx, variantId: string): Promise<void> {
    const rows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "ProductVariant" pv
          INNER JOIN "Product" p
            ON p."id" = pv."productId"
          WHERE
            pv."id" = ${variantId}
            AND pv."deleted_at" IS NULL
            AND p."deleted_at" IS NULL
        `,
    );

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException('واریانت انتخاب‌شده معتبر نیست.');
    }
  }

  async assertWarehouseExistsTx(
    tx: PrismaTx,
    warehouseId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
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

  mapInventory(row: AdminInventoryRow) {
    const quantity = this.toNumber(row.quantity);

    const reservedQuantity = this.toNumber(row.reservedQuantity);

    const availableQuantity = this.toNumber(row.availableQuantity);

    const lowStockThreshold = this.toNumber(row.lowStockThreshold);

    return {
      id: row.id,
      variantId: row.variantId,
      warehouse: {
        id: row.warehouseId,
        name: row.warehouseName,
        code: row.warehouseCode,
        city: row.warehouseCity,
        country: row.warehouseCountry,
        isActive: row.warehouseIsActive,
      },
      product: {
        id: row.productId,
        name: row.productName,
        slug: row.productSlug,
        sku: row.productSku,
      },
      variant: {
        id: row.variantId,
        sku: row.variantSku,
        name: row.variantName,
        slug: row.variantSlug,
        isActive: row.variantIsActive,
      },
      stock: {
        quantity,
        reservedQuantity,
        availableQuantity,
        lowStockThreshold,
        isOutOfStock: availableQuantity <= 0,
        isLowStock:
          availableQuantity > 0 && availableQuantity <= lowStockThreshold,
      },
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updatedAt),
    };
  }

  private async resolveInventoryIdForRule(
    dto: AdminLowStockRuleDto,
  ): Promise<string> {
    if (dto.inventoryId) {
      await this.findInventoryRow(dto.inventoryId);

      return dto.inventoryId;
    }

    if (!dto.variantId || !dto.warehouseId) {
      throw new BadRequestException(
        'برای تنظیم حداقل موجودی باید inventoryId یا ترکیب variantId و warehouseId ارسال شود.',
      );
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
      }>
    >(
      Prisma.sql`
          SELECT "id"
          FROM "Inventory"
          WHERE
            "variantId" = ${dto.variantId}
            AND "warehouseId" = ${dto.warehouseId}
          LIMIT 1
        `,
    );

    const inventoryId = rows[0]?.id;

    if (!inventoryId) {
      throw new NotFoundException(
        'رکورد موجودی برای واریانت و انبار انتخاب‌شده یافت نشد.',
      );
    }

    return inventoryId;
  }

  private findMovementsByInventory(
    inventoryId: string,
    limit: number,
  ): Promise<StockMovementRow[]> {
    return this.prisma.$queryRaw<StockMovementRow[]>(
      Prisma.sql`
        SELECT
          sm."id",
          sm."inventoryId",
          sm."type"::text AS "type",
          sm."quantity",
          sm."reason",
          sm."reference",
          sm."createdAt"
        FROM "StockMovement" sm
        WHERE sm."inventoryId" = ${inventoryId}
        ORDER BY
          sm."createdAt" DESC,
          sm."id" DESC
        LIMIT ${limit}
      `,
    );
  }

  private buildInventoryWhere(
    query: AdminQueryInventoryDto,
    alias: string,
  ): Prisma.Sql[] {
    const table = Prisma.raw(alias);

    const where: Prisma.Sql[] = [
      Prisma.sql`pv."deleted_at" IS NULL`,
      Prisma.sql`p."deleted_at" IS NULL`,
    ];

    if (query.includeInactiveWarehouse !== true) {
      where.push(Prisma.sql`w."isActive" = TRUE`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          p."name" ILIKE ${`%${query.q}%`}
          OR p."sku" ILIKE ${`%${query.q}%`}
          OR pv."sku" ILIKE ${`%${query.q}%`}
          OR pv."name" ILIKE ${`%${query.q}%`}
          OR w."name" ILIKE ${`%${query.q}%`}
          OR w."code" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.productId) {
      where.push(Prisma.sql`pv."productId" = ${query.productId}`);
    }

    if (query.variantId) {
      where.push(Prisma.sql`${table}."variantId" = ${query.variantId}`);
    }

    if (query.warehouseId) {
      where.push(Prisma.sql`${table}."warehouseId" = ${query.warehouseId}`);
    }

    if (query.warehouseCode) {
      where.push(Prisma.sql`w."code" ILIKE ${`%${query.warehouseCode}%`}`);
    }

    if (query.stockStatus === 'out_of_stock') {
      where.push(
        Prisma.sql`GREATEST(${table}."quantity" - ${table}."reservedQuantity", 0) <= 0`,
      );
    }

    if (query.stockStatus === 'low_stock') {
      where.push(
        Prisma.sql`GREATEST(${table}."quantity" - ${table}."reservedQuantity", 0) > 0`,
      );

      where.push(
        Prisma.sql`GREATEST(${table}."quantity" - ${table}."reservedQuantity", 0) <= ${table}."lowStockThreshold"`,
      );
    }

    if (query.stockStatus === 'in_stock') {
      where.push(
        Prisma.sql`GREATEST(${table}."quantity" - ${table}."reservedQuantity", 0) > ${table}."lowStockThreshold"`,
      );
    }

    if (query.stockStatus === 'reserved') {
      where.push(Prisma.sql`${table}."reservedQuantity" > 0`);
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

  private mapMovement(row: StockMovementRow) {
    return {
      id: row.id,
      inventoryId: row.inventoryId,
      type: row.type,
      quantity: this.toNumber(row.quantity),
      reason: row.reason,
      reference: row.reference,
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.createdAt),
    };
  }

  private resolveSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`i."updatedAt"`;
    }

    if (sortBy === 'quantity') {
      return Prisma.sql`i."quantity"`;
    }

    if (sortBy === 'reservedQuantity') {
      return Prisma.sql`i."reservedQuantity"`;
    }

    if (sortBy === 'availableQuantity') {
      return Prisma.sql`GREATEST(i."quantity" - i."reservedQuantity", 0)`;
    }

    if (sortBy === 'lowStockThreshold') {
      return Prisma.sql`i."lowStockThreshold"`;
    }

    if (sortBy === 'warehouseCode') {
      return Prisma.sql`w."code"`;
    }

    if (sortBy === 'variantSku') {
      return Prisma.sql`pv."sku"`;
    }

    if (sortBy === 'productName') {
      return Prisma.sql`p."name"`;
    }

    return Prisma.sql`i."createdAt"`;
  }

  private resolveSortDirection(sortDirection?: string): Prisma.Sql {
    return sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
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

  toNumber(value: unknown): number {
    if (value === undefined || value === null) {
      return 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    return Number(value);
  }
}
