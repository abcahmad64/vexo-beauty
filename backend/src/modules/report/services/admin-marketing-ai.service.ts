import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import {
  AiPermissionContext,
  AiPermissionGuardService,
} from '../../ai/services/ai-permission-guard.service';

import {
  AiToolDefinition,
  AiToolRegistryService,
} from '../../ai/services/ai-tool-registry.service';

import {
  AdminDemandAnalysisAiDto,
  AdminMarketingStrategyAiDto,
  AdminProductRecommendationAiDto,
  AdminSearchInsightAiDto,
} from '../dto/admin-marketing-ai.dto';

type JsonRecord = Record<string, unknown>;

type DiagnosticEntry = {
  section: string;
  message: string;
};

type CountOnlyRow = {
  count: number | bigint;
};

type SalesMetricsRow = {
  orderCount: number | bigint;
  refundedOrderCount: number | bigint;
  pendingOrderCount: number | bigint;
  grossRevenue: Prisma.Decimal | number | string | null;
  discountAmount: Prisma.Decimal | number | string | null;
  averageOrderValue: Prisma.Decimal | number | string | null;
};

type ProductFocusRow = {
  productId: string;
  productName: string;
  sku: string | null;
  categoryId: string | null;
  categoryName: string | null;
  brandId: string | null;
  brandName: string | null;
  quantity: number | bigint;
  orderCount: number | bigint;
  revenue: Prisma.Decimal | number | string | null;
  viewCount: number | bigint | null;
  reviewCount: number | bigint | null;
  averageRating: Prisma.Decimal | number | string | null;
  availableStock: number | bigint | null;
};

type CatalogMetricsRow = {
  activeProductCount: number | bigint;
  inactiveProductCount: number | bigint;
  categoryCount: number | bigint;
  brandCount: number | bigint;
  lowStockCount: number | bigint;
  outOfStockCount: number | bigint;
};

type CustomerMetricsRow = {
  customerCount: number | bigint;
  newCustomerCount: number | bigint;
  orderingCustomerCount: number | bigint;
};

type CartMetricsRow = {
  cartCount: number | bigint;
  cartItemCount: number | bigint;
  abandonedCartCount: number | bigint;
  cartSubtotal: Prisma.Decimal | number | string | null;
};

type SearchEventRow = {
  query: string | null;
  scope: string | null;
  resultCount: number | bigint | null;
  count: number | bigint;
  lastSeenAt: Date | null;
};

type ProductCandidateRow = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: Prisma.Decimal | number | string;
  comparePrice: Prisma.Decimal | number | string | null;
  status: string;
  isActive: boolean;
  categoryId: string | null;
  categoryName: string | null;
  brandId: string | null;
  brandName: string | null;
  viewCount: number | bigint | null;
  reviewCount: number | bigint | null;
  averageRating: Prisma.Decimal | number | string | null;
  availableStock: number | bigint | null;
};

type UserBehaviorRow = {
  orderCount: number | bigint;
  cartItemCount: number | bigint;
  wishlistItemCount: number | bigint;
  reviewCount: number | bigint;
};

type AiEnvelope<T> = {
  range?: {
    createdFrom: string;
    createdTo: string;
  };
  model: string;
  applied: false;
  tool: {
    name: string;
    title: string;
    riskLevel: string;
    executionMode: string;
    requiresApproval: boolean;
  };
  audit: {
    actorId: string | null;
    action: string;
  };
} & T;

@Injectable()
export class AdminMarketingAiService {
  private readonly model = 'backend-deterministic-marketing-intelligence';

  constructor(
    private readonly prisma: PrismaService,
    private readonly toolRegistry: AiToolRegistryService,
    private readonly permissionGuard: AiPermissionGuardService,
  ) {}

  async generateMarketingStrategy(
    dto: AdminMarketingStrategyAiDto,
    context: AiPermissionContext,
  ): Promise<
    AiEnvelope<{
      strategy: JsonRecord;
      snapshot: JsonRecord;
    }>
  > {
    const tool = this.assertToolAccess('marketing.strategy', context);

    const range = this.resolveRange(dto);

    const diagnostics: DiagnosticEntry[] = [];

    const [sales, topProducts, catalog, carts, customers, searchTerms] =
      await Promise.all([
        this.safeRead(
          'sales',
          diagnostics,
          () => this.getSalesMetrics(range, dto.currency),
          this.emptySalesMetrics(),
        ),
        this.safeRead(
          'topProducts',
          diagnostics,
          () => this.getTopProducts(range, dto.limit ?? 8, dto),
          [],
        ),
        this.safeRead(
          'catalog',
          diagnostics,
          () => this.getCatalogMetrics(),
          this.emptyCatalogMetrics(),
        ),
        this.safeRead(
          'carts',
          diagnostics,
          () => this.getCartMetrics(range),
          this.emptyCartMetrics(),
        ),
        this.safeRead(
          'customers',
          diagnostics,
          () => this.getCustomerMetrics(range),
          this.emptyCustomerMetrics(),
        ),
        this.safeRead(
          'search',
          diagnostics,
          () => this.getSearchEvents(range, dto.limit ?? 8, undefined),
          [],
        ),
      ]);

    const strategy = this.buildMarketingStrategy({
      dto,
      sales,
      topProducts,
      catalog,
      carts,
      customers,
      searchTerms,
    });

    return {
      range,
      strategy,
      snapshot: {
        sales,
        catalog,
        carts,
        customers,
        topProducts,
        searchTerms,
        diagnostics,
      },
      ...this.baseEnvelope(tool, context, 'marketing.ai_strategy_generated'),
    };
  }

