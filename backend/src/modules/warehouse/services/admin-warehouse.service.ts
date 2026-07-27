import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminCreateWarehouseDto } from '../dto/admin-create-warehouse.dto';

import { AdminQueryWarehouseDto } from '../dto/admin-query-warehouse.dto';

import { AdminUpdateWarehouseDto } from '../dto/admin-update-warehouse.dto';

type CountRow = {
  count: number | bigint;
};

type WarehouseRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
  inventoryCount: number | bigint;
  variantCount: number | bigint;
  productCount: number | bigint;
  totalQuantity: number | bigint;
  reservedQuantity: number | bigint;
  availableQuantity: number | bigint;
  lowStockCount: number | bigint;
  outOfStockCount: number | bigint;
  createdAt: Date;
  updatedAt: Date;
};

type WarehouseInventoryRow = {
  inventoryId: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  productSku: string;
  variantSku: string;
  variantName: string | null;
  quantity: number | bigint;
  reservedQuantity: number | bigint;
  availableQuantity: number | bigint;
  lowStockThreshold: number | bigint;
  isLowStock: boolean;
  isOutOfStock: boolean;
  updatedAt: Date;
};

type WarehouseMovementRow = {
  id: string;
  inventoryId: string;
  type: string;
  quantity: number | bigint;
  reason: string | null;
  reference: string | null;
  createdAt: Date;
  variantId: string;
  variantSku: string;
  productId: string;
  productName: string;
};

