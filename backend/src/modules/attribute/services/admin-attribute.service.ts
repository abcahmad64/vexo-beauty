import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import {
  Prisma,
  ProductAttributeDataType,
  ProductAttributeInputType,
} from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminCreateAttributeDto } from '../dto/admin-create-attribute.dto';

import { AdminQueryAttributeDto } from '../dto/admin-query-attribute.dto';

import { AdminUpdateAttributeDto } from '../dto/admin-update-attribute.dto';

type CountRow = {
  count: number | bigint;
};

type AttributeRow = {
  id: string;
  name: string;
  code: string | null;
  label: string | null;
  description: string | null;
  dataType: string;
  inputType: string;
  unit: string | null;
  optionsJson: Prisma.JsonValue | null;
  placeholder: string | null;
  helpText: string | null;
  isRequired: boolean;
  isFilterable: boolean;
  isComparable: boolean;
  isSeoImportant: boolean;
  isAiImportant: boolean;
  sortOrder: number;
  isActive: boolean;
  valueCount: number | bigint;
  activeValueCount: number | bigint;
  productUsageCount: number | bigint;
  variantUsageCount: number | bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
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

type AttributeResponse = {
  id: string;
  name: string;
  code: string | null;
  label: string | null;
  description: string | null;
  dataType: string;
  inputType: string;
  unit: string | null;
  options: string[];
  optionsJson: Prisma.JsonValue | null;
  placeholder: string | null;
  helpText: string | null;
  isRequired: boolean;
  isFilterable: boolean;
  isComparable: boolean;
  isSeoImportant: boolean;
  isAiImportant: boolean;
  sortOrder: number;
  isActive: boolean;
  valueCount: number;
  activeValueCount: number;
  productUsageCount: number;
  variantUsageCount: number;
  createdAt: string;
  createdAtFa: string;
  updatedAt: string;
  updatedAtFa: string;
  deletedAt: string | null;
  deletedAtFa: string | null;
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
export class AdminAttributeService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminQueryAttributeDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildAttributeWhere(query, 'a');

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AttributeRow[]>(Prisma.sql`
        SELECT
          a."id",
          a."name",
          a."code",
          a."label",
          a."description",
          a."dataType",
          a."inputType",
          a."unit",
          a."optionsJson",
          a."placeholder",
          a."helpText",
          a."isRequired",
          a."isFilterable",
          a."isComparable",
          a."isSeoImportant",
          a."isAiImportant",
          a."sortOrder",
          a."isActive",
          (
            SELECT COUNT(*)::int
            FROM "AttributeValue" av
            WHERE av."attributeId" = a."id"
          ) AS "valueCount",
          (
            SELECT COUNT(*)::int
            FROM "AttributeValue" av
            WHERE
              av."attributeId" = a."id"
              AND av."deleted_at" IS NULL
          ) AS "activeValueCount",
          (
            SELECT COUNT(DISTINCT pa."productId")::int
            FROM "ProductAttribute" pa
            LEFT JOIN "AttributeValue" av
              ON av."id" = pa."attributeValueId"
            WHERE
              pa."attributeId" = a."id"
              OR av."attributeId" = a."id"
          ) AS "productUsageCount",
          (
            SELECT COUNT(DISTINCT va."variantId")::int
            FROM "VariantAttribute" va
            WHERE va."attributeId" = a."id"
          ) AS "variantUsageCount",
          a."createdAt",
          a."updatedAt",
          a."deleted_at" AS "deletedAt"
        FROM "Attribute" a
        WHERE ${Prisma.join(where, ' AND ')}
        ORDER BY
          ${this.resolveSortColumn(query.sortBy)}
          ${this.resolveSortDirection(query.sortDirection)},
          a."id" DESC
        LIMIT ${limit}
        OFFSET ${skip}
      `),
      this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::int AS "count"
        FROM "Attribute" a
        WHERE ${Prisma.join(where, ' AND ')}
      `),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapAttribute(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(attributeId: string, includeDeleted = true) {
    const attribute = await this.findAttributeRow(attributeId, includeDeleted);

    const values = await this.findValuesByAttribute(
      attributeId,
      includeDeleted,
    );

    return {
      ...this.mapAttribute(attribute),
      values: values.map((value) => this.mapValue(value)),
    };
  }

  async create(dto: AdminCreateAttributeDto, actorId?: string) {
    const name = this.normalizeName(dto.name);
    const code = this.normalizeCode(dto.code);
    const label = this.normalizeOptionalText(dto.label) ?? name;
    const description = this.normalizeOptionalText(dto.description);
    const dataType = this.normalizeDataType(dto.dataType);
    const inputType = this.normalizeInputType(dto.inputType, dataType);
    const unit = this.normalizeOptionalText(dto.unit);
    const optionsJson = this.normalizeOptions(dto.options);
    const placeholder = this.normalizeOptionalText(dto.placeholder);
    const helpText = this.normalizeOptionalText(dto.helpText);

    await this.assertNameUnique(name);
    await this.assertCodeUnique(code);

    const attributeId = randomUUID();

    await this.prisma.attribute.create({
      data: {
        id: attributeId,
        name,
        code,
        label,
        description,
        dataType,
        inputType,
        unit,
        optionsJson,
        placeholder,
        helpText,
        isRequired: dto.isRequired ?? false,
        isFilterable: dto.isFilterable ?? false,
        isComparable: dto.isComparable ?? false,
        isSeoImportant: dto.isSeoImportant ?? false,
        isAiImportant: dto.isAiImportant ?? true,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      select: {
        id: true,
      },
    });

    return {
      attribute: await this.findOne(attributeId),
      audit: {
        actorId: actorId ?? null,
        action: 'attribute.admin_created',
      },
    };
  }

  async update(
    attributeId: string,
    dto: AdminUpdateAttributeDto,
    actorId?: string,
  ) {
    await this.findAttributeRow(attributeId, false);

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی ویژگی ارسال نشده است.',
      );
    }

    const data: Prisma.AttributeUpdateInput = {};

    if (dto.name !== undefined) {
      const name = this.normalizeName(dto.name);

      await this.assertNameUnique(name, attributeId);

      data.name = name;
    }

    if (dto.code !== undefined) {
      const code = this.normalizeCode(dto.code);

      await this.assertCodeUnique(code, attributeId);

      data.code = code;
    }

    if (dto.label !== undefined) {
      data.label = this.normalizeOptionalText(dto.label);
    }

    if (dto.description !== undefined) {
      data.description = this.normalizeOptionalText(dto.description);
    }

    if (dto.dataType !== undefined) {
      data.dataType = this.normalizeDataType(dto.dataType);
    }

    if (dto.inputType !== undefined) {
      data.inputType = this.normalizeInputType(dto.inputType);
    }

    if (dto.unit !== undefined) {
      data.unit = this.normalizeOptionalText(dto.unit);
    }

    if (dto.options !== undefined) {
      data.optionsJson = this.normalizeOptions(dto.options);
    }

    if (dto.placeholder !== undefined) {
      data.placeholder = this.normalizeOptionalText(dto.placeholder);
    }

    if (dto.helpText !== undefined) {
      data.helpText = this.normalizeOptionalText(dto.helpText);
    }

    if (dto.isRequired !== undefined) {
      data.isRequired = dto.isRequired;
    }

    if (dto.isFilterable !== undefined) {
      data.isFilterable = dto.isFilterable;
    }

    if (dto.isComparable !== undefined) {
      data.isComparable = dto.isComparable;
    }

    if (dto.isSeoImportant !== undefined) {
      data.isSeoImportant = dto.isSeoImportant;
    }

    if (dto.isAiImportant !== undefined) {
      data.isAiImportant = dto.isAiImportant;
    }

    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    if (Object.keys(data).length === 0) {
      return {
        attribute: await this.findOne(attributeId),
        audit: {
          actorId: actorId ?? null,
          action: 'attribute.admin_update_skipped',
        },
      };
    }

    await this.prisma.attribute.update({
      where: {
        id: attributeId,
      },
      data,
      select: {
        id: true,
      },
    });

    return {
      attribute: await this.findOne(attributeId),
      audit: {
        actorId: actorId ?? null,
        action: 'attribute.admin_updated',
      },
    };
  }

  async delete(attributeId: string, actorId?: string) {
    await this.findAttributeRow(attributeId, false);

    const usage = await this.countAttributeUsage(attributeId);

    if (usage.productUsageCount > 0 || usage.variantUsageCount > 0) {
      throw new BadRequestException(
        'این ویژگی در محصولات یا واریانت‌ها استفاده شده و قابل حذف نیست.',
      );
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.$executeRaw(Prisma.sql`
        UPDATE "AttributeValue"
        SET
          "deleted_at" = ${now},
          "updatedAt" = ${now}
        WHERE
          "attributeId" = ${attributeId}
          AND "deleted_at" IS NULL
      `),
      this.prisma.$executeRaw(Prisma.sql`
        UPDATE "Attribute"
        SET
          "deleted_at" = ${now},
          "updatedAt" = ${now}
        WHERE
          "id" = ${attributeId}
          AND "deleted_at" IS NULL
      `),
    ]);

    return {
      deletedAt: now.toISOString(),
      deletedAtFa: this.formatDateTimeFaNullable(now),
      audit: {
        actorId: actorId ?? null,
        action: 'attribute.admin_deleted',
      },
    };
  }

  async restore(attributeId: string, actorId?: string) {
    const attribute = await this.findAttributeRow(attributeId, true);

    if (!attribute.deletedAt) {
      return {
        attribute: await this.findOne(attributeId),
        audit: {
          actorId: actorId ?? null,
          action: 'attribute.admin_restore_skipped',
        },
      };
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.$executeRaw(Prisma.sql`
        UPDATE "Attribute"
        SET
          "deleted_at" = NULL,
          "updatedAt" = ${now}
        WHERE "id" = ${attributeId}
      `),
      this.prisma.$executeRaw(Prisma.sql`
        UPDATE "AttributeValue"
        SET
          "deleted_at" = NULL,
          "updatedAt" = ${now}
        WHERE
          "attributeId" = ${attributeId}
          AND "deleted_at" = ${attribute.deletedAt}
      `),
    ]);

    return {
      attribute: await this.findOne(attributeId),
      audit: {
        actorId: actorId ?? null,
        action: 'attribute.admin_restored',
      },
    };
  }

  async findAttributeRow(
    attributeId: string,
    includeDeleted: boolean,
  ): Promise<AttributeRow> {
    const where: Prisma.Sql[] = [Prisma.sql`a."id" = ${attributeId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`a."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AttributeRow[]>(Prisma.sql`
      SELECT
        a."id",
        a."name",
        a."code",
        a."label",
        a."description",
        a."dataType",
        a."inputType",
        a."unit",
        a."optionsJson",
        a."placeholder",
        a."helpText",
        a."isRequired",
        a."isFilterable",
        a."isComparable",
        a."isSeoImportant",
        a."isAiImportant",
        a."sortOrder",
        a."isActive",
        (
          SELECT COUNT(*)::int
          FROM "AttributeValue" av
          WHERE av."attributeId" = a."id"
        ) AS "valueCount",
        (
          SELECT COUNT(*)::int
          FROM "AttributeValue" av
          WHERE
            av."attributeId" = a."id"
            AND av."deleted_at" IS NULL
        ) AS "activeValueCount",
        (
          SELECT COUNT(DISTINCT pa."productId")::int
          FROM "ProductAttribute" pa
          LEFT JOIN "AttributeValue" av
            ON av."id" = pa."attributeValueId"
          WHERE
            pa."attributeId" = a."id"
            OR av."attributeId" = a."id"
        ) AS "productUsageCount",
        (
          SELECT COUNT(DISTINCT va."variantId")::int
          FROM "VariantAttribute" va
          WHERE va."attributeId" = a."id"
        ) AS "variantUsageCount",
        a."createdAt",
        a."updatedAt",
        a."deleted_at" AS "deletedAt"
      FROM "Attribute" a
      WHERE ${Prisma.join(where, ' AND ')}
      LIMIT 1
    `);

    const attribute = rows[0];

    if (!attribute) {
      throw new NotFoundException('ویژگی موردنظر یافت نشد.');
    }

    return attribute;
  }

  private async findValuesByAttribute(
    attributeId: string,
    includeDeleted: boolean,
  ): Promise<AttributeValueRow[]> {
    const where: Prisma.Sql[] = [Prisma.sql`av."attributeId" = ${attributeId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`av."deleted_at" IS NULL`);
    }

    return this.prisma.$queryRaw<AttributeValueRow[]>(Prisma.sql`
      SELECT
        av."id",
        av."attributeId",
        a."name" AS "attributeName",
        av."value",
        (
          SELECT COUNT(DISTINCT pa."productId")::int
          FROM "ProductAttribute" pa
          WHERE pa."attributeValueId" = av."id"
        ) AS "productUsageCount",
        (
          SELECT COUNT(DISTINCT va."variantId")::int
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
    `);
  }

  private buildAttributeWhere(
    query: AdminQueryAttributeDto,
    alias: string,
  ): Prisma.Sql[] {
    const table = Prisma.raw(alias);

    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`${table}."deleted_at" IS NULL`);
    }

    if (query.q) {
      const q = `%${query.q}%`;

      where.push(Prisma.sql`(
        ${table}."name" ILIKE ${q}
        OR ${table}."code" ILIKE ${q}
        OR ${table}."label" ILIKE ${q}
        OR ${table}."description" ILIKE ${q}
      )`);
    }

    if (query.code) {
      where.push(Prisma.sql`${table}."code" ILIKE ${query.code}`);
    }

    if (query.dataType) {
      where.push(Prisma.sql`${table}."dataType"::text = ${query.dataType}`);
    }

    if (query.inputType) {
      where.push(Prisma.sql`${table}."inputType"::text = ${query.inputType}`);
    }

    if (query.isRequired !== undefined) {
      where.push(Prisma.sql`${table}."isRequired" = ${query.isRequired}`);
    }

    if (query.isFilterable !== undefined) {
      where.push(Prisma.sql`${table}."isFilterable" = ${query.isFilterable}`);
    }

    if (query.isComparable !== undefined) {
      where.push(Prisma.sql`${table}."isComparable" = ${query.isComparable}`);
    }

    if (query.isSeoImportant !== undefined) {
      where.push(
        Prisma.sql`${table}."isSeoImportant" = ${query.isSeoImportant}`,
      );
    }

    if (query.isAiImportant !== undefined) {
      where.push(Prisma.sql`${table}."isAiImportant" = ${query.isAiImportant}`);
    }

    if (query.isActive !== undefined) {
      where.push(Prisma.sql`${table}."isActive" = ${query.isActive}`);
    }

    if (query.createdFrom) {
      where.push(
        Prisma.sql`${table}."createdAt" >= ${this.parseDate(query.createdFrom)}`,
      );
    }

    if (query.createdTo) {
      where.push(
        Prisma.sql`${table}."createdAt" <= ${this.parseDate(query.createdTo)}`,
      );
    }

    return where;
  }

  private async assertNameUnique(
    name: string,
    exceptAttributeId?: string,
  ): Promise<void> {
    const where: Prisma.Sql[] = [Prisma.sql`LOWER("name") = LOWER(${name})`];

    if (exceptAttributeId) {
      where.push(Prisma.sql`"id" <> ${exceptAttributeId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "Attribute"
      WHERE ${Prisma.join(where, ' AND ')}
    `);

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('نام ویژگی تکراری است.');
    }
  }

  private async assertCodeUnique(
    code?: string | null,
    exceptAttributeId?: string,
  ): Promise<void> {
    if (!code) {
      return;
    }

    const where: Prisma.Sql[] = [Prisma.sql`LOWER("code") = LOWER(${code})`];

    if (exceptAttributeId) {
      where.push(Prisma.sql`"id" <> ${exceptAttributeId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "Attribute"
      WHERE ${Prisma.join(where, ' AND ')}
    `);

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('کد ویژگی تکراری است.');
    }
  }

  private async countAttributeUsage(attributeId: string): Promise<{
    productUsageCount: number;
    variantUsageCount: number;
  }> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        productUsageCount: number | bigint;
        variantUsageCount: number | bigint;
      }>
    >(Prisma.sql`
      SELECT
        (
          SELECT COUNT(DISTINCT pa."productId")::int
          FROM "ProductAttribute" pa
          LEFT JOIN "AttributeValue" av
            ON av."id" = pa."attributeValueId"
          WHERE
            pa."attributeId" = ${attributeId}
            OR av."attributeId" = ${attributeId}
        ) AS "productUsageCount",
        (
          SELECT COUNT(DISTINCT va."variantId")::int
          FROM "VariantAttribute" va
          WHERE va."attributeId" = ${attributeId}
        ) AS "variantUsageCount"
    `);

    return {
      productUsageCount: this.toNumber(rows[0]?.productUsageCount),
      variantUsageCount: this.toNumber(rows[0]?.variantUsageCount),
    };
  }

  private mapAttribute(row: AttributeRow): AttributeResponse {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      label: row.label,
      description: row.description,
      dataType: String(row.dataType),
      inputType: String(row.inputType),
      unit: row.unit,
      options: this.toStringArray(row.optionsJson),
      optionsJson: row.optionsJson,
      placeholder: row.placeholder,
      helpText: row.helpText,
      isRequired: row.isRequired,
      isFilterable: row.isFilterable,
      isComparable: row.isComparable,
      isSeoImportant: row.isSeoImportant,
      isAiImportant: row.isAiImportant,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      valueCount: this.toNumber(row.valueCount),
      activeValueCount: this.toNumber(row.activeValueCount),
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

  private resolveSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`a."updatedAt"`;
    }

    if (sortBy === 'name') {
      return Prisma.sql`a."name"`;
    }

    if (sortBy === 'sortOrder') {
      return Prisma.sql`a."sortOrder"`;
    }

    if (sortBy === 'valueCount') {
      return Prisma.sql`"valueCount"`;
    }

    if (sortBy === 'productUsageCount') {
      return Prisma.sql`"productUsageCount"`;
    }

    if (sortBy === 'variantUsageCount') {
      return Prisma.sql`"variantUsageCount"`;
    }

    return Prisma.sql`a."createdAt"`;
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

  private normalizeName(value: string): string {
    const normalized = value.trim().replace(/\s+/g, ' ');

    if (!normalized) {
      throw new BadRequestException('نام ویژگی الزامی است.');
    }

    return normalized;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim().replace(/\s+/g, ' ');

    return normalized.length > 0 ? normalized : null;
  }

  private normalizeCode(value?: string | null): string | null {
    const normalized = this.normalizeOptionalText(value)
      ?.toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_:]/g, '');

    return normalized && normalized.length > 0 ? normalized : null;
  }

  private normalizeDataType(value?: string | null): ProductAttributeDataType {
    if (!value) {
      return ProductAttributeDataType.TEXT;
    }

    if (value in ProductAttributeDataType) {
      return ProductAttributeDataType[
        value as keyof typeof ProductAttributeDataType
      ];
    }

    throw new BadRequestException('نوع داده ویژگی نامعتبر است.');
  }

  private normalizeInputType(
    value?: string | null,
    dataType?: ProductAttributeDataType,
  ): ProductAttributeInputType {
    if (value && value in ProductAttributeInputType) {
      return ProductAttributeInputType[
        value as keyof typeof ProductAttributeInputType
      ];
    }

    if (dataType === ProductAttributeDataType.NUMBER) {
      return ProductAttributeInputType.NUMBER;
    }

    if (dataType === ProductAttributeDataType.BOOLEAN) {
      return ProductAttributeInputType.SWITCH;
    }

    if (dataType === ProductAttributeDataType.ENUM) {
      return ProductAttributeInputType.SELECT;
    }

    if (dataType === ProductAttributeDataType.MULTI_SELECT) {
      return ProductAttributeInputType.MULTI_SELECT;
    }

    if (dataType === ProductAttributeDataType.DATE) {
      return ProductAttributeInputType.DATE;
    }

    return ProductAttributeInputType.TEXT;
  }

  private normalizeOptions(options?: string[]): Prisma.InputJsonValue {
    if (!options || options.length === 0) {
      return [];
    }

    return [
      ...new Set(
        options
          .map((option) => option.trim().replace(/\s+/g, ' '))
          .filter(Boolean),
      ),
    ];
  }

  private toStringArray(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
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