  async generateDemandAnalysis(
    dto: AdminDemandAnalysisAiDto,
    context: AiPermissionContext,
  ): Promise<
    AiEnvelope<{
      demand: JsonRecord;
      snapshot: JsonRecord;
    }>
  > {
    const tool = this.assertToolAccess('demand.analysis', context);

    const range = this.resolveRange(dto);

    const diagnostics: DiagnosticEntry[] = [];

    const [sales, topProducts, catalog, searchTerms] = await Promise.all([
      this.safeRead(
        'sales',
        diagnostics,
        () => this.getSalesMetrics(range, dto.currency),
        this.emptySalesMetrics(),
      ),
      this.safeRead(
        'topProducts',
        diagnostics,
        () => this.getTopProducts(range, dto.limit ?? 10, dto),
        [],
      ),
      this.safeRead(
        'catalog',
        diagnostics,
        () => this.getCatalogMetrics(),
        this.emptyCatalogMetrics(),
      ),
      dto.includeSearch === false
        ? Promise.resolve([])
        : this.safeRead(
            'search',
            diagnostics,
            () => this.getSearchEvents(range, dto.limit ?? 10, undefined),
            [],
          ),
    ]);

    const demand = this.buildDemandAnalysis({
      sales,
      topProducts,
      catalog,
      searchTerms,
    });

    return {
      range,
      demand,
      snapshot: {
        sales,
        catalog,
        topProducts,
        searchTerms,
        diagnostics,
      },
      ...this.baseEnvelope(tool, context, 'demand.ai_analysis_generated'),
    };
  }

  async generateProductRecommendations(
    dto: AdminProductRecommendationAiDto,
    context: AiPermissionContext,
  ): Promise<
    AiEnvelope<{
      recommendation: JsonRecord;
      products: JsonRecord[];
      behavior: JsonRecord;
    }>
  > {
    const tool = this.assertToolAccess('recommendation.product', context);

    const diagnostics: DiagnosticEntry[] = [];

    const [products, behavior] = await Promise.all([
      this.safeRead(
        'productRecommendations',
        diagnostics,
        () => this.getRecommendationProducts(dto),
        [],
      ),
      dto.userId
        ? this.safeRead(
            'userBehavior',
            diagnostics,
            () => this.getUserBehavior(dto.userId as string),
            this.emptyUserBehavior(),
          )
        : Promise.resolve(this.emptyUserBehavior()),
    ]);

    const recommendation = this.buildProductRecommendation(
      dto,
      products,
      behavior,
      diagnostics,
    );

    return {
      recommendation,
      products: products.map((product) => this.mapProductCandidate(product)),
      behavior: this.mapUserBehavior(behavior),
      ...this.baseEnvelope(
        tool,
        context,
        'recommendation.ai_product_generated',
      ),
    };
  }

  async generateSearchInsight(
    dto: AdminSearchInsightAiDto,
    context: AiPermissionContext,
  ): Promise<
    AiEnvelope<{
      insight: JsonRecord;
      searchTerms: JsonRecord[];
      diagnostics: DiagnosticEntry[];
    }>
  > {
    const tool = this.assertToolAccess('search.insight', context);

    const range = this.resolveRange(dto);

    const diagnostics: DiagnosticEntry[] = [];

    const searchTerms = await this.safeRead(
      'search',
      diagnostics,
      () => this.getSearchEvents(range, dto.limit ?? 20, dto),
      [],
    );

    const insight = this.buildSearchInsight(dto, searchTerms, diagnostics);

    return {
      range,
      insight,
      searchTerms: searchTerms.map((term) => this.mapSearchTerm(term)),
      diagnostics,
      ...this.baseEnvelope(tool, context, 'search.ai_insight_generated'),
    };
  }

  private assertToolAccess(
    toolName: string,
    context: AiPermissionContext,
  ): AiToolDefinition {
    const tool = this.toolRegistry.assertToolEnabled(toolName);

    this.permissionGuard.assertAllowed(
      context,
      tool.requiredPermissions,
      tool.title,
    );

    return tool;
  }

  private baseEnvelope(
    tool: AiToolDefinition,
    context: AiPermissionContext,
    action: string,
  ) {
    return {
      model: this.model,
      applied: false as const,
      tool: {
        name: tool.name,
        title: tool.title,
        riskLevel: tool.riskLevel,
        executionMode: tool.executionMode,
        requiresApproval: tool.requiresApproval,
      },
      audit: {
        actorId: context.userId ?? null,
        action,
      },
    };
  }

