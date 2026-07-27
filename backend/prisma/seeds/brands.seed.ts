import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient } from '../../src/generated/prisma';

const brands = [
  {
    name: 'VEXO Beauty',
    slug: 'vexo-beauty',
    description: 'برند اصلی فروشگاه وکسو بیوتی',
  },
  {
    name: 'Dermaline',
    slug: 'dermaline',
    description: 'برند تخصصی مراقبت پوست',
  },
  {
    name: 'HairPlus',
    slug: 'hairplus',
    description: 'برند تخصصی مراقبت مو',
  },
];

export async function seedBrands(prisma: PrismaClient): Promise<void> {
  for (const brand of brands) {
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Brand" (
          "id",
          "name",
          "slug",
          "description",
          "logoUrl",
          "website",
          "isActive",
          "createdAt",
          "updatedAt",
          "deleted_at"
        )
        VALUES (
          ${randomUUID()},
          ${brand.name},
          ${brand.slug},
          ${brand.description},
          NULL,
          NULL,
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
  }
}
