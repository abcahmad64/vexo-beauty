import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import {
  AdminAttributeTemplateFieldDto,
  AdminCreateProductAttributeDto,
  AdminCreateProductAttributeTemplateDto,
  AdminCreateProductAttributeValueDto,
  AdminCreateProductModelDto,
  AdminCreateProductTypeDto,
  AdminResolveProductAttributeTemplateDto,
  AdminUpdateProductAttributeDto,
  AdminUpdateProductAttributeTemplateDto,
  AdminUpdateProductAttributeValueDto,
  AdminUpdateProductModelDto,
  AdminUpdateProductTypeDto,
} from '../dto/admin-product-catalog.dto';

type CountRow = {
  count: number | bigint;
};

type ProductTypeRow = {
  id: string;
  categoryId: string;
  categoryName: string | null;
  categorySlug: string | null;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isActive: boolean;
  sortOrder: number;
  productModelCount: number | bigint;
  templateCount: number | bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type ProductModelRow = {
  id: string;
  brandId: string;
  brandName: string | null;
  brandSlug: string | null;
  productTypeId: string;
  productTypeName: string | null;
  productTypeSlug: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  name: string;
  modelCode: string | null;
  slug: string;
  description: string | null;
  titlePattern: string | null;
  seoPattern: string | null;
  isActive: boolean;
  sortOrder: number;
  templateCount: number | bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type AttributeTemplateRow = {
  id: string;
  scope: string;
  name: string;
  categoryId: string | null;
  productTypeId: string | null;
  brandId: string | null;
  productModelId: string | null;
  priority: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type AttributeTemplateFieldRow = {
  id: string;
  templateId: string;
  attributeId: string;
  groupName: string | null;
  templateRequired: boolean;
  templateSortOrder: number;
  attributeName: string;
  attributeCode: string | null;
  attributeLabel: string | null;
  attributeDescription: string | null;
  dataType: string;
  inputType: string;
  unit: string | null;
  optionsJson: Prisma.JsonValue;
  placeholder: string | null;
  helpText: string | null;
  attributeRequired: boolean;
  isFilterable: boolean;
  isComparable: boolean;
  isSeoImportant: boolean;
  isAiImportant: boolean;
  attributeSortOrder: number;
  attributeActive: boolean;
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
  optionsJson: Prisma.JsonValue;
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
  templateCount: number | bigint;
  productUsageCount: number | bigint;
  variantUsageCount: number | bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type AttributeValueRow = {
  id: string;
  attributeId: string;
  value: string;
  productUsageCount: number | bigint;
  variantUsageCount: number | bigint;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type CatalogDependencyRow = {
  productCount?: number | bigint;
  productModelCount?: number | bigint;
  templateCount?: number | bigint;
  valueCount?: number | bigint;
  productUsageCount?: number | bigint;
  variantUsageCount?: number | bigint;
};

type EntityExistsRow = {
  id: string;
};

@Injectable()
export class AdminProductCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getBootstrap(query: {
    categoryId?: string;
    brandId?: string;
    productTypeId?: string;
    includeInactive?: string;
  }) {
    const includeInactive = this.toBoolean(query.includeInactive);

    const [categories, brands, productTypes, productModels, attributes] =
      await Promise.all([
        this.findCategories(includeInactive),
        this.findBrands(includeInactive),
        this.findProductTypes({
          categoryId: query.categoryId,
          includeInactive,
        }),
        this.findProductModels({
          brandId: query.brandId,
          productTypeId: query.productTypeId,
          includeInactive,
        }),
        this.findAttributes({
          includeInactive,
        }),
      ]);

    return {
      categories,
      brands,
      productTypes,
      productModels,
      attributes,
    };
  }

  async findProductTypes(query: {
    categoryId?: string;
    includeInactive?: boolean;
    includeDeleted?: boolean;
  }) {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (!query.includeDeleted) {
      where.push(Prisma.sql`pt."deleted_at" IS NULL`);
    }

    if (!query.includeInactive) {
      where.push(Prisma.sql`pt."isActive" = true`);
    }

    if (query.categoryId) {
      where.push(Prisma.sql`pt."categoryId" = ${query.categoryId}`);
    }

    const rows = await this.prisma.$queryRaw<ProductTypeRow[]>(Prisma.sql`
      SELECT
        pt."id",
        pt."categoryId",
        c."name" AS "categoryName",
        c."slug" AS "categorySlug",
        pt."name",
        pt."slug",
        pt."description",
        pt."seoTitle",
        pt."seoDescription",
        pt."isActive",
        pt."sortOrder",
        (
          SELECT COUNT(*)::int
          FROM "ProductModel" pm
          WHERE pm."productTypeId" = pt."id"
            AND pm."deleted_at" IS NULL
        ) AS "productModelCount",
        (
          SELECT COUNT(*)::int
          FROM "ProductAttributeTemplate" pat
          WHERE pat."productTypeId" = pt."id"
            AND pat."deleted_at" IS NULL
        ) AS "templateCount",
        pt."createdAt",
        pt."updatedAt",
        pt."deleted_at" AS "deletedAt"
      FROM "ProductType" pt
      LEFT JOIN "Category" c ON c."id" = pt."categoryId"
      WHERE ${Prisma.join(where, ' AND ')}
      ORDER BY pt."sortOrder" ASC, pt."name" ASC, pt."id" DESC
    `);

    return rows.map((row) => this.mapProductType(row));
  }

  async createProductType(dto: AdminCreateProductTypeDto) {
    await this.assertCategoryExists(dto.categoryId);

    const productTypeId = randomUUID();
    const name = dto.name.trim();
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(name);

    if (!slug) {
      throw new BadRequestException('امکان ساخت اسلاگ نوع محصول وجود ندارد.');
    }

    await this.assertProductTypeSlugAvailable(dto.categoryId, slug);

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "ProductType" (
        "id",
        "categoryId",
        "name",
        "slug",
        "description",
        "seoTitle",
        "seoDescription",
        "isActive",
        "sortOrder",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${productTypeId},
        ${dto.categoryId},
        ${name},
        ${slug},
        ${dto.description ?? null},
        ${dto.seoTitle ?? null},
        ${dto.seoDescription ?? null},
        ${dto.isActive ?? true},
        ${dto.sortOrder ?? 0},
        NOW(),
        NOW()
      )
    `);

    return this.findProductType(productTypeId);
  }

  async updateProductType(
    productTypeId: string,
    dto: AdminUpdateProductTypeDto,
  ) {
    const current = await this.findProductTypeRow(productTypeId, true);

    const categoryId = dto.categoryId ?? current.categoryId;

    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }

    const requestedSlug = dto.slug
      ? this.slugify(dto.slug)
      : dto.name
        ? this.slugify(dto.name)
        : undefined;

    if (requestedSlug !== undefined && !requestedSlug) {
      throw new BadRequestException('امکان ساخت اسلاگ نوع محصول وجود ندارد.');
    }

    if (requestedSlug) {
      await this.assertProductTypeSlugAvailable(
        categoryId,
        requestedSlug,
        productTypeId,
      );
    }

    const updates: Prisma.Sql[] = [];

    if (dto.categoryId !== undefined) {
      updates.push(Prisma.sql`"categoryId" = ${dto.categoryId}`);
    }

    if (dto.name !== undefined) {
      updates.push(Prisma.sql`"name" = ${dto.name.trim()}`);
    }

    if (requestedSlug !== undefined) {
      updates.push(Prisma.sql`"slug" = ${requestedSlug}`);
    }

    if (dto.description !== undefined) {
      updates.push(Prisma.sql`"description" = ${dto.description}`);
    }

    if (dto.seoTitle !== undefined) {
      updates.push(Prisma.sql`"seoTitle" = ${dto.seoTitle}`);
    }

    if (dto.seoDescription !== undefined) {
      updates.push(Prisma.sql`"seoDescription" = ${dto.seoDescription}`);
    }

    if (dto.isActive !== undefined) {
      updates.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    if (dto.sortOrder !== undefined) {
      updates.push(Prisma.sql`"sortOrder" = ${dto.sortOrder}`);
    }

    if (updates.length === 0) {
      return this.mapProductType(current);
    }

    updates.push(Prisma.sql`"updatedAt" = NOW()`);

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "ProductType"
      SET ${Prisma.join(updates, ', ')}
      WHERE "id" = ${productTypeId}
    `);

    return this.findProductType(productTypeId);
  }

  async deleteProductType(productTypeId: string) {
    const current = await this.findProductTypeRow(productTypeId, true);

    if (current.deletedAt) {
      return this.mapProductType(current);
    }

    const dependencies = await this.findProductTypeDependencies(productTypeId);

    if (
      this.toNumber(dependencies.productCount) > 0 ||
      this.toNumber(dependencies.productModelCount) > 0 ||
      this.toNumber(dependencies.templateCount) > 0
    ) {
      throw new ConflictException(
        'نوع محصول دارای محصول، مدل یا قالب ویژگی وابسته است و قابل حذف نیست.',
      );
    }

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "ProductType"
      SET
        "deleted_at" = NOW(),
        "isActive" = FALSE,
        "updatedAt" = NOW()
      WHERE "id" = ${productTypeId}
        AND "deleted_at" IS NULL
    `);

    return this.findProductType(productTypeId);
  }

  async restoreProductType(productTypeId: string) {
    const current = await this.findProductTypeRow(productTypeId, true);

    await this.assertCategoryExists(current.categoryId);
    await this.assertProductTypeSlugAvailable(
      current.categoryId,
      current.slug,
      productTypeId,
    );

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "ProductType"
      SET
        "deleted_at" = NULL,
        "isActive" = TRUE,
        "updatedAt" = NOW()
      WHERE "id" = ${productTypeId}
    `);

    return this.findProductType(productTypeId);
  }

  async findProductModels(query: {
    brandId?: string;
    productTypeId?: string;
    includeInactive?: boolean;
    includeDeleted?: boolean;
  }) {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (!query.includeDeleted) {
      where.push(Prisma.sql`pm."deleted_at" IS NULL`);
    }

    if (!query.includeInactive) {
      where.push(Prisma.sql`pm."isActive" = true`);
    }

    if (query.brandId) {
      where.push(Prisma.sql`pm."brandId" = ${query.brandId}`);
    }

    if (query.productTypeId) {
      where.push(Prisma.sql`pm."productTypeId" = ${query.productTypeId}`);
    }

    const rows = await this.prisma.$queryRaw<ProductModelRow[]>(Prisma.sql`
      SELECT
        pm."id",
        pm."brandId",
        b."name" AS "brandName",
        b."slug" AS "brandSlug",
        pm."productTypeId",
        pt."name" AS "productTypeName",
        pt."slug" AS "productTypeSlug",
        c."id" AS "categoryId",
        c."name" AS "categoryName",
        c."slug" AS "categorySlug",
        pm."name",
        pm."modelCode",
        pm."slug",
        pm."description",
        pm."titlePattern",
        pm."seoPattern",
        pm."isActive",
        pm."sortOrder",
        (
          SELECT COUNT(*)::int
          FROM "ProductAttributeTemplate" pat
          WHERE pat."productModelId" = pm."id"
            AND pat."deleted_at" IS NULL
        ) AS "templateCount",
        pm."createdAt",
        pm."updatedAt",
        pm."deleted_at" AS "deletedAt"
      FROM "ProductModel" pm
      LEFT JOIN "Brand" b ON b."id" = pm."brandId"
      LEFT JOIN "ProductType" pt ON pt."id" = pm."productTypeId"
      LEFT JOIN "Category" c ON c."id" = pt."categoryId"
      WHERE ${Prisma.join(where, ' AND ')}
      ORDER BY pm."sortOrder" ASC, pm."name" ASC, pm."id" DESC
    `);

    return rows.map((row) => this.mapProductModel(row));
  }

  async createProductModel(dto: AdminCreateProductModelDto) {
    await Promise.all([
      this.assertBrandExists(dto.brandId),
      this.assertProductTypeExists(dto.productTypeId),
    ]);

    const productModelId = randomUUID();
    const name = dto.name.trim();
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(name);

    if (!slug) {
      throw new BadRequestException('امکان ساخت اسلاگ مدل محصول وجود ندارد.');
    }

    await this.assertProductModelSlugAvailable(
      dto.brandId,
      dto.productTypeId,
      slug,
    );

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "ProductModel" (
        "id",
        "brandId",
        "productTypeId",
        "name",
        "modelCode",
        "slug",
        "description",
        "titlePattern",
        "seoPattern",
        "isActive",
        "sortOrder",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${productModelId},
        ${dto.brandId},
        ${dto.productTypeId},
        ${name},
        ${dto.modelCode ?? null},
        ${slug},
        ${dto.description ?? null},
        ${dto.titlePattern ?? null},
        ${dto.seoPattern ?? null},
        ${dto.isActive ?? true},
        ${dto.sortOrder ?? 0},
        NOW(),
        NOW()
      )
    `);

    return this.findProductModel(productModelId);
  }

  async updateProductModel(
    productModelId: string,
    dto: AdminUpdateProductModelDto,
  ) {
    const current = await this.findProductModelRow(productModelId, true);

    const brandId = dto.brandId ?? current.brandId;
    const productTypeId = dto.productTypeId ?? current.productTypeId;

    if (dto.brandId) {
      await this.assertBrandExists(dto.brandId);
    }

    if (dto.productTypeId) {
      await this.assertProductTypeExists(dto.productTypeId);
    }

    const requestedSlug = dto.slug
      ? this.slugify(dto.slug)
      : dto.name
        ? this.slugify(dto.name)
        : undefined;

    if (requestedSlug !== undefined && !requestedSlug) {
      throw new BadRequestException('امکان ساخت اسلاگ مدل محصول وجود ندارد.');
    }

    if (requestedSlug) {
      await this.assertProductModelSlugAvailable(
        brandId,
        productTypeId,
        requestedSlug,
        productModelId,
      );
    }

    const updates: Prisma.Sql[] = [];

    if (dto.brandId !== undefined) {
      updates.push(Prisma.sql`"brandId" = ${dto.brandId}`);
    }

    if (dto.productTypeId !== undefined) {
      updates.push(Prisma.sql`"productTypeId" = ${dto.productTypeId}`);
    }

    if (dto.name !== undefined) {
      updates.push(Prisma.sql`"name" = ${dto.name.trim()}`);
    }

    if (dto.modelCode !== undefined) {
      updates.push(Prisma.sql`"modelCode" = ${dto.modelCode}`);
    }

    if (requestedSlug !== undefined) {
      updates.push(Prisma.sql`"slug" = ${requestedSlug}`);
    }

    if (dto.description !== undefined) {
      updates.push(Prisma.sql`"description" = ${dto.description}`);
    }

    if (dto.titlePattern !== undefined) {
      updates.push(Prisma.sql`"titlePattern" = ${dto.titlePattern}`);
    }

    if (dto.seoPattern !== undefined) {
      updates.push(Prisma.sql`"seoPattern" = ${dto.seoPattern}`);
    }

    if (dto.isActive !== undefined) {
      updates.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    if (dto.sortOrder !== undefined) {
      updates.push(Prisma.sql`"sortOrder" = ${dto.sortOrder}`);
    }

    if (updates.length === 0) {
      return this.mapProductModel(current);
    }

    updates.push(Prisma.sql`"updatedAt" = NOW()`);

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "ProductModel"
      SET ${Prisma.join(updates, ', ')}
      WHERE "id" = ${productModelId}
    `);

    return this.findProductModel(productModelId);
  }

  async deleteProductModel(productModelId: string) {
    const current = await this.findProductModelRow(productModelId, true);

    if (current.deletedAt) {
      return this.mapProductModel(current);
    }

    const dependencies =
      await this.findProductModelDependencies(productModelId);

    if (
      this.toNumber(dependencies.productCount) > 0 ||
      this.toNumber(dependencies.templateCount) > 0
    ) {
      throw new ConflictException(
        'مدل محصول دارای محصول یا قالب ویژگی وابسته است و قابل حذف نیست.',
      );
    }

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "ProductModel"
      SET
        "deleted_at" = NOW(),
        "isActive" = FALSE,
        "updatedAt" = NOW()
      WHERE "id" = ${productModelId}
        AND "deleted_at" IS NULL
    `);

    return this.findProductModel(productModelId);
  }

  async restoreProductModel(productModelId: string) {
    const current = await this.findProductModelRow(productModelId, true);

    await Promise.all([
      this.assertBrandExists(current.brandId),
      this.assertProductTypeExists(current.productTypeId),
    ]);

    await this.assertProductModelSlugAvailable(
      current.brandId,
      current.productTypeId,
      current.slug,
      productModelId,
    );

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "ProductModel"
      SET
        "deleted_at" = NULL,
        "isActive" = TRUE,
        "updatedAt" = NOW()
      WHERE "id" = ${productModelId}
    `);

    return this.findProductModel(productModelId);
  }

  async findAttributes(query: {
    q?: string;
    includeInactive?: boolean;
    includeDeleted?: boolean;
  }) {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (!query.includeDeleted) {
      where.push(Prisma.sql`a."deleted_at" IS NULL`);
    }

    if (!query.includeInactive) {
      where.push(Prisma.sql`a."isActive" = TRUE`);
    }

    const search = query.q?.trim();

    if (search) {
      where.push(Prisma.sql`(
        a."name" ILIKE ${`%${search}%`}
        OR COALESCE(a."code", '') ILIKE ${`%${search}%`}
        OR COALESCE(a."label", '') ILIKE ${`%${search}%`}
      )`);
    }

    const rows = await this.prisma.$queryRaw<AttributeRow[]>(Prisma.sql`
      SELECT
        a."id",
        a."name",
        a."code",
        a."label",
        a."description",
        a."dataType"::text AS "dataType",
        a."inputType"::text AS "inputType",
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
            AND av."deleted_at" IS NULL
        ) AS "valueCount",
        (
          SELECT COUNT(*)::int
          FROM "ProductAttributeTemplateField" patf
          WHERE patf."attributeId" = a."id"
        ) AS "templateCount",
        (
          SELECT COUNT(*)::int
          FROM "ProductAttribute" pa
          WHERE pa."attributeId" = a."id"
        ) AS "productUsageCount",
        (
          SELECT COUNT(*)::int
          FROM "VariantAttribute" va
          WHERE va."attributeId" = a."id"
        ) AS "variantUsageCount",
        a."createdAt",
        a."updatedAt",
        a."deleted_at" AS "deletedAt"
      FROM "Attribute" a
      WHERE ${Prisma.join(where, ' AND ')}
      ORDER BY a."sortOrder" ASC, a."name" ASC, a."id" DESC
    `);

    return rows.map((row) => this.mapAttribute(row));
  }

  async createAttribute(dto: AdminCreateProductAttributeDto) {
    const attributeId = randomUUID();
    const name = dto.name.trim();
    const code = this.normalizeAttributeCode(dto.code);

    await this.assertAttributeNameAvailable(name);

    if (code) {
      await this.assertAttributeCodeAvailable(code);
    }

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Attribute" (
        "id",
        "name",
        "code",
        "label",
        "description",
        "dataType",
        "inputType",
        "unit",
        "optionsJson",
        "placeholder",
        "helpText",
        "isRequired",
        "isFilterable",
        "isComparable",
        "isSeoImportant",
        "isAiImportant",
        "sortOrder",
        "isActive",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${attributeId},
        ${name},
        ${code},
        ${dto.label ?? null},
        ${dto.description ?? null},
        ${dto.dataType ?? 'TEXT'}::"ProductAttributeDataType",
        ${dto.inputType ?? 'TEXT'}::"ProductAttributeInputType",
        ${dto.unit ?? null},
        ${this.toJsonb(this.normalizeStringOptions(dto.options))},
        ${dto.placeholder ?? null},
        ${dto.helpText ?? null},
        ${dto.isRequired ?? false},
        ${dto.isFilterable ?? false},
        ${dto.isComparable ?? false},
        ${dto.isSeoImportant ?? false},
        ${dto.isAiImportant ?? true},
        ${dto.sortOrder ?? 0},
        ${dto.isActive ?? true},
        NOW(),
        NOW()
      )
    `);

    return this.findAttribute(attributeId);
  }

  async updateAttribute(
    attributeId: string,
    dto: AdminUpdateProductAttributeDto,
  ) {
    const current = await this.findAttributeRow(attributeId, true);
    const updates: Prisma.Sql[] = [];

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      await this.assertAttributeNameAvailable(name, attributeId);
      updates.push(Prisma.sql`"name" = ${name}`);
    }

    if (dto.code !== undefined) {
      const code = this.normalizeAttributeCode(dto.code);

      if (code) {
        await this.assertAttributeCodeAvailable(code, attributeId);
      }

      updates.push(Prisma.sql`"code" = ${code}`);
    }

    if (dto.label !== undefined) {
      updates.push(Prisma.sql`"label" = ${dto.label}`);
    }

    if (dto.description !== undefined) {
      updates.push(Prisma.sql`"description" = ${dto.description}`);
    }

    if (
      dto.dataType !== undefined &&
      dto.dataType !== current.dataType &&
      (this.toNumber(current.valueCount) > 0 ||
        this.toNumber(current.productUsageCount) > 0 ||
        this.toNumber(current.variantUsageCount) > 0)
    ) {
      throw new ConflictException(
        'نوع داده ویژگی دارای مقدار یا استفاده محصولی قابل تغییر نیست.',
      );
    }

    if (dto.dataType !== undefined) {
      updates.push(
        Prisma.sql`"dataType" = ${dto.dataType}::"ProductAttributeDataType"`,
      );
    }

    if (dto.inputType !== undefined) {
      updates.push(
        Prisma.sql`"inputType" = ${dto.inputType}::"ProductAttributeInputType"`,
      );
    }

    if (dto.unit !== undefined) {
      updates.push(Prisma.sql`"unit" = ${dto.unit}`);
    }

    if (dto.options !== undefined) {
      updates.push(
        Prisma.sql`"optionsJson" = ${this.toJsonb(
          this.normalizeStringOptions(dto.options),
        )}`,
      );
    }

    if (dto.placeholder !== undefined) {
      updates.push(Prisma.sql`"placeholder" = ${dto.placeholder}`);
    }

    if (dto.helpText !== undefined) {
      updates.push(Prisma.sql`"helpText" = ${dto.helpText}`);
    }

    if (dto.isRequired !== undefined) {
      updates.push(Prisma.sql`"isRequired" = ${dto.isRequired}`);
    }

    if (dto.isFilterable !== undefined) {
      updates.push(Prisma.sql`"isFilterable" = ${dto.isFilterable}`);
    }

    if (dto.isComparable !== undefined) {
      updates.push(Prisma.sql`"isComparable" = ${dto.isComparable}`);
    }

    if (dto.isSeoImportant !== undefined) {
      updates.push(Prisma.sql`"isSeoImportant" = ${dto.isSeoImportant}`);
    }

    if (dto.isAiImportant !== undefined) {
      updates.push(Prisma.sql`"isAiImportant" = ${dto.isAiImportant}`);
    }

    if (dto.sortOrder !== undefined) {
      updates.push(Prisma.sql`"sortOrder" = ${dto.sortOrder}`);
    }

    if (dto.isActive !== undefined) {
      updates.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    if (updates.length === 0) {
      return this.mapAttribute(current);
    }

    updates.push(Prisma.sql`"updatedAt" = NOW()`);

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "Attribute"
      SET ${Prisma.join(updates, ', ')}
      WHERE "id" = ${attributeId}
    `);

    return this.findAttribute(attributeId);
  }

  async deleteAttribute(attributeId: string) {
    const current = await this.findAttributeRow(attributeId, true);

    if (current.deletedAt) {
      return this.mapAttribute(current);
    }

    const dependencies = await this.findAttributeDependencies(attributeId);

    if (
      this.toNumber(dependencies.valueCount) > 0 ||
      this.toNumber(dependencies.templateCount) > 0 ||
      this.toNumber(dependencies.productUsageCount) > 0 ||
      this.toNumber(dependencies.variantUsageCount) > 0
    ) {
      throw new ConflictException(
        'ویژگی دارای مقدار، قالب یا استفاده محصولی است و قابل حذف نیست.',
      );
    }

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "Attribute"
      SET
        "deleted_at" = NOW(),
        "isActive" = FALSE,
        "updatedAt" = NOW()
      WHERE "id" = ${attributeId}
        AND "deleted_at" IS NULL
    `);

    return this.findAttribute(attributeId);
  }

  async restoreAttribute(attributeId: string) {
    const current = await this.findAttributeRow(attributeId, true);

    await this.assertAttributeNameAvailable(current.name, attributeId);

    if (current.code) {
      await this.assertAttributeCodeAvailable(current.code, attributeId);
    }

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "Attribute"
      SET
        "deleted_at" = NULL,
        "isActive" = TRUE,
        "updatedAt" = NOW()
      WHERE "id" = ${attributeId}
    `);

    return this.findAttribute(attributeId);
  }

  async findAttributeValues(
    attributeId: string,
    query: {
      includeDeleted?: boolean;
    },
  ) {
    await this.findAttributeRow(attributeId, true);

    const where: Prisma.Sql[] = [Prisma.sql`av."attributeId" = ${attributeId}`];

    if (!query.includeDeleted) {
      where.push(Prisma.sql`av."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AttributeValueRow[]>(Prisma.sql`
      SELECT
        av."id",
        av."attributeId",
        av."value",
        (
          SELECT COUNT(*)::int
          FROM "ProductAttribute" pa
          WHERE pa."attributeValueId" = av."id"
        ) AS "productUsageCount",
        (
          SELECT COUNT(*)::int
          FROM "VariantAttribute" va
          WHERE va."attributeValueId" = av."id"
        ) AS "variantUsageCount",
        av."createdAt",
        av."updatedAt",
        av."deleted_at" AS "deletedAt"
      FROM "AttributeValue" av
      WHERE ${Prisma.join(where, ' AND ')}
      ORDER BY av."value" ASC, av."id" DESC
    `);

    return rows.map((row) => this.mapAttributeValue(row));
  }

  async createAttributeValue(
    attributeId: string,
    dto: AdminCreateProductAttributeValueDto,
  ) {
    await this.assertAttributeExists(attributeId);

    const value = dto.value.trim();
    await this.assertAttributeValueAvailable(attributeId, value);

    const attributeValueId = randomUUID();

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "AttributeValue" (
        "id",
        "attributeId",
        "value",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${attributeValueId},
        ${attributeId},
        ${value},
        NOW(),
        NOW()
      )
    `);

    return this.findAttributeValue(attributeValueId);
  }

  async updateAttributeValue(
    attributeValueId: string,
    dto: AdminUpdateProductAttributeValueDto,
  ) {
    const current = await this.findAttributeValueRow(attributeValueId, true);

    if (dto.value === undefined) {
      return this.mapAttributeValue(current);
    }

    const value = dto.value.trim();

    await this.assertAttributeValueAvailable(
      current.attributeId,
      value,
      attributeValueId,
    );

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "AttributeValue"
      SET
        "value" = ${value},
        "updatedAt" = NOW()
      WHERE "id" = ${attributeValueId}
    `);

    return this.findAttributeValue(attributeValueId);
  }

  async deleteAttributeValue(attributeValueId: string) {
    const current = await this.findAttributeValueRow(attributeValueId, true);

    if (current.deletedAt) {
      return this.mapAttributeValue(current);
    }

    if (
      this.toNumber(current.productUsageCount) > 0 ||
      this.toNumber(current.variantUsageCount) > 0
    ) {
      throw new ConflictException(
        'مقدار ویژگی در محصول یا واریانت استفاده شده و قابل حذف نیست.',
      );
    }

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "AttributeValue"
      SET
        "deleted_at" = NOW(),
        "updatedAt" = NOW()
      WHERE "id" = ${attributeValueId}
        AND "deleted_at" IS NULL
    `);

    return this.findAttributeValue(attributeValueId);
  }

  async restoreAttributeValue(attributeValueId: string) {
    const current = await this.findAttributeValueRow(attributeValueId, true);

    await this.assertAttributeExists(current.attributeId);
    await this.assertAttributeValueAvailable(
      current.attributeId,
      current.value,
      attributeValueId,
    );

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "AttributeValue"
      SET
        "deleted_at" = NULL,
        "updatedAt" = NOW()
      WHERE "id" = ${attributeValueId}
    `);

    return this.findAttributeValue(attributeValueId);
  }

  async resolveAttributeTemplate(dto: AdminResolveProductAttributeTemplateDto) {
    await this.assertCategoryExists(dto.categoryId);

    if (dto.brandId) {
      await this.assertBrandExists(dto.brandId);
    }

    if (dto.productTypeId) {
      await this.assertProductTypeExists(dto.productTypeId);
    }

    if (dto.productModelId) {
      await this.assertProductModelExists(dto.productModelId);
    }

    const templateWhere = this.buildTemplateResolveWhere(dto);

    const templates = await this.prisma.$queryRaw<AttributeTemplateRow[]>(
      Prisma.sql`
        SELECT
          pat."id",
          pat."scope",
          pat."name",
          pat."categoryId",
          pat."productTypeId",
          pat."brandId",
          pat."productModelId",
          pat."priority",
          pat."isDefault",
          pat."isActive",
          pat."createdAt",
          pat."updatedAt",
          pat."deleted_at" AS "deletedAt"
        FROM "ProductAttributeTemplate" pat
        WHERE ${Prisma.join(templateWhere, ' AND ')}
        ORDER BY
          CASE pat."scope"
            WHEN 'PRODUCT_MODEL' THEN 1
            WHEN 'BRAND_PRODUCT_TYPE' THEN 2
            WHEN 'PRODUCT_TYPE' THEN 3
            WHEN 'CATEGORY' THEN 4
            ELSE 5
          END ASC,
          pat."priority" ASC,
          pat."createdAt" DESC
      `,
    );

    if (templates.length === 0) {
      return {
        templates: [],
        fields: [],
      };
    }

    const templateIds = templates.map((template) => template.id);

    const fields = await this.findTemplateFields(templateIds);
    const mergedFields = this.mergeTemplateFields(fields);

    return {
      templates: templates.map((template) => this.mapTemplate(template)),
      fields: mergedFields,
    };
  }

  async createAttributeTemplate(dto: AdminCreateProductAttributeTemplateDto) {
    await this.assertTemplateScopeValid(dto);

    const templateId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "ProductAttributeTemplate" (
          "id",
          "scope",
          "name",
          "categoryId",
          "productTypeId",
          "brandId",
          "productModelId",
          "priority",
          "isDefault",
          "isActive",
          "createdAt",
          "updatedAt"
        ) VALUES (
          ${templateId},
          ${dto.scope},
          ${dto.name.trim()},
          ${dto.categoryId ?? null},
          ${dto.productTypeId ?? null},
          ${dto.brandId ?? null},
          ${dto.productModelId ?? null},
          ${dto.priority ?? 100},
          ${dto.isDefault ?? false},
          ${dto.isActive ?? true},
          NOW(),
          NOW()
        )
      `);

      for (const field of dto.fields ?? []) {
        await this.assertAttributeExists(field.attributeId, tx);

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "ProductAttributeTemplateField" (
            "id",
            "templateId",
            "attributeId",
            "groupName",
            "isRequired",
            "sortOrder",
            "createdAt",
            "updatedAt"
          ) VALUES (
            ${randomUUID()},
            ${templateId},
            ${field.attributeId},
            ${field.groupName ?? null},
            ${field.isRequired ?? false},
            ${field.sortOrder ?? 0},
            NOW(),
            NOW()
          )
          ON CONFLICT ("templateId", "attributeId") DO UPDATE SET
            "groupName" = EXCLUDED."groupName",
            "isRequired" = EXCLUDED."isRequired",
            "sortOrder" = EXCLUDED."sortOrder",
            "updatedAt" = NOW()
        `);
      }
    });

    return this.findAttributeTemplate(templateId);
  }

  async updateAttributeTemplate(
    templateId: string,
    dto: AdminUpdateProductAttributeTemplateDto,
  ) {
    const current = await this.findAttributeTemplateRow(templateId, true);

    const normalizedDto: AdminCreateProductAttributeTemplateDto = {
      scope:
        dto.scope ??
        (current.scope as AdminCreateProductAttributeTemplateDto['scope']),
      name: dto.name ?? current.name,
      categoryId: dto.categoryId ?? current.categoryId ?? undefined,
      productTypeId: dto.productTypeId ?? current.productTypeId ?? undefined,
      brandId: dto.brandId ?? current.brandId ?? undefined,
      productModelId: dto.productModelId ?? current.productModelId ?? undefined,
      priority: dto.priority ?? current.priority,
      isDefault: dto.isDefault ?? current.isDefault,
      isActive: dto.isActive ?? current.isActive,
    };

    await this.assertTemplateScopeValid(normalizedDto);

    const updates: Prisma.Sql[] = [];

    if (dto.scope !== undefined) {
      updates.push(Prisma.sql`"scope" = ${dto.scope}`);
    }

    if (dto.name !== undefined) {
      updates.push(Prisma.sql`"name" = ${dto.name.trim()}`);
    }

    if (dto.categoryId !== undefined) {
      updates.push(Prisma.sql`"categoryId" = ${dto.categoryId}`);
    }

    if (dto.productTypeId !== undefined) {
      updates.push(Prisma.sql`"productTypeId" = ${dto.productTypeId}`);
    }

    if (dto.brandId !== undefined) {
      updates.push(Prisma.sql`"brandId" = ${dto.brandId}`);
    }

    if (dto.productModelId !== undefined) {
      updates.push(Prisma.sql`"productModelId" = ${dto.productModelId}`);
    }

    if (dto.priority !== undefined) {
      updates.push(Prisma.sql`"priority" = ${dto.priority}`);
    }

    if (dto.isDefault !== undefined) {
      updates.push(Prisma.sql`"isDefault" = ${dto.isDefault}`);
    }

    if (dto.isActive !== undefined) {
      updates.push(Prisma.sql`"isActive" = ${dto.isActive}`);
    }

    if (updates.length === 0) {
      return this.mapTemplate(current);
    }

    updates.push(Prisma.sql`"updatedAt" = NOW()`);

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "ProductAttributeTemplate"
      SET ${Prisma.join(updates, ', ')}
      WHERE "id" = ${templateId}
    `);

    return this.findAttributeTemplate(templateId);
  }

  async addTemplateField(
    templateId: string,
    dto: AdminAttributeTemplateFieldDto,
  ) {
    await Promise.all([
      this.assertAttributeTemplateExists(templateId),
      this.assertAttributeExists(dto.attributeId),
    ]);

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "ProductAttributeTemplateField" (
        "id",
        "templateId",
        "attributeId",
        "groupName",
        "isRequired",
        "sortOrder",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${randomUUID()},
        ${templateId},
        ${dto.attributeId},
        ${dto.groupName ?? null},
        ${dto.isRequired ?? false},
        ${dto.sortOrder ?? 0},
        NOW(),
        NOW()
      )
      ON CONFLICT ("templateId", "attributeId") DO UPDATE SET
        "groupName" = EXCLUDED."groupName",
        "isRequired" = EXCLUDED."isRequired",
        "sortOrder" = EXCLUDED."sortOrder",
        "updatedAt" = NOW()
    `);

    return this.findAttributeTemplate(templateId);
  }

  async removeTemplateField(templateId: string, fieldId: string) {
    await this.assertAttributeTemplateExists(templateId);

    const result = await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM "ProductAttributeTemplateField"
      WHERE "id" = ${fieldId}
        AND "templateId" = ${templateId}
    `);

    if (result === 0) {
      throw new NotFoundException('فیلد قالب ویژگی پیدا نشد.');
    }

    return this.findAttributeTemplate(templateId);
  }

  private async findProductTypeDependencies(
    productTypeId: string,
  ): Promise<CatalogDependencyRow> {
    const rows = await this.prisma.$queryRaw<CatalogDependencyRow[]>(Prisma.sql`
      SELECT
        (
          SELECT COUNT(*)::int
          FROM "Product" p
          WHERE p."productTypeId" = ${productTypeId}
            AND p."deleted_at" IS NULL
        ) AS "productCount",
        (
          SELECT COUNT(*)::int
          FROM "ProductModel" pm
          WHERE pm."productTypeId" = ${productTypeId}
            AND pm."deleted_at" IS NULL
        ) AS "productModelCount",
        (
          SELECT COUNT(*)::int
          FROM "ProductAttributeTemplate" pat
          WHERE pat."productTypeId" = ${productTypeId}
            AND pat."deleted_at" IS NULL
        ) AS "templateCount"
    `);

    return rows[0] ?? {};
  }

  private async findProductModelDependencies(
    productModelId: string,
  ): Promise<CatalogDependencyRow> {
    const rows = await this.prisma.$queryRaw<CatalogDependencyRow[]>(Prisma.sql`
      SELECT
        (
          SELECT COUNT(*)::int
          FROM "Product" p
          WHERE p."productModelId" = ${productModelId}
            AND p."deleted_at" IS NULL
        ) AS "productCount",
        (
          SELECT COUNT(*)::int
          FROM "ProductAttributeTemplate" pat
          WHERE pat."productModelId" = ${productModelId}
            AND pat."deleted_at" IS NULL
        ) AS "templateCount"
    `);

    return rows[0] ?? {};
  }

  private async findAttribute(attributeId: string) {
    return this.mapAttribute(await this.findAttributeRow(attributeId, true));
  }

  private async findAttributeRow(attributeId: string, includeDeleted = false) {
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
        a."dataType"::text AS "dataType",
        a."inputType"::text AS "inputType",
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
            AND av."deleted_at" IS NULL
        ) AS "valueCount",
        (
          SELECT COUNT(*)::int
          FROM "ProductAttributeTemplateField" patf
          WHERE patf."attributeId" = a."id"
        ) AS "templateCount",
        (
          SELECT COUNT(*)::int
          FROM "ProductAttribute" pa
          WHERE pa."attributeId" = a."id"
        ) AS "productUsageCount",
        (
          SELECT COUNT(*)::int
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
      throw new NotFoundException('ویژگی محصول پیدا نشد.');
    }

    return attribute;
  }

  private async findAttributeDependencies(
    attributeId: string,
  ): Promise<CatalogDependencyRow> {
    const rows = await this.prisma.$queryRaw<CatalogDependencyRow[]>(Prisma.sql`
      SELECT
        (
          SELECT COUNT(*)::int
          FROM "AttributeValue" av
          WHERE av."attributeId" = ${attributeId}
            AND av."deleted_at" IS NULL
        ) AS "valueCount",
        (
          SELECT COUNT(*)::int
          FROM "ProductAttributeTemplateField" patf
          WHERE patf."attributeId" = ${attributeId}
        ) AS "templateCount",
        (
          SELECT COUNT(*)::int
          FROM "ProductAttribute" pa
          WHERE pa."attributeId" = ${attributeId}
        ) AS "productUsageCount",
        (
          SELECT COUNT(*)::int
          FROM "VariantAttribute" va
          WHERE va."attributeId" = ${attributeId}
        ) AS "variantUsageCount"
    `);

    return rows[0] ?? {};
  }

  private async findAttributeValue(attributeValueId: string) {
    return this.mapAttributeValue(
      await this.findAttributeValueRow(attributeValueId, true),
    );
  }

  private async findAttributeValueRow(
    attributeValueId: string,
    includeDeleted = false,
  ) {
    const where: Prisma.Sql[] = [Prisma.sql`av."id" = ${attributeValueId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`av."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AttributeValueRow[]>(Prisma.sql`
      SELECT
        av."id",
        av."attributeId",
        av."value",
        (
          SELECT COUNT(*)::int
          FROM "ProductAttribute" pa
          WHERE pa."attributeValueId" = av."id"
        ) AS "productUsageCount",
        (
          SELECT COUNT(*)::int
          FROM "VariantAttribute" va
          WHERE va."attributeValueId" = av."id"
        ) AS "variantUsageCount",
        av."createdAt",
        av."updatedAt",
        av."deleted_at" AS "deletedAt"
      FROM "AttributeValue" av
      WHERE ${Prisma.join(where, ' AND ')}
      LIMIT 1
    `);

    const attributeValue = rows[0];

    if (!attributeValue) {
      throw new NotFoundException('مقدار ویژگی پیدا نشد.');
    }

    return attributeValue;
  }

  private async findCategories(includeInactive: boolean) {
    const where: Prisma.Sql[] = [Prisma.sql`c."deleted_at" IS NULL`];

    if (!includeInactive) {
      where.push(Prisma.sql`c."isActive" = true`);
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        slug: string;
        parentId: string | null;
        sortOrder: number;
        image: string | null;
      }>
    >(Prisma.sql`
      SELECT
        c."id",
        c."name",
        c."slug",
        c."parent_id" AS "parentId",
        c."sortOrder",
        c."image"
      FROM "Category" c
      WHERE ${Prisma.join(where, ' AND ')}
      ORDER BY c."sortOrder" ASC, c."name" ASC
    `);

    return rows;
  }

  private async findBrands(includeInactive: boolean) {
    const where: Prisma.Sql[] = [Prisma.sql`b."deleted_at" IS NULL`];

    if (!includeInactive) {
      where.push(Prisma.sql`b."isActive" = true`);
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        slug: string;
        logoUrl: string | null;
      }>
    >(Prisma.sql`
      SELECT
        b."id",
        b."name",
        b."slug",
        b."logoUrl"
      FROM "Brand" b
      WHERE ${Prisma.join(where, ' AND ')}
      ORDER BY b."name" ASC
    `);

    return rows;
  }

  private async findProductType(productTypeId: string) {
    return this.mapProductType(
      await this.findProductTypeRow(productTypeId, true),
    );
  }

  private async findProductTypeRow(
    productTypeId: string,
    includeDeleted = false,
  ) {
    const where: Prisma.Sql[] = [Prisma.sql`pt."id" = ${productTypeId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`pt."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<ProductTypeRow[]>(Prisma.sql`
      SELECT
        pt."id",
        pt."categoryId",
        c."name" AS "categoryName",
        c."slug" AS "categorySlug",
        pt."name",
        pt."slug",
        pt."description",
        pt."seoTitle",
        pt."seoDescription",
        pt."isActive",
        pt."sortOrder",
        (
          SELECT COUNT(*)::int
          FROM "ProductModel" pm
          WHERE pm."productTypeId" = pt."id"
            AND pm."deleted_at" IS NULL
        ) AS "productModelCount",
        (
          SELECT COUNT(*)::int
          FROM "ProductAttributeTemplate" pat
          WHERE pat."productTypeId" = pt."id"
            AND pat."deleted_at" IS NULL
        ) AS "templateCount",
        pt."createdAt",
        pt."updatedAt",
        pt."deleted_at" AS "deletedAt"
      FROM "ProductType" pt
      LEFT JOIN "Category" c ON c."id" = pt."categoryId"
      WHERE ${Prisma.join(where, ' AND ')}
      LIMIT 1
    `);

    const productType = rows[0];

    if (!productType) {
      throw new NotFoundException('نوع محصول پیدا نشد.');
    }

    return productType;
  }

  private async findProductModel(productModelId: string) {
    return this.mapProductModel(
      await this.findProductModelRow(productModelId, true),
    );
  }

  private async findProductModelRow(
    productModelId: string,
    includeDeleted = false,
  ) {
    const where: Prisma.Sql[] = [Prisma.sql`pm."id" = ${productModelId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`pm."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<ProductModelRow[]>(Prisma.sql`
      SELECT
        pm."id",
        pm."brandId",
        b."name" AS "brandName",
        b."slug" AS "brandSlug",
        pm."productTypeId",
        pt."name" AS "productTypeName",
        pt."slug" AS "productTypeSlug",
        c."id" AS "categoryId",
        c."name" AS "categoryName",
        c."slug" AS "categorySlug",
        pm."name",
        pm."modelCode",
        pm."slug",
        pm."description",
        pm."titlePattern",
        pm."seoPattern",
        pm."isActive",
        pm."sortOrder",
        (
          SELECT COUNT(*)::int
          FROM "ProductAttributeTemplate" pat
          WHERE pat."productModelId" = pm."id"
            AND pat."deleted_at" IS NULL
        ) AS "templateCount",
        pm."createdAt",
        pm."updatedAt",
        pm."deleted_at" AS "deletedAt"
      FROM "ProductModel" pm
      LEFT JOIN "Brand" b ON b."id" = pm."brandId"
      LEFT JOIN "ProductType" pt ON pt."id" = pm."productTypeId"
      LEFT JOIN "Category" c ON c."id" = pt."categoryId"
      WHERE ${Prisma.join(where, ' AND ')}
      LIMIT 1
    `);

    const productModel = rows[0];

    if (!productModel) {
      throw new NotFoundException('مدل محصول پیدا نشد.');
    }

    return productModel;
  }

  private async findAttributeTemplate(templateId: string) {
    const template = await this.findAttributeTemplateRow(templateId, true);
    const fields = await this.findTemplateFields([templateId]);

    return {
      ...this.mapTemplate(template),
      fields: fields.map((field) => this.mapTemplateField(field)),
    };
  }

  private async findAttributeTemplateRow(
    templateId: string,
    includeDeleted = false,
  ) {
    const where: Prisma.Sql[] = [Prisma.sql`pat."id" = ${templateId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`pat."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AttributeTemplateRow[]>(Prisma.sql`
      SELECT
        pat."id",
        pat."scope",
        pat."name",
        pat."categoryId",
        pat."productTypeId",
        pat."brandId",
        pat."productModelId",
        pat."priority",
        pat."isDefault",
        pat."isActive",
        pat."createdAt",
        pat."updatedAt",
        pat."deleted_at" AS "deletedAt"
      FROM "ProductAttributeTemplate" pat
      WHERE ${Prisma.join(where, ' AND ')}
      LIMIT 1
    `);

    const template = rows[0];

    if (!template) {
      throw new NotFoundException('قالب ویژگی محصول پیدا نشد.');
    }

    return template;
  }

  private async findTemplateFields(templateIds: string[]) {
    if (templateIds.length === 0) {
      return [];
    }

    return this.prisma.$queryRaw<AttributeTemplateFieldRow[]>(Prisma.sql`
      SELECT
        patf."id",
        patf."templateId",
        patf."attributeId",
        patf."groupName",
        patf."isRequired" AS "templateRequired",
        patf."sortOrder" AS "templateSortOrder",
        a."name" AS "attributeName",
        a."code" AS "attributeCode",
        a."label" AS "attributeLabel",
        a."description" AS "attributeDescription",
        a."dataType",
        a."inputType",
        a."unit",
        a."optionsJson",
        a."placeholder",
        a."helpText",
        a."isRequired" AS "attributeRequired",
        a."isFilterable",
        a."isComparable",
        a."isSeoImportant",
        a."isAiImportant",
        a."sortOrder" AS "attributeSortOrder",
        a."isActive" AS "attributeActive"
      FROM "ProductAttributeTemplateField" patf
      INNER JOIN "Attribute" a ON a."id" = patf."attributeId"
      WHERE patf."templateId" IN (${Prisma.join(templateIds)})
        AND a."deleted_at" IS NULL
        AND a."isActive" = true
      ORDER BY patf."sortOrder" ASC, a."sortOrder" ASC, a."name" ASC
    `);
  }

  private mergeTemplateFields(fields: AttributeTemplateFieldRow[]) {
    const byAttributeId = new Map<string, AttributeTemplateFieldRow>();

    for (const field of fields) {
      if (!byAttributeId.has(field.attributeId)) {
        byAttributeId.set(field.attributeId, field);
      }
    }

    return [...byAttributeId.values()]
      .map((field) => this.mapTemplateField(field))
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.attribute.name.localeCompare(b.attribute.name),
      );
  }

  private buildTemplateResolveWhere(
    dto: AdminResolveProductAttributeTemplateDto,
  ): Prisma.Sql[] {
    const scopeConditions: Prisma.Sql[] = [
      Prisma.sql`(pat."scope" = 'CATEGORY' AND pat."categoryId" = ${dto.categoryId})`,
    ];

    if (dto.productTypeId) {
      scopeConditions.push(
        Prisma.sql`(pat."scope" = 'PRODUCT_TYPE' AND pat."productTypeId" = ${dto.productTypeId})`,
      );
    }

    if (dto.brandId && dto.productTypeId) {
      scopeConditions.push(
        Prisma.sql`(
          pat."scope" = 'BRAND_PRODUCT_TYPE'
          AND pat."brandId" = ${dto.brandId}
          AND pat."productTypeId" = ${dto.productTypeId}
        )`,
      );
    }

    if (dto.productModelId) {
      scopeConditions.push(
        Prisma.sql`(pat."scope" = 'PRODUCT_MODEL' AND pat."productModelId" = ${dto.productModelId})`,
      );
    }

    return [
      Prisma.sql`pat."deleted_at" IS NULL`,
      Prisma.sql`pat."isActive" = true`,
      Prisma.sql`(${Prisma.join(scopeConditions, ' OR ')})`,
    ];
  }

  private async assertTemplateScopeValid(
    dto: AdminCreateProductAttributeTemplateDto,
  ) {
    if (dto.scope === 'CATEGORY') {
      if (!dto.categoryId) {
        throw new BadRequestException(
          'برای قالب سطح دسته، categoryId الزامی است.',
        );
      }

      await this.assertCategoryExists(dto.categoryId);
      return;
    }

    if (dto.scope === 'PRODUCT_TYPE') {
      if (!dto.productTypeId) {
        throw new BadRequestException(
          'برای قالب سطح نوع محصول، productTypeId الزامی است.',
        );
      }

      await this.assertProductTypeExists(dto.productTypeId);
      return;
    }

    if (dto.scope === 'BRAND_PRODUCT_TYPE') {
      if (!dto.brandId || !dto.productTypeId) {
        throw new BadRequestException(
          'برای قالب سطح برند و نوع محصول، brandId و productTypeId الزامی هستند.',
        );
      }

      await Promise.all([
        this.assertBrandExists(dto.brandId),
        this.assertProductTypeExists(dto.productTypeId),
      ]);
      return;
    }

    if (dto.scope === 'PRODUCT_MODEL') {
      if (!dto.productModelId) {
        throw new BadRequestException(
          'برای قالب سطح مدل محصول، productModelId الزامی است.',
        );
      }

      await this.assertProductModelExists(dto.productModelId);
      return;
    }

    throw new BadRequestException('سطح قالب ویژگی معتبر نیست.');
  }

  private async assertCategoryExists(categoryId: string) {
    const rows = await this.prisma.$queryRaw<EntityExistsRow[]>(Prisma.sql`
      SELECT "id"
      FROM "Category"
      WHERE "id" = ${categoryId}
        AND "deleted_at" IS NULL
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new NotFoundException('دسته‌بندی پیدا نشد.');
    }
  }

  private async assertBrandExists(brandId: string) {
    const rows = await this.prisma.$queryRaw<EntityExistsRow[]>(Prisma.sql`
      SELECT "id"
      FROM "Brand"
      WHERE "id" = ${brandId}
        AND "deleted_at" IS NULL
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new NotFoundException('برند پیدا نشد.');
    }
  }

  private async assertProductTypeExists(productTypeId: string) {
    const rows = await this.prisma.$queryRaw<EntityExistsRow[]>(Prisma.sql`
      SELECT "id"
      FROM "ProductType"
      WHERE "id" = ${productTypeId}
        AND "deleted_at" IS NULL
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new NotFoundException('نوع محصول پیدا نشد.');
    }
  }

  private async assertProductModelExists(productModelId: string) {
    const rows = await this.prisma.$queryRaw<EntityExistsRow[]>(Prisma.sql`
      SELECT "id"
      FROM "ProductModel"
      WHERE "id" = ${productModelId}
        AND "deleted_at" IS NULL
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new NotFoundException('مدل محصول پیدا نشد.');
    }
  }

  private async assertAttributeTemplateExists(templateId: string) {
    const rows = await this.prisma.$queryRaw<EntityExistsRow[]>(Prisma.sql`
      SELECT "id"
      FROM "ProductAttributeTemplate"
      WHERE "id" = ${templateId}
        AND "deleted_at" IS NULL
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new NotFoundException('قالب ویژگی محصول پیدا نشد.');
    }
  }

  private async assertAttributeExists(
    attributeId: string,
    prisma: Pick<PrismaService, '$queryRaw'> = this.prisma,
  ) {
    const rows = await prisma.$queryRaw<EntityExistsRow[]>(Prisma.sql`
      SELECT "id"
      FROM "Attribute"
      WHERE "id" = ${attributeId}
        AND "deleted_at" IS NULL
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new NotFoundException('ویژگی محصول پیدا نشد.');
    }
  }

  private async assertAttributeNameAvailable(
    name: string,
    excludedId?: string,
  ) {
    const where: Prisma.Sql[] = [
      Prisma.sql`LOWER("name") = LOWER(${name})`,
      Prisma.sql`"deleted_at" IS NULL`,
    ];

    if (excludedId) {
      where.push(Prisma.sql`"id" <> ${excludedId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "Attribute"
      WHERE ${Prisma.join(where, ' AND ')}
    `);

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('نام ویژگی قبلاً ثبت شده است.');
    }
  }

  private async assertAttributeCodeAvailable(
    code: string,
    excludedId?: string,
  ) {
    const where: Prisma.Sql[] = [
      Prisma.sql`LOWER("code") = LOWER(${code})`,
      Prisma.sql`"deleted_at" IS NULL`,
    ];

    if (excludedId) {
      where.push(Prisma.sql`"id" <> ${excludedId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "Attribute"
      WHERE ${Prisma.join(where, ' AND ')}
    `);

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException('کد ویژگی قبلاً ثبت شده است.');
    }
  }

  private async assertAttributeValueAvailable(
    attributeId: string,
    value: string,
    excludedId?: string,
  ) {
    const where: Prisma.Sql[] = [
      Prisma.sql`"attributeId" = ${attributeId}`,
      Prisma.sql`LOWER("value") = LOWER(${value})`,
      Prisma.sql`"deleted_at" IS NULL`,
    ];

    if (excludedId) {
      where.push(Prisma.sql`"id" <> ${excludedId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "AttributeValue"
      WHERE ${Prisma.join(where, ' AND ')}
    `);

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException(
        'این مقدار برای ویژگی انتخاب‌شده قبلاً ثبت شده است.',
      );
    }
  }

  private async assertProductTypeSlugAvailable(
    categoryId: string,
    slug: string,
    excludedId?: string,
  ) {
    const where: Prisma.Sql[] = [
      Prisma.sql`"categoryId" = ${categoryId}`,
      Prisma.sql`"slug" = ${slug}`,
      Prisma.sql`"deleted_at" IS NULL`,
    ];

    if (excludedId) {
      where.push(Prisma.sql`"id" <> ${excludedId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "ProductType"
      WHERE ${Prisma.join(where, ' AND ')}
    `);

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException(
        'این نوع محصول در این دسته قبلاً ثبت شده است.',
      );
    }
  }

  private async assertProductModelSlugAvailable(
    brandId: string,
    productTypeId: string,
    slug: string,
    excludedId?: string,
  ) {
    const where: Prisma.Sql[] = [
      Prisma.sql`"brandId" = ${brandId}`,
      Prisma.sql`"productTypeId" = ${productTypeId}`,
      Prisma.sql`"slug" = ${slug}`,
      Prisma.sql`"deleted_at" IS NULL`,
    ];

    if (excludedId) {
      where.push(Prisma.sql`"id" <> ${excludedId}`);
    }

    const rows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "ProductModel"
      WHERE ${Prisma.join(where, ' AND ')}
    `);

    if (this.toNumber(rows[0]?.count) > 0) {
      throw new ConflictException(
        'این مدل برای این برند و نوع محصول قبلاً ثبت شده است.',
      );
    }
  }

  private mapAttribute(row: AttributeRow) {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      label: row.label ?? row.name,
      description: row.description,
      dataType: row.dataType,
      inputType: row.inputType,
      unit: row.unit,
      options: this.normalizeOptions(row.optionsJson),
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
      templateCount: this.toNumber(row.templateCount),
      productUsageCount: this.toNumber(row.productUsageCount),
      variantUsageCount: this.toNumber(row.variantUsageCount),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    };
  }

  private mapAttributeValue(row: AttributeValueRow) {
    return {
      id: row.id,
      attributeId: row.attributeId,
      value: row.value,
      productUsageCount: this.toNumber(row.productUsageCount),
      variantUsageCount: this.toNumber(row.variantUsageCount),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    };
  }

  private mapProductType(row: ProductTypeRow) {
    return {
      id: row.id,
      category: {
        id: row.categoryId,
        name: row.categoryName,
        slug: row.categorySlug,
      },
      name: row.name,
      slug: row.slug,
      description: row.description,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      productModelCount: this.toNumber(row.productModelCount),
      templateCount: this.toNumber(row.templateCount),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    };
  }

  private mapProductModel(row: ProductModelRow) {
    return {
      id: row.id,
      brand: {
        id: row.brandId,
        name: row.brandName,
        slug: row.brandSlug,
      },
      productType: {
        id: row.productTypeId,
        name: row.productTypeName,
        slug: row.productTypeSlug,
      },
      category: {
        id: row.categoryId,
        name: row.categoryName,
        slug: row.categorySlug,
      },
      name: row.name,
      modelCode: row.modelCode,
      slug: row.slug,
      description: row.description,
      titlePattern: row.titlePattern,
      seoPattern: row.seoPattern,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      templateCount: this.toNumber(row.templateCount),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    };
  }

  private mapTemplate(row: AttributeTemplateRow) {
    return {
      id: row.id,
      scope: row.scope,
      name: row.name,
      categoryId: row.categoryId,
      productTypeId: row.productTypeId,
      brandId: row.brandId,
      productModelId: row.productModelId,
      priority: row.priority,
      isDefault: row.isDefault,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    };
  }

  private mapTemplateField(row: AttributeTemplateFieldRow) {
    return {
      id: row.id,
      templateId: row.templateId,
      attributeId: row.attributeId,
      groupName: row.groupName,
      isRequired: row.templateRequired || row.attributeRequired,
      sortOrder: row.templateSortOrder || row.attributeSortOrder,
      attribute: {
        id: row.attributeId,
        name: row.attributeName,
        code: row.attributeCode,
        label: row.attributeLabel ?? row.attributeName,
        description: row.attributeDescription,
        dataType: row.dataType,
        inputType: row.inputType,
        unit: row.unit,
        options: this.normalizeOptions(row.optionsJson),
        placeholder: row.placeholder,
        helpText: row.helpText,
        isFilterable: row.isFilterable,
        isComparable: row.isComparable,
        isSeoImportant: row.isSeoImportant,
        isAiImportant: row.isAiImportant,
        isActive: row.attributeActive,
      },
    };
  }

  private normalizeAttributeCode(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[\u064A\u0649]/g, 'ی')
      .replace(/[\u0643]/g, 'ک')
      .replace(/[\u200c\s-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    return normalized || null;
  }

  private normalizeStringOptions(value?: string[]): string[] {
    if (!value) {
      return [];
    }

    return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
  }

  private toJsonb(value: unknown): Prisma.Sql {
    if (value === undefined || value === null) {
      return Prisma.sql`NULL`;
    }

    return Prisma.sql`${JSON.stringify(value)}::jsonb`;
  }

  private normalizeOptions(value: Prisma.JsonValue): string[] {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }

    return [];
  }

  private toNumber(value: number | bigint | undefined): number {
    if (typeof value === 'bigint') {
      return Number(value);
    }

    return value ?? 0;
  }

  private toBoolean(value?: string): boolean {
    return value === 'true' || value === '1';
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[\u064A\u0649]/g, 'ی')
      .replace(/[\u0643]/g, 'ک')
      .replace(/[\u200c\s_]+/g, '-')
      .replace(/[^a-z0-9\u0600-\u06ff-]+/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
