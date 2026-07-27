import { randomUUID } from 'crypto';

import { Prisma, PrismaClient } from '../../src/generated/prisma';

const products = [
  {
    name: 'سرم آبرسان پوست وکسو',
    slug: 'vexo-hydrating-serum',
    sku: 'VEXO-SKIN-001',
    description: 'سرم آبرسان سبک برای کمک به رطوبت‌رسانی پوست خشک و دهیدراته.',
    shortDescription: 'سرم آبرسان سبک و مناسب استفاده روزانه.',
    categorySlug: 'skin-care',
    brandSlug: 'vexo-beauty',
    price: '890000',
    comparePrice: '1050000',
  },
  {
    name: 'شامپو تقویت‌کننده مو هیرپلاس',
    slug: 'hairplus-strengthening-shampoo',
    sku: 'HAIRPLUS-001',
    description: 'شامپو تقویت‌کننده مناسب موهای ضعیف و آسیب‌دیده.',
    shortDescription: 'شامپو تقویت‌کننده مو.',
    categorySlug: 'hair-care',
    brandSlug: 'hairplus',
    price: '520000',
    comparePrice: null,
  },
  {
    name: 'کرم مرطوب‌کننده درمالاین',
    slug: 'dermaline-moisturizer',
    sku: 'DERMALINE-001',
    description: 'کرم مرطوب‌کننده مناسب پوست نرمال تا خشک.',
    shortDescription: 'کرم مرطوب‌کننده روزانه.',
    categorySlug: 'skin-care',
    brandSlug: 'dermaline',
    price: '640000',
    comparePrice: '740000',
  },
];

export async function seedProducts(prisma: PrismaClient): Promise<void> {
  const warehouseId = await ensureWarehouse(prisma);

  for (const product of products) {
    const category = await findCategoryBySlug(prisma, product.categorySlug);

    const brand = await findBrandBySlug(prisma, product.brandSlug);

    const productId = randomUUID();

    const variantId = randomUUID();

    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Product" (
          "id",
          "name",
          "slug",
          "description",
          "shortDescription",
          "brandId",
          "categoryId",
          "sku",
          "price",
          "comparePrice",
          "weight",
          "dimensions",
          "isActive",
          "status",
          "viewCount",
          "reviewCount",
          "averageRating",
          "createdAt",
          "updatedAt",
          "deleted_at"
        )
        VALUES (
          ${productId},
          ${product.name},
          ${product.slug},
          ${product.description},
          ${product.shortDescription},
          ${brand.id},
          ${category.id},
          ${product.sku},
          ${new Prisma.Decimal(product.price)},
          ${
            product.comparePrice
              ? new Prisma.Decimal(product.comparePrice)
              : null
          },
          NULL,
          NULL,
          TRUE,
          'ACTIVE'::"ProductStatus",
          0,
          0,
          NULL,
          NOW(),
          NOW(),
          NULL
        )
        ON CONFLICT ("sku")
        DO UPDATE SET
          "name" = EXCLUDED."name",
          "slug" = EXCLUDED."slug",
          "description" = EXCLUDED."description",
          "shortDescription" = EXCLUDED."shortDescription",
          "brandId" = EXCLUDED."brandId",
          "categoryId" = EXCLUDED."categoryId",
          "price" = EXCLUDED."price",
          "comparePrice" = EXCLUDED."comparePrice",
          "isActive" = TRUE,
          "status" = 'ACTIVE'::"ProductStatus",
          "deleted_at" = NULL,
          "updatedAt" = NOW()
      `,
    );

    const existingProduct = await prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
          SELECT "id"
          FROM "Product"
          WHERE "sku" = ${product.sku}
          LIMIT 1
        `,
    );

    const finalProductId = existingProduct[0]?.id ?? productId;

    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "ProductVariant" (
          "id",
          "productId",
          "sku",
          "name",
          "slug",
          "price",
          "comparePrice",
          "weight",
          "imageUrl",
          "isActive",
          "createdAt",
          "updatedAt",
          "deleted_at"
        )
        VALUES (
          ${variantId},
          ${finalProductId},
          ${`${product.sku}-MAIN`},
          ${'گزینه اصلی'},
          ${`${product.slug}-main`},
          ${new Prisma.Decimal(product.price)},
          ${
            product.comparePrice
              ? new Prisma.Decimal(product.comparePrice)
              : null
          },
          NULL,
          NULL,
          TRUE,
          NOW(),
          NOW(),
          NULL
        )
        ON CONFLICT ("sku")
        DO UPDATE SET
          "price" = EXCLUDED."price",
          "comparePrice" = EXCLUDED."comparePrice",
          "isActive" = TRUE,
          "deleted_at" = NULL,
          "updatedAt" = NOW()
      `,
    );

    const existingVariant = await prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
          SELECT "id"
          FROM "ProductVariant"
          WHERE "sku" = ${`${product.sku}-MAIN`}
          LIMIT 1
        `,
    );

    const finalVariantId = existingVariant[0]?.id ?? variantId;

    await prisma.inventory.upsert({
      where: {
        variantId_warehouseId: {
          variantId: finalVariantId,
          warehouseId,
        },
      },
      update: {
        quantity: 50,
        reservedQuantity: 0,
        lowStockThreshold: 5,
      },
      create: {
        variantId: finalVariantId,
        warehouseId,
        quantity: 50,
        reservedQuantity: 0,
        lowStockThreshold: 5,
      },
    });
  }
}

async function ensureWarehouse(prisma: PrismaClient): Promise<string> {
  const warehouse = await prisma.warehouse.upsert({
    where: {
      code: 'MAIN',
    },
    update: {
      name: 'انبار اصلی',
      isActive: true,
    },
    create: {
      name: 'انبار اصلی',
      code: 'MAIN',
      description: 'انبار پیش‌فرض فروشگاه',
      city: 'تهران',
      country: 'IR',
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  return warehouse.id;
}

async function findCategoryBySlug(
  prisma: PrismaClient,
  slug: string,
): Promise<{ id: string }> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
        SELECT "id"
        FROM "Category"
        WHERE "slug" = ${slug}
          AND "deleted_at" IS NULL
        LIMIT 1
      `,
  );

  if (!rows[0]) {
    throw new Error(`Category was not found: ${slug}`);
  }

  return rows[0];
}

async function findBrandBySlug(
  prisma: PrismaClient,
  slug: string,
): Promise<{ id: string }> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
        SELECT "id"
        FROM "Brand"
        WHERE "slug" = ${slug}
          AND "deleted_at" IS NULL
        LIMIT 1
      `,
  );

  if (!rows[0]) {
    throw new Error(`Brand was not found: ${slug}`);
  }

  return rows[0];
}
