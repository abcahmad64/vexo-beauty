import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';

import {
  Prisma,
  PrismaClient,
} from '../src/generated/prisma';

const FIXTURE_MARKER = 'VEXO-FIXTURE-2026';
const BRAND_SLUG = 'vexo-lab-essentials';
const CATEGORY_SLUG = 'vexo-care-essentials';
const WAREHOUSE_CODE = 'VEXO-FIXTURE-2026';

type FixtureMode = 'seed' | 'cleanup';

type FixtureImage = {
  url: string;
  altText: string;
  title: string;
  sortOrder: number;
  isPrimary: boolean;
};

type FixtureProduct = {
  name: string;
  slug: string;
  sku: string;
  description: string;
  shortDescription: string;
  price: string;
  comparePrice: string | null;
  quantity: number;
  viewCount: number;
  images: FixtureImage[];
};

const fixtureProducts: FixtureProduct[] = [
  {
    name: 'سرم درخشان‌کننده وکسو',
    slug: 'vexo-radiance-serum',
    sku: 'VXB-2026-001',
    description:
      'سرم سبک روزانه با بافت زودجذب که برای تکمیل روتین مراقبت و ایجاد ظاهر شاداب‌تر طراحی شده است.',
    shortDescription:
      'سرم سبک و زودجذب برای روتین روزانه.',
    price: '1890000',
    comparePrice: null,
    quantity: 25,
    viewCount: 14,
    images: [
      {
        url: '/media/catalog/vexo-lab/radiance-serum-1.svg',
        altText: 'سرم درخشان‌کننده وکسو',
        title: 'نمای اصلی سرم درخشان‌کننده وکسو',
        sortOrder: 0,
        isPrimary: true,
      },
      {
        url: '/media/catalog/vexo-lab/radiance-serum-2.svg',
        altText: 'نمای دوم سرم درخشان‌کننده وکسو',
        title: 'نمای تکمیلی سرم درخشان‌کننده وکسو',
        sortOrder: 1,
        isPrimary: false,
      },
    ],
  },
  {
    name: 'کرم مرطوب‌کننده وکسو',
    slug: 'vexo-daily-moisturizer',
    sku: 'VXB-2026-002',
    description:
      'کرم مرطوب‌کننده روزانه با بافت متعادل که به حفظ لطافت پوست و کاهش احساس خشکی کمک می‌کند.',
    shortDescription:
      'مرطوب‌کننده روزانه با بافت متعادل و سبک.',
    price: '1480000',
    comparePrice: '1850000',
    quantity: 18,
    viewCount: 37,
    images: [
      {
        url: '/media/catalog/vexo-lab/daily-moisturizer-1.svg',
        altText: 'کرم مرطوب‌کننده وکسو',
        title: 'نمای اصلی کرم مرطوب‌کننده وکسو',
        sortOrder: 0,
        isPrimary: true,
      },
      {
        url: '/media/catalog/vexo-lab/daily-moisturizer-2.svg',
        altText: 'نمای دوم کرم مرطوب‌کننده وکسو',
        title: 'نمای تکمیلی کرم مرطوب‌کننده وکسو',
        sortOrder: 1,
        isPrimary: false,
      },
    ],
  },
  {
    name: 'عطر وکسو نوآر',
    slug: 'vexo-noir-fragrance',
    sku: 'VXB-2026-003',
    description:
      'رایحه‌ای گرم و متعادل با شخصیت شبانه که برای هدیه و استفاده در موقعیت‌های رسمی مناسب است.',
    shortDescription:
      'رایحه‌ای گرم و متعادل برای موقعیت‌های رسمی.',
    price: '3270000',
    comparePrice: '3590000',
    quantity: 9,
    viewCount: 240,
    images: [
      {
        url: '/media/catalog/vexo-lab/noir-fragrance-1.svg',
        altText: 'عطر وکسو نوآر',
        title: 'نمای اصلی عطر وکسو نوآر',
        sortOrder: 0,
        isPrimary: true,
      },
      {
        url: '/media/catalog/vexo-lab/noir-fragrance-2.svg',
        altText: 'نمای دوم عطر وکسو نوآر',
        title: 'نمای تکمیلی عطر وکسو نوآر',
        sortOrder: 1,
        isPrimary: false,
      },
    ],
  },
  {
    name: 'ابزار مراقبت صورت وکسو',
    slug: 'vexo-face-care-device',
    sku: 'VXB-2026-004',
    description:
      'ابزار کاربردی برای تکمیل روتین مراقبت صورت که با طراحی ساده و استفاده آسان عرضه می‌شود.',
    shortDescription:
      'ابزار کاربردی برای تکمیل روتین مراقبت صورت.',
    price: '4950000',
    comparePrice: null,
    quantity: 0,
    viewCount: 62,
    images: [
      {
        url: '/media/catalog/vexo-lab/face-care-device-1.svg',
        altText: 'ابزار مراقبت صورت وکسو',
        title: 'نمای اصلی ابزار مراقبت صورت وکسو',
        sortOrder: 0,
        isPrimary: true,
      },
      {
        url: '/media/catalog/vexo-lab/face-care-device-2.svg',
        altText: 'نمای دوم ابزار مراقبت صورت وکسو',
        title: 'نمای تکمیلی ابزار مراقبت صورت وکسو',
        sortOrder: 1,
        isPrimary: false,
      },
    ],
  },
];

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

