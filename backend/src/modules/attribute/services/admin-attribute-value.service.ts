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

import { AdminCreateAttributeValueDto } from '../dto/admin-create-attribute-value.dto';

import { AdminUpdateAttributeValueDto } from '../dto/admin-update-attribute-value.dto';

type CountRow = {
  count: number | bigint;
};

type AttributeValueRow = {
  id: string;
  attributeId: string;
  attributeName: string;
  value: string;
  productUsageCount: number | bigint;
  variantUsageCount: number | bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type AttributeValueResponse = {
  id: string;
  attributeId: string;
  attributeName: string;
  value: string;
  productUsageCount: number;
  variantUsageCount: number;
  createdAt: string;
  createdAtFa: string;
  updatedAt: string;
  updatedAtFa: string;
  deletedAt: string | null;
  deletedAtFa: string | null;
};

@Injectable()
export class AdminAttributeValueService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeDeleted = false) {
    const where: Prisma.Sql[] = [Prisma.sql`a."deleted_at" IS NULL`];

    if (!includeDeleted) {
      where.push(Prisma.sql`av."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AttributeValueRow[]>(
      Prisma.sql`
          SELECT
            av."id",
            av."attributeId",
            a."name" AS "attributeName",
            av."value",
            (
              SELECT
                COUNT(DISTINCT pa."productId")::int
              FROM "ProductAttribute" pa
              WHERE pa."attributeValueId" = av."id"
            ) AS "productUsageCount",
            (
              SELECT
                COUNT(DISTINCT va."variantId")::int
              FROM "VariantAttribute" va
              WHERE va."attributeValueId" = av."id"
            ) AS "variantUsageCount",
            av."createdAt",
            av."updatedAt",
            av."deleted_at" AS "deletedAt"
          FROM "AttributeValue" av
          INNER JOIN "Attribute" a
            ON a."id" = av."attributeId"
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            a."name" ASC,
            av."value" ASC,
            av."id" ASC
        `,
    );

    return {
      data: rows.map((row) => this.mapValue(row)),
      meta: {
        total: rows.length,
        includeDeleted,
      },
    };
  }

  async findByAttribute(attributeId: string, includeDeleted = false) {
    await this.assertAttributeExists(attributeId);

    const where: Prisma.Sql[] = [Prisma.sql`av."attributeId" = ${attributeId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`av."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AttributeValueRow[]>(
      Prisma.sql`
          SELECT
            av."id",
            av."attributeId",
            a."name" AS "attributeName",
            av."value",
            (
              SELECT
                COUNT(DISTINCT pa."productId")::int
              FROM "ProductAttribute" pa
              WHERE pa."attributeValueId" = av."id"
            ) AS "productUsageCount",
            (
              SELECT
                COUNT(DISTINCT va."variantId")::int
              FROM "VariantAttribute" va
              WHERE va."attributeValueId" = av."id"
            ) AS "variantUsageCount",
            av."createdAt",
            av."updatedAt",
            av."deleted_at" AS "deletedAt"
          FROM "AttributeValue" av
          INNER JOIN "Attribute" a
            ON a."id" = av."attributeId"
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            av."value" ASC,
            av."id" ASC
        `,
    );

    return {
      data: rows.map((row) => this.mapValue(row)),
      meta: {
        total: rows.length,
        attributeId,
        includeDeleted,
      },
    };
  }

  async findOne(attributeValueId: string, includeDeleted = true) {
    return this.mapValue(
      await this.findValueRow(attributeValueId, includeDeleted),
    );
  }

  async create(
    attributeId: string,
    dto: AdminCreateAttributeValueDto,
    actorId?: string,
  ) {
    const resolvedAttributeId = dto.attributeId ?? attributeId;

    if (!resolvedAttributeId) {
      throw new BadRequestException(
        'شناسه ویژگی برای ایجاد مقدار ویژگی ارسال نشده است.',
      );
    }

    await this.assertAttributeExists(resolvedAttributeId);

    const value = this.normalizeValue(dto.value);

    await this.assertValueUnique(resolvedAttributeId, value);

    const attributeValueId = randomUUID();

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "AttributeValue" (
          "id",
          "attributeId",
          "value",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${attributeValueId},
          ${resolvedAttributeId},
          ${value},
          ${now},
          ${now}
        )
      `,
    );

    return {
      attributeValue: await this.findOne(attributeValueId),
      audit: {
        actorId: actorId ?? null,
        action: 'attribute_value.admin_created',
      },
    };
  }

  async update(
    attributeValueId: string,
    dto: AdminUpdateAttributeValueDto,
    actorId?: string,
  ) {
    const current = await this.findValueRow(attributeValueId, false);

    if (dto.attributeId === undefined && dto.value === undefined) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی مقدار ویژگی ارسال نشده است.',
      );
    }

    const nextAttributeId = dto.attributeId ?? current.attributeId;

    const nextValue =
      dto.value !== undefined ? this.normalizeValue(dto.value) : current.value;

    if (dto.attributeId !== undefined) {
      await this.assertAttributeExists(dto.attributeId);
    }

