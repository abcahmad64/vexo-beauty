import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminBulkUpdateProductsDto } from '../dto/admin-bulk-update-products.dto';

type UpdatedRow = {
  id: string;
};

type CountRow = {
  count: number | bigint;
};

@Injectable()
export class AdminProductBulkService {
  constructor(private readonly prisma: PrismaService) {}

  async bulkUpdate(dto: AdminBulkUpdateProductsDto, actorId?: string) {
    const uniqueProductIds = Array.from(
      new Set(dto.productIds.map((productId) => productId.trim())),
    ).filter(Boolean);

    if (uniqueProductIds.length < 1) {
      throw new BadRequestException(
        'هیچ محصولی برای عملیات گروهی انتخاب نشده است.',
      );
    }

    if (dto.brandId) {
      await this.assertBrandExists(dto.brandId);
    }

    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }

    const now = new Date();

    const assignments = this.buildAssignments(dto, now);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ عملیات معتبری برای به‌روزرسانی گروهی ارسال نشده است.',
      );
    }

    const rows = await this.prisma.$queryRaw<UpdatedRow[]>(
      Prisma.sql`
          UPDATE "Product"
          SET
            ${Prisma.join(assignments, ', ')},
            "updatedAt" = ${now}
          WHERE
            "id" IN (${Prisma.join(uniqueProductIds)})
            AND "deleted_at" IS NULL
          RETURNING "id"
        `,
    );

    return {
      requestedCount: uniqueProductIds.length,
      updatedCount: rows.length,
      updatedProductIds: rows.map((row) => row.id),
      updatedAt: now.toISOString(),
      updatedAtFa: this.formatDateTimeFa(now),
      audit: {
        actorId: actorId ?? null,
        action: `product.bulk_${dto.action}`,
        reason: dto.reason ?? null,
      },
    };
  }

  private buildAssignments(
    dto: AdminBulkUpdateProductsDto,
    now: Date,
  ): Prisma.Sql[] {
    if (dto.action === 'activate') {
      return [
        Prisma.sql`"isActive" = TRUE`,
        Prisma.sql`"status" = 'ACTIVE'::"ProductStatus"`,
      ];
    }

    if (dto.action === 'deactivate') {
      return [
        Prisma.sql`"isActive" = FALSE`,
        Prisma.sql`"status" = 'INACTIVE'::"ProductStatus"`,
      ];
    }

    if (dto.action === 'archive') {
      return [
        Prisma.sql`"isActive" = FALSE`,
        Prisma.sql`"status" = 'ARCHIVED'::"ProductStatus"`,
      ];
    }

    if (dto.action === 'delete') {
      return [
        Prisma.sql`"isActive" = FALSE`,
        Prisma.sql`"status" = 'ARCHIVED'::"ProductStatus"`,
        Prisma.sql`"deleted_at" = ${now}`,
      ];
    }

    const assignments: Prisma.Sql[] = [];

    if (dto.status !== undefined) {
      assignments.push(Prisma.sql`"status" = ${dto.status}::"ProductStatus"`);
    }

    if (dto.isActive !== undefined) {
      assignments.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    if (dto.brandId !== undefined) {
      assignments.push(Prisma.sql`"brandId" = ${dto.brandId}`);
    }

    if (dto.categoryId !== undefined) {
      assignments.push(Prisma.sql`"categoryId" = ${dto.categoryId}`);
    }

    return assignments;
  }

  private async assertBrandExists(brandId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "Brand"
          WHERE
            "id" = ${brandId}
            AND "deleted_at" IS NULL
            AND "isActive" = TRUE
        `,
    );

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException('برند انتخاب‌شده معتبر نیست.');
    }
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "Category"
          WHERE
            "id" = ${categoryId}
            AND "deleted_at" IS NULL
            AND "isActive" = TRUE
        `,
    );

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException('دسته‌بندی انتخاب‌شده معتبر نیست.');
    }
  }

  private formatDateTimeFa(date: Date): string {
    return formatPersianDateTime(date) ?? '';
  }

  private toNumber(value: number | bigint | undefined): number {
    if (value === undefined) {
      return 0;
    }

    return Number(value);
  }
}