if (process.env.ALLOW_DEMO_CATALOG !== 'true') {
  throw new Error(
    'Demo catalog operation is blocked. Set ALLOW_DEMO_CATALOG=true explicitly.',
  );
}

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Demo catalog fixture cannot run when NODE_ENV=production.',
  );
}

const mode = process.argv[2] as FixtureMode | undefined;

if (mode !== 'seed' && mode !== 'cleanup') {
  throw new Error(
    'Usage: ts-node prisma/demo-catalog.fixture.ts <seed|cleanup>',
  );
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

async function findIdBySlug(
  tx: Prisma.TransactionClient,
  table: 'Brand' | 'Category',
  slug: string,
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    table === 'Brand'
      ? Prisma.sql`
          SELECT "id"
          FROM "Brand"
          WHERE "slug" = ${slug}
          LIMIT 1
        `
      : Prisma.sql`
          SELECT "id"
          FROM "Category"
          WHERE "slug" = ${slug}
          LIMIT 1
        `,
  );

  if (!rows[0]) {
    throw new Error(`${table} was not found for slug: ${slug}`);
  }

  return rows[0].id;
}

async function ensureBrand(
  tx: Prisma.TransactionClient,
): Promise<string> {
  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO "Brand" (
        "id",
        "name",
        "slug",
        "description",
        "logoUrl",
        "website",
        "country",
        "isActive",
        "createdAt",
        "updatedAt",
        "deleted_at"
      )
      VALUES (
        ${randomUUID()},
        ${'VEXO LAB'},
        ${BRAND_SLUG},
        ${`${FIXTURE_MARKER} — مجموعه‌ای منتخب از محصولات مراقبت و زیبایی وکسو.`},
        NULL,
        NULL,
        'IR',
        TRUE,
        NOW(),
        NOW(),
        NULL
      )
      ON CONFLICT ("slug")
      DO UPDATE SET
        "name" = EXCLUDED."name",
        "description" = EXCLUDED."description",
        "isActive" = TRUE,
        "deleted_at" = NULL,
        "updatedAt" = NOW()
    `,
  );

  return findIdBySlug(tx, 'Brand', BRAND_SLUG);
}

async function ensureCategory(
  tx: Prisma.TransactionClient,
): Promise<string> {
  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO "Category" (
        "id",
        "name",
        "slug",
        "description",
        "parent_id",
        "image",
        "iconUrl",
        "isActive",
        "sortOrder",
        "createdAt",
        "updatedAt",
        "deleted_at"
      )
      VALUES (
        ${randomUUID()},
        ${'منتخب وکسو'},
        ${CATEGORY_SLUG},
        ${`${FIXTURE_MARKER} — محصولات منتخب مراقبت شخصی، زیبایی و هدیه.`},
        NULL,
        NULL,
        NULL,
        TRUE,
        9990,
        NOW(),
        NOW(),
        NULL
      )
      ON CONFLICT ("slug")
      DO UPDATE SET
        "name" = EXCLUDED."name",
        "description" = EXCLUDED."description",
        "isActive" = TRUE,
        "sortOrder" = EXCLUDED."sortOrder",
        "deleted_at" = NULL,
        "updatedAt" = NOW()
    `,
  );

  return findIdBySlug(tx, 'Category', CATEGORY_SLUG);
}

