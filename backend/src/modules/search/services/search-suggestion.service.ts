import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { SearchSuggestionQueryDto } from '../dto/search-suggestion-query.dto';

import {
  buildPersianLikePattern,
  normalizePersianText,
} from '../utils/persian-normalizer.util';

type SuggestionRow = {
  id: string;
  type: 'product' | 'category' | 'brand';
  label: string;
  slug: string | null;
  sku: string | null;
  imageUrl: string | null;
};

@Injectable()
export class SearchSuggestionService {
  constructor(private readonly prisma: PrismaService) {}

  async suggest(query: SearchSuggestionQueryDto): Promise<{
    data: SuggestionRow[];
  }> {
    const q = normalizePersianText(query.q);

    if (!q) {
      return {
        data: [],
      };
    }

    const limit = Math.min(Math.max(Number(query.limit ?? 10), 1), 20);

    const pattern = buildPersianLikePattern(q);

    const rows = await this.prisma.$queryRaw<SuggestionRow[]>(
      Prisma.sql`
          (
            SELECT
              p."id",
              'product'::text AS "type",
              p."name" AS "label",
              p."slug",
              p."sku",
              (
                SELECT pi."url"
                FROM "ProductImage" pi
                WHERE pi."productId" = p."id"
                ORDER BY
                  pi."isPrimary" DESC,
                  pi."sortOrder" ASC,
                  pi."createdAt" ASC
                LIMIT 1
              ) AS "imageUrl"
            FROM "Product" p
            WHERE
              p."deleted_at" IS NULL
              AND p."isActive" = TRUE
              AND p."status" = 'ACTIVE'::"ProductStatus"
              AND (
                p."name" ILIKE ${pattern}
                OR p."sku" ILIKE ${pattern}
                OR REPLACE(REPLACE(p."name", 'ي', 'ی'), 'ك', 'ک') ILIKE ${pattern}
              )
            ORDER BY
              CASE
                WHEN p."name" ILIKE ${`${q}%`} THEN 0
                WHEN p."sku" ILIKE ${`${q}%`} THEN 1
                ELSE 2
              END,
              p."viewCount" DESC
            LIMIT ${limit}
          )
          UNION ALL
          (
            SELECT
              c."id",
              'category'::text AS "type",
              c."name" AS "label",
              c."slug",
              NULL::text AS "sku",
              c."image" AS "imageUrl"
            FROM "Category" c
            WHERE
              c."deleted_at" IS NULL
              AND c."isActive" = TRUE
              AND (
                c."name" ILIKE ${pattern}
                OR c."slug" ILIKE ${pattern}
                OR REPLACE(REPLACE(c."name", 'ي', 'ی'), 'ك', 'ک') ILIKE ${pattern}
              )
            ORDER BY
              c."sortOrder" ASC,
              c."name" ASC
            LIMIT ${limit}
          )
          UNION ALL
          (
            SELECT
              b."id",
              'brand'::text AS "type",
              b."name" AS "label",
              b."slug",
              NULL::text AS "sku",
              b."logoUrl" AS "imageUrl"
            FROM "Brand" b
            WHERE
              b."deleted_at" IS NULL
              AND b."isActive" = TRUE
              AND (
                b."name" ILIKE ${pattern}
                OR b."slug" ILIKE ${pattern}
                OR REPLACE(REPLACE(b."name", 'ي', 'ی'), 'ك', 'ک') ILIKE ${pattern}
              )
            ORDER BY
              b."name" ASC
            LIMIT ${limit}
          )
          LIMIT ${limit}
        `,
    );

    return {
      data: rows,
    };
  }
}
