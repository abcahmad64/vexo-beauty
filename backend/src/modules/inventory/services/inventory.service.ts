import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma, StockMovementType } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdjustStockDto } from '../dto/adjust-stock.dto';

import { CommitReservedStockDto } from '../dto/commit-reserved-stock.dto';

import { CreateInventoryDto } from '../dto/create-inventory.dto';

import { CreateWarehouseDto } from '../dto/create-warehouse.dto';

import { QueryInventoryDto } from '../dto/query-inventory.dto';

import { QueryStockMovementDto } from '../dto/query-stock-movement.dto';

import { ReserveStockDto } from '../dto/reserve-stock.dto';

import { UpdateInventoryDto } from '../dto/update-inventory.dto';

import { UpdateWarehouseDto } from '../dto/update-warehouse.dto';

import { InventoryEventPublisher } from '../events/inventory.event.publisher';

type PrismaTx = Prisma.TransactionClient;

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
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

type InventoryRow = {
  id: string;
  variant_id: string;
  warehouse_id: string;
  quantity: number | bigint;
  reserved_quantity: number | bigint;
  low_stock_threshold: number | bigint;
  created_at: Date;
  updated_at: Date;
  warehouse_name: string | null;
  warehouse_code: string | null;
  product_id: string | null;
  product_name: string | null;
  product_slug: string | null;
  variant_sku: string | null;
  variant_name: string | null;
};

