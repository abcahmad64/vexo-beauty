import { Injectable, Logger } from '@nestjs/common';

import {
  PaymentStatus,
  Prisma,
  StockMovementType,
} from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { RefundCompletedEventPayload } from '../events/refund.event.payloads';

type PrismaTx = Prisma.TransactionClient;

type CountRow = {
  count: number;
};

type OrderItemForRefundRestockRow = {
  orderId: string;
  orderNumber: string;
  variantId: string | null;
  quantity: number | bigint;
};

type InventoryForRestockRow = {
  id: string;
  variantId: string;
  warehouseId: string;
  quantity: number | bigint;
  reservedQuantity: number | bigint;
};

type WarehouseRow = {
  id: string;
};

export type RefundInventoryRestorationResult = {
  readonly skipped: boolean;
  readonly reason?: string;
  readonly refundId: string;
  readonly orderId: string;
  readonly restoredItems: number;
  readonly restoredQuantity: number;
};

@Injectable()
export class RefundInventoryService {
  private readonly logger = new Logger(RefundInventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async restoreInventoryAfterRefundCompleted(
    payload: RefundCompletedEventPayload,
  ): Promise<RefundInventoryRestorationResult> {
    if (payload.paymentStatus !== PaymentStatus.REFUNDED) {
      return {
        skipped: true,
        reason: 'partial_refund_does_not_restore_inventory_automatically',
        refundId: payload.refundId,
        orderId: payload.orderId,
        restoredItems: 0,
        restoredQuantity: 0,
      };
    }

    if (payload.orderId.trim().length < 1) {
      return {
        skipped: true,
        reason: 'missing_order_id',
        refundId: payload.refundId,
        orderId: payload.orderId,
        restoredItems: 0,
        restoredQuantity: 0,
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const alreadyRestored = await this.hasRestorationMovementTx(
        tx,
        payload.refundId,
      );

      if (alreadyRestored) {
        return {
          skipped: true,
          reason: 'refund_inventory_already_restored',
          refundId: payload.refundId,
          orderId: payload.orderId,
          restoredItems: 0,
          restoredQuantity: 0,
        };
      }

      const items = await this.findRestockableOrderItemsTx(tx, payload.orderId);

      if (items.length === 0) {
        return {
          skipped: true,
          reason: 'no_variant_items_found',
          refundId: payload.refundId,
          orderId: payload.orderId,
          restoredItems: 0,
          restoredQuantity: 0,
        };
      }

      let restoredItems = 0;

      let restoredQuantity = 0;

      for (const item of items) {
        if (!item.variantId) {
          continue;
        }

        const quantity = this.toNumber(item.quantity);

        if (quantity <= 0) {
          continue;
        }

        const inventory = await this.findOrCreateInventoryForVariantTx(
          tx,
          item.variantId,
        );

        await this.restoreInventoryItemTx(
          tx,
          inventory.id,
          quantity,
          this.buildReason(item.orderNumber),
          this.buildReference(payload.refundId),
        );

        restoredItems += 1;
        restoredQuantity += quantity;
      }

      return {
        skipped: false,
        refundId: payload.refundId,
        orderId: payload.orderId,
        restoredItems,
        restoredQuantity,
      };
    });

    this.logger.log(
      `Refund inventory restoration completed: refund=${result.refundId}; order=${result.orderId}; skipped=${result.skipped}; items=${result.restoredItems}; quantity=${result.restoredQuantity}`,
    );

    return result;
  }

  private async hasRestorationMovementTx(
    tx: PrismaTx,
    refundId: string,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "StockMovement"
          WHERE
            "type" = ${StockMovementType.RETURN}::"StockMovementType"
            AND "reference" = ${this.buildReference(refundId)}
        `,
    );

    return (rows[0]?.count ?? 0) > 0;
  }

  private async findRestockableOrderItemsTx(
    tx: PrismaTx,
    orderId: string,
  ): Promise<OrderItemForRefundRestockRow[]> {
    return tx.$queryRaw<OrderItemForRefundRestockRow[]>(
      Prisma.sql`
        SELECT
          oi."orderId",
          o."orderNumber",
          oi."variantId",
          oi."quantity"
        FROM "OrderItem" oi
        INNER JOIN "Order" o
          ON o."id" = oi."orderId"
        WHERE
          oi."orderId" = ${orderId}
          AND oi."variantId" IS NOT NULL
        ORDER BY
          oi."createdAt" ASC,
          oi."id" ASC
      `,
    );
  }

  private async findOrCreateInventoryForVariantTx(
    tx: PrismaTx,
    variantId: string,
  ): Promise<InventoryForRestockRow> {
    const existingRows = await tx.$queryRaw<InventoryForRestockRow[]>(
      Prisma.sql`
          SELECT
            i."id",
            i."variantId",
            i."warehouseId",
            i."quantity",
            i."reservedQuantity"
          FROM "Inventory" i
          INNER JOIN "Warehouse" w
            ON w."id" = i."warehouseId"
          WHERE
            i."variantId" = ${variantId}
          ORDER BY
            w."isActive" DESC,
            i."updatedAt" DESC
          LIMIT 1
          FOR UPDATE OF i
        `,
    );

    const existing = existingRows[0];

    if (existing) {
      return existing;
    }

    const warehouse = await this.findDefaultWarehouseTx(tx);

    const inventoryId = crypto.randomUUID();

    const createdRows = await tx.$queryRaw<InventoryForRestockRow[]>(
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
            ${warehouse.id},
            0,
            0,
            5,
            NOW(),
            NOW()
          )
          RETURNING
            "id",
            "variantId",
            "warehouseId",
            "quantity",
            "reservedQuantity"
        `,
    );

    return createdRows[0];
  }

  private async findDefaultWarehouseTx(tx: PrismaTx): Promise<WarehouseRow> {
    const rows = await tx.$queryRaw<WarehouseRow[]>(
      Prisma.sql`
          SELECT
            "id"
          FROM "Warehouse"
          WHERE
            "isActive" = TRUE
          ORDER BY
            "createdAt" ASC,
            "id" ASC
          LIMIT 1
        `,
    );

    const warehouse = rows[0];

    if (!warehouse) {
      throw new Error('هیچ انبار فعالی برای برگشت موجودی وجود ندارد.');
    }

    return warehouse;
  }

  private async restoreInventoryItemTx(
    tx: PrismaTx,
    inventoryId: string,
    quantity: number,
    reason: string,
    reference: string,
  ): Promise<void> {
    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "Inventory"
        SET
          "quantity" = "quantity" + ${quantity},
          "updatedAt" = NOW()
        WHERE
          "id" = ${inventoryId}
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
          ${crypto.randomUUID()},
          ${inventoryId},
          ${StockMovementType.RETURN}::"StockMovementType",
          ${quantity},
          ${reason},
          ${reference},
          NOW()
        )
      `,
    );
  }

  private buildReference(refundId: string): string {
    return `refund:${refundId}`;
  }

  private buildReason(orderNumber: string): string {
    return `بازگشت موجودی پس از بازگشت وجه سفارش ${orderNumber}`;
  }

  private toNumber(value: number | bigint): number {
    if (typeof value === 'bigint') {
      return Number(value);
    }

    return value;
  }
}