  private resolveRange(dto: { createdFrom?: string; createdTo?: string }): {
    createdFrom: string;
    createdTo: string;
  } {
    const createdTo = dto.createdTo ? new Date(dto.createdTo) : new Date();

    const createdFrom = dto.createdFrom
      ? new Date(dto.createdFrom)
      : new Date(createdTo.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (
      Number.isNaN(createdFrom.getTime()) ||
      Number.isNaN(createdTo.getTime())
    ) {
      const now = new Date();

      return {
        createdFrom: new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        createdTo: now.toISOString(),
      };
    }

    if (createdFrom.getTime() > createdTo.getTime()) {
      return {
        createdFrom: createdTo.toISOString(),
        createdTo: createdFrom.toISOString(),
      };
    }

    return {
      createdFrom: createdFrom.toISOString(),
      createdTo: createdTo.toISOString(),
    };
  }

  private async safeRead<T>(
    section: string,
    diagnostics: DiagnosticEntry[],
    reader: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      return await reader();
    } catch (error) {
      diagnostics.push({
        section,
        message: error instanceof Error ? error.message : String(error),
      });

      return fallback;
    }
  }

  private async getSalesMetrics(
    range: {
      createdFrom: string;
      createdTo: string;
    },
    currency?: string,
  ) {
    const rows = await this.prisma.$queryRaw<SalesMetricsRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "orderCount",
            COUNT(*) FILTER (WHERE o."status"::text = 'REFUNDED')::int AS "refundedOrderCount",
            COUNT(*) FILTER (WHERE o."status"::text IN ('PENDING', 'PROCESSING'))::int AS "pendingOrderCount",
            COALESCE(SUM(o."totalAmount"), 0)::numeric AS "grossRevenue",
            COALESCE(SUM(o."discountAmount"), 0)::numeric AS "discountAmount",
            COALESCE(AVG(o."totalAmount"), 0)::numeric AS "averageOrderValue"
          FROM "Order" o
          WHERE
            o."deleted_at" IS NULL
            AND o."createdAt" >= ${new Date(range.createdFrom)}
            AND o."createdAt" <= ${new Date(range.createdTo)}
            AND (${currency ?? null}::text IS NULL OR o."currency" = ${currency ?? null})
        `,
    );

    return this.mapSalesMetrics(rows[0] ?? this.emptySalesMetrics());
  }

  private async getTopProducts(
    range: {
      createdFrom: string;
      createdTo: string;
    },
    limit: number,
    filters: {
      productId?: string;
      categoryId?: string;
      brandId?: string;
    },
  ): Promise<ProductFocusRow[]> {
    const where: Prisma.Sql[] = [
      Prisma.sql`o."deleted_at" IS NULL`,
      Prisma.sql`o."createdAt" >= ${new Date(range.createdFrom)}`,
      Prisma.sql`o."createdAt" <= ${new Date(range.createdTo)}`,
      this.realCatalogTextFilterSql([
        Prisma.sql`COALESCE(p."name", oi."productName", '')`,
        Prisma.sql`COALESCE(p."slug", '')`,
        Prisma.sql`COALESCE(p."sku", oi."sku", '')`,
        Prisma.sql`COALESCE(c."name", '')`,
        Prisma.sql`COALESCE(b."name", '')`,
      ]),
    ];

    if (filters.productId) {
      where.push(Prisma.sql`oi."productId" = ${filters.productId}`);
    }

    if (filters.categoryId) {
      where.push(Prisma.sql`p."categoryId" = ${filters.categoryId}`);
    }

    if (filters.brandId) {
      where.push(Prisma.sql`p."brandId" = ${filters.brandId}`);
    }

    return this.prisma.$queryRaw<ProductFocusRow[]>(
      Prisma.sql`
        SELECT
          oi."productId" AS "productId",
          COALESCE(p."name", oi."productName") AS "productName",
          COALESCE(p."sku", oi."sku") AS "sku",
          p."categoryId" AS "categoryId",
          c."name" AS "categoryName",
          p."brandId" AS "brandId",
          b."name" AS "brandName",
          COALESCE(SUM(oi."quantity"), 0)::int AS "quantity",
          COUNT(DISTINCT oi."orderId")::int AS "orderCount",
          COALESCE(SUM((oi."price" * oi."quantity") - oi."discount"), 0)::numeric AS "revenue",
          COALESCE(p."viewCount", 0)::int AS "viewCount",
          COALESCE(p."reviewCount", 0)::int AS "reviewCount",
          p."averageRating" AS "averageRating",
          COALESCE(stock."availableStock", 0)::int AS "availableStock"
        FROM "OrderItem" oi
        INNER JOIN "Order" o
          ON o."id" = oi."orderId"
        LEFT JOIN "Product" p
          ON p."id" = oi."productId"
        LEFT JOIN "Category" c
          ON c."id" = p."categoryId"
        LEFT JOIN "Brand" b
          ON b."id" = p."brandId"
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(
              SUM(
                GREATEST(
                  COALESCE(i."quantity", 0) -
                  COALESCE(i."reservedQuantity", 0),
                  0
                )
              ),
              0
            ) AS "availableStock"
          FROM "ProductVariant" v
          LEFT JOIN "Inventory" i
            ON i."variantId" = v."id"
            AND i."deleted_at" IS NULL
          WHERE
            v."productId" = oi."productId"
            AND v."deleted_at" IS NULL
        ) stock ON TRUE
        WHERE ${Prisma.join(where, ' AND ')}
        GROUP BY
          oi."productId",
          COALESCE(p."name", oi."productName"),
          COALESCE(p."sku", oi."sku"),
          p."categoryId",
          c."name",
          p."brandId",
          b."name",
          p."viewCount",
          p."reviewCount",
          p."averageRating",
          stock."availableStock"
        ORDER BY
          "revenue" DESC,
          "quantity" DESC
        LIMIT ${Math.min(Math.max(limit, 1), 50)}
      `,
    );
  }

  private async getCatalogMetrics() {
    const rows = await this.prisma.$queryRaw<CatalogMetricsRow[]>(
      Prisma.sql`
          SELECT
            (SELECT COUNT(*)::int FROM "Product" WHERE "deleted_at" IS NULL AND "isActive" = TRUE) AS "activeProductCount",
            (SELECT COUNT(*)::int FROM "Product" WHERE "deleted_at" IS NULL AND "isActive" = FALSE) AS "inactiveProductCount",
            (SELECT COUNT(*)::int FROM "Category" WHERE "deleted_at" IS NULL AND "isActive" = TRUE) AS "categoryCount",
            (SELECT COUNT(*)::int FROM "Brand" WHERE "deleted_at" IS NULL AND "isActive" = TRUE) AS "brandCount",
            (SELECT COUNT(*)::int FROM "Inventory" WHERE "deleted_at" IS NULL AND ("quantity" - "reservedQuantity") > 0 AND ("quantity" - "reservedQuantity") <= 5) AS "lowStockCount",
            (SELECT COUNT(*)::int FROM "Inventory" WHERE "deleted_at" IS NULL AND ("quantity" - "reservedQuantity") <= 0) AS "outOfStockCount"
        `,
    );

    return this.mapCatalogMetrics(rows[0] ?? this.emptyCatalogMetrics());
  }

  private async getCartMetrics(range: {
    createdFrom: string;
    createdTo: string;
  }) {
    const rows = await this.prisma.$queryRaw<CartMetricsRow[]>(
      Prisma.sql`
          SELECT
            COUNT(DISTINCT c."id")::int AS "cartCount",
            COUNT(ci."id")::int AS "cartItemCount",
            COUNT(DISTINCT c."id") FILTER (
              WHERE c."updatedAt" < NOW() - INTERVAL '24 hours'
            )::int AS "abandonedCartCount",
            COALESCE(SUM(ci."price" * ci."quantity"), 0)::numeric AS "cartSubtotal"
          FROM "Cart" c
          LEFT JOIN "CartItem" ci
            ON ci."cartId" = c."id"
          WHERE
            c."createdAt" >= ${new Date(range.createdFrom)}
            AND c."createdAt" <= ${new Date(range.createdTo)}
        `,
    );

    return this.mapCartMetrics(rows[0] ?? this.emptyCartMetrics());
  }

  private async getCustomerMetrics(range: {
    createdFrom: string;
    createdTo: string;
  }) {
    const rows = await this.prisma.$queryRaw<CustomerMetricsRow[]>(
      Prisma.sql`
          SELECT
            (SELECT COUNT(*)::int FROM "User" WHERE "deleted_at" IS NULL) AS "customerCount",
            (SELECT COUNT(*)::int FROM "User" WHERE "deleted_at" IS NULL AND "createdAt" >= ${new Date(range.createdFrom)} AND "createdAt" <= ${new Date(range.createdTo)}) AS "newCustomerCount",
            (SELECT COUNT(DISTINCT "userId")::int FROM "Order" WHERE "deleted_at" IS NULL AND "createdAt" >= ${new Date(range.createdFrom)} AND "createdAt" <= ${new Date(range.createdTo)}) AS "orderingCustomerCount"
        `,
    );

    return this.mapCustomerMetrics(rows[0] ?? this.emptyCustomerMetrics());
  }

  private async getSearchEvents(
    range: {
      createdFrom: string;
      createdTo: string;
    },
    limit: number,
    dto?: {
      query?: string;
      scope?: string;
    },
  ): Promise<SearchEventRow[]> {
    const where: Prisma.Sql[] = [
      Prisma.sql`e."deleted_at" IS NULL`,
      Prisma.sql`e."timestamp" >= ${new Date(range.createdFrom)}`,
      Prisma.sql`e."timestamp" <= ${new Date(range.createdTo)}`,
      Prisma.sql`e."name" ILIKE ${'%search%'}`,
      Prisma.sql`NULLIF(e."data" #>> '{query}', '') IS NOT NULL`,
      this.realCatalogTextFilterSql([
        Prisma.sql`COALESCE(e."data" #>> '{query}', '')`,
      ]),
    ];

