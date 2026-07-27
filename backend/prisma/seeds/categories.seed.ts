import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient } from '../../src/generated/prisma';

const categories = [
  {
    name: 'مراقبت پوست',
    slug: 'skin-care',
    description: 'محصولات مراقبت و زیبایی پوست',
    sortOrder: 10,
  },
  {
    name: 'مراقبت مو',
    slug: 'hair-care',
    description: 'محصولات مراقبت و تقویت مو',
    sortOrder: 20,
  },
  {
    name: 'آرایشی',
    slug: 'makeup',
    description: 'محصولات آرایشی و زیبایی',
    sortOrder: 30,
  },
  {
    name: 'عطر و ادکلن',
    slug: 'fragrance',
    description: 'انواع عطر، ادکلن و بادی اسپلش',
    sortOrder: 40,
  },
  {
    name: 'ابزار برقی زیبایی',
    slug: 'beauty-devices',
    description: 'دستگاه‌ها و ابزارهای هوشمند زیبایی',
    sortOrder: 50,
  },
];

export async function seedCategories(prisma: PrismaClient): Promise<void> {
  for (const category of categories) {
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Category" (
          "id",
          "name",
          "slug",
          "description",
          "parent_id",
          "image",
          "isActive",
          "sortOrder",
          "createdAt",
          "updatedAt",
          "deleted_at"
        )
        VALUES (
          ${randomUUID()},
          ${category.name},
          ${category.slug},
          ${category.description},
          NULL,
          NULL,
          TRUE,
          ${category.sortOrder},
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
  }
}