type StockMovementRow = {
  id: string;
  inventory_id: string;
  type: StockMovementType;
  quantity: number | bigint;
  reason: string | null;
  reference: string | null;
  created_at: Date;
  variant_id: string | null;
  warehouse_id: string | null;
  warehouse_code: string | null;
  product_name: string | null;
  variant_sku: string | null;
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: InventoryEventPublisher,
  ) {}

  async createWarehouse(dto: CreateWarehouseDto, actorId?: string) {
    await this.assertWarehouseCodeUnique(this.prisma, dto.code);

    const warehouseId = randomUUID();

    const now = new Date();

    const rows = await this.prisma.$queryRaw<WarehouseRow[]>(
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
            ${dto.code},
            ${dto.description ?? null},
            ${dto.address ?? null},
            ${dto.city ?? null},
            ${dto.country ?? null},
            ${dto.isActive ?? true},
            ${now},
            ${now}
          )
          RETURNING
            "id",
            "name",
            "code",
            "description",
            "address",
            "city",
            "country",
            "isActive" AS is_active,
            "createdAt" AS created_at,
            "updatedAt" AS updated_at
        `,
    );

    const warehouse = this.mapWarehouseRow(rows[0]);

    this.eventPublisher.publishWarehouseCreated({
      warehouseId: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      actorId,
      occurredAt: now,
    });

    return warehouse;
  }

  async findWarehouses(query?: {
    q?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query?.page ?? 1));

    const limit = Math.min(100, Math.max(1, Number(query?.limit ?? 20)));

    const skip = (page - 1) * limit;

    const conditions: Prisma.Sql[] = [];

    if (query?.q) {
      conditions.push(
        Prisma.sql`
          (
            "name" ILIKE ${`%${query.q}%`}
            OR "code" ILIKE ${`%${query.q}%`}
            OR "city" ILIKE ${`%${query.q}%`}
            OR "country" ILIKE ${`%${query.q}%`}
          )
        `,
      );
    }

    if (query?.isActive !== undefined) {
      conditions.push(Prisma.sql`"isActive" = ${query.isActive}`);
    }

    const whereSql =
      conditions.length > 0
        ? Prisma.sql`
            WHERE ${Prisma.join(conditions, ' AND ')}
          `
        : Prisma.empty;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<WarehouseRow[]>(
        Prisma.sql`
            SELECT
              "id",
              "name",
              "code",
              "description",
              "address",
              "city",
              "country",
              "isActive" AS is_active,
              "createdAt" AS created_at,
              "updatedAt" AS updated_at
            FROM "Warehouse"
            ${whereSql}
            ORDER BY "createdAt" DESC, "id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),

      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS count
            FROM "Warehouse"
            ${whereSql}
          `,
      ),
    ]);

    return this.buildPaginatedResult(
      rows.map((row) => this.mapWarehouseRow(row)),
      this.toNumber(countRows[0]?.count),
      page,
      limit,
    );
  }

  async findWarehouse(warehouseId: string) {
    const rows = await this.prisma.$queryRaw<WarehouseRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "name",
            "code",
            "description",
            "address",
            "city",
            "country",
            "isActive" AS is_active,
            "createdAt" AS created_at,
            "updatedAt" AS updated_at
          FROM "Warehouse"
          WHERE "id" = ${warehouseId}
          LIMIT 1
        `,
    );

    if (!rows[0]) {
      throw new NotFoundException('انبار موردنظر یافت نشد.');
    }

    return this.mapWarehouseRow(rows[0]);
  }

  async updateWarehouse(
    warehouseId: string,
    dto: UpdateWarehouseDto,
    actorId?: string,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی انبار ارسال نشده است.',
      );
    }

    await this.findWarehouse(warehouseId);

    if (dto.code) {
      await this.assertWarehouseCodeUnique(this.prisma, dto.code, warehouseId);
    }

    const updates: Prisma.Sql[] = [];

    if (dto.name !== undefined) {
      updates.push(Prisma.sql`"name" = ${dto.name}`);
    }

    if (dto.code !== undefined) {
      updates.push(Prisma.sql`"code" = ${dto.code}`);
    }

    if (dto.description !== undefined) {
      updates.push(Prisma.sql`"description" = ${dto.description}`);
    }

    if (dto.address !== undefined) {
      updates.push(Prisma.sql`"address" = ${dto.address}`);
    }

    if (dto.city !== undefined) {
      updates.push(Prisma.sql`"city" = ${dto.city}`);
    }

    if (dto.country !== undefined) {
      updates.push(Prisma.sql`"country" = ${dto.country}`);
    }

    if (dto.isActive !== undefined) {
      updates.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Warehouse"
        SET
          ${Prisma.join(updates, ', ')},
          "updatedAt" = ${now}
        WHERE "id" = ${warehouseId}
      `,
    );

    this.eventPublisher.publishWarehouseUpdated({
      warehouseId,
      changedFields: Object.keys(dto),
      actorId,
      occurredAt: now,
    });

    return this.findWarehouse(warehouseId);
  }

  async createInventory(dto: CreateInventoryDto, actorId?: string) {
    if ((dto.reservedQuantity ?? 0) > (dto.quantity ?? 0)) {
      throw new BadRequestException(
        'موجودی رزروشده نمی‌تواند بیشتر از موجودی کل باشد.',
      );
    }

    const now = new Date();

    const inventory = await this.prisma.$transaction(async (tx) => {
      await this.assertVariantExists(tx, dto.variantId);

      await this.assertWarehouseActive(tx, dto.warehouseId);

      await this.assertInventoryUnique(tx, dto.variantId, dto.warehouseId);

      const inventoryId = randomUUID();

      const rows = await tx.$queryRaw<InventoryRow[]>(
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
                  ${dto.variantId},
                  ${dto.warehouseId},
                  ${dto.quantity ?? 0},
                  ${dto.reservedQuantity ?? 0},
                  ${dto.lowStockThreshold ?? 5},
                  ${now},
                  ${now}
                )
                RETURNING
                  "id",
                  "variantId" AS variant_id,
                  "warehouseId" AS warehouse_id,
                  "quantity",
                  "reservedQuantity" AS reserved_quantity,
                  "lowStockThreshold" AS low_stock_threshold,
                  "createdAt" AS created_at,
                  "updatedAt" AS updated_at,
                  NULL::text AS warehouse_name,
                  NULL::text AS warehouse_code,
                  NULL::text AS product_id,
                  NULL::text AS product_name,
                  NULL::text AS product_slug,
                  NULL::text AS variant_sku,
                  NULL::text AS variant_name
              `,
      );

      return rows[0];
    });

    this.eventPublisher.publishInventoryCreated({
      inventoryId: inventory.id,
      variantId: inventory.variant_id,
      warehouseId: inventory.warehouse_id,
      quantity: this.toNumber(inventory.quantity),
      reservedQuantity: this.toNumber(inventory.reserved_quantity),
      actorId,
      occurredAt: now,
    });

    const fullInventory = await this.findOne(inventory.id);

    await this.publishStockThresholdEvents(inventory.id, actorId);

    return fullInventory;
  }

  async findAll(query: QueryInventoryDto) {
    const { page, limit, skip } = this.buildInventoryPagination(query);

    const whereSql = this.buildInventoryWhereSql(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<InventoryRow[]>(
        Prisma.sql`
            SELECT
              i."id",
              i."variantId" AS variant_id,
              i."warehouseId" AS warehouse_id,
              i."quantity",
              i."reservedQuantity" AS reserved_quantity,
              i."lowStockThreshold" AS low_stock_threshold,
              i."createdAt" AS created_at,
              i."updatedAt" AS updated_at,
              w."name" AS warehouse_name,
              w."code" AS warehouse_code,
              p."id" AS product_id,
              p."name" AS product_name,
              p."slug" AS product_slug,
              pv."sku" AS variant_sku,
              pv."name" AS variant_name
            FROM "Inventory" i
            INNER JOIN "Warehouse" w ON w."id" = i."warehouseId"
            INNER JOIN "ProductVariant" pv ON pv."id" = i."variantId"
            INNER JOIN "Product" p ON p."id" = pv."productId"
            ${whereSql}
            ORDER BY i."updatedAt" DESC, i."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),

      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS count
            FROM "Inventory" i
            INNER JOIN "Warehouse" w ON w."id" = i."warehouseId"
            INNER JOIN "ProductVariant" pv ON pv."id" = i."variantId"
            INNER JOIN "Product" p ON p."id" = pv."productId"
            ${whereSql}
          `,
      ),
    ]);

    return this.buildPaginatedResult(
      rows.map((row) => this.mapInventoryRow(row)),
      this.toNumber(countRows[0]?.count),
      page,
      limit,
    );
  }

  async findOne(inventoryId: string) {
    const rows = await this.prisma.$queryRaw<InventoryRow[]>(
      Prisma.sql`
          SELECT
            i."id",
            i."variantId" AS variant_id,
            i."warehouseId" AS warehouse_id,
            i."quantity",
            i."reservedQuantity" AS reserved_quantity,
            i."lowStockThreshold" AS low_stock_threshold,
            i."createdAt" AS created_at,
            i."updatedAt" AS updated_at,
            w."name" AS warehouse_name,
            w."code" AS warehouse_code,
            p."id" AS product_id,
            p."name" AS product_name,
            p."slug" AS product_slug,
            pv."sku" AS variant_sku,
            pv."name" AS variant_name
          FROM "Inventory" i
          INNER JOIN "Warehouse" w ON w."id" = i."warehouseId"
          INNER JOIN "ProductVariant" pv ON pv."id" = i."variantId"
          INNER JOIN "Product" p ON p."id" = pv."productId"
          WHERE i."id" = ${inventoryId}
          LIMIT 1
        `,
    );

    if (!rows[0]) {
      throw new NotFoundException('رکورد موجودی موردنظر یافت نشد.');
    }

    return this.mapInventoryRow(rows[0]);
  }

  async findByVariant(variantId: string) {
    return this.findAll({
      variantId,
      page: 1,
      limit: 100,
    });
  }

  async updateInventory(
    inventoryId: string,
    dto: UpdateInventoryDto,
    actorId?: string,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی موجودی ارسال نشده است.',
      );
    }

    const current = await this.findInventoryRowForUpdate(
      this.prisma,
      inventoryId,
    );

    const nextQuantity = dto.quantity ?? this.toNumber(current.quantity);

    const nextReservedQuantity =
      dto.reservedQuantity ?? this.toNumber(current.reserved_quantity);

    if (nextReservedQuantity > nextQuantity) {
      throw new BadRequestException(
        'موجودی رزروشده نمی‌تواند بیشتر از موجودی کل باشد.',
      );
    }

    const updates: Prisma.Sql[] = [];

    if (dto.quantity !== undefined) {
      updates.push(Prisma.sql`"quantity" = ${dto.quantity}`);
    }

    if (dto.reservedQuantity !== undefined) {
      updates.push(Prisma.sql`"reservedQuantity" = ${dto.reservedQuantity}`);
    }

    if (dto.lowStockThreshold !== undefined) {
      updates.push(Prisma.sql`"lowStockThreshold" = ${dto.lowStockThreshold}`);
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Inventory"
        SET
          ${Prisma.join(updates, ', ')},
          "updatedAt" = ${now}
        WHERE "id" = ${inventoryId}
      `,
    );

    this.eventPublisher.publishInventoryUpdated({
      inventoryId,
      variantId: current.variant_id,
      warehouseId: current.warehouse_id,
      changedFields: Object.keys(dto),
      actorId,
      occurredAt: now,
    });

    await this.publishStockThresholdEvents(inventoryId, actorId);

    return this.findOne(inventoryId);
  }

  async adjustStock(
    inventoryId: string,
    dto: AdjustStockDto,
    actorId?: string,
  ) {
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.findInventoryRowForUpdate(tx, inventoryId);

      const previousQuantity = this.toNumber(current.quantity);

      const reservedQuantity = this.toNumber(current.reserved_quantity);

      const nextQuantity = this.calculateAdjustedQuantity(
        previousQuantity,
        reservedQuantity,
        dto,
      );

      await tx.$executeRaw(
        Prisma.sql`
              UPDATE "Inventory"
              SET
                "quantity" = ${nextQuantity},
                "updatedAt" = ${now}
              WHERE "id" = ${inventoryId}
            `,
      );

      const movement = await this.createStockMovementTx(
        tx,
        inventoryId,
        dto.type,
        dto.quantity,
        dto.reason,
        dto.reference,
        now,
      );

      return {
        current,
        movement,
        previousQuantity,
        nextQuantity,
      };
    });

    this.eventPublisher.publishStockAdjusted({
      inventoryId,
      variantId: result.current.variant_id,
      warehouseId: result.current.warehouse_id,
      movementId: result.movement.id,
      type: result.movement.type,
      quantity: this.toNumber(result.movement.quantity),
      previousQuantity: result.previousQuantity,
      currentQuantity: result.nextQuantity,
      reference: result.movement.reference,
      actorId,
      occurredAt: now,
    });

    await this.publishStockThresholdEvents(inventoryId, actorId);

    return this.findOne(inventoryId);
  }

  async reserveStock(
    inventoryId: string,
    dto: ReserveStockDto,
    actorId?: string,
  ) {
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.findInventoryRowForUpdate(tx, inventoryId);

      const quantity = this.toNumber(current.quantity);

      const previousReservedQuantity = this.toNumber(current.reserved_quantity);

      const availableQuantity = quantity - previousReservedQuantity;

      if (dto.quantity > availableQuantity) {
        throw new BadRequestException('موجودی آزاد برای رزرو کافی نیست.');
      }

      const currentReservedQuantity = previousReservedQuantity + dto.quantity;

      await tx.$executeRaw(
        Prisma.sql`
              UPDATE "Inventory"
              SET
                "reservedQuantity" = ${currentReservedQuantity},
                "updatedAt" = ${now}
              WHERE "id" = ${inventoryId}
            `,
      );

      return {
        current,
        previousReservedQuantity,
        currentReservedQuantity,
      };
    });

    this.eventPublisher.publishStockReserved({
      inventoryId,
      variantId: result.current.variant_id,
      warehouseId: result.current.warehouse_id,
      quantity: dto.quantity,
      previousReservedQuantity: result.previousReservedQuantity,
      currentReservedQuantity: result.currentReservedQuantity,
      reference: dto.reference ?? null,
      actorId,
      occurredAt: now,
    });

    await this.publishStockThresholdEvents(inventoryId, actorId);

    return this.findOne(inventoryId);
  }

  async releaseStock(
    inventoryId: string,
    dto: ReserveStockDto,
    actorId?: string,
  ) {
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.findInventoryRowForUpdate(tx, inventoryId);

      const previousReservedQuantity = this.toNumber(current.reserved_quantity);

      if (dto.quantity > previousReservedQuantity) {
        throw new BadRequestException(
          'مقدار آزادسازی نمی‌تواند بیشتر از موجودی رزروشده باشد.',
        );
      }

      const currentReservedQuantity = previousReservedQuantity - dto.quantity;

      await tx.$executeRaw(
        Prisma.sql`
              UPDATE "Inventory"
              SET
                "reservedQuantity" = ${currentReservedQuantity},
                "updatedAt" = ${now}
              WHERE "id" = ${inventoryId}
            `,
      );

      return {
        current,
        previousReservedQuantity,
        currentReservedQuantity,
      };
    });

    this.eventPublisher.publishStockReleased({
      inventoryId,
      variantId: result.current.variant_id,
      warehouseId: result.current.warehouse_id,
      quantity: dto.quantity,
      previousReservedQuantity: result.previousReservedQuantity,
      currentReservedQuantity: result.currentReservedQuantity,
      reference: dto.reference ?? null,
      actorId,
      occurredAt: now,
    });

    await this.publishStockThresholdEvents(inventoryId, actorId);

    return this.findOne(inventoryId);
  }

  async commitReservedStock(
    inventoryId: string,
    dto: CommitReservedStockDto,
    actorId?: string,
  ) {
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.findInventoryRowForUpdate(tx, inventoryId);

      const previousQuantity = this.toNumber(current.quantity);

      const previousReservedQuantity = this.toNumber(current.reserved_quantity);

      if (dto.quantity > previousReservedQuantity) {
        throw new BadRequestException(
          'مقدار قطعی‌سازی نمی‌تواند بیشتر از موجودی رزروشده باشد.',
        );
      }

      if (dto.quantity > previousQuantity) {
        throw new BadRequestException(
          'مقدار قطعی‌سازی نمی‌تواند بیشتر از موجودی کل باشد.',
        );
      }

      const currentQuantity = previousQuantity - dto.quantity;

      const currentReservedQuantity = previousReservedQuantity - dto.quantity;

      await tx.$executeRaw(
        Prisma.sql`
              UPDATE "Inventory"
              SET
                "quantity" = ${currentQuantity},
                "reservedQuantity" = ${currentReservedQuantity},
                "updatedAt" = ${now}
              WHERE "id" = ${inventoryId}
            `,
      );

      const movement = await this.createStockMovementTx(
        tx,
        inventoryId,
        StockMovementType.OUT,
        dto.quantity,
        dto.reason ?? 'موجودی رزروشده قطعی شد.',
        dto.reference,
        now,
      );

      return {
        current,
        movement,
        previousQuantity,
        currentQuantity,
        previousReservedQuantity,
        currentReservedQuantity,
      };
    });

    this.eventPublisher.publishReservedStockCommitted({
      inventoryId,
      variantId: result.current.variant_id,
      warehouseId: result.current.warehouse_id,
      movementId: result.movement.id,
      quantity: dto.quantity,
      previousQuantity: result.previousQuantity,
      currentQuantity: result.currentQuantity,
      previousReservedQuantity: result.previousReservedQuantity,
      currentReservedQuantity: result.currentReservedQuantity,
      reference: dto.reference ?? null,
      actorId,
      occurredAt: now,
    });

    await this.publishStockThresholdEvents(inventoryId, actorId);

    return this.findOne(inventoryId);
  }

  async findMovements(query: QueryStockMovementDto) {
    const { page, limit, skip } = this.buildMovementPagination(query);

    const whereSql = this.buildMovementWhereSql(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<StockMovementRow[]>(
        Prisma.sql`
            SELECT
              sm."id",
              sm."inventoryId" AS inventory_id,
              sm."type",
              sm."quantity",
              sm."reason",
              sm."reference",
              sm."createdAt" AS created_at,
              i."variantId" AS variant_id,
              i."warehouseId" AS warehouse_id,
              w."code" AS warehouse_code,
              p."name" AS product_name,
              pv."sku" AS variant_sku
            FROM "StockMovement" sm
            INNER JOIN "Inventory" i ON i."id" = sm."inventoryId"
            INNER JOIN "Warehouse" w ON w."id" = i."warehouseId"
            INNER JOIN "ProductVariant" pv ON pv."id" = i."variantId"
            INNER JOIN "Product" p ON p."id" = pv."productId"
            ${whereSql}
            ORDER BY sm."createdAt" DESC, sm."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),

      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS count
            FROM "StockMovement" sm
            INNER JOIN "Inventory" i ON i."id" = sm."inventoryId"
            INNER JOIN "Warehouse" w ON w."id" = i."warehouseId"
            INNER JOIN "ProductVariant" pv ON pv."id" = i."variantId"
            INNER JOIN "Product" p ON p."id" = pv."productId"
            ${whereSql}
          `,
      ),
    ]);

    return this.buildPaginatedResult(
      rows.map((row) => this.mapMovementRow(row)),
      this.toNumber(countRows[0]?.count),
      page,
      limit,
    );
  }

  async getLowStock(query: QueryInventoryDto) {
    return this.findAll({
      ...query,
      lowStock: true,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  private async createStockMovementTx(
    tx: PrismaTx,
    inventoryId: string,
    type: StockMovementType,
    quantity: number,
    reason?: string,
    reference?: string,
    occurredAt = new Date(),
  ): Promise<StockMovementRow> {
    const movementId = randomUUID();

    const rows = await tx.$queryRaw<StockMovementRow[]>(
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
            ${movementId},
            ${inventoryId},
            ${type}::"StockMovementType",
            ${quantity},
            ${reason ?? null},
            ${reference ?? null},
            ${occurredAt}
          )
          RETURNING
            "id",
            "inventoryId" AS inventory_id,
            "type",
            "quantity",
            "reason",
            "reference",
            "createdAt" AS created_at,
            NULL::text AS variant_id,
            NULL::text AS warehouse_id,
            NULL::text AS warehouse_code,
            NULL::text AS product_name,
            NULL::text AS variant_sku
        `,
    );

    return rows[0];
  }

  private calculateAdjustedQuantity(
    previousQuantity: number,
    reservedQuantity: number,
    dto: AdjustStockDto,
  ): number {
    if (
      dto.type === StockMovementType.IN ||
      dto.type === StockMovementType.RETURN
    ) {
      return previousQuantity + dto.quantity;
    }

    if (dto.type === StockMovementType.OUT) {
      const availableQuantity = previousQuantity - reservedQuantity;

      if (dto.quantity > availableQuantity) {
        throw new BadRequestException('موجودی آزاد کافی نیست.');
      }

      return previousQuantity - dto.quantity;
    }

    if (dto.type === StockMovementType.ADJUSTMENT) {
      return dto.quantity;
    }

    throw new BadRequestException('نوع عملیات موجودی پشتیبانی نمی‌شود.');
  }

  private async findInventoryRowForUpdate(
    tx: PrismaTx | PrismaService,
    inventoryId: string,
  ): Promise<InventoryRow> {
    const rows = await tx.$queryRaw<InventoryRow[]>(
      Prisma.sql`
          SELECT
            i."id",
            i."variantId" AS variant_id,
            i."warehouseId" AS warehouse_id,
            i."quantity",
            i."reservedQuantity" AS reserved_quantity,
            i."lowStockThreshold" AS low_stock_threshold,
            i."createdAt" AS created_at,
            i."updatedAt" AS updated_at,
            w."name" AS warehouse_name,
            w."code" AS warehouse_code,
            p."id" AS product_id,
            p."name" AS product_name,
            p."slug" AS product_slug,
            pv."sku" AS variant_sku,
            pv."name" AS variant_name
          FROM "Inventory" i
          INNER JOIN "Warehouse" w ON w."id" = i."warehouseId"
          INNER JOIN "ProductVariant" pv ON pv."id" = i."variantId"
          INNER JOIN "Product" p ON p."id" = pv."productId"
          WHERE i."id" = ${inventoryId}
          LIMIT 1
          FOR UPDATE
        `,
    );

    if (!rows[0]) {
      throw new NotFoundException('رکورد موجودی موردنظر یافت نشد.');
    }

    return rows[0];
  }

  private async assertVariantExists(tx: PrismaTx, variantId: string) {
    const rows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "ProductVariant" pv
          INNER JOIN "Product" p ON p."id" = pv."productId"
          WHERE pv."id" = ${variantId}
            AND pv."deleted_at" IS NULL
            AND pv."isActive" = true
            AND p."deleted_at" IS NULL
        `,
    );

    if (this.toNumber(rows[0]?.count) === 0) {
      throw new BadRequestException('واریانت محصول یافت نشد یا فعال نیست.');
    }
  }

  private async assertWarehouseActive(tx: PrismaTx, warehouseId: string) {
    const rows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "Warehouse"
          WHERE "id" = ${warehouseId}
            AND "isActive" = true
        `,
    );

    if (this.toNumber(rows[0]?.count) === 0) {
      throw new BadRequestException('انبار یافت نشد یا فعال نیست.');
    }
  }

  private async assertInventoryUnique(
    tx: PrismaTx,
    variantId: string,
    warehouseId: string,
  ) {
    const rows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "Inventory"
          WHERE "variantId" = ${variantId}
            AND "warehouseId" = ${warehouseId}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException(
        'برای این واریانت و انبار قبلاً رکورد موجودی ثبت شده است.',
      );
    }
  }

  private async assertWarehouseCodeUnique(
    tx: PrismaTx | PrismaService,
    code: string,
    excludeWarehouseId?: string,
  ) {
    const rows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "Warehouse"
          WHERE "code" = ${code}
            ${
              excludeWarehouseId
                ? Prisma.sql`AND "id" <> ${excludeWarehouseId}`
                : Prisma.empty
            }
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('کد انبار تکراری است.');
    }
  }

  private buildInventoryWhereSql(query: QueryInventoryDto): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];

    if (query.variantId) {
      conditions.push(Prisma.sql`i."variantId" = ${query.variantId}`);
    }

    if (query.warehouseId) {
      conditions.push(Prisma.sql`i."warehouseId" = ${query.warehouseId}`);
    }

    if (query.warehouseCode) {
      conditions.push(Prisma.sql`w."code" = ${query.warehouseCode}`);
    }

    if (query.q) {
      conditions.push(
        Prisma.sql`
          (
            p."name" ILIKE ${`%${query.q}%`}
            OR p."sku" ILIKE ${`%${query.q}%`}
            OR pv."sku" ILIKE ${`%${query.q}%`}
            OR pv."name" ILIKE ${`%${query.q}%`}
            OR w."name" ILIKE ${`%${query.q}%`}
            OR w."code" ILIKE ${`%${query.q}%`}
          )
        `,
      );
    }

    if (query.lowStock === true) {
      conditions.push(
        Prisma.sql`
          GREATEST(
            i."quantity" - i."reservedQuantity",
            0
          ) <= i."lowStockThreshold"
        `,
      );
    }

    if (query.outOfStock === true) {
      conditions.push(
        Prisma.sql`
          GREATEST(
            i."quantity" - i."reservedQuantity",
            0
          ) <= 0
        `,
      );
    }

    if (query.inStock === true) {
      conditions.push(
        Prisma.sql`
          GREATEST(
            i."quantity" - i."reservedQuantity",
            0
          ) > 0
        `,
      );
    }

    if (conditions.length === 0) {
      return Prisma.empty;
    }

    return Prisma.sql`
      WHERE ${Prisma.join(conditions, ' AND ')}
    `;
  }

  private buildMovementWhereSql(query: QueryStockMovementDto): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];

    if (query.inventoryId) {
      conditions.push(Prisma.sql`sm."inventoryId" = ${query.inventoryId}`);
    }

    if (query.variantId) {
      conditions.push(Prisma.sql`i."variantId" = ${query.variantId}`);
    }

    if (query.warehouseId) {
      conditions.push(Prisma.sql`i."warehouseId" = ${query.warehouseId}`);
    }

    if (query.type) {
      conditions.push(
        Prisma.sql`sm."type" = ${query.type}::"StockMovementType"`,
      );
    }

    if (query.reference) {
      conditions.push(
        Prisma.sql`sm."reference" ILIKE ${`%${query.reference}%`}`,
      );
    }

    if (query.createdFrom) {
      conditions.push(
        Prisma.sql`sm."createdAt" >= ${this.parseDate(query.createdFrom)}`,
      );
    }

    if (query.createdTo) {
      conditions.push(
        Prisma.sql`sm."createdAt" <= ${this.parseDate(query.createdTo)}`,
      );
    }

    if (conditions.length === 0) {
      return Prisma.empty;
    }

    return Prisma.sql`
      WHERE ${Prisma.join(conditions, ' AND ')}
    `;
  }

  private async publishStockThresholdEvents(
    inventoryId: string,
    actorId?: string,
  ) {
    const inventory = await this.findOne(inventoryId);

    const availableQuantity = inventory.availableQuantity;

    if (availableQuantity <= 0) {
      this.eventPublisher.publishOutOfStockDetected({
        inventoryId: inventory.id,
        variantId: inventory.variant.id,
        warehouseId: inventory.warehouse.id,
        actorId,
        occurredAt: new Date(),
      });

      return;
    }

    if (availableQuantity <= inventory.lowStockThreshold) {
      this.eventPublisher.publishLowStockDetected({
        inventoryId: inventory.id,
        variantId: inventory.variant.id,
        warehouseId: inventory.warehouse.id,
        availableQuantity,
        lowStockThreshold: inventory.lowStockThreshold,
        actorId,
        occurredAt: new Date(),
      });
    }
  }

  private mapWarehouseRow(row: WarehouseRow) {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description,
      address: row.address,
      city: row.city,
      country: row.country,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.created_at),
      updatedAt: row.updated_at.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updated_at),
    };
  }

  private mapInventoryRow(row: InventoryRow) {
    const quantity = this.toNumber(row.quantity);

    const reservedQuantity = this.toNumber(row.reserved_quantity);

    const availableQuantity = Math.max(0, quantity - reservedQuantity);

    const lowStockThreshold = this.toNumber(row.low_stock_threshold);

    return {
      id: row.id,
      variant: {
        id: row.variant_id,
        sku: row.variant_sku,
        name: row.variant_name,
      },
      product: {
        id: row.product_id,
        name: row.product_name,
        slug: row.product_slug,
      },
      warehouse: {
        id: row.warehouse_id,
        name: row.warehouse_name,
        code: row.warehouse_code,
      },
      quantity,
      reservedQuantity,
      availableQuantity,
      lowStockThreshold,
      isLowStock: availableQuantity <= lowStockThreshold,
      isOutOfStock: availableQuantity <= 0,
      createdAt: row.created_at.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.created_at),
      updatedAt: row.updated_at.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updated_at),
    };
  }

  private mapMovementRow(row: StockMovementRow) {
    return {
      id: row.id,
      inventoryId: row.inventory_id,
      type: row.type,
      quantity: this.toNumber(row.quantity),
      reason: row.reason,
      reference: row.reference,
      variant: {
        id: row.variant_id,
        sku: row.variant_sku,
      },
      warehouse: {
        id: row.warehouse_id,
        code: row.warehouse_code,
      },
      product: {
        name: row.product_name,
      },
      createdAt: row.created_at.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.created_at),
    };
  }

  private buildInventoryPagination(query: QueryInventoryDto) {
    const page = Math.max(1, Number(query.page ?? 1));

    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));

    const skip = (page - 1) * limit;

    return {
      page,
      limit,
      skip,
    };
  }

  private buildMovementPagination(query: QueryStockMovementDto) {
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