@Injectable()
export class AdminWarehouseService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminQueryWarehouseDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildWarehouseWhere(query, 'w');

    const having = this.buildWarehouseHaving(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<WarehouseRow[]>(
        Prisma.sql`
            SELECT
              w."id",
              w."name",
              w."code",
              w."description",
              w."address",
              w."city",
              w."country",
              w."isActive",
              COALESCE(stats."inventoryCount", 0)::int AS "inventoryCount",
              COALESCE(stats."variantCount", 0)::int AS "variantCount",
              COALESCE(stats."productCount", 0)::int AS "productCount",
              COALESCE(stats."totalQuantity", 0)::int AS "totalQuantity",
              COALESCE(stats."reservedQuantity", 0)::int AS "reservedQuantity",
              COALESCE(stats."availableQuantity", 0)::int AS "availableQuantity",
              COALESCE(stats."lowStockCount", 0)::int AS "lowStockCount",
              COALESCE(stats."outOfStockCount", 0)::int AS "outOfStockCount",
              w."createdAt",
              w."updatedAt"
            FROM "Warehouse" w
            LEFT JOIN LATERAL (
              SELECT
                COUNT(i."id") AS "inventoryCount",
                COUNT(DISTINCT i."variantId") AS "variantCount",
                COUNT(DISTINCT pv."productId") AS "productCount",
                COALESCE(SUM(i."quantity"), 0) AS "totalQuantity",
                COALESCE(SUM(i."reservedQuantity"), 0) AS "reservedQuantity",
                COALESCE(SUM(GREATEST(i."quantity" - i."reservedQuantity", 0)), 0) AS "availableQuantity",
                COUNT(*) FILTER (
                  WHERE
                    GREATEST(i."quantity" - i."reservedQuantity", 0) > 0
                    AND GREATEST(i."quantity" - i."reservedQuantity", 0) <= i."lowStockThreshold"
                ) AS "lowStockCount",
                COUNT(*) FILTER (
                  WHERE GREATEST(i."quantity" - i."reservedQuantity", 0) <= 0
                ) AS "outOfStockCount"
              FROM "Inventory" i
              LEFT JOIN "ProductVariant" pv
                ON pv."id" = i."variantId"
              WHERE i."warehouseId" = w."id"
            ) stats ON TRUE
            WHERE ${Prisma.join(where, ' AND ')}
            ${having}
            ORDER BY
              ${this.resolveSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              w."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Warehouse" w
            LEFT JOIN LATERAL (
              SELECT
                COUNT(i."id") AS "inventoryCount",
                COALESCE(SUM(GREATEST(i."quantity" - i."reservedQuantity", 0)), 0) AS "availableQuantity",
                COUNT(*) FILTER (
                  WHERE
                    GREATEST(i."quantity" - i."reservedQuantity", 0) > 0
                    AND GREATEST(i."quantity" - i."reservedQuantity", 0) <= i."lowStockThreshold"
                ) AS "lowStockCount",
                COUNT(*) FILTER (
                  WHERE GREATEST(i."quantity" - i."reservedQuantity", 0) <= 0
                ) AS "outOfStockCount"
              FROM "Inventory" i
              WHERE i."warehouseId" = w."id"
            ) stats ON TRUE
            WHERE ${Prisma.join(where, ' AND ')}
            ${having}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapWarehouse(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(warehouseId: string) {
    const warehouse = await this.findWarehouseRow(warehouseId);

    const [inventories, movements] = await Promise.all([
      this.findWarehouseInventories(warehouseId, 200),
      this.findWarehouseMovements(warehouseId, 50),
    ]);

    return {
      ...this.mapWarehouse(warehouse),
      inventories: inventories.map((row) => this.mapWarehouseInventory(row)),
      recentMovements: movements.map((row) => this.mapWarehouseMovement(row)),
    };
  }

  async create(dto: AdminCreateWarehouseDto, actorId?: string) {
    await this.assertCodeUnique(dto.code);

    const warehouseId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Warehouse" (
          "id",
          "name",
          "code",
          "description",
          "address",
          "city",
          "country",
          "isActive",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${warehouseId},
          ${dto.name},
          ${this.normalizeCode(dto.code)},
          ${dto.description ?? null},
          ${dto.address ?? null},
          ${dto.city ?? null},
          ${dto.country ?? null},
          ${dto.isActive ?? true},
          NOW(),
          NOW()
        )
      `,
    );

    return {
      warehouse: await this.findOne(warehouseId),
      audit: {
        actorId: actorId ?? null,
        action: 'warehouse.admin_created',
      },
    };
  }

  async update(
    warehouseId: string,
    dto: AdminUpdateWarehouseDto,
    actorId?: string,
  ) {
    await this.findWarehouseRow(warehouseId);

    if (dto.code !== undefined) {
      await this.assertCodeUnique(dto.code, warehouseId);
    }

    const assignments = this.buildUpdateAssignments(dto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی انبار ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Warehouse"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = NOW()
        WHERE "id" = ${warehouseId}
      `,
    );

    return {
      warehouse: await this.findOne(warehouseId),
      audit: {
        actorId: actorId ?? null,
        action: 'warehouse.admin_updated',
      },
    };
  }

  async activate(warehouseId: string, actorId?: string) {
    await this.findWarehouseRow(warehouseId);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Warehouse"
        SET
          "isActive" = TRUE,
          "updatedAt" = NOW()
        WHERE "id" = ${warehouseId}
      `,
    );

    return {
      warehouse: await this.findOne(warehouseId),
      audit: {
        actorId: actorId ?? null,
        action: 'warehouse.admin_activated',
      },
    };
  }

  async deactivate(warehouseId: string, actorId?: string) {
    await this.findWarehouseRow(warehouseId);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Warehouse"
        SET
          "isActive" = FALSE,
          "updatedAt" = NOW()
        WHERE "id" = ${warehouseId}
      `,
    );

    return {
      warehouse: await this.findOne(warehouseId),
      audit: {
        actorId: actorId ?? null,
        action: 'warehouse.admin_deactivated',
      },
    };
  }

  async delete(warehouseId: string, actorId?: string) {
    await this.findWarehouseRow(warehouseId);

    const inventoryCount = await this.countInventories(warehouseId);

    if (inventoryCount > 0) {
      throw new BadRequestException(
        'این انبار دارای رکورد موجودی است و قابل حذف نیست. برای توقف استفاده، انبار را غیرفعال کنید.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        DELETE FROM "Warehouse"
        WHERE "id" = ${warehouseId}
      `,
    );

    return {
      success: true,
      message: 'انبار با موفقیت حذف شد.',
      audit: {
        actorId: actorId ?? null,
        action: 'warehouse.admin_deleted',
      },
    };
  }

  async findWarehouseRow(warehouseId: string): Promise<WarehouseRow> {
    const rows = await this.prisma.$queryRaw<WarehouseRow[]>(
      Prisma.sql`
          SELECT
            w."id",
            w."name",
            w."code",
            w."description",
            w."address",
            w."city",
            w."country",
            w."isActive",
            COALESCE(stats."inventoryCount", 0)::int AS "inventoryCount",
            COALESCE(stats."variantCount", 0)::int AS "variantCount",
            COALESCE(stats."productCount", 0)::int AS "productCount",
            COALESCE(stats."totalQuantity", 0)::int AS "totalQuantity",
            COALESCE(stats."reservedQuantity", 0)::int AS "reservedQuantity",
            COALESCE(stats."availableQuantity", 0)::int AS "availableQuantity",
            COALESCE(stats."lowStockCount", 0)::int AS "lowStockCount",
            COALESCE(stats."outOfStockCount", 0)::int AS "outOfStockCount",
            w."createdAt",
            w."updatedAt"
          FROM "Warehouse" w
          LEFT JOIN LATERAL (
            SELECT
              COUNT(i."id") AS "inventoryCount",
              COUNT(DISTINCT i."variantId") AS "variantCount",
              COUNT(DISTINCT pv."productId") AS "productCount",
              COALESCE(SUM(i."quantity"), 0) AS "totalQuantity",
              COALESCE(SUM(i."reservedQuantity"), 0) AS "reservedQuantity",
              COALESCE(SUM(GREATEST(i."quantity" - i."reservedQuantity", 0)), 0) AS "availableQuantity",
              COUNT(*) FILTER (
                WHERE
                  GREATEST(i."quantity" - i."reservedQuantity", 0) > 0
                  AND GREATEST(i."quantity" - i."reservedQuantity", 0) <= i."lowStockThreshold"
              ) AS "lowStockCount",
              COUNT(*) FILTER (
                WHERE GREATEST(i."quantity" - i."reservedQuantity", 0) <= 0
              ) AS "outOfStockCount"
            FROM "Inventory" i
            LEFT JOIN "ProductVariant" pv
              ON pv."id" = i."variantId"
            WHERE i."warehouseId" = w."id"
          ) stats ON TRUE
          WHERE w."id" = ${warehouseId}
          LIMIT 1
        `,
    );

    const warehouse = rows[0];

    if (!warehouse) {
      throw new NotFoundException('انبار موردنظر یافت نشد.');
    }

    return warehouse;
  }

  private async findWarehouseInventories(
    warehouseId: string,
    limit: number,
  ): Promise<WarehouseInventoryRow[]> {
    return this.prisma.$queryRaw<WarehouseInventoryRow[]>(
      Prisma.sql`
        SELECT
          i."id" AS "inventoryId",
          i."variantId",
          pv."productId",
          p."name" AS "productName",
          p."slug" AS "productSlug",
          p."sku" AS "productSku",
          pv."sku" AS "variantSku",
          pv."name" AS "variantName",
          i."quantity",
          i."reservedQuantity",
          GREATEST(i."quantity" - i."reservedQuantity", 0)::int AS "availableQuantity",
          i."lowStockThreshold",
          (
            GREATEST(i."quantity" - i."reservedQuantity", 0) > 0
            AND GREATEST(i."quantity" - i."reservedQuantity", 0) <= i."lowStockThreshold"
          ) AS "isLowStock",
          (
            GREATEST(i."quantity" - i."reservedQuantity", 0) <= 0
          ) AS "isOutOfStock",
          i."updatedAt"
        FROM "Inventory" i
        INNER JOIN "ProductVariant" pv
          ON pv."id" = i."variantId"
        INNER JOIN "Product" p
          ON p."id" = pv."productId"
        WHERE
          i."warehouseId" = ${warehouseId}
          AND pv."deleted_at" IS NULL
          AND p."deleted_at" IS NULL
        ORDER BY
          "isOutOfStock" DESC,
          "isLowStock" DESC,
          p."name" ASC,
          pv."sku" ASC
        LIMIT ${limit}
      `,
    );
  }

  private async findWarehouseMovements(
    warehouseId: string,
    limit: number,
  ): Promise<WarehouseMovementRow[]> {
    return this.prisma.$queryRaw<WarehouseMovementRow[]>(
      Prisma.sql`
        SELECT
          sm."id",
          sm."inventoryId",
          sm."type"::text AS "type",
          sm."quantity",
          sm."reason",
          sm."reference",
          sm."createdAt",
          i."variantId",
          pv."sku" AS "variantSku",
          pv."productId",
          p."name" AS "productName"
        FROM "StockMovement" sm
        INNER JOIN "Inventory" i
          ON i."id" = sm."inventoryId"
        INNER JOIN "ProductVariant" pv
          ON pv."id" = i."variantId"
        INNER JOIN "Product" p
          ON p."id" = pv."productId"
        WHERE i."warehouseId" = ${warehouseId}
        ORDER BY
          sm."createdAt" DESC,
          sm."id" DESC
        LIMIT ${limit}
      `,
    );
  }

  private buildWarehouseWhere(
    query: AdminQueryWarehouseDto,
    alias: string,
  ): Prisma.Sql[] {
    const table = Prisma.raw(alias);

    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.q) {
      where.push(
        Prisma.sql`(
          ${table}."name" ILIKE ${`%${query.q}%`}
          OR ${table}."code" ILIKE ${`%${query.q}%`}
          OR ${table}."description" ILIKE ${`%${query.q}%`}
          OR ${table}."address" ILIKE ${`%${query.q}%`}
          OR ${table}."city" ILIKE ${`%${query.q}%`}
          OR ${table}."country" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.code) {
      where.push(Prisma.sql`${table}."code" ILIKE ${`%${query.code}%`}`);
    }

    if (query.city) {
      where.push(Prisma.sql`${table}."city" ILIKE ${`%${query.city}%`}`);
    }

    if (query.country) {
      where.push(Prisma.sql`${table}."country" ILIKE ${`%${query.country}%`}`);
    }

    if (query.isActive !== undefined) {
      where.push(Prisma.sql`${table}."isActive" = ${query.isActive}`);
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

  private buildWarehouseHaving(query: AdminQueryWarehouseDto): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];

    if (query.hasInventory === true) {
      conditions.push(Prisma.sql`COALESCE(stats."inventoryCount", 0) > 0`);
    }

    if (query.hasInventory === false) {
      conditions.push(Prisma.sql`COALESCE(stats."inventoryCount", 0) = 0`);
    }

    if (query.hasLowStock === true) {
      conditions.push(Prisma.sql`COALESCE(stats."lowStockCount", 0) > 0`);
    }

    if (query.hasOutOfStock === true) {
      conditions.push(Prisma.sql`COALESCE(stats."outOfStockCount", 0) > 0`);
    }

    if (conditions.length === 0) {
      return Prisma.sql``;
    }

    return Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}`;
  }

  private buildUpdateAssignments(dto: AdminUpdateWarehouseDto): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.name !== undefined) {
      assignments.push(Prisma.sql`"name" = ${dto.name}`);
    }

    if (dto.code !== undefined) {
      assignments.push(Prisma.sql`"code" = ${this.normalizeCode(dto.code)}`);
    }

    if (dto.description !== undefined) {
      assignments.push(Prisma.sql`"description" = ${dto.description}`);
    }

    if (dto.address !== undefined) {
      assignments.push(Prisma.sql`"address" = ${dto.address}`);
    }

    if (dto.city !== undefined) {
      assignments.push(Prisma.sql`"city" = ${dto.city}`);
    }

    if (dto.country !== undefined) {
      assignments.push(Prisma.sql`"country" = ${dto.country}`);
    }

    if (dto.isActive !== undefined) {
      assignments.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    return assignments;
  }

  private async assertCodeUnique(
    code: string,
    exceptWarehouseId?: string,
  ): Promise<void> {
    const normalizedCode = this.normalizeCode(code);

    const where: Prisma.Sql[] = [
      Prisma.sql`LOWER("code") = LOWER(${normalizedCode})`,
    ];

    if (exceptWarehouseId) {
      where.push(Prisma.sql`"id" <> ${exceptWarehouseId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Warehouse"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('کد انبار تکراری است.');
    }
  }

  private async countInventories(warehouseId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Inventory"
          WHERE "warehouseId" = ${warehouseId}
        `,
    );

    return this.toNumber(rows[0]?.count);
  }

  private mapWarehouse(row: WarehouseRow) {
    const totalQuantity = this.toNumber(row.totalQuantity);

    const reservedQuantity = this.toNumber(row.reservedQuantity);

    const availableQuantity = this.toNumber(row.availableQuantity);

    const lowStockCount = this.toNumber(row.lowStockCount);

    const outOfStockCount = this.toNumber(row.outOfStockCount);

    return {
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description,
      address: row.address,
      city: row.city,
      country: row.country,
      isActive: row.isActive,
      inventory: {
        inventoryCount: this.toNumber(row.inventoryCount),
        variantCount: this.toNumber(row.variantCount),
        productCount: this.toNumber(row.productCount),
        totalQuantity,
        reservedQuantity,
        availableQuantity,
        lowStockCount,
        outOfStockCount,
        hasLowStock: lowStockCount > 0,
        hasOutOfStock: outOfStockCount > 0,
      },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapWarehouseInventory(row: WarehouseInventoryRow) {
    return {
      inventoryId: row.inventoryId,
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
      },
      stock: {
        quantity: this.toNumber(row.quantity),
        reservedQuantity: this.toNumber(row.reservedQuantity),
        availableQuantity: this.toNumber(row.availableQuantity),
        lowStockThreshold: this.toNumber(row.lowStockThreshold),
        isLowStock: row.isLowStock,
        isOutOfStock: row.isOutOfStock,
      },
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapWarehouseMovement(row: WarehouseMovementRow) {
    return {
      id: row.id,
      inventoryId: row.inventoryId,
      type: row.type,
      quantity: this.toNumber(row.quantity),
      reason: row.reason,
      reference: row.reference,
      product: {
        id: row.productId,
        name: row.productName,
      },
      variant: {
        id: row.variantId,
        sku: row.variantSku,
      },
      createdAt: row.createdAt.toISOString(),
    };
  }

  private resolveSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`w."updatedAt"`;
    }

    if (sortBy === 'name') {
      return Prisma.sql`w."name"`;
    }

    if (sortBy === 'code') {
      return Prisma.sql`w."code"`;
    }

    if (sortBy === 'city') {
      return Prisma.sql`w."city"`;
    }

    if (sortBy === 'country') {
      return Prisma.sql`w."country"`;
    }

    if (sortBy === 'isActive') {
      return Prisma.sql`w."isActive"`;
    }

    if (sortBy === 'inventoryCount') {
      return Prisma.sql`stats."inventoryCount"`;
    }

    if (sortBy === 'totalQuantity') {
      return Prisma.sql`stats."totalQuantity"`;
    }

    if (sortBy === 'availableQuantity') {
      return Prisma.sql`stats."availableQuantity"`;
    }

    if (sortBy === 'lowStockCount') {
      return Prisma.sql`stats."lowStockCount"`;
    }

    if (sortBy === 'outOfStockCount') {
      return Prisma.sql`stats."outOfStockCount"`;
    }

    return Prisma.sql`w."createdAt"`;
  }

  private resolveSortDirection(sortDirection?: string): Prisma.Sql {
    return sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase().replace(/\s+/g, '-');
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
}
