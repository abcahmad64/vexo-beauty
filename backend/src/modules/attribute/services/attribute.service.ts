import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { CreateAttributeDto } from '../dto/create-attribute.dto';

import { CreateAttributeValueDto } from '../dto/create-attribute-value.dto';

import {
  AttributeSyncMode,
  SyncProductAttributesDto,
} from '../dto/sync-product-attributes.dto';

import {
  SyncVariantAttributesDto,
  VariantAttributeSyncMode,
} from '../dto/sync-variant-attributes.dto';

import { QueryAttributeDto } from '../dto/query-attribute.dto';

import { QueryAttributeValueDto } from '../dto/query-attribute-value.dto';

import { UpdateAttributeDto } from '../dto/update-attribute.dto';

import { UpdateAttributeValueDto } from '../dto/update-attribute-value.dto';

import { AttributeEventPublisher } from '../events/attribute.event.publisher';

type UsageCountRow = {
  product_usage_count: number | bigint;
  variant_usage_count: number | bigint;
};

type ProductContextRow = {
  id: string;
  name: string;
  sku: string;
  deleted_at: Date | null;
};

type VariantContextRow = {
  id: string;
  product_id: string;
  sku: string;
  deleted_at: Date | null;
  product_deleted_at: Date | null;
};

type ProductAttributeRow = {
  id: string;
  product_id: string;
  attribute_value_id: string;
  created_at: Date;
  attribute_id: string;
  attribute_name: string;
  value: string;
};

type VariantAttributeRow = {
  id: string;
  variant_id: string;
  product_id: string;
  attribute_id: string;
  attribute_name: string;
  attribute_value_id: string;
  value: string;
  created_at: Date;
};

type AttributeUsage = {
  productUsageCount: number;
  variantUsageCount: number;
};

type AttributeBaseEntity = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type AttributeValueEntity = {
  id: string;
  attributeId: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  attribute?: AttributeBaseEntity;
};

type AttributeEntity = AttributeBaseEntity & {
  values?: AttributeValueEntity[];
};