async function ensureWarehouse(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const warehouse = await tx.warehouse.upsert({
    where: {
      code: WAREHOUSE_CODE,
    },
    update: {
      name: 'انبار داخلی وکسو',
      description: `${FIXTURE_MARKER} — انبار موقت Fixture`,
      isActive: true,
    },
    create: {
      name: 'انبار داخلی وکسو',
      code: WAREHOUSE_CODE,
      description: `${FIXTURE_MARKER} — انبار موقت Fixture`,
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

async function ensureProductImages(
  tx: Prisma.TransactionClient,
  productId: string,
  images: FixtureImage[],
): Promise<void> {
  await tx.$executeRaw(
    Prisma.sql`
      DELETE FROM "ProductImage"
      WHERE "productId" = ${productId}
        AND "url" LIKE '/media/catalog/vexo-lab/%'
    `,
  );

  for (const image of images) {
    await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO "ProductImage" (
          "id",
          "productId",
          "type",
          "url",
          "thumbnailUrl",
          "altText",
          "title",
          "caption",
          "mimeType",
          "size",
          "width",
          "height",
          "duration",
          "sortOrder",
          "isPrimary",
          "isActive",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${randomUUID()},
          ${productId},
          'IMAGE'::"ProductMediaType",
          ${image.url},
          ${image.url},
          ${image.altText},
          ${image.title},
          NULL,
          'image/svg+xml',
          NULL,
          1200,
          1400,
          NULL,
          ${image.sortOrder},
          ${image.isPrimary},
          TRUE,
          NOW(),
          NOW()
        )
      `,
    );
  }
}

async function seedProduct(
  tx: Prisma.TransactionClient,
  input: FixtureProduct,
  brandId: string,
  categoryId: string,
  warehouseId: string,
): Promise<void> {
  const provisionalProductId = randomUUID();

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO "Product" (
        "id",
        "name",
        "slug",
        "description",
        "shortDescription",
        "brandId",
        "categoryId",
        "productTypeId",
        "productModelId",
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
        ${provisionalProductId},
        ${input.name},
        ${input.slug},
        ${input.description},
        ${input.shortDescription},
        ${brandId},
        ${categoryId},
        NULL,
        NULL,
        ${input.sku},
        ${new Prisma.Decimal(input.price)},
        ${
          input.comparePrice
            ? new Prisma.Decimal(input.comparePrice)
            : null
        },
        NULL,
        NULL,
        TRUE,
        'ACTIVE'::"ProductStatus",
        ${input.viewCount},
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
        "viewCount" = EXCLUDED."viewCount",
        "deleted_at" = NULL,
        "updatedAt" = NOW()
    `,
  );

  const productRows = await tx.$queryRaw<
    Array<{ id: string }>
  >(
    Prisma.sql`
      SELECT "id"
      FROM "Product"
      WHERE "sku" = ${input.sku}
      LIMIT 1
    `,
  );

  const productId = productRows[0]?.id;

  if (!productId) {
    throw new Error(`Seeded product was not found: ${input.sku}`);
  }

  await ensureProductImages(
    tx,
    productId,
    input.images,
  );

  const variantSku = `${input.sku}-MAIN`;
  const provisionalVariantId = randomUUID();

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO "ProductVariant" (
        "id",
        "productId",
        "sku",
        "name",
        "slug",
        "barcode",
        "gtin",
        "mpn",
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
        ${provisionalVariantId},
        ${productId},
        ${variantSku},
        ${'گزینهٔ اصلی آزمایشی'},
        ${`${input.slug}-main`},
        NULL,
        NULL,
        NULL,
        ${new Prisma.Decimal(input.price)},
        ${
          input.comparePrice
            ? new Prisma.Decimal(input.comparePrice)
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
        "productId" = EXCLUDED."productId",
        "name" = EXCLUDED."name",
        "slug" = EXCLUDED."slug",
        "price" = EXCLUDED."price",
        "comparePrice" = EXCLUDED."comparePrice",
        "isActive" = TRUE,
        "deleted_at" = NULL,
        "updatedAt" = NOW()
    `,
  );

  const variantRows = await tx.$queryRaw<
    Array<{ id: string }>
  >(
    Prisma.sql`
      SELECT "id"
      FROM "ProductVariant"
      WHERE "sku" = ${variantSku}
      LIMIT 1
    `,
  );

  const variantId = variantRows[0]?.id;

  if (!variantId) {
    throw new Error(`Seeded variant was not found: ${variantSku}`);
  }

  await tx.inventory.upsert({
    where: {
      variantId_warehouseId: {
        variantId,
        warehouseId,
      },
    },
    update: {
      quantity: input.quantity,
      reservedQuantity: 0,
      lowStockThreshold: 3,
      deletedAt: null,
    },
    create: {
      variantId,
      warehouseId,
      quantity: input.quantity,
      reservedQuantity: 0,
      lowStockThreshold: 3,
    },
  });
}

async function seedFixture(): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const [brandId, categoryId, warehouseId] =
        await Promise.all([
          ensureBrand(tx),
          ensureCategory(tx),
          ensureWarehouse(tx),
        ]);

      for (const product of fixtureProducts) {
        await seedProduct(
          tx,
          product,
          brandId,
          categoryId,
          warehouseId,
        );
      }
    },
    {
      timeout: 60_000,
    },
  );

  console.log('Demo catalog fixture created.');
  console.log(`Marker: ${FIXTURE_MARKER}`);
  console.log(`Products: ${fixtureProducts.length}`);
}

async function cleanupFixture(): Promise<void> {
  const fixtureSkus = fixtureProducts.map((product) => product.sku);

  await prisma.$transaction(
    async (tx) => {
      const productRows = await tx.$queryRaw<
        Array<{ id: string; sku: string }>
      >(
        Prisma.sql`
          SELECT
            "id",
            "sku"
          FROM "Product"
          WHERE "sku" IN (${Prisma.join(fixtureSkus)})
        `,
      );

      const productIds = productRows.map((row) => row.id);

      if (productIds.length > 0) {
        const orderRows = await tx.$queryRaw<
          Array<{ count: bigint }>
        >(
          Prisma.sql`
            SELECT COUNT(*)::bigint AS "count"
            FROM "OrderItem"
            WHERE "productId" IN (${Prisma.join(productIds)})
          `,
        );

        const orderItemCount = Number(orderRows[0]?.count ?? 0);

        if (orderItemCount > 0) {
          throw new Error(
            `Cleanup blocked: ${orderItemCount} order item(s) reference fixture products.`,
          );
        }

        await tx.$executeRaw(
          Prisma.sql`
            DELETE FROM "CartItem"
            WHERE "productId" IN (${Prisma.join(productIds)})
          `,
        );

        await tx.$executeRaw(
          Prisma.sql`
            DELETE FROM "WishlistItem"
            WHERE "productId" IN (${Prisma.join(productIds)})
          `,
        );

        await tx.$executeRaw(
          Prisma.sql`
            DELETE FROM "ProductTagRelation"
            WHERE "productId" IN (${Prisma.join(productIds)})
          `,
        );

        await tx.$executeRaw(
          Prisma.sql`
            DELETE FROM "ProductImage"
            WHERE "productId" IN (${Prisma.join(productIds)})
          `,
        );

        await tx.$executeRaw(
          Prisma.sql`
            DELETE FROM "Inventory"
            WHERE "variantId" IN (
              SELECT "id"
              FROM "ProductVariant"
              WHERE "productId" IN (${Prisma.join(productIds)})
            )
          `,
        );

        await tx.$executeRaw(
          Prisma.sql`
            DELETE FROM "ProductVariant"
            WHERE "productId" IN (${Prisma.join(productIds)})
          `,
        );

        await tx.$executeRaw(
          Prisma.sql`
            DELETE FROM "Product"
            WHERE "id" IN (${Prisma.join(productIds)})
          `,
        );
      }

      await tx.$executeRaw(
        Prisma.sql`
          DELETE FROM "Warehouse"
          WHERE "code" = ${WAREHOUSE_CODE}
            AND NOT EXISTS (
              SELECT 1
              FROM "Inventory"
              WHERE "warehouseId" = "Warehouse"."id"
            )
        `,
      );

      await tx.$executeRaw(
        Prisma.sql`
          DELETE FROM "Brand"
          WHERE "slug" = ${BRAND_SLUG}
            AND NOT EXISTS (
              SELECT 1
              FROM "Product"
              WHERE "brandId" = "Brand"."id"
            )
        `,
      );

      await tx.$executeRaw(
        Prisma.sql`
          DELETE FROM "Category"
          WHERE "slug" = ${CATEGORY_SLUG}
            AND NOT EXISTS (
              SELECT 1
              FROM "Product"
              WHERE "categoryId" = "Category"."id"
            )
        `,
      );
    },
    {
      timeout: 60_000,
    },
  );

  console.log('Demo catalog fixture removed.');
  console.log(`Marker: ${FIXTURE_MARKER}`);
}

async function main(): Promise<void> {
  if (mode === 'seed') {
    await seedFixture();
    return;
  }

  await cleanupFixture();
}

main()
  .catch((error: unknown) => {
    console.error('Demo catalog operation failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