    await this.assertValueUnique(nextAttributeId, nextValue, attributeValueId);

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AttributeValue"
        SET
          "attributeId" = ${nextAttributeId},
          "value" = ${nextValue},
          "updatedAt" = ${now}
        WHERE
          "id" = ${attributeValueId}
          AND "deleted_at" IS NULL
      `,
    );

    if (dto.attributeId !== undefined) {
      await this.syncVariantAttributeAttributeId(
        attributeValueId,
        dto.attributeId,
      );
    }

    return {
      attributeValue: await this.findOne(attributeValueId),
      audit: {
        actorId: actorId ?? null,
        action: 'attribute_value.admin_updated',
      },
    };
  }

  async delete(attributeValueId: string, actorId?: string) {
    await this.findValueRow(attributeValueId, false);

    const usage = await this.countValueUsage(attributeValueId);

    if (usage.productUsageCount > 0 || usage.variantUsageCount > 0) {
      throw new BadRequestException(
        'این مقدار ویژگی در محصولات یا واریانت‌ها استفاده شده و قابل حذف نیست.',
      );
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AttributeValue"
        SET
          "deleted_at" = ${now},
          "updatedAt" = ${now}
        WHERE
          "id" = ${attributeValueId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      deletedAt: now.toISOString(),
      deletedAtFa: this.formatDateTimeFaNullable(now),
      audit: {
        actorId: actorId ?? null,
        action: 'attribute_value.admin_deleted',
      },
    };
  }

  async restore(attributeValueId: string, actorId?: string) {
    const current = await this.findValueRow(attributeValueId, true);

    if (!current.deletedAt) {
      return {
        attributeValue: await this.findOne(attributeValueId),
        audit: {
          actorId: actorId ?? null,
          action: 'attribute_value.admin_restore_skipped',
        },
      };
    }

    await this.assertAttributeExists(current.attributeId);

    await this.assertValueUnique(
      current.attributeId,
      current.value,
      attributeValueId,
    );

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AttributeValue"
        SET
          "deleted_at" = NULL,
          "updatedAt" = ${now}
        WHERE "id" = ${attributeValueId}
      `,
    );

    return {
      attributeValue: await this.findOne(attributeValueId),
      audit: {
        actorId: actorId ?? null,
        action: 'attribute_value.admin_restored',
      },
    };
  }

  async findValueRow(
    attributeValueId: string,
    includeDeleted: boolean,
  ): Promise<AttributeValueRow> {
    const where: Prisma.Sql[] = [Prisma.sql`av."id" = ${attributeValueId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`av."deleted_at" IS NULL`);

      where.push(Prisma.sql`a."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AttributeValueRow[]>(
      Prisma.sql`
          SELECT
            av."id",
            av."attributeId",
            a."name" AS "attributeName",
            av."value",
            (
              SELECT
                COUNT(DISTINCT pa."productId")::int
              FROM "ProductAttribute" pa
              WHERE pa."attributeValueId" = av."id"
            ) AS "productUsageCount",
            (
              SELECT
                COUNT(DISTINCT va."variantId")::int
              FROM "VariantAttribute" va
              WHERE va."attributeValueId" = av."id"
            ) AS "variantUsageCount",
            av."createdAt",
            av."updatedAt",
            av."deleted_at" AS "deletedAt"
          FROM "AttributeValue" av
          INNER JOIN "Attribute" a
            ON a."id" = av."attributeId"
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const value = rows[0];

    if (!value) {
      throw new NotFoundException('مقدار ویژگی موردنظر یافت نشد.');
    }

    return value;
  }

  private async assertAttributeExists(attributeId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Attribute"
          WHERE
            "id" = ${attributeId}
            AND "deleted_at" IS NULL
        `,
    );

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException('ویژگی انتخاب‌شده معتبر نیست.');
    }
  }

  private async assertValueUnique(
    attributeId: string,
    value: string,
    exceptAttributeValueId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [
      Prisma.sql`"attributeId" = ${attributeId}`,
      Prisma.sql`LOWER("value") = LOWER(${value})`,
    ];

    if (exceptAttributeValueId) {
      where.push(Prisma.sql`"id" <> ${exceptAttributeValueId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "AttributeValue"
          WHERE ${Prisma.join(where, ' AND ')}
        `,
    );

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException(
        'این مقدار برای ویژگی انتخاب‌شده تکراری است.',
      );
    }
  }

  private async countValueUsage(attributeValueId: string): Promise<{
    productUsageCount: number;
    variantUsageCount: number;
  }> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        productUsageCount: number | bigint;
        variantUsageCount: number | bigint;
      }>
    >(
      Prisma.sql`
          SELECT
            (
              SELECT
                COUNT(DISTINCT pa."productId")::int
              FROM "ProductAttribute" pa
              WHERE pa."attributeValueId" = ${attributeValueId}
            ) AS "productUsageCount",
            (
              SELECT
                COUNT(DISTINCT va."variantId")::int
              FROM "VariantAttribute" va
              WHERE va."attributeValueId" = ${attributeValueId}
            ) AS "variantUsageCount"
        `,
    );

    return {
      productUsageCount: this.toNumber(rows[0]?.productUsageCount),
      variantUsageCount: this.toNumber(rows[0]?.variantUsageCount),
    };
  }

  private async syncVariantAttributeAttributeId(
    attributeValueId: string,
    attributeId: string,
  ): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "VariantAttribute"
        SET "attributeId" = ${attributeId}
        WHERE "attributeValueId" = ${attributeValueId}
      `,
    );
  }

  private mapValue(row: AttributeValueRow): AttributeValueResponse {
    return {
      id: row.id,
      attributeId: row.attributeId,
      attributeName: row.attributeName,
      value: row.value,
      productUsageCount: this.toNumber(row.productUsageCount),
      variantUsageCount: this.toNumber(row.variantUsageCount),
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: this.formatDateTimeFaNullable(row.deletedAt),
    };
  }

  private normalizeValue(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
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

  private toNumber(value: number | bigint | undefined): number {
    if (value === undefined) {
      return 0;
    }

    return Number(value);
  }
}
