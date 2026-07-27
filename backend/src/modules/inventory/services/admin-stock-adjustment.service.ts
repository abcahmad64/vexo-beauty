import { BadRequestException, Injectable } from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminAdjustStockDto } from '../dto/admin-adjust-stock.dto';

import { AdminInventoryService } from './admin-inventory.service';

@Injectable()
export class AdminStockAdjustmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminInventoryService: AdminInventoryService,
  ) {}

  async adjustStock(dto: AdminAdjustStockDto, actorId?: string) {
    let inventoryId = '';

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const inventory =
        await this.adminInventoryService.ensureInventoryForUpdateTx(
          tx,
          dto.variantId,
          dto.warehouseId,
          dto.lowStockThreshold,
        );

      inventoryId = inventory.id;

      const currentQuantity = this.adminInventoryService.toNumber(
        inventory.quantity,
      );

      const reservedQuantity = this.adminInventoryService.toNumber(
        inventory.reservedQuantity,
      );

      const nextQuantity = this.calculateNextQuantity(
        currentQuantity,
        reservedQuantity,
        dto,
      );

      await tx.$executeRaw(
        Prisma.sql`
            UPDATE "Inventory"
            SET
              "quantity" = ${nextQuantity},
              "lowStockThreshold" = ${
                dto.lowStockThreshold ??
                this.adminInventoryService.toNumber(inventory.lowStockThreshold)
              },
              "updatedAt" = ${now}
            WHERE "id" = ${inventory.id}
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
              ${inventory.id},
              ${dto.type}::"StockMovementType",
              ${dto.quantity},
              ${dto.reason ?? null},
              ${dto.reference ?? `admin-stock-adjustment:${inventory.id}`},
              ${now}
            )
          `,
      );
    });

    return {
      inventory: await this.adminInventoryService.findOne(inventoryId),
      adjustedAt: now.toISOString(),
      adjustedAtFa: this.formatDateTimeFa(now),
      audit: {
        actorId: actorId ?? null,
        action: 'inventory.stock_adjusted',
        type: dto.type,
        reason: dto.reason ?? null,
      },
    };
  }

  private calculateNextQuantity(
    currentQuantity: number,
    reservedQuantity: number,
    dto: AdminAdjustStockDto,
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

    if (dto.quantity < reservedQuantity) {
      throw new BadRequestException(
        'مقدار جدید موجودی نمی‌تواند کمتر از موجودی رزروشده باشد.',
      );
    }

    return dto.quantity;
  }

  private formatDateTimeFa(date: Date): string {
    return formatPersianDateTime(date) ?? '';
  }
}
