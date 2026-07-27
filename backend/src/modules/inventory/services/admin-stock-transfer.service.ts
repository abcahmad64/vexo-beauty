import { BadRequestException, Injectable } from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminTransferStockDto } from '../dto/admin-transfer-stock.dto';

import { AdminInventoryService } from './admin-inventory.service';

@Injectable()
export class AdminStockTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminInventoryService: AdminInventoryService,
  ) {}

  async transferStock(dto: AdminTransferStockDto, actorId?: string) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException(
        'انبار مبدأ و مقصد نمی‌توانند یکسان باشند.',
      );
    }

    let fromInventoryId = '';
    let toInventoryId = '';

    const now = new Date();

    const transferReference =
      dto.reference ?? `admin-stock-transfer:${randomUUID()}`;

    await this.prisma.$transaction(async (tx) => {
      const fromInventory =
        await this.adminInventoryService.ensureInventoryForUpdateTx(
          tx,
          dto.variantId,
          dto.fromWarehouseId,
          dto.lowStockThreshold,
        );

      const toInventory =
        await this.adminInventoryService.ensureInventoryForUpdateTx(
          tx,
          dto.variantId,
          dto.toWarehouseId,
          dto.lowStockThreshold,
        );

      fromInventoryId = fromInventory.id;

      toInventoryId = toInventory.id;

      const fromQuantity = this.adminInventoryService.toNumber(
        fromInventory.quantity,
      );

      const fromReserved = this.adminInventoryService.toNumber(
        fromInventory.reservedQuantity,
      );

      const availableQuantity = fromQuantity - fromReserved;

      if (dto.quantity > availableQuantity) {
        throw new BadRequestException(
          'موجودی آزاد انبار مبدأ برای انتقال کافی نیست.',
        );
      }

      await tx.$executeRaw(
        Prisma.sql`
            UPDATE "Inventory"
            SET
              "quantity" = ${fromQuantity - dto.quantity},
              "updatedAt" = ${now}
            WHERE "id" = ${fromInventory.id}
          `,
      );

      await tx.$executeRaw(
        Prisma.sql`
            UPDATE "Inventory"
            SET
              "quantity" = ${
                this.adminInventoryService.toNumber(toInventory.quantity) +
                dto.quantity
              },
              "lowStockThreshold" = ${
                dto.lowStockThreshold ??
                this.adminInventoryService.toNumber(
                  toInventory.lowStockThreshold,
                )
              },
              "updatedAt" = ${now}
            WHERE "id" = ${toInventory.id}
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
              ${fromInventory.id},
              'OUT'::"StockMovementType",
              ${dto.quantity},
              ${dto.reason ?? 'انتقال بین انبارها - خروج از مبدأ'},
              ${transferReference},
              ${now}
            )
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
              ${toInventory.id},
              'IN'::"StockMovementType",
              ${dto.quantity},
              ${dto.reason ?? 'انتقال بین انبارها - ورود به مقصد'},
              ${transferReference},
              ${now}
            )
          `,
      );
    });

    return {
      fromInventory: await this.adminInventoryService.findOne(fromInventoryId),
      toInventory: await this.adminInventoryService.findOne(toInventoryId),
      transferredAt: now.toISOString(),
      transferredAtFa: this.formatDateTimeFa(now),
      audit: {
        actorId: actorId ?? null,
        action: 'inventory.stock_transferred',
        reference: transferReference,
        reason: dto.reason ?? null,
      },
    };
  }

  private formatDateTimeFa(date: Date): string {
    return formatPersianDateTime(date) ?? '';
  }
}