@Injectable()
export class AttributeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: AttributeEventPublisher,
  ) {}

  private readonly attributeSelect = {
    id: true,
    name: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    values: {
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        attributeId: true,
        value: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
      orderBy: {
        value: 'asc',
      },
    },
  } satisfies Prisma.AttributeSelect;

  private readonly attributeValueSelect = {
    id: true,
    attributeId: true,
    value: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    attribute: {
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    },
  } satisfies Prisma.AttributeValueSelect;

  async createAttribute(dto: CreateAttributeDto, actorId?: string) {
    const name = this.normalizeName(dto.name);

    await this.assertAttributeNameUnique(name);

    const attribute = await this.prisma.attribute.create({
      data: {
        name,
      },
      select: this.attributeSelect,
    });

    const occurredAt = new Date();

    this.eventPublisher.publishAttributeCreated({
      attributeId: attribute.id,
      name: attribute.name,
      actorId,
      occurredAt,
    });

    return this.mapAttribute(attribute, {
      productUsageCount: 0,
      variantUsageCount: 0,
    });
  }

  async findAttributesPublic(query: QueryAttributeDto) {
    return this.findAttributes({
      ...query,
      includeDeleted: false,
      includeValues: query.includeValues ?? true,
    });
  }

  async findAttributesForAdmin(query: QueryAttributeDto) {
    return this.findAttributes(query);
  }

  async findAttribute(attributeId: string, includeDeleted = false) {
    const attribute = await this.findAttributeEntity(
      attributeId,
      includeDeleted,
    );

    const usage = await this.getAttributeUsageCount(attribute.id);

    return this.mapAttribute(attribute, usage);
  }

  async updateAttribute(
    attributeId: string,
    dto: UpdateAttributeDto,
    actorId?: string,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی ویژگی ارسال نشده است.',
      );
    }

    const current = await this.findAttributeEntity(attributeId, false);

    const data: Prisma.AttributeUpdateInput = {};

    if (dto.name !== undefined) {
      const name = this.normalizeName(dto.name);

      if (name !== current.name) {
        await this.assertAttributeNameUnique(name, attributeId);

        data.name = name;
      }
    }

    if (Object.keys(data).length === 0) {
      return this.mapAttribute(
        current,
        await this.getAttributeUsageCount(current.id),
      );
    }

    const updated = await this.prisma.attribute.update({
      where: {
        id: attributeId,
      },
      data,
      select: this.attributeSelect,
    });

    const occurredAt = new Date();

    this.eventPublisher.publishAttributeUpdated({
      attributeId: updated.id,
      name: updated.name,
      changedFields: Object.keys(dto),
      actorId,
      occurredAt,
    });

    return this.mapAttribute(
      updated,
      await this.getAttributeUsageCount(updated.id),
    );
  }

  async deleteAttribute(attributeId: string, actorId?: string) {
    const attribute = await this.findAttributeEntity(attributeId, false);

    const usage = await this.getAttributeUsageCount(attribute.id);

    if (usage.productUsageCount > 0 || usage.variantUsageCount > 0) {
      throw new BadRequestException(
        'این ویژگی در محصولات یا واریانت‌ها استفاده شده و قابل حذف نیست.',
      );
    }

    const deletedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.attributeValue.updateMany({
        where: {
          attributeId: attribute.id,
          deletedAt: null,
        },
        data: {
          deletedAt,
          updatedAt: deletedAt,
        },
      }),
      this.prisma.attribute.update({
        where: {
          id: attribute.id,
        },
        data: {
          deletedAt,
          updatedAt: deletedAt,
        },
      }),
    ]);

    this.eventPublisher.publishAttributeDeleted({
      attributeId: attribute.id,
      name: attribute.name,
      actorId,
      occurredAt: deletedAt,
    });

    return {
      deletedAt: deletedAt.toISOString(),
      deletedAtFa: this.formatDateTimeFaNullable(deletedAt),
      audit: {
        actorId: actorId ?? null,
        action: 'attribute.deleted',
      },
    };
  }

  async restoreAttribute(attributeId: string, actorId?: string) {
    const attribute = await this.findAttributeEntity(attributeId, true);

    if (!attribute.deletedAt) {
      return this.findAttribute(attributeId);
    }

    const restoredAt = new Date();

    const restored = await this.prisma.attribute.update({
      where: {
        id: attribute.id,
      },
      data: {
        deletedAt: null,
        updatedAt: restoredAt,
      },
      select: this.attributeSelect,
    });

    this.eventPublisher.publishAttributeRestored({
      attributeId: restored.id,
      name: restored.name,
      actorId,
      occurredAt: restoredAt,
    });

    return this.mapAttribute(
      restored,
      await this.getAttributeUsageCount(restored.id),
    );
  }

  async createValue(
    attributeId: string,
    dto: CreateAttributeValueDto,
    actorId?: string,
  ) {
    const attribute = await this.findAttributeEntity(attributeId, false);

    const value = this.normalizeValue(dto.value);

    await this.assertAttributeValueUnique(attribute.id, value);

    const attributeValue = await this.prisma.attributeValue.create({
      data: {
        attributeId: attribute.id,
        value,
      },
      select: this.attributeValueSelect,
    });

    const occurredAt = new Date();

    this.eventPublisher.publishValueCreated({
      attributeId: attribute.id,
      attributeValueId: attributeValue.id,
      value: attributeValue.value,
      actorId,
      occurredAt,
    });

    return this.mapAttributeValue(attributeValue, {
      productUsageCount: 0,
      variantUsageCount: 0,
    });
  }

  async findValues(query: QueryAttributeValueDto) {
    const { page, limit, skip } = this.buildPagination(query, 50, 300);

    const where = this.buildValueWhere(query);

    const [values, total] = await this.prisma.$transaction([
      this.prisma.attributeValue.findMany({
        where,
        select: this.attributeValueSelect,
        orderBy: [
          {
            attribute: {
              name: 'asc',
            },
          },
          {
            value: 'asc',
          },
          {
            id: 'asc',
          },
        ],
        skip,
        take: limit,
      }),
      this.prisma.attributeValue.count({
        where,
      }),
    ]);

    const data =
      query.includeUsageCount === true
        ? await Promise.all(
            values.map(async (value) =>
              this.mapAttributeValue(
                value,
                await this.getAttributeValueUsageCount(value.id),
              ),
            ),
          )
        : values.map((value) => this.mapAttributeValue(value));

    return this.buildPaginatedResult(data, total, page, limit);
  }

  async findValuesByAttribute(
    attributeId: string,
    query: QueryAttributeValueDto,
  ) {
    await this.findAttributeEntity(attributeId, query.includeDeleted === true);

    return this.findValues({
      ...query,
      attributeId,
    });
  }

  async findValue(attributeValueId: string, includeDeleted = false) {
    const value = await this.findAttributeValueEntity(
      attributeValueId,
      includeDeleted,
    );

    return this.mapAttributeValue(
      value,
      await this.getAttributeValueUsageCount(value.id),
    );
  }

  async updateValue(
    attributeValueId: string,
    dto: UpdateAttributeValueDto,
    actorId?: string,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی مقدار ویژگی ارسال نشده است.',
      );
    }

    const current = await this.findAttributeValueEntity(
      attributeValueId,
      false,
    );

    const data: Prisma.AttributeValueUpdateInput = {};

    if (dto.value !== undefined) {
      const value = this.normalizeValue(dto.value);

      if (value !== current.value) {
        await this.assertAttributeValueUnique(
          current.attributeId,
          value,
          current.id,
        );

        data.value = value;
      }
    }

    if (Object.keys(data).length === 0) {
      return this.mapAttributeValue(
        current,
        await this.getAttributeValueUsageCount(current.id),
      );
    }

    const updated = await this.prisma.attributeValue.update({
      where: {
        id: attributeValueId,
      },
      data,
      select: this.attributeValueSelect,
    });

    const occurredAt = new Date();

    this.eventPublisher.publishValueUpdated({
      attributeId: updated.attributeId,
      attributeValueId: updated.id,
      value: updated.value,
      changedFields: Object.keys(dto),
      actorId,
      occurredAt,
    });

    return this.mapAttributeValue(
      updated,
      await this.getAttributeValueUsageCount(updated.id),
    );
  }

  async deleteValue(attributeValueId: string, actorId?: string) {
    const value = await this.findAttributeValueEntity(attributeValueId, false);

    const usage = await this.getAttributeValueUsageCount(value.id);

    if (usage.productUsageCount > 0 || usage.variantUsageCount > 0) {
      throw new BadRequestException(
        'این مقدار ویژگی در محصولات یا واریانت‌ها استفاده شده و قابل حذف نیست.',
      );
    }

    const deletedAt = new Date();

    await this.prisma.attributeValue.update({
      where: {
        id: value.id,
      },
      data: {
        deletedAt,
        updatedAt: deletedAt,
      },
    });

    this.eventPublisher.publishValueDeleted({
      attributeId: value.attributeId,
      attributeValueId: value.id,
      value: value.value,
      actorId,
      occurredAt: deletedAt,
    });

    return {
      deletedAt: deletedAt.toISOString(),
      deletedAtFa: this.formatDateTimeFaNullable(deletedAt),
      audit: {
        actorId: actorId ?? null,
        action: 'attribute_value.deleted',
      },
    };
  }

  async restoreValue(attributeValueId: string, actorId?: string) {
    const value = await this.findAttributeValueEntity(attributeValueId, true);

    if (!value.deletedAt) {
      return this.findValue(attributeValueId);
    }

    const attribute = await this.findAttributeEntity(value.attributeId, true);

    if (attribute.deletedAt) {
      throw new BadRequestException('ابتدا ویژگی والد را بازیابی کنید.');
    }

    const restoredAt = new Date();

    const restored = await this.prisma.attributeValue.update({
      where: {
        id: value.id,
      },
      data: {
        deletedAt: null,
        updatedAt: restoredAt,
      },
      select: this.attributeValueSelect,
    });

    this.eventPublisher.publishValueRestored({
      attributeId: restored.attributeId,
      attributeValueId: restored.id,
      value: restored.value,
      actorId,
      occurredAt: restoredAt,
    });

    return this.mapAttributeValue(
      restored,
      await this.getAttributeValueUsageCount(restored.id),
    );
  }

  async getProductAttributes(productId: string) {
    await this.assertProductExists(productId);

    const rows = await this.prisma.$queryRaw<ProductAttributeRow[]>(
      Prisma.sql`
          SELECT
            pa."id",
            pa."productId" AS product_id,
            pa."attributeValueId" AS attribute_value_id,
            pa."createdAt" AS created_at,
            a."id" AS attribute_id,
            a."name" AS attribute_name,
            av."value"
          FROM "ProductAttribute" pa
          INNER JOIN "AttributeValue" av
            ON av."id" = pa."attributeValueId"
            AND av."deleted_at" IS NULL
          INNER JOIN "Attribute" a
            ON a."id" = av."attributeId"
            AND a."deleted_at" IS NULL
          WHERE pa."productId" = ${productId}
          ORDER BY a."name" ASC, av."value" ASC
        `,
    );

    return rows.map((row) => this.mapProductAttributeRow(row));
  }

  async syncProductAttributes(
    productId: string,
    dto: SyncProductAttributesDto,
    actorId?: string,
  ) {
    await this.assertProductExists(productId);

    const attributeValueIds = this.normalizeUniqueIds(dto.attributeValueIds);

    if (attributeValueIds.length > 0) {
      await this.assertAttributeValuesExist(attributeValueIds);
    }

    const mode = dto.mode ?? AttributeSyncMode.REPLACE;

    await this.prisma.$transaction(async (tx) => {
      if (mode === AttributeSyncMode.REPLACE) {
        await tx.productAttribute.deleteMany({
          where: {
            productId,
          },
        });
      }

      if (mode === AttributeSyncMode.REMOVE) {
        await tx.productAttribute.deleteMany({
          where: {
            productId,
            attributeValueId: {
              in: attributeValueIds,
            },
          },
        });

        return;
      }

      if (attributeValueIds.length > 0) {
        await tx.productAttribute.createMany({
          data: attributeValueIds.map((attributeValueId) => ({
            productId,
            attributeValueId,
          })),
          skipDuplicates: true,
        });
      }
    });

    const occurredAt = new Date();

    this.eventPublisher.publishProductAttributesSynced({
      productId,
      attributeValueIds,
      mode,
      actorId,
      occurredAt,
    });

    return this.getProductAttributes(productId);
  }

  async getVariantAttributes(variantId: string) {
    const variant = await this.assertVariantExists(variantId);

    const rows = await this.prisma.$queryRaw<VariantAttributeRow[]>(
      Prisma.sql`
          SELECT
            va."id",
            va."variantId" AS variant_id,
            pv."productId" AS product_id,
            va."attributeId" AS attribute_id,
            a."name" AS attribute_name,
            va."attributeValueId" AS attribute_value_id,
            av."value",
            va."createdAt" AS created_at
          FROM "VariantAttribute" va
          INNER JOIN "ProductVariant" pv
            ON pv."id" = va."variantId"
          INNER JOIN "Attribute" a
            ON a."id" = va."attributeId"
            AND a."deleted_at" IS NULL
          INNER JOIN "AttributeValue" av
            ON av."id" = va."attributeValueId"
            AND av."deleted_at" IS NULL
          WHERE va."variantId" = ${variant.id}
          ORDER BY a."name" ASC, av."value" ASC
        `,
    );

    return rows.map((row) => this.mapVariantAttributeRow(row));
  }

  async syncVariantAttributes(
    variantId: string,
    dto: SyncVariantAttributesDto,
    actorId?: string,
  ) {
    const variant = await this.assertVariantExists(variantId);

    const attributeValueIds = this.normalizeUniqueIds(dto.attributeValueIds);

    const values =
      attributeValueIds.length > 0
        ? await this.findActiveAttributeValues(attributeValueIds)
        : [];

    if (attributeValueIds.length !== values.length) {
      throw new BadRequestException('یک یا چند مقدار ویژگی معتبر نیست.');
    }

    const mode = dto.mode ?? VariantAttributeSyncMode.REPLACE;

    await this.prisma.$transaction(async (tx) => {
      if (mode === VariantAttributeSyncMode.REPLACE) {
        await tx.variantAttribute.deleteMany({
          where: {
            variantId,
          },
        });
      }

      if (mode === VariantAttributeSyncMode.REMOVE) {
        await tx.variantAttribute.deleteMany({
          where: {
            variantId,
            attributeValueId: {
              in: attributeValueIds,
            },
          },
        });

        return;
      }

      if (values.length > 0) {
        await tx.variantAttribute.createMany({
          data: values.map((value) => ({
            variantId,
            attributeId: value.attributeId,
            attributeValueId: value.id,
          })),
          skipDuplicates: true,
        });
      }
    });

    const occurredAt = new Date();

    this.eventPublisher.publishVariantAttributesSynced({
      variantId: variant.id,
      productId: variant.product_id,
      attributeValueIds,
      mode,
      actorId,
      occurredAt,
    });

    return this.getVariantAttributes(variantId);
  }

  private async findAttributes(query: QueryAttributeDto) {
    const { page, limit, skip } = this.buildPagination(query, 20, 200);

    const where = this.buildAttributeWhere(query);

    const [attributes, total] = await this.prisma.$transaction([
      this.prisma.attribute.findMany({
        where,
        select:
          query.includeValues === false
            ? {
                id: true,
                name: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
              }
            : this.attributeSelect,
        orderBy: [
          {
            name: 'asc',
          },
          {
            id: 'asc',
          },
        ],
        skip,
        take: limit,
      }),
      this.prisma.attribute.count({
        where,
      }),
    ]);

    const data =
      query.includeUsageCount === true
        ? await Promise.all(
            attributes.map(async (attribute) =>
              this.mapAttribute(
                attribute,
                await this.getAttributeUsageCount(attribute.id),
              ),
            ),
          )
        : attributes.map((attribute) => this.mapAttribute(attribute));

    return this.buildPaginatedResult(data, total, page, limit);
  }

  private buildAttributeWhere(
    query: QueryAttributeDto,
  ): Prisma.AttributeWhereInput {
    const where: Prisma.AttributeWhereInput = {};

    if (query.includeDeleted !== true) {
      where.deletedAt = null;
    }

    if (query.q) {
      where.name = {
        contains: query.q,
        mode: 'insensitive',
      };
    }

    if (query.createdFrom || query.createdTo) {
      where.createdAt = {
        ...(query.createdFrom
          ? {
              gte: this.parseDate(query.createdFrom),
            }
          : {}),
        ...(query.createdTo
          ? {
              lte: this.parseDate(query.createdTo),
            }
          : {}),
      };
    }

    return where;
  }

  private buildValueWhere(
    query: QueryAttributeValueDto,
  ): Prisma.AttributeValueWhereInput {
    const where: Prisma.AttributeValueWhereInput = {};

    if (query.includeDeleted !== true) {
      where.deletedAt = null;
      where.attribute = {
        deletedAt: null,
      };
    }

    if (query.attributeId) {
      where.attributeId = query.attributeId;
    }

    if (query.q) {
      where.OR = [
        {
          value: {
            contains: query.q,
            mode: 'insensitive',
          },
        },
        {
          attribute: {
            name: {
              contains: query.q,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    if (query.createdFrom || query.createdTo) {
      where.createdAt = {
        ...(query.createdFrom
          ? {
              gte: this.parseDate(query.createdFrom),
            }
          : {}),
        ...(query.createdTo
          ? {
              lte: this.parseDate(query.createdTo),
            }
          : {}),
      };
    }

    return where;
  }

  private async findAttributeEntity(
    attributeId: string,
    includeDeleted: boolean,
  ) {
    const attribute = await this.prisma.attribute.findFirst({
      where: {
        id: attributeId,
        ...(includeDeleted
          ? {}
          : {
              deletedAt: null,
            }),
      },
      select: this.attributeSelect,
    });

    if (!attribute) {
      throw new NotFoundException('ویژگی موردنظر یافت نشد.');
    }

    return attribute;
  }

  private async findAttributeValueEntity(
    attributeValueId: string,
    includeDeleted: boolean,
  ) {
    const value = await this.prisma.attributeValue.findFirst({
      where: {
        id: attributeValueId,
        ...(includeDeleted
          ? {}
          : {
              deletedAt: null,
              attribute: {
                deletedAt: null,
              },
            }),
      },
      select: this.attributeValueSelect,
    });

    if (!value) {
      throw new NotFoundException('مقدار ویژگی موردنظر یافت نشد.');
    }

    return value;
  }

  private async findActiveAttributeValues(attributeValueIds: string[]) {
    return this.prisma.attributeValue.findMany({
      where: {
        id: {
          in: attributeValueIds,
        },
        deletedAt: null,
        attribute: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
        attributeId: true,
        value: true,
      },
    });
  }

  private async assertAttributeValuesExist(attributeValueIds: string[]) {
    const count = await this.prisma.attributeValue.count({
      where: {
        id: {
          in: attributeValueIds,
        },
        deletedAt: null,
        attribute: {
          deletedAt: null,
        },
      },
    });

    if (count !== attributeValueIds.length) {
      throw new BadRequestException('یک یا چند مقدار ویژگی معتبر نیست.');
    }
  }

  private async assertProductExists(
    productId: string,
  ): Promise<ProductContextRow> {
    const rows = await this.prisma.$queryRaw<ProductContextRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "name",
            "sku",
            "deleted_at" AS deleted_at
          FROM "Product"
          WHERE "id" = ${productId}
          LIMIT 1
        `,
    );

    const product = rows[0];

    if (!product || product.deleted_at !== null) {
      throw new NotFoundException('محصول موردنظر یافت نشد.');
    }

    return product;
  }

  private async assertVariantExists(
    variantId: string,
  ): Promise<VariantContextRow> {
    const rows = await this.prisma.$queryRaw<VariantContextRow[]>(
      Prisma.sql`
          SELECT
            pv."id",
            pv."productId" AS product_id,
            pv."sku",
            pv."deleted_at" AS deleted_at,
            p."deleted_at" AS product_deleted_at
          FROM "ProductVariant" pv
          INNER JOIN "Product" p
            ON p."id" = pv."productId"
          WHERE pv."id" = ${variantId}
          LIMIT 1
        `,
    );

    const variant = rows[0];

    if (
      !variant ||
      variant.deleted_at !== null ||
      variant.product_deleted_at !== null
    ) {
      throw new NotFoundException('تنوع محصول موردنظر یافت نشد.');
    }

    return variant;
  }

  private async getAttributeUsageCount(
    attributeId: string,
  ): Promise<AttributeUsage> {
    const rows = await this.prisma.$queryRaw<UsageCountRow[]>(
      Prisma.sql`
          SELECT
            (
              SELECT COUNT(*)::int
              FROM "ProductAttribute" pa
              INNER JOIN "AttributeValue" av
                ON av."id" = pa."attributeValueId"
              WHERE av."attributeId" = ${attributeId}
            ) AS product_usage_count,
            (
              SELECT COUNT(*)::int
              FROM "VariantAttribute" va
              WHERE va."attributeId" = ${attributeId}
            ) AS variant_usage_count
        `,
    );

    return {
      productUsageCount: this.toNumber(rows[0]?.product_usage_count),
      variantUsageCount: this.toNumber(rows[0]?.variant_usage_count),
    };
  }

  private async getAttributeValueUsageCount(
    attributeValueId: string,
  ): Promise<AttributeUsage> {
    const rows = await this.prisma.$queryRaw<UsageCountRow[]>(
      Prisma.sql`
          SELECT
            (
              SELECT COUNT(*)::int
              FROM "ProductAttribute" pa
              WHERE pa."attributeValueId" = ${attributeValueId}
            ) AS product_usage_count,
            (
              SELECT COUNT(*)::int
              FROM "VariantAttribute" va
              WHERE va."attributeValueId" = ${attributeValueId}
            ) AS variant_usage_count
        `,
    );

    return {
      productUsageCount: this.toNumber(rows[0]?.product_usage_count),
      variantUsageCount: this.toNumber(rows[0]?.variant_usage_count),
    };
  }

  private async assertAttributeNameUnique(
    name: string,
    excludeAttributeId?: string,
  ) {
    const existing = await this.prisma.attribute.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
        ...(excludeAttributeId
          ? {
              id: {
                not: excludeAttributeId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException('نام ویژگی تکراری است.');
    }
  }

  private async assertAttributeValueUnique(
    attributeId: string,
    value: string,
    excludeValueId?: string,
  ) {
    const existing = await this.prisma.attributeValue.findFirst({
      where: {
        attributeId,
        value: {
          equals: value,
          mode: 'insensitive',
        },
        ...(excludeValueId
          ? {
              id: {
                not: excludeValueId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException('مقدار ویژگی تکراری است.');
    }
  }

  private normalizeName(value: string) {
    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizeValue(value: string) {
    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizeUniqueIds(ids: string[]) {
    return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  }

  private mapAttribute(attribute: AttributeEntity, usage?: AttributeUsage) {
    return {
      id: attribute.id,
      name: attribute.name,
      values: attribute.values?.map((value) => this.mapAttributeValue(value)),
      usage: usage ?? undefined,
      createdAt: attribute.createdAt.toISOString(),
      createdAtFa: this.formatDateTimeFa(attribute.createdAt),
      updatedAt: attribute.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTimeFa(attribute.updatedAt),
      deletedAt: this.toIsoStringNullable(attribute.deletedAt),
      deletedAtFa: this.formatDateTimeFaNullable(attribute.deletedAt),
    };
  }

  private mapAttributeValue(
    value: AttributeValueEntity,
    usage?: AttributeUsage,
  ) {
    return {
      id: value.id,
      attributeId: value.attributeId,
      value: value.value,
      attribute: value.attribute
        ? {
            id: value.attribute.id,
            name: value.attribute.name,
            createdAt: value.attribute.createdAt.toISOString(),
            createdAtFa: this.formatDateTimeFa(value.attribute.createdAt),
            updatedAt: value.attribute.updatedAt.toISOString(),
            updatedAtFa: this.formatDateTimeFa(value.attribute.updatedAt),
            deletedAt: this.toIsoStringNullable(value.attribute.deletedAt),
            deletedAtFa: this.formatDateTimeFaNullable(
              value.attribute.deletedAt,
            ),
          }
        : undefined,
      usage: usage ?? undefined,
      createdAt: value.createdAt.toISOString(),
      createdAtFa: this.formatDateTimeFa(value.createdAt),
      updatedAt: value.updatedAt.toISOString(),
      updatedAtFa: this.formatDateTimeFa(value.updatedAt),
      deletedAt: this.toIsoStringNullable(value.deletedAt),
      deletedAtFa: this.formatDateTimeFaNullable(value.deletedAt),
    };
  }

  private mapProductAttributeRow(row: ProductAttributeRow) {
    return {
      id: row.id,
      productId: row.product_id,
      attributeValueId: row.attribute_value_id,
      attribute: {
        id: row.attribute_id,
        name: row.attribute_name,
      },
      value: row.value,
      createdAt: row.created_at.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.created_at),
    };
  }

  private mapVariantAttributeRow(row: VariantAttributeRow) {
    return {
      id: row.id,
      variantId: row.variant_id,
      productId: row.product_id,
      attributeId: row.attribute_id,
      attributeValueId: row.attribute_value_id,
      attribute: {
        id: row.attribute_id,
        name: row.attribute_name,
      },
      value: row.value,
      createdAt: row.created_at.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.created_at),
    };
  }

  private buildPagination(
    query: {
      page?: number;
      limit?: number;
    },
    defaultLimit: number,
    maxLimit: number,
  ) {
    const page = Math.max(1, Number(query.page ?? 1));

    const limit = Math.min(
      maxLimit,
      Math.max(1, Number(query.limit ?? defaultLimit)),
    );

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

  private parseDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('مقدار تاریخ نامعتبر است.');
    }

    return date;
  }

  private toIsoStringNullable(date: Date | null): string | null {
    return date ? date.toISOString() : null;
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