    if (dto?.query) {
      where.push(
        Prisma.sql`COALESCE(e."data" #>> '{query}', '') ILIKE ${`%${dto.query}%`}`,
      );
    }

    if (dto?.scope && dto.scope !== 'all') {
      where.push(
        Prisma.sql`COALESCE(e."data" #>> '{scope}', '') ILIKE ${`%${dto.scope}%`}`,
      );
    }

    return this.prisma.$queryRaw<SearchEventRow[]>(
      Prisma.sql`
        SELECT
          NULLIF(e."data" #>> '{query}', '') AS "query",
          NULLIF(e."data" #>> '{scope}', '') AS "scope",
          COALESCE(NULLIF(e."data" #>> '{resultCount}', '')::int, 0) AS "resultCount",
          COUNT(*)::int AS "count",
          MAX(e."timestamp") AS "lastSeenAt"
        FROM "Event" e
        WHERE ${Prisma.join(where, ' AND ')}
        GROUP BY
          NULLIF(e."data" #>> '{query}', ''),
          NULLIF(e."data" #>> '{scope}', ''),
          COALESCE(NULLIF(e."data" #>> '{resultCount}', '')::int, 0)
        ORDER BY
          "count" DESC,
          "lastSeenAt" DESC
        LIMIT ${Math.min(Math.max(limit, 1), 100)}
      `,
    );
  }

  private async getRecommendationProducts(
    dto: AdminProductRecommendationAiDto,
  ): Promise<ProductCandidateRow[]> {
    const where: Prisma.Sql[] = [
      Prisma.sql`p."deleted_at" IS NULL`,
      Prisma.sql`p."isActive" = TRUE`,
      Prisma.sql`p."status"::text = 'ACTIVE'`,
      this.realCatalogTextFilterSql([
        Prisma.sql`COALESCE(p."name", '')`,
        Prisma.sql`COALESCE(p."slug", '')`,
        Prisma.sql`COALESCE(p."sku", '')`,
        Prisma.sql`COALESCE(c."name", '')`,
        Prisma.sql`COALESCE(b."name", '')`,
      ]),
    ];

    if (dto.productId) {
      where.push(Prisma.sql`p."id" <> ${dto.productId}`);
    }

    if (dto.categoryId) {
      where.push(Prisma.sql`p."categoryId" = ${dto.categoryId}`);
    }

    if (dto.brandId) {
      where.push(Prisma.sql`p."brandId" = ${dto.brandId}`);
    }

    if (dto.keywords && dto.keywords.length > 0) {
      const keywordConditions = dto.keywords.slice(0, 8).map(
        (keyword) =>
          Prisma.sql`(
              p."name" ILIKE ${`%${keyword}%`}
              OR p."description" ILIKE ${`%${keyword}%`}
              OR p."sku" ILIKE ${`%${keyword}%`}
              OR c."name" ILIKE ${`%${keyword}%`}
              OR b."name" ILIKE ${`%${keyword}%`}
            )`,
      );

      where.push(Prisma.sql`(${Prisma.join(keywordConditions, ' OR ')})`);
    }

    return this.prisma.$queryRaw<ProductCandidateRow[]>(
      Prisma.sql`
        SELECT
          p."id",
          p."name",
          p."slug",
          p."sku",
          p."price",
          p."comparePrice",
          p."status"::text AS "status",
          p."isActive",
          p."categoryId",
          c."name" AS "categoryName",
          p."brandId",
          b."name" AS "brandName",
          COALESCE(p."viewCount", 0)::int AS "viewCount",
          COALESCE(p."reviewCount", 0)::int AS "reviewCount",
          p."averageRating",
          COALESCE(stock."availableStock", 0)::int AS "availableStock"
        FROM "Product" p
        LEFT JOIN "Category" c
          ON c."id" = p."categoryId"
        LEFT JOIN "Brand" b
          ON b."id" = p."brandId"
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(
              SUM(
                GREATEST(
                  COALESCE(i."quantity", 0) -
                  COALESCE(i."reservedQuantity", 0),
                  0
                )
              ),
              0
            ) AS "availableStock"
          FROM "ProductVariant" v
          LEFT JOIN "Inventory" i
            ON i."variantId" = v."id"
            AND i."deleted_at" IS NULL
          WHERE
            v."productId" = p."id"
            AND v."deleted_at" IS NULL
        ) stock ON TRUE
        WHERE ${Prisma.join(where, ' AND ')}
        ORDER BY
          CASE WHEN COALESCE(stock."availableStock", 0) > 0 THEN 0 ELSE 1 END ASC,
          p."viewCount" DESC,
          p."reviewCount" DESC,
          p."updatedAt" DESC
        LIMIT ${Math.min(Math.max(dto.limit ?? 8, 1), 30)}
      `,
    );
  }

  private async getUserBehavior(userId: string): Promise<UserBehaviorRow> {
    const [orderCount, cartItemCount, wishlistItemCount, reviewCount] =
      await Promise.all([
        this.safeCount(
          Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "Order"
          WHERE
            "deleted_at" IS NULL
            AND "userId" = ${userId}
        `,
        ),
        this.safeCount(
          Prisma.sql`
          SELECT COUNT(ci."id")::int AS "count"
          FROM "Cart" c
          INNER JOIN "CartItem" ci
            ON ci."cartId" = c."id"
          WHERE c."userId" = ${userId}
        `,
        ),
        this.safeCount(
          Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "WishlistItem" wi
          INNER JOIN "Wishlist" w
            ON w."id" = wi."wishlistId"
          WHERE w."userId" = ${userId}
        `,
        ),
        this.safeCount(
          Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "Review"
          WHERE
            "deleted_at" IS NULL
            AND "userId" = ${userId}
        `,
        ),
      ]);

    return {
      orderCount,
      cartItemCount,
      wishlistItemCount,
      reviewCount,
    };
  }

  private buildMarketingStrategy(input: {
    dto: AdminMarketingStrategyAiDto;
    sales: JsonRecord;
    topProducts: ProductFocusRow[];
    catalog: JsonRecord;
    carts: JsonRecord;
    customers: JsonRecord;
    searchTerms: SearchEventRow[];
  }): JsonRecord {
    const topProduct = input.topProducts[0];

    const goal =
      input.dto.campaignGoal ?? 'افزایش فروش با کمپین کم‌ریسک و داده‌محور';

    const channel =
      input.dto.channel ?? 'ترکیب محتوا، بنر، اعلان و پیامک تأییدشده';

    const actions = [
      topProduct
        ? `روی محصول ${topProduct.productName} با درآمد ${this.toDecimalString(topProduct.revenue)} تمرکز کن.`
        : 'ابتدا داده فروش بیشتری جمع‌آوری کن و کمپین را با محصولات فعال شروع کن.',
      Number(input.carts.abandonedCartCount ?? 0) > 0
        ? 'برای سبدهای رهاشده، پیام یادآوری و پیشنهاد محدود را فقط به صورت draft تولید کن.'
        : 'فعلاً سبد رهاشده قابل توجه دیده نشد؛ تمرکز را روی معرفی محصولات فعال بگذار.',
      input.searchTerms.length > 0
        ? 'عبارت‌های جست‌وجوی پرتکرار را به عنوان ایده محتوا و FAQ استفاده کن.'
        : 'برای تحلیل جست‌وجو، ثبت و مانیتورینگ عبارت‌های جست‌وجو را ادامه بده.',
    ];

    return {
      title: 'استراتژی بازاریابی هوشمند و کم‌ریسک',
      goal,
      audience:
        input.dto.audience ?? 'مشتریان فعال و بازدیدکنندگان دارای قصد خرید',
      recommendedChannel: channel,
      summary: `${this.toNumber(input.sales.orderCount)} سفارش و ${this.toNumber(input.catalog.activeProductCount)} محصول فعال در داده‌های فعلی دیده شد.`,
      actions,
      contentIdeas: this.buildContentIdeas(input.searchTerms, topProduct),
      guardrails: this.defaultGuardrails(),
    };
  }

  private buildDemandAnalysis(input: {
    sales: JsonRecord;
    topProducts: ProductFocusRow[];
    catalog: JsonRecord;
    searchTerms: SearchEventRow[];
  }): JsonRecord {
    const opportunities = input.topProducts.slice(0, 5).map((product) => ({
      productId: product.productId,
      productName: product.productName,
      reason: `فروش/تقاضای ثبت‌شده: ${this.toNumber(product.quantity)} عدد در ${this.toNumber(product.orderCount)} سفارش`,
      stockSignal:
        this.toNumber(product.availableStock) <= 0
          ? 'نیازمند بررسی موجودی'
          : 'موجودی قابل بررسی دارد',
    }));

    return {
      title: 'تحلیل تقاضای فروشگاه',
      summary: `${this.toNumber(input.sales.orderCount)} سفارش در بازه انتخاب‌شده ثبت شده است.`,
      demandLevel:
        this.toNumber(input.sales.orderCount) > 10
          ? 'active'
          : this.toNumber(input.sales.orderCount) > 0
            ? 'limited_data'
            : 'insufficient_data',
      opportunities,
      gaps: [
        this.toNumber(input.catalog.outOfStockCount) > 0
          ? 'بخشی از موجودی ناموجود است و باید قبل از کمپین بررسی شود.'
          : 'شکاف موجودی فوری دیده نشد.',
        input.searchTerms.length < 1
          ? 'داده جست‌وجوی کافی برای تحلیل تقاضای محتوایی دیده نشد.'
          : 'داده جست‌وجو برای تولید محتوا و بهبود کاتالوگ قابل استفاده است.',
      ],
      guardrails: this.defaultGuardrails(),
    };
  }

  private buildProductRecommendation(
    dto: AdminProductRecommendationAiDto,
    products: ProductCandidateRow[],
    behavior: UserBehaviorRow,
    diagnostics: DiagnosticEntry[],
  ): JsonRecord {
    return {
      title: 'پیشنهاد محصول هوشمند',
      scenario: dto.scenario ?? 'پیشنهاد محصول برای فروشگاه یا مشتری',
      summary:
        products.length > 0
          ? `${products.length} محصول فعال و قابل بررسی پیشنهاد شد.`
          : 'محصول مناسبی با فیلترهای فعلی پیدا نشد.',
      userSignal: dto.userId
        ? `رفتار کاربر: ${this.toNumber(behavior.orderCount)} سفارش، ${this.toNumber(behavior.cartItemCount)} آیتم سبد، ${this.toNumber(behavior.wishlistItemCount)} آیتم علاقه‌مندی.`
        : 'تحلیل بدون کاربر مشخص انجام شد.',
      recommendations: products.map((product) => ({
        productId: product.id,
        productName: product.name,
        reason: this.productReason(product),
        caveat:
          'قیمت و موجودی باید هنگام نمایش نهایی دوباره از دیتابیس خوانده شود.',
      })),
      diagnostics,
      guardrails: this.defaultGuardrails(),
    };
  }

  private buildSearchInsight(
    dto: AdminSearchInsightAiDto,
    searchTerms: SearchEventRow[],
    diagnostics: DiagnosticEntry[],
  ): JsonRecord {
    const zeroResultTerms = searchTerms
      .filter((term) => this.toNumber(term.resultCount) === 0)
      .map((term) => term.query)
      .filter(Boolean);

    return {
      title: 'تحلیل جست‌وجوی کاربران',
      summary:
        searchTerms.length > 0
          ? `${searchTerms.length} عبارت/الگوی جست‌وجو بررسی شد.`
          : 'داده جست‌وجوی کافی در بازه انتخاب‌شده پیدا نشد.',
      topQueries: searchTerms
        .slice(0, 10)
        .map((term) => this.mapSearchTerm(term)),
      zeroResultTerms,
      recommendations: [
        zeroResultTerms.length > 0
          ? 'برای عبارت‌های بدون نتیجه، synonym، redirect یا محتوای کاتالوگ اضافه کن.'
          : 'عبارت بدون نتیجه مهم دیده نشد یا داده کافی وجود ندارد.',
        dto.query
          ? `برای عبارت «${dto.query}» صفحه محتوا، FAQ یا بهبود عنوان محصول را بررسی کن.`
          : 'عبارت‌های پرتکرار را برای تولید مقاله، FAQ و عنوان محصول استفاده کن.',
      ],
      diagnostics,
      guardrails: this.defaultGuardrails(),
    };
  }

  private buildContentIdeas(
    searchTerms: SearchEventRow[],
    topProduct?: ProductFocusRow,
  ): string[] {
    const ideas: string[] = [];

    if (topProduct) {
      ideas.push(`راهنمای انتخاب و استفاده از ${topProduct.productName}`);
    }

    for (const term of searchTerms.slice(0, 4)) {
      if (term.query) {
        ideas.push(`پاسخ به نیاز جست‌وجوی کاربران درباره «${term.query}»`);
      }
    }

    if (ideas.length < 1) {
      ideas.push(
        'مقاله آموزشی برای معرفی محصولات فعال و پاسخ به سؤال‌های رایج مشتریان',
      );
    }

    return ideas;
  }

  private productReason(product: ProductCandidateRow): string {
    const parts = [
      `بازدید: ${this.toNumber(product.viewCount)}`,
      `نظر: ${this.toNumber(product.reviewCount)}`,
      `موجودی قابل فروش: ${this.toNumber(product.availableStock)}`,
    ];

    if (product.categoryName) {
      parts.push(`دسته: ${product.categoryName}`);
    }

    if (product.brandName) {
      parts.push(`برند: ${product.brandName}`);
    }

    return parts.join('، ');
  }

  private mapSalesMetrics(row: SalesMetricsRow | JsonRecord): JsonRecord {
    return {
      orderCount: this.toNumber(row.orderCount),
      refundedOrderCount: this.toNumber(row.refundedOrderCount),
      pendingOrderCount: this.toNumber(row.pendingOrderCount),
      grossRevenue: this.toDecimalString(row.grossRevenue),
      discountAmount: this.toDecimalString(row.discountAmount),
      averageOrderValue: this.toDecimalString(row.averageOrderValue),
    };
  }

  private mapCatalogMetrics(row: CatalogMetricsRow | JsonRecord): JsonRecord {
    return {
      activeProductCount: this.toNumber(row.activeProductCount),
      inactiveProductCount: this.toNumber(row.inactiveProductCount),
      categoryCount: this.toNumber(row.categoryCount),
      brandCount: this.toNumber(row.brandCount),
      lowStockCount: this.toNumber(row.lowStockCount),
      outOfStockCount: this.toNumber(row.outOfStockCount),
    };
  }

  private mapCartMetrics(row: CartMetricsRow | JsonRecord): JsonRecord {
    return {
      cartCount: this.toNumber(row.cartCount),
      cartItemCount: this.toNumber(row.cartItemCount),
      abandonedCartCount: this.toNumber(row.abandonedCartCount),
      cartSubtotal: this.toDecimalString(row.cartSubtotal),
    };
  }

  private mapCustomerMetrics(row: CustomerMetricsRow | JsonRecord): JsonRecord {
    return {
      customerCount: this.toNumber(row.customerCount),
      newCustomerCount: this.toNumber(row.newCustomerCount),
      orderingCustomerCount: this.toNumber(row.orderingCustomerCount),
    };
  }

  private mapSearchTerm(row: SearchEventRow): JsonRecord {
    return {
      query: row.query,
      scope: row.scope,
      resultCount: this.toNumber(row.resultCount),
      count: this.toNumber(row.count),
      lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    };
  }

  private mapProductCandidate(row: ProductCandidateRow): JsonRecord {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      price: this.toDecimalString(row.price),
      comparePrice:
        row.comparePrice === null
          ? null
          : this.toDecimalString(row.comparePrice),
      status: row.status,
      isActive: row.isActive,
      category: {
        id: row.categoryId,
        name: row.categoryName,
      },
      brand: {
        id: row.brandId,
        name: row.brandName,
      },
      viewCount: this.toNumber(row.viewCount),
      reviewCount: this.toNumber(row.reviewCount),
      averageRating: this.toDecimalString(row.averageRating),
      availableStock: this.toNumber(row.availableStock),
    };
  }

  private mapUserBehavior(row: UserBehaviorRow | JsonRecord): JsonRecord {
    return {
      orderCount: this.toNumber(row.orderCount),
      cartItemCount: this.toNumber(row.cartItemCount),
      wishlistItemCount: this.toNumber(row.wishlistItemCount),
      reviewCount: this.toNumber(row.reviewCount),
    };
  }

  private realCatalogTextFilterSql(fields: Prisma.Sql[]): Prisma.Sql {
    const unsafeTerms = [
      '%test%',
      '%sample%',
      '%demo%',
      '%mock%',
      '%fake%',
      '%seed%',
      '%Ø%',
      '%Ù%',
      '%Ú%',
      '%Û%',
      '%�%',
      '%â€%',
      '%تست%',
      '%آزمایشی%',
      '%نمونه%',
      '%ریدایرکت تست%',
    ];

    const conditions: Prisma.Sql[] = [];

    for (const field of fields) {
      for (const term of unsafeTerms) {
        conditions.push(Prisma.sql`${field} ILIKE ${term}`);
      }
    }

    return Prisma.sql`NOT (${Prisma.join(conditions, ' OR ')})`;
  }

  private async safeCount(query: Prisma.Sql): Promise<number> {
    try {
      const rows = await this.prisma.$queryRaw<CountOnlyRow[]>(query);

      return this.toNumber(rows[0]?.count);
    } catch {
      return 0;
    }
  }

  private defaultGuardrails(): string[] {
    return [
      'این خروجی فقط خواندنی یا پیش‌نویس است و هیچ داده‌ای را تغییر نمی‌دهد.',
      'ارسال پیامک، ساخت کوپن، تغییر محصول یا تغییر سفارش از این مسیر انجام نمی‌شود.',
      'قیمت، موجودی و وضعیت محصول باید هنگام اجرای نهایی دوباره از دیتابیس خوانده شود.',
      'از ادعای درمانی، تضمینی یا تخفیف پرریسک استفاده نشود.',
    ];
  }

  private emptySalesMetrics(): SalesMetricsRow {
    return {
      orderCount: 0,
      refundedOrderCount: 0,
      pendingOrderCount: 0,
      grossRevenue: '0',
      discountAmount: '0',
      averageOrderValue: '0',
    };
  }

  private emptyCatalogMetrics(): CatalogMetricsRow {
    return {
      activeProductCount: 0,
      inactiveProductCount: 0,
      categoryCount: 0,
      brandCount: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
    };
  }

  private emptyCartMetrics(): CartMetricsRow {
    return {
      cartCount: 0,
      cartItemCount: 0,
      abandonedCartCount: 0,
      cartSubtotal: '0',
    };
  }

  private emptyCustomerMetrics(): CustomerMetricsRow {
    return {
      customerCount: 0,
      newCustomerCount: 0,
      orderingCustomerCount: 0,
    };
  }

  private emptyUserBehavior(): UserBehaviorRow {
    return {
      orderCount: 0,
      cartItemCount: 0,
      wishlistItemCount: 0,
      reviewCount: 0,
    };
  }

  private toNumber(value: unknown): number {
    if (value instanceof Prisma.Decimal) {
      return value.toNumber();
    }

    switch (typeof value) {
      case 'number':
        return value || 0;
      case 'bigint':
        return Number(value) || 0;
      case 'string':
        return Number(value) || 0;
      case 'boolean':
        return Number(value) || 0;
      default:
        return 0;
    }
  }

  private toDecimalString(value: unknown): string {
    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'bigint'
    ) {
      return '0.00';
    }

    try {
      return new Prisma.Decimal(String(value)).toFixed(2);
    } catch {
      return '0.00';
    }
  }
}
