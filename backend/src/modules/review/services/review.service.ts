import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { CreateReviewDto } from '../dto/create-review.dto';

import { QueryReviewDto } from '../dto/query-review.dto';

import { UpdateReviewDto } from '../dto/update-review.dto';

import { VerifyReviewDto } from '../dto/verify-review.dto';

import { ReviewEventPublisher } from '../events/review.event.publisher';

type PrismaTx = Prisma.TransactionClient;

type CountRow = {
  count: number | bigint;
};

type ReviewRow = {
  id: string;
  user_id: string;
  product_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
  product_name: string | null;
  product_slug: string | null;
  product_sku: string | null;
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
};

type ProductContextRow = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  is_active: boolean;
  status: string;
  deleted_at: Date | null;
};

type RatingAggregateValue = Prisma.Decimal | string | number | null;

type RatingAggregateRow = {
  review_count: number | bigint;
  average_rating: RatingAggregateValue;
};

type MappedReview = ReturnType<ReviewService['mapReviewRow']>;

type ReviewListVisibility = 'internal' | 'public';

const REVIEW_MESSAGES = {
  ALREADY_REVIEWED: 'شما قبلاً برای این محصول دیدگاه ثبت کرده‌اید.',
  REVIEW_NOT_FOUND: 'دیدگاه موردنظر یافت نشد.',
  PRODUCT_NOT_FOUND: 'محصول موردنظر یافت نشد.',
  PRODUCT_NOT_REVIEWABLE: 'این محصول در حال حاضر قابل ثبت دیدگاه نیست.',
  USER_NOT_FOUND_OR_INACTIVE: 'کاربر موردنظر یافت نشد یا فعال نیست.',
  EMPTY_UPDATE: 'هیچ داده‌ای برای به‌روزرسانی دیدگاه ارسال نشده است.',
  INVALID_DATE: 'تاریخ واردشده معتبر نیست.',
  REVIEW_DELETED: 'دیدگاه با موفقیت حذف شد.',
} as const;

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: ReviewEventPublisher,
  ) {}

  async create(
    userId: string,
    dto: CreateReviewDto,
    actorId?: string,
  ): Promise<unknown> {
    const product = await this.findProductContext(dto.productId);

    this.assertProductReviewable(product);

    await this.assertUserExists(userId);

    const existing = await this.prisma.productReview.findUnique({
      where: {
        userId_productId: {
          userId,
          productId: dto.productId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException(REVIEW_MESSAGES.ALREADY_REVIEWED);
    }

    const isVerified = await this.hasVerifiedPurchase(userId, dto.productId);

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.productReview.create({
        data: {
          userId,
          productId: dto.productId,
          rating: dto.rating,
          title: dto.title ?? null,
          comment: dto.comment ?? null,
          isVerified,
        },
        select: {
          id: true,
          userId: true,
          productId: true,
          rating: true,
          title: true,
          comment: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await this.syncProductRatingTx(tx, dto.productId);

      return created;
    });

    const occurredAt = new Date();

    this.eventPublisher.publishCreated({
      reviewId: review.id,
      productId: review.productId,
      userId: review.userId,
      rating: review.rating,
      isVerified: review.isVerified,
      actorId: actorId ?? userId,
      occurredAt,
    });

    await this.publishRatingSynced(review.productId, actorId ?? userId);

    return this.findOneForUser(userId, review.id);
  }

  async findAllPublic(
    productId: string,
    query: QueryReviewDto,
  ): Promise<unknown> {
    const product = await this.findProductContext(productId);

    this.assertProductVisible(product);

    return this.findAll(
      {
        page: query.page,
        limit: query.limit,
        rating: query.rating,
        q: query.q,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
        productId,
        isVerified: true,
      },
      'public',
    );
  }

  async findAllForUser(
    userId: string,
    query: QueryReviewDto,
  ): Promise<unknown> {
    return this.findAll({
      ...query,
      userId,
    });
  }

  async findAllForAdmin(query: QueryReviewDto): Promise<unknown> {
    return this.findAll(query);
  }

  async findOneForAdmin(reviewId: string): Promise<unknown> {
    const review = await this.findReviewRow(reviewId);

    return this.mapReviewRow(review);
  }

  async findOneForUser(userId: string, reviewId: string): Promise<unknown> {
    const review = await this.findReviewRow(reviewId);

    if (review.user_id !== userId) {
      throw new NotFoundException(REVIEW_MESSAGES.REVIEW_NOT_FOUND);
    }

    return this.mapReviewRow(review);
  }

  async updateForUser(
    userId: string,
    reviewId: string,
    dto: UpdateReviewDto,
    actorId?: string,
  ): Promise<unknown> {
    const review = await this.findReviewRow(reviewId);

    if (review.user_id !== userId) {
      throw new NotFoundException(REVIEW_MESSAGES.REVIEW_NOT_FOUND);
    }

    return this.updateReview(review, dto, actorId ?? userId);
  }

  async updateForAdmin(
    reviewId: string,
    dto: UpdateReviewDto,
    actorId?: string,
  ): Promise<unknown> {
    const review = await this.findReviewRow(reviewId);

    const updated = await this.updateReview(review, dto, actorId);

    return {
      review: updated,
      updatedAt: updated.updatedAt,
      updatedAtFa: updated.updatedAtFa,
      audit: {
        actorId: actorId ?? null,
        action: 'review.admin_updated',
      },
    };
  }

  async verify(
    reviewId: string,
    dto: VerifyReviewDto,
    actorId?: string,
  ): Promise<unknown> {
    const review = await this.findReviewRow(reviewId);

    const now = new Date();

    if (review.is_verified === dto.isVerified) {
      const mapped = this.mapReviewRow(review);

      return {
        review: mapped,
        verifiedAt: now,
        verifiedAtFa: formatPersianDateTime(now),
        audit: {
          actorId: actorId ?? null,
          action: dto.isVerified
            ? 'review.admin_verified_no_change'
            : 'review.admin_unverified_no_change',
          reason: dto.reason ?? null,
        },
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productReview.update({
        where: {
          id: reviewId,
        },
        data: {
          isVerified: dto.isVerified,
        },
      });

      await this.syncProductRatingTx(tx, review.product_id);
    });

    if (dto.isVerified) {
      this.eventPublisher.publishVerified({
        reviewId: review.id,
        productId: review.product_id,
        userId: review.user_id,
        reason: dto.reason,
        actorId,
        occurredAt: now,
      });
    } else {
      this.eventPublisher.publishUnverified({
        reviewId: review.id,
        productId: review.product_id,
        userId: review.user_id,
        reason: dto.reason,
        actorId,
        occurredAt: now,
      });
    }

    await this.publishRatingSynced(review.product_id, actorId);

    const updated = await this.findMappedReviewForAdmin(reviewId);

    return {
      review: updated,
      verifiedAt: now,
      verifiedAtFa: formatPersianDateTime(now),
      audit: {
        actorId: actorId ?? null,
        action: dto.isVerified
          ? 'review.admin_verified'
          : 'review.admin_unverified',
        reason: dto.reason ?? null,
      },
    };
  }

  async removeForUser(
    userId: string,
    reviewId: string,
    actorId?: string,
  ): Promise<unknown> {
    const review = await this.findReviewRow(reviewId);

    if (review.user_id !== userId) {
      throw new NotFoundException(REVIEW_MESSAGES.REVIEW_NOT_FOUND);
    }

    return this.removeReview(review, actorId ?? userId, 'review.user_deleted');
  }

  async removeForAdmin(reviewId: string, actorId?: string): Promise<unknown> {
    const review = await this.findReviewRow(reviewId);

    return this.removeReview(review, actorId, 'review.admin_deleted');
  }

  async getProductRatingSummary(productId: string): Promise<unknown> {
    const product = await this.findProductContext(productId);

    this.assertProductVisible(product);

    const [aggregate, distribution] = await Promise.all([
      this.getProductRatingAggregate(productId),

      this.prisma.$queryRaw<
        Array<{
          rating: number;
          count: number | bigint;
        }>
      >(
        Prisma.sql`
            SELECT
              "rating",
              COUNT(*)::int AS count
            FROM "ProductReview"
            WHERE "productId" = ${productId}
              AND "isVerified" = true
            GROUP BY "rating"
            ORDER BY "rating" DESC
          `,
      ),
    ]);

    const distributionMap = new Map<number, number>(
      distribution.map((row) => [row.rating, this.toNumber(row.count)]),
    );

    return {
      productId,
      reviewCount: aggregate.reviewCount,
      averageRating: aggregate.averageRating,
      distribution: [5, 4, 3, 2, 1].map((rating) => ({
        rating,
        count: distributionMap.get(rating) ?? 0,
      })),
    };
  }

  private async findAll(
    query: QueryReviewDto,
    visibility: ReviewListVisibility = 'internal',
  ): Promise<unknown> {
    const { page, limit, skip } = this.buildPagination(query);

    const whereSql = this.buildReviewWhereSql(query, visibility);

    const userSelectSql =
      visibility === 'public'
        ? Prisma.sql`
            NULL::text AS user_id,
            NULL::text AS user_email,
            NULL::text AS user_first_name,
            NULL::text AS user_last_name
          `
        : Prisma.sql`
            r."userId" AS user_id,
            u."email" AS user_email,
            u."firstName" AS user_first_name,
            u."lastName" AS user_last_name
          `;

    const userJoinSql =
      visibility === 'public'
        ? Prisma.empty
        : Prisma.sql`
            LEFT JOIN "User" u
              ON u."id" = r."userId"
          `;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<ReviewRow[]>(
        Prisma.sql`
            SELECT
              r."id",
              r."productId" AS product_id,
              r."rating",
              r."title",
              r."comment",
              r."isVerified" AS is_verified,
              r."createdAt" AS created_at,
              r."updatedAt" AS updated_at,
              p."name" AS product_name,
              p."slug" AS product_slug,
              p."sku" AS product_sku,
              ${userSelectSql}
            FROM "ProductReview" r
            LEFT JOIN "Product" p
              ON p."id" = r."productId"
            ${userJoinSql}
            ${whereSql}
            ORDER BY r."createdAt" DESC, r."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),

      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS count
            FROM "ProductReview" r
            LEFT JOIN "Product" p
              ON p."id" = r."productId"
            ${userJoinSql}
            ${whereSql}
          `,
      ),
    ]);

    return this.buildPaginatedResult(
      rows.map((row) =>
        visibility === 'public'
          ? this.mapPublicReviewRow(row)
          : this.mapReviewRow(row),
      ),
      this.toNumber(countRows[0]?.count),
      page,
      limit,
    );
  }

  private async updateReview(
    review: ReviewRow,
    dto: UpdateReviewDto,
    actorId?: string,
  ): Promise<MappedReview> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(REVIEW_MESSAGES.EMPTY_UPDATE);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productReview.update({
        where: {
          id: review.id,
        },
        data: {
          ...(dto.rating !== undefined
            ? {
                rating: dto.rating,
              }
            : {}),
          ...(dto.title !== undefined
            ? {
                title: dto.title,
              }
            : {}),
          ...(dto.comment !== undefined
            ? {
                comment: dto.comment,
              }
            : {}),
        },
      });

      await this.syncProductRatingTx(tx, review.product_id);
    });

    const occurredAt = new Date();

    this.eventPublisher.publishUpdated({
      reviewId: review.id,
      productId: review.product_id,
      userId: review.user_id,
      changedFields: Object.keys(dto),
      previousRating: review.rating,
      currentRating: dto.rating ?? review.rating,
      actorId,
      occurredAt,
    });

    await this.publishRatingSynced(review.product_id, actorId);

    return this.findMappedReviewForAdmin(review.id);
  }

  private async removeReview(
    review: ReviewRow,
    actorId: string | undefined,
    action: string,
  ): Promise<unknown> {
    const deletedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.productReview.delete({
        where: {
          id: review.id,
        },
      });

      await this.syncProductRatingTx(tx, review.product_id);
    });

    this.eventPublisher.publishDeleted({
      reviewId: review.id,
      productId: review.product_id,
      userId: review.user_id,
      rating: review.rating,
      actorId,
      occurredAt: deletedAt,
    });

    await this.publishRatingSynced(review.product_id, actorId);

    return {
      success: true,
      message: REVIEW_MESSAGES.REVIEW_DELETED,
      deletedAt,
      deletedAtFa: formatPersianDateTime(deletedAt),
      audit: {
        actorId: actorId ?? null,
        action,
      },
    };
  }

  private async findMappedReviewForAdmin(
    reviewId: string,
  ): Promise<MappedReview> {
    const review = await this.findReviewRow(reviewId);

    return this.mapReviewRow(review);
  }

  private async findReviewRow(reviewId: string): Promise<ReviewRow> {
    const rows = await this.prisma.$queryRaw<ReviewRow[]>(
      Prisma.sql`
          SELECT
            r."id",
            r."userId" AS user_id,
            r."productId" AS product_id,
            r."rating",
            r."title",
            r."comment",
            r."isVerified" AS is_verified,
            r."createdAt" AS created_at,
            r."updatedAt" AS updated_at,
            p."name" AS product_name,
            p."slug" AS product_slug,
            p."sku" AS product_sku,
            u."email" AS user_email,
            u."firstName" AS user_first_name,
            u."lastName" AS user_last_name
          FROM "ProductReview" r
          LEFT JOIN "Product" p
            ON p."id" = r."productId"
          LEFT JOIN "User" u
            ON u."id" = r."userId"
          WHERE r."id" = ${reviewId}
          LIMIT 1
        `,
    );

    if (!rows[0]) {
      throw new NotFoundException(REVIEW_MESSAGES.REVIEW_NOT_FOUND);
    }

    return rows[0];
  }

  private async findProductContext(
    productId: string,
  ): Promise<ProductContextRow> {
    const rows = await this.prisma.$queryRaw<ProductContextRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "name",
            "slug",
            "sku",
            "isActive" AS is_active,
            "status"::text AS status,
            "deleted_at" AS deleted_at
          FROM "Product"
          WHERE "id" = ${productId}
          LIMIT 1
        `,
    );

    if (!rows[0]) {
      throw new NotFoundException(REVIEW_MESSAGES.PRODUCT_NOT_FOUND);
    }

    return rows[0];
  }

  private assertProductVisible(product: ProductContextRow): void {
    if (
      product.deleted_at !== null ||
      product.is_active !== true ||
      product.status !== 'ACTIVE'
    ) {
      throw new NotFoundException(REVIEW_MESSAGES.PRODUCT_NOT_FOUND);
    }
  }

  private assertProductReviewable(product: ProductContextRow): void {
    if (
      product.deleted_at !== null ||
      product.is_active !== true ||
      product.status !== 'ACTIVE'
    ) {
      throw new BadRequestException(REVIEW_MESSAGES.PRODUCT_NOT_REVIEWABLE);
    }
  }

  private async assertUserExists(userId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "User"
          WHERE "id" = ${userId}
            AND "deleted_at" IS NULL
            AND "status"::text = 'ACTIVE'
        `,
    );

    if (this.toNumber(rows[0]?.count) === 0) {
      throw new BadRequestException(REVIEW_MESSAGES.USER_NOT_FOUND_OR_INACTIVE);
    }
  }

  private async hasVerifiedPurchase(
    userId: string,
    productId: string,
  ): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "Order" o
          INNER JOIN "OrderItem" oi
            ON oi."orderId" = o."id"
          WHERE o."userId" = ${userId}
            AND oi."productId" = ${productId}
            AND o."deleted_at" IS NULL
            AND o."status"::text IN ('PROCESSING', 'SHIPPED', 'DELIVERED')
        `,
    );

    return this.toNumber(rows[0]?.count) > 0;
  }

  private async syncProductRatingTx(
    tx: PrismaTx,
    productId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<RatingAggregateRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS review_count,
            ROUND(AVG("rating")::numeric, 2) AS average_rating
          FROM "ProductReview"
          WHERE "productId" = ${productId}
            AND "isVerified" = true
        `,
    );

    const reviewCount = this.toNumber(rows[0]?.review_count);

    const averageRating = this.toDecimal(rows[0]?.average_rating);

    const now = new Date();

    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "Product"
        SET
          "reviewCount" = ${reviewCount},
          "averageRating" = ${averageRating},
          "updatedAt" = ${now}
        WHERE "id" = ${productId}
          AND "deleted_at" IS NULL
      `,
    );
  }

  private async publishRatingSynced(
    productId: string,
    actorId?: string,
  ): Promise<void> {
    const aggregate = await this.getProductRatingAggregate(productId);

    this.eventPublisher.publishProductRatingSynced({
      productId,
      reviewCount: aggregate.reviewCount,
      averageRating: aggregate.averageRating,
      actorId,
      occurredAt: new Date(),
    });
  }

  private async getProductRatingAggregate(productId: string): Promise<{
    reviewCount: number;
    averageRating: string | null;
  }> {
    const rows = await this.prisma.$queryRaw<RatingAggregateRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS review_count,
            ROUND(AVG("rating")::numeric, 2) AS average_rating
          FROM "ProductReview"
          WHERE "productId" = ${productId}
            AND "isVerified" = true
        `,
    );

    return {
      reviewCount: this.toNumber(rows[0]?.review_count),
      averageRating: this.toNullableString(rows[0]?.average_rating),
    };
  }

  private buildReviewWhereSql(
    query: QueryReviewDto,
    visibility: ReviewListVisibility = 'internal',
  ): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];

    if (query.productId) {
      conditions.push(Prisma.sql`r."productId" = ${query.productId}`);
    }

    if (query.userId) {
      conditions.push(Prisma.sql`r."userId" = ${query.userId}`);
    }

    if (query.rating !== undefined) {
      conditions.push(Prisma.sql`r."rating" = ${query.rating}`);
    }

    if (query.isVerified !== undefined) {
      conditions.push(Prisma.sql`r."isVerified" = ${query.isVerified}`);
    }

    if (query.q) {
      const pattern = `%${query.q}%`;

      const searchConditions = [
        Prisma.sql`r."title" ILIKE ${pattern}`,
        Prisma.sql`r."comment" ILIKE ${pattern}`,
        Prisma.sql`p."name" ILIKE ${pattern}`,
        Prisma.sql`p."sku" ILIKE ${pattern}`,
      ];

      if (visibility === 'internal') {
        searchConditions.push(Prisma.sql`u."email" ILIKE ${pattern}`);
      }

      conditions.push(
        Prisma.sql`
          (${Prisma.join(searchConditions, ' OR ')})
        `,
      );
    }

    if (query.createdFrom) {
      conditions.push(
        Prisma.sql`r."createdAt" >= ${this.parseDate(query.createdFrom)}`,
      );
    }

    if (query.createdTo) {
      conditions.push(
        Prisma.sql`r."createdAt" <= ${this.parseDate(query.createdTo)}`,
      );
    }

    if (conditions.length === 0) {
      return Prisma.empty;
    }

    return Prisma.sql`
      WHERE ${Prisma.join(conditions, ' AND ')}
    `;
  }

  private mapPublicReviewRow(row: ReviewRow) {
    return {
      id: row.id,
      productId: row.product_id,
      rating: row.rating,
      title: row.title,
      comment: row.comment,
      isVerified: row.is_verified,
      author: {
        displayName: 'مشتری وکسو بیوتی',
      },
      createdAt: row.created_at,
      createdAtFa: formatPersianDateTime(row.created_at),
      updatedAt: row.updated_at,
      updatedAtFa: formatPersianDateTime(row.updated_at),
    };
  }

  private mapReviewRow(row: ReviewRow) {
    return {
      id: row.id,
      userId: row.user_id,
      productId: row.product_id,
      rating: row.rating,
      title: row.title,
      comment: row.comment,
      isVerified: row.is_verified,
      product: row.product_name
        ? {
            id: row.product_id,
            name: row.product_name,
            slug: row.product_slug,
            sku: row.product_sku,
          }
        : null,
      user: row.user_email
        ? {
            id: row.user_id,
            email: row.user_email,
            firstName: row.user_first_name,
            lastName: row.user_last_name,
            fullName:
              `${row.user_first_name ?? ''} ${row.user_last_name ?? ''}`.trim(),
          }
        : null,
      createdAt: row.created_at,
      createdAtFa: formatPersianDateTime(row.created_at),
      updatedAt: row.updated_at,
      updatedAtFa: formatPersianDateTime(row.updated_at),
    };
  }

  private buildPagination(query: QueryReviewDto): {
    page: number;
    limit: number;
    skip: number;
  } {
    const page = Math.max(1, Number(query.page ?? 1));

    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));

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
  ): {
    data: T[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  } {
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

  private parseDate(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(REVIEW_MESSAGES.INVALID_DATE);
    }

    return date;
  }

  private toDecimal(
    value: RatingAggregateValue | undefined,
  ): Prisma.Decimal | null {
    if (value === null || value === undefined) {
      return null;
    }

    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }

  private toNullableString(
    value: RatingAggregateValue | undefined,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return value instanceof Prisma.Decimal ? value.toString() : String(value);
  }

  private toNumber(value: number | bigint | null | undefined): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    return value;
  }
}
